// Edge Function: outbound-webhook-dispatcher
// - POST { event, payload, project_id? } => entrega para todos webhooks ativos que assinam o evento
// - POST ?mode=retry            => processa fila de retries (chamado por cron)
// - Assina cada request com HMAC SHA256 no header X-Imperius-Signature
// - Loga toda entrega em imphq_outbound_webhook_deliveries

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000]; // 1min, 5min, 30min

async function hmacSha256(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function deliver(supabase: any, webhook: any, deliveryId: string, event: string, payload: any, attempt: number) {
  const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString(), webhook_id: webhook.id });
  const signature = await hmacSha256(webhook.secret, body);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Imperius-Signature": signature,
    "X-Imperius-Event": event,
    "X-Imperius-Delivery-Id": deliveryId,
    "User-Agent": "Imperius-Webhooks/1.0",
    ...(webhook.headers || {}),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let status_code: number | null = null;
  let response_body = "";
  let error_message: string | null = null;
  let ok = false;

  try {
    const res = await fetch(webhook.url, { method: "POST", headers, body, signal: controller.signal });
    status_code = res.status;
    response_body = (await res.text()).slice(0, 2000);
    ok = res.ok;
  } catch (e: any) {
    error_message = e?.message || String(e);
  } finally {
    clearTimeout(timer);
  }

  const newAttempt = attempt + 1;
  const maxAttempts = webhook.max_attempts ?? 3;
  let status: string;
  let next_retry_at: string | null = null;

  if (ok) {
    status = "success";
  } else if (newAttempt < maxAttempts) {
    status = "retrying";
    const delay = RETRY_DELAYS_MS[Math.min(newAttempt - 1, RETRY_DELAYS_MS.length - 1)];
    next_retry_at = new Date(Date.now() + delay).toISOString();
  } else {
    status = "failed";
  }

  await supabase
    .from("imphq_outbound_webhook_deliveries")
    .update({
      status,
      status_code,
      response_body,
      error_message,
      attempt: newAttempt,
      next_retry_at,
      delivered_at: ok ? new Date().toISOString() : null,
    })
    .eq("id", deliveryId);

  await supabase
    .from("imphq_outbound_webhooks")
    .update({
      last_delivery_at: new Date().toISOString(),
      last_status: status,
      total_deliveries: (webhook.total_deliveries ?? 0) + (attempt === 0 ? 1 : 0),
      total_failures:
        (webhook.total_failures ?? 0) + (status === "failed" && attempt === 0 ? 1 : 0),
    })
    .eq("id", webhook.id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode");

  try {
    // Modo retry: processa entregas com status=retrying e next_retry_at <= now
    if (mode === "retry") {
      const { data: pending } = await supabase
        .from("imphq_outbound_webhook_deliveries")
        .select("*, webhook:imphq_outbound_webhooks(*)")
        .eq("status", "retrying")
        .lte("next_retry_at", new Date().toISOString())
        .limit(50);

      let processed = 0;
      for (const d of pending || []) {
        if (!d.webhook || !d.webhook.active) continue;
        await deliver(supabase, d.webhook, d.id, d.event, d.payload, d.attempt);
        processed++;
      }
      return new Response(JSON.stringify({ processed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Modo dispatch normal
    const body = await req.json();
    const { event, payload, project_id, webhook_id } = body;

    if (!event || !payload) {
      return new Response(JSON.stringify({ error: "event and payload required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Se webhook_id explícito (teste manual ou reenvio), dispara só pra ele
    let webhooks: any[] = [];
    if (webhook_id) {
      const { data } = await supabase
        .from("imphq_outbound_webhooks")
        .select("*")
        .eq("id", webhook_id)
        .eq("active", true);
      webhooks = data || [];
    } else {
      let q = supabase
        .from("imphq_outbound_webhooks")
        .select("*")
        .eq("active", true)
        .contains("events", [event]);
      const { data } = await q;
      webhooks = (data || []).filter(
        (w) => !w.project_id || !project_id || w.project_id === project_id,
      );
    }

    const results: any[] = [];
    for (const w of webhooks) {
      const { data: delivery } = await supabase
        .from("imphq_outbound_webhook_deliveries")
        .insert({ webhook_id: w.id, event, payload, status: "pending", attempt: 0 })
        .select("id")
        .single();
      if (!delivery) continue;
      await deliver(supabase, w, delivery.id, event, payload, 0);
      results.push({ webhook_id: w.id, delivery_id: delivery.id });
    }

    return new Response(JSON.stringify({ dispatched: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[outbound-webhook-dispatcher]", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

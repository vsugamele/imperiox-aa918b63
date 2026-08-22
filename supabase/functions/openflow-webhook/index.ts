// Gatilho público por webhook para o OpenFlow.
// URL: {SUPABASE_URL}/functions/v1/openflow-webhook/{token}
// Qualquer ferramenta externa (Zernio, n8n, Make, plataformas) pode disparar um fluxo.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function getPath(obj: any, path: string): any {
  if (!path) return undefined;
  return path.split(".").reduce((acc: any, k) => {
    if (acc === null || acc === undefined) return undefined;
    const idx = Number(k);
    return Array.isArray(acc) && !Number.isNaN(idx) ? acc[idx] : acc[k];
  }, obj);
}

// Procura o primeiro valor não vazio entre vários caminhos possíveis
function firstOf(obj: any, paths: string[]): any {
  for (const p of paths) {
    const v = getPath(obj, p);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

const AUTO_MAP: Record<string, string[]> = {
  nome: ["nome", "name", "full_name", "fullName", "customer.name", "customer.full_name", "buyer.name", "lead.name", "contact.name", "from.name", "sender.name"],
  email: ["email", "customer.email", "buyer.email", "lead.email", "contact.email"],
  telefone: ["telefone", "phone", "whatsapp", "mobile", "customer.phone", "customer.phone_formated", "buyer.phone", "lead.phone", "contact.phone"],
  produto: ["produto", "product", "product.name", "product_name", "offer", "plan"],
  valor: ["valor", "amount", "price", "value", "sale_amount", "purchase.price.value"],
  mensagem: ["mensagem", "message", "text", "message_content", "body", "message.text"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  // token: último segmento do path ou ?token=
  const segs = url.pathname.split("/").filter(Boolean);
  const token = url.searchParams.get("token") || (segs.length > 1 ? segs[segs.length - 1] : null);

  if (!token || token === "openflow-webhook") {
    return new Response(JSON.stringify({ ok: false, error: "missing token" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supa = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: hook } = await supa
    .from("imphq_flow_webhooks")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (!hook) {
    return new Response(JSON.stringify({ ok: false, error: "invalid token" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // GET = ping/validação do provedor
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ ok: true, hook: hook.nome, ativo: hook.ativo, challenge: url.searchParams.get("hub.challenge") || undefined }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let payload: any = {};
  try {
    const raw = await req.text();
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = {};
  }
  // Query params também entram no payload (útil para provedores que enviam via querystring)
  for (const [k, v] of url.searchParams.entries()) {
    if (k !== "token" && payload[k] === undefined) payload[k] = v;
  }

  try {
    // Dedupe por event_id
    const eventId = String(
      firstOf(payload, ["event_id", "eventId", "id", "transaction", "transaction_id", "order_id"]) ?? "",
    );
    if (eventId && hook.last_event_id === eventId) {
      return new Response(JSON.stringify({ ok: true, deduped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!hook.ativo) {
      await supa
        .from("imphq_flow_webhooks")
        .update({ last_payload: payload, last_received_at: new Date().toISOString() })
        .eq("id", hook.id);
      return new Response(JSON.stringify({ ok: true, skipped: "webhook inativo" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Monta lead_data: payload cru + campos normalizados (mapeamento manual > automático)
    const fieldMap: Record<string, string> = (hook.field_map as any) || {};
    const normalized: Record<string, any> = {};
    for (const key of Object.keys(AUTO_MAP)) {
      const manual = fieldMap[key];
      const v = manual ? getPath(payload, manual) : firstOf(payload, AUTO_MAP[key]);
      if (v !== undefined && v !== null && v !== "") normalized[key] = v;
    }

    const evento = String(
      firstOf(payload, ["evento", "event", "type", "action"]) ?? hook.evento ?? "",
    );

    const leadData: Record<string, any> = {
      ...payload,
      ...normalized,
      phone: normalized.telefone ?? payload.phone ?? null,
      message_content: normalized.mensagem ?? evento,
      mensagem_recebida: normalized.mensagem ?? evento,
      webhook_evento: evento,
      webhook_nome: hook.nome,
      webhook_id: hook.id,
      payload,
    };

    const body: Record<string, unknown> = {
      trigger_tipo: "webhook_externo",
      project_id: hook.project_id,
      lead_data: leadData,
    };
    if (hook.automacao_id) body.automacao_id = hook.automacao_id;

    const res = await fetch(`${SUPABASE_URL}/functions/v1/openflow-executor`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify(body),
    });
    const execResult = await res.text();

    await supa
      .from("imphq_flow_webhooks")
      .update({
        last_payload: payload,
        last_received_at: new Date().toISOString(),
        last_event_id: eventId || null,
        total_recebidos: (hook.total_recebidos || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", hook.id);

    console.log("[openflow-webhook]", hook.nome, "->", res.status, execResult.slice(0, 300));

    return new Response(JSON.stringify({ ok: true, executor_status: res.status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    // Sempre 200 para não travar retries do provedor
    console.error("[openflow-webhook] erro", e?.message);
    return new Response(JSON.stringify({ ok: true, error_logged: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { z } from "https://esm.sh/zod@3.25.76";
// ig-webhook-reprocess — Reprocessa eventos Zernio/Instagram com processed=false
// Útil quando o webhook falhou em encaminhar (instagram-webhook fora do ar etc.)
// Body opcional: { project_id?: string, hours?: number (default 24), limit?: number (default 50) }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json().catch(() => ({}));
    const projectId: string | undefined = body?.project_id;
    const hours: number = Math.min(Math.max(body?.hours ?? 24, 1), 168);
    const limit: number = Math.min(Math.max(body?.limit ?? 50, 1), 200);

    const since = new Date(Date.now() - hours * 3600_000).toISOString();

    const q = supa
      .from("imphq_ig_webhook_logs")
      .select("id, event_type, payload, created_at")
      .eq("processed", false)
      .like("event_type", "zernio_%")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(limit);

    const { data: rows, error } = await q;
    if (error) throw error;

    if (!rows?.length) {
      return new Response(JSON.stringify({ ok: true, reprocessed: 0, message: "Nenhum evento pendente" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    let okCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        const payload = z.object({projectId:z.string().nullish(),data:z.object({account:z.object({projectId:z.string().nullish()}).passthrough().nullish()}).passthrough().nullish()}).passthrough().parse(row.payload);
        // Reinjeta no próprio zernio-webhook (que faz dedupe via messageId)
        const proj = projectId
          || payload?.data?.account?.projectId
          || payload?.projectId
          || "";
        if (!proj) {
          failCount++;
          errors.push(`row ${row.id}: sem project_id`);
          continue;
        }
        const target = `${url.origin}/functions/v1/zernio-webhook?project=${proj}`;
        const res = await fetch(target, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": req.headers.get("Authorization") || "",
          },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          okCount++;
          await supa.from("imphq_ig_webhook_logs")
            .update({ processed: true, error: null })
            .eq("id", row.id);
        } else {
          failCount++;
          const t = await res.text();
          errors.push(`row ${row.id}: ${res.status} ${t.slice(0, 120)}`);
        }
        await new Promise(r => setTimeout(r, 80));
      } catch (e) {
    const eMessage = e instanceof Error ? e.message : e && typeof e === "object" && "message" in e && typeof e.message === "string" ? e.message : undefined;
        failCount++;
        errors.push(`row ${row.id}: ${eMessage}`);
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      total: rows.length,
      reprocessed: okCount,
      failed: failCount,
      errors: errors.slice(0, 10),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const eMessage = e instanceof Error ? e.message : e && typeof e === "object" && "message" in e && typeof e.message === "string" ? e.message : undefined;
    console.error("[ig-webhook-reprocess] Erro:", eMessage);
    return new Response(JSON.stringify({ error: eMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// webhook-error-reprocess — reenvia para o webhook-pagamento todos os eventos que
// caíram em imphq_webhook_errors e nunca foram reprocessados.
//
// Usado de duas formas:
//  1) Botão "Reprocessar tudo" na tela de Log de Webhooks.
//  2) Cron de segurança (a cada 15 min) para auto-curar eventos recusados.
//
// O webhook-pagamento é idempotente (dedup por external_transaction_id), então
// reenviar o mesmo payload não duplica venda.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ErrorRow {
  id: string;
  payload: unknown;
  project_id: string | null;
  plataforma: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  let limit = 50;
  try {
    const body = await req.json();
    if (body && Number.isFinite(Number(body.limit))) limit = Math.min(200, Math.max(1, Number(body.limit)));
  } catch { /* sem body: usa default */ }

  const { data, error } = await supabase
    .from("imphq_webhook_errors")
    .select("id, payload, project_id, plataforma")
    .eq("reprocessado", false)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rows = (data || []) as ErrorRow[];
  let ok = 0;
  let failed = 0;
  const failures: Array<{ id: string; status: number; detail: string }> = [];

  for (const row of rows) {
    if (!row.payload) {
      failed++;
      continue;
    }
    const url = `${SUPABASE_URL}/functions/v1/webhook-pagamento${row.project_id ? `?project=${encodeURIComponent(row.project_id)}` : ""}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify(row.payload),
      });
      const detail = (await res.text()).slice(0, 300);
      if (res.ok) {
        await supabase
          .from("imphq_webhook_errors")
          .update({ reprocessado: true, reprocessado_at: new Date().toISOString() })
          .eq("id", row.id);
        ok++;
      } else {
        failed++;
        failures.push({ id: row.id, status: res.status, detail });
      }
    } catch (e) {
      failed++;
      failures.push({ id: row.id, status: 0, detail: e instanceof Error ? e.message : String(e) });
    }
  }

  console.log(`[webhook-error-reprocess] total=${rows.length} ok=${ok} failed=${failed}`);
  if (failures.length) console.warn(`[webhook-error-reprocess] falhas: ${JSON.stringify(failures).slice(0, 1500)}`);

  return new Response(JSON.stringify({ total: rows.length, reprocessed: ok, failed, failures }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

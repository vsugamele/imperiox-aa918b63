// Custo por automação (Story OP1.4): lê o consumo de cada provedor (OpenRouter, ElevenLabs, Kie) e grava por dia.
// Agendado de hora em hora; a última leitura do dia (23:55 UTC) fecha o dia. Nunca grava chave nem resposta crua.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { readProviderUsage } from "../_shared/provider-usage.ts";

Deno.serve(async () => {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { results, errors } = await readProviderUsage((name) => Deno.env.get(name));
  const usageDate = new Date().toISOString().slice(0, 10);
  if (results.length) {
    const { error } = await supabase.from("imphq_provider_usage_daily").upsert(
      results.map((r) => ({ ...r, usage_date: usageDate, read_at: new Date().toISOString() })),
      { onConflict: "provider,usage_date" },
    );
    if (error) return new Response(JSON.stringify({ ok: false, error: error.message, errors }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
  return new Response(JSON.stringify({ ok: true, usage_date: usageDate, providers: results.map((r) => r.provider), errors }), { headers: { "Content-Type": "application/json" } });
});

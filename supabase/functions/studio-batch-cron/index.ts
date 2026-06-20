// Studio Batch Cron — gera N criativos/dia para projetos "vendendo"
// Cada execução cria um batch com 3 ângulos (curiosidade, prova, antes-depois)
// e dispara creative-factory. Loga em imphq_ai_actions (high risk = aprovação).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { getAnglesForDay } from "../_shared/creativeAngles.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const FORMATO_DEFAULT = "9:16";
const PER_ANGULO = 1;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const projetoIdParam = body?.projeto_id;

    let q = supabase.from("imphq_projetos").select("id, nome, status").in("status", ["vendendo", "Vendendo"]);
    if (projetoIdParam) q = supabase.from("imphq_projetos").select("id, nome, status").eq("id", projetoIdParam);
    const { data: projetos, error: pErr } = await q;
    if (pErr) throw pErr;

    const results: any[] = [];

    for (const proj of projetos || []) {
      try {
        // Anti-spam: já gerou batch hoje?
        const since = new Date(); since.setHours(0,0,0,0);
        const { count } = await supabase.from("imphq_creative_batches")
          .select("id", { count: "exact", head: true })
          .eq("project_id", proj.id)
          .gte("created_at", since.toISOString());
        if ((count || 0) > 0) {
          results.push({ projeto: proj.nome, skipped: "batch_already_today" });
          continue;
        }

        // Rotação diária: 3 dos 11 ângulos do catálogo, varia a cada dia
        const angulosDia = getAnglesForDay(3).map((a) => a.slug);

        // Cria batch
        const { data: batch, error: bErr } = await supabase.from("imphq_creative_batches").insert({
          project_id: proj.id,
          nome: `Lote IA — ${new Date().toLocaleDateString("pt-BR")}`,
          briefing: { auto: true, fonte: "studio-batch-cron" },
          angulos: angulosDia,
          formato: FORMATO_DEFAULT,
          total_planejado: angulosDia.length * PER_ANGULO,
          status: "processando",
        }).select().single();
        if (bErr) throw bErr;

        // Dispara creative-factory (assíncrono, não aguarda conclusão)
        supabase.functions.invoke("creative-factory", {
          body: { batch_id: batch.id, per_angulo: PER_ANGULO },
        }).catch((e) => console.error("creative-factory invoke fail", e));

        // Loga ação na fila (high risk: criativos precisam aprovação humana)
        await supabase.from("imphq_ai_actions").insert({
          kind: "runStudio",
          risk_level: "high",
          status: "executed",
          confidence: 0.9,
          title: `${angulosDia.length} criativos novos para ${proj.nome}`,
          reason: `Lote diário automático — ângulos: ${angulosDia.join(", ")}`,
          payload: { batch_id: batch.id, projeto: proj.nome, angulos: angulosDia },
          projeto_id: proj.id,
          source: "studio-batch-cron",
          auto_executed: true,
          executed_at: new Date().toISOString(),
          result: { batch_id: batch.id, total_planejado: batch.total_planejado },
        });

        results.push({ projeto: proj.nome, batch_id: batch.id, ok: true });
      } catch (e: any) {
        results.push({ projeto: proj.nome, error: String(e?.message || e) });
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("studio-batch-cron:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

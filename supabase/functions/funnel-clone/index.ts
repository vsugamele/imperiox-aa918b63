// funnel-clone — clona um funil + flows + automações para outro projeto
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function newId(prefix = "fun") {
  return `${prefix}_${crypto.randomUUID().slice(0, 12)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const {
      funil_id,
      target_project_id,
      include_flows = true,
      include_automacoes = true,
      include_checklists = true,
      new_nome,
    } = await req.json();

    if (!funil_id || !target_project_id) {
      return new Response(JSON.stringify({ ok: false, error: "funil_id e target_project_id obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const summary: any = { funil: null, automacoes: 0, flows: 0, checklists: 0 };

    // 1. Clona funil
    const { data: src } = await supabase.from("imphq_funis").select("*").eq("id", funil_id).single();
    if (!src) throw new Error("funil origem não encontrado");

    const newFunilId = newId("fun");
    const { error: funErr } = await supabase.from("imphq_funis").insert({
      id: newFunilId,
      nome: new_nome || `${src.nome} (cópia)`,
      tipo: src.tipo,
      status: "Rascunho",
      project_id: target_project_id,
      data: {
        ...(src.data || {}),
        cloned_from: funil_id,
        cloned_at: new Date().toISOString(),
      },
    });
    if (funErr) throw funErr;
    summary.funil = newFunilId;

    // 2. Clona automações do projeto origem (se houver project_id e flag)
    if (include_automacoes && src.project_id) {
      const { data: autos } = await supabase
        .from("imphq_automacoes")
        .select("*")
        .eq("project_id", src.project_id);
      for (const a of autos || []) {
        const { id, created_at, updated_at, ...rest } = a;
        await supabase.from("imphq_automacoes").insert({
          ...rest,
          id: newId("auto"),
          project_id: target_project_id,
          ativo: false,
          nome: `${a.nome} (cópia)`,
        });
        summary.automacoes++;
      }
    }

    // 3. Clona templates WA
    if (include_flows && src.project_id) {
      const { data: tpls } = await supabase
        .from("imphq_wa_campaign_templates")
        .select("*")
        .eq("project_id", src.project_id);
      for (const t of tpls || []) {
        const { id, created_at, updated_at, ...rest } = t;
        await supabase.from("imphq_wa_campaign_templates").insert({
          ...rest,
          project_id: target_project_id,
          nome: `${t.nome} (cópia)`,
        });
        summary.flows++;
      }
    }

    // 4. Clona checklists
    if (include_checklists) {
      const { data: chk } = await supabase
        .from("imphq_funnel_checklist")
        .select("*")
        .eq("funil_id", funil_id);
      for (const c of chk || []) {
        const { id, created_at, updated_at, ...rest } = c;
        await supabase.from("imphq_funnel_checklist").insert({
          ...rest,
          funil_id: newFunilId,
          projeto_id: target_project_id,
        });
        summary.checklists++;
      }
    }

    return new Response(JSON.stringify({ ok: true, ...summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

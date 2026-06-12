// Imperius Executor — executa ações da fila imphq_ai_actions
// Tools: pauseAd, sendWhatsApp, createTask, updateLead, adjustBudget, runStudio
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type ActionKind =
  | "pauseAd"
  | "sendWhatsApp"
  | "createTask"
  | "updateLead"
  | "adjustBudget"
  | "runStudio"
  | "createFlow"
  | "notify";

async function execAction(supabase: any, action: any): Promise<{ ok: boolean; result?: any; revert_payload?: any; error?: string }> {
  const kind: ActionKind = action.kind;
  const p = action.payload || {};
  try {
    switch (kind) {
      case "pauseAd": {
        // Chama facebook-ads-toggle existente
        const r = await supabase.functions.invoke("facebook-ads-toggle", {
          body: { entity_id: p.entity_id, entity_type: p.entity_type || "adset", new_status: "PAUSED", projeto_id: action.projeto_id, reason: action.reason },
        });
        if (r.error) throw new Error(r.error.message);
        return { ok: true, result: r.data, revert_payload: { entity_id: p.entity_id, entity_type: p.entity_type, new_status: "ACTIVE" } };
      }
      case "sendWhatsApp": {
        const r = await supabase.functions.invoke("whatsapp-api", {
          body: { action: "sendText", instance: p.instance, number: p.number, text: p.text },
        });
        if (r.error) throw new Error(r.error.message);
        // log na timeline do lead
        if (p.lead_id) {
          await supabase.from("imphq_lead_activity").insert({
            lead_id: p.lead_id,
            tipo: "whatsapp_ai",
            descricao: `IA enviou: ${p.text?.slice(0, 80)}...`,
            metadata: { auto: true, action_id: action.id },
          });
        }
        return { ok: true, result: r.data };
      }
      case "createTask": {
        const { data, error } = await supabase.from("imphq_tarefas").insert({
          titulo: p.titulo,
          descricao: p.descricao || action.reason,
          projeto_id: action.projeto_id,
          prioridade: p.prioridade || "media",
          status: "pendente",
          origem: "imperius_ai",
        }).select().single();
        if (error) throw error;
        return { ok: true, result: data, revert_payload: { task_id: data.id } };
      }
      case "updateLead": {
        const { data: prev } = await supabase.from("imphq_leads").select("*").eq("id", p.lead_id).single();
        const { data, error } = await supabase.from("imphq_leads").update(p.updates || {}).eq("id", p.lead_id).select().single();
        if (error) throw error;
        return { ok: true, result: data, revert_payload: { lead_id: p.lead_id, updates: prev } };
      }
      case "adjustBudget": {
        const r = await supabase.functions.invoke("facebook-ads-toggle", {
          body: { entity_id: p.entity_id, entity_type: p.entity_type || "adset", new_budget: p.new_budget, projeto_id: action.projeto_id, reason: action.reason },
        });
        if (r.error) throw new Error(r.error.message);
        return { ok: true, result: r.data, revert_payload: { entity_id: p.entity_id, entity_type: p.entity_type, new_budget: p.old_budget } };
      }
      case "runStudio": {
        const r = await supabase.functions.invoke("studio-generate", { body: p });
        if (r.error) throw new Error(r.error.message);
        return { ok: true, result: r.data };
      }
      case "createFlow": {
        const { flow_name, trigger_tipo, projeto_id, produto, acoes } = p;
        if (!flow_name || !trigger_tipo || !Array.isArray(acoes)) {
          throw new Error("createFlow: payload inválido (flow_name, trigger_tipo, acoes)");
        }
        const { data, error } = await supabase.from("imphq_automacoes").insert({
          id: crypto.randomUUID(),
          nome: flow_name,
          trigger_tipo,
          project_id: projeto_id || action.projeto_id || null,
          produto: produto || null,
          acoes,
          ativo: false,
          source: "imperius",
        }).select().single();
        if (error) throw error;
        return { ok: true, result: { flow_id: data.id, redirect: `/openflow?flow=${data.id}` }, revert_payload: { flow_id: data.id } };
      }
      case "notify": {
        // Só registra; UI mostrará no inbox
        return { ok: true, result: { notified: true } };
      }
      default:
        throw new Error(`Tipo de ação desconhecido: ${kind}`);
    }
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const { action_id, mode } = body; // mode: "execute" | "revert" | "approve"

    if (!action_id) throw new Error("action_id obrigatório");

    const { data: action, error: fErr } = await supabase.from("imphq_ai_actions").select("*").eq("id", action_id).single();
    if (fErr || !action) throw new Error("Ação não encontrada");

    if (mode === "revert") {
      if (action.status !== "executed" || !action.revert_payload) {
        throw new Error("Ação não pode ser revertida");
      }
      // Tenta reverter executando uma ação inversa
      const revertAction = { ...action, payload: action.revert_payload, kind: action.kind };
      const r = await execAction(supabase, revertAction);
      await supabase.from("imphq_ai_actions").update({
        status: r.ok ? "reverted" : "failed",
        reverted_at: new Date().toISOString(),
        error: r.error,
      }).eq("id", action_id);
      return new Response(JSON.stringify(r), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // approve / execute
    if (action.status !== "proposed" && action.status !== "approved") {
      return new Response(JSON.stringify({ ok: false, error: `Status inválido: ${action.status}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const r = await execAction(supabase, action);

    await supabase.from("imphq_ai_actions").update({
      status: r.ok ? "executed" : "failed",
      executed_at: new Date().toISOString(),
      result: r.result || null,
      revert_payload: r.revert_payload || action.revert_payload,
      error: r.error || null,
    }).eq("id", action_id);

    return new Response(JSON.stringify({ ok: r.ok, result: r.result, error: r.error }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("imperius-executor:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

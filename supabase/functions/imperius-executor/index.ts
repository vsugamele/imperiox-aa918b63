// Imperius Executor — executa ações da fila imphq_ai_actions
// Tools: pauseAd, sendWhatsApp, createTask, updateLead, adjustBudget, runStudio
// SEGURANÇA: exige JWT válido (usuário autenticado) para evitar execução não autorizada.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { safeError } from "../_shared/errors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

type ActionKind =
  | "pauseAd"
  | "sendWhatsApp"
  | "createTask"
  | "updateLead"
  | "adjustBudget"
  | "runStudio"
  | "createFlow"
  | "notify"
  | "resumeAi"
  | "runHotLeadResponder"
  | "runZernioTool";

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
      case "runHotLeadResponder": {
        // Dispara hot-lead-responder direcionado a uma venda específica
        const { venda_id } = p;
        if (!venda_id) throw new Error("venda_id obrigatório");
        const r = await supabase.functions.invoke("hot-lead-responder", { body: { venda_id } });
        if (r.error) throw new Error(r.error.message);
        return { ok: true, result: r.data };
      }
      case "resumeAi": {
        // Limpa pausa da IA na conversa (volta autônomo)
        const { phone, project_id, conversation_id } = p;
        const prevQ = supabase.from("imphq_wa_conversations").select("id, ai_paused_until, ia_ativa");
        const lookup = conversation_id
          ? prevQ.eq("id", conversation_id)
          : prevQ.eq("project_id", project_id).eq("phone", phone);
        const { data: prev } = await lookup.maybeSingle();
        if (!prev) throw new Error("conversa não encontrada");
        const { error } = await supabase
          .from("imphq_wa_conversations")
          .update({ ai_paused_until: null })
          .eq("id", prev.id);
        if (error) throw error;
        return {
          ok: true,
          result: { conversation_id: prev.id },
          revert_payload: { conversation_id: prev.id, restore_paused_until: prev.ai_paused_until },
        };
      }
      case "runZernioTool": {
        // Invoca tool MCP do Zernio via bridge zernio-mcp
        const { tool, args } = p;
        if (!tool) throw new Error("tool obrigatório");
        if (!action.projeto_id) throw new Error("projeto_id obrigatório (Zernio key é por projeto)");
        const r = await supabase.functions.invoke("zernio-mcp", {
          body: { project_id: action.projeto_id, op: "tools/call", tool, args: args || {} },
        });
        if (r.error) throw new Error(r.error.message);
        if (r.data && r.data.ok === false) throw new Error(typeof r.data.error === "string" ? r.data.error : JSON.stringify(r.data.error));
        // Sem revert_payload — publicação social não tem undo automático
        return { ok: true, result: r.data?.result ?? r.data };
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
    // 🔐 Auth: exige JWT válido
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return safeError(new Error("missing jwt"), { code: "unauthorized", context: "imperius-executor", cors: corsHeaders });
    }
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) {
      return safeError(userErr || new Error("invalid jwt"), { code: "unauthorized", context: "imperius-executor", cors: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const { action_id, mode } = body as { action_id?: string; mode?: string };

    if (!action_id || typeof action_id !== "string") {
      return safeError(new Error("action_id obrigatório"), { code: "validation_error", context: "imperius-executor", cors: corsHeaders });
    }

    const { data: action, error: fErr } = await supabase.from("imphq_ai_actions").select("*").eq("id", action_id).single();
    if (fErr || !action) {
      return safeError(fErr || new Error("not found"), { code: "not_found", context: "imperius-executor", cors: corsHeaders });
    }

    if (mode === "revert") {
      if (action.status !== "executed" || !action.revert_payload) {
        return safeError(new Error("não revertível"), { code: "validation_error", context: "imperius-executor", cors: corsHeaders, expose: "Ação não pode ser revertida." });
      }
      const revertAction = { ...action, payload: action.revert_payload, kind: action.kind };
      const r = await execAction(supabase, revertAction);
      await supabase.from("imphq_ai_actions").update({
        status: r.ok ? "reverted" : "failed",
        reverted_at: new Date().toISOString(),
        error: r.error,
      }).eq("id", action_id);
      return new Response(JSON.stringify({ ok: r.ok }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action.status !== "proposed" && action.status !== "approved") {
      return safeError(new Error(`status ${action.status}`), { code: "validation_error", context: "imperius-executor", cors: corsHeaders, expose: "Ação não está pronta para execução." });
    }

    const r = await execAction(supabase, action);

    await supabase.from("imphq_ai_actions").update({
      status: r.ok ? "executed" : "failed",
      executed_at: new Date().toISOString(),
      result: r.result || null,
      revert_payload: r.revert_payload || action.revert_payload,
      error: r.error || null,
    }).eq("id", action_id);

    return new Response(JSON.stringify({ ok: r.ok, result: r.result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return safeError(e, { code: "internal_error", context: "imperius-executor", cors: corsHeaders });
  }
});

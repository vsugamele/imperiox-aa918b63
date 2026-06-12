// wa-ai-self-tune
// Cron semanal (segunda 04h BR) — IA reescreve seu próprio prompt baseado em dados reais.
//
// COMO FUNCIONA:
// 1. Identifica conversas VENCEDORAS (que geraram venda imphq_vendas status='aprovado')
// 2. Identifica conversas PERDEDORAS (lead respondeu IA, não converteu, esfriou ou foi humano)
// 3. Envia resumos das duas turmas pro LLM "tuner" que retorna proposta de ajustes em:
//    - expert_persona
//    - custom_instructions (regras novas)
// 4. Se auto_tune_apply=true → aplica direto na config
//    Se auto_tune_apply=false → cria proposta em imphq_ai_actions para revisão humana
//
// Filosofia: a IA aprende com vendas reais, não com palpites.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";

const WINDOW_DAYS = 14;
const MAX_PER_BUCKET = 8; // 8 wins + 8 losses por análise (custo controlado)
const MIN_MSGS_PER_CONV = 4;

type ConvSummary = {
  id: string;
  outcome: "win" | "loss";
  digest: string;
};

async function llmTunerAnalysis(currentPersona: string, currentRules: string, wins: ConvSummary[], losses: ConvSummary[]) {
  const apiKey = LOVABLE_API_KEY || OPENROUTER_API_KEY;
  if (!apiKey) return null;
  const url = LOVABLE_API_KEY
    ? "https://ai.gateway.lovable.dev/v1/chat/completions"
    : "https://openrouter.ai/api/v1/chat/completions";
  const model = LOVABLE_API_KEY ? "google/gemini-2.5-flash" : "deepseek/deepseek-chat-v3.1";

  const winsBlock = wins.map((w, i) => `--- VENDA ${i + 1} (CONVERTEU) ---\n${w.digest}`).join("\n\n");
  const lossesBlock = losses.map((l, i) => `--- PERDA ${i + 1} (NÃO CONVERTEU) ---\n${l.digest}`).join("\n\n");

  const prompt = `Você é o tuner de uma IA de vendas pelo WhatsApp. Sua missão é analisar conversas reais que CONVERTERAM em venda vs conversas que NÃO converteram, identificar padrões diferenciadores, e propor ajustes pontuais no prompt para aumentar conversão.

PERSONA ATUAL DA IA:
${currentPersona.slice(0, 600) || "(vazio)"}

REGRAS ATUAIS:
${currentRules.slice(0, 800) || "(vazio)"}

═══ ${wins.length} CONVERSAS QUE CONVERTERAM ═══
${winsBlock.slice(0, 6000)}

═══ ${losses.length} CONVERSAS QUE NÃO CONVERTERAM ═══
${lossesBlock.slice(0, 6000)}

ANÁLISE:
1. Identifique padrões nas vencedoras que NÃO aparecem nas perdedoras
2. Identifique padrões nas perdedoras que NÃO aparecem nas vencedoras
3. Proponha 2-4 regras NOVAS curtas e acionáveis para aumentar conversão
4. Se necessário, proponha pequeno refino na persona (1 frase no máximo)

Seja conservador. Só proponha mudança se o padrão for claro. Não copie regras já existentes.

Retorne EXATAMENTE este JSON:
{
  "patterns_in_wins": ["padrão1", "padrão2"],
  "patterns_in_losses": ["padrão1", "padrão2"],
  "proposed_new_rules": ["regra1", "regra2"],
  "proposed_persona_refine": "frase opcional de refino ou null",
  "confidence": 0.0-1.0,
  "summary": "1-2 linhas resumindo a proposta"
}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return JSON.parse(json?.choices?.[0]?.message?.content || "{}");
  } catch (e: any) {
    console.warn(`[self-tune] LLM error: ${e?.message}`);
    return null;
  }
}

function buildConvDigest(messages: any[]): string {
  return messages
    .slice(-15)
    .map((m: any) => {
      const speaker = m.direction === "incoming" ? "LEAD" : (m.sent_by === "ai" ? "IA" : "HUM");
      return `[${speaker}]: ${String(m.content || "").slice(0, 200)}`;
    })
    .join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supa = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const onlyProjectId = body.project_id || null;
    const dryRun = body.dry_run === true;
    const forceApply = body.force_apply === true;

    let cfgQuery = supa
      .from("imphq_wa_ai_config")
      .select("id, project_id, provider_id, expert_persona, tone, custom_instructions, auto_tune_apply, tune_history")
      .eq("enabled", true)
      .eq("auto_tune_enabled", true);
    if (onlyProjectId) cfgQuery = cfgQuery.eq("project_id", onlyProjectId);

    const { data: configs } = await cfgQuery;
    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify({ ok: true, reason: "no_enabled_configs" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const report: any[] = [];
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 3600 * 1000).toISOString();

    for (const cfg of configs) {
      console.log(`[self-tune] iniciando para project=${cfg.project_id}`);

      // ── WINs: conversas onde o lead tem venda aprovada nos últimos N dias ──
      const { data: wins } = await supa
        .from("imphq_vendas")
        .select("lead_id, produto_nome, data_venda")
        .eq("project_id", cfg.project_id)
        .eq("status", "aprovado")
        .gte("data_venda", since)
        .order("data_venda", { ascending: false })
        .limit(MAX_PER_BUCKET * 2);

      const winLeadIds = (wins || []).map((w: any) => w.lead_id).filter(Boolean);
      if (winLeadIds.length === 0) {
        console.log(`[self-tune] sem vendas em ${WINDOW_DAYS}d para ${cfg.project_id}`);
        report.push({ project_id: cfg.project_id, skipped: "no_wins" });
        continue;
      }

      const { data: winLeads } = await supa
        .from("imphq_leads")
        .select("id, phone")
        .in("id", winLeadIds);
      const winPhones = new Set((winLeads || []).map((l: any) => l.phone).filter(Boolean));

      const { data: winConvs } = await supa
        .from("imphq_wa_conversations")
        .select("id, phone, last_message_at")
        .eq("project_id", cfg.project_id)
        .in("phone", Array.from(winPhones))
        .gte("last_message_at", since)
        .order("last_message_at", { ascending: false })
        .limit(MAX_PER_BUCKET);

      const winSummaries: ConvSummary[] = [];
      for (const conv of (winConvs || [])) {
        const { data: msgs } = await supa
          .from("imphq_wa_messages")
          .select("direction, sent_by, content, created_at")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: true })
          .limit(25);
        if (!msgs || msgs.length < MIN_MSGS_PER_CONV) continue;
        winSummaries.push({ id: conv.id, outcome: "win", digest: buildConvDigest(msgs) });
      }

      // ── LOSSes: conversas com lead engajado (5+ msgs) sem venda aprovada que esfriaram ──
      const { data: lossConvs } = await supa
        .from("imphq_wa_conversations")
        .select("id, phone, last_message_at, message_count")
        .eq("project_id", cfg.project_id)
        .gte("last_message_at", since)
        .lte("last_message_at", new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString())
        .gte("message_count", 5)
        .not("phone", "in", `(${Array.from(winPhones).map(p => `"${p}"`).join(",") || '""'})`)
        .order("last_message_at", { ascending: false })
        .limit(MAX_PER_BUCKET * 3);

      const lossSummaries: ConvSummary[] = [];
      for (const conv of (lossConvs || [])) {
        if (lossSummaries.length >= MAX_PER_BUCKET) break;
        const { data: msgs } = await supa
          .from("imphq_wa_messages")
          .select("direction, sent_by, content, created_at")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: true })
          .limit(25);
        if (!msgs || msgs.length < MIN_MSGS_PER_CONV) continue;
        // Filtro: pelo menos 1 msg de IA (sent_by=ai)
        if (!msgs.some((m: any) => m.sent_by === "ai")) continue;
        lossSummaries.push({ id: conv.id, outcome: "loss", digest: buildConvDigest(msgs) });
      }

      if (winSummaries.length < 2 || lossSummaries.length < 2) {
        console.log(`[self-tune] amostra insuficiente: wins=${winSummaries.length} losses=${lossSummaries.length}`);
        report.push({ project_id: cfg.project_id, skipped: "small_sample", wins: winSummaries.length, losses: lossSummaries.length });
        continue;
      }

      const proposal = await llmTunerAnalysis(
        String(cfg.expert_persona || ""),
        String(cfg.custom_instructions || ""),
        winSummaries,
        lossSummaries
      );

      if (!proposal || Number(proposal.confidence) < 0.6) {
        console.log(`[self-tune] proposta com baixa confiança, descartando`);
        report.push({ project_id: cfg.project_id, skipped: "low_confidence" });
        continue;
      }

      const proposedRules: string[] = Array.isArray(proposal.proposed_new_rules)
        ? proposal.proposed_new_rules.filter((s: any) => typeof s === "string" && s.length > 5 && s.length < 200)
        : [];
      const proposedRefine: string | null = typeof proposal.proposed_persona_refine === "string" && proposal.proposed_persona_refine.length > 5
        ? proposal.proposed_persona_refine.slice(0, 300)
        : null;

      const proposalLog = {
        timestamp: new Date().toISOString(),
        wins_analyzed: winSummaries.length,
        losses_analyzed: lossSummaries.length,
        confidence: Number(proposal.confidence),
        summary: String(proposal.summary || "").slice(0, 400),
        patterns_in_wins: Array.isArray(proposal.patterns_in_wins) ? proposal.patterns_in_wins.slice(0, 5) : [],
        patterns_in_losses: Array.isArray(proposal.patterns_in_losses) ? proposal.patterns_in_losses.slice(0, 5) : [],
        proposed_new_rules: proposedRules,
        proposed_persona_refine: proposedRefine,
        applied: false,
      };

      const shouldApply = forceApply || (cfg.auto_tune_apply === true && !dryRun);

      if (shouldApply) {
        let newInstr = String(cfg.custom_instructions || "").trim();
        if (proposedRules.length > 0) {
          const block = `\n# Auto-tune ${new Date().toLocaleDateString("pt-BR")} (baseado em ${winSummaries.length} vendas vs ${lossSummaries.length} perdas)\n` +
            proposedRules.map(r => `- ${r}`).join("\n");
          newInstr = (newInstr + block).slice(0, 4000);
        }
        let newPersona = String(cfg.expert_persona || "").trim();
        if (proposedRefine) {
          newPersona = (newPersona + `\n${proposedRefine}`).slice(0, 1200);
        }

        proposalLog.applied = true;
        const history = Array.isArray(cfg.tune_history) ? cfg.tune_history : [];
        await supa.from("imphq_wa_ai_config").update({
          custom_instructions: newInstr,
          expert_persona: newPersona,
          last_tune_at: new Date().toISOString(),
          tune_history: [proposalLog, ...history].slice(0, 20),
        }).eq("id", cfg.id);
      } else {
        // Só registra histórico sem aplicar
        const history = Array.isArray(cfg.tune_history) ? cfg.tune_history : [];
        await supa.from("imphq_wa_ai_config").update({
          last_tune_at: new Date().toISOString(),
          tune_history: [proposalLog, ...history].slice(0, 20),
        }).eq("id", cfg.id);
      }

      // Log proposta em imphq_ai_actions (pendente de aprovação se não aplicada)
      await supa.from("imphq_ai_actions").insert({
        projeto_id: cfg.project_id,
        kind: shouldApply ? "prompt_tune_applied" : "prompt_tune_proposal",
        risk_level: shouldApply ? "medium" : "low",
        status: shouldApply ? "completed" : "pending_review",
        title: shouldApply
          ? `🧬 Self-tune aplicado: ${proposedRules.length} regra(s) baseadas em ${winSummaries.length} vendas`
          : `🧬 Self-tune proposta: ${proposedRules.length} regra(s) sugeridas — revisar`,
        reason: proposalLog.summary,
        source: "wa-ai-self-tune",
        payload: proposalLog,
      });

      report.push({
        project_id: cfg.project_id,
        wins: winSummaries.length,
        losses: lossSummaries.length,
        rules_proposed: proposedRules.length,
        persona_refined: !!proposedRefine,
        applied: shouldApply,
        confidence: Number(proposal.confidence),
      });
    }

    return new Response(JSON.stringify({ ok: true, configs_processed: configs.length, report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[wa-ai-self-tune] fatal:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

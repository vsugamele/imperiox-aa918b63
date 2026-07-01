// wa-ai-self-audit
// Cron noturno (03h BR) — IA analisa próprias conversas das últimas 24h que terminaram mal
// (lead sumiu, humano assumiu, lead pediu transição) e extrai padrões problemáticos.
// Auto-aplica em banned_phrases (frases vícios) e custom_instructions (regras gerais)
// quando 2+ conversas independentes apontam o mesmo problema.
//
// Filosofia: a IA fica um pouco melhor todo dia, sem operador precisar revisar.
// Toggle via imphq_wa_ai_config.auto_audit_enabled.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";

const MAX_CONVERSATIONS_PER_CONFIG = 15;
const MIN_HITS_TO_APPLY = 2; // sugestão tem que aparecer em N conversas pra ser auto-aplicada
const MIN_CONFIDENCE = 0.65;

type Finding = {
  failure_type: string;
  banned_phrases_suggestions: string[];
  rule_suggestions: string[];
  confidence: number;
  summary: string;
  conversation_id: string;
};

async function llmAuditConversation(
  systemPromptSnapshot: string,
  conversationDigest: string
): Promise<Omit<Finding, "conversation_id"> | null> {
  const auditorPrompt = `Você é um auditor de IA de vendas pelo WhatsApp. Analise esta conversa que terminou mal (lead sumiu / pediu humano / esfriou) e identifique POR QUE a IA falhou.

CONTEXTO DA IA AUDITADA:
${systemPromptSnapshot.slice(0, 1500)}

HISTÓRICO DA CONVERSA:
${conversationDigest.slice(0, 4000)}

Sua tarefa:
1. Identifique tipos de falha cometidos pela IA
2. Extraia FRASES EXATAS que a IA usou que parecem clichês de bot ou são vícios linguísticos (ex: "Faz todo sentido", "Que legal!", "Entendo perfeitamente"). Só liste frases que aparecem literalmente nas respostas da IA na conversa.
3. Sugira REGRAS GERAIS curtas e acionáveis para evitar erros similares no futuro.

Retorne APENAS JSON válido nesse formato:
{
  "failure_type": "formalidade_excessiva" | "repeticao_frase" | "ignorou_emocao" | "vaga_generica" | "longa_demais" | "ignorou_pergunta" | "tom_robotico" | "outro",
  "banned_phrases_suggestions": ["frase exata 1", "frase exata 2"],
  "rule_suggestions": ["regra curta 1", "regra curta 2"],
  "confidence": 0.85,
  "summary": "diagnóstico em 1 linha do que deu errado"
}

Seja conservador: só sugira banned_phrases se a frase aparece literalmente. Só sugira rules se o problema é claro.`;

  const apiKey = LOVABLE_API_KEY || OPENROUTER_API_KEY;
  if (!apiKey) return null;
  const url = LOVABLE_API_KEY
    ? "https://ai.gateway.lovable.dev/v1/chat/completions"
    : "https://openrouter.ai/api/v1/chat/completions";
  const model = LOVABLE_API_KEY ? "google/gemini-2.5-flash" : "deepseek/deepseek-chat-v3.1";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: auditorPrompt }],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      console.warn(`[self-audit] LLM error ${res.status}`);
      return null;
    }
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    return {
      failure_type: String(parsed.failure_type || "outro"),
      banned_phrases_suggestions: Array.isArray(parsed.banned_phrases_suggestions)
        ? parsed.banned_phrases_suggestions.filter((s: any) => typeof s === "string" && s.trim().length > 3 && s.trim().length < 80)
        : [],
      rule_suggestions: Array.isArray(parsed.rule_suggestions)
        ? parsed.rule_suggestions.filter((s: any) => typeof s === "string" && s.trim().length > 5 && s.trim().length < 200)
        : [],
      confidence: Number(parsed.confidence) || 0,
      summary: String(parsed.summary || "").slice(0, 200),
    };
  } catch (e: any) {
    console.warn(`[self-audit] parse error: ${e?.message}`);
    return null;
  }
}

function buildConversationDigest(messages: any[]): string {
  return messages
    .slice(-20)
    .map((m: any) => {
      const speaker = m.direction === "incoming" ? "LEAD" : (m.sent_by === "ai" ? "IA" : "HUMANO");
      const content = String(m.content || "").slice(0, 300);
      return `[${speaker}]: ${content}`;
    })
    .join("\n");
}

function buildSystemPromptSnapshot(config: any): string {
  const parts: string[] = [];
  if (config.expert_persona) parts.push(`PERSONA: ${String(config.expert_persona).slice(0, 400)}`);
  if (config.tone) parts.push(`TOM: ${config.tone}`);
  if (config.custom_instructions) parts.push(`REGRAS: ${String(config.custom_instructions).slice(0, 400)}`);
  if (Array.isArray(config.banned_phrases) && config.banned_phrases.length) {
    parts.push(`FRASES JÁ PROIBIDAS: ${config.banned_phrases.join(" | ")}`);
  }
  return parts.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supa = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const onlyProjectId = body.project_id || null;
    const dryRun = body.dry_run === true;

    // 1. Configs ativas com auto-audit ligado
    let cfgQuery = supa
      .from("imphq_wa_ai_config")
      .select("id, project_id, provider_id, expert_persona, tone, custom_instructions, banned_phrases, audit_findings")
      .eq("enabled", true)
      .eq("auto_audit_enabled", true);
    if (onlyProjectId) cfgQuery = cfgQuery.eq("project_id", onlyProjectId);
    const { data: configs, error: cfgErr } = await cfgQuery;
    if (cfgErr) throw cfgErr;
    if (!configs || configs.length === 0) {
      console.log("[self-audit] nenhuma config com auto_audit_enabled=true");
      return new Response(JSON.stringify({ ok: true, configs_audited: 0, reason: "no_enabled_configs" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const report: any[] = [];

    for (const cfg of configs) {
      console.log(`[self-audit] iniciando audit para project=${cfg.project_id} provider=${cfg.provider_id || "geral"}`);

      // 2. Conversas "ruins" das últimas 24h ainda não auditadas
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data: badConvs } = await supa
        .from("imphq_wa_conversations")
        .select("id, contact_name, phone, status, last_message_at, last_message_direction, ai_last_reply_at, transferred_to_human_at")
        .eq("project_id", cfg.project_id)
        .is("audited_at", null)
        .gte("last_message_at", since)
        .order("last_message_at", { ascending: false })
        .limit(MAX_CONVERSATIONS_PER_CONFIG * 3);

      // Filtra sinais de "ruim":
      // - status = needs_human
      // - transferred_to_human_at não-null
      // - ai_last_reply_at existe mas última msg é outgoing (IA falou e lead sumiu)
      const candidates = (badConvs || []).filter((c: any) => {
        if (c.status === "needs_human") return true;
        if (c.transferred_to_human_at) return true;
        if (c.ai_last_reply_at && c.last_message_direction === "outgoing") {
          const elapsed = Date.now() - new Date(c.last_message_at || c.ai_last_reply_at).getTime();
          if (elapsed > 6 * 3600 * 1000) return true; // 6h+ sem resposta após IA
        }
        return false;
      }).slice(0, MAX_CONVERSATIONS_PER_CONFIG);

      console.log(`[self-audit] ${candidates.length} conversas candidatas para auditoria`);

      if (candidates.length === 0) {
        await supa.from("imphq_wa_ai_config")
          .update({ last_audit_at: new Date().toISOString() })
          .eq("id", cfg.id);
        report.push({ project_id: cfg.project_id, audited: 0, applied: false });
        continue;
      }

      const sysSnapshot = buildSystemPromptSnapshot(cfg);
      const findings: Finding[] = [];
      const auditedConvIds: string[] = [];

      for (const conv of candidates) {
        const { data: msgs } = await supa
          .from("imphq_wa_messages")
          .select("direction, sent_by, content, created_at")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: true })
          .limit(30);

        if (!msgs || msgs.length < 3) continue;
        const digest = buildConversationDigest(msgs);
        const f = await llmAuditConversation(sysSnapshot, digest);
        if (!f || f.confidence < MIN_CONFIDENCE) {
          auditedConvIds.push(conv.id);
          continue;
        }
        findings.push({ ...f, conversation_id: conv.id });
        auditedConvIds.push(conv.id);
      }

      // 3. Agrega: conta frequência de cada sugestão (case-insensitive trim)
      const phraseCount = new Map<string, { count: number; canonical: string }>();
      const ruleCount = new Map<string, { count: number; canonical: string }>();

      for (const f of findings) {
        for (const p of f.banned_phrases_suggestions) {
          const key = p.toLowerCase().trim();
          const existing = phraseCount.get(key);
          if (existing) existing.count++;
          else phraseCount.set(key, { count: 1, canonical: p.trim() });
        }
        for (const r of f.rule_suggestions) {
          const key = r.toLowerCase().trim().slice(0, 60);
          const existing = ruleCount.get(key);
          if (existing) existing.count++;
          else ruleCount.set(key, { count: 1, canonical: r.trim() });
        }
      }

      const existingBanned: string[] = Array.isArray(cfg.banned_phrases) ? cfg.banned_phrases : [];
      const existingBannedLower = new Set(existingBanned.map((s: string) => s.toLowerCase().trim()));

      const phrasesToAdd = Array.from(phraseCount.values())
        .filter(v => v.count >= MIN_HITS_TO_APPLY && !existingBannedLower.has(v.canonical.toLowerCase()))
        .map(v => v.canonical);

      const rulesToAdd = Array.from(ruleCount.values())
        .filter(v => v.count >= MIN_HITS_TO_APPLY)
        .map(v => v.canonical);

      console.log(`[self-audit] findings=${findings.length} phrasesToAdd=${phrasesToAdd.length} rulesToAdd=${rulesToAdd.length}`);

      // 4. Aplica (a menos que dry_run)
      const newFindingsLog = {
        timestamp: new Date().toISOString(),
        conversations_analyzed: candidates.length,
        conversations_with_findings: findings.length,
        phrases_added: phrasesToAdd,
        rules_added: rulesToAdd,
        failure_types: findings.map(f => ({ type: f.failure_type, summary: f.summary })),
      };

      if (!dryRun) {
        const updatedBanned = [...existingBanned, ...phrasesToAdd];
        let updatedInstr = String(cfg.custom_instructions || "").trim();
        if (rulesToAdd.length > 0) {
          const newBlock = `\n# Auto-aprendido em ${new Date().toLocaleDateString("pt-BR")} (self-audit)\n` +
            rulesToAdd.map(r => `- ${r}`).join("\n");
          updatedInstr = (updatedInstr + newBlock).slice(0, 4000);
        }

        const existingHistory = Array.isArray(cfg.audit_findings) ? cfg.audit_findings : [];
        const updatedHistory = [newFindingsLog, ...existingHistory].slice(0, 30); // mantém últimas 30

        await supa.from("imphq_wa_ai_config").update({
          banned_phrases: updatedBanned,
          custom_instructions: updatedInstr,
          last_audit_at: new Date().toISOString(),
          audit_findings: updatedHistory,
        }).eq("id", cfg.id);

        // Marca conversas como auditadas
        if (auditedConvIds.length > 0) {
          await supa.from("imphq_wa_conversations")
            .update({ audited_at: new Date().toISOString() })
            .in("id", auditedConvIds);
        }

        // Log em imphq_ai_actions
        await supa.from("imphq_ai_actions").insert({
          projeto_id: cfg.project_id,
          kind: "self_audit",
          risk_level: "low",
          status: "completed",
          title: `🧠 Self-audit: ${phrasesToAdd.length} frase(s), ${rulesToAdd.length} regra(s) auto-aplicadas`,
          reason: `Análise noturna de ${candidates.length} conversa(s) ruim(s). ${findings.length} com diagnóstico válido.`,
          source: "wa-ai-self-audit",
          payload: newFindingsLog,
        });
      }

      report.push({
        project_id: cfg.project_id,
        candidates: candidates.length,
        findings: findings.length,
        phrases_added: phrasesToAdd.length,
        rules_added: rulesToAdd.length,
        dry_run: dryRun,
      });
    }

    return new Response(JSON.stringify({ ok: true, configs_audited: configs.length, report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[wa-ai-self-audit] fatal:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

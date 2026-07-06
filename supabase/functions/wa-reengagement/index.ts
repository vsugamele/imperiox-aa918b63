/**
 * wa-reengagement — Reativação automática de leads silenciosos
 *
 * Executa diariamente às 9h. Para cada projeto com IA ativa:
 *   1. Busca conversas silenciosas há ≥ SILENCE_DAYS dias (padrão: 3)
 *   2. Ignora leads que já receberam reengajamento recente (≤ 7 dias)
 *   3. Ignora leads em fluxo ativo do OpenFlow
 *   4. Gera mensagem personalizada via AI (contexto: nome + último tópico)
 *   5. Envia via Evolution API
 *   6. Registra na conversa para evitar spam
 *
 * Limites: máx 50 leads/projeto/rodada | só via Evolution API
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { isWithinSendWindow } from "../_shared/send-window.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_KEY = Deno.env.get("OPENROUTER_API_KEY") || Deno.env.get("LOVABLE_AI_KEY");

// Configurações
const SILENCE_DAYS = 3;        // dias sem resposta para disparar
const MAX_SILENCE_DAYS = 21;   // não reativar leads sumidos há muito tempo
const REENG_COOLDOWN_DAYS = 7; // cooldown entre reengajamentos para o mesmo lead
const MAX_PER_PROJECT = 50;    // limite de leads por projeto por rodada

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const results: Record<string, any> = { processed: 0, sent: 0, skipped: 0, errors: [] };

  try {
    // ── 1. Buscar projetos com IA WhatsApp ativa ──────────────────────────────
    const { data: configs, error: configErr } = await supabase
      .from("imphq_wa_ai_config")
      .select("project_id, provider_id, personality, tone, expert_persona, product_focus, welcome_message")
      .eq("enabled", true)
      .is("provider_id", null); // config principal do projeto

    if (configErr) throw configErr;
    if (!configs?.length) {
      return new Response(JSON.stringify({ ok: true, message: "Nenhum projeto com IA ativa", ...results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nowIso = new Date().toISOString();
    const silenceCutoff = new Date(Date.now() - SILENCE_DAYS * 86400_000).toISOString();
    const maxSilenceCutoff = new Date(Date.now() - MAX_SILENCE_DAYS * 86400_000).toISOString();
    const reengCutoff = new Date(Date.now() - REENG_COOLDOWN_DAYS * 86400_000).toISOString();

    for (const cfg of configs) {
      const { project_id } = cfg;

      try {
        // ── 2. Buscar provider Evolution para este projeto ──────────────────
        const { data: providers } = await supabase
          .from("imphq_wa_providers")
          .select("id, api_url, api_key, instance_name, provider")
          .eq("project_id", project_id)
          .eq("provider", "evolution")
          .eq("ai_enabled", true)
          .limit(1);

        const provider = providers?.[0];
        if (!provider?.api_url || !provider?.api_key) {
          console.log(`[wa-reengagement] Projeto ${project_id}: sem provider Evolution ativo, pulando.`);
          continue;
        }

        // ── 3. Buscar conversas silenciosas ─────────────────────────────────
        const { data: conversations } = await supabase
          .from("imphq_wa_conversations")
          .select(`
            id, phone, contact_name, conversation_summary, ia_ativa,
            last_message_at, ai_last_reply_at, reengagement_sent_at,
            lead_id, message_count
          `)
          .eq("project_id", project_id)
          .eq("ia_ativa", true)
          .lte("last_message_at", silenceCutoff)          // silencioso há ≥ 3 dias
          .gte("last_message_at", maxSilenceCutoff)       // mas não há mais de 21 dias
          .neq("status", "closed")
          .limit(MAX_PER_PROJECT);

        if (!conversations?.length) {
          console.log(`[wa-reengagement] Projeto ${project_id}: sem leads silenciosos.`);
          continue;
        }

        // ── 4. Filtrar cooldown de reengajamento ────────────────────────────
        const eligible = conversations.filter(conv => {
          if (!conv.reengagement_sent_at) return true;
          return new Date(conv.reengagement_sent_at) < new Date(reengCutoff);
        });

        console.log(`[wa-reengagement] Projeto ${project_id}: ${eligible.length}/${conversations.length} elegíveis`);

        // ── 5. Verificar quais estão em fluxo ativo ────────────────────────
        const convIds = eligible.map(c => c.id);
        const { data: activeFlows } = await supabase
          .from("imphq_openflow_executions")
          .select("conversation_id")
          .in("conversation_id", convIds)
          .eq("status", "running");

        const activeFlowConvIds = new Set((activeFlows || []).map((f: any) => f.conversation_id));

        // ── 6. Buscar últimas mensagens de cada conversa (para contexto) ───
        // fazemos em batch para não fazer N queries individuais
        const phoneList = eligible.map(c => c.phone);

        for (const conv of eligible) {
          if (activeFlowConvIds.has(conv.id)) {
            console.log(`[wa-reengagement] ${conv.phone} em fluxo ativo, pulando.`);
            results.skipped++;
            continue;
          }

          // ── Janela de horário ────────────────────────────────────────────────
          if (!isWithinSendWindow(conv.phone)) {
            console.log(`[wa-reengagement] ${conv.phone}: fora da janela de envio (08h-21h local), adiando.`);
            results.skipped++;
            continue;
          }

          results.processed++;

          try {
            // Busca últimas mensagens para contexto do AI
            const { data: recentMsgs } = await supabase
              .from("imphq_wa_messages")
              .select("content, role, created_at")
              .eq("conversation_id", conv.id)
              .order("created_at", { ascending: false })
              .limit(6);

            const lastMsgs = (recentMsgs || []).reverse();
            const lastUserMsg = lastMsgs.filter(m => m.role === "user").slice(-1)[0];
            const daysSilent = Math.floor(
              (Date.now() - new Date(conv.last_message_at).getTime()) / 86400_000
            );

            // ── 7. Gerar mensagem personalizada via AI ──────────────────────
            const leadName = conv.contact_name?.split(" ")[0] || "você";
            const lastTopic = conv.conversation_summary
              ? `O último assunto foi: "${conv.conversation_summary.slice(0, 200)}"`
              : lastUserMsg
                ? `A última mensagem do lead foi: "${lastUserMsg.content?.slice(0, 150)}"`
                : "Não temos contexto do último assunto.";

            const systemPrompt = `Você é um assistente de vendas humano e empático.
${cfg.expert_persona ? `Persona: ${cfg.expert_persona}` : ""}
${cfg.product_focus ? `Produto/Serviço: ${cfg.product_focus}` : ""}
Tom de comunicação: ${cfg.tone || "amigavel"}. Personalidade: ${cfg.personality || "vendedor"}.

CONTEXTO: Este lead ficou ${daysSilent} dias sem responder.
${lastTopic}

REGRAS:
- Escreva UMA única mensagem curta de reativação (máx 3 linhas)
- Mencione o nome do lead: ${leadName}
- Seja natural, quente, curioso — nunca robótico ou vendedor agressivo
- Faça UMA pergunta aberta simples no final
- NÃO use emojis em excesso (máx 1-2)
- NÃO mencione que é uma IA ou sistema automático
- NÃO copie textualmente frases genéricas como "vi que você não respondeu"
- Varie o estilo: pode ser novidade, curiosidade, check-in genuíno, pergunta sobre dor`;

            const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${OPENROUTER_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-3-flash-preview",
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: `Gere a mensagem de reativação para ${leadName}.` },
                ],
                max_tokens: 120,
                temperature: 0.8,
              }),
            });

            if (!aiRes.ok) {
              console.error(`[wa-reengagement] AI error ${aiRes.status} for ${conv.phone}`);
              results.errors.push(`AI error for ${conv.phone}: ${aiRes.status}`);
              continue;
            }

            const aiData = await aiRes.json();
            const reengMsg = aiData?.choices?.[0]?.message?.content?.trim();
            if (!reengMsg) {
              console.error(`[wa-reengagement] AI returned empty message for ${conv.phone}`);
              results.skipped++;
              continue;
            }

            // ── 8. Enviar via Evolution API ────────────────────────────────
            const base = provider.api_url.replace(/\/+$/, "");
            const inst = encodeURIComponent(provider.instance_name);
            const sendUrl = `${base}/message/sendText/${inst}`;

            const sendRes = await fetch(sendUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: provider.api_key },
              body: JSON.stringify({
                number: conv.phone + "@s.whatsapp.net",
                text: reengMsg,
                options: { delay: 1500, presence: "composing" },
              }),
            });

            if (!sendRes.ok) {
              const errText = await sendRes.text();
              console.error(`[wa-reengagement] Evolution send failed for ${conv.phone}: ${sendRes.status} ${errText.slice(0, 100)}`);
              results.errors.push(`Send failed ${conv.phone}: ${sendRes.status}`);
              continue;
            }

            console.log(`[wa-reengagement] ✅ Mensagem enviada para ${leadName} (${conv.phone})`);

            // ── 9. Salvar mensagem enviada + atualizar conversa ────────────
            await Promise.all([
              // Salva na tabela de mensagens
              supabase.from("imphq_wa_messages").insert({
                conversation_id: conv.id,
                project_id,
                role: "assistant",
                content: reengMsg,
                status: "sent",
                is_optimistic: false,
                metadata: { source: "wa-reengagement", days_silent: daysSilent },
              }),
              // Atualiza conversa: registra reengajamento
              supabase.from("imphq_wa_conversations").update({
                reengagement_sent_at: nowIso,
                ai_last_reply_at: nowIso,
              }).eq("id", conv.id),
              // Log de evento para analytics
              supabase.from("imphq_events").insert({
                project_id,
                event_name: "reengagement_sent",
                page_url: "",
                visitor_id: conv.phone,
                event_data: {
                  conversation_id: conv.id,
                  lead_name: leadName,
                  days_silent: daysSilent,
                  message_preview: reengMsg.slice(0, 80),
                },
              }),
            ]);

            results.sent++;

            // Pequena pausa entre envios para não sobrecarregar a API
            await new Promise(r => setTimeout(r, 800));

          } catch (convErr: any) {
            console.error(`[wa-reengagement] Erro ao processar ${conv.phone}:`, convErr.message);
            results.errors.push(`${conv.phone}: ${convErr.message}`);
          }
        }

      } catch (projErr: any) {
        console.error(`[wa-reengagement] Erro no projeto ${project_id}:`, projErr.message);
        results.errors.push(`Project ${project_id}: ${projErr.message}`);
      }
    }

    console.log(`[wa-reengagement] Finalizado:`, results);
    return new Response(JSON.stringify({ ok: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("[wa-reengagement] Fatal:", e.message);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * ig-reengagement — Reativação automática de leads silenciosos no Instagram
 *
 * Espelho do wa-reengagement, mas para DMs do Instagram via Graph API.
 * Executa diariamente às 9h30 (cron separado do WA para não colidir).
 *
 * Lógica:
 *   1. Busca contas IG ativas com IA habilitada
 *   2. Detecta conversas silenciosas há ≥ 3 dias (e ≤ 21 dias)
 *   3. Respeita cooldown de 7 dias por lead
 *   4. Gera mensagem personalizada via AI
 *   5. Envia via Instagram Graph API
 *   6. Registra o envio para evitar spam
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

const SILENCE_DAYS = 3;
const MAX_SILENCE_DAYS = 21;
const REENG_COOLDOWN_DAYS = 7;
const MAX_PER_ACCOUNT = 30; // IG tem limites mais rígidos de DM

// Janela de horário para IG (Brasília)
const WINDOW_START = 9;
const WINDOW_END = 20;

async function sendIgDM(
  igUserId: string,
  recipientId: string,
  message: string,
  pageAccessToken: string,
): Promise<boolean> {
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: message },
        access_token: pageAccessToken,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[ig-reengagement] Graph API error ${res.status}: ${err.slice(0, 150)}`);
    }
    return res.ok;
  } catch (e: any) {
    console.error("[ig-reengagement] sendIgDM error:", e.message);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const results = { processed: 0, sent: 0, skipped: 0, errors: [] as string[] };

  try {
    if (!OPENROUTER_KEY) throw new Error("OPENROUTER_API_KEY não configurada");

    const nowIso = new Date().toISOString();
    const silenceCutoff = new Date(Date.now() - SILENCE_DAYS * 86400_000).toISOString();
    const maxSilenceCutoff = new Date(Date.now() - MAX_SILENCE_DAYS * 86400_000).toISOString();
    const reengCutoff = new Date(Date.now() - REENG_COOLDOWN_DAYS * 86400_000).toISOString();

    // ── 1. Buscar contas IG com IA ativa ────────────────────────────────────
    const { data: accounts, error: accErr } = await supabase
      .from("imphq_ig_accounts")
      .select("id, ig_user_id, page_access_token, project_id, username")
      .eq("ai_enabled", true)
      .not("page_access_token", "is", null);

    if (accErr) throw accErr;
    if (!accounts?.length) {
      return new Response(JSON.stringify({ ok: true, message: "Nenhuma conta IG com IA ativa", ...results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const account of accounts) {
      const { project_id, ig_user_id, page_access_token } = account;

      try {
        // ── 2. Buscar configuração de AI do projeto ───────────────────────
        const { data: aiConfigs } = await supabase
          .from("imphq_wa_ai_config") // usa mesma tabela do WA (config compartilhada por projeto)
          .select("personality, tone, expert_persona, product_focus")
          .eq("project_id", project_id)
          .is("provider_id", null)
          .limit(1);

        const cfg = aiConfigs?.[0] || {};

        // ── 3. Buscar conversas IG silenciosas ────────────────────────────
        const { data: conversations } = await supabase
          .from("imphq_ig_conversations")
          .select("id, participant_id, participant_name, participant_username, last_message_at, reengagement_sent_at, conversation_summary")
          .eq("account_id", account.id)
          .eq("ai_active", true)
          .lte("last_message_at", silenceCutoff)
          .gte("last_message_at", maxSilenceCutoff)
          .neq("status", "closed")
          .limit(MAX_PER_ACCOUNT);

        if (!conversations?.length) continue;

        // ── 4. Filtrar cooldown ────────────────────────────────────────────
        const eligible = conversations.filter((conv) => {
          if (!conv.reengagement_sent_at) return true;
          return new Date(conv.reengagement_sent_at) < new Date(reengCutoff);
        });

        for (const conv of eligible) {
          // Janela de horário: IG não tem DDD, usamos Brasília (sem ajuste de fuso por DDD)
          const nowUtcHour = new Date().getUTCHours();
          const brasiliaHour = ((nowUtcHour - 3) + 24) % 24;
          if (brasiliaHour < WINDOW_START || brasiliaHour >= WINDOW_END) {
            results.skipped++;
            continue;
          }

          results.processed++;

          try {
            const name = conv.participant_name || conv.participant_username || "você";
            const firstName = name.split(" ")[0];
            const daysSilent = Math.floor(
              (Date.now() - new Date(conv.last_message_at).getTime()) / 86400_000,
            );

            // ── 5. Buscar últimas mensagens para contexto ────────────────
            const { data: recentMsgs } = await supabase
              .from("imphq_ig_messages")
              .select("content, role, created_at")
              .eq("conversation_id", conv.id)
              .order("created_at", { ascending: false })
              .limit(4);

            const lastUserMsg = (recentMsgs || []).find((m) => m.role === "user");
            const lastTopic = conv.conversation_summary
              ? `Último assunto: "${conv.conversation_summary.slice(0, 200)}"`
              : lastUserMsg
              ? `Última mensagem: "${lastUserMsg.content?.slice(0, 150)}"`
              : "Sem contexto anterior.";

            // ── 6. Gerar mensagem via AI ─────────────────────────────────
            const systemPrompt = `Você é um assistente de vendas humano e empático no Instagram.
${cfg.expert_persona ? `Persona: ${cfg.expert_persona}` : ""}
${cfg.product_focus ? `Produto/Serviço: ${cfg.product_focus}` : ""}
Tom: ${cfg.tone || "amigavel"}. Personalidade: ${cfg.personality || "vendedor"}.

CONTEXTO: Lead ficou ${daysSilent} dias sem responder no Instagram.
${lastTopic}

REGRAS:
- Escreva UMA mensagem curta de reativação (máx 3 linhas)
- Mencione o nome: ${firstName}
- Seja natural, curioso, humano — nunca robótico
- Faça UMA pergunta aberta no final
- Máx 1-2 emojis
- NÃO mencione que é IA ou sistema automático
- Estilo Instagram: mais casual e visual que WhatsApp`;

            const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: { Authorization: `Bearer ${OPENROUTER_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "google/gemini-3-flash-preview",
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: `Gere a mensagem de reativação para ${firstName}.` },
                ],
                max_tokens: 100,
                temperature: 0.85,
              }),
            });

            if (!aiRes.ok) {
              results.errors.push(`AI error for ${conv.participant_id}: ${aiRes.status}`);
              continue;
            }

            const aiData = await aiRes.json();
            const reengMsg = aiData?.choices?.[0]?.message?.content?.trim();
            if (!reengMsg) { results.skipped++; continue; }

            // ── 7. Enviar DM via Graph API ───────────────────────────────
            const sent = await sendIgDM(ig_user_id, conv.participant_id, reengMsg, page_access_token);
            if (!sent) {
              results.errors.push(`DM failed for ${conv.participant_id}`);
              continue;
            }

            // ── 8. Registrar ─────────────────────────────────────────────
            await Promise.all([
              supabase.from("imphq_ig_messages").insert({
                conversation_id: conv.id,
                project_id,
                role: "assistant",
                content: reengMsg,
                metadata: { source: "ig-reengagement", days_silent: daysSilent },
              }),
              supabase.from("imphq_ig_conversations").update({
                reengagement_sent_at: nowIso,
                last_message_at: nowIso,
              }).eq("id", conv.id),
              supabase.from("imphq_events").insert({
                project_id,
                event_name: "ig_reengagement_sent",
                page_url: "",
                visitor_id: conv.participant_id,
                event_data: {
                  conversation_id: conv.id,
                  participant_name: name,
                  days_silent: daysSilent,
                  message_preview: reengMsg.slice(0, 80),
                },
              }),
            ]);

            results.sent++;
            console.log(`[ig-reengagement] ✅ Enviado para @${conv.participant_username} (${daysSilent}d silencioso)`);

            await new Promise((r) => setTimeout(r, 1200)); // respeita rate limit IG

          } catch (convErr: any) {
            console.error(`[ig-reengagement] Erro ${conv.participant_id}:`, convErr.message);
            results.errors.push(`${conv.participant_id}: ${convErr.message}`);
          }
        }
      } catch (accErrInner: any) {
        console.error(`[ig-reengagement] Conta ${account.id}:`, accErrInner.message);
        results.errors.push(`account ${account.id}: ${accErrInner.message}`);
      }
    }

    console.log("[ig-reengagement] Finalizado:", results);
    return new Response(JSON.stringify({ ok: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("[ig-reengagement] Fatal:", e.message);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

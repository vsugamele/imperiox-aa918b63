/**
 * ig-closer-trigger — Mensagem de fechamento para leads hot no Instagram
 *
 * Espelho do wa-closer-trigger para o canal Instagram.
 * Detecta leads que cruzaram o threshold de score (closer_triggered_at)
 * e ainda não receberam mensagem de fechamento pelo IG.
 *
 * Cron: a cada hora (mesmo timing do WA closer).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_KEY = Deno.env.get("OPENROUTER_API_KEY") || Deno.env.get("LOVABLE_AI_KEY");

const TRIGGER_WINDOW_HOURS = 25;
const MAX_LEADS_PER_RUN = 50;
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
      console.error(`[ig-closer] Graph API ${res.status}: ${err.slice(0, 150)}`);
    }
    return res.ok;
  } catch (e: any) {
    console.error("[ig-closer] sendIgDM error:", e.message);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const results = { processed: 0, sent: 0, skipped: 0, errors: [] as string[] };

  try {
    if (!OPENROUTER_KEY) throw new Error("OPENROUTER_API_KEY não configurada");

    // Janela de horário (Brasília)
    const nowUtcHour = new Date().getUTCHours();
    const brasiliaHour = ((nowUtcHour - 3) + 24) % 24;
    if (brasiliaHour < WINDOW_START || brasiliaHour >= WINDOW_END) {
      return new Response(
        JSON.stringify({ ok: true, message: `Fora da janela de envio (${brasiliaHour}h Brasília). Janela: ${WINDOW_START}h-${WINDOW_END}h.` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const triggerCutoff = new Date(Date.now() - TRIGGER_WINDOW_HOURS * 3600_000).toISOString();

    // ── 1. Leads hot recém-trigados sem ig_closer_sent_at ───────────────────
    const { data: hotLeads, error: leadsErr } = await supabase
      .from("imphq_leads")
      .select("id, nome, phone, ig_participant_id, project_id, score, closer_triggered_at, ig_closer_sent_at")
      .gte("closer_triggered_at", triggerCutoff)
      .is("ig_closer_sent_at", null)
      .not("ig_participant_id", "is", null) // só leads com conta IG
      .limit(MAX_LEADS_PER_RUN);

    if (leadsErr) throw leadsErr;
    if (!hotLeads?.length) {
      return new Response(JSON.stringify({ ok: true, message: "Nenhum lead hot IG pendente", ...results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[ig-closer] ${hotLeads.length} leads hot IG encontrados`);

    for (const lead of hotLeads) {
      results.processed++;
      const leadName = lead.nome?.split(" ")[0] || "você";

      try {
        // ── 2. Buscar conversa IG ativa ────────────────────────────────────
        const { data: convs } = await supabase
          .from("imphq_ig_conversations")
          .select("id, account_id, conversation_summary, ai_active")
          .eq("project_id", lead.project_id)
          .eq("participant_id", lead.ig_participant_id)
          .eq("ai_active", true)
          .neq("status", "closed")
          .limit(1);

        const conv = convs?.[0];
        if (!conv) {
          console.log(`[ig-closer] ${lead.ig_participant_id}: sem conversa IG ativa.`);
          results.skipped++;
          await supabase.from("imphq_leads").update({ ig_closer_sent_at: new Date().toISOString() }).eq("id", lead.id);
          continue;
        }

        // ── 3. Buscar conta IG ────────────────────────────────────────────
        const { data: account } = await supabase
          .from("imphq_ig_accounts")
          .select("ig_user_id, page_access_token")
          .eq("id", conv.account_id)
          .single();

        if (!account?.page_access_token) {
          console.log(`[ig-closer] Conta ${conv.account_id}: sem token.`);
          results.skipped++;
          continue;
        }

        // ── 4. Buscar AI config do projeto ────────────────────────────────
        const { data: aiConfigs } = await supabase
          .from("imphq_wa_ai_config")
          .select("personality, tone, expert_persona, product_focus, payment_link, closer_mode_enabled")
          .eq("project_id", lead.project_id)
          .is("provider_id", null)
          .limit(1);

        const aiCfg = aiConfigs?.[0] || {};
        if (aiCfg.closer_mode_enabled === false) {
          results.skipped++;
          await supabase.from("imphq_leads").update({ ig_closer_sent_at: new Date().toISOString() }).eq("id", lead.id);
          continue;
        }

        // ── 5. Contexto da conversa ────────────────────────────────────────
        const { data: recentMsgs } = await supabase
          .from("imphq_ig_messages")
          .select("content, role")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(4);

        const lastMsg = recentMsgs?.find((m) => m.role === "user");
        const contextHint = conv.conversation_summary
          ? `Contexto: "${conv.conversation_summary.slice(0, 200)}"`
          : lastMsg
          ? `Última mensagem: "${lastMsg.content?.slice(0, 150)}"`
          : "";

        // ── 6. Gerar mensagem de fechamento via AI ─────────────────────────
        const paymentLink = aiCfg.payment_link || "";
        const systemPrompt = `Você é um closer de vendas empático no Instagram.
${aiCfg.expert_persona ? `Persona: ${aiCfg.expert_persona.slice(0, 200)}` : ""}
${aiCfg.product_focus ? `Produto: ${aiCfg.product_focus.slice(0, 200)}` : ""}
Tom: ${aiCfg.tone || "amigavel"}.

SITUAÇÃO: Lead @${lead.ig_participant_id} demonstrou alto interesse (score ${lead.score}/200).
${contextHint}

MISSÃO: UMA mensagem curta de fechamento que:
- Menciona o nome: ${leadName}
- Apresenta a transformação (não o preço diretamente)
- Cria urgência real com base no contexto
- Termina com ação: ${paymentLink ? `link ${paymentLink}` : "pede para confirmar interesse"}
- Máx 3-4 linhas. Estilo Instagram: direto, humano, sem formalidade
- NÃO mencione que é automático`;

        const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENROUTER_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `Gere a mensagem de fechamento para ${leadName}.` },
            ],
            max_tokens: 150,
            temperature: 0.75,
          }),
        });

        if (!aiRes.ok) {
          results.errors.push(`AI ${lead.ig_participant_id}: ${aiRes.status}`);
          continue;
        }

        const aiData = await aiRes.json();
        const closerMsg = aiData?.choices?.[0]?.message?.content?.trim();
        if (!closerMsg) { results.skipped++; continue; }

        // ── 7. Enviar DM ───────────────────────────────────────────────────
        const sent = await sendIgDM(account.ig_user_id, lead.ig_participant_id, closerMsg, account.page_access_token);
        if (!sent) {
          results.errors.push(`DM failed for ${lead.ig_participant_id}`);
          continue;
        }

        console.log(`[ig-closer] ✅ Closer IG enviado para ${leadName} (score=${lead.score})`);

        // ── 8. Registrar ───────────────────────────────────────────────────
        const nowIso = new Date().toISOString();
        await Promise.all([
          supabase.from("imphq_ig_messages").insert({
            conversation_id: conv.id,
            project_id: lead.project_id,
            role: "assistant",
            content: closerMsg,
            metadata: { source: "ig-closer-trigger", lead_score: lead.score },
          }),
          supabase.from("imphq_leads").update({ ig_closer_sent_at: nowIso }).eq("id", lead.id),
          supabase.from("imphq_ig_conversations").update({ last_message_at: nowIso }).eq("id", conv.id),
          supabase.from("imphq_events").insert({
            project_id: lead.project_id,
            event_name: "ig_closer_triggered",
            page_url: "",
            visitor_id: lead.ig_participant_id,
            event_data: { lead_id: lead.id, lead_name: leadName, lead_score: lead.score, message_preview: closerMsg.slice(0, 80) },
          }),
        ]);

        results.sent++;
        await new Promise((r) => setTimeout(r, 800));

      } catch (leadErr: any) {
        console.error(`[ig-closer] Erro ${lead.ig_participant_id}:`, leadErr.message);
        results.errors.push(`${lead.ig_participant_id}: ${leadErr.message}`);
      }
    }

    console.log("[ig-closer] Finalizado:", results);
    return new Response(JSON.stringify({ ok: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("[ig-closer] Fatal:", e.message);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

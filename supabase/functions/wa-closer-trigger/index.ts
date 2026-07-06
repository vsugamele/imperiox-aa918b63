/**
 * wa-closer-trigger — Disparo proativo de fechamento para leads quentes
 *
 * Roda a cada hora. Detecta leads que acabaram de cruzar o threshold de score
 * (closer_triggered_at setado pelo lead-score-updater nas últimas 25h) e ainda
 * não receberam a mensagem de fechamento (closer_message_sent_at NULL).
 *
 * Lógica:
 *   1. Busca leads "hot" recém-trigados (closer_triggered_at últimas 25h)
 *   2. Verifica se têm conversa WA ativa (ia_ativa = true)
 *   3. Gera mensagem personalizada de fechamento via AI
 *      → menciona o produto específico + link de pagamento se disponível
 *      → usa contexto da conversa (último assunto, nome do lead)
 *   4. Envia via Evolution API
 *   5. Seta closer_message_sent_at no lead + salva mensagem na conversa
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

// Janela de detecção: leads trigados nas últimas 25h (1h de margem sobre cron de 24h)
const TRIGGER_WINDOW_HOURS = 25;
const MAX_LEADS_PER_RUN = 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const results = { processed: 0, sent: 0, skipped: 0, errors: [] as string[] };

  try {
    const triggerCutoff = new Date(Date.now() - TRIGGER_WINDOW_HOURS * 3600_000).toISOString();

    // ── 1. Buscar leads recém-trigados sem mensagem de closer enviada ───────
    const { data: hotLeads, error: leadsErr } = await supabase
      .from("imphq_leads")
      .select("id, nome, phone, project_id, score, closer_triggered_at, closer_message_sent_at")
      .gte("closer_triggered_at", triggerCutoff)
      .is("closer_message_sent_at", null)
      .not("phone", "is", null)
      .limit(MAX_LEADS_PER_RUN);

    if (leadsErr) throw leadsErr;
    if (!hotLeads?.length) {
      return new Response(JSON.stringify({ ok: true, message: "Nenhum lead hot pendente", ...results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[wa-closer-trigger] ${hotLeads.length} leads hot encontrados`);

    for (const lead of hotLeads) {
      results.processed++;
      const leadName = lead.nome?.split(" ")[0] || "você";

      // ── Janela de horário ──────────────────────────────────────────────────
      if (!isWithinSendWindow(lead.phone)) {
        console.log(`[wa-closer-trigger] ${lead.phone}: fora da janela (08h-21h local), adiando.`);
        results.skipped++;
        continue;
      }

      try {
        // ── 2. Buscar conversa WA ativa (não pausada) ──────────────────────
        const { data: convs } = await supabase
          .from("imphq_wa_conversations")
          .select("id, conversation_summary, ia_ativa, ai_paused, provider_id")
          .eq("project_id", lead.project_id)
          .eq("phone", lead.phone)
          .eq("ia_ativa", true)
          .neq("status", "closed")
          .limit(1);

        const conv = convs?.[0];
        if (!conv) {
          console.log(`[wa-closer-trigger] ${lead.phone}: sem conversa WA ativa, pulando.`);
          results.skipped++;
          await supabase.from("imphq_leads").update({
            closer_message_sent_at: new Date().toISOString(),
          }).eq("id", lead.id);
          continue;
        }

        // Se humano assumiu a conversa, não interferir
        if (conv.ai_paused) {
          console.log(`[wa-closer-trigger] ${lead.phone}: conversa pausada (humano ativo), pulando.`);
          results.skipped++;
          continue;
        }

        // ── 3. Buscar provider Evolution ───────────────────────────────────
        const { data: providers } = await supabase
          .from("imphq_wa_providers")
          .select("id, api_url, api_key, instance_name, provider")
          .eq("project_id", lead.project_id)
          .eq("provider", "evolution")
          .eq("ai_enabled", true)
          .limit(1);

        const provider = providers?.[0];
        if (!provider?.api_url) {
          console.log(`[wa-closer-trigger] ${lead.phone}: sem provider Evolution, pulando.`);
          results.skipped++;
          continue;
        }

        // ── 4. Buscar AI config para contexto do produto ───────────────────
        const { data: aiConfigs } = await supabase
          .from("imphq_wa_ai_config")
          .select("personality, tone, expert_persona, product_focus, payment_link, closer_mode_enabled")
          .eq("project_id", lead.project_id)
          .is("provider_id", null)
          .limit(1);

        const aiCfg = aiConfigs?.[0] || {};

        // Se closer_mode está desativado no projeto, pula
        if (aiCfg.closer_mode_enabled === false) {
          console.log(`[wa-closer-trigger] ${lead.phone}: closer_mode desativado no projeto, pulando.`);
          results.skipped++;
          await supabase.from("imphq_leads").update({
            closer_message_sent_at: new Date().toISOString(),
          }).eq("id", lead.id);
          continue;
        }

        // ── 5. Buscar últimas mensagens para contexto ──────────────────────
        const { data: recentMsgs } = await supabase
          .from("imphq_wa_messages")
          .select("content, role, created_at")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(4);

        const lastMsg = recentMsgs?.filter(m => m.role === "user")[0];
        const contextHint = conv.conversation_summary
          ? `Contexto da conversa: "${conv.conversation_summary.slice(0, 200)}"`
          : lastMsg
            ? `Última mensagem do lead: "${lastMsg.content?.slice(0, 150)}"`
            : "";

        // ── 6. Gerar mensagem de fechamento via AI ─────────────────────────
        const productInfo = aiCfg.product_focus
          ? `Produto/Oferta: ${aiCfg.product_focus.slice(0, 300)}`
          : "";
        const paymentLink = aiCfg.payment_link || "";

        const systemPrompt = `Você é um closer de vendas experiente, humano e empático.
${aiCfg.expert_persona ? `Persona: ${aiCfg.expert_persona.slice(0, 200)}` : ""}
${productInfo}
Tom: ${aiCfg.tone || "amigavel"}. Personalidade: ${aiCfg.personality || "vendedor"}.

SITUAÇÃO: Este lead (${leadName}) demonstrou alto interesse (score ${lead.score}/200).
${contextHint}

MISSÃO: Escrever UMA mensagem curta e direta de fechamento que:
- Menciona o nome do lead: ${leadName}
- Apresenta claramente o valor/transformação do produto (NÃO o preço)
- Cria senso de urgência REAL (não genérico — use contexto se disponível)
- Termina com ação clara: ${paymentLink ? `inclua o link ${paymentLink}` : "peça para confirmar interesse"}
- Máx 4 linhas. Tom: confiante mas não agressivo
- NÃO use "Olá" genérico — seja direto como alguém que já conhece o lead
- NÃO mencione que é automático ou sistema de IA`;

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
              { role: "user", content: `Gere a mensagem de fechamento para ${leadName}.` },
            ],
            max_tokens: 150,
            temperature: 0.75,
          }),
        });

        if (!aiRes.ok) {
          const errText = await aiRes.text();
          console.error(`[wa-closer-trigger] AI error ${aiRes.status}: ${errText.slice(0, 100)}`);
          results.errors.push(`AI ${lead.phone}: ${aiRes.status}`);
          continue;
        }

        const aiData = await aiRes.json();
        const closerMsg = aiData?.choices?.[0]?.message?.content?.trim();
        if (!closerMsg) {
          results.skipped++;
          continue;
        }

        // ── 7. Enviar via Evolution API ────────────────────────────────────
        const base = provider.api_url.replace(/\/+$/, "");
        const inst = encodeURIComponent(provider.instance_name);
        const sendUrl = `${base}/message/sendText/${inst}`;

        const sendRes = await fetch(sendUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: provider.api_key },
          body: JSON.stringify({
            number: lead.phone + "@s.whatsapp.net",
            text: closerMsg,
            options: { delay: 1200, presence: "composing" },
          }),
        });

        if (!sendRes.ok) {
          const errText = await sendRes.text();
          console.error(`[wa-closer-trigger] Evolution error ${sendRes.status}: ${errText.slice(0, 100)}`);
          results.errors.push(`Send ${lead.phone}: ${sendRes.status}`);
          continue;
        }

        console.log(`[wa-closer-trigger] ✅ Closer enviado para ${leadName} (${lead.phone}) score=${lead.score}`);

        // ── 8. Registrar ───────────────────────────────────────────────────
        const nowIso = new Date().toISOString();
        await Promise.all([
          // Salva mensagem na conversa
          supabase.from("imphq_wa_messages").insert({
            conversation_id: conv.id,
            project_id: lead.project_id,
            role: "assistant",
            content: closerMsg,
            status: "sent",
            is_optimistic: false,
            metadata: {
              source: "wa-closer-trigger",
              lead_score: lead.score,
              closer_triggered_at: lead.closer_triggered_at,
            },
          }),
          // Marca lead
          supabase.from("imphq_leads").update({
            closer_message_sent_at: nowIso,
            updated_at: nowIso,
          }).eq("id", lead.id),
          // Atualiza conversa
          supabase.from("imphq_wa_conversations").update({
            ai_last_reply_at: nowIso,
          }).eq("id", conv.id),
          // Evento de analytics
          supabase.from("imphq_events").insert({
            project_id: lead.project_id,
            event_name: "closer_triggered",
            page_url: "",
            visitor_id: lead.phone,
            event_data: {
              lead_id: lead.id,
              lead_name: leadName,
              lead_score: lead.score,
              message_preview: closerMsg.slice(0, 80),
            },
          }),
        ]);

        results.sent++;

        // Pausa entre envios
        await new Promise(r => setTimeout(r, 600));

      } catch (leadErr: any) {
        console.error(`[wa-closer-trigger] Erro ao processar ${lead.phone}:`, leadErr.message);
        results.errors.push(`${lead.phone}: ${leadErr.message}`);
      }
    }

    console.log(`[wa-closer-trigger] Finalizado:`, results);
    return new Response(JSON.stringify({ ok: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("[wa-closer-trigger] Fatal:", e.message);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

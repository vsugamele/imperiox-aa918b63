/**
 * wa-pitch-followup — Follow-up consultivo automático pós-envio do link de checkout
 *
 * Executa a cada 30min. Para cada projeto com IA WhatsApp ativa e follow-up habilitado:
 *   1. Acha conversas com last_pitch_at definido, sem venda paga depois, sem msg outbound recente
 *   2. Dispara até 3 toques escalonados (delays configuráveis, default 3h / 24h / 48h)
 *      Stage 1: sondar dúvida residual
 *      Stage 2: investigar objeção real (preço, tempo, confiança) + oferecer parcelamento/Pix
 *      Stage 3: oferecer produto de entrada mais barato (último toque)
 *   3. Marca pitch_followup_stage = -1 ao finalizar pra não repetir
 *
 * Respeita janela 08h-21h local e leads em fluxo OpenFlow ativo.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { isWithinSendWindow } from "../_shared/send-window.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || Deno.env.get("OPENROUTER_API_KEY");

const MAX_PER_PROJECT = 40;
const MIN_HOURS_SINCE_LAST_OUTBOUND = 1; // não atropelar mensagem recente da IA

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const results: Record<string, any> = { processed: 0, sent: 0, skipped: 0, finished: 0, errors: [] };

  try {
    const { data: configs } = await supabase
      .from("imphq_wa_ai_config")
      .select("project_id, expert_persona, tone, personality, pitch_followup_enabled, pitch_followup_delays_hours, pitch_followup_entry_product_id")
      .eq("enabled", true)
      .is("provider_id", null);

    if (!configs?.length) {
      return new Response(JSON.stringify({ ok: true, message: "Sem projetos com IA ativa", ...results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nowMs = Date.now();

    for (const cfg of configs) {
      if (cfg.pitch_followup_enabled === false) continue;
      const { project_id } = cfg;
      const delays = (cfg.pitch_followup_delays_hours && cfg.pitch_followup_delays_hours.length === 3)
        ? cfg.pitch_followup_delays_hours
        : [3, 24, 48];

      try {
        const { data: providers } = await supabase
          .from("imphq_wa_providers")
          .select("id, api_url, api_key, instance_name, provider")
          .eq("project_id", project_id)
          .eq("provider", "evolution")
          .eq("ai_enabled", true)
          .limit(1);
        const provider = providers?.[0];
        if (!provider?.api_url || !provider?.api_key) continue;

        const { data: project } = await supabase
          .from("imphq_projects")
          .select("name, data")
          .eq("id", project_id)
          .maybeSingle();
        const d = typeof project?.data === "string" ? JSON.parse(project.data) : (project?.data || {});
        const produtos: any[] = Array.isArray(d?.produtos) ? d.produtos : [];

        // Conversas elegíveis: tem pitch, ainda no ciclo (>=0), não em fluxo, IA ativa
        const { data: conversations } = await supabase
          .from("imphq_wa_conversations")
          .select("id, phone, contact_name, lead_id, last_pitch_at, last_pitch_produto, last_pitch_link, pitch_followup_stage, pitch_followup_last_at, ai_last_reply_at, conversation_summary")
          .eq("project_id", project_id)
          .eq("ia_ativa", true)
          .not("last_pitch_at", "is", null)
          .gte("pitch_followup_stage", 0)
          .lt("pitch_followup_stage", 3)
          .neq("status", "closed")
          .limit(MAX_PER_PROJECT);

        if (!conversations?.length) continue;

        const convIds = conversations.map(c => c.id);
        let inFlow = new Set<string>();
        try {
          const { data: activeFlows } = await supabase
            .from("imphq_openflow_executions" as any)
            .select("conversation_id")
            .in("conversation_id", convIds)
            .eq("status", "running");
          inFlow = new Set((activeFlows || []).map((f: any) => f.conversation_id));
        } catch (_) { /* tabela pode não existir nesse projeto */ }

        for (const conv of conversations) {
          if (inFlow.has(conv.id)) { results.skipped++; continue; }
          if (!isWithinSendWindow(conv.phone)) { results.skipped++; continue; }

          const stageNext = (conv.pitch_followup_stage || 0) + 1; // 1, 2 ou 3
          const delayH = delays[stageNext - 1];
          const referenceAt = conv.pitch_followup_last_at || conv.last_pitch_at;
          if (!referenceAt) { results.skipped++; continue; }
          const hoursSince = (nowMs - new Date(referenceAt).getTime()) / 3_600_000;
          if (hoursSince < delayH) { results.skipped++; continue; }

          if (conv.ai_last_reply_at) {
            const hSinceOutbound = (nowMs - new Date(conv.ai_last_reply_at).getTime()) / 3_600_000;
            if (hSinceOutbound < MIN_HOURS_SINCE_LAST_OUTBOUND) { results.skipped++; continue; }
          }

          // venda paga após o pitch? encerra ciclo
          if (conv.lead_id) {
            const { data: vendas } = await supabase
              .from("imphq_vendas")
              .select("id, status, created_at")
              .eq("lead_id", conv.lead_id)
              .gte("created_at", conv.last_pitch_at)
              .in("status", ["aprovado", "completa", "compra_aprovada"])
              .limit(1);
            if (vendas?.length) {
              await supabase.from("imphq_wa_conversations")
                .update({ pitch_followup_stage: -1 }).eq("id", conv.id);
              results.finished++;
              continue;
            }
          }

          results.processed++;

          // Últimas mensagens p/ contexto
          const { data: recentMsgs } = await supabase
            .from("imphq_wa_messages")
            .select("content, direction, created_at")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: false })
            .limit(8);
          const history = (recentMsgs || []).reverse()
            .map((m: any) => `${m.direction === "outgoing" ? "IA" : "LEAD"}: ${(m.content || "").slice(0, 200)}`)
            .join("\n");

          const leadName = conv.contact_name?.split(" ")[0] || "";
          const produtoOfertado = conv.last_pitch_produto || "o curso";
          const linkOfertado = conv.last_pitch_link || "";

          // Produto entrada (stage 3): config explícita ou produto mais barato com preço
          let entryProduct: any = null;
          if (stageNext === 3) {
            if (cfg.pitch_followup_entry_product_id) {
              entryProduct = produtos.find((p: any) => p.id === cfg.pitch_followup_entry_product_id) || null;
            }
            if (!entryProduct) {
              const ofertado = produtoOfertado.toLowerCase();
              const others = produtos
                .filter((p: any) => {
                  const nome = (p.nome || p.name || "").toLowerCase();
                  const preco = parseFloat(p.preco || p.price || 0);
                  return nome && preco > 0 && !nome.includes(ofertado) && !ofertado.includes(nome);
                })
                .sort((a: any, b: any) => parseFloat(a.preco || a.price || 0) - parseFloat(b.preco || b.price || 0));
              entryProduct = others[0] || null;
            }
          }

          // Objeções calibradas do projeto (contexto extra)
          const { data: objs } = await supabase
            .from("imphq_wa_objections" as any)
            .select("objecao, resposta_padrao")
            .eq("project_id", project_id)
            .limit(8);
          const objBlock = (objs?.length
            ? `OBJEÇÕES CALIBRADAS DO PROJETO (use o teor como referência, não copie literal):\n${objs.map((o: any) => `- "${o.objecao}" → ${o.resposta_padrao}`).join("\n")}\n`
            : "");

          const stageBriefing = stageNext === 1
            ? `Toque 1 — Sondar dúvida residual. O lead recebeu o link há ~${Math.round(hoursSince)}h e não respondeu nem comprou.
- Tom: leve, curioso, sem pressão.
- Pergunte se conseguiu dar uma olhada e se ficou alguma dúvida específica sobre conteúdo, formato de acesso ou se é isso mesmo que ele buscava.
- 1 pergunta aberta no final. Máx 3 linhas.`
            : stageNext === 2
            ? `Toque 2 — Investigar objeção real e remover barreira de pagamento.
- O lead viu o pitch há ~${Math.round(hoursSince)}h após o último contato, ainda não fechou.
- Reconheça que decisão pode envolver investimento e pergunte direto, com empatia, qual a maior barreira: preço, momento, confiança no resultado, ou forma de pagamento.
- Mencione opções concretas: Pix com desconto à vista, parcelamento no cartão, ou alternativa de pagamento se o projeto tiver.
- 1 pergunta no final. Máx 4 linhas.`
            : `Toque 3 — Último toque. Oferecer entrada por valor menor.
- Reconheça em 1 linha que o investimento do ${produtoOfertado} pode não fazer sentido agora.
${entryProduct ? `- Sugira EXPLICITAMENTE pelo nome o produto de entrada: "${entryProduct.nome || entryProduct.name}" (R$ ${entryProduct.preco || entryProduct.price}). Explique em 1 linha por que faz sentido começar por ele.` : `- Sugira começar por um material/curso de entrada mais leve para construir confiança.`}
- Convide a tirar dúvidas. Não pressione.
- Máx 4 linhas. 1 pergunta no final.`;

          const systemPrompt = `Você é um vendedor consultivo humano e empático no WhatsApp, atendendo para "${project?.name || project_id}".
${cfg.expert_persona ? `Persona: ${cfg.expert_persona}.` : ""}
Tom: ${cfg.tone || "amigavel"}. Personalidade: ${cfg.personality || "consultor"}.

CONTEXTO:
- Lead: ${leadName || "(sem nome)"}
- Produto ofertado anteriormente: ${produtoOfertado}${linkOfertado ? ` (link: ${linkOfertado})` : ""}
- Resumo da conversa: ${conv.conversation_summary?.slice(0, 300) || "—"}
- Últimas mensagens:
${history || "—"}

${objBlock}
${stageBriefing}

REGRAS RÍGIDAS:
- NUNCA repita frases que aparecem nas últimas mensagens acima.
- NÃO reenvie o link de checkout neste toque, a menos que o lead tenha perdido.
- NÃO use placeholders [link] ou [nome]. Se não souber algo concreto, omita.
- Escreva como pessoa real no WhatsApp, em pt-BR, sem emojis em excesso (máx 1).
- Saída: APENAS o texto da mensagem, sem aspas, sem prefixo, sem assinatura.`;

          let aiText = "";
          try {
            const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: `Gere o toque ${stageNext} agora.` },
                ],
                temperature: 0.85,
                max_tokens: 220,
              }),
            });
            if (!aiRes.ok) {
              const err = await aiRes.text();
              results.errors.push(`ai ${aiRes.status} conv=${conv.id}: ${err.slice(0, 120)}`);
              continue;
            }
            const aiJson = await aiRes.json();
            aiText = (aiJson?.choices?.[0]?.message?.content || "").trim();
          } catch (e: any) {
            results.errors.push(`ai exc conv=${conv.id}: ${e?.message}`);
            continue;
          }
          if (!aiText) { results.skipped++; continue; }

          // Envia via Evolution
          try {
            const sendUrl = `${provider.api_url.replace(/\/$/, "")}/message/sendText/${provider.instance_name}`;
            const sendRes = await fetch(sendUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: provider.api_key },
              body: JSON.stringify({ number: conv.phone, text: aiText }),
            });
            if (!sendRes.ok) {
              const errBody = await sendRes.text();
              results.errors.push(`send ${sendRes.status} conv=${conv.id}: ${errBody.slice(0, 120)}`);
              continue;
            }
            const sendJson = await sendRes.json().catch(() => ({}));
            const msgId = sendJson?.key?.id || null;

            await supabase.from("imphq_wa_messages").insert({
              conversation_id: conv.id,
              project_id,
              phone: conv.phone,
              direction: "outgoing",
              content: aiText,
              message_type: "text",
              provider: provider.provider,
              provider_message_id: msgId,
              status: "sent",
              sent_by: "ai",
              metadata: { source: "wa-pitch-followup", stage: stageNext },
            });

            const updates: any = {
              pitch_followup_stage: stageNext,
              pitch_followup_last_at: new Date().toISOString(),
              ai_last_reply_at: new Date().toISOString(),
              last_message: aiText.slice(0, 500),
              last_message_at: new Date().toISOString(),
              last_message_direction: "outgoing",
            };
            if (stageNext >= 3) updates.pitch_followup_stage = -1; // ciclo finalizado
            await supabase.from("imphq_wa_conversations").update(updates).eq("id", conv.id);

            await supabase.from("imphq_activity_log").insert({
              lead_id: conv.lead_id,
              action: `pitch_followup_sent_stage_${stageNext}`,
              entity_type: "conversa_wa",
              entity_id: conv.id,
              details: { produto: produtoOfertado, hours_since: Math.round(hoursSince) },
            });

            results.sent++;
            console.log(`[wa-pitch-followup] ✅ conv=${conv.id} stage=${stageNext}`);
          } catch (e: any) {
            results.errors.push(`send exc conv=${conv.id}: ${e?.message}`);
          }
        }
      } catch (e: any) {
        results.errors.push(`project ${project_id}: ${e?.message}`);
      }
    }

    return new Response(JSON.stringify({ ok: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

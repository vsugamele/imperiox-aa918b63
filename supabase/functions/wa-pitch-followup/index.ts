import { z } from "https://esm.sh/zod@3.25.76";
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

const EntryProduct = z.object({ id: z.string().nullish(), nome: z.string().nullish(), name: z.string().nullish(), preco: z.union([z.string(), z.number()]).nullish(), price: z.union([z.string(), z.number()]).nullish() }).passthrough();
function errorMessage(value: unknown): string | undefined { if (value && typeof value === "object" && "message" in value && typeof value.message === "string") return value.message; return undefined; }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || Deno.env.get("OPENROUTER_API_KEY");

const MAX_PER_PROJECT = 40;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const results: { processed: number; sent: number; skipped: number; finished: number; errors: string[] } = { processed: 0, sent: 0, skipped: 0, finished: 0, errors: [] };

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
        : [0.35, 2.5, 22];

      try {
        const { data: providers } = await supabase
          .from("imphq_wa_providers")
          .select("id, api_url, api_key, instance_name, provider, ai_enabled, status")
          .eq("project_id", project_id)
          .eq("provider", "evolution");

        if (!providers?.length) continue;
        const providerMap = new Map(providers.map((p) => [p.id, p]));
        const defaultProvider = providers.find((p) => p.ai_enabled && p.api_url && p.api_key) || providers.find((p) => p.api_url && p.api_key);
        if (!defaultProvider) continue;

        const { data: project } = await supabase
          .from("imphq_projects")
          .select("name, data")
          .eq("id", project_id)
          .maybeSingle();
        const d = typeof project?.data === "string" ? JSON.parse(project.data) : (project?.data || {});
        const produtos = z.array(EntryProduct).parse(Array.isArray(d?.produtos) ? d.produtos : []);

        // Conversas elegíveis: tem pitch, ainda no ciclo (>=0), não em fluxo, IA ativa
        const { data: conversations } = await supabase
          .from("imphq_wa_conversations")
          .select("id, provider_id, phone, contact_name, lead_id, last_pitch_at, last_pitch_produto, last_pitch_link, pitch_followup_stage, pitch_followup_last_at, ai_last_reply_at, last_message_direction, last_incoming_at, conversation_summary")
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
            .from("imphq_openflow_executions")
            .select("conversation_id")
            .in("conversation_id", convIds)
            .eq("status", "running");
          inFlow = new Set((activeFlows || []).map((f) => f.conversation_id));
        } catch (_) { /* tabela pode não existir nesse projeto */ }

        for (const conv of conversations) {
          if (inFlow.has(conv.id)) { results.skipped++; continue; }
          if (!isWithinSendWindow(conv.phone)) { results.skipped++; continue; }

          // Se o lead respondeu após o último pitch ou se a última mensagem foi incoming, cancela o ciclo de follow-up imediatamente
          if (conv.last_message_direction === "incoming" || (conv.last_incoming_at && conv.last_pitch_at && new Date(conv.last_incoming_at).getTime() > new Date(conv.last_pitch_at).getTime())) {
            await supabase.from("imphq_wa_conversations")
              .update({ pitch_followup_stage: -1 }).eq("id", conv.id);
            results.finished++;
            continue;
          }

          const stageNext = (conv.pitch_followup_stage || 0) + 1; // 1, 2 ou 3
          const delayH = Number(delays[stageNext - 1]) || 1;
          const referenceAt = conv.pitch_followup_last_at || conv.last_pitch_at;
          if (!referenceAt) { results.skipped++; continue; }
          const hoursSince = (nowMs - new Date(referenceAt).getTime()) / 3_600_000;
          if (hoursSince < delayH) { results.skipped++; continue; }

          // Delay mínimo desde último envio outbound (Stage 1 permite 15min para não colidir com o próprio pitch)
          const minHoursOutbound = stageNext === 1 ? 0.25 : 1.0;
          if (conv.ai_last_reply_at) {
            const hSinceOutbound = (nowMs - new Date(conv.ai_last_reply_at).getTime()) / 3_600_000;
            if (hSinceOutbound < minHoursOutbound) { results.skipped++; continue; }
          }

          // Resolver provider específico da conversa ou fallback para o default ativo
          const provider = (conv.provider_id && providerMap.get(conv.provider_id)) || defaultProvider;
          if (!provider?.api_url || !provider?.api_key || !provider?.instance_name) {
            results.skipped++;
            continue;
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
            .map((m) => `${m.direction === "outgoing" ? "IA" : "LEAD"}: ${(m.content || "").slice(0, 200)}`)
            .join("\n");

          const leadName = conv.contact_name?.split(" ")[0] || "";
          const produtoOfertado = conv.last_pitch_produto || "o curso";
          const linkOfertado = conv.last_pitch_link || "";

          // Produto entrada (stage 3): config explícita ou produto mais barato com preço
          let entryProduct: z.infer<typeof EntryProduct> | null = null;
          if (stageNext === 3) {
            if (cfg.pitch_followup_entry_product_id) {
              entryProduct = produtos.find((p) => p.id === cfg.pitch_followup_entry_product_id) || null;
            }
            if (!entryProduct) {
              const ofertado = produtoOfertado.toLowerCase();
              const others = produtos
                .filter((p) => {
                  const nome = (p.nome || p.name || "").toLowerCase();
                  const preco = parseFloat(String(p.preco || p.price || 0));
                  return nome && preco > 0 && !nome.includes(ofertado) && !ofertado.includes(nome);
                })
                .sort((a, b) => parseFloat(String(a.preco || a.price || 0)) - parseFloat(String(b.preco || b.price || 0)));
              entryProduct = others[0] || null;
            }
          }

          // Objeções calibradas do projeto (contexto extra)
          const { data: objs } = await supabase
            .from("imphq_wa_objections")
            .select("objecao, resposta_padrao")
            .eq("project_id", project_id)
            .limit(8);
          const objBlock = (objs?.length
            ? `OBJEÇÕES CALIBRADAS DO PROJETO (use o teor como referência, não copie literal):\n${objs.map((o) => `- "${o.objecao}" → ${o.resposta_padrao}`).join("\n")}\n`
            : "");

          const stageBriefing = stageNext === 1
            ? `Toque 1 — Sondar de forma rápida e informal se o link abriu certinho. O lead recebeu o link há ~${Math.round(hoursSince * 60)} minutos e não falou mais nada.
- Tom: super informal, curto, como quem acabou de mandar um link e quer saber se deu certo.
- Exemplos de estilo: "Conseguiu abrir o link certinho aí?", "Deu certo o link ou travou aí?", "Passando só pra ver se conseguiu acessar de boa".
- Máx 2 linhas curtas. Sem textão, sem parecer mensagem automática. 1 pergunta direta.`
            : stageNext === 2
            ? `Toque 2 — Investigar objeção real e flexibilizar pagamento.
- O lead recebeu o link há ~${Math.round(hoursSince)}h e ainda não finalizou.
- Reconheça com empatia que a decisão envolve investimento. Pergunte se a trava foi valor, tempo ou forma de pagamento (Pix / cartão parcelado).
- 1 pergunta consultiva no final. Máx 3 linhas.`
            : `Toque 3 — Último toque / Descompressão ou plano de entrada.
- Reconheça com leveza que talvez o momento esteja corrido ou o investimento do ${produtoOfertado} pese agora.
${entryProduct ? `- Sugira a opção de entrada: "${entryProduct.nome || entryProduct.name}" (R$ ${entryProduct.preco || entryProduct.price}) caso queira começar de forma mais acessível.` : `- Diga que se preferir ver isso com calma depois ou tiver qualquer dúvida, tá tudo bem.`}
- Sem pressão comercial. Máx 3 linhas. 1 pergunta acolhedora no final.`;

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
          } catch (e) {
            results.errors.push(`ai exc conv=${conv.id}: ${errorMessage(e)}`);
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

            const updates = {
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
          } catch (e) {
            results.errors.push(`send exc conv=${conv.id}: ${errorMessage(e)}`);
          }
        }
      } catch (e) {
        results.errors.push(`project ${project_id}: ${errorMessage(e)}`);
      }
    }

    return new Response(JSON.stringify({ ok: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: errorMessage(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

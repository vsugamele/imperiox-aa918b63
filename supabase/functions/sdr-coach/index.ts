import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { requireUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const _auth = await requireUser(req);
  if (!_auth.ok) return _auth.response;

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const { project_id, model = "google/gemini-2.5-pro", openrouter_key } = body;

    const apiKey = openrouter_key || OPENROUTER_API_KEY;

    if (!project_id) {
      return new Response(JSON.stringify({ error: "project_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calcular período padrão: últimos 7 dias
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7);

    const periodo_fim = body.periodo_fim || end.toISOString().split("T")[0];
    const periodo_inicio = body.periodo_inicio || start.toISOString().split("T")[0];

    console.log(`[sdr-coach] Iniciando auditoria para project_id=${project_id} de ${periodo_inicio} a ${periodo_fim}`);

    // 1. Buscar mensagens enviadas por humanos no período
    const { data: humanMessages, error: msgErr } = await supabase
      .from("imphq_wa_messages")
      .select("conversation_id, metadata, created_at")
      .eq("project_id", project_id)
      .eq("sent_by", "human")
      .gte("created_at", periodo_inicio + "T00:00:00Z")
      .lte("created_at", periodo_fim + "T23:59:59Z");

    if (msgErr) throw msgErr;

    if (!humanMessages || humanMessages.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          skipped: "no_human_messages",
          message: "Nenhuma mensagem enviada por operador humano foi encontrada no período selecionado.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 2. Extrair conversation_ids únicos e carregar conversas inteiras
    const convIds = [...new Set(humanMessages.map((m: any) => m.conversation_id))];
    console.log(`[sdr-coach] Encontradas ${convIds.length} conversas com intervenção humana.`);

    const [allMessagesRes, conversationsRes, providersRes] = await Promise.all([
      supabase
        .from("imphq_wa_messages")
        .select("conversation_id, content, direction, sent_by, metadata, created_at")
        .in("conversation_id", convIds)
        .order("created_at", { ascending: true }),
      supabase
        .from("imphq_wa_conversations")
        .select("id, contact_name, phone, provider_id")
        .in("id", convIds),
      supabase
        .from("imphq_wa_providers")
        .select("id, instance_name")
        .eq("project_id", project_id),
    ]);

    if (allMessagesRes.error) throw allMessagesRes.error;
    if (conversationsRes.error) throw conversationsRes.error;
    if (providersRes.error) throw providersRes.error;

    const allMessages = allMessagesRes.data || [];
    const conversations = conversationsRes.data || [];
    const providers = providersRes.data || [];

    // Mapeamentos rápidos
    const convMap = new Map(conversations.map((c: any) => [c.id, c]));
    const provMap = new Map(providers.map((p: any) => [p.id, p.instance_name]));

    // 3. Agrupar diálogos inteiros por vendedor
    // Vendedor é identificado por:
    // a) metadata.operator_name em mensagens humanas
    // b) instance_name do provedor da conversa
    // c) "SDR Geral"
    const sellerConversations = new Map<string, Map<string, any[]>>();

    for (const msg of allMessages) {
      const conv = convMap.get(msg.conversation_id);
      if (!conv) continue;

      // Determinar vendedor da mensagem/conversa
      let vendedorName = "SDR Geral";
      // Tenta achar operador na própria mensagem
      if (msg.sent_by === "human" && msg.metadata?.operator_name) {
        vendedorName = msg.metadata.operator_name;
      } else {
        // Fallback para provedor
        const instName = provMap.get(conv.provider_id);
        if (instName) vendedorName = instName;
      }

      if (!sellerConversations.has(vendedorName)) {
        sellerConversations.set(vendedorName, new Map<string, any[]>());
      }

      const sellerMap = sellerConversations.get(vendedorName)!;
      if (!sellerMap.has(msg.conversation_id)) {
        sellerMap.set(msg.conversation_id, []);
      }
      sellerMap.get(msg.conversation_id)!.push(msg);
    }

    const auditsCreated = [];

    // 4. Para cada vendedor, gerar auditoria no OpenRouter
    for (const [vendedor_name, convsMap] of sellerConversations.entries()) {
      console.log(`[sdr-coach] Consolidando transcrições para vendedor: ${vendedor_name}`);
      let transcriptsText = "";
      let count = 0;

      for (const [convId, msgs] of convsMap.entries()) {
        const conv = convMap.get(convId);
        const name = conv?.contact_name || conv?.phone || "Lead Desconhecido";
        transcriptsText += `### CONVERSA COM CLIENTE: ${name} (Phone: ${conv?.phone || "—"})\n`;

        // Pegar apenas as últimas 30 mensagens da conversa para não estourar contexto
        const recentMsgs = msgs.slice(-30);
        for (const m of recentMsgs) {
          const time = new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          const sender = m.direction === "incoming" ? "Lead" : (m.sent_by === "ai" ? "IA" : `Vendedor (${vendedor_name})`);
          transcriptsText += `[${time}] ${sender}: ${m.content}\n`;
        }
        transcriptsText += `\n---\n\n`;
        count++;
        if (count >= 10) break; // Limitar a 10 conversas auditadas por vendedor por vez por limites de contexto
      }

      const systemPrompt = `Você é um SDR Coach e auditor de vendas de elite de WhatsApp no mercado brasileiro.
Seu objetivo é avaliar a qualidade e eficácia do vendedor/SDR humano nas conversas fornecidas.

Vendedor avaliado: "${vendedor_name}"
Período de auditoria: ${periodo_inicio} a ${periodo_fim}

Examine as interações de vendas, especificamente:
1. Empatia e Abordagem: Ele valida as dores, cria rapport e soa natural, ou é mecânico?
2. Script e Condução: Ele segue técnicas de vendas consultivas (ex: SPIN Selling, qualificação, fazer perguntas certas antes de passar preço)?
3. Contorno de Objeções: Como ele contorna objeções comuns (preço, tempo, medo, ceticismo)?
4. Foco no Fechamento: Conduz o lead para o fechamento ou deixa a conversa morrer sem um CTA/pergunta?

Retorne estritamente um JSON estruturado, sem explicações fora do JSON.
Estrutura do JSON esperado:
{
  "score": 85, // Nota de 0 a 100 baseada na qualidade de vendas
  "ponto_forte": "Frase curta resumindo o melhor ponto (ex: Excelente empatia inicial e uso de perguntas de qualificação)",
  "ponto_fraco": "Frase curta resumindo o maior ponto a melhorar (ex: Dificuldade em contornar objeção de preço, passando link rápido demais)",
  "objecao_travou": "Preço | Ceticismo | Tempo | Outra (escolha a principal que travou as vendas)",
  "detalhes": {
    "resumo_geral": "Parágrafo resumindo o desempenho do SDR nas conversas avaliadas.",
    "recomendacoes": [
      "Recomendação acionável 1",
      "Recomendação acionável 2",
      "Recomendação acionável 3"
    ],
    "analise_por_conversa": [
      {
        "cliente": "Nome do cliente ou telefone",
        "nota": 80, // Nota de 0 a 100
        "status": "venda_fechada | perdido | em_andamento",
        "critica": "Comentário curto do que fez bem ou errou nessa conversa específica."
      }
    ]
  }
}`;

      console.log(`[sdr-coach] Chamando OpenRouter para vendedor ${vendedor_name}`);
      const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://imperiox.lovable.app",
          "X-Title": "Imperio HQ",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Aqui estão as transcrições das conversas do SDR para avaliação:\n\n${transcriptsText}` }
          ],
          response_format: { type: "json_object" }
        })
      });

      if (!orRes.ok) {
        const errText = await orRes.text();
        throw new Error(`OpenRouter falhou para ${vendedor_name}: ${orRes.status} ${errText}`);
      }

      const orData = await orRes.json();
      const contentRaw = orData?.choices?.[0]?.message?.content || "{}";
      const parsedAudit = JSON.parse(contentRaw);

      // 5. Salvar auditoria na tabela imphq_sdr_coach_audits
      const { data: inserted, error: insertErr } = await supabase
        .from("imphq_sdr_coach_audits")
        .insert({
          project_id,
          vendedor_name,
          periodo_inicio,
          periodo_fim,
          score: Number(parsedAudit.score ?? 0),
          ponto_forte: parsedAudit.ponto_forte || "Não detalhado",
          ponto_fraco: parsedAudit.ponto_fraco || "Não detalhado",
          objecao_travou: parsedAudit.objecao_travou || "Nenhuma",
          detalhes: parsedAudit.detalhes || {},
        })
        .select()
        .single();

      if (insertErr) {
        console.error(`[sdr-coach] Erro ao salvar auditoria para ${vendedor_name}:`, insertErr.message);
      } else if (inserted) {
        auditsCreated.push(inserted);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        periodo_inicio,
        periodo_fim,
        audits_created_count: auditsCreated.length,
        audits: auditsCreated,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (e: any) {
    console.error("[sdr-coach] Erro fatal:", e);
    return new Response(
      JSON.stringify({ error: e.message || "Erro interno no SDR Coach" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// Motor de Copy unificado. Recebe { intent, input, context } e devolve texto/JSON.
// Resolve system_prompt + model + reasoning + output_format via tabela imphq_copy_engine_prompts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { loadCopyContext, contextToSystemAddendum } from "../_shared/context-loader.ts";
import { deriveAudienceGuardrails, buildGuardBlock, findForbiddenHits } from "../_shared/audience-guardrails.ts";
import { createLogger } from "../_shared/logger.ts";
import { installAiUsageTracking } from "../_shared/ai-usage.ts";
// Custo por automação (OP1.4): registra cada chamada de IA desta function em imphq_ai_usage.
installAiUsageTracking("copy-engine");

const log = createLogger("copy-engine");


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

function resolveProvider(model: string): { url: string; apiKey: string } {
  const isLovable = /^(google|openai)\//.test(model);
  if (isLovable) {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
    return { url: "https://ai.gateway.lovable.dev/v1/chat/completions", apiKey: LOVABLE_API_KEY };
  }
  if (!OPENROUTER_API_KEY) throw new Error(`OPENROUTER_API_KEY não configurada (modelo ${model})`);
  return { url: "https://openrouter.ai/api/v1/chat/completions", apiKey: OPENROUTER_API_KEY };
}

const MessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1).max(50000),
});

const BodySchema = z.object({
  intent: z.string().min(1).max(120),
  input: z.union([
    z.string().min(1).max(50000),
    z.object({ messages: z.array(MessageSchema).min(1).max(50) }),
  ]),
  context: z.object({
    project_id: z.string().min(1).max(120).optional(),
    product_slug: z.string().max(200).optional(),
    lead_id: z.string().uuid().optional(),
    extra: z.record(z.unknown()).optional(),
  }).optional(),
  model_override: z.string().max(120).optional(),
  stream: z.boolean().optional(),
});

const MEMOFLOW_ADS_SYSTEM_PROMPT = `Você é o Estrategista-Chefe de Tráfego Direto & Copywriter Sênior da Império HQ, mestre no Padrão MemoFlow de Esteiras de Anúncios e nas metodologias canônicas de resposta direta (Eugene Schwartz, John Carlton, Derick, Khayat, Bencivenga).

SUA MISSÃO:
Transformar o dossiê do produto, conhecimentos RAG do acervo e ângulo selecionado em um BRIEFING EXECUTIVO DE ANÚNCIOS PRONTO PARA SUBIR, formatado rigorosamente para o gestor de tráfego operar sem atrito.

ESTRUTURA OBRIGATÓRIA DA RESPOSTA (NÃO ALTERE OS CABEÇALHOS NUMERADOS):

# 🚀 BRIEFING EXECUTIVO DE ANÚNCIOS — PADRÃO MEMOFLOW

## 1. ⚙️ INSTRUÇÕES OPERACIONAIS & ARQUITETURA DE CAMPANHA
- **Campanha Sugerida:** [C1 (Principal / Escala) OU C2 (Risco / Teste Radical)] — Orçamento sugerido ($40 a $100/dia por conjunto)
- **Destino Recomendado:** [Advertorial de Pré-venda, VSL ou Página de Oferta Direta]
- **Regra de Julgamento:** Janela de teste de 3 a 4 dias. Cortar criativos que gastarem > 1.5x o CPA-alvo sem conversão.
- **Estratégia de Montagem Rápida:** Manter a Copy Mestre no Texto Principal do anúncio e substituir apenas a 1ª linha pelos Ganchos G1, G2 ou G3 conforme cada criativo visual (imagem ou vídeo).

---

## 2. 🎯 ÂNGULO PERSUASIVO & MECANISMO ÚNICO
- **Nome do Ângulo:** [Nome conciso e magnético do ângulo persuasivo]
- **Avatar Alvo:** [Perfil, faixa etária e nível de consciência de Schwartz (ex: Problem-Aware ou Solution-Aware)]
- **Vilão Batizado:** [A causa invisível / obstáculo oculto que impede o resultado]
- **Mecanismo da Solução:** [Ingrediente-herói ou processo interno que resolve o problema de dentro para fora]
- **Analogia-Mestre:** [Metáfora concreta e visual que explica o mecanismo instantaneamente]

---

## 3. 📝 COPY MESTRE (TEXTO PRINCIPAL / PRIMARY TEXT)
*(Colar este texto completo no campo "Texto Principal" do anúncio no Meta Ads)*

[Escreva aqui a Copy Mestre completa (em português do Brasil), em tom editorial/conversacional de resposta direta:
- Abertura com fato intrigante ou quebra de expectativa.
- Conexão empática imediata com a dor silenciosa ("Won't Tell / Can't Tell").
- Invalidação lógica das soluções externas ou comuns (por que massagens, dietas genéricas ou remédios falharam).
- Apresentação do mecanismo de dentro para fora (se for LinfaFlow: Cleavers sempre abre a narrativa de ingredientes e nunca posicionar como diurético).
- Transição natural e curiosa convidando para ler o artigo completo / advertorial / assistir à apresentação.]

---

## 4. 🪝 3 VARIAÇÕES DE GANCHO (1ª LINHA - SCROLL STOPPERS)
- **Gancho 1 (Causa Raiz / Fato):** "[Frase exata que para o scroll apontando a causa raiz]"
- **Gancho 2 (Contradição / Curiosidade):** "[Frase contraintuitiva que quebra uma crença comum]"
- **Gancho 3 (Identitário / Pergunta Específica):** "[Frase que espelha uma cena cotidiana exata que o avatar vive]"

---

## 5. 📌 3 HEADLINES DE ALTA CONVERSÃO (CAMPO DE TÍTULO)
- **Headline 1 (Editorial / Curiosidade):** [Headline estilo notícia no padrão Eugene Schwartz]
- **Headline 2 (Causa Raiz / Revelação):** [Headline revelando o mecanismo oculto]
- **Headline 3 (Alerta / Quebra de Paradigma):** [Headline de alerta/contraste de crença]

DIRETRIZES DE OURO:
1. Respeite estritamente o conhecimento do produto (se LinfaFlow: gotas sublinguais, 4 botânicos com Cleavers liderando, drenagem linfática e NUNCA diurético; se SlimSoda: GLP-1, células L, baking soda shot).
2. Sem clichês de IA vazios. Escreva como copywriter de resposta direta de alto nível.
`;

const MODELAR_REFERENCIA_SYSTEM_PROMPT = `Você é Diretor Criativo e Copywriter Sênior de resposta direta da Império HQ. Sua especialidade é MODELAR criativos vencedores: pegar um anúncio que já provou funcionar, entender POR QUE ele funciona e reconstruir a mesma engrenagem para outro produto.

Você recebe: o PRODUTO DE DESTINO, o FORMATO desejado e a REFERÊNCIA VENCEDORA já dissecada (dossiê da copy, anatomia por blocos com tempos, cenas e transcrição). O contexto do produto/avatar do projeto vem no fim deste prompt quando houver.

REGRAS DE MODELAGEM
1. Modele a ESTRUTURA, não o texto. Mantenha: a sequência de blocos, a proporção de tempo de cada bloco, o gatilho do gancho (o tipo de quebra de padrão), a virada de crença e o modo de CTA.
2. Troque TODO o conteúdo pelo universo do produto de destino: dor, vilão, mecanismo, prova e promessa do produto. Nunca reaproveite frases da referência.
3. Não invente fatos, números, estudos, depoimentos, ingredientes, garantia, prazo, preço ou desconto. Use só o que está no contexto do produto. Se faltar, escreva [CONFIRMAR: o que precisa] no lugar.
4. Respeite o público do projeto e as palavras proibidas.
5. Linguagem falada em português do Brasil, frases curtas, com artigos e conectivos. Sem clichê de IA ("descubra o segredo", "revolucionário", "transforme sua vida").

FORMATO DA RESPOSTA (markdown, nesta ordem). Comece direto em "## 1.", sem saudação nem comentário antes:
## 1. Por que a referência funciona
3 bullets objetivos: o gatilho do gancho, a virada de crença e o que segura a retenção.

## 2. Mapa de modelagem
Tabela: Bloco da referência (tempo) | Função | Bloco novo para o produto.

## 3. Ganchos
3 opções de gancho, cada uma com o tipo de gatilho entre parênteses.

## 4. Roteiro
Siga exatamente o FORMATO pedido (tabela com tempos quando for vídeo).

## 5. Extras do formato
O que o formato pedir além do roteiro (ex.: árvore da DM, perfil do ator, headlines, conceito da imagem). Se não pedir nada, omita esta seção.

## 6. Checklist antes de gravar
Até 5 itens, incluindo todos os [CONFIRMAR] pendentes.`;

type BuiltinCfg = {
  intent: string; label: string; system_prompt: string; model: string;
  reasoning: string; output_format: string; enabled: boolean; apply_style: boolean;
};

// Intents que funcionam mesmo sem linha em imphq_copy_engine_prompts (a linha da tabela tem precedência).
const BUILTIN_INTENTS: Record<string, BuiltinCfg> = {
  lote_anuncios_memoflow: {
    intent: "lote_anuncios_memoflow",
    label: "Lote de Anúncios MemoFlow (Tráfego)",
    system_prompt: MEMOFLOW_ADS_SYSTEM_PROMPT,
    model: "google/gemini-2.5-pro",
    reasoning: "high",
    output_format: "markdown",
    enabled: true,
    apply_style: true,
  },
  modelar_referencia: {
    intent: "modelar_referencia",
    label: "Criar roteiro a partir de referência dissecada",
    system_prompt: MODELAR_REFERENCIA_SYSTEM_PROMPT,
    model: "google/gemini-2.5-pro",
    reasoning: "high",
    output_format: "markdown",
    enabled: true,
    apply_style: true,
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const { requireUserOrServiceRole } = await import("../_shared/require-auth.ts");
  const auth = await requireUserOrServiceRole(req);
  if (!auth.ok) return auth.response;

  try {
    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return json({ error: "invalid_body", details: parsed.error.flatten() }, 400);
    }
    const body = parsed.data;

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: cfg, error: cfgErr } = await sb
      .from("imphq_copy_engine_prompts")
      .select("*")
      .eq("intent", body.intent)
      .eq("enabled", true)
      .maybeSingle();

    if (cfgErr) log.error("cfg error", cfgErr);

    const activeCfg = cfg ?? BUILTIN_INTENTS[body.intent] ?? null;

    if (!activeCfg) return json({ error: `intent não encontrado: ${body.intent}` }, 404);

    const ctx = body.context
      ? await loadCopyContext(body.context, SERVICE_ROLE, SUPABASE_URL)
      : { project: null, product: null, branding: null, avatar: null, expert: null, lead: null, ofertas_block: "" };

    // Carrega bloco de estilo AUST quando o intent estiver marcado com apply_style
    let styleAddendum = "";
    if (activeCfg.apply_style === true) {
      const { data: styleRow } = await sb
        .from("imphq_copy_engine_prompts")
        .select("system_prompt")
        .eq("intent", "_style_aust_pt")
        .eq("enabled", true)
        .maybeSingle();
      if (styleRow?.system_prompt) {
        styleAddendum = `\n\n---\n${styleRow.system_prompt}`;
      }
    }

    // Guardrails de público (auto a partir do projeto) — evita alucinação de estereótipo.
    const guardrails = ctx.project
      ? deriveAudienceGuardrails(ctx.project.data, body.context?.product_slug)
      : { publico: "", naoPublico: "", palavrasProibidas: [] as string[] };
    const guardBlock = buildGuardBlock(guardrails);

    const systemPrompt = `${activeCfg.system_prompt}${contextToSystemAddendum(ctx)}${guardBlock}${styleAddendum}`;

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];
    if (typeof body.input === "string") {
      messages.push({ role: "user", content: body.input });
    } else if (body.input?.messages) {
      messages.push(...body.input.messages);
    }

    const model = body.model_override || activeCfg.model || "google/gemini-2.5-flash";
    const stream = body.stream === true && activeCfg.output_format !== "json";
    const payload: Record<string, unknown> = { model, messages, stream };
    if (activeCfg.output_format === "json") {
      payload.response_format = { type: "json_object" };
    }

    const { url: providerUrl, apiKey: providerKey } = resolveProvider(model);
    const upstream = await fetch(providerUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${providerKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!upstream.ok) {
      const txt = await upstream.text();
      log.error("upstream", { status: upstream.status, body: txt.slice(0,300) });
      return json({ error: txt }, upstream.status);
    }

    if (stream) {
      return new Response(upstream.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const data = await upstream.json();
    let content: string = data.choices?.[0]?.message?.content ?? "";

    // Validador determinístico: se output viola palavras proibidas, tenta 1 retry corretivo.
    let guardrailViolations: string[] = [];
    if (guardrails.palavrasProibidas.length && content && !stream) {
      guardrailViolations = findForbiddenHits(content, guardrails.palavrasProibidas);
      if (guardrailViolations.length) {
        log.warn("guardrail violado", { violations: guardrailViolations });
        const retryPayload: Record<string, unknown> = {
          model,
          messages: [
            ...messages,
            { role: "assistant", content },
            {
              role: "user",
              content: `Sua resposta violou a REGRA CRÍTICA DE PÚBLICO. Reescreva a resposta INTEIRA removendo/substituindo estas palavras proibidas: ${guardrailViolations.join(", ")}. Mantenha o mesmo formato e intenção original. Responda APENAS com o texto corrigido.`,
            },
          ],
          stream: false,
        };
        if (activeCfg.output_format === "json") retryPayload.response_format = { type: "json_object" };
        const retryRes = await fetch(providerUrl, {
          method: "POST",
          headers: { Authorization: `Bearer ${providerKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(retryPayload),
        });
        if (retryRes.ok) {
          const retryData = await retryRes.json();
          const retryContent = retryData.choices?.[0]?.message?.content ?? "";
          if (retryContent && findForbiddenHits(retryContent, guardrails.palavrasProibidas).length === 0) {
            content = retryContent;
            guardrailViolations = [];
          }
        }
      }
    }

    return json({
      intent: body.intent,
      model,
      output_format: activeCfg.output_format,
      content,
      raw: data,
      guardrail_violations: guardrailViolations,
    });
  } catch (err) {
      const message = err instanceof Error ? err.message : err && typeof err === "object" && "message" in err && typeof err.message === "string" ? err.message : "erro interno";
    log.error("erro interno", { message: message });
    return json({ error: message || "erro interno" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

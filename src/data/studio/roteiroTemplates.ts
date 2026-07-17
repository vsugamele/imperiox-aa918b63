// Templates de roteiros/copy prontos para o Studio.
// Cada template define os campos que o usuário preenche e uma função `build`
// que compõe o prompt final (pronto pra colar em qualquer LLM ou usar no Cofre).

export type RoteiroField = {
  key: string;
  label: string;
  placeholder?: string;
  type?: "text" | "textarea";
  required?: boolean;
};

export type RoteiroTemplate = {
  id: string;
  nome: string;
  emoji: string;
  categoria: "VSL" | "Reels" | "UGC" | "Ads" | "Story";
  descricao: string;
  fields: RoteiroField[];
  build: (values: Record<string, string>, ctx: { avatar: string; branding: string; produto: string }) => string;
};

const ctxBlock = (ctx: { avatar: string; branding: string; produto: string }) => {
  const p: string[] = [];
  if (ctx.produto) p.push(`### PRODUTO\n${ctx.produto}`);
  if (ctx.avatar) p.push(`### AVATAR\n${ctx.avatar}`);
  if (ctx.branding) p.push(`### BRANDING / TOM DE VOZ\n${ctx.branding}`);
  return p.length ? p.join("\n\n") + "\n\n---\n\n" : "";
};

export const ROTEIRO_TEMPLATES: RoteiroTemplate[] = [
  {
    id: "vsl_7_blocos",
    nome: "VSL — 7 Blocos",
    emoji: "🎬",
    categoria: "VSL",
    descricao: "Script de VSL longa (8-15min) na estrutura clássica de 7 blocos.",
    fields: [
      { key: "grande_promessa", label: "Grande Promessa", placeholder: "ex.: Tatuar coberturas perfeitas em 30 dias", required: true },
      { key: "mecanismo", label: "Mecanismo Único (o 'como')", placeholder: "ex.: Método das 3 camadas invertidas" },
      { key: "prova", label: "Prova / autoridade", placeholder: "ex.: 12 anos de estúdio, +2000 alunos" },
      { key: "preco_oferta", label: "Preço + bônus", placeholder: "ex.: R$497 12x + 3 bônus" },
    ],
    build: (v, ctx) => `${ctxBlock(ctx)}Você é um copywriter especialista em VSL de alta conversão (Jon Benson / Stefan Georgi).

Escreva um roteiro de VSL em pt-BR (~1500-2000 palavras) na estrutura dos **7 blocos**:

1. **HOOK / PATTERN INTERRUPT** (0-30s) — quebra padrão + promessa gigante.
2. **INIMIGO COMUM** — quem é o vilão externo (guru genérico, sistema, indústria).
3. **HISTÓRIA DE ORIGEM** — protagonista, transformação, momento "eureka".
4. **MECANISMO ÚNICO** — o método/framework que só o produto entrega.
5. **PROVA** — resultados, cases, autoridade, prints.
6. **OFERTA IRRESISTÍVEL** — preço, bônus, escassez, garantia, quebra de risco.
7. **CTA FINAL + P.S.** — 3 CTAs no fechamento + 2 P.S. de reforço.

## INSUMOS
- Grande promessa: ${v.grande_promessa || "(preencher)"}
- Mecanismo único: ${v.mecanismo || "(criar um coerente)"}
- Prova: ${v.prova || "(gerar hipóteses)"}
- Oferta: ${v.preco_oferta || "(sugerir)"}

## FORMATO DE SAÍDA
Markdown com headings ## por bloco. Falar em pt-BR conversacional (você/te), frases curtas, ritmo de leitura em voz alta.`,
  },
  {
    id: "reel_dica_rapida",
    nome: "Reel — Dica Rápida (15-30s)",
    emoji: "⚡",
    categoria: "Reels",
    descricao: "Reel viral formato 'dica rápida' com hook + 3 passos + CTA.",
    fields: [
      { key: "tema", label: "Tema da dica", placeholder: "ex.: Como precificar um trabalho", required: true },
      { key: "publico", label: "Para quem", placeholder: "ex.: tatuadores iniciantes" },
    ],
    build: (v, ctx) => `${ctxBlock(ctx)}Você é roteirista de Reels virais (formato Alex Hormozi / Justin Welsh).

Escreva UM roteiro de Reel de 15-30s sobre: **${v.tema || "(preencher tema)"}**
Público: ${v.publico || "definir com base no avatar"}

## ESTRUTURA
- **HOOK (0-3s)** — frase curta com dor específica OU número (ex.: "3 erros que estão fazendo você perder…"). Fala + texto na tela.
- **PROBLEMA (3-7s)** — nomeie a dor com precisão.
- **3 PASSOS RÁPIDOS (7-22s)** — 1 frase cada, verbo forte no início.
- **CTA (22-30s)** — "Salva esse para lembrar" ou "Comenta X que eu mando Y".

## FORMATO DE SAÍDA
\`\`\`
[FRAME 0-3s]
FALA: ...
TEXTO NA TELA: ...
B-ROLL: ...

[FRAME 3-7s]
...
\`\`\`
Depois entregue também: 3 variações do HOOK e a legenda pronta (150 chars, com CTA + 5 hashtags).`,
  },
  {
    id: "ugc_depoimento",
    nome: "UGC — Depoimento",
    emoji: "🎙️",
    categoria: "UGC",
    descricao: "Script de UGC estilo depoimento autêntico (para criador enviar).",
    fields: [
      { key: "beneficio", label: "Principal benefício", placeholder: "ex.: aprendi a cobrir tatuagem grande sem borrar", required: true },
      { key: "antes", label: "Situação ANTES", placeholder: "ex.: rejeitava esses trabalhos" },
      { key: "depois", label: "Situação DEPOIS", placeholder: "ex.: virou minha maior fonte de renda" },
    ],
    build: (v, ctx) => `${ctxBlock(ctx)}Você é diretor de UGC (user-generated content) para performance.

Escreva um script de UGC de 30-45s no formato **depoimento autêntico**, para o criador gravar de celular.

## INSUMOS
- Benefício central: ${v.beneficio || "(preencher)"}
- Antes: ${v.antes || "(gerar)"}
- Depois: ${v.depois || "(gerar)"}

## REGRAS
- Linguagem 100% falada, com "tipo assim", "cara", pausas naturais.
- SEM parecer script — evitar palavras corporativas ("investir", "solução").
- Começar com PATTERN INTERRUPT visual (olhar pra câmera, mudar de ambiente, mostrar o produto).

## ESTRUTURA
1. **0-3s HOOK** — 1 frase espontânea que gera curiosidade.
2. **3-15s ANTES** — a dor real, específica, com detalhe sensorial.
3. **15-30s VIRADA** — "aí eu conheci / testei…" (mencionar produto naturalmente).
4. **30-40s DEPOIS** — resultado concreto, número se possível.
5. **40-45s CTA** — indicação leve ("dá uma olhada", "vale testar").

## FORMATO
Bloco único de fala em pt-BR + 3 sugestões de B-roll para intercalar + 1 legenda de post.`,
  },
  {
    id: "ads_ab_bateria",
    nome: "Ads Meta — Bateria A/B",
    emoji: "🎯",
    categoria: "Ads",
    descricao: "5 copies de anúncio Meta em frameworks diferentes (AIDA/PAS/4Ps/QUEST/FAB).",
    fields: [
      { key: "objetivo", label: "Objetivo", placeholder: "ex.: gerar lead p/ webinar, venda direta, agendamento" },
      { key: "oferta", label: "Oferta principal", placeholder: "ex.: aula gratuita 7 dias", required: true },
    ],
    build: (v, ctx) => `${ctxBlock(ctx)}Você é copywriter sênior de Meta Ads (Facebook/Instagram).

Escreva **5 variações A/B** do mesmo anúncio, uma por framework, para testar.

Objetivo da campanha: ${v.objetivo || "(preencher)"}
Oferta: ${v.oferta || "(preencher)"}

## FRAMEWORKS (uma copy cada)
1. **AIDA** (Atenção → Interesse → Desejo → Ação)
2. **PAS** (Problema → Agitação → Solução)
3. **4Ps** (Picture → Promise → Prove → Push)
4. **QUEST** (Qualify → Understand → Educate → Stimulate → Transition)
5. **FAB** (Feature → Advantage → Benefit)

## REGRAS POR COPY
- 4-7 linhas cada.
- Primeira linha = HOOK forte (não pode ser genérica).
- CTA específico no fim (não "clique aqui").
- Tom fiel ao branding do projeto.
- Se prometer resultado (renda/saúde), adicionar "resultados variam".

## FORMATO
\`\`\`
### AIDA
[copy]

### PAS
[copy]

...etc
\`\`\`
Após as 5, entregar: **3 títulos curtos (≤40 chars)** e **3 descrições curtas (≤30 chars)** compatíveis com Meta Ads.`,
  },
  {
    id: "story_sequence",
    nome: "Story — Sequência 5 telas",
    emoji: "📱",
    categoria: "Story",
    descricao: "Sequência de 5 stories com pico de curiosidade → CTA.",
    fields: [
      { key: "tema", label: "Tema/promessa", placeholder: "ex.: revelar bastidor de um trabalho difícil", required: true },
      { key: "destino_cta", label: "Destino do CTA", placeholder: "ex.: link do formulário, arrasta pra cima" },
    ],
    build: (v, ctx) => `${ctxBlock(ctx)}Você é estrategista de Stories que convertem.

Crie uma **sequência de 5 stories** sobre: **${v.tema || "(preencher)"}**
Destino do CTA final: ${v.destino_cta || "(preencher)"}

## ARCO
1. **Story 1 — HOOK** — pergunta ou frase que quebra o scroll.
2. **Story 2 — CONTEXTO** — dor/situação (com sticker de enquete opcional).
3. **Story 3 — TENSÃO / CURIOSIDADE** — insinuar a virada sem entregar.
4. **Story 4 — VIRADA / VALOR** — entregar o insight OU mostrar prova.
5. **Story 5 — CTA** — ação clara + fricção zero.

## PARA CADA STORY
- **Visual**: o que aparece na tela (foto, vídeo, texto sobre fundo).
- **Copy**: texto sobreposto (≤ 8 palavras).
- **Sticker sugerido**: enquete / caixa de pergunta / countdown / link.
- **Voz off (se houver)**: 1 frase.

Finalizar com: 1 sugestão de música (mood) e horário ideal de postagem.`,
  },
];

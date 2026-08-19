import type { Acao } from "../FlowEditor";

export interface FlowTemplate {
  id: string;
  nome: string;
  descricao: string;
  trigger_tipo: string;
  categoria: "recuperacao" | "boas-vindas" | "reativacao" | "nutricao" | "carrinho" | "onboarding" | "aquisicao" | "x1-conversao";
  emoji: string;
  acoes: Acao[];
}

const wa = (template: string, delay_min = 0, extra: Partial<Acao> = {}): Acao => ({
  tipo: "whatsapp",
  template,
  delay_min,
  ...extra,
});

/** Mídias oficiais do funil LinfaFlow X1 — geradas e hospedadas no Supabase Storage. */
const X1_BASE = "https://tkbivipqiewkfnhktmqq.supabase.co/storage/v1/object/public/whatsapp-media";
const X1_AUDIO = {
  ritual: `${X1_BASE}/x1/audio/audio_ritual.mp3`,
  inercia: `${X1_BASE}/x1/audio/audio_inercia.mp3`,
  objecao_preco: `${X1_BASE}/x1/audio/audio_objecao_preco.mp3`,
  tentei_tudo: `${X1_BASE}/x1/audio/audio_tentei_tudo.mp3`,
};
const X1_IMG = {
  prova_1: `${X1_BASE}/x1/img/img_prova_1.jpg`,
  prova_2: `${X1_BASE}/x1/img/img_prova_2.jpg`,
  prova_3: `${X1_BASE}/x1/img/img_prova_3.jpg`,
  ingredientes: `${X1_BASE}/x1/img/img_ingredientes.jpg`,
  custo_comparativo: `${X1_BASE}/x1/img/img_custo_comparativo.jpg`,
  ritual: `${X1_BASE}/x1/img/img_ritual.jpg`,
  garantia: `${X1_BASE}/x1/img/img_garantia.jpg`,
};

/** Mídias oficiais do funil SlimSoda X1 — chat conversacional com Dana Whitfield.
 *  Hospedadas no Vercel (Slim-Soda01/chat-x1/) por enquanto; pra espelhar no Supabase
 *  storage no mesmo path do LinfaFlow: whatsapp-media/slimsoda/x1/audio/*.mp3 e img/*.webp
 *  Aponta SLIMSODA_BASE pra URL real quando subir. */
const SLIMSODA_BASE = "https://slim-soda01.vercel.app/chat-x1";
const SLIMSODA_AUDIO = {
  dana_intro:          `${SLIMSODA_BASE}/audio/dana-intro.mp3`,
  dana_confession:     `${SLIMSODA_BASE}/audio/dana-confession.mp3`,
  dana_mechanism:      `${SLIMSODA_BASE}/audio/dana-mechanism.mp3`,       // fallback
  dana_mechanism_eatless:   `${SLIMSODA_BASE}/audio/dana-mechanism-eatless.mp3`,
  dana_mechanism_foodnoise: `${SLIMSODA_BASE}/audio/dana-mechanism-foodnoise.mp3`,
  dana_mechanism_hormones:  `${SLIMSODA_BASE}/audio/dana-mechanism-hormones.mp3`,
  dana_mechanism_kids:      `${SLIMSODA_BASE}/audio/dana-mechanism-kids.mp3`,
  dana_reciprocity:    `${SLIMSODA_BASE}/audio/dana-reciprocity.mp3`,
  dana_loss_aversion:  `${SLIMSODA_BASE}/audio/dana-loss-aversion.mp3`,  // fallback
  dana_loss_aversion_eatless:   `${SLIMSODA_BASE}/audio/dana-loss-aversion-eatless.mp3`,
  dana_loss_aversion_foodnoise: `${SLIMSODA_BASE}/audio/dana-loss-aversion-foodnoise.mp3`,
  dana_loss_aversion_hormones:  `${SLIMSODA_BASE}/audio/dana-loss-aversion-hormones.mp3`,
  dana_loss_aversion_kids:      `${SLIMSODA_BASE}/audio/dana-loss-aversion-kids.mp3`,
  dana_cta:            `${SLIMSODA_BASE}/audio/dana-cta.mp3`,
  testimonial_linda:   `${SLIMSODA_BASE}/audio/testimonial-linda.mp3`,
  testimonial_marlene: `${SLIMSODA_BASE}/audio/testimonial-marlene.mp3`,
  testimonial_diane:   `${SLIMSODA_BASE}/audio/testimonial-diane.mp3`,
};
const SLIMSODA_IMG = {
  sisters:           `${SLIMSODA_BASE}/images/slimsoda_adv2_02_sisters.webp`,
  quadrant:          `${SLIMSODA_BASE}/images/slimsoda_adv2_06_four_ways.webp`,
  rachel_kitchen:    `${SLIMSODA_BASE}/images/slimsoda_adv2_09_rachel_ba_kitchen.webp`,
  testimonial_linda: `${SLIMSODA_BASE}/images/slimsoda_new_testimonial_1.webp`,
  testimonial_marlene: `${SLIMSODA_BASE}/images/slimsoda_new_testimonial_2.webp`,
  testimonial_diane: `${SLIMSODA_BASE}/images/slimsoda_new_testimonial_3.webp`,
  price_compare:     `${SLIMSODA_BASE}/images/slimsoda_adv2_16_price_compare.webp`,
};

/**
 * Mapa único placeholder → URL real.
 * Usado para sincronizar fluxos que foram salvos ANTES das mídias existirem
 * (eles guardaram o texto literal `{{img_prova_1}}` no lugar da URL).
 */
export const X1_MEDIA: Record<string, { url: string; kind: "image" | "audio" }> = {
  ...Object.fromEntries(
    Object.entries(X1_IMG).map(([k, url]) => [`img_${k}`, { url, kind: "image" as const }]),
  ),
  ...Object.fromEntries(
    Object.entries(X1_AUDIO).map(([k, url]) => [`audio_${k}`, { url, kind: "audio" as const }]),
  ),
  ...Object.fromEntries(
    Object.entries(SLIMSODA_IMG).map(([k, url]) => [`slimsoda_${k}`, { url, kind: "image" as const }]),
  ),
  ...Object.fromEntries(
    Object.entries(SLIMSODA_AUDIO).map(([k, url]) => [`slimsoda_${k}`, { url, kind: "audio" as const }]),
  ),
};

/** Placeholders de mídia ainda não resolvidos (ex.: vídeos pendentes de gravação). */
export const X1_MEDIA_PLACEHOLDER_RE = /\{\{(img|audio|video)_[a-z0-9_]+\}\}/gi;

/** Detecta se um texto ainda tem placeholder de mídia. */
export function hasMediaPlaceholder(text?: string): boolean {
  if (!text) return false;
  X1_MEDIA_PLACEHOLDER_RE.lastIndex = 0;
  return X1_MEDIA_PLACEHOLDER_RE.test(text);
}

/**
 * Substitui todos os placeholders conhecidos de mídia X1 pelas URLs reais.
 * Retorna as ações novas e quantos passos foram corrigidos.
 * Placeholders sem URL (vídeos) são preservados.
 */
export function syncX1Media(acoes: Acao[]): { acoes: Acao[]; fixed: number; pending: string[] } {
  let fixed = 0;
  const pending = new Set<string>();

  const fixText = (txt?: string): string | undefined => {
    if (!txt) return txt;
    return txt.replace(/\{\{(img|audio|video)_[a-z0-9_]+\}\}/gi, (match) => {
      const key = match.slice(2, -2);
      const hit = X1_MEDIA[key];
      if (hit) return hit.url;
      pending.add(key);
      return match;
    });
  };

  const next = acoes.map((a) => {
    const out: any = { ...a };
    let changed = false;
    for (const field of ["template", "mensagem", "corpo", "conteudo"] as const) {
      const val = (a as any)[field];
      if (typeof val === "string" && hasMediaPlaceholder(val)) {
        const fixedVal = fixText(val);
        if (fixedVal !== val) {
          out[field] = fixedVal;
          changed = true;
        }
      }
    }
    if (changed) fixed++;
    return out as Acao;
  });

  return { acoes: next, fixed, pending: [...pending] };
}

const aguardar = (delay_min: number): Acao => ({ tipo: "aguardar", template: "", delay_min });

/** Mensagem com espera em SEGUNDOS antes de enviar — ritmo de conversa real (Typebot-style). */
const waSec = (template: string, delay_sec: number, extra: Partial<Acao> = {}): Acao => ({
  tipo: "whatsapp",
  template,
  delay_min: 0,
  delay_sec,
  ...extra,
});

/** Áudio com espera em segundos. */
const audioSec = (url: string, delay_sec = 2): Acao => ({
  tipo: "audio",
  template: url,
  delay_min: 0,
  delay_sec,
});

const ia = (prompt: string, delay_min = 0, extra: Partial<Acao> = {}): Acao => ({
  tipo: "ia_message",
  template: prompt,
  delay_min,
  ia_search_web: false,
  ...extra,
});

const tag = (t: string, action: "adicionar_tag" | "remover_tag" = "adicionar_tag"): Acao => ({
  tipo: action,
  template: "",
  delay_min: 0,
  tag: t,
});

const stop = (event: string): Acao => ({
  tipo: "stop_on_event",
  template: "",
  delay_min: 0,
  stop_event_type: event,
});

const waitReply = (timeout_min = 1440): Acao => ({
  tipo: "wait_reply",
  template: "",
  delay_min: 0,
  timeout_min,
});

const qualify = (score: number, tags = "", stage = ""): Acao => ({
  tipo: "qualify_lead",
  template: "",
  delay_min: 0,
  lead_score: score,
  lead_tags: tags,
  lead_stage: stage,
});

const notify = (operator = "comercial"): Acao => ({
  tipo: "notify_operator",
  template: "Lead quente pronto para fechamento — abordar agora.",
  delay_min: 0,
  operator_name: operator,
});

// ─────────────────────────────────────────────────────────────
// Guardrails e engenharia de venda reaproveitados pelos fluxos X1
// (derivados do dossiê high ticket: SPIN, NEPQ, Value Equation,
//  trial close 0-10, árvore de negociação, palavras proibidas)
// ─────────────────────────────────────────────────────────────

/** Palavras proibidas — compliance de suplemento + credibilidade. */
const X1_BANNED = `NEVER use these words or claims: cure, treat, heal, detox, cleanse, flush out, weight loss, slimming, miracle, guaranteed results, doctor-approved, clinically proven, "only today", "last chance". Use support / help ease / may help language instead. Never diagnose and never give medical advice — if she mentions medication or a diagnosed condition, tell her to check with her doctor and stay supportive.`;

/** Regra de negociação: sem desconto inventado, moedas de troca fixas. */
const X1_NEGOTIATION = `Negotiation rules: never invent a discount, coupon, price or deadline. The only trade currencies you may use are (a) the 30-day unconditional money-back guarantee — full refund, no questions, she does not have to return the bottles, and (b) the multi-bottle bundle as better value per day. If she demands a discount before seeing any value, do not concede — go back to value. If she keeps pushing only on price, tag her as a discount hunter and stop selling.`;

/** Árvore de objeções (significado oculto + resposta). */
const X1_OBJECTIONS = `Objection arsenal — answer ONE objection per message, never stack two. Each objection has a hidden meaning; answer the hidden meaning, not the words:
1. "Too expensive" (80% = didn't see enough value, 15% = wants a discount, 5% = truly can't). Value math: one lymphatic drainage session is $80-$150 and she needs it twice a month; compression socks are $30-$150 a pair and wear out; a pneumatic pump is $2,000-$6,000. One bottle covers 30 days of daily support.
2. "I already tried everything" (hidden: fear of failing again, wants proof of difference). Everything she tried works from the outside or forces water out — this supports the flow from the inside. Different category, not a stronger version of the same thing.
3. "I need to think about it" (60% not convinced, 30% needs a partner's opinion, 10% wants to compare). Use negative reverse: "Maybe this isn't the right fit for you right now — can I ask what's making you hesitate?" Then answer that one thing.
4. "Not the right time" (hidden: procrastination dressed as strategy). Cost of inaction: another season of swollen ankles and mornings that don't feel like her, and nothing changes on its own.
5. "Is it safe with my medication?" — no advice. Tell her to run the ingredient list by her doctor or pharmacist; offer to send the exact list.
6. "I don't trust supplements" (hidden: justified skepticism). Don't argue. Acknowledge, show the ingredient transparency, then the 30-day unconditional refund — the risk sits with us, not her.
7. "My doctor said it's normal" (hidden: she was dismissed). Validate: labs measure blood, not drainage. Never contradict her doctor — reframe.`;

/** Trial close 0-10 com ramificação por nota. */
const X1_TRIAL_CLOSE = `Temperature read: ask "on a scale of 0 to 10, how much does this make sense for you?" and branch on the answer. 0-5: do not pitch, ask what's missing and go back to the objection playbook. 6-8: ask "what would make it a 10?" and answer exactly that one gap. 9-10: move straight to the assumptive close and send the link.`;

// ─────────────────────────────────────────────────────────────
// Guardrails do funil SlimSoda X1 — chat conversacional Dana
// (baking soda + ginger + berberine, ticket baixo $24.99 B1G1)
// ─────────────────────────────────────────────────────────────

/** Palavras proibidas — FDA compliance + credibilidade. */
const SLIMSODA_BANNED = `NEVER use these words or claims: cure, treat, heal, FDA approved, doctor recommended, medically proven, clinical study, "guaranteed to work", "lose X pounds in Y days", before/after with specific numbers, "this will". Use support / help / "many women report" / "showed" language instead. Never diagnose and never give medical advice — if she mentions a medical condition or medication, tell her to check with her doctor and stay supportive. The 93% DPP-4 figure refers specifically to in-vitro gingerol blocking the DPP-4 enzyme, not to weight loss.`;

/** Regra de negociação — sem desconto, $24.99 B1G1 é fixo, 60-day guarantee. */
const SLIMSODA_NEGOTIATION = `Pricing is FIXED at $24.99 for two tubs (Buy 1 Get 1 Free). Never invent a discount, coupon, bundle upgrade, or deadline. The only trade currencies you may use are (a) the 60-day empty-tub money-back guarantee — full refund, no questions, no restocking fee, she uses the whole tub, and (b) the free shipping. If she demands a discount before seeing any value, do not concede — go back to the value equation (3 ingredients in the right order, vs $1,000/month Ozempic). If she keeps pushing only on price, tag her as a discount hunter and stop selling.`;

/** Árvore de objeções SlimSoda. */
const SLIMSODA_OBJECTIONS = `Objection arsenal — answer ONE objection per message, never stack two. Each objection has a hidden meaning; answer the hidden meaning, not the words:
1. "I already tried baking soda and it did nothing" (hidden: didn't see the order, missing context). DIY fails because the ratio, dose and form matter — grocery ginger has almost no gingerol, cheap berberine is barely absorbed, baking soda dosing is knife-edge. Three together, in the right order, is what makes it work. This is the celebrity capsule dose, not a Pinterest recipe.
2. "Is it safe with my medication?" — no advice. Tell her to run the ingredient list by her doctor; offer to send the exact list. Stay warm.
3. "I've tried Ozempic / Wegovy and it came back" (hidden: tired of the yo-yo, wants a non-drug option). The shots cost up to $1,000/month forever and weight comes back when you stop. SlimSoda is $24.99 once for two tubs, the switch flips, you keep it.
4. "It probably doesn't work" (hidden: justified skepticism from past failures). Acknowledge. Then the 60-day empty-tub guarantee: she uses the whole tub, sends it back empty if it didn't work, full refund, no questions. The risk sits with us, not her.
5. "I need to think about it" (60% not convinced, 30% needs a partner's opinion, 10% wants to compare). Use negative reverse: "Maybe this isn't the right fit for you right now — can I ask what's making you hesitate?" Then answer that one thing.
6. "My doctor said it's just aging / menopause" (hidden: she was dismissed). Validate: doctors measure blood, not the metabolic switch. Three ingredients, in the right order, can restart it. Never contradict her doctor — reframe.
7. "I don't trust supplements" (hidden: justified skepticism from a noisy industry). Don't argue. Acknowledge, show the ingredient transparency (3 named, doses listed), then the 60-day empty-tub refund — the risk sits with us, not her.`;

/** Trial close 0-10 — mesmo padrão LinfaFlow, contextualizado pra SlimSoda. */
const SLIMSODA_TRIAL_CLOSE = `Temperature read: ask "on a scale of 0 to 10, how much does this make sense for you?" and branch on the answer. 0-5: do not pitch, ask what's missing and go back to the objection playbook. 6-8: ask "what would make it a 10?" and answer exactly that one gap. 9-10: move straight to the assumptive close and send the link. Always frame the offer as a 60-day audition, not a purchase — she decides after she finishes the tub.`;

/** URL de checkout fixa — NUNCA inventar outra. */
const SLIMSODA_CHECKOUT_URL = "https://slimsodapowder.com/cc2/dtc/pay/checkout.php?package=3bottles&hid=b2lkPW9mZl81MDU4NzI1JmFpZD1hZmZfNjgyMTM3NyZ1aWQ9YmxfMDM4MDIyMg%3D%3D&affid=aff_6821377";

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: "recuperacao-pix",
    nome: "Recuperação PIX (3 toques)",
    descricao: "Lembrete em 10min, 1h e 4h. Para ao detectar pagamento.",
    trigger_tipo: "aguardando_pagamento",
    categoria: "recuperacao",
    emoji: "💰",
    acoes: [
      wa("Oi {{nome}}! Vi que você gerou o Pix do {{produto}}. Tá quase! Quer que eu te passe o passo a passo? 🚀", 10),
      aguardar(60),
      wa("{{nome}}, seu Pix expira logo. Se quiser, eu gero um novo agora — é só responder *novo*.", 0),
      aguardar(180),
      wa("Última chance: a oferta do {{produto}} fecha em algumas horas. Posso reservar pra você?", 0),
      stop("compra_aprovada"),
    ],
  },
  {
    id: "boas-vindas-pos-compra",
    nome: "Boas-vindas pós-compra",
    descricao: "Confirma compra, entrega acesso e abre canal.",
    trigger_tipo: "compra_aprovada",
    categoria: "boas-vindas",
    emoji: "🎉",
    acoes: [
      wa("🎉 {{nome}}, compra confirmada! Bem-vindo(a) ao {{produto}}.", 0),
      wa("Seu acesso está em: {{link}}\nQualquer dúvida, é só me chamar por aqui.", 2),
      tag("cliente"),
      aguardar(1440),
      ia("Pergunte como foi o primeiro contato com o produto e ofereça ajuda específica. Tom amigável, curto."),
    ],
  },
  {
    id: "reativacao-fria-14d",
    nome: "Reativação de lead frio (14d)",
    descricao: "Reaquece quem sumiu há 14 dias com curiosidade + oferta.",
    trigger_tipo: "tag_adicionada",
    categoria: "reativacao",
    emoji: "🔥",
    acoes: [
      wa("Oi {{nome}}, sumiu! Posso te mostrar o que mudou no {{produto}} nas últimas semanas?", 0),
      waitReply(1440),
      wa("Resumindo: temos uma condição nova só pra quem já conhece. Posso te enviar?", 60),
      tag("reativado"),
    ],
  },
  {
    id: "nutricao-webinar",
    nome: "Nutrição pré-webinar",
    descricao: "5 toques antes do webinar com lembretes escalados.",
    trigger_tipo: "lead_novo",
    categoria: "nutricao",
    emoji: "🎙️",
    acoes: [
      wa("Bem-vindo(a) {{nome}}! Sua inscrição no webinar tá confirmada. 🎙️", 0),
      aguardar(1440),
      wa("Faltam 24h pro nosso encontro. Já separou caderno e caneta? Vai ser intenso.", 0),
      aguardar(1380),
      wa("⏰ 1 hora pra começar! Link: {{link}}", 0),
      aguardar(50),
      wa("🚨 Começando AGORA! Entra antes que lote: {{link}}", 0),
      aguardar(60),
      wa("{{nome}}, sentimos sua falta. A gravação fica disponível por 24h: {{link}}", 0),
    ],
  },
  {
    id: "carrinho-abandonado",
    nome: "Carrinho abandonado (3 toques)",
    descricao: "Recupera com urgência crescente em 30min / 2h / 24h.",
    trigger_tipo: "carrinho_abandonado",
    categoria: "carrinho",
    emoji: "🛒",
    acoes: [
      wa("{{nome}}, deixou o {{produto}} no carrinho. Posso te ajudar a finalizar?", 30),
      aguardar(90),
      wa("Acabou alguma dúvida? Me conta que te respondo agora.", 0),
      aguardar(1320),
      wa("Última chance: a condição que você viu sai do ar hoje. Bora? {{link}}", 0),
      stop("compra_aprovada"),
    ],
  },
  {
    id: "onboarding-produto",
    nome: "Onboarding 7 dias",
    descricao: "Sequência diária guiando o cliente nos primeiros passos.",
    trigger_tipo: "compra_aprovada",
    categoria: "onboarding",
    emoji: "🚀",
    acoes: [
      wa("Dia 1: comece por aqui → {{link}}", 0),
      aguardar(1440),
      wa("Dia 2: aprenda o setup essencial. Topa 10 min agora?", 0),
      aguardar(1440),
      ia("Pergunte que parte ele/ela já usou e sugira o próximo passo personalizado."),
      aguardar(1440),
      wa("Dia 4: 3 erros comuns que vejo nos primeiros dias 👇", 0),
      aguardar(2880),
      wa("Dia 7: como tá indo? Me manda um print que te dou feedback."),
      tag("onboarded"),
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // AQUISIÇÃO X1 (Ads → WhatsApp → Venda) — funis multimodais
  // ─────────────────────────────────────────────────────────────
  {
    id: "aquisicao-x1-completo",
    nome: "Aquisição X1 — Ads → WhatsApp → Venda (multimodal)",
    descricao: "Lead vem do ads, IA qualifica, manda áudio, vê foto, conduz à venda. Híbrido (template + IA).",
    trigger_tipo: "lead_novo",
    categoria: "aquisicao",
    emoji: "🎯",
    acoes: [
      wa("Oi {{nome}}! 👋 Aqui é da equipe do {{produto}}. Vi que você acabou de demonstrar interesse — posso te fazer 2 perguntinhas rápidas pra entender se faz sentido pra você?", 1),
      waitReply(60),
      ia(
        "Você é o vendedor consultivo do {{produto}}. Faça UMA pergunta de qualificação por vez (situação atual, principal dificuldade, urgência). Se o lead mandar áudio, ESCUTE e responda no contexto. Se mandar foto/print, ANALISE. Mantenha tom humano e curto.",
        0,
        { ia_voice_response: false, ia_vision: true, questioning_strategy: "consultivo_progressivo" }
      ),
      waitReply(120),
      qualify(60, "qualificado", "qualificacao"),
      wa("Show, {{nome}}! Pelo que você me contou, faz sentido. Deixa eu te mandar um áudio rapidinho explicando como o {{produto}} resolve isso 🎙️", 0),
      { tipo: "audio", template: "Apresentação curta (60-90s) do {{produto}} focada na dor que o lead acabou de descrever. Tom consultivo, sem hype.", delay_min: 0 } as Acao,
      aguardar(2),
      wa("Olha aqui o resultado de um cliente que tava na mesma situação:", 0),
      wa("{{print_resultado}}", 0),
      waitReply(180),
      ia(
        "Lead já viu áudio + prova social. Agora identifique a objeção principal (preço, tempo, ceticismo, decisão de outro). Responda exatamente UMA objeção por mensagem. Se não houver objeção, ofereça o link de checkout: {{link}}",
        0,
        { ia_vision: true }
      ),
      waitReply(240),
      qualify(85, "pronto-fechamento", "fechamento"),
      notify("comercial"),
      wa("{{nome}}, separei sua condição: {{link}}\nQualquer dúvida me chama aqui mesmo. 🚀", 0),
      aguardar(720),
      wa("Oi {{nome}}, ainda dá tempo de garantir a condição de hoje. Posso reservar?", 0),
      stop("compra_aprovada"),
    ],
  },
  {
    id: "aquisicao-x1-template-dirigido",
    nome: "Aquisição X1 — Script dirigido (alta previsibilidade)",
    descricao: "Funil 100% scriptado: mensagens fixas, áudio, foto e CTA. Para times sem IA conversacional.",
    trigger_tipo: "lead_novo",
    categoria: "aquisicao",
    emoji: "📜",
    acoes: [
      wa("Oi {{nome}}! Aqui é do {{produto}}. Bem-vindo(a)! Antes de te apresentar a solução, me conta: qual é o seu maior desafio hoje com isso? 🙏", 1),
      waitReply(120),
      wa("Entendi. Deixa eu te mandar um áudio curto que explica exatamente como a gente resolve isso 👇", 0),
      { tipo: "audio", template: "Apresentação de 60s do {{produto}}: dor universal → método → resultado. Sem hype.", delay_min: 0 } as Acao,
      aguardar(3),
      wa("E olha um print real de quem aplicou:", 0),
      wa("{{print_resultado}}", 0),
      aguardar(2),
      wa("Faz sentido pra você? Posso te mostrar o passo a passo de como começar?", 0),
      waitReply(240),
      wa("Aqui está sua condição especial: {{link}}\nÉ por tempo limitado.", 0),
      aguardar(1440),
      wa("{{nome}}, separei sua vaga até hoje à noite. Garante agora? 🚀 {{link}}", 0),
      stop("compra_aprovada"),
    ],
  },
  {
    id: "aquisicao-x1-ia-livre",
    nome: "Aquisição X1 — IA livre (consultiva)",
    descricao: "IA conduz quase tudo: escuta áudio do lead, vê imagens, decide ritmo. Mínimo de mensagens fixas.",
    trigger_tipo: "lead_novo",
    categoria: "aquisicao",
    emoji: "🤖",
    acoes: [
      wa("Oi {{nome}}! 👋 Tô aqui pra te ajudar a entender se o {{produto}} é o que você precisa. Posso te fazer umas perguntas?", 1),
      waitReply(60),
      ia(
        "Você é vendedor consultivo do {{produto}}. Conduza TODA a venda: qualifique (situação, dor, urgência, decisão), responda objeções, escute áudios do lead, analise imagens/prints que ele mandar, mande áudio quando fizer sentido, peça print/foto quando precisar de contexto. Só envie o link {{link}} quando o lead estiver pronto. Use tom humano. Uma pergunta por vez. Nunca seja robótico.",
        0,
        { ia_vision: true, ia_voice_response: true, questioning_strategy: "consultivo_progressivo", ia_search_files: true }
      ),
      waitReply(1440),
      qualify(70, "qualificado-ia", "qualificacao"),
      notify("comercial"),
      stop("compra_aprovada"),
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // LINFAFLOW X1 (EN-US) — Messenger (Zernio) e Webchat do site
  // Engenharia high-ticket aplicada a ticket baixo: SPIN completo,
  // amplificação de implicação, prova agrupada, trial close 0-10,
  // future pacing, árvore de objeções e régua D+1/D+3/D+7/D+30.
  // Usa as 7 imagens e 4 áudios oficiais hospedados no Supabase Storage.
  // Pendentes: {{video_hook}} {{video_mecanismo}}

  // ─────────────────────────────────────────────────────────────
  {
    id: "linfaflow-x1-messenger",
    nome: "LinfaFlow X1 — Messenger (Zernio) [EN-US]",
    descricao:
      "Canal: Messenger. 11 estágios: hook → SPIN + track → implicação → reframe → mecanismo → prova agrupada → trial close 0-10 → future pacing → objeções → fechamento assumptivo → régua D+1/D+3/D+7/D+30.",
    trigger_tipo: "lead_novo",
    categoria: "x1-conversao",
    emoji: "🇺🇸",
    acoes: [
      // 1. HOOK
      wa(
        "Hi {{nome}} 👋 Quick one before we start — which one bothers you more right now?\n\n1️⃣ Waking up with a puffy face and eyes\n2️⃣ Heavy, swollen legs by the end of the day\n\nJust reply 1 or 2 (or tell me if it's both).",
        1
      ),
      waitReply(180),

      // 2. DIAGNÓSTICO SPIN + classificação de track
      ia(
        `You are a warm, unhurried women's wellness consultant for LINFAFLOW (liquid botanical drops that support lymphatic flow, healthy circulation and daily fluid balance). Audience: US women 40-70. Language: American English, plain and conversational, short messages, no hype.

Run a full SPIN sequence, ONE question per message, in this order, always mirroring her exact words back before the next question:
- SITUATION: how long has it been happening, and when is it worst (morning face / evening legs / bloating)?
- PROBLEM: what has it already cost her — clothes, shoes, rings, photos, plans she skipped?
- IMPLICATION: what did her doctor say (most hear "your labs are normal"), and what has she already tried (water pills, compression socks, lymphatic drainage, leg elevation, dry brushing, detox teas)?
- NEED-PAYOFF: "if there were a way to support the drainage itself instead of squeezing the fluid out, would that be worth 30 seconds a day?"

Silently classify her into ONE track and adapt your pace for the rest of the conversation:
- SKEPTIC (problem-aware): she doesn't know the lymphatic angle yet — go slower, teach first, never pitch early.
- TRIED-EVERYTHING (solution-aware): she knows she needs help and already tried things — lead with what makes this a different category.
- READY (product-aware): she already knows LINFAFLOW and is comparing — be short, factual, move to the offer faster.

${X1_BANNED}

Do NOT send any link and do NOT pitch the product in this stage.`,
        0,
        { ia_vision: true, questioning_strategy: "consultivo_progressivo" }
      ),
      waitReply(360),
      qualify(60, "linfaflow,x1-diagnostico", "qualificacao"),
      tag("linfaflow-x1"),
      { tipo: "audio", template: X1_AUDIO.tentei_tudo, delay_min: 0 } as Acao,

      // 3. AMPLIFICAÇÃO DA IMPLICAÇÃO
      ia(
        `She has answered the SPIN questions. One single message now, no pitch: amplify the implication using HER words. Ask, gently and without judgement, what another 12 months of exactly this would feel like — same mornings, same ankles, same "your labs are normal". End with an open question and wait. Never mention the product, the price or any link in this message.

${X1_BANNED}`,
        0
      ),
      waitReply(240),

      // 4. REFRAME + VÍDEO
      wa(
        "Thank you for being so open, {{nome}}. Here's the part almost nobody explains: normal labs don't mean normal drainage.\n\nThere's no standard test for lymphatic flow and no specialty that 'owns' it — so most women hear \"everything looks fine\" and go home with the same puffiness.",
        2
      ),
      wa("Watch this — 40 seconds, it'll click:\n{{video_hook}}", 1),
      aguardar(3),

      // 5. MECANISMO (áudio)
      wa(
        "Compression, massage and leg elevation all move fluid from the outside. They help for a few hours. What they don't do is support the flow from the inside.",
        0
      ),
      { tipo: "audio", template: X1_AUDIO.ritual, delay_min: 1 } as Acao,
      wa(
        "That's the whole idea behind LINFAFLOW: 4 botanicals organized by complementary function — Cleavers to get things moving, Stillingia and Prickly Ash to help mobilize what feels stuck, Red Clover for daily balance. Liquid drops, 1 mL morning and night. A 30-second ritual. No capsules, no aggressive cleanse, no water pills.",
        0
      ),
      waitReply(360),

      // 6. PROVA AGRUPADA (social proof clustering)
      wa("Let me show you three women who were exactly where you are 👇", 0),
      wa(X1_IMG.prova_1, 0),
      wa(X1_IMG.prova_2, 0),
      wa(X1_IMG.prova_3, 0),
      wa("Diane, Marlene and Rosa — different ages, same complaint, same 30 seconds a day.", 0),
      wa(`And this is what's actually inside the bottle — nothing exotic, just organized:\n${X1_IMG.ingredientes}`, 1),
      wa("Full story and the science behind it here: https://imphafilliate.vercel.app/advertorial-a-hora", 0),
      waitReply(360),

      // 7. TRIAL CLOSE 0-10
      ia(
        `Temperature read stage. Send ONE short message asking for a number, then branch.

${X1_TRIAL_CLOSE}

Stay in this stage until you have a number. Do not send any link before she is at 9-10 — when she is, hand over to the closing message. Chat-length messages only.

${X1_BANNED}
${X1_NEGOTIATION}`,
        0
      ),
      waitReply(360),

      // 8. FUTURE PACING
      ia(
        `One message of future pacing, built from the specific symptom SHE named earlier. Walk her through an ordinary morning three weeks from now: waking up, the mirror, the rings, the shoes, getting dressed without checking how bad it is today. Present tense, sensory, calm, no numbers, no promises — say "imagine" and "could feel like", never "you will". Close with a soft question. No link in this message.

${X1_BANNED}`,
        0
      ),
      waitReply(240),

      // 9. OBJEÇÕES
      ia(
        `She has seen the reframe, the mechanism, the grouped proof, and she gave you a temperature number. Your job now: surface and answer objections, in American English, calm and specific, one per message.

${X1_OBJECTIONS}

If it helps, you may send the cost comparison image ${X1_IMG.custo_comparativo} once, when price is the objection.

${X1_NEGOTIATION}
${X1_BANNED}

Disqualification: if she only ever pushes on price, asks for a discount before seeing any value, or is clearly outside the profile, tag her as disqualified, be polite, and stop selling — do not keep the sequence running.

The moment she shows real buying intent (asks price, shipping, how to order, or says yes), send https://imphafilliate.vercel.app/shop-linfaflow.html and stop selling. If she sends a photo or screenshot, read it and answer in context.`,
        0,
        { ia_vision: true, questioning_strategy: "consultivo_progressivo" }
      ),
      waitReply(720),
      { tipo: "audio", template: X1_AUDIO.objecao_preco, delay_min: 0 } as Acao,

      // 10. FECHAMENTO ASSUMPTIVO
      qualify(85, "linfaflow,pronto-fechamento", "fechamento"),
      notify("comercial"),
      wa(
        "Perfect, {{nome}} — so let's do this: do you want to start with one bottle for 30 days, or take the 3-bottle set so you don't have to think about reordering?\n\nHere's the link either way: https://imphafilliate.vercel.app/shop-linfaflow.html\n\n30-day unconditional guarantee: if your mornings don't feel different, you get a full refund — no questions, and you don't even have to send the bottles back. 💜",
        0
      ),

      // 11. RÉGUA D+1 / D+3 / D+7 / D+30
      aguardar(1440),
      wa(
        "{{nome}}, one thing I forgot to say yesterday: the guarantee runs for 30 days, which is exactly how long one bottle lasts. So you're not deciding if it works — you're deciding to find out. https://imphafilliate.vercel.app/shop-linfaflow.html",
        0
      ),
      aguardar(2880),
      { tipo: "audio", template: X1_AUDIO.inercia, delay_min: 0 } as Acao,
      aguardar(5760),
      wa(`A new one came in this week and it made me think of what you told me:\n${X1_IMG.prova_3}`, 0),
      aguardar(33120),
      ia(
        `Day 30. She never bought and never replied to the last messages. Send ONE short reopening message with a completely new angle — not the same pitch. Use negative reverse: assume this probably isn't for her right now, mention the specific symptom she told you about a month ago, ask a genuine question about whether anything changed, and make clear this is your last message unless she replies. Include https://imphafilliate.vercel.app/shop-linfaflow.html once, at the end, casually. No urgency theatrics, no invented offer.

${X1_BANNED}
${X1_NEGOTIATION}`,
        0
      ),
      stop("compra_aprovada"),
    ],
  },
  {
    id: "linfaflow-x1-webchat",
    nome: "LinfaFlow X1 — Webchat do site [EN-US]",
    descricao:
      "Canal: Chat do site (advertorial / shop / reviews). Versão comprimida: SPIN rápido, prova agrupada, trial close 0-10 e objeções — para quem já está na página.",
    trigger_tipo: "lead_novo",
    categoria: "x1-conversao",
    emoji: "💬",
    acoes: [
      wa(
        "Hi! 👋 You're reading about LINFAFLOW — before you decide anything, tell me one thing: is it the morning puffiness, the heavy legs at night, or the bloating that bothers you most?",
        0
      ),
      waitReply(30),
      ia(
        `You are the LINFAFLOW on-site assistant, talking to a US woman 40-70 who is ON the advertorial or shop page right now. American English, 2-3 lines per message max (this is a chat widget), warm, zero hype.

She is already in buying context, so run a compressed SPIN: main symptom → what it has cost her → what her doctor said and what she already tried → need-payoff question. One question per message, at most four. Mirror her words back in one sentence, then deliver the reframe: labs measure blood, not drainage; compression, massage and elevation work from the outside; LINFAFLOW supports the flow from the inside with 4 botanicals in liquid drops, 1 mL twice a day, a 30-second ritual.

Silently classify her as SKEPTIC, TRIED-EVERYTHING or READY and adapt the pace: skeptic gets teaching, tried-everything gets the "different category" framing, ready goes straight to the offer.

${X1_BANNED}

Do not send links in this stage.`,
        0,
        { ia_vision: true, questioning_strategy: "consultivo_progressivo" }
      ),
      waitReply(30),
      qualify(60, "linfaflow,x1-webchat", "qualificacao"),
      tag("linfaflow-x1-site"),
      wa("This is the 60-second version of why it works differently:\n{{video_mecanismo}}", 0),
      wa("And three women who were in the same spot:", 0),
      wa(X1_IMG.prova_1, 0),
      wa(X1_IMG.prova_2, 0),
      wa(X1_IMG.prova_3, 0),
      waitReply(60),
      ia(
        `Temperature read, chat-length.

${X1_TRIAL_CLOSE}

${X1_BANNED}
${X1_NEGOTIATION}`,
        0
      ),
      waitReply(60),
      ia(
        `She is on the page, has seen the mechanism video, the grouped proof, and gave you a number. Answer objections one per message, chat-length.

${X1_OBJECTIONS}

You may send ${X1_IMG.custo_comparativo} once when price is the objection.

${X1_NEGOTIATION}
${X1_BANNED}

Handle shipping and ordering questions directly, then send https://imphafilliate.vercel.app/shop-linfaflow.html. The moment she shows intent, send https://imphafilliate.vercel.app/shop-linfaflow.html and stop selling. If she only pushes on price, tag her as disqualified and stop. If you truly can't answer something, offer a human follow-up and collect her best contact.`,
        0,
        { ia_vision: true }
      ),
      waitReply(120),
      qualify(85, "linfaflow,pronto-fechamento", "fechamento"),
      notify("comercial"),
      wa(
        "So — one bottle for 30 days, or the 3-bottle set? Here's the page either way: https://imphafilliate.vercel.app/shop-linfaflow.html\nThe 30-day guarantee means the whole thing is on us if it doesn't change your mornings.",
        0
      ),
      stop("compra_aprovada"),
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // LINFAFLOW X1 — CHAT WHATSAPP (skin no site) [EN-US]
  // 9 estágios de venda em ritmo de mensagens curtas (2-4s),
  // com engenharia X1: SPIN, trial close 0-10, objeções e guardrails.
  // Usa as 7 imagens e 4 áudios oficiais hospedados no Supabase Storage.
  // Pendentes: {{video_hook}} {{video_mecanismo}}
  // ─────────────────────────────────────────────────────────────
  {
    id: "linfaflow-x1-whatsapp",
    nome: "LinfaFlow X1 — Chat WhatsApp no site [EN-US]",
    descricao:
      "Canal: Chat do site com skin de WhatsApp. 9 estágios em ritmo de conversa (2-4s por mensagem), com os 6 áudios e 2 imagens já gravados, IA no diagnóstico/objeções e fechamento em $89.",
    trigger_tipo: "lead_novo",
    categoria: "x1-conversao",
    emoji: "🟢",
    acoes: [
      // ── 1. CONEXÃO
      waSec("Hey 👋 Glad you're here.", 2),
      waSec("I set aside something for people who end the day with heavy legs.", 2),
      waSec("It's quick, simple, and built for daily comfort.", 3),
      waSec("Before I send it, what should I call you?", 2),
      waitReply(60),
      waSec("Perfect, thanks.", 2),
      waSec("I'll keep this practical, not overwhelming.", 3),
      audioSec(X1_AUDIO.tentei_tudo, 2),
      waSec("If you've been ignoring that tired, swollen feeling, you're not alone.", 3),
      waSec("Let's make this easier from here.", 2),
      tag("linfaflow-x1-site"),

      // ── 2. CONSCIENTIZAÇÃO
      waSec("Quick question, does this sound familiar?", 2),
      waSec("By late afternoon, your socks feel tighter and your legs feel heavier.", 2),
      waSec("That's usually the part people brush off.", 3),
      waSec("But it slowly steals comfort from the whole day.", 2),
      waSec("What is your biggest struggle with this?", 2),
      waitReply(60),

      // IA: SPIN comprimido + classificação de track (substitui o "Got it." cego do Typebot)
      ia(
        `You are a warm, unhurried women's wellness consultant for LINFAFLOW (liquid botanical drops that support lymphatic flow, healthy circulation and daily fluid balance). Audience: US women 40-70. American English, 1-2 short lines per message — this is a WhatsApp-style chat, so never write paragraphs.

She just told you her biggest struggle with heaviness and swelling. Mirror her exact words back in one sentence, then run a compressed SPIN, ONE question per message, at most three more questions:
- PROBLEM: what has it already cost her — shoes, socks, rings, photos, plans she skipped?
- IMPLICATION: what did her doctor say (most hear "your labs are normal") and what has she already tried (compression socks, lymphatic drainage, elevating her legs, dry brushing, detox teas, water pills)?
- NEED-PAYOFF: "if there were a way to support the drainage itself instead of squeezing the fluid out, would that be worth 30 seconds a day?"

Silently classify her into ONE track and keep that pace for the rest of the chat:
- SKEPTIC (problem-aware): teach first, never pitch early.
- TRIED-EVERYTHING (solution-aware): lead with what makes this a different category.
- READY (product-aware): be short and factual, move to the offer faster.

${X1_BANNED}

No links and no pitch in this stage.`,
        0,
        { ia_vision: true, questioning_strategy: "consultivo_progressivo" }
      ),
      waitReply(120),
      qualify(55, "linfaflow,x1-whatsapp-skin", "qualificacao"),

      waSec("That pattern matters more than most people think.", 3),
      waSec("When the same heaviness keeps showing up, your routine needs a different kind of support.", 2),
      waSec("Not more guesswork. Not more random fixes.", 2),
      waSec("Just something that fits real life.", 2),

      // ── 3. CURIOSIDADE
      waSec("Here's something most people never hear 💡", 2),
      waSec("The issue is often not one big moment.", 3),
      waSec("It's the buildup across the day.", 2),
      waSec("That's why quick fixes usually disappoint.", 2),
      waSec(X1_IMG.ritual, 2),
      waSec("When support is timed well, the whole day feels different.", 4),
      waSec("What would you most like to improve first?", 2),
      waitReply(60),
      waSec("That answer helps a lot.", 2),
      audioSec(X1_AUDIO.tentei_tudo, 3),
      waSec("Most people keep looking for the wrong solution because they focus only on the symptom.", 3),
      waSec("LinfaFlow was built to change that approach.", 2),

      // ── 4. MECANISMO
      waSec("Labs measure blood. They don't measure drainage — there's no standard test for it.", 2),
      waSec("It follows a simple daily support rhythm I call the Flow Reset Method.", 2),
      waSec(
        "4 botanicals organized by function: Cleavers to get things moving, Stillingia and Prickly Ash to help mobilize what feels stuck, Red Clover for daily balance. Liquid drops, 1 mL morning and night — a 30-second ritual.",
        3
      ),
      waSec("{{video_mecanismo}}", 2),
      waSec("That's the difference.", 12),
      waSec("It's not about chasing trends.", 2),
      waSec("It's about making the support feel natural enough to stick.", 2),
      waSec("Have you tried anything before that felt too complicated or unrealistic?", 2),
      waitReply(90),
      waSec("That's exactly the frustration this was made to avoid.", 2),
      audioSec(X1_AUDIO.ritual, 3),
      waSec("Once the routine is easy, consistency gets a lot easier too.", 3),

      // ── 5. BENEFÍCIOS
      waSec("Imagine ending the day without that heavy, dragging feeling.", 2),
      waSec("Shoes feel easier. Socks feel less tight. Walking feels smoother.", 3),
      waSec("That's the kind of everyday comfort people want back.", 2),
      waSec("If this worked well for you, what would your ideal day look like?", 2),
      waitReply(90),

      // Future pacing com as palavras dela
      ia(
        `One short message of future pacing, built from the specific symptom SHE named. Walk her through an ordinary morning three weeks from now — waking up, the mirror, the rings, the shoes — present tense, calm, sensory. Say "imagine" and "could feel like", never "you will". No numbers, no promises, no link. Close with a soft question. Max 3 lines.

${X1_BANNED}`,
        0
      ),
      waitReply(90),

      // ── 6. PROVA SOCIAL (agrupada)
      waSec("Look at this message I got yesterday 🔥", 2),
      waSec(X1_IMG.prova_1, 2),
      waSec("She said the biggest surprise was how manageable it felt.", 4),
      waSec("And she's not the only one 👇", 2),
      waSec(X1_IMG.prova_2, 0),
      waSec(X1_IMG.prova_3, 0),
      waSec("Different ages, same complaint, same 30 seconds a day.", 2),
      waSec(`Full story and what's inside the bottle: https://imphafilliate.vercel.app/advertorial-a-hora`, 2),
      waitReply(120),

      // ── TRIAL CLOSE 0-10
      ia(
        `Temperature read, WhatsApp-chat length (1-2 lines per message).

${X1_TRIAL_CLOSE}

Stay here until you have a number. Do not send any link before she is at 9-10.

${X1_BANNED}
${X1_NEGOTIATION}`,
        0
      ),
      waitReply(120),

      // ── 7. OPORTUNIDADE
      waSec("If you've been waiting for the right time, this is the cleanest path in.", 2),
      waSec("You get the system, the structure and the support to begin without overthinking it.", 2),
      waSec("That alone removes a lot of friction.", 2),
      waSec("And friction is usually what keeps people stuck.", 2),

      // ── 8. RISCOS E PERDAS
      waSec("Honestly, waiting usually makes this harder.", 2),
      waSec("Each week of ignoring the heaviness is another week of discomfort repeating.", 2),
      waSec("And the longer it stays normal, the easier it is to keep putting it off.", 2),
      audioSec(X1_AUDIO.objecao_preco, 3),
      waSec("I don't want you stuck in that loop.", 2),
      waSec("This is where people usually say, \"I should have done this sooner.\"", 2),

      // ── OBJEÇÕES
      ia(
        `She has seen the mechanism, the grouped proof and gave you a temperature number. Surface and answer objections now — ONE per message, WhatsApp-chat length, calm and specific.

${X1_OBJECTIONS}

You may send https://tkbivipqiewkfnhktmqq.supabase.co/storage/v1/object/public/whatsapp-media/x1/img/img_custo_comparativo.jpg once, only when price is the objection.

${X1_NEGOTIATION}
${X1_BANNED}

The moment she shows real buying intent (asks price, shipping, how to order, or says yes), send https://imphafilliate.vercel.app/shop-linfaflow.html and stop selling. If she only ever pushes on price, tag her as a discount hunter, be polite and stop selling. If she sends a photo or screenshot, read it and answer in context.`,
        0,
        { ia_vision: true, questioning_strategy: "consultivo_progressivo" }
      ),
      waitReply(240),

      // ── 9. FECHAMENTO ($89)
      qualify(85, "linfaflow,pronto-fechamento", "fechamento"),
      notify("comercial"),
      waSec("I get it if you've been cautious.", 2),
      waSec("You want something simple, useful and worth your time.", 2),
      waSec("That's exactly why LinfaFlow is $89 for the full 30-day daily support system.", 2),
      waSec(X1_IMG.garantia, 2),
      waSec(
        "So — one bottle for 30 days, or the 3-bottle set so you don't have to think about reordering?\n\n👉 https://imphafilliate.vercel.app/shop-linfaflow.html\n\n30-day unconditional guarantee: if your mornings don't feel different, full refund, no questions, and you don't even have to send the bottles back.",
        2
      ),
      waSec("If you're ready, take the step today. If not, no pressure at all.", 3),

      // ── RÉGUA (o Typebot morre quando a aba fecha; aqui continua)
      aguardar(1440),
      wa(
        "One thing I forgot to say yesterday: the guarantee runs for 30 days, which is exactly how long one bottle lasts. So you're not deciding if it works — you're deciding to find out. https://imphafilliate.vercel.app/shop-linfaflow.html",
        0
      ),
      aguardar(2880),
      { tipo: "audio", template: X1_AUDIO.inercia, delay_min: 0 } as Acao,
      aguardar(5760),
      wa(`A new one came in this week and it made me think of what she told me:\n${X1_IMG.prova_3}`, 0),
      stop("compra_aprovada"),
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // SLIMSODA X1 — CHAT CONVERSACIONAL DANA (EN-US)
  // LP conversacional estilo WhatsApp. 11 nós, 25+ técnicas de
  // conversão aplicadas, 4 variants por frustração (eat_less_gain,
  // food_noise, hormones, after_kids) e 3 variants por idade
  // (testemunhas Linda 63, Marlene 67, Diane 71).
  //
  // Assets: SLIMSODA_AUDIO (17 TTS clips voz feminina) +
  // SLIMSODA_IMG (11 webp) + SLIMSODA_CHECKOUT_URL.
  //
  // Compatível com o chat-x1 deployed em slim-soda01.vercel.app/chat-x1/.
  // Pendentes: migração dos assets pro Supabase storage (mesmo padrão X1).
  // ─────────────────────────────────────────────────────────────
  {
    id: "slimsoda-x1-conversational",
    nome: "SlimSoda X1 — Chat Conversacional Dana [EN-US]",
    descricao:
      "Canal: Chat LP com skin WhatsApp/Messenger. 11 nós com 4 variants por frustração e 3 por idade. Áudio pré-gravado (Dana, voz feminina) + texto complementar + LLM bounded nas objeções. Fixa: $24.99 B1G1, 60-day empty-tub guarantee.",
    trigger_tipo: "lead_novo",
    categoria: "x1-conversao",
    emoji: "🥤",
    acoes: [
      // ── 1. WELCOME (áudio + texto) ──
      audioSec(SLIMSODA_AUDIO.dana_intro, 2),
      waSec("I'm the formulator behind all those viral baking soda videos — the original recipe, not the copycat.", 2),
      waSec("Before I tell you how it works, I want to understand you first.", 2),
      waSec("A few quick questions, then I'll show you the recipe nobody else is sharing.", 3),
      tag("slimsoda-x1"),

      // ── 2. QUALIFYING 1: AGE ──
      waSec("First — what's your age? Just so I can tell you the right story.", 2),
      waitReply(60),
      qualify(20, "slimsoda,x1-qualificado", "qualificacao"),

      // ── 2b. QUALIFYING 2: FRUSTRATION (ramificada) ──
      ia(
        `You are Dana, a warm sister-figure formulator in her late 50s. She just told you her age. Mirror it back in one warm sentence, then ask the frustration question. American English, 1-2 short lines, WhatsApp-style chat.

Next question: "What's the worst part of where you are right now?" with these 4 quick-reply options:
- I eat less and still gain
- Constant food noise / hunger
- Hormones / menopause
- After kids / pregnancy

Store her choice in state.frustration. End with the quick-reply buttons, no link, no pitch.

${SLIMSODA_BANNED}`,
        0,
        { ia_vision: false, questioning_strategy: "consultivo_progressivo" }
      ),
      waitReply(120),
      qualify(40, "slimsoda,x1-diagnostico", "qualificacao"),

      // ── 2c. QUALIFYING 3: GLP-1 ──
      ia(
        `She picked a frustration. Mirror it in one sentence ("That is the thing I hear most from women your age"), then ask the next question — short, chat-length:

"Have you tried Ozempic, Wegovy, or any of the injections?" with options:
- Yes — and stopped
- Yes — still on it
- No — too expensive
- No — scared of it

Store her choice in state.glp1. Quick replies, no link.

${SLIMSODA_BANNED}`,
        0,
        { ia_vision: false }
      ),
      waitReply(90),

      // ── 2d. QUALIFYING 4: WEIGHT ──
      ia(
        `One more question. Chat-length, warm, quick-reply format:

"Last one. How much weight do you want to lose?" with options:
- 5-10 kg
- 10-20 kg
- 20+ kg

Store in state.weight. Then move to the personalized hook — do NOT pitch yet.

${SLIMSODA_BANNED}`,
        0,
        { ia_vision: false }
      ),
      waitReply(90),
      qualify(60, "slimsoda,x1-pronto-hook", "qualificacao"),

      // ── 3. PERSONALIZED HOOK (4 variants by frustration) ──
      ia(
        `She's answered all 4 qualifying questions. She has state.frustration, state.age, state.glp1, state.weight. Send ONE short message — the personalized hook, branched by frustration:

- eat_less_gain: "That is the number one thing I hear from women who eat like a bird and still gain. I know — you've probably tried cutting calories, even tried the celebrity capsule. None of it worked because of the order. Let me show you why eating less was never going to fix this."
- food_noise: "The food noise is the worst part. I know. It is not willpower. It is a switch in your gut. You've probably tried everything short of this. Let me show you how I flipped mine — and how Rachel's did too."
- hormones: "After 40, after babies, after menopause — the switch gets stuck. It is not your hormones being broken. It is one specific signal that stopped. You've probably been told it's 'just age.' It isn't. Let me show you how to restart it."
- after_kids: "I made this for the sister version of you. Three kids in, body you don't recognize, doctors telling you to eat less. You've probably tried the gym, the shakes, even the injections. Same story Rachel lived. Let me show you what actually worked."

Always reference her specific state (age, weight, glp1) in one short sentence first. Chat-length, 2-3 lines. No link, no price, no pitch.

${SLIMSODA_BANNED}`,
        0,
        { ia_vision: false, questioning_strategy: "personalized_hook" }
      ),
      waitReply(120),

      // ── 4. CONFESSION (áudio + texto + imagem) ──
      audioSec(SLIMSODA_AUDIO.dana_confession, 3),
      waSec("I'm going to tell you something I've never said publicly.", 2),
      waSec("I was wrong about something for twenty years.", 2),
      waSec("What I found out that night changed everything — and ended up in the formula that's in all those videos you keep seeing.", 3),
      wa(SLIMSODA_IMG.sisters, 1),
      waitReply(60),

      // ── 5. MECHANISM (4 variants by frustration) ──
      ia(
        `Now the mechanism. Branched by state.frustration. Send the matching audio (use the URL from SLIMSODA_AUDIO.dana_mechanism_<variant>) right BEFORE the text. Audio is a short 8-10s hook. Text is the complementary expansion.

- eat_less_gain: play dana_mechanism_eatless. Then text: "It's not about eating less. It's about the order. Baking soda wakes dormant gut cells. Ginger protects the hormone that tells your body it's full. Berberine flips the switch from STORE to BURN. That's why eating less never worked. The order is the secret. Sound about right?"
- food_noise: play dana_mechanism_foodnoise. Then: "The noise quiets when the switch flips. Three ingredients — in the right order. Baking soda wakes the cells that respond to your fullness hormone. Ginger blocks the enzyme that's stealing it — by ninety-three percent. Berberine flips the switch from STORE to BURN. The first morning, you feel it."
- hormones: play dana_mechanism_hormones. Then: "Your hormone isn't broken. It's being destroyed. An enzyme called DPP-4 is eating it before your body can use it. Ginger blocks that enzyme — by ninety-three percent. Baking soda wakes the cells. Berberine flips the switch. Three ingredients, in order, every morning. Sound fair?"
- after_kids: play dana_mechanism_kids. Then: "Your body remembers the version of you that was thinner. It's still in there. Wake the cells with baking soda. Protect the hormone with ginger. Flip the switch with berberine. Three ingredients, in the right order, in the right amounts. The first week, the noise quiets. By week three, you're back."

ALWAYS use the matching variant audio + text. Never use the fallback dana_mechanism unless state.frustration is unknown.

${SLIMSODA_BANNED}`,
        0,
        { ia_vision: false, audio_url: SLIMSODA_AUDIO.dana_mechanism_eatless }  // hint ao runtime pra tocar áudio
      ),
      ia(
        `Play the matching mechanism audio for state.frustration (eatless / foodnoise / hormones / kids) right before sending the expansion text. Always include the audio first, then the text below it.`,
        0
      ),
      waitReply(60),

      // ── 6. RECIPROCITY (áudio) ──
      audioSec(SLIMSODA_AUDIO.dana_reciprocity, 2),
      waSec("Look, I gave away the recipe for free. The celebrities made billions.", 2),
      waSec("I'm not asking you to pay for the secret.", 2),
      waSec("I'm asking you to try the version that's done right. That's it.", 3),
      waitReply(60),

      // ── 7. TESTIMONIAL (3 variants by age) ──
      ia(
        `Testimonial stage. Branched by state.age. Audio is a real woman telling her story in her own voice; text is a short caption + caption image.

- age 55-70: play dana_testimonial_linda. Text: "Hear it from Linda in her own voice." Image: SLIMSODA_IMG.testimonial_linda. Caption: "Linda, 63 — Asheville, NC · 22 pounds down"
- age 70+: play dana_testimonial_diane. Text: "Hear it from Diane in her own voice." Image: SLIMSODA_IMG.testimonial_diane. Caption: "Diane, 71 — Mesa, AZ · tried the shots, gained it all back"
- age 30-45 OR 45-55: play dana_testimonial_marlene. Text: "Hear it from Marlene in her own voice." Image: SLIMSODA_IMG.testimonial_marlene. Caption: "Marlene, 67 — Dublin, GA · the jeans buttoned"

Audio is the primary hook. Text is just a caption. Never use the wrong testimonial for the wrong age bracket.

${SLIMSODA_BANNED}`,
        0,
        { ia_vision: false, audio_url: SLIMSODA_AUDIO.testimonial_linda }
      ),
      waitReply(60),

      // ── 8. PROOF SISTERS (Rachel 41 lbs) ──
      wa(SLIMSODA_IMG.rachel_kitchen, 0),
      waSec("I gave my sister Rachel the same formula. She lost 41 pounds.", 3),
      waSec("No diet. No gym. Just one scoop a day.", 2),
      waSec('She texted me the photo above and said: "Dana, the noise is gone."', 3),
      waSec("If you're still reading this, you're not ready to give up. You're just ready to do it right.", 3),
      waitReply(60),

      // ── 9. LOSS AVERSION (4 variants by frustration) ──
      ia(
        `Loss aversion stage. Branched by state.frustration. Play the matching audio FIRST (8s hook), then the text expansion (emotional weight + future cost).

- eat_less_gain: play dana_loss_aversion_eatless. Then: "You've done the work. You cut the calories. You watched what you ate. And the number still went up. That's not a willpower problem — that's the switch stuck on STORE. Six months from now, you could be free of that — or still wondering why nothing works. I don't want that for you."
- food_noise: play dana_loss_aversion_foodnoise. Then: "That constant pull — the one that never turns off, even when you're full. I know. It's not hunger. It's the switch. Six months from now, you could have it quiet — or you could still be fighting it every hour. I know which one I want for you."
- hormones: play dana_loss_aversion_hormones. Then: "After 40, after menopause, after the kids — your doctor said it's just age. It isn't. The switch is stuck on STORE, not broken. Six months from now, you could have it back — or still blaming your age. You know that's not what it is."
- after_kids: play dana_loss_aversion_kids. Then: "Three kids in. Body you don't recognize. Photos you avoid. I made this for the version of you that was before. Six months from now, you could be back in the photo with them — or still hiding from the camera. You decide."

Then close with a micro-commitment quick-reply: "I don't want to wait" → next.

${SLIMSODA_BANNED}`,
        0,
        { ia_vision: false, audio_url: SLIMSODA_AUDIO.dana_loss_aversion_eatless }
      ),
      waitReply(60),

      // ── 10. FUTURE PACE ──
      ia(
        `Future pacing, 1-2 short messages. Picture herself 90 days from now — the food noise is gone, she wakes up lighter, she's in the photo with her kids again. "Picture yourself 90 days from now." "A return to yourself." Close with the quick-reply "I'm in — show me" → ask_anything.

${SLIMSODA_BANNED}`,
        0,
        { ia_vision: false }
      ),
      waitReply(60),

      // ── 11. ASK ANYTHING (LLM bounded) ──
      ia(
        `She's seen the hook, the mechanism, the reciprocity, the testimonial, the proof, the loss aversion, and the future pace. Her temperature is high.

Now: let her ask anything, but with a clear bound. Answer briefly (1-3 sentences), use the techniques, reference her specific state (age, frustration, glp1, weight) when relevant. Then ALWAYS end with a clear next-step prompt: "Here's the offer →" or "Want to see it?" or similar.

Maximum 2 free-text turns per session — after that, just show the offer and stop selling. Don't get stuck in a chat loop.

${SLIMSODA_BANNED}
${SLIMSODA_NEGOTIATION}`,
        0,
        { ia_vision: false, questioning_strategy: "ask_anything_bounded" }
      ),
      waitReply(120),

      // ── 12. OFFER ($24.99 B1G1 + state-based callback) ──
      audioSec(SLIMSODA_AUDIO.dana_cta, 2),
      waSec("I made this for women like you. You're the kind of woman who takes action when she sees something real.", 2),
      waSec("No risk on you.", 2),

      // Offer com callback por frustration + age note
      ia(
        `Offer stage. Use state-based callback — the same one in the chat-x1 SCRIPT. Send the price comparison image SLIMSODA_IMG.price_compare, then the offer card. End with the checkout link.

- eat_less_gain callback: "For you — eating like a bird and still gaining — this is the recipe."
- food_noise callback: "For the food noise that never quiets — this is what finally turns it off."
- hormones callback: "For the post-40, post-menopause switch that's stuck on STORE — this flips it back."
- after_kids callback: "For the body you don't recognize after kids — this is what works."

If state.age is 55-70, append "(at 55-70, this works even faster)".

Then show the stack:
- 2 tubs (60-84 day supply): $119.98
- Free shipping: $9.99
- 60-day empty-tub money-back guarantee: included
- TODAY: $24.99

CTA: "YES — SEND MY 2 TUBS ($24.99) →" with the SLIMSODA_CHECKOUT_URL.

Identity reinforcement before: "You're the kind of woman who takes action when she sees something real."
Urgency: "⏰ Launch price — when the free-tub run is gone, it goes to $59.99/tub."

${SLIMSODA_BANNED}
${SLIMSODA_NEGOTIATION}`,
        0,
        { ia_vision: false, audio_url: SLIMSODA_AUDIO.dana_cta }
      ),

      // ── 13. CLOSE: qualifica + tag + stop ──
      qualify(85, "slimsoda,pronto-fechamento,x1-conversacional", "fechamento"),
      notify("comercial"),
      stop("compra_aprovada"),
    ],
  },
];


export function getTemplatesByTrigger(triggerTipo?: string): FlowTemplate[] {
  if (!triggerTipo) return FLOW_TEMPLATES;
  return FLOW_TEMPLATES.filter((t) => t.trigger_tipo === triggerTipo);
}

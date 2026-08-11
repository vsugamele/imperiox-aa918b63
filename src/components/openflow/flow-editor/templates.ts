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
  // Mídias: áudios (x1/audio/) e imagens (x1/img/) já publicados no storage.
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
      { tipo: "audio", template: "https://tkbivipqiewkfnhktmqq.supabase.co/storage/v1/object/public/whatsapp-media/x1/audio/audio_ritual.mp3", delay_min: 1 } as Acao,
      wa(
        "That's the whole idea behind LINFAFLOW: 4 botanicals organized by complementary function — Cleavers to get things moving, Stillingia and Prickly Ash to help mobilize what feels stuck, Red Clover for daily balance. Liquid drops, 1 mL morning and night. A 30-second ritual. No capsules, no aggressive cleanse, no water pills.",
        0
      ),
      waitReply(360),

      // 6. PROVA AGRUPADA (social proof clustering)
      wa("Let me show you three women who were exactly where you are 👇", 0),
      wa("https://tkbivipqiewkfnhktmqq.supabase.co/storage/v1/object/public/whatsapp-media/x1/img/img_prova_1.jpg", 0),
      wa("https://tkbivipqiewkfnhktmqq.supabase.co/storage/v1/object/public/whatsapp-media/x1/img/img_prova_2.jpg", 0),
      wa("https://tkbivipqiewkfnhktmqq.supabase.co/storage/v1/object/public/whatsapp-media/x1/img/img_prova_3.jpg", 0),
      wa("Diane, Marlene and Rosa — different ages, same complaint, same 30 seconds a day.", 0),
      wa("And this is what's actually inside the bottle — nothing exotic, just organized:\nhttps://tkbivipqiewkfnhktmqq.supabase.co/storage/v1/object/public/whatsapp-media/x1/img/img_ingredientes.jpg", 1),
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

If it helps, you may send the cost comparison image https://tkbivipqiewkfnhktmqq.supabase.co/storage/v1/object/public/whatsapp-media/x1/img/img_custo_comparativo.jpg once, when price is the objection.

${X1_NEGOTIATION}
${X1_BANNED}

Disqualification: if she only ever pushes on price, asks for a discount before seeing any value, or is clearly outside the profile, tag her as disqualified, be polite, and stop selling — do not keep the sequence running.

The moment she shows real buying intent (asks price, shipping, how to order, or says yes), send https://imphafilliate.vercel.app/shop-linfaflow.html and stop selling. If she sends a photo or screenshot, read it and answer in context.`,
        0,
        { ia_vision: true, questioning_strategy: "consultivo_progressivo" }
      ),
      waitReply(720),

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
      { tipo: "audio", template: "https://tkbivipqiewkfnhktmqq.supabase.co/storage/v1/object/public/whatsapp-media/x1/audio/audio_inercia.mp3", delay_min: 0 } as Acao,
      aguardar(5760),
      wa("A new one came in this week and it made me think of what you told me:\nhttps://tkbivipqiewkfnhktmqq.supabase.co/storage/v1/object/public/whatsapp-media/x1/img/img_prova_3.jpg", 0),
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
      wa("https://tkbivipqiewkfnhktmqq.supabase.co/storage/v1/object/public/whatsapp-media/x1/img/img_prova_1.jpg", 0),
      wa("https://tkbivipqiewkfnhktmqq.supabase.co/storage/v1/object/public/whatsapp-media/x1/img/img_prova_2.jpg", 0),
      wa("https://tkbivipqiewkfnhktmqq.supabase.co/storage/v1/object/public/whatsapp-media/x1/img/img_prova_3.jpg", 0),
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

You may send https://tkbivipqiewkfnhktmqq.supabase.co/storage/v1/object/public/whatsapp-media/x1/img/img_custo_comparativo.jpg once when price is the objection.

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
  // Adaptado do fluxo LinfaFlow do Typebot: os 9 estágios de venda
  // (conexão → conscientização → curiosidade → mecanismo → benefícios →
  //  prova social → oportunidade → riscos e perdas → fechamento $89),
  // com o ritmo de mensagens curtas de 2-4s que faz parecer conversa real,
  // e com a engenharia X1 por cima: SPIN, trial close 0-10, objeções e guardrails.
  // Áudios e imagens já vêm com as mídias gravadas do export.
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
      audioSec(LF_AUDIO[0], 2),
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
      waSec(LF_IMG[0], 2),
      waSec("When support is timed well, the whole day feels different.", 4),
      waSec("What would you most like to improve first?", 2),
      waitReply(60),
      waSec("That answer helps a lot.", 2),
      audioSec(LF_AUDIO[1], 3),
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
      audioSec(LF_AUDIO[2], 3),
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
      waSec(LF_IMG[1], 2),
      waSec("She said the biggest surprise was how manageable it felt.", 4),
      waSec("And she's not the only one 👇", 2),
      waSec("https://tkbivipqiewkfnhktmqq.supabase.co/storage/v1/object/public/whatsapp-media/x1/img/img_prova_1.jpg", 0),
      waSec("https://tkbivipqiewkfnhktmqq.supabase.co/storage/v1/object/public/whatsapp-media/x1/img/img_prova_2.jpg", 0),
      waSec("https://tkbivipqiewkfnhktmqq.supabase.co/storage/v1/object/public/whatsapp-media/x1/img/img_prova_3.jpg", 0),
      waSec("Different ages, same complaint, same 30 seconds a day.", 2),
      waSec("Full story and what's inside the bottle: https://imphafilliate.vercel.app/advertorial-a-hora", 2),
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
      audioSec(LF_AUDIO[3], 3),
      waSec("And friction is usually what keeps people stuck.", 2),

      // ── 8. RISCOS E PERDAS
      waSec("Honestly, waiting usually makes this harder.", 2),
      waSec("Each week of ignoring the heaviness is another week of discomfort repeating.", 2),
      waSec("And the longer it stays normal, the easier it is to keep putting it off.", 2),
      audioSec(LF_AUDIO[4], 3),
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
      audioSec(LF_AUDIO[5], 3),
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
      { tipo: "audio", template: "https://tkbivipqiewkfnhktmqq.supabase.co/storage/v1/object/public/whatsapp-media/x1/audio/audio_inercia.mp3", delay_min: 0 } as Acao,
      aguardar(5760),
      wa("A new one came in this week and it made me think of what you told me:\nhttps://tkbivipqiewkfnhktmqq.supabase.co/storage/v1/object/public/whatsapp-media/x1/img/img_prova_3.jpg", 0),
      stop("compra_aprovada"),
    ],
  },
];


export function getTemplatesByTrigger(triggerTipo?: string): FlowTemplate[] {
  if (!triggerTipo) return FLOW_TEMPLATES;
  return FLOW_TEMPLATES.filter((t) => t.trigger_tipo === triggerTipo);
}

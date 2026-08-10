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

const aguardar = (delay_min: number): Acao => ({ tipo: "aguardar", template: "", delay_min });

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
];

export function getTemplatesByTrigger(triggerTipo?: string): FlowTemplate[] {
  if (!triggerTipo) return FLOW_TEMPLATES;
  return FLOW_TEMPLATES.filter((t) => t.trigger_tipo === triggerTipo);
}

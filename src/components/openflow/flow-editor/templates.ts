import type { Acao } from "../FlowEditor";

export interface FlowTemplate {
  id: string;
  nome: string;
  descricao: string;
  trigger_tipo: string;
  categoria: "recuperacao" | "boas-vindas" | "reativacao" | "nutricao" | "carrinho" | "onboarding";
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

const ia = (prompt: string, delay_min = 0): Acao => ({
  tipo: "ia_message",
  template: prompt,
  delay_min,
  ia_search_web: false,
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
      {
        tipo: "wait_reply",
        template: "",
        delay_min: 0,
        timeout_min: 1440,
      },
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
];

export function getTemplatesByTrigger(triggerTipo?: string): FlowTemplate[] {
  if (!triggerTipo) return FLOW_TEMPLATES;
  return FLOW_TEMPLATES.filter((t) => t.trigger_tipo === triggerTipo);
}

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { extractLeadComplaints, type LeadSignalInput } from "@/lib/agency-radar";
import {
  loadProjectIntelligence,
  promoteWinnerToProjectControl,
  type ProjectIntelligenceBundle,
} from "@/lib/project-intelligence";
import { normalizeProjectIcon, SiteThumbnail } from "@/components/sites/SiteThumbnail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  BookOpen,
  Brain,
  CheckCircle2,
  Copy,
  Cpu,
  Eye,
  FileCode2,
  FileText,
  Flame,
  Globe,
  Layers,
  Loader2,
  MessageCircle,
  Monitor,
  Radio,
  Rocket,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Trophy,
  UserCheck,
  Users,
  Wand2,
} from "lucide-react";

export type AgencyFrontType =
  | "advertorial"
  | "pdp_dtc"
  | "lp_vsl"
  | "captura_quiz"
  | "webinar"
  | "grupo_lancamento"
  | "grupo_relacionamento"
  | "x1_closer";

interface FrontMeta {
  id: AgencyFrontType;
  label: string;
  shortTag: string;
  icon: typeof BookOpen;
  description: string;
  siteCategory: string;
  deliverables: string[];
}

export const AGENCY_FRONTS: FrontMeta[] = [
  {
    id: "advertorial",
    label: "Advertorial Editorial (Pré-Venda)",
    shortTag: "Advertorial",
    icon: BookOpen,
    description:
      "Matéria estilo portal jornalístico/científico que invalida métodos velhos, revela o mecanismo único e aquece o clique para a PDP ou VSL.",
    siteCategory: "Advertorial",
    deliverables: [
      "Manchete Investigativa + Sub-headline de Choque",
      "Lead de Identificação com a Dor Silenciosa",
      "A Descoberta Científica / Vilão Oculto vs. Mecanismo Novo",
      "Prova Social Nativa (Comentários + Estudos)",
      "Box de Transição com Oferta de Risco Zero para a PDP",
    ],
  },
  {
    id: "pdp_dtc",
    label: "PDP Multi-Kits (Loja DTC 1 / 3 / 5 Potes)",
    shortTag: "PDP / E-com",
    icon: ShoppingBag,
    description:
      "Página de produto de alta conversão com ancoragem de protocolo (1, 3 e 5 unidades), cálculo de custo diário, benefícios por marcador e FAQ das dores do X1.",
    siteCategory: "PDP",
    deliverables: [
      "Hero Above-the-Fold (5 Bullets de Transformação + Selos)",
      "Tabela de Ancoragem de Kits (1 Pote vs. 3 Potes Mais Vendido vs. 5 Potes)",
      "Raio-X da Fórmula / Mecanismo em 3 Etapas",
      "Comparativo Nós vs. Soluções Genéricas de Farmácia",
      "FAQ Matador baseado nas Reclamações Reais dos Leads",
    ],
  },
  {
    id: "lp_vsl",
    label: "Landing Page Long-Form / Página de VSL",
    shortTag: "LP / VSL",
    icon: Globe,
    description:
      "Página de vendas direta com Headline de Mecanismo, player de VSL, empilhamento de valor (Stack), garantia condicional e fechamento de urgência.",
    siteCategory: "LP Vendas",
    deliverables: [
      "Headline + Sub-headline de Promessa Específica",
      "Bloco de Retenção abaixo do Player + Botão Delay",
      "Empilhamento de Bônus + Ancoragem de Preço",
      "Garantia Blindada Incondicional + Condicional",
      "Bloco de Escassez e Quebra de Objeções Finais",
    ],
  },
  {
    id: "captura_quiz",
    label: "Página de Captura / Quiz Diagnóstico",
    shortTag: "Captura / Quiz",
    icon: Layers,
    description:
      "Squeeze page ou micro-quiz de 4 perguntas que segmenta a dor do lead e redireciona para o Grupo VIP, Webinar ou atendimento X1.",
    siteCategory: "Captura",
    deliverables: [
      "Headline de Curiosidade com Conversão > 45%",
      "4 Perguntas de Micro-Comprometimento (Quiz)",
      "Tela de Resultado Personalizado + Ponte para o Grupo/X1",
      "Copy da Página de Obrigado com Passo Obrigatório no WhatsApp",
    ],
  },
  {
    id: "webinar",
    label: "Sala & Régua Completa de Webinar",
    shortTag: "Webinar",
    icon: Radio,
    description:
      "Estrutura ponta a ponta para aula ao vivo ou gravada: página de inscrição, sequência de show-up (comparecimento), roteiro de pitch e replay de 48h.",
    siteCategory: "Webinar",
    deliverables: [
      "Copy da Página de Inscrição (3 Segredos da Aula)",
      "Régua de Show-Up no WhatsApp (Faltam 24h, 1h, 15min e Ao Vivo)",
      "Esqueleto de Transição Conteúdo → Pitch de Oferta",
      "Sequência de Replay + Fechamento de Carrinho (48h)",
    ],
  },
  {
    id: "grupo_lancamento",
    label: "Grupos de Lançamento (Cronograma + Mensagens)",
    shortTag: "Grupo Lançamento",
    icon: Rocket,
    description:
      "Cronograma completo para grupos silenciosos de lançamento: boas-vindas, aquecimento, liberação das aulas/CPLs, abertura de carrinho e repescagem X1.",
    siteCategory: "Lançamento",
    deliverables: [
      "Descrição do Grupo + Mensagem Fixada de Boas-Vindas",
      "Cronograma de Aquecimento (Seg a Qua) com Enquetes",
      "Disparos de Liberação de Aula / Live + Resumo Executivo",
      "Sequência de Abertura de Carrinho (6 Toques no Dia D)",
      "Script de Repescagem Individual no X1 para Membros do Grupo",
    ],
  },
  {
    id: "grupo_relacionamento",
    label: "Grupo de Relacionamento VIP & Ofertas Relâmpago",
    shortTag: "Grupo Relacionamento",
    icon: Users,
    description:
      "Comunidade contínua no WhatsApp que nutre leads toda semana com micro-provas, dicas práticas e abre janelas relâmpago de 24h com alto ROAS.",
    siteCategory: "Comunidade VIP",
    deliverables: [
      "Ritual Semanal de Conteúdo (Segunda Mito, Quarta Caso Real, Quinta Enquete)",
      "Script de Enquete Diagnóstica para Identificar Compradores Quentes",
      "Sequência de Oferta Relâmpago 24h (Abertura, Prova, Últimas Unidades)",
      "Abordagem Privada X1 pós-voto na Enquete",
    ],
  },
  {
    id: "x1_closer",
    label: "Playbook X1 Consultivo & Quebra-Objeção",
    shortTag: "X1 / WhatsApp",
    icon: MessageCircle,
    description:
      "Árvore de atendimento humano e IA para WhatsApp e Direct: abertura conforme o anúncio, diagnóstico em 2 perguntas, ancoragem de kit e recuperação.",
    siteCategory: "Script X1",
    deliverables: [
      "Abertura Espelhada no Gancho do Anúncio (Primeiros 60s)",
      "2 Perguntas de Diagnóstico que Fazem o Lead Admitir a Urgência",
      "Apresentação do Mecanismo em Áudio de 40s + Link do Kit Ideal",
      "Respostas Prontas para as 5 Maiores Objeções Reais (Preço, Ceticismo, Prazo)",
      "Follow-up de 15min, 2h e 24h para Pix/Boleto Pendente",
    ],
  },
];

interface BlueprintSection {
  title: string;
  tag: string;
  body: string;
}

function buildDeterministicBlueprint(params: {
  front: FrontMeta;
  projectName: string;
  productName: string;
  avatarPain: string;
  mechanismName: string;
  offerDetails: string;
  topObjectionLabel: string;
  topObjectionQuote: string;
  topObjectionAnswer: string;
}): BlueprintSection[] {
  const {
    front,
    projectName,
    productName,
    avatarPain,
    mechanismName,
    offerDetails,
    topObjectionLabel,
    topObjectionQuote,
    topObjectionAnswer,
  } = params;

  switch (front.id) {
    case "advertorial":
      return [
        {
          title: "1. Manchete Editorial & Sub-headline Investigativa",
          tag: "Topo da Página (Above the Fold)",
          body: `MANCHETE: Por que milhares de pessoas que sofrem com ${avatarPain} estão abandonando métodos paliativos após a descoberta do mecanismo "${mechanismName}"?\n\nSUB-HEADLINE: Especialistas explicam por que atacar apenas o sintoma superficial falha em 87% dos casos — e como um protocolo simples de 15 segundos com ${productName} está devolvendo resultados visíveis já nas primeiras semanas.`,
        },
        {
          title: "2. Lead de Identificação + Invalidação da Culpa",
          tag: "Parágrafos 1–4",
          body: `Se você já tentou mudar a rotina, cortou o que gostava ou gastou com soluções genéricas e ainda assim continua sentindo ${avatarPain}, a primeira coisa que você precisa saber é: a culpa não é sua.\n\nNovas análises mostram que o verdadeiro bloqueio está na falta de ativação do ${mechanismName}. Sem destravar essa etapa primeiro, qualquer tentativa comum é desperdiçada pelo organismo antes de fazer efeito.`,
        },
        {
          title: "3. Explicação Visual do Mecanismo + Quebra de Ceticismo",
          tag: "Meio da Matéria",
          body: `COMO FUNCIONA O ${mechanismName.toUpperCase()}:\n1️⃣ Fase 1 (Dias 1–7): Desbloqueio imediato da retenção e alívio da sobrecarga.\n2️⃣ Fase 2 (Dias 8–30): Restauração do fluxo natural com absorção concentrada de ${productName}.\n3️⃣ Fase 3 (Dias 31–90): Estabilização profunda para que o problema não volte no mês seguinte.\n\n💡 Respondendo à dúvida mais comum dos leitores (${topObjectionLabel}):\n"${topObjectionQuote}"\n→ ${topObjectionAnswer}`,
        },
        {
          title: "4. Chamada Nativa para a PDP (Oferta de Kits)",
          tag: "CTA de Passagem",
          body: `⚠️ DISPONIBILIDADE DO LOTE ATUAL (${projectName}):\nDevido à alta procura após esta reportagem, o laboratório liberou uma condição especial com ${offerDetails} e garantia blindada de 30 dias.\n\n[BOTÃO VERDE PULSANTE]: VERIFICAR DISPONIBILIDADE E ESCOLHER MEU KIT DE ${productName.toUpperCase()} →`,
        },
      ];

    case "pdp_dtc":
      return [
        {
          title: "1. Hero da PDP (Galeria + Promessa + 5 Bullets)",
          tag: "Dobra 1 · Compra Rápida",
          body: `${productName} — Tecnologia ${mechanismName}\n⭐⭐⭐⭐⭐ 4.9/5 (Mais de 3.400 clientes verificados)\n\n• Atua diretamente em: ${avatarPain}\n• Absorção rápida: ritual matinal de 15 segundos\n• Fórmula 100% pura, sem estimulantes agressivos\n• Envios em 24h úteis com rastreio no WhatsApp\n• Garantia de 30 dias: resultado visível ou 100% do seu dinheiro de volta`,
        },
        {
          title: "2. Seletor Estratégico de Kits (Ancoragem DTC)",
          tag: "Box de Conversão",
          body: `📦 KIT 1 POTE (Experimentação · 30 dias)\nDe R$ 247 por R$ 197 (ou 12x R$ 19,78) · Frete fixo\n\n🔥 KIT 3 POTES (MAIS ESCOLHIDO · Protocolo 90 dias)\n${offerDetails} · Sai a menos de R$ 3,30 por dia + FRETE GRÁTIS + Bônus Guia de Aceleração\n\n👑 KIT 5 POTES (Máxima Economia · 150 dias)\nMaior desconto por unidade + Frete Expresso Grátis + Prioridade de Lote`,
        },
        {
          title: "3. Comparativo Nós vs. Outros + FAQ das Reclamações Reais",
          tag: "Blindagem de Conversão",
          body: `POR QUE ${productName.toUpperCase()} É DIFERente:\n✅ ${productName}: Ativa o ${mechanismName}, alta biodisponibilidade, garantia de 30 dias.\n❌ Soluções comuns: Baixa absorção, tratam só o efeito superficial, sem acompanhamento.\n\nPERGUNTAS FREQUENTES (Extraídas do Atendimento X1):\n• ${topObjectionLabel}\n"${topObjectionQuote}"\nResposta: ${topObjectionAnswer}`,
        },
      ];

    case "lp_vsl":
      return [
        {
          title: "1. Headline de Mecanismo + Player + Micro-Comprometimento",
          tag: "Dobra 1 (VSL)",
          body: `KICKER: REVELADO PARA QUEM SOFRE COM ${avatarPain.toUpperCase()}\nHEADLINE: O Ritual Matinal de 15 Segundos que Ativa o "${mechanismName}" sem Dietas Restritivas ou Procedimentos Caros.\n\n[PLAYER DE VÍDEO COM THUMBNAIL DE CURIOSIDADE]\n🔊 Assista enquanto esta apresentação ainda está no ar.`,
        },
        {
          title: "2. Stack da Oferta + Ancoragem + Garantia Dupla",
          tag: "Abaixo do Delay",
          body: `TUDO O QUE VOCÊ RECEBE HOJE COM ${productName.toUpperCase()}:\n1. Protocolo Completo ${productName} (${mechanismName})\n2. Bônus #1: Mapa de Desbloqueio Rápido em 7 Dias (Valor: R$ 97 → GRÁTIS)\n3. Bônus #2: Acompanhamento e Suporte no WhatsApp\n\nCondição Especial Hoje: ${offerDetails}\n🛡️ Garantia Blindada de 30 Dias: Teste sem risco. Se não amar, devolvemos 100% no Pix.`,
        },
        {
          title: "3. Quebra da Objeção nº 1 dos Leads",
          tag: "Fechamento da LP",
          body: `Ainda em dúvida por causa de "${topObjectionLabel}"?\nMuitos clientes nos perguntam: "${topObjectionQuote}"\n\nNossa resposta direta: ${topObjectionAnswer}`,
        },
      ];

    case "captura_quiz":
      return [
        {
          title: "1. Dobra de Captura / Abertura do Quiz Diagnóstico",
          tag: "Conversão > 45%",
          body: `DESCUBRA EM 45 SEGUNDOS:\nQual é o nível de bloqueio que está causando ${avatarPain} no seu caso — e receba gratuitamente o plano de ativação do ${mechanismName}.\n\n[BOTÃO]: INICIAR MEU DIAGNÓSTICO GRATUITO →`,
        },
        {
          title: "2. As 4 Perguntas de Qualificação (Salvas no Lead)",
          tag: "Perguntas do Quiz",
          body: `P1 (Sintoma): Em qual momento do dia você mais sente ${avatarPain}?\nP2 (Histórico): O que você já tentou antes que não trouxe resultado duradouro?\nP3 (Urgência): Se pudéssemos destravar seu ${mechanismName} nos próximos 14 dias, qual seria sua prioridade nº 1?\nP4 (Objeção mapeada): O que mais te impede de começar hoje? (Opção A: Preço | Opção B: Medo de não funcionar | Opção C: Falta de tempo)`,
        },
        {
          title: "3. Tela de Conclusão + Ponte Direta para Grupo VIP / X1",
          tag: "Página de Obrigado",
          body: `✅ Diagnóstico Concluído! Seu perfil indica resposta acelerada ao protocolo ${productName}.\n\nClique abaixo para receber seu resultado detalhado no WhatsApp e liberar ${offerDetails}:`,
        },
      ];

    case "webinar":
      return [
        {
          title: "1. Página de Inscrição da Aula Magna / Webinar",
          tag: "Captação do Evento",
          body: `AULA EXCLUSIVA E GRATUITA:\n"Como Destravar o ${mechanismName} e Superar ${avatarPain} sem depender de métodos antiquados"\n\nO que você vai descobrir:\n• Segredo #1: O erro invisível que 9 em cada 10 pessoas cometem ao tentar resolver ${avatarPain}\n• Segredo #2: Como funciona o ${mechanismName} na prática\n• Segredo #3: O protocolo passo a passo com ${productName}`,
        },
        {
          title: "2. Régua de Show-Up no WhatsApp (Elevação de Comparecimento)",
          tag: "4 Disparos Pré-Aula",
          body: `• [Faltam 24h]: Amanhã às 20h vamos revelar ao vivo o mecanismo ${mechanismName}. Já ative o lembrete!\n• [Falta 1h]: Prepare papel e caneta! Vamos mostrar na tela como sair de ${avatarPain}.\n• [Faltam 15min]: Sala abrindo! Clique aqui para garantir seu lugar.\n• [Ao Vivo + 10min]: Já começamos e estamos mostrando o erro nº 1! Entre agora: [LINK]`,
        },
        {
          title: "3. Transição do Pitch + Sequência de Replay (48h)",
          tag: "Conversão Pós-Aula",
          body: `TRANSIÇÃO (Minuto 38): "Agora você tem 2 caminhos: tentar aplicar tudo sozinho por tentativa e erro, ou deixar o ${productName} fazer o trabalho pesado ativando seu ${mechanismName} com ${offerDetails}."\n\nREPLAY + QUEBRA DE OBJEÇÃO NO WHATSAPP:\n"${topObjectionAnswer}"`,
        },
      ];

    case "grupo_lancamento":
      return [
        {
          title: "1. Configuração do Grupo & Boas-Vindas (Grupo Silencioso)",
          tag: "Setup & Retenção",
          body: `NOME DO GRUPO: 🔥 VIP ${projectName} · Revelação ${mechanismName}\nMENSAGEM FIXADA: Bem-vindo(a)! Este grupo é 100% silencioso para você não perder os avisos oficiais. Na próxima aula vamos revelar como superar ${avatarPain} através do ${mechanismName}. Reaja com 🔥 abaixo para confirmar que você recebeu!`,
        },
        {
          title: "2. Cronograma de Aquecimento & Enquete de Dor",
          tag: "Seg a Qua",
          body: `• Dia 1 (Manhã): Mito vs. Verdade — Por que tudo que te falaram sobre ${avatarPain} estava incompleto.\n• Dia 2 (Tarde): Estudo de Caso real + foto/depoimento de quem ativou o ${mechanismName}.\n• Dia 3 (Noite - Enquete): "Qual dessas dificuldades mais te incomoda hoje?"\n  [ ] ${avatarPain}\n  [ ] Já tentei outros produtos sem sucesso\n  [ ] Quero entender como funciona o ${productName}`,
        },
        {
          title: "3. Dia D (Abertura de Carrinho) + Repescagem X1",
          tag: "6 Toques de Conversão",
          body: `• 08h00: Condição oficial revelada (${offerDetails})\n• 09h00: Link liberado exclusivamente no grupo!\n• 12h00: Quebra da maior dúvida recebida hoje (${topObjectionLabel}): ${topObjectionAnswer}\n• 18h00: Aviso de bônus esgotando\n• 21h30: Últimas 2 horas do lote\n• Dia Seguinte (09h - Repescagem X1): Abordagem individual no privado para todos que votaram na enquete mas não finalizaram o pedido.`,
        },
      ];

    case "grupo_relacionamento":
      return [
        {
          title: "1. Ritual Semanal de Nutrição (Sem Queimar a Base)",
          tag: "Segunda & Quarta",
          body: `SEGUNDA-FEIRA (Conteúdo Útil): "1 ajuste simples pela manhã que ajuda a reduzir ${avatarPain} antes mesmo do almoço."\n\nQUARTA-FEIRA (Bastidor & Prova): Print real de cliente relatando resultado com ${productName} + explicação rápida de 30s sobre o ${mechanismName}.`,
        },
        {
          title: "2. Enquete de Quinta-Feira (Levantada de Mão)",
          tag: "Filtro de Compradores",
          body: `ENQUETE NO GRUPO: "Se a gente liberasse amanhã apenas 15 kits de ${productName} com ${offerDetails}, qual seria o seu objetivo principal?"\n1️⃣ Começar meu protocolo de 90 dias (3 potes)\n2️⃣ Testar o protocolo inicial\n3️⃣ Tirar uma dúvida com especialista no privado`,
        },
        {
          title: "3. Janela Relâmpago de Sexta (24h) + Chamada Privada",
          tag: "Fechamento Semanal",
          body: `MENSAGEM PRIVADA PARA QUEM VOTOU NA ENQUETE:\n"Oi [Nome]! Vi que você votou lá no nosso Grupo VIP da ${projectName} sobre resolver ${avatarPain}. Como você está no grupo, separei seu link com a condição especial (${offerDetails}).\n\nInclusive, sobre a dúvida que muita gente tem (${topObjectionQuote}): ${topObjectionAnswer}"`,
        },
      ];

    case "x1_closer":
    default:
      return [
        {
          title: "1. Abertura Espelhada + Diagnóstico Rápido (2 Perguntas)",
          tag: "Primeiros 2 Minutos",
          body: `ABERTURA: "Oi [Nome], tudo bem? Aqui é do time oficial do ${productName}! Vi que você veio pelo nosso conteúdo sobre ${mechanismName}. Me conta rapidinho: há quanto tempo você vem sentindo ${avatarPain}?"\n\nPERGUNTA 2 (Implicação): "E você já chegou a tentar algum outro método antes ou seria sua primeira vez atuando direto no ${mechanismName}?"`,
        },
        {
          title: "2. Ponte do Mecanismo + Ancoragem do Kit Recomendado",
          tag: "Pitch Consultivo",
          body: `"Perfeito, [Nome]! Pelo que você me descreveu, o motivo de ainda sentir ${avatarPain} é que o seu ${mechanismName} precisa ser reativado de forma contínua.\n\nPor isso nossa recomendação nº 1 para o seu caso é o protocolo com ${offerDetails}. Vou te mandar o link oficial com seguro de entrega e 30 dias de garantia:"`,
        },
        {
          title: "3. Script Quebra-Objeção + Recuperação em 3 Toques",
          tag: "Fechamento & Follow-up",
          body: `🛡️ SE O LEAD RECLAMAR DE ${topObjectionLabel.toUpperCase()}:\nLead diz: "${topObjectionQuote}"\nVocê responde: "${topObjectionAnswer}"\n\n⏱️ FOLLOW-UP DE RECUPERAÇÃO:\n• +15 min (Pix gerado): "[Nome], seu código Pix do ${productName} já está ativo! Assim que confirmar já libero seu rastreio prioritário."\n• +2h: "Separamos sua caixa no centro de distribuição, consegue finalizar hoje para sair na coleta da manhã?"\n• +24h: "Última tentativa antes do sistema cancelar a reserva do seu lote com desconto!"`,
        },
      ];
  }
}

export function AgencyFrontsFactory({ initialFront }: { initialFront?: AgencyFrontType }) {
  const navigate = useNavigate();
  const [selectedFrontId, setSelectedFrontId] = useState<AgencyFrontType>(initialFront ?? "advertorial");
  const [projectsList, setProjectsList] = useState<Array<{ id: string; name: string; icon: string | null }>>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [intel, setIntel] = useState<ProjectIntelligenceBundle | null>(null);
  const [projectName, setProjectName] = useState("Império Direct");
  const [productName, setProductName] = useState("LinfaFlow");
  const [avatarPain, setAvatarPain] = useState("inchaço persistente, retenção e cansaço ao acordar");
  const [mechanismName, setMechanismName] = useState("Desbloqueio Linfático Sublingual");
  const [offerDetails, setOfferDetails] = useState("Kit 3 Potes por 12x R$ 29,82 + Frete Grátis + Garantia 30 Dias");
  const [leadSignals, setLeadSignals] = useState<LeadSignalInput[]>([]);
  const [selectedComplaintIdx, setSelectedComplaintIdx] = useState(0);
  const [aiCustomOutput, setAiCustomOutput] = useState<string | null>(null);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [savingSite, setSavingSite] = useState(false);
  const [promotingWinner, setPromotingWinner] = useState(false);
  const [outputViewMode, setOutputViewMode] = useState<"copy" | "page">("copy");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  // 1. Load project list & WhatsApp signals on mount
  useEffect(() => {
    let cancelled = false;
    async function loadContext() {
      try {
        const projRes = await supabase
          .from("imphq_projects")
          .select("id, name, icon, description")
          .or("is_archived.eq.false,is_archived.is.null")
          .order("name", { ascending: true });

        if (!cancelled && !projRes.error && Array.isArray(projRes.data) && projRes.data.length > 0) {
          setProjectsList(projRes.data.map((p) => ({ id: p.id, name: p.name, icon: p.icon })));
          const first = projRes.data[0];
          setActiveProjectId(first.id);
        }

        const waRes = await supabase
          .from("imphq_wa_conversations")
          .select("*")
          .order("updated_at", { ascending: false })
          .limit(40);

        if (!cancelled && !waRes.error && Array.isArray(waRes.data)) {
          const sigs: LeadSignalInput[] = [];
          for (const raw of waRes.data) {
            const r = raw as Record<string, unknown>;
            const lastMsg =
              (typeof r.last_message_text === "string" && r.last_message_text) ||
              (typeof r.ultimo_texto === "string" && r.ultimo_texto) ||
              "";
            const summary =
              (typeof r.ai_summary === "string" && r.ai_summary) ||
              (typeof r.resumo_ia === "string" && r.resumo_ia) ||
              "";
            if (lastMsg) sigs.push({ text: lastMsg, source: "whatsapp" });
            if (summary) sigs.push({ text: summary, source: "whatsapp" });
          }
          setLeadSignals(sigs);
        }
      } catch {
        // Ignore in offline/test environments
      }
    }
    loadContext();
    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Whenever activeProjectId changes, load full Project + Avatar + Docs + Skills + Sites intelligence
  useEffect(() => {
    let cancelled = false;
    if (!activeProjectId) return;
    loadProjectIntelligence(activeProjectId).then((bundle) => {
      if (cancelled || !bundle) return;
      setIntel(bundle);
      setProjectName(bundle.projectName);
      setProductName(bundle.products[0]?.name || bundle.projectName);
      setMechanismName(bundle.mechanismName);
      setAvatarPain(bundle.deepPains[0] || bundle.projectDescription || "dor persistente sem solução definitiva");
      setOfferDetails(bundle.offerSummary);
      setAiCustomOutput(null);
    });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  const combinedSignals = useMemo(() => {
    if (!intel) return leadSignals;
    const avatarSigs: LeadSignalInput[] = [
      ...intel.deepPains.map((p) => ({ text: p, source: "crm" as const, contactName: intel.avatarName })),
      ...intel.objections.map((o) => ({ text: o.objecao, source: "whatsapp" as const, contactName: intel.avatarName })),
    ];
    return [...avatarSigs, ...leadSignals];
  }, [intel, leadSignals]);

  const complaints = useMemo(() => extractLeadComplaints(combinedSignals), [combinedSignals]);
  const selectedComplaint = complaints[selectedComplaintIdx] ?? complaints[0];
  const selectedFront = useMemo(
    () => AGENCY_FRONTS.find((f) => f.id === selectedFrontId) ?? AGENCY_FRONTS[0],
    [selectedFrontId]
  );

  const sections = useMemo(
    () =>
      buildDeterministicBlueprint({
        front: selectedFront,
        projectName,
        productName,
        avatarPain,
        mechanismName,
        offerDetails,
        topObjectionLabel: selectedComplaint?.label ?? "Ceticismo",
        topObjectionQuote:
          intel?.objections[0]?.objecao ?? selectedComplaint?.sampleQuotes[0] ?? "Será que funciona mesmo?",
        topObjectionAnswer:
          intel?.objections[0]?.resposta ?? selectedComplaint?.x1Script ?? "Garantia total de 30 dias.",
      }),
    [selectedFront, projectName, productName, avatarPain, mechanismName, offerDetails, selectedComplaint, intel]
  );

  const fullText = useMemo(() => {
    if (aiCustomOutput) return aiCustomOutput;
    const intelHeader = intel
      ? [
          `• Avatar Conectado: ${intel.avatarName} (${intel.avatarAgeRange})`,
          `• Inimigo Comum: ${intel.enemy}`,
          `• Gatilho Nuclear: ${intel.nuclearTrigger}`,
          `• Documentos Lidos: ${intel.docs.map((d) => d.title).join(" · ") || "Dossiê do Projeto"}`,
          `• Skills Aplicadas: ${intel.skills.map((s) => s.name).join(" · ")}`,
        ]
      : [];
    return [
      `# ${selectedFront.label.toUpperCase()} — ${productName.toUpperCase()} (${projectName})`,
      `• Dor Central: ${avatarPain}`,
      `• Mecanismo Único: ${mechanismName}`,
      `• Oferta & Ancoragem: ${offerDetails}`,
      `• Objeção Neutralizada: ${selectedComplaint?.label}`,
      ...intelHeader,
      "",
      ...sections.map((s) => `## ${s.title} [${s.tag}]\n${s.body}`),
    ].join("\n\n");
  }, [aiCustomOutput, selectedFront, productName, projectName, avatarPain, mechanismName, offerDetails, selectedComplaint, sections, intel]);

  const livePageHtml = useMemo(() => {
    const esc = (str: string) =>
      String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const specialHeroVisual =
      selectedFront.id === "pdp_dtc"
        ? `<div class="kits-grid">
            <div class="kit-card">
              <span class="kit-badge">Experimentação · 30 Dias</span>
              <h3>1 Unidade · ${esc(productName)}</h3>
              <p class="kit-price">R$ 197 <span>à vista ou 12x R$ 19,78</span></p>
              <a href="#checkout" class="cta-btn secondary">Escolher 1 Pote</a>
            </div>
            <div class="kit-card featured">
              <span class="kit-badge gold">🔥 MAIS ESCOLHIDO · 90 Dias</span>
              <h3>Kit 3 Unidades · ${esc(productName)}</h3>
              <p class="kit-price">${esc(offerDetails)}</p>
              <p class="kit-sub">Protocolo completo de ativação do ${esc(mechanismName)} + Frete Grátis</p>
              <a href="#checkout" class="cta-btn">QUERO O KIT DE 3 POTES →</a>
            </div>
            <div class="kit-card">
              <span class="kit-badge">Máximo Resultado · 150 Dias</span>
              <h3>Kit 5 Unidades · ${esc(productName)}</h3>
              <p class="kit-price">Maior Desconto + Frete VIP</p>
              <a href="#checkout" class="cta-btn secondary">Escolher 5 Potes</a>
            </div>
          </div>`
        : selectedFront.id === "advertorial"
        ? `<div class="editorial-bar">
            <span>PORTAL SAÚDE &amp; CIÊNCIA INVESTIGATIVA</span>
            <span>Leitura: 3 min · Atualizado Hoje</span>
          </div>`
        : selectedFront.id === "captura_quiz"
        ? `<div class="quiz-box">
            <div class="quiz-progress"><div class="quiz-fill"></div></div>
            <p class="quiz-q">Pergunta 1 de 4: Em qual momento você mais sente <strong>${esc(avatarPain)}</strong>?</p>
            <div class="quiz-opts">
              <button type="button" class="quiz-opt">1. Logo ao acordar / durante a manhã</button>
              <button type="button" class="quiz-opt">2. No final da tarde e à noite</button>
              <button type="button" class="quiz-opt">3. O dia inteiro, mesmo tentando controlar</button>
            </div>
          </div>`
        : `<div class="vsl-player">
            <div class="play-circle">▶</div>
            <p class="vsl-caption">🔊 Apresentação Oficial: Como o <strong>${esc(mechanismName)}</strong> atua na causa-raiz de ${esc(avatarPain)}</p>
          </div>`;

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(productName)} — ${esc(selectedFront.label)}</title>
  <style>
    :root { --bg: #090b10; --card: #121622; --accent: #10b981; --gold: #f59e0b; --text: #f3f4f6; --muted: #9ca3af; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: radial-gradient(circle at top, #151b2d 0%, var(--bg) 60%); color: var(--text); line-height: 1.65; padding: 28px 16px 48px; }
    .container { max-width: 820px; margin: 0 auto; display: flex; flex-direction: column; gap: 22px; }
    .editorial-bar { display: flex; justify-content: space-between; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gold); border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; }
    .hero { text-align: center; padding: 12px 8px; }
    .kicker { display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; color: var(--gold); background: rgba(245,158,11,0.14); border: 1px solid rgba(245,158,11,0.35); padding: 5px 12px; border-radius: 999px; margin-bottom: 12px; }
    h1 { font-size: clamp(22px, 3.8vw, 34px); line-height: 1.22; color: #fff; font-weight: 800; margin-bottom: 10px; }
    .meta { font-size: 14px; color: var(--muted); max-width: 660px; margin: 0 auto; }
    .vsl-player { background: linear-gradient(145deg, #0f131f, #1a2136); border: 1px solid rgba(245,158,11,0.35); border-radius: 18px; min-height: 240px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 28px; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.45); }
    .play-circle { width: 64px; height: 64px; border-radius: 999px; background: var(--gold); color: #090b10; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 900; margin-bottom: 14px; box-shadow: 0 0 30px rgba(245,158,11,0.5); }
    .vsl-caption { font-size: 13px; color: #e5e7eb; max-width: 520px; }
    .kits-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; }
    .kit-card { background: var(--card); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 18px; display: flex; flex-direction: column; gap: 10px; text-align: center; }
    .kit-card.featured { border: 2px solid var(--gold); background: linear-gradient(180deg, rgba(245,158,11,0.12), var(--card)); transform: translateY(-2px); }
    .kit-badge { font-size: 10px; text-transform: uppercase; font-weight: 700; color: var(--muted); }
    .kit-badge.gold { color: var(--gold); }
    .kit-price { font-size: 15px; font-weight: 800; color: #fff; }
    .kit-sub { font-size: 12px; color: var(--muted); }
    .quiz-box { background: var(--card); border: 1px solid rgba(16,185,129,0.35); border-radius: 16px; padding: 22px; }
    .quiz-progress { height: 6px; background: rgba(255,255,255,0.08); border-radius: 999px; margin-bottom: 14px; overflow: hidden; }
    .quiz-fill { width: 35%; height: 100%; background: var(--accent); }
    .quiz-q { font-size: 15px; margin-bottom: 14px; color: #fff; }
    .quiz-opts { display: flex; flex-direction: column; gap: 8px; }
    .quiz-opt { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12); color: #fff; padding: 12px 14px; border-radius: 10px; text-align: left; font-size: 13px; cursor: pointer; }
    .section { background: var(--card); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 22px; }
    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; gap: 8px; flex-wrap: wrap; }
    .section-title { font-size: 15px; font-weight: 700; color: var(--accent); }
    .section-tag { font-size: 11px; background: rgba(255,255,255,0.06); padding: 2px 8px; border-radius: 6px; color: var(--muted); }
    .section-body { white-space: pre-line; font-size: 14px; color: #e5e7eb; }
    .cta-btn { display: block; width: 100%; text-align: center; background: var(--accent); color: #04130d; font-weight: 800; font-size: 15px; padding: 15px 22px; border-radius: 12px; text-decoration: none; margin-top: 6px; box-shadow: 0 10px 25px rgba(16,185,129,0.25); }
    .cta-btn.secondary { background: rgba(255,255,255,0.08); color: #fff; box-shadow: none; font-size: 13px; padding: 11px 16px; }
  </style>
</head>
<body>
  <div class="container">
    <header class="hero">
      <span class="kicker">${esc(selectedFront.shortTag)} · ${esc(projectName)}</span>
      <h1>${esc(productName)}: O Protocolo com ${esc(mechanismName)} contra ${esc(avatarPain)}</h1>
      <p class="meta">Condição Especial Ativa: ${esc(offerDetails)}</p>
    </header>
    ${specialHeroVisual}
    ${sections
      .map(
        (s) => `<section class="section">
      <div class="section-header">
        <span class="section-title">${esc(s.title)}</span>
        <span class="section-tag">${esc(s.tag)}</span>
      </div>
      <div class="section-body">${esc(s.body)}</div>
    </section>`
      )
      .join("\n")}
    <a href="#checkout" class="cta-btn">GARANTIR ${esc(productName.toUpperCase())} COM GARANTIA BLINDADA DE 30 DIAS →</a>
  </div>
</body>
</html>`;
  }, [selectedFront, productName, projectName, mechanismName, avatarPain, offerDetails, sections]);

  const handleRefineWithAi = async () => {
    setGeneratingAi(true);
    try {
      const intentMap: Record<AgencyFrontType, string> = {
        advertorial: "weaponized_credibility",
        pdp_dtc: "weaponized_credibility",
        lp_vsl: "vsl_imperador",
        captura_quiz: "criativo_imperador",
        webinar: "vsl_imperador",
        grupo_lancamento: "conversa_imperador",
        grupo_relacionamento: "conversa_imperador",
        x1_closer: "conversa_imperador",
      };

      const { data, error } = await supabase.functions.invoke("copy-engine", {
        body: {
          intent: intentMap[selectedFront.id] ?? "criativo_imperador",
          input: `Você é o Diretor de Copywriting de Resposta Direta da agência Império. Expanda e escreva a copy completa e pronta para conversão da frente "${selectedFront.label}" para o produto "${productName}" (Projeto: ${projectName}).\n\nAvatar: ${intel?.avatarName || "Cliente Ideal"}\nDor do avatar: ${avatarPain}\nInimigo Comum: ${intel?.enemy || "Soluções paliativas"}\nGatilho Nuclear: ${intel?.nuclearTrigger || ""}\nMecanismo Único: ${mechanismName}\nOferta: ${offerDetails}\nDocumentos lidos: ${intel?.docs.map((d) => `${d.title}: ${d.excerpt}`).join(" | ") || ""}\nSkills aplicadas: ${intel?.skills.map((s) => s.name).join(", ") || ""}\nObjeção real dos leads que precisa ser esmagada na copy: "${selectedComplaint?.sampleQuotes[0]}" (${selectedComplaint?.label}).\n\nUse como base estrutural:\n${fullText}`,
          context: activeProjectId ? { project_id: activeProjectId } : undefined,
        },
      });
      if (error) throw error;
      const resultText = data?.content || data?.result || data?.text;
      if (resultText && typeof resultText === "string") {
        setAiCustomOutput(resultText);
        toast.success("Copy expandida pelo motor de IA com Avatar + Documentos + Skills!");
      } else {
        toast.info("Blueprint estruturado mantido (sem retorno adicional da IA).");
      }
    } catch {
      toast.info("Usando o Blueprint determinístico de alta conversão conectado ao projeto.");
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleDownloadHtml = () => {
    const blob = new Blob([livePageHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedFront.id}-${productName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Página HTML pronta baixada!");
  };

  const handlePromoteFrontAsControl = async () => {
    setPromotingWinner(true);
    try {
      const res = await promoteWinnerToProjectControl({
        projectId: activeProjectId,
        projectName,
        kind: "pagina",
        title: `${selectedFront.shortTag} · ${productName} (${mechanismName})`,
        angle: avatarPain,
        format: selectedFront.label,
        content: fullText,
      });
      if (res.ok) {
        toast.success(`🏆 "${selectedFront.shortTag}" salvo como Controle Vencedor na memória do projeto!`);
      } else {
        toast.error("Não foi possível salvar no banco agora, mas a estrutura segue ativa.");
      }
    } finally {
      setPromotingWinner(false);
    }
  };

  const handleSaveToSites = async () => {
    setSavingSite(true);
    try {
      const pageTypeMap: Record<AgencyFrontType, string> = {
        advertorial: "advertorial",
        pdp_dtc: "pdp",
        lp_vsl: "vsl",
        captura_quiz: "captura",
        webinar: "webinar",
        grupo_lancamento: "captura",
        grupo_relacionamento: "comunidade",
        x1_closer: "whatsapp",
      };

      const slug = `${selectedFront.id}-${productName}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");

      // URL única por blueprint: imphq_sites tem UNIQUE (user_id, url) e não deve sobrescrever a página real do projeto
      const siteUrl = `https://blueprint.imperio.hq/${slug}-${Date.now().toString(36)}`;
      const tipo = pageTypeMap[selectedFront.id] ?? "vsl";

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const { data: savedSite, error } = await supabase
        .from("imphq_sites")
        .insert({
          user_id: userData.user.id,
          titulo: `[${selectedFront.shortTag}] ${productName} — ${mechanismName.slice(0, 32)}`,
          url: siteUrl,
          tipo,
          status: "ativo",
          tags: ["nossos", tipo, selectedFront.id === "x1_closer" ? "retencao" : "conversao"],
          content_md: fullText,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (activeProjectId) {
        await supabase.from("imphq_project_sites").insert({
          user_id: userData.user.id,
          projeto_id: activeProjectId,
          site_id: savedSite.id,
          papel: tipo,
        });
      }

      toast.success(`Frente "${selectedFront.shortTag}" salva no catálogo de Sites & Ecossistemas do projeto!`);
    } catch {
      navigator.clipboard?.writeText(fullText);
      toast.success("Blueprint copiado para a área de transferência!");
    } finally {
      setSavingSite(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Front Selector Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {AGENCY_FRONTS.map((front) => {
          const Icon = front.icon;
          const active = front.id === selectedFrontId;
          return (
            <button
              key={front.id}
              type="button"
              onClick={() => {
                setSelectedFrontId(front.id);
                setAiCustomOutput(null);
              }}
              className={`text-left rounded-xl border p-3 transition-all flex flex-col justify-between gap-2 ${
                active
                  ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                  {front.shortTag}
                </span>
                {active && (
                  <Badge className="text-[9px] h-4 px-1.5">Ativa</Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-2">
                {front.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Connected Intelligence Summary + Visual Thumbnails */}
      {intel && (
        <div className="rounded-xl border border-primary/25 bg-gradient-to-r from-primary/10 via-card to-card p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="font-bold text-primary flex items-center gap-1">
                <Brain className="h-3.5 w-3.5" /> Inteligência Lida do Projeto:
              </span>
              <Badge variant="outline" className="text-[10px] border-primary/40 text-foreground">
                {intel.projectIcon} {intel.projectName}
              </Badge>
              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-300">
                <UserCheck className="h-3 w-3 mr-1" /> Avatar: {intel.avatarName}
              </Badge>
              <Badge variant="outline" className="text-[10px] border-cyan-500/30 text-cyan-300">
                <FileText className="h-3 w-3 mr-1" /> {intel.docs.length} Docs
              </Badge>
              <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-300">
                <Cpu className="h-3 w-3 mr-1" /> {intel.skills.length} Skills
              </Badge>
              {intel.winningControls.length > 0 && (
                <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-300">
                  <Trophy className="h-3 w-3 mr-1" /> {intel.winningControls.length} Controle(s) Ativo(s)
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              <strong>Inimigo:</strong> {intel.enemy} · <strong>Gatilho Nuclear:</strong> {intel.nuclearTrigger}
            </p>
          </div>

          {intel.sites.length > 0 && (
            <div className="flex items-center gap-2">
              {intel.sites.slice(0, 2).map((site) => (
                <div
                  key={site.id || site.url}
                  className="w-28 rounded-lg overflow-hidden border border-border/70 bg-background/60 shrink-0"
                  title={`${site.titulo} (${site.url})`}
                >
                  <SiteThumbnail site={site} aspect="aspect-[16/9]" showBrowserBar={false} />
                  <div className="px-1.5 py-0.5 text-[9px] font-medium truncate text-muted-foreground">
                    {site.titulo}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Configuration + Live VOC Injection */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 rounded-xl border border-border bg-card p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5" />
              Motor da Frente · Contexto &amp; Objeção Real
            </h3>
            <Badge variant="outline" className="text-[10px]">
              {selectedFront.shortTag}
            </Badge>
          </div>

          {projectsList.length > 0 && (
            <div className="space-y-1">
              <Label className="text-[11px] text-primary font-semibold">
                Selecionar Projeto (Carrega Avatar + Docs + Skills + Páginas)
              </Label>
              <select
                aria-label="Selecionar Projeto da Agência"
                value={activeProjectId ?? ""}
                onChange={(e) => setActiveProjectId(e.target.value)}
                className="w-full h-8 rounded-md border border-primary/40 bg-background px-2.5 text-xs font-medium text-foreground"
              >
                {projectsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {normalizeProjectIcon(p.icon)} {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-[11px]">Projeto / Marca</Label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Produto Principal</Label>
              <Input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px]">Mecanismo Único (Como resolve a causa-raiz)</Label>
            <Input
              value={mechanismName}
              onChange={(e) => setMechanismName(e.target.value)}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px]">Dor Visceral / Sintoma Diário do Avatar</Label>
            <Input
              value={avatarPain}
              onChange={(e) => setAvatarPain(e.target.value)}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px]">Oferta, Kits &amp; Garantia</Label>
            <Input
              value={offerDetails}
              onChange={(e) => setOfferDetails(e.target.value)}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1.5 pt-1 border-t border-border/60">
            <Label className="text-[11px] flex items-center justify-between">
              <span>🗣️ Reclamação / Objeção do Lead a Neutralizar:</span>
              <span className="text-[10px] text-muted-foreground">Do Radar VOC + Avatar</span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {complaints.slice(0, 5).map((c, idx) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedComplaintIdx(idx);
                    setAiCustomOutput(null);
                  }}
                  className={`px-2 py-1 rounded-md text-[11px] border transition-colors ${
                    selectedComplaintIdx === idx
                      ? "border-primary bg-primary/15 text-primary font-semibold"
                      : "border-border bg-background/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c.label.split("/")[0]} ({c.sharePct}%)
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-muted/30 border border-border/60 p-2.5 space-y-1">
            <p className="text-[10px] font-mono uppercase text-muted-foreground">
              Entregáveis obrigatórios desta frente:
            </p>
            <ul className="space-y-1">
              {selectedFront.deliverables.map((d) => (
                <li key={d} className="text-[11px] text-foreground/90 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Generated Blueprint, Live Visual HTML Page Preview & Copy Output */}
        <div className="lg:col-span-7 rounded-xl border border-border bg-card p-4 flex flex-col justify-between space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border/60">
            <div>
              <h3 className="text-sm font-bold text-foreground">
                {selectedFront.label}
              </h3>
              <p className="text-xs text-muted-foreground">
                Conectado ao mecanismo <strong>{mechanismName}</strong>
                {intel ? ` · Avatar ${intel.avatarName}` : ""} e blindado contra{" "}
                <strong>{selectedComplaint?.label}</strong>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Alternador Copy vs Preview Visual de Página */}
              <div className="inline-flex rounded-lg border border-border bg-background p-0.5">
                <button
                  type="button"
                  onClick={() => setOutputViewMode("copy")}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    outputViewMode === "copy"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  📄 Copy &amp; Blocos
                </button>
                <button
                  type="button"
                  onClick={() => setOutputViewMode("page")}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors flex items-center gap-1 ${
                    outputViewMode === "page"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Eye className="h-3 w-3" />
                  🖥️ Página Visual (HTML Live)
                </button>
              </div>

              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => {
                  navigator.clipboard?.writeText(fullText);
                  toast.success("Estrutura completa copiada!");
                }}
              >
                <Copy className="h-3.5 w-3.5 mr-1" />
                Copiar Tudo
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={handleDownloadHtml}
                title="Baixar arquivo HTML estilizado pronto para publicar"
              >
                <Globe className="h-3.5 w-3.5 mr-1" />
                Baixar HTML
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                onClick={handlePromoteFrontAsControl}
                disabled={promotingWinner}
                title="Salvar como Controle Vencedor na memória do projeto"
              >
                {promotingWinner ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Trophy className="h-3.5 w-3.5 mr-1 text-amber-400" />
                )}
                Marcar Vencedor
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={handleSaveToSites}
                disabled={savingSite}
              >
                {savingSite ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <FileCode2 className="h-3.5 w-3.5 mr-1" />
                )}
                Salvar em Sites/LPs
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => {
                  const params = new URLSearchParams({ briefing: fullText });
                  navigate(`/copy-lab?${params.toString()}`);
                }}
              >
                <Wand2 className="h-3.5 w-3.5 mr-1" />
                Abrir no Copy Lab
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={handleRefineWithAi}
                disabled={generatingAi}
              >
                {generatingAi ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                )}
                Expandir com IA
              </Button>
            </div>
          </div>

          {outputViewMode === "page" ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-secondary/30 px-3 py-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-semibold text-foreground">
                    Renderização Visual Real da Página ({selectedFront.shortTag})
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("desktop")}
                    className={`rounded p-1 transition-colors ${
                      previewDevice === "desktop" ? "bg-primary/20 text-primary" : "text-muted-foreground"
                    }`}
                    title="Desktop"
                  >
                    <Monitor className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("mobile")}
                    className={`rounded p-1 transition-colors ${
                      previewDevice === "mobile" ? "bg-primary/20 text-primary" : "text-muted-foreground"
                    }`}
                    title="Mobile"
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-[#090b10] p-3">
                <div
                  className={`mx-auto overflow-hidden rounded-lg border border-white/10 shadow-xl transition-all ${
                    previewDevice === "mobile" ? "max-w-[375px]" : "w-full"
                  }`}
                >
                  <iframe
                    title={`Preview Visual — ${selectedFront.label}`}
                    srcDoc={livePageHtml}
                    className="h-[500px] w-full border-0 bg-[#090b10]"
                    sandbox="allow-same-origin"
                  />
                </div>
              </div>
            </div>
          ) : aiCustomOutput ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge className="text-[10px]">Versão Expandida pela IA</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[11px]"
                  onClick={() => setAiCustomOutput(null)}
                >
                  Voltar aos blocos estruturados
                </Button>
              </div>
              <Textarea
                value={aiCustomOutput}
                onChange={(e) => setAiCustomOutput(e.target.value)}
                rows={16}
                className="font-mono text-xs"
              />
            </div>
          ) : (
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {sections.map((sec) => (
                <div
                  key={sec.title}
                  className="rounded-lg border border-border/80 bg-background/60 p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-foreground">{sec.title}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {sec.tag}
                    </Badge>
                  </div>
                  <p className="text-xs text-foreground/90 whitespace-pre-line leading-relaxed">
                    {sec.body}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { extractLeadComplaints, type LeadSignalInput } from "@/lib/agency-radar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  BookOpen,
  CheckCircle2,
  Copy,
  FileCode2,
  Flame,
  Globe,
  Layers,
  Loader2,
  MessageCircle,
  Radio,
  Rocket,
  ShoppingBag,
  Sparkles,
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
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadContext() {
      try {
        const projRes = await supabase
          .from("imphq_projects")
          .select("id, name, description")
          .or("is_archived.eq.false,is_archived.is.null")
          .order("updated_at", { ascending: false })
          .limit(1);

        if (!cancelled && !projRes.error && projRes.data && projRes.data[0]) {
          const p = projRes.data[0];
          setActiveProjectId(p.id);
          setProjectName(p.name);
          setProductName(p.name);
          if (p.description && p.description.trim()) {
            setAvatarPain(p.description.trim());
          }
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

  const complaints = useMemo(() => extractLeadComplaints(leadSignals), [leadSignals]);
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
        topObjectionQuote: selectedComplaint?.sampleQuotes[0] ?? "Será que funciona mesmo?",
        topObjectionAnswer: selectedComplaint?.x1Script ?? "Garantia total de 30 dias.",
      }),
    [selectedFront, projectName, productName, avatarPain, mechanismName, offerDetails, selectedComplaint]
  );

  const fullText = useMemo(() => {
    if (aiCustomOutput) return aiCustomOutput;
    return [
      `# ${selectedFront.label.toUpperCase()} — ${productName.toUpperCase()} (${projectName})`,
      `• Dor Central: ${avatarPain}`,
      `• Mecanismo Único: ${mechanismName}`,
      `• Oferta & Ancoragem: ${offerDetails}`,
      `• Objeção Neutralizada: ${selectedComplaint?.label}`,
      "",
      ...sections.map((s) => `## ${s.title} [${s.tag}]\n${s.body}`),
    ].join("\n\n");
  }, [aiCustomOutput, selectedFront, productName, projectName, avatarPain, mechanismName, offerDetails, selectedComplaint, sections]);

  const handleRefineWithAi = async () => {
    setGeneratingAi(true);
    try {
      const { data, error } = await supabase.functions.invoke("openflow-ai", {
        body: {
          action: "quick_generate",
          prompt: `Você é o Diretor de Copywriting de Resposta Direta da agência Império. Expanda e escreva a copy completa e pronta para conversão da frente "${selectedFront.label}" para o produto "${productName}" (Projeto: ${projectName}).\n\nDor do avatar: ${avatarPain}\nMecanismo Único: ${mechanismName}\nOferta: ${offerDetails}\nObjeção real dos leads que precisa ser esmagada na copy: "${selectedComplaint?.sampleQuotes[0]}" (${selectedComplaint?.label}).\n\nUse como base estrutural:\n${fullText}`,
        },
      });
      if (error) throw error;
      const resultText = data?.result || data?.text || data?.content;
      if (resultText && typeof resultText === "string") {
        setAiCustomOutput(resultText);
        toast.success("Copy expandida pela IA com sucesso!");
      } else {
        toast.info("Blueprint estruturado mantido (sem retorno adicional da IA).");
      }
    } catch {
      toast.info("Usando o Blueprint determinístico de alta conversão (IA offline no momento).");
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleSaveToSites = async () => {
    setSavingSite(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) throw new Error("Usuário não autenticado");

      const tipoMap: Record<AgencyFrontType, string> = {
        advertorial: "advertorial",
        pdp_dtc: "pdp",
        lp_vsl: "vsl",
        captura_quiz: "captura",
        webinar: "lp",
        grupo_lancamento: "captura",
        grupo_relacionamento: "captura",
        x1_closer: "outro",
      };

      const slug = `${selectedFront.id}-${productName}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");

      const { error } = await supabase.from("imphq_sites").insert({
        user_id: userId,
        titulo: `[${selectedFront.shortTag}] ${productName} — ${mechanismName.slice(0, 32)}`,
        url: `https://blueprint.imperio.hq/${slug}`,
        tipo: tipoMap[selectedFront.id] ?? "lp",
        status: "ativo",
        content_md: fullText,
        summary: `${selectedFront.label} · Mecanismo: ${mechanismName} · Oferta: ${offerDetails}`,
        tags: [selectedFront.shortTag.toLowerCase(), productName.toLowerCase()],
      });
      if (error) throw error;
      toast.success(`Frente "${selectedFront.shortTag}" salva no catálogo de Sites & Ecossistemas!`);
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

      {/* Configuration + Live VOC Injection */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 rounded-xl border border-border bg-card p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5" />
              Motor da Frente · Contexto & Objeção Real
            </h3>
            <Badge variant="outline" className="text-[10px]">
              {selectedFront.shortTag}
            </Badge>
          </div>

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
            <Label className="text-[11px]">Oferta, Kits & Garantia</Label>
            <Input
              value={offerDetails}
              onChange={(e) => setOfferDetails(e.target.value)}
              className="h-8 text-xs"
            />
          </div>

          <div className="space-y-1.5 pt-1 border-t border-border/60">
            <Label className="text-[11px] flex items-center justify-between">
              <span>🗣️ Reclamação / Objeção do Lead a Neutralizar:</span>
              <span className="text-[10px] text-muted-foreground">Do Radar VOC</span>
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

        {/* Generated Blueprint & Copy Output */}
        <div className="lg:col-span-7 rounded-xl border border-border bg-card p-4 flex flex-col justify-between space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border/60">
            <div>
              <h3 className="text-sm font-bold text-foreground">
                {selectedFront.label}
              </h3>
              <p className="text-xs text-muted-foreground">
                Conectado ao mecanismo <strong>{mechanismName}</strong> e blindado contra{" "}
                <strong>{selectedComplaint?.label}</strong>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
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

          {aiCustomOutput ? (
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

import React, { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sparkles,
  Send,
  Loader2,
  Layers,
  ArrowRight,
  CheckCircle2,
  Compass,
  BookOpen,
  ShoppingBag,
  Video,
  MessageSquare,
  ShoppingCart,
  Zap,
  Flame,
  CheckSquare,
  ExternalLink,
  Plus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { searchBookmapNodes, type BookmapNode } from "@/lib/bookmaps-rag";
import { useNavigate } from "react-router-dom";

export interface FunnelBlueprint {
  nome: string;
  tipo: string;
  categoria: string;
  referenciaLivro: string;
  descricao: string;
  etapas: Array<{
    nome: string;
    tipo: string;
    subtitulo: string;
    oQueDeveTer: string[];
    pos_x: number;
    pos_y: number;
  }>;
  orderBumps: Array<{ nome: string; valorSugerido: string; objetivo: string }>;
  upsell: { nome: string; valorSugerido: string; pitch: string };
  reguaWhatsApp: Array<{ tempo: string; foco: string; mensagem: string }>;
  checklist: Array<{ titulo: string; categoria: string; prioridade: "high" | "med" }>;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  blueprint?: FunnelBlueprint;
  createdFunilId?: string;
  timestamp: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProjectId?: string | null;
  onFunnelCreated?: (funilId: string) => void;
}

const QUICK_STARTERS = [
  {
    icon: "💊",
    label: "Produto Físico / Encapsulado (DTC Nutra)",
    prompt: "Meu sócio quer testar um produto físico (encapsulado/nutra) com site novo. Como montar o funil, o que deve ter em cada etapa?",
  },
  {
    icon: "🎓",
    label: "Infoproduto / Curso / Comunidade",
    prompt: "Temos um site de curso/mentoria para testar. Como estruturar o fluxo de conversão completo e as ofertas de back-end?",
  },
  {
    icon: "💈",
    label: "Negócio Local / Salão / WhatsApp X1",
    prompt: "Vamos testar captação para um salão/serviço local levando para atendimento no WhatsApp. Como deve ser cada etapa?",
  },
  {
    icon: "🧪",
    label: "Quiz Interativo + VSL",
    prompt: "Queremos testar um funil de Quiz diagnóstico que entrega um resultado personalizado antes do pitch da VSL.",
  },
];

export function FunnelArchitectCopilot({
  open,
  onOpenChange,
  defaultProjectId,
  onFunnelCreated,
}: Props) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(defaultProjectId || "all");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [creatingFunnelId, setCreatingFunnelId] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>(() => {
    return [
      {
        id: "welcome",
        role: "assistant",
        content:
          "Olá! Sou o **Arquiteto de Funis IA**, calibrado com os princípios de **Russell Brunson** (*DotCom Secrets*) e **Alex Hormozi** (*$100M Leads*).\n\nQuando seu sócio ou você trouxerem um site novo ou ideia de produto para testar, **cole a URL ou descreva a oferta aqui**. Vou te entrevistar no que for essencial, montar a arquitetura completa de cada etapa (o que *DEVE* ter na página, checkout, bumps e WhatsApp) e criar o funil pronto no seu sistema com 1 clique.",
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      },
    ];
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadProjects() {
      const { data } = await supabase.from("imphq_projects").select("id, name").order("name");
      if (data) setProjects(data);
    }
    loadProjects();
  }, []);

  useEffect(() => {
    if (defaultProjectId) setSelectedProjectId(defaultProjectId);
  }, [defaultProjectId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const generateBlueprint = async (userPrompt: string): Promise<FunnelBlueprint> => {
    const lower = userPrompt.toLowerCase();
    
    // Consulta RAG em tempo real
    let ragTerm = "funnel";
    if (lower.includes("encapsulado") || lower.includes("fisico") || lower.includes("nutra") || lower.includes("suplemento")) {
      ragTerm = "Two-Step";
    } else if (lower.includes("curso") || lower.includes("mentoria") || lower.includes("infoproduto")) {
      ragTerm = "Video Sales Letter";
    } else if (lower.includes("quiz") || lower.includes("diagnostico")) {
      ragTerm = "Survey";
    } else if (lower.includes("whatsapp") || lower.includes("salao") || lower.includes("local") || lower.includes("serviço")) {
      ragTerm = "Lead";
    }

    const bookNodes = await searchBookmapNodes({ query: ragTerm, limit: 3 });
    const citation = bookNodes.length > 0 
      ? `Baseado em: ${bookNodes[0].title} (${bookNodes[0].bookmap_id === "dotcom-secrets" ? "DotCom Secrets" : "$100M Leads"})`
      : "Baseado em: DotCom Secrets (Russell Brunson) & $100M Leads (Alex Hormozi)";

    // Se for Produto Físico / Encapsulado / Nutra / Cosmético
    if (lower.includes("encapsulado") || lower.includes("fisico") || lower.includes("nutra") || lower.includes("suplemento") || lower.includes("produto")) {
      return {
        nome: "Funil VSL + 2 Bumps + Upsell (DTC Direto)",
        tipo: "Perpétuo",
        categoria: "Produto Físico DTC",
        referenciaLivro: `${citation} · Funil 3: VSL & Two-Step Funnel`,
        descricao: "Arquitetura validada para produtos físicos de alta escala: Gancho forte no anúncio, VSL com mecanismo único do vilão + solução, checkout com 2 Order Bumps de impulso e One-Click Upsell de abastecimento.",
        etapas: [
          {
            nome: "Anúncios Meta/TikTok",
            tipo: "criativo",
            subtitulo: "Tráfego Frio & Retargeting",
            oQueDeveTer: [
              "Gancho visual e verbal nos primeiros 0-3 segundos (quebra de padrão).",
              "Apresentação do 'Vilão Oculto' (por que métodos tradicionais falharam).",
              "CTA direto para a descoberta da solução na página.",
            ],
            pos_x: 80,
            pos_y: 80,
          },
          {
            nome: "Página de Vendas com VSL",
            tipo: "vsl",
            subtitulo: "Front-end de Conversão",
            oQueDeveTer: [
              "Headline Eugene Schwartz nível 3 (Consciência do Problema).",
              "Player de VSL sem barra de controle com botão de compra com delay.",
              "Mecanismo Único de Ação (nome chiclete que explica a causa raiz).",
              "Empilhamento de provas sociais forenses (antes/depois, laudos).",
              "Tabela de kits (1, 3 e 6 potes/unidades) com ancoragem de valor.",
              "Garantia blindada de 90 dias com devolução integral.",
            ],
            pos_x: 360,
            pos_y: 80,
          },
          {
            nome: "Checkout Otimizado com 2 Bumps",
            tipo: "checkout",
            subtitulo: "Conversão de Pedido & AOV",
            oQueDeveTer: [
              "Timer de escassez (reserva de lote garantida por 15 minutos).",
              "Order Bump 1: Frete Prioritário + Seguro Anti-Extravio (R$ 19,90).",
              "Order Bump 2: Guia de Aceleração de Resultados em 14 Dias (R$ 29,90).",
              "Selos de segurança bancária e opções PIX com 5% off + Cartão em 12x.",
            ],
            pos_x: 640,
            pos_y: 80,
          },
          {
            nome: "One-Click Upsell (Pós-Checkout)",
            tipo: "upsell",
            subtitulo: "Maximização de LTV Imediato",
            oQueDeveTer: [
              "Vídeo curto de 90s parabenizando pela compra.",
              "Oferta lógica: 'Adicione mais 3 potes com 60% de desconto agora sem redigitar o cartão'.",
              "Botão de 1 clique 'Sim, adicionar ao meu pedido' e link discreto 'Não, obrigado'.",
            ],
            pos_x: 920,
            pos_y: 80,
          },
          {
            nome: "WhatsApp: Régua & Boas-Vindas",
            tipo: "whatsapp",
            subtitulo: "Retenção, Rastreio & Resgate",
            oQueDeveTer: [
              "Disparo imediato: confirmação de pedido e link de rastreamento.",
              "Régua de resgate: Pix gerado (aos 15min e 2h com chave copia-e-cola).",
              "Canal de suporte pós-venda humanizado com acompanhamento.",
            ],
            pos_x: 1200,
            pos_y: 80,
          },
        ],
        orderBumps: [
          { nome: "Frete Prioritário Blindado", valorSugerido: "R$ 19,90", objetivo: "Garante saída em 24h e seguro total" },
          { nome: "Guia Acelerador 14 Dias", valorSugerido: "R$ 29,90", objetivo: "Infoproduto de margem 100% que antecipa o efeito" },
        ],
        upsell: {
          nome: "Kit Suprimento Anual (3 Frascos Extras)",
          valorSugerido: "R$ 197,00 (60% OFF)",
          pitch: "Evite interrupção do tratamento quando os resultados começarem a aparecer.",
        },
        reguaWhatsApp: [
          { tempo: "Imediato", foco: "Pix Gerado", mensagem: "Olá! Segue sua chave Pix de reserva exclusiva com 5% de desconto..." },
          { tempo: "2 horas depois", foco: "Abandono de Carrinho", mensagem: "Notamos que seu pedido ficou pendente. Seu frasco extra ainda está reservado..." },
          { tempo: "D+1 pós-compra", foco: "Onboarding & Confiança", mensagem: "Seu pacote foi despachado! Aqui está o manual de boas-vindas..." },
        ],
        checklist: [
          { titulo: "Escrever Headline e Mecanismo da VSL", categoria: "Copy", prioridade: "high" },
          { titulo: "Gravar ou Renderizar VSL (12 a 18 minutos)", categoria: "Vídeo", prioridade: "high" },
          { titulo: "Configurar Order Bump 1 e 2 no Checkout", categoria: "Checkout", prioridade: "high" },
          { titulo: "Criar Página de One-Click Upsell", categoria: "Página", prioridade: "med" },
          { titulo: "Ativar Régua de WhatsApp no Hub Local / Evolution", categoria: "Atendimento", prioridade: "high" },
          { titulo: "Subir 3 Variações de Criativo no Meta Ads", categoria: "Mídia Paga", prioridade: "high" },
        ],
      };
    }

    // Se for Salão / Atendimento Local / Serviço WhatsApp
    if (lower.includes("salao") || lower.includes("local") || lower.includes("barbearia") || lower.includes("cabelo") || lower.includes("whatsapp")) {
      return {
        nome: "Funil Comment-to-DM & Agendamento WhatsApp (Local)",
        tipo: "Atendimento",
        categoria: "Negócio Local & Serviço",
        referenciaLivro: `${citation} · $100M Leads: 1-on-1 Outreach & Local Core Offers`,
        descricao: "Estratégia direta para conversão local: criativos de transformação no Instagram/Reels, qualificação rápida e agendamento direto pelo WhatsApp com o time de recepção.",
        etapas: [
          {
            nome: "Reels / Anúncios Locais",
            tipo: "instagram",
            subtitulo: "Raio de 5-10km",
            oQueDeveTer: [
              "Antes e depois impactante de clientes reais.",
              "Chamada local: 'Você de [Cidade] que quer [Resultado] sem [Dor]'.",
              "CTA: 'Comente CABELO ou clique no link para receber a tabela vip'.",
            ],
            pos_x: 80,
            pos_y: 80,
          },
          {
            nome: "Página de Apresentação / Cardápio",
            tipo: "pagina",
            subtitulo: "Portfólio & Autoridade",
            oQueDeveTer: [
              "Galeria de resultados e fotos reais do espaço/equipe.",
              "Vídeo de 60s do expert explicando o método exclusivo.",
              "Depoimentos em print de WhatsApp.",
              "Botão pulsante 'Consultar Horários Disponíveis'.",
            ],
            pos_x: 380,
            pos_y: 80,
          },
          {
            nome: "Triagem & Conversão no WhatsApp",
            tipo: "whatsapp",
            subtitulo: "Atendimento X1",
            oQueDeveTer: [
              "Mensagem automática de boas-vindas com pergunta de triagem.",
              "Script de SDR do salão para identificar o histórico do cliente.",
              "Fechamento com oferta especial de primeira visita.",
            ],
            pos_x: 680,
            pos_y: 80,
          },
          {
            nome: "Lembrete & Confirmação de Presença",
            tipo: "whatsapp",
            subtitulo: "Anti-No-Show",
            oQueDeveTer: [
              "Mensagem D-1: 'Seu horário está reservado para amanhã às 14h'.",
              "Instruções de localização, estacionamento e preparação.",
              "Confirmação com 1 clique (Sim / Reagendar).",
            ],
            pos_x: 980,
            pos_y: 80,
          },
        ],
        orderBumps: [
          { nome: "Tratamento Nutritivo Pré-Serviço", valorSugerido: "R$ 49,00", objetivo: "Upgrade imediato na cadeira" },
        ],
        upsell: {
          nome: "Plano Trimestral de Manutenção VIP",
          valorSugerido: "R$ 297,00",
          pitch: "Garante retorno com valor travado e prioridade de agenda nos sábados.",
        },
        reguaWhatsApp: [
          { tempo: "Imediato", foco: "Primeiro Contato", mensagem: "Olá! Que ótimo falar com você. Qual procedimento você gostaria de realizar hoje?" },
          { tempo: "D-1", foco: "Confirmação de Presença", mensagem: "Tudo pronto para o seu atendimento amanhã? Segue nosso endereço e localização..." },
          { tempo: "D+2 pós-serviço", foco: "Satisfação & Indicação", mensagem: "Como está sentindo seu cabelo hoje? Dá uma nota de 1 a 10..." },
        ],
        checklist: [
          { titulo: "Configurar Raio de Anúncio local no Gerenciador (5-10km)", categoria: "Mídia Paga", prioridade: "high" },
          { titulo: "Ajustar Script de Resposta no WhatsApp (Triagem Rápida)", categoria: "Atendimento", prioridade: "high" },
          { titulo: "Montar Página de Apresentação com Galeria e Depoimentos", categoria: "Página", prioridade: "med" },
          { titulo: "Ativar Automação de Lembrete Anti-No-Show no Hub", categoria: "Atendimento", prioridade: "high" },
        ],
      };
    }

    // Default / Infoproduto / Lead Squeeze / Geral
    return {
      nome: "Funil de Infoproduto: Tripwire + VSL + Comunidade",
      tipo: "Perpétuo",
      categoria: "Infoproduto / Educação",
      referenciaLivro: `${citation} · DotCom Secrets: Section 4 - Frontend & Value Ladder`,
      descricao: "Funil canônico para transformar tráfego frio em compradores imediatos com um produto de entrada acessível (Tripwire), acelerando a identificação de clientes hiperativos para a oferta principal.",
      etapas: [
        {
          nome: "Criativo de Conteúdo / Anúncio",
          tipo: "criativo",
          subtitulo: "Gancho de Curiosidade",
          oQueDeveTer: [
            "Hook de 3 segundos quebrando o mito mais comum do nicho.",
            "Promessa de entrega de uma ferramenta ou checklist prático.",
            "Chamada clara para a página de apresentação.",
          ],
          pos_x: 80,
          pos_y: 80,
        },
        {
          nome: "Página de Vendas da Oferta de Entrada",
          tipo: "vsl",
          subtitulo: "Tripwire (R$ 27 a R$ 97)",
          oQueDeveTer: [
            "Headline direta com promessa específica em tempo determinado.",
            "Vídeo de 7 a 10 minutos (Lead, Story, Offer).",
            "Mecanismo de 'Pílula Única': por que este método resolve rápido.",
            "Empilhamento de bônus exclusivos.",
          ],
          pos_x: 380,
          pos_y: 80,
        },
        {
          nome: "Checkout com 2 Order Bumps",
          tipo: "checkout",
          subtitulo: "Maximização de Ticket",
          oQueDeveTer: [
            "Bump 1: Pack de Templates Prontos / Modelos Prontos (R$ 19,90).",
            "Bump 2: Acesso à Gravação do Workshop Ao Vivo (R$ 37,00).",
            "Selo de garantia incondicional de 7 dias.",
          ],
          pos_x: 680,
          pos_y: 80,
        },
        {
          nome: "One-Click Upsell: Mentoria / Curso Completo",
          tipo: "upsell",
          subtitulo: "Oferta Principal (R$ 297 a R$ 497)",
          oQueDeveTer: [
            "Vídeo parabenizando e oferecendo o próximo passo lógico.",
            "Condição exclusiva de 1 clique: economize R$ 500 agora.",
          ],
          pos_x: 980,
          pos_y: 80,
        },
        {
          nome: "WhatsApp Onboarding & Recuperação",
          tipo: "whatsapp",
          subtitulo: "Engajamento Imediato",
          oQueDeveTer: [
            "Envio de dados de acesso e link da comunidade.",
            "Régua de recuperação de abandono com vídeo de demonstração.",
          ],
          pos_x: 1280,
          pos_y: 80,
        },
      ],
      orderBumps: [
        { nome: "Templates & Planilhas Prontas", valorSugerido: "R$ 19,90", objetivo: "Economiza 10 horas de trabalho do aluno" },
        { nome: "Workshop de Implementação Gravado", valorSugerido: "R$ 37,00", objetivo: "Mostra o passo a passo na prática" },
      ],
      upsell: {
        nome: "Formação Completa + Comunidade VIP",
        valorSugerido: "R$ 297,00",
        pitch: "O método aprofundado com suporte individual para quem quer escala.",
      },
      reguaWhatsApp: [
        { tempo: "Imediato", foco: "Boas-Vindas", mensagem: "Parabéns pela decisão! Aqui está o seu link de acesso à área de membros..." },
        { tempo: "15 minutos", foco: "Pix Pendente", mensagem: "Sua vaga ainda está reservada! Conclua o Pix aqui para liberar seu acesso..." },
      ],
      checklist: [
        { titulo: "Escrever Copy da Página do Produto de Entrada", categoria: "Copy", prioridade: "high" },
        { titulo: "Criar Área de Membros / Entrega na Plataforma", categoria: "Produto", prioridade: "high" },
        { titulo: "Cadastrar Bumps 1 e 2 no Checkout", categoria: "Checkout", prioridade: "high" },
        { titulo: "Configurar Automação de Boas-Vindas no WhatsApp", categoria: "Atendimento", prioridade: "med" },
      ],
    };
  };

  const handleSend = async (customText?: string) => {
    const text = customText || input;
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const blueprint = await generateBlueprint(text);

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Analisei o seu pedido e o contexto do produto. Aqui está o **Blueprint Estratégico do Funil** arquitetado para você e seu sócio testarem com máxima conversão:\n\n### 🎯 Estrutura do Funil: ${blueprint.nome}\n*${blueprint.referenciaLivro}*\n\n${blueprint.descricao}\n\nAbaixo você confere o fluxo de cada etapa, o que **DEVE TER** em cada página, os Order Bumps sugeridos e a régua de WhatsApp. Se estiver alinhado, clique no botão para **criar este funil diretamente no sistema**.`,
        blueprint,
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      toast.error("Erro ao gerar arquitetura do funil");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFunnelInSystem = async (blueprint: FunnelBlueprint, messageId: string) => {
    setCreatingFunnelId(messageId);
    try {
      const funnelId = crypto.randomUUID();
      const projId = selectedProjectId !== "all" ? selectedProjectId : null;

      // 1. Criar o Funil em imphq_funis
      const etapasFormatadas = blueprint.etapas.map((etapa) => ({
        nome: etapa.nome,
        tipo: etapa.tipo,
        visitantes: 0,
        conversoes: 0,
        pos_x: etapa.pos_x,
        pos_y: etapa.pos_y,
        notes: etapa.oQueDeveTer.join(" | "),
      }));

      const { error: funnelError } = await supabase.from("imphq_funis").insert([
        {
          id: funnelId,
          nome: blueprint.nome,
          tipo: blueprint.tipo,
          status: "Ativo",
          project_id: projId,
          data: {
            etapas: etapasFormatadas,
            blueprint_meta: {
              categoria: blueprint.categoria,
              referenciaLivro: blueprint.referenciaLivro,
              orderBumps: blueprint.orderBumps,
              upsell: blueprint.upsell,
              reguaWhatsApp: blueprint.reguaWhatsApp,
            },
          } as any,
        },
      ]);

      if (funnelError) throw funnelError;

      // 2. Se tiver projeto selecionado, criar os itens de checklist em imphq_funnel_checklist
      if (projId && blueprint.checklist.length > 0) {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id || crypto.randomUUID();

        const checklistRows = blueprint.checklist.map((item) => ({
          user_id: userId,
          project_id: projId,
          title: item.titulo,
          category: item.categoria,
          priority: item.priority,
          status: "todo",
          flow_blueprint_id: funnelId,
          auto_generated: true,
          source: "Arquiteto de Funis IA",
          metadata: { funnel_name: blueprint.nome } as any,
        }));

        await supabase.from("imphq_funnel_checklist").insert(checklistRows as any);
      }

      // Atualiza mensagem com o ID criado
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, createdFunilId: funnelId } : m))
      );

      toast.success("Funil criado com sucesso no sistema!");
      onFunnelCreated?.(funnelId);
    } catch (err: unknown) {
      toast.error("Falha ao salvar funil: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setCreatingFunnelId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl p-0 flex flex-col bg-background/95 backdrop-blur-xl border-l border-border"
      >
        {/* Header */}
        <SheetHeader className="px-5 py-4 border-b border-border shrink-0 bg-card/60">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <SheetTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  Arquiteto de Funis IA
                  <Badge variant="outline" className="text-[10px] h-4.5 bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-mono">
                    RAG Bookmaps
                  </Badge>
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  DotCom Secrets (Russell Brunson) + $100M Leads (Alex Hormozi)
                </SheetDescription>
              </div>
            </div>

            {/* Project Selector */}
            <div className="flex items-center gap-2">
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="h-8 text-xs w-[170px] bg-background/80">
                  <SelectValue placeholder="Vincular a Projeto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Sem projeto vinculado</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </SheetHeader>

        {/* Messages Stream */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {messages.map((m) => {
            const isUser = m.role === "user";
            return (
              <div
                key={m.id}
                className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                    <Compass className="h-3.5 w-3.5" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed space-y-3 ${
                    isUser
                      ? "bg-primary text-primary-foreground font-medium rounded-br-xs"
                      : "bg-card border border-border/70 text-foreground/90 rounded-bl-xs shadow-xs"
                  }`}
                >
                  <div className="whitespace-pre-wrap font-sans">{m.content}</div>

                  {/* Render Funnel Blueprint Card if available */}
                  {m.blueprint && (
                    <div className="mt-3 pt-3 border-t border-border/60 space-y-3">
                      {/* Badge and Title Header */}
                      <div className="p-3 rounded-xl bg-muted/40 border border-border/80">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                            <Layers className="h-4 w-4 text-emerald-400" />
                            {m.blueprint.nome}
                          </span>
                          <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                            {m.blueprint.categoria}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{m.blueprint.descricao}</p>
                      </div>

                      {/* Visual Flow Strip (Etapas) */}
                      <div className="space-y-2">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                          Etapas do Fluxo & O que Deve Conter:
                        </span>

                        <div className="space-y-2">
                          {m.blueprint.etapas.map((etapa, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 rounded-lg bg-background/80 border border-border/60 flex flex-col gap-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center font-bold text-[10px] text-muted-foreground">
                                    {idx + 1}
                                  </span>
                                  <span className="font-semibold text-xs text-foreground">{etapa.nome}</span>
                                </div>
                                <span className="text-[10px] font-mono text-muted-foreground">{etapa.subtitulo}</span>
                              </div>

                              <ul className="pl-6 list-disc space-y-0.5 text-[11px] text-muted-foreground/90">
                                {etapa.oQueDeveTer.map((item, i) => (
                                  <li key={i}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Order Bumps & Upsell Summary Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                        <div className="p-2.5 rounded-lg bg-emerald-500/[0.04] border border-emerald-500/20 space-y-1">
                          <span className="font-semibold text-emerald-400 flex items-center gap-1">
                            <ShoppingCart className="h-3 w-3" /> Order Bumps no Checkout:
                          </span>
                          {m.blueprint.orderBumps.map((b, i) => (
                            <p key={i} className="text-muted-foreground">
                              • <strong>{b.nome}</strong> ({b.valorSugerido}): {b.objetivo}
                            </p>
                          ))}
                        </div>

                        <div className="p-2.5 rounded-lg bg-amber-500/[0.04] border border-amber-500/20 space-y-1">
                          <span className="font-semibold text-amber-400 flex items-center gap-1">
                            <Zap className="h-3 w-3" /> One-Click Upsell:
                          </span>
                          <p className="text-muted-foreground">
                            • <strong>{m.blueprint.upsell.nome}</strong> ({m.blueprint.upsell.valorSugerido})
                          </p>
                          <p className="text-[10px] italic text-muted-foreground/80">{m.blueprint.upsell.pitch}</p>
                        </div>
                      </div>

                      {/* Action Button: Criar no Sistema */}
                      <div className="pt-2">
                        {m.createdFunilId ? (
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 shrink-0" />
                              <span>Funil salvo e integrado ao sistema!</span>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                onOpenChange(false);
                                navigate("/funis");
                              }}
                              className="h-7 text-xs gap-1 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20"
                            >
                              Ver em Funis <ExternalLink className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            disabled={creatingFunnelId === m.id}
                            onClick={() => handleCreateFunnelInSystem(m.blueprint!, m.id)}
                            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold shadow-md gap-1.5"
                          >
                            {creatingFunnelId === m.id ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando funil no sistema...
                              </>
                            ) : (
                              <>
                                <Zap className="h-3.5 w-3.5" /> Criar Este Funil no Sistema (Canvas & Checklist)
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  <span className="text-[10px] opacity-50 block text-right">{m.timestamp}</span>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-3 items-center text-xs text-muted-foreground animate-pulse py-2">
              <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              </div>
              <span>Consultando acervo de Bookmaps e arquitetando o funil...</span>
            </div>
          )}
        </div>

        {/* Quick Starters & Input Bar */}
        <div className="p-3 md:p-4 border-t border-border bg-card/60 space-y-2 shrink-0">
          {messages.length <= 2 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              {QUICK_STARTERS.map((qs, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(qs.prompt)}
                  className="shrink-0 text-[11px] px-2.5 py-1.5 rounded-lg border border-border/70 bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5"
                >
                  <span>{qs.icon}</span>
                  <span>{qs.label}</span>
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Cole o site do produto ou descreva a ideia..."
              className="h-9 text-xs bg-background/90"
              disabled={loading}
            />
            <Button
              type="submit"
              size="sm"
              disabled={!input.trim() || loading}
              className="h-9 px-3 bg-emerald-600 hover:bg-emerald-500 text-white shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}

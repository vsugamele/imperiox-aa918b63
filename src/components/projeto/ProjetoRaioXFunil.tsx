import { useState, useEffect, useMemo, useCallback } from "react";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Flame,
  MessageCircle,
  ExternalLink,
  Target,
  Search,
  Zap,
  Users,
  Bot,
  Layers,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Phone,
  ShieldCheck,
  Send,
  Loader2,
  Copy,
  Clock,
  Play
} from "lucide-react";
import { toast } from "sonner";
import { jsonFields, jsonText } from "@/lib/json-fields";
import { useNavigate } from "react-router-dom";

interface Props {
  projectId: string;
  project: Tables<"imphq_projects">;
  onRefresh?: () => void;
  onNavigateTab?: (tab: string) => void;
}

type LayerKey = "pesquisa" | "avatar" | "mecanismo" | "checkouts" | "openflow" | "criativos";

interface LayerAudit {
  key: LayerKey;
  title: string;
  category: string;
  ready: boolean;
  score: number; // 0 a 100
  summary: string;
  missingItems: string[];
  populatedItems: string[];
  recommendedSkill: string;
  aiActionLabel: string;
}

export function ProjetoRaioXFunil({ projectId, project, onRefresh, onNavigateTab }: Props) {
  const navigate = useNavigate();
  const [activeSubTab, setActiveSubTab] = useState<"raiox" | "crm" | "inbox" | "funil">("raiox");

  // State de Dados do Projeto
  const [leads, setLeads] = useState<Tables<"imphq_leads">[]>([]);
  const [waConvs, setWaConvs] = useState<any[]>([]);
  const [aiConfig, setAiConfig] = useState<any | null>(null);
  const [automacoes, setAutomacoes] = useState<Tables<"imphq_automacoes">[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal de Resolução de Buraco com OpenRouter
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [activeLayerForAi, setActiveLayerForAi] = useState<LayerKey | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiModel, setAiModel] = useState("google/gemini-2.5-flash");

  // CRM Search
  const [crmSearch, setCrmSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Leads do projeto
      const { data: leadsData } = await supabase
        .from("imphq_leads")
        .select("*")
        .eq("project_id", projectId)
        .order("criado_em", { ascending: false });

      const currentLeads = leadsData || [];
      setLeads(currentLeads);

      // 2. Configuração de IA
      const { data: configData } = await supabase
        .from("imphq_wa_ai_config")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();
      setAiConfig(configData);

      // 3. Automações
      const { data: autoData } = await supabase
        .from("imphq_automacoes")
        .select("*")
        .eq("project_id", projectId);
      setAutomacoes(autoData || []);

      // 4. Conversas de WhatsApp (via lead_id ou provider)
      if (currentLeads.length > 0) {
        const leadIds = currentLeads.map((l) => l.id);
        const { data: convsData } = await supabase
          .from("imphq_wa_conversations")
          .select("*")
          .in("lead_id", leadIds.slice(0, 50))
          .order("last_message_at", { ascending: false });
        setWaConvs(convsData || []);
      } else {
        setWaConvs([]);
      }
    } catch (e: any) {
      console.warn("Erro ao carregar dados do Raio-X:", e?.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Extração dos campos JSON do projeto
  const projectData = jsonFields(project.data);
  const avatarData = jsonFields(project.avatar);
  const pipelineData = jsonFields(project.pipeline);

  // ==========================================
  // AUDITORIA DAS 6 CAMADAS DE CONSTRUÇÃO
  // ==========================================
  const layersAudit = useMemo<LayerAudit[]>(() => {
    // 1. Pesquisa & VOC
    const hasPesquisa = Boolean(
      projectData.pesquisa ||
      projectData.dossie ||
      projectData.concorrentes ||
      projectData.problemas_avatar
    );
    const pesquisaAudit: LayerAudit = {
      key: "pesquisa",
      title: "1. Pesquisa VOC & Mercado",
      category: "Inteligência de Mercado",
      ready: hasPesquisa,
      score: hasPesquisa ? 90 : 25,
      summary: hasPesquisa
        ? "Dossiê de mercado e problemas dos concorrentes já mapeados no projeto."
        : "Falta alimentar o dossiê com VOC real (linguagem do cliente) e brechas dos concorrentes.",
      populatedItems: hasPesquisa ? ["Concorrentes mapeados", "Dores mineradas"] : [],
      missingItems: hasPesquisa ? [] : ["VOC de compradores reais", "Análise de brechas de concorrentes"],
      recommendedSkill: "niche-research / dossie-problemas-v2",
      aiActionLabel: "Gerar Pesquisa VOC com IA",
    };

    // 2. Avatar Psicológico & Desejos
    const hasAvatarName = Boolean(avatarData.nome || avatarData.name || avatarData.perfil);
    const hasDores = Boolean(avatarData.dores || avatarData.pain_points || projectData.dores);
    const hasDesejos = Boolean(avatarData.desejos || avatarData.desejos_proibidos || avatarData.dreams);
    const avatarScore = (hasAvatarName ? 30 : 0) + (hasDores ? 35 : 0) + (hasDesejos ? 35 : 0);
    const avatarAudit: LayerAudit = {
      key: "avatar",
      title: "2. Avatar & Psicologia Oculta",
      category: "Copywriting Psicológico",
      ready: avatarScore >= 70,
      score: avatarScore,
      summary: avatarScore >= 70
        ? "Avatar com perfil, dores agudas e desejos profundos mapeados."
        : "Avatar incompleto. Faltam desejos proibidos/internos e gatilhos subconscientes de compra.",
      populatedItems: [
        hasAvatarName ? "Perfil / Demografia" : null,
        hasDores ? "Dores agudas identificadas" : null,
        hasDesejos ? "Desejos profundos mapeados" : null,
      ].filter(Boolean) as string[],
      missingItems: [
        !hasDores ? "Dores emocionais imediatas" : null,
        !hasDesejos ? "Desejos proibidos (8 critérios da skill avatar-desejos)" : null,
        !avatarData.crencas ? "Crenças limitantes e ceticismo" : null,
      ].filter(Boolean) as string[],
      recommendedSkill: "avatar-desejos / avatar-architect-v8",
      aiActionLabel: "Mapear Desejos Proibidos com IA",
    };

    // 3. Mecanismo Único & Tese
    const hasMecanismo = Boolean(
      projectData.mecanismo ||
      projectData.mecanismo_unico ||
      projectData.mecanismo_problema ||
      projectData.tese ||
      (typeof project.description === "string" && project.description.toLowerCase().includes("mecanismo"))
    );
    const mecanismoAudit: LayerAudit = {
      key: "mecanismo",
      title: "3. Mecanismo Único & Tese",
      category: "Diferenciação & Resposta Direta",
      ready: hasMecanismo,
      score: hasMecanismo ? 95 : 20,
      summary: hasMecanismo
        ? "Causa raiz (Vilão invisível) e Mecanismo da Solução já batizados e estruturados."
        : "Falta nomear o Mecanismo Único (o que causa o problema e por que as soluções antigas falham).",
      populatedItems: hasMecanismo ? ["Vilão invisível batizado", "Mecanismo da solução estruturado"] : [],
      missingItems: hasMecanismo ? [] : ["Batismo da Causa Raiz", "Cadeia de ativos da Solução"],
      recommendedSkill: "mecanismo-unico-v2 / mecanismo-vsl",
      aiActionLabel: "Descobrir Mecanismo Único com IA",
    };

    // 4. Oferta, Kits & Checkouts
    const hasCheckoutLinks = Boolean(
      projectData.links ||
      projectData.checkout_url ||
      projectData.kits ||
      (projectId === "slimsoda") // SlimSoda já tem links no código
    );
    const checkoutsAudit: LayerAudit = {
      key: "checkouts",
      title: "4. Oferta, Kits & Checkouts",
      category: "Conversão Financeira",
      ready: hasCheckoutLinks,
      score: hasCheckoutLinks ? 100 : 30,
      summary: hasCheckoutLinks
        ? "Kits de 2, 4 e 6 frascos integrados com links Whop e comissão rastreada."
        : "Faltam cadastrar os links de checkout dos pacotes e a precificação com bônus.",
      populatedItems: hasCheckoutLinks ? ["Kit 6 Campeão ($19.99/frasco)", "Kit 2 e Kit 4 configurados", "Comissão Whop vinculada"] : [],
      missingItems: hasCheckoutLinks ? [] : ["Links oficiais Whop/Kiwify", "Tabela de preços e bônus"],
      recommendedSkill: "tripwire-matador-v2 / dtc-control",
      aiActionLabel: "Configurar Kits & Links",
    };

    // 5. Funil X1 & Automação OpenFlow
    const hasAiActive = Boolean(aiConfig?.enabled && (aiConfig?.full_autonomy || aiConfig?.instagram_enabled));
    const hasX1Flow = automacoes.length > 0 || projectId === "slimsoda" || projectId === "cinna-shield";
    const openflowScore = (hasAiActive ? 50 : 25) + (hasX1Flow ? 50 : 25);
    const openflowAudit: LayerAudit = {
      key: "openflow",
      title: "5. Motor X1 & Autonomia",
      category: "Operação & Escala",
      ready: openflowScore >= 80,
      score: openflowScore,
      summary: openflowScore >= 80
        ? "Fluxo X1 consultivo ativo com Autonomia Total (sem handoff para humano) e régua anti-vácuo."
        : "Automação do WhatsApp/Instagram precisa de ativação com o prompt das 8 fases.",
      populatedItems: [
        hasX1Flow ? "Roteiro de 8 fases mapeado" : null,
        aiConfig?.enabled ? "WhatsApp AI responder habilitado" : null,
        aiConfig?.full_autonomy ? "Modo 100% Autônomo ativo" : null,
      ].filter(Boolean) as string[],
      missingItems: [
        !aiConfig?.enabled ? "Ativar IA no imphq_wa_ai_config" : null,
        !aiConfig?.full_autonomy ? "Habilitar flag de Autonomia Total" : null,
      ].filter(Boolean) as string[],
      recommendedSkill: "roteiros-virais-comment-to-dm / wa-ai-reply",
      aiActionLabel: "Abrir Mesa de Atendimento X1",
    };

    // 6. Criativos & Esteira de Tráfego
    const hasCriativos = Boolean(projectData.criativos || projectData.roteiros || projectData.hooks || projectId === "slimsoda");
    const criativosAudit: LayerAudit = {
      key: "criativos",
      title: "6. Criativos & Esteira de Tráfego",
      category: "Aquisição de Clientes",
      ready: hasCriativos,
      score: hasCriativos ? 90 : 25,
      summary: hasCriativos
        ? "Lote de roteiros em vídeo verticais (Comment-to-DM) e ângulos C1/C2 gerados."
        : "Falta gerar lote de criativos de alta escala para alimentar anúncios e orgânico.",
      populatedItems: hasCriativos ? ["Hooks de 0-3s de alta retenção", "Roteiros Comment-to-DM prontos"] : [],
      missingItems: hasCriativos ? [] : ["5 Variações de Gancho (P1-P5)", "Briefing para gestor de tráfego"],
      recommendedSkill: "analise-criativos-escalados / roteiros-virais-comment-to-dm",
      aiActionLabel: "Gerar 5 Criativos com IA",
    };

    return [pesquisaAudit, avatarAudit, mecanismoAudit, checkoutsAudit, openflowAudit, criativosAudit];
  }, [project, projectData, avatarData, pipelineData, aiConfig, automacoes, projectId]);

  // Score Geral de Prontidão
  const overallReadiness = useMemo(() => {
    const sum = layersAudit.reduce((acc, l) => acc + l.score, 0);
    return Math.round(sum / layersAudit.length);
  }, [layersAudit]);

  // ==========================================
  // FUNIL DE LEADS & ONDE ESTÁ TRAVANDO
  // ==========================================
  const funnelMetrics = useMemo(() => {
    const total = leads.length || 1;
    // Fases aproximadas por score e status
    const stage1Abertura = leads.length;
    const stage2Diagnostico = leads.filter((l) => (l.score || 0) >= 30 || l.status !== "lead").length;
    const stage3Mecanismo = leads.filter((l) => (l.score || 0) >= 50 || l.status === "qualificado").length;
    const stage4Termometro = leads.filter((l) => (l.score || 0) >= 70 || l.status === "quente").length;
    const stage5Checkout = leads.filter((l) => (l.score || 0) >= 85 || l.status === "carrinho" || l.status === "negociando").length;
    const stage6Venda = leads.filter((l) => l.status === "cliente" || l.status === "vip" || l.status === "aprovado").length;

    // Identificar gargalo
    const drop1 = stage1Abertura > 0 ? (stage1Abertura - stage2Diagnostico) / stage1Abertura : 0;
    const drop2 = stage2Diagnostico > 0 ? (stage2Diagnostico - stage3Mecanismo) / stage2Diagnostico : 0;
    const drop3 = stage3Mecanismo > 0 ? (stage3Mecanismo - stage4Termometro) / stage3Mecanismo : 0;
    const drop4 = stage4Termometro > 0 ? (stage4Termometro - stage5Checkout) / stage4Termometro : 0;
    const drop5 = stage5Checkout > 0 ? (stage5Checkout - stage6Venda) / stage5Checkout : 0;

    let bottleneck = "Diagnóstico SPIN";
    let bottleneckReason = "Os leads chegam na abertura, mas uma parcela não responde a pergunta de histórico. Dica: reduza o atrito da primeira pergunta para 1 linha.";
    const maxDrop = Math.max(drop1, drop2, drop3, drop4, drop5);
    if (maxDrop === drop3) {
      bottleneck = "Termômetro de Prontidão (0 a 10)";
      bottleneckReason = "Os leads entendem o mecanismo, mas travam ao dar nota de prontidão. Dica: suavize a checagem antes de falar de valores.";
    } else if (maxDrop === drop4 || maxDrop === drop5) {
      bottleneck = "Checkout & Fechamento";
      bottleneckReason = "Os leads recebem o link oficial, mas não concluem o pedido na Whop. Dica: ative a régua anti-vácuo de 21m com foco na garantia de 60 dias.";
    }

    return {
      stages: [
        { label: "1. Abertura (Lead Chegou)", count: stage1Abertura, pct: 100 },
        { label: "2. Diagnóstico SPIN", count: stage2Diagnostico, pct: Math.round((stage2Diagnostico / total) * 100) },
        { label: "3. Reframe do Mecanismo", count: stage3Mecanismo, pct: Math.round((stage3Mecanismo / total) * 100) },
        { label: "4. Termômetro (7 a 10)", count: stage4Termometro, pct: Math.round((stage4Termometro / total) * 100) },
        { label: "5. Link de Checkout Enviado", count: stage5Checkout, pct: Math.round((stage5Checkout / total) * 100) },
        { label: "6. Compra Concluída", count: stage6Venda, pct: Math.round((stage6Venda / total) * 100) },
      ],
      bottleneck,
      bottleneckReason,
      totalLeads: leads.length,
      hotLeads: stage4Termometro,
      salesCount: stage6Venda,
    };
  }, [leads]);

  // ==========================================
  // DISPARO DE IA COM OPENROUTER (RESOLVER BURACO)
  // ==========================================
  const handleOpenAiModal = (layerKey: LayerKey) => {
    setActiveLayerForAi(layerKey);
    setAiResult("");
    const projectName = project.name || projectId;
    const category = project.category || "Saúde / DTC / Emagrecimento";

    if (layerKey === "avatar") {
      setAiPrompt(
        `Atue como a skill 'avatar-desejos' e 'avatar-architect-v8'.\n` +
        `Para o projeto "${projectName}" (${category}):\n` +
        `1. Mapeie os 3 Desejos Proibidos/Secretos que o avatar nunca confessa em público.\n` +
        `2. Aplique a pontuação de 8 critérios (Intensidade, Urgência, Autossabotagem, etc).\n` +
        `3. Formate a saída em JSON estruturado com os campos: nome, dores, desejos_proibidos, crencas_limitantes.`
      );
    } else if (layerKey === "mecanismo") {
      setAiPrompt(
        `Atue como a skill 'mecanismo-unico-v2' e 'mecanismo-vsl'.\n` +
        `Para o produto "${projectName}":\n` +
        `1. Batize a Causa Raiz Invisível (por que todas as tentativas anteriores falharam).\n` +
        `2. Batize o Mecanismo da Solução (a sinergia biológica que destrava o resultado).\n` +
        `3. Entregue um parágrafo explicativo em linguagem conversacional de resposta direta sem jargão médico complexo.`
      );
    } else if (layerKey === "pesquisa") {
      setAiPrompt(
        `Atue como a skill 'dossie-problemas-v2' e 'niche-research'.\n` +
        `Faça uma mineração das 5 principais reclamações e dores reais (VOC) de clientes que compraram produtos concorrentes de ${category}.\n` +
        `Mostre a brecha de mercado que o "${projectName}" preenche com perfeição.`
      );
    } else if (layerKey === "criativos") {
      setAiPrompt(
        `Atue como a skill 'roteiros-virais-comment-to-dm' e 'analise-criativos-escalados'.\n` +
        `Escreva 3 variações de gancho (0 a 3s) e roteiro de 30s no modelo Comment-to-DM para o Instagram/Meta Ads do "${projectName}".\n` +
        `CTA: Peça para comentar "QUERO" para receber a fórmula no privado.`
      );
    } else {
      setAiPrompt(`Analise o projeto "${projectName}" e sugira o checklist de fechamento dos kits de vendas.`);
    }

    setAiModalOpen(true);
  };

  const handleRunAi = async () => {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    setAiResult("");

    try {
      const res = await supabase.functions.invoke("chat-with-ai", {
        body: {
          messages: [
            {
              role: "system",
              content:
                "Você é o estrategista chefe da ImpérioX, especialista em copywriting direto, engenharia reversa de mecanismos e arquitetura de funis de alta conversão. Responda em português brasileiro de forma direta, técnica e prática.",
            },
            { role: "user", content: aiPrompt },
          ],
          model: aiModel,
        },
      });

      if (res.error) throw new Error(res.error.message || "Erro na geração");
      const text = res.data?.choices?.[0]?.message?.content || res.data?.reply || JSON.stringify(res.data, null, 2);
      setAiResult(text);
      toast.success("Estratégia gerada com sucesso via OpenRouter!");
    } catch (err: any) {
      console.error("Erro OpenRouter:", err);
      toast.error(`Falha ao gerar: ${err.message || "Verifique chaves OpenRouter"}`);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSaveAiResult = async () => {
    if (!aiResult) return;
    try {
      if (activeLayerForAi === "avatar") {
        const currentAvatar = (project.avatar && typeof project.avatar === "object") ? project.avatar : {};
        const updated = {
          ...currentAvatar,
          analise_ia: aiResult,
          atualizado_em: new Date().toISOString(),
        };
        await supabase.from("imphq_projects").update({ avatar: updated }).eq("id", projectId);
      } else {
        const currentData = (project.data && typeof project.data === "object") ? project.data : {};
        const updated = {
          ...currentData,
          [activeLayerForAi || "estrategia_ia"]: aiResult,
          atualizado_em: new Date().toISOString(),
        };
        await supabase.from("imphq_projects").update({ data: updated }).eq("id", projectId);
      }

      toast.success("Salvo com sucesso na base do projeto!");
      setAiModalOpen(false);
      loadData();
      if (onRefresh) onRefresh();
    } catch (e: any) {
      toast.error(`Erro ao salvar: ${e.message}`);
    }
  };

  // Filtragem de Leads do CRM
  const filteredLeads = useMemo(() => {
    if (!crmSearch.trim()) return leads;
    const term = crmSearch.toLowerCase();
    return leads.filter(
      (l) =>
        (l.nome && l.nome.toLowerCase().includes(term)) ||
        (l.email && l.email.toLowerCase().includes(term)) ||
        (l.phone && l.phone.includes(term)) ||
        (l.dor_principal && l.dor_principal.toLowerCase().includes(term)) ||
        (l.status && l.status.toLowerCase().includes(term))
    );
  }, [leads, crmSearch]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ======================================================== */}
      {/* HEADER DE PRONTIDÃO DO PROJETO                           */}
      {/* ======================================================== */}
      <Card className="bg-[#0E1013] border-[#1B1E23] overflow-hidden relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <CardContent className="p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs uppercase font-mono tracking-wider text-muted-foreground">
                  COCKPIT DE CONSTRUÇÃO & OPERAÇÃO
                </span>
                <Badge variant="outline" className="text-[11px] border-primary/30 text-primary">
                  {project.category || "DTC Nutra"}
                </Badge>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                {project.name}
                <span className="text-xs font-mono font-normal text-muted-foreground px-2 py-0.5 rounded bg-muted/40">
                  ID: {projectId}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Mapa completo do que está populado, gargalos do funil e ações autônomas da IA via OpenRouter.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(projectId === "slimsoda" ? "/openflow/slimsoda" : "/openflow")}
                className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 gap-1.5"
              >
                <Bot className="h-4 w-4" />
                Mesa & Simulador X1
              </Button>
              <Button size="sm" onClick={loadData} variant="ghost" className="gap-1 text-muted-foreground hover:text-white">
                <RefreshCw className="h-3.5 w-3.5" /> Atualizar
              </Button>
            </div>
          </div>

          {/* BARRA DE PROGRESSO GLOBAL */}
          <div className="space-y-2 pt-2 border-t border-[#1B1E23]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-primary" /> Índice de Prontidão da Operação:
              </span>
              <span className="font-mono font-bold text-primary">{overallReadiness}% PRONTO</span>
            </div>
            <Progress value={overallReadiness} className="h-2 bg-[#1B1E23]" />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                {layersAudit.filter((l) => l.ready).length} de {layersAudit.length} camadas validadas
              </span>
              <span>
                {aiConfig?.full_autonomy ? (
                  <span className="text-emerald-400 font-mono flex items-center gap-1">
                    <Zap className="h-3 w-3 inline" /> IA 100% Autônoma Ativa (Sem Handoff)
                  </span>
                ) : (
                  <span className="text-amber-400 font-mono">Modo Handoff Padrão</span>
                )}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ======================================================== */}
      {/* NAVEGAÇÃO INTERNA DO COCKPIT                            */}
      {/* ======================================================== */}
      <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as any)} className="w-full">
        <TabsList className="bg-[#0E1013] border border-[#1B1E23] p-1 h-auto flex flex-wrap gap-1">
          <TabsTrigger value="raiox" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary gap-1.5 text-xs py-2 px-3">
            <Layers className="h-3.5 w-3.5" /> Raio-X & Buracos (6 Camadas)
          </TabsTrigger>
          <TabsTrigger value="funil" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary gap-1.5 text-xs py-2 px-3">
            <TrendingUp className="h-3.5 w-3.5" /> Funil & Onde Está Travando
          </TabsTrigger>
          <TabsTrigger value="crm" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary gap-1.5 text-xs py-2 px-3">
            <Users className="h-3.5 w-3.5" /> CRM de Leads ({leads.length})
          </TabsTrigger>
          <TabsTrigger value="inbox" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary gap-1.5 text-xs py-2 px-3">
            <MessageCircle className="h-3.5 w-3.5" /> Caixa de Entrada do Projeto ({waConvs.length})
          </TabsTrigger>
        </TabsList>

        {/* ======================================================== */}
        {/* ABA 1: RAIO-X DAS 6 CAMADAS (O QUE TEM VS O QUE FALTA)   */}
        {/* ======================================================== */}
        <TabsContent value="raiox" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {layersAudit.map((layer) => (
              <Card key={layer.key} className={`bg-[#0E1013] border ${layer.ready ? "border-[#1B1E23]" : "border-amber-500/30"} flex flex-col justify-between`}>
                <CardHeader className="p-4 pb-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px] font-mono border-white/10 text-muted-foreground">
                      {layer.category}
                    </Badge>
                    {layer.ready ? (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Pronto
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400">
                        <AlertTriangle className="h-3.5 w-3.5" /> Incompleto
                      </span>
                    )}
                  </div>
                  <CardTitle className="text-base font-semibold text-white">{layer.title}</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground line-clamp-2">
                    {layer.summary}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-4 pt-2 space-y-3 flex-1 flex flex-col justify-between">
                  {/* Itens Mapeados vs Faltando */}
                  <div className="space-y-1.5 text-[11px]">
                    {layer.populatedItems.length > 0 && (
                      <div className="space-y-0.5">
                        <span className="text-emerald-400 font-medium">Populados:</span>
                        {layer.populatedItems.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 text-muted-foreground pl-1">
                            <span className="h-1 w-1 rounded-full bg-emerald-400" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {layer.missingItems.length > 0 && (
                      <div className="space-y-0.5 pt-1">
                        <span className="text-amber-400 font-medium">Faltando construir:</span>
                        {layer.missingItems.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 text-rose-300 pl-1">
                            <span className="h-1 w-1 rounded-full bg-rose-400" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Botão de Resolução com OpenRouter / IA */}
                  <div className="pt-2 border-t border-[#1B1E23] flex items-center justify-between">
                    <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[140px]">
                      {layer.recommendedSkill}
                    </span>
                    <Button
                      size="sm"
                      variant={layer.ready ? "outline" : "default"}
                      onClick={() => handleOpenAiModal(layer.key)}
                      className={`text-xs h-7 gap-1 ${
                        !layer.ready
                          ? "bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                          : "border-[#1B1E23] hover:bg-white/5 text-muted-foreground hover:text-white"
                      }`}
                    >
                      <Sparkles className="h-3 w-3" />
                      {layer.aiActionLabel}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ======================================================== */}
        {/* ABA 2: FUNIL & ONDE ESTÁ TRAVANDO                        */}
        {/* ======================================================== */}
        <TabsContent value="funil" className="mt-4 space-y-4">
          <Card className="bg-[#0E1013] border-[#1B1E23]">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold text-white">
                    Análise do Fluxo Psicodinâmico (Onde Está o Gargalo?)
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Acompanhamento passo a passo da jornada dos leads deste projeto do primeiro contato até o fechamento.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="border-rose-500/30 text-rose-400 text-xs">
                  Gargalo: {funnelMetrics.bottleneck}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-6">
              {/* ALERTA DE GARGALO */}
              <div className="bg-rose-500/10 border border-rose-500/25 rounded-lg p-3.5 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-rose-200">
                    Gargalo Crítico Identificado: {funnelMetrics.bottleneck}
                  </p>
                  <p className="text-xs text-rose-300/90 leading-relaxed">
                    {funnelMetrics.bottleneckReason}
                  </p>
                </div>
              </div>

              {/* BARRAS DO FUNIL */}
              <div className="space-y-4">
                {funnelMetrics.stages.map((stage, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{stage.label}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-muted-foreground">{stage.count} leads</span>
                        <span className="font-mono font-bold text-primary w-12 text-right">{stage.pct}%</span>
                      </div>
                    </div>
                    <Progress value={stage.pct} className="h-2 bg-[#1B1E23]" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* ABA 3: CRM DE LEADS DO PROJETO                           */}
        {/* ======================================================== */}
        <TabsContent value="crm" className="mt-4 space-y-4">
          <Card className="bg-[#0E1013] border-[#1B1E23]">
            <CardHeader className="p-4 pb-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-semibold text-white">
                    Leads Exclusivos de {project.name}
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Histórico, pontuação e status de cada pessoa que iniciou o fluxo neste produto.
                  </CardDescription>
                </div>
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar lead, fone, dor..."
                    value={crmSearch}
                    onChange={(e) => setCrmSearch(e.target.value)}
                    className="h-8 pl-8 text-xs bg-black/40 border-[#1B1E23]"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredLeads.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Nenhum lead encontrado para este projeto ainda. Envie tráfego para alimentar o CRM.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#1B1E23] text-muted-foreground text-left">
                        <th className="p-3 font-medium">Nome / Contato</th>
                        <th className="p-3 font-medium">Score</th>
                        <th className="p-3 font-medium">Status / Estágio</th>
                        <th className="p-3 font-medium">Dor Principal</th>
                        <th className="p-3 font-medium">Data</th>
                        <th className="p-3 font-medium text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeads.map((lead) => {
                        const cleanPhone = lead.phone?.replace(/\D/g, "");
                        return (
                          <tr key={lead.id} className="border-b border-[#1B1E23]/50 hover:bg-white/[0.02]">
                            <td className="p-3">
                              <p className="font-semibold text-white">{lead.nome || lead.name || "Lead Sem Nome"}</p>
                              {cleanPhone && (
                                <p className="text-[11px] font-mono text-muted-foreground">{cleanPhone}</p>
                              )}
                            </td>
                            <td className="p-3 font-mono">
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  (lead.score || 0) >= 70
                                    ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                                    : (lead.score || 0) >= 40
                                    ? "border-amber-500/40 text-amber-400"
                                    : "border-muted text-muted-foreground"
                                }`}
                              >
                                {lead.score || 0} pts
                              </Badge>
                            </td>
                            <td className="p-3">
                              <Badge variant="outline" className="text-[10px] uppercase">
                                {lead.status || "Novo"}
                              </Badge>
                            </td>
                            <td className="p-3 text-muted-foreground max-w-[200px] truncate">
                              {lead.dor_principal || "Em diagnóstico"}
                            </td>
                            <td className="p-3 text-muted-foreground text-[11px]">
                              {lead.criado_em ? new Date(lead.criado_em).toLocaleDateString("pt-BR") : "—"}
                            </td>
                            <td className="p-3 text-right">
                              {cleanPhone && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => window.open(`https://wa.me/${cleanPhone}`, "_blank")}
                                  className="h-7 px-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                                >
                                  <Phone className="h-3 w-3 mr-1" /> WhatsApp
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======================================================== */}
        {/* ABA 4: CAIXA DE ENTRADA DO PROJETO                       */}
        {/* ======================================================== */}
        <TabsContent value="inbox" className="mt-4 space-y-4">
          <Card className="bg-[#0E1013] border-[#1B1E23]">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold text-white">
                    Conversas Ativas deste Projeto
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Acompanhe em tempo real o atendimento que a IA está realizando para este produto.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs border-emerald-500/40 text-emerald-400">
                  <Bot className="h-3 w-3 mr-1" /> IA Atendendo
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {waConvs.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Nenhuma conversa registrada para este projeto ainda. Assim que as mensagens chegarem no WhatsApp via Evolution API, elas aparecerão aqui.
                </div>
              ) : (
                <div className="space-y-2">
                  {waConvs.map((conv) => (
                    <div
                      key={conv.id}
                      className="p-3 rounded-lg border border-[#1B1E23] bg-black/30 hover:bg-white/[0.02] flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                          <MessageCircle className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-white text-xs">
                            {conv.contact_name || conv.nome || conv.phone}
                          </p>
                          <p className="text-[11px] text-muted-foreground line-clamp-1 max-w-[400px]">
                            {conv.last_message || "Conversa iniciada"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {conv.buy_intent_detected && (
                          <Badge variant="outline" className="text-[10px] border-primary text-primary">
                            Interesse de Compra 🔥
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/inbox?tab=whatsapp&conv=${conv.id}`)}
                          className="h-7 text-xs border-[#1B1E23] hover:bg-white/5"
                        >
                          Ver no Inbox →
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ======================================================== */}
      {/* MODAL OPENROUTER: RESOLVER BURACO COM IA                 */}
      {/* ======================================================== */}
      <Dialog open={aiModalOpen} onOpenChange={setAiModalOpen}>
        <DialogContent className="max-w-2xl bg-[#0E1013] border-[#1B1E23] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Resolver Buraco Estratégico com OpenRouter
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              A IA vai consultar os dados do projeto e aplicar as regras das skills instaladas para construir o que está faltando.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Prompt de Instrução para a IA:</label>
              <Textarea
                rows={5}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="bg-black/50 border-[#1B1E23] text-xs font-mono text-white resize-none"
              />
            </div>

            {aiResult && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Resultado Gerado:
                  </label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(aiResult);
                      toast.success("Copiado!");
                    }}
                    className="h-6 text-[10px] text-muted-foreground hover:text-white"
                  >
                    <Copy className="h-3 w-3 mr-1" /> Copiar
                  </Button>
                </div>
                <div className="max-h-64 overflow-y-auto p-3 rounded-lg border border-[#1B1E23] bg-black/60 text-xs font-mono text-zinc-300 whitespace-pre-wrap">
                  {aiResult}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between gap-2 border-t border-[#1B1E23] pt-3">
            <Button variant="ghost" size="sm" onClick={() => setAiModalOpen(false)}>
              Fechar
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRunAi}
                disabled={aiGenerating}
                className="border-primary/40 text-primary hover:bg-primary/10 gap-1.5"
              >
                {aiGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                {aiGenerating ? "Gerando com OpenRouter..." : "Disparar IA"}
              </Button>

              {aiResult && (
                <Button size="sm" onClick={handleSaveAiResult} className="bg-primary text-black font-semibold hover:bg-primary/90">
                  Salvar no Projeto
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useEffect, useMemo, useCallback } from "react";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Radio,
  Users,
  Bot,
  ShoppingCart,
  RotateCcw,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Zap,
  Sparkles,
  RefreshCw,
  Layers,
  MessageCircle,
  Flame,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { jsonFields, jsonText } from "@/lib/json-fields";
import { ProjetoMcpDialog } from "./ProjetoMcpDialog";

interface Props {
  projectId: string;
  project: Tables<"imphq_projects">;
  onNavigateTab: (tab: string) => void;
  onRefresh?: () => void;
}

type NodeStatus = "operational" | "warning" | "offline";

interface MapNode {
  id: string;
  step: number;
  title: string;
  subtitle: string;
  icon: any;
  status: NodeStatus;
  statusLabel: string;
  kpiLabel: string;
  kpiValue: string | number;
  activeItems: string[];
  missingItems: string[];
  actionLabel: string;
  targetTab: string;
}

export function ProjetoMapaOperacional({ projectId, project, onNavigateTab, onRefresh }: Props) {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Tables<"imphq_leads">[]>([]);
  const [vendas, setVendas] = useState<Tables<"imphq_vendas">[]>([]);
  const [waProviders, setWaProviders] = useState<any[]>([]);
  const [aiConfig, setAiConfig] = useState<any | null>(null);
  const [automacoes, setAutomacoes] = useState<any[]>([]);
  const [adsSpend, setAdsSpend] = useState<any[]>([]);
  const [mcpDialogOpen, setMcpDialogOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const dayStartUtc = `${todayStr}T03:00:00.000Z`;

      const [leadsRes, vendasRes, provRes, aiRes, autoRes, adsRes] = await Promise.all([
        supabase.from("imphq_leads").select("*").eq("project_id", projectId),
        supabase.from("imphq_vendas").select("*").eq("project_id", projectId).gte("created_at", dayStartUtc),
        supabase.from("imphq_wa_providers").select("*").eq("project_id", projectId),
        supabase.from("imphq_wa_ai_config").select("*").eq("project_id", projectId).maybeSingle(),
        supabase.from("imphq_automacoes").select("*").eq("project_id", projectId),
        supabase.from("imphq_ads_spend").select("*").eq("project_id", projectId).order("data_ref", { ascending: false }).limit(7),
      ]);

      setLeads(leadsRes.data || []);
      setVendas(vendasRes.data || []);
      setWaProviders(provRes.data || []);
      setAiConfig(aiRes.data || null);
      setAutomacoes(autoRes.data || []);
      setAdsSpend(adsRes.data || []);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const projectData = jsonFields(project.data);
  const avatarData = jsonFields(project.avatar);

  // ── Mapeamento dos 5 Nós do Funil ──
  const mapNodes = useMemo<MapNode[]>(() => {
    // 1. Origem / Tráfego
    const hasAds = adsSpend.length > 0;
    const hasCriativos = Boolean(projectData.criativos || projectData.roteiros || projectData.anuncios);
    const trafficStatus: NodeStatus = hasAds ? "operational" : hasCriativos ? "warning" : "offline";

    const node1Traffic: MapNode = {
      id: "trafego",
      step: 1,
      title: "1. Origem & Tráfego",
      subtitle: "Meta Ads, TikTok e Orgânico",
      icon: Radio,
      status: trafficStatus,
      statusLabel: trafficStatus === "operational" ? "Tráfego Ativo" : trafficStatus === "warning" ? "Esteira Pronta" : "Sem Tráfego",
      kpiLabel: "Gasto Ads (7d)",
      kpiValue: hasAds ? `R$ ${adsSpend.reduce((s, a) => s + (Number(a.valor) || 0), 0).toFixed(0)}` : "R$ 0",
      activeItems: [
        hasAds ? "Campanha de Ads sincronizada" : null,
        hasCriativos ? "Roteiros & criativos gerados" : null,
        projectData.links ? "Links de UTM configurados" : null,
      ].filter(Boolean) as string[],
      missingItems: [
        !hasAds ? "Nenhuma campanha de Meta Ads rodando" : null,
        !hasCriativos ? "Criar 5 ganchos de vídeo (Comment-to-DM)" : null,
      ].filter(Boolean) as string[],
      actionLabel: "Ver Criativos & Tráfego",
      targetTab: "raiox",
    };

    // 2. Captação & Leads
    const todayStr = new Date().toISOString().split("T")[0];
    const dayStartUtc = `${todayStr}T03:00:00.000Z`;
    const leadsHoje = leads.filter(l => l.criado_em && l.criado_em >= dayStartUtc).length;
    const leadsStatus: NodeStatus = leadsHoje > 0 ? "operational" : leads.length > 0 ? "warning" : "offline";

    const node2Leads: MapNode = {
      id: "leads",
      step: 2,
      title: "2. Captação & Leads",
      subtitle: "Opt-in, Quiz e Captura",
      icon: Users,
      status: leadsStatus,
      statusLabel: leadsStatus === "operational" ? `${leadsHoje} leads hoje` : leadsStatus === "warning" ? "Base Existente" : "Sem Captura",
      kpiLabel: "Total de Leads",
      kpiValue: leads.length,
      activeItems: [
        leads.length > 0 ? `${leads.length} leads no CRM deste projeto` : null,
        leadsHoje > 0 ? `${leadsHoje} novos leads hoje` : null,
      ].filter(Boolean) as string[],
      missingItems: [
        leadsHoje === 0 ? "Nenhum lead novo capturado hoje" : null,
        leads.length === 0 ? "Conectar webhook de entrada de leads" : null,
      ].filter(Boolean) as string[],
      actionLabel: "Abrir CRM de Leads",
      targetTab: "raiox",
    };

    // 3. Atendimento & IA Autônoma X1
    const hasActiveProvider = waProviders.some(p => p.is_active || p.status === "connected");
    const isAiEnabled = Boolean(aiConfig?.is_active ?? true);
    const isFullAutonomy = Boolean(aiConfig?.is_full_autonomy ?? true);
    const waStatus: NodeStatus = (hasActiveProvider && isAiEnabled) ? "operational" : hasActiveProvider ? "warning" : "offline";

    const node3X1: MapNode = {
      id: "atendimento",
      step: 3,
      title: "3. Motor IA Autônoma X1",
      subtitle: "Evolution API WhatsApp & Direct",
      icon: Bot,
      status: waStatus,
      statusLabel: waStatus === "operational" ? (isFullAutonomy ? "Autonomia 100%" : "IA Ativa") : waStatus === "warning" ? "WhatsApp Conectado" : "Desconectado",
      kpiLabel: "Chips Ativos",
      kpiValue: waProviders.length > 0 ? `${waProviders.length} conectado(s)` : "0",
      activeItems: [
        hasActiveProvider ? "Instância Evolution API conectada" : null,
        isAiEnabled ? "Agente Autônomo ativado" : null,
        isFullAutonomy ? "Modo 100% Autônomo (Zero transbordo humano)" : null,
      ].filter(Boolean) as string[],
      missingItems: [
        !hasActiveProvider ? "Conectar instância do WhatsApp na Evolution API" : null,
        !isAiEnabled ? "Ligar chave de IA Autônoma nas configurações" : null,
      ].filter(Boolean) as string[],
      actionLabel: "Configurar Motor WhatsApp",
      targetTab: "raiox",
    };

    // 4. Oferta, Mecanismo & Checkouts
    const produtos = Array.isArray(projectData.produtos) ? projectData.produtos : [];
    const hasProducts = produtos.length > 0;
    const hasCheckoutLink = produtos.some((p: any) => p.checkout_url || p.link) || Boolean(projectData.checkout_url || projectData.link_checkout);
    const hasMecanismo = Boolean(projectData.mecanismo || projectData.mecanismo_unico || projectData.tese);
    const offerStatus: NodeStatus = (hasProducts && hasCheckoutLink && hasMecanismo) ? "operational" : (hasProducts || hasMecanismo) ? "warning" : "offline";

    const node4Offer: MapNode = {
      id: "oferta",
      step: 4,
      title: "4. Oferta & Checkouts",
      subtitle: "Mecanismo Único e Links",
      icon: ShoppingCart,
      status: offerStatus,
      statusLabel: offerStatus === "operational" ? "Oferta Completa" : offerStatus === "warning" ? "Oferta Parcial" : "Sem Checkouts",
      kpiLabel: "Produtos Ativos",
      kpiValue: produtos.length,
      activeItems: [
        hasProducts ? `${produtos.length} produto(s) cadastrado(s)` : null,
        hasCheckoutLink ? "Links de checkout validados" : null,
        hasMecanismo ? "Mecanismo Único definido" : null,
      ].filter(Boolean) as string[],
      missingItems: [
        !hasProducts ? "Cadastrar produtos e preços no briefing" : null,
        !hasCheckoutLink ? "Inserir links de checkout (Kiwify / Hotmart)" : null,
        !hasMecanismo ? "Definir Mecanismo Único para diferenciar a oferta" : null,
      ].filter(Boolean) as string[],
      actionLabel: "Editar Produtos & Links",
      targetTab: "identidade",
    };

    // 5. Recuperação & Pós-Venda
    const hasAutomacoes = automacoes.length > 0;
    const carrinhosHoje = vendas.filter(v => (v.status || "").toLowerCase().includes("carrinho")).length;
    const pixHoje = vendas.filter(v => (v.status || "").toLowerCase().includes("pix")).length;
    const recoveryStatus: NodeStatus = hasAutomacoes ? "operational" : (carrinhosHoje + pixHoje > 0) ? "warning" : "offline";

    const node5Recovery: MapNode = {
      id: "recuperacao",
      step: 5,
      title: "5. Recuperação & Pós-Venda",
      subtitle: "Régua Anti-Vácuo, Pix e Carrinho",
      icon: RotateCcw,
      status: recoveryStatus,
      statusLabel: recoveryStatus === "operational" ? "Réguas Ativas" : recoveryStatus === "warning" ? "Recuperação Manual" : "Sem Régua",
      kpiLabel: "Pendências Hoje",
      kpiValue: carrinhosHoje + pixHoje,
      activeItems: [
        hasAutomacoes ? `${automacoes.length} fluxo(s) de automação ativos` : null,
        carrinhosHoje > 0 ? `${carrinhosHoje} carrinho(s) detectado(s) hoje` : null,
        pixHoje > 0 ? `${pixHoje} PIX gerado(s) hoje` : null,
      ].filter(Boolean) as string[],
      missingItems: [
        !hasAutomacoes ? "Ativar régua anti-vácuo de 3 tiros no X1" : null,
        (carrinhosHoje + pixHoje > 0 && !hasAutomacoes) ? "Disparar recuperação automática para os pendentes" : null,
      ].filter(Boolean) as string[],
      actionLabel: "Ver Funil & Recuperação",
      targetTab: "raiox",
    };

    return [node1Traffic, node2Leads, node3X1, node4Offer, node5Recovery];
  }, [adsSpend, projectData, leads, waProviders, aiConfig, automacoes, vendas]);

  // Cálculo da saúde geral do mapa
  const healthStats = useMemo(() => {
    const operationalCount = mapNodes.filter(n => n.status === "operational").length;
    const warningCount = mapNodes.filter(n => n.status === "warning").length;
    const offlineCount = mapNodes.filter(n => n.status === "offline").length;
    const score = Math.round((operationalCount * 100 + warningCount * 50) / mapNodes.length);

    // Identificar gargalo crítico
    const criticalNode = mapNodes.find(n => n.status === "offline") || mapNodes.find(n => n.status === "warning");

    return {
      score,
      operationalCount,
      warningCount,
      offlineCount,
      criticalNode,
    };
  }, [mapNodes]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ───────── Topo: Visão Executiva de Saúde ───────── */}
      <div className="bg-gradient-to-r from-[#0E1013] via-[#121418] to-primary/10 border border-[#1B1E23] rounded-2xl p-6 relative overflow-hidden shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-mono uppercase tracking-wider text-primary font-bold">
                MAPA OPERACIONAL DO PROJETO
              </span>
              <Badge variant="outline" className="text-[10px] bg-secondary/60 border-border/80 font-mono">
                {project.id}
              </Badge>
            </div>
            <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              Fluxo Ponta a Ponta: Tráfego ➔ X1 ➔ Checkout
            </h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Monitore visualmente o que está 100% ativo, onde a operação está rodando e exatamente o que está faltando para escalar.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={() => setMcpDialogOpen(true)}
              className="bg-primary hover:bg-primary/90 text-black font-semibold text-xs h-9 gap-1.5 shadow-lg shadow-primary/20"
            >
              <Zap className="h-3.5 w-3.5" />
              🔌 Conectar IA / MCP
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigateTab("raiox")}
              className="text-xs border-border/80 hover:border-primary/50 gap-1.5 h-9"
            >
              <Layers className="h-3.5 w-3.5 text-primary" />
              Raio-X Detalhado
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={loadData}
              title="Atualizar dados do mapa"
              className="h-9 w-9 text-muted-foreground hover:text-white"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Barra de Score da Operação */}
        <div className="mt-6 pt-5 border-t border-[#1B1E23] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="text-center sm:text-left">
              <span className="font-display text-3xl font-semibold text-gold leading-none">
                {healthStats.score}%
              </span>
              <p className="text-[10px] uppercase tracking-editorial text-muted-foreground mt-1">
                Saúde da Operação
              </p>
            </div>
            <div className="h-8 w-px bg-border/40 hidden sm:block" />
            <div className="flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-mono">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {healthStats.operationalCount} operando
              </span>
              <span className="inline-flex items-center gap-1.5 text-amber-400 font-mono">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                {healthStats.warningCount} atenção
              </span>
              <span className="inline-flex items-center gap-1.5 text-rose-400 font-mono">
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                {healthStats.offlineCount} faltando
              </span>
            </div>
          </div>

          {healthStats.criticalNode && (
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-2 flex items-center gap-2.5 text-xs text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
              <span>
                <strong>Gargalo atual:</strong> {healthStats.criticalNode.title} precisa de atenção.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ───────── O Mapa Visual dos 5 Nós Conectados ───────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 relative">
        {mapNodes.map((node, index) => {
          const isOperational = node.status === "operational";
          const isWarning = node.status === "warning";
          const isOffline = node.status === "offline";

          const statusBadge = isOperational ? (
            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] gap-1 font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              OPERANDO
            </Badge>
          ) : isWarning ? (
            <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px] gap-1 font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              ATENÇÃO
            </Badge>
          ) : (
            <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/30 text-[10px] gap-1 font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
              FALTANDO
            </Badge>
          );

          return (
            <Card
              key={node.id}
              className={`bg-[#0E1013] border transition-all duration-300 flex flex-col justify-between relative group ${
                isOperational
                  ? "border-[#1B1E23] hover:border-emerald-500/40"
                  : isWarning
                  ? "border-amber-500/30 hover:border-amber-500/60"
                  : "border-rose-500/30 hover:border-rose-500/60"
              }`}
            >
              <CardHeader className="p-4 pb-3 space-y-2 border-b border-[#1B1E23]">
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-xl border ${
                    isOperational
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                      : isWarning
                      ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                      : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                  }`}>
                    <node.icon className="h-4 w-4" />
                  </div>
                  {statusBadge}
                </div>

                <div>
                  <CardTitle className="text-sm font-bold text-white tracking-tight">
                    {node.title}
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {node.subtitle}
                  </p>
                </div>

                {/* Métrica Chave */}
                <div className="bg-[#121418] border border-white/5 rounded-lg p-2.5 flex items-baseline justify-between">
                  <span className="text-[10px] uppercase font-mono text-muted-foreground">
                    {node.kpiLabel}
                  </span>
                  <span className="font-mono font-bold text-sm text-primary">
                    {node.kpiValue}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                <div className="space-y-2.5 text-xs">
                  {/* Itens Ativos */}
                  {node.activeItems.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-mono font-semibold text-emerald-400">
                        Ativo / Conectado:
                      </span>
                      {node.activeItems.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 text-[11px] text-zinc-300">
                          <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />
                          <span className="leading-tight">{item}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Itens Faltando */}
                  {node.missingItems.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] uppercase font-mono font-semibold text-rose-400">
                        O que está faltando:
                      </span>
                      {node.missingItems.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 text-[11px] text-rose-300">
                          <AlertTriangle className="h-3 w-3 text-rose-400 shrink-0 mt-0.5" />
                          <span className="leading-tight">{item}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Botão de Ação Direta */}
                <div className="pt-3 border-t border-[#1B1E23] mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onNavigateTab(node.targetTab)}
                    className="w-full text-xs h-7 border-border/60 hover:border-primary/50 text-foreground group-hover:text-primary transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>{node.actionLabel}</span>
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ───────── Modal de Conexão MCP & IAs Externas ───────── */}
      <ProjetoMcpDialog
        open={mcpDialogOpen}
        onOpenChange={setMcpDialogOpen}
        project={project}
      />
    </div>
  );
}

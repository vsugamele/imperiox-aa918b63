import { useState, useEffect, useMemo, useCallback } from "react";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Globe,
  CreditCard,
  MessageCircle,
  Flame,
  Copy,
  Check,
  ExternalLink,
  Bot,
  Zap,
  TrendingUp,
  AlertTriangle,
  Layers,
  ArrowRight,
  Send,
  Loader2,
  CheckCircle2,
  Clock,
  Search,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { jsonFields } from "@/lib/json-fields";

interface Props {
  projects: Tables<"imphq_projects">[];
  onRefresh?: () => void;
}

interface ProjectCardData {
  project: Tables<"imphq_projects">;
  receita24h: number;
  vendas24hCount: number;
  receita30d: number;
  abandonosCount: number;
  pixPendentesCount: number;
  leads24hCount: number;
  hotLeadsCount: number;
  pendingConvsCount: number;
  inboundMsgs24hCount: number;
  waProvider: { instance_name: string; is_active: boolean; status: string } | null;
  aiConfig: { enabled: boolean; full_autonomy: boolean } | null;
  tasks: Array<{ id: string; title: string; priority: string | null; due_date: string | null; isDone: boolean }>;
  vslUrl: string;
  checkoutUrl: string;
  offerPrice: string;
  hasActiveAds: boolean;
  hasCreatives: boolean;
  bottlenecksCount: number;
}

const PROJECT_EMOJIS: Record<string, string> = {
  jp_freitas: "💈",
  linfaflow: "🌿",
  slimsoda: "🥤",
  tatuagem: "🎨",
  laise: "✈️",
  "dr---fitness": "💪",
  lipo: "💧",
};

export function MapaOperacionalGeral({ projects, onRefresh }: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "core" | "bottlenecks">("all");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [dispatchingWa, setDispatchingWa] = useState(false);

  const [cardsData, setCardsData] = useState<ProjectCardData[]>([]);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // 1. Vendas nas últimas 24h e 30d
      const { data: vendasData } = await supabase
        .from("imphq_vendas")
        .select("project_id, valor, status, created_at")
        .gte("created_at", last30d);

      // 2. Leads nas últimas 24h
      const { data: leadsData } = await supabase
        .from("imphq_leads")
        .select("project_id, id, score, criado_em")
        .gte("criado_em", last24h);

      // 3. Conversas no WhatsApp com unread_count > 0
      const { data: convsData } = await supabase
        .from("imphq_wa_conversations")
        .select("project_id, unread_count, last_message_at, status")
        .gt("unread_count", 0);

      // 4. Mensagens inbound 24h
      const { data: inboundData } = await supabase
        .from("imphq_wa_messages")
        .select("project_id, id, direction")
        .eq("direction", "incoming")
        .gte("created_at", last24h);

      // 5. Providers WA
      const { data: providersData } = await supabase
        .from("imphq_wa_providers")
        .select("project_id, instance_name, status, is_active");

      // 6. IA config
      const { data: aiConfigData } = await supabase
        .from("imphq_wa_ai_config")
        .select("project_id, enabled, full_autonomy");

      // 7. Kanban cards / Demandas
      const { data: kanbanData } = await supabase
        .from("imphq_kanban_cards")
        .select("id, project_id, title, priority, due_date, column_id, imphq_kanban_columns(title)")
        .order("created_at", { ascending: false });

      const vList = vendasData || [];
      const lList = leadsData || [];
      const cList = convsData || [];
      const inList = inboundData || [];
      const pList = providersData || [];
      const aList = aiConfigData || [];
      const kList = kanbanData || [];

      // Mapeia para cada projeto
      const mapped: ProjectCardData[] = projects.map((proj) => {
        const pId = proj.id;
        const pData = jsonFields(proj.data);

        // Vendas 24h
        const pVendas24h = vList.filter((v: any) => v.project_id === pId && v.created_at >= last24h);
        const aprovadas24h = pVendas24h.filter((v: any) => v.status === "aprovado");
        const receita24h = aprovadas24h.reduce((sum: number, v: any) => sum + Number(v.valor || 0), 0);
        const abandonos24h = pVendas24h.filter((v: any) => v.status === "carrinho_abandonado");
        const pix24h = pVendas24h.filter((v: any) => v.status === "pix_gerado");

        // Vendas 30d
        const pVendas30d = vList.filter((v: any) => v.project_id === pId && v.status === "aprovado");
        const receita30d = pVendas30d.reduce((sum: number, v: any) => sum + Number(v.valor || 0), 0);

        // Leads 24h
        const pLeads24h = lList.filter((l: any) => l.project_id === pId);
        const hotLeads = pLeads24h.filter((l: any) => Number(l.score || 0) >= 70);

        // Conversas e mensagens paradas (últimas 48h)
        const pConvs = cList.filter((c: any) => c.project_id === pId);
        const recentPendingConvs = pConvs.filter((c: any) =>
          c.last_message_at && new Date(c.last_message_at).getTime() >= Date.now() - 48 * 3600000
        );
        const pInbound = inList.filter((m: any) => m.project_id === pId);

        // Provider WA
        const prov = pList.find((pr: any) => pr.project_id === pId || (pId === "jp_freitas" && pr.instance_name === "jpfreitas")) || null;
        const ai = aList.find((a: any) => a.project_id === pId) || null;

        // Demandas / Kanban
        const pTasks = kList.filter((k: any) => k.project_id === pId).slice(0, 4).map((k: any) => {
          const colTitle = (k.imphq_kanban_columns?.title || "").toLowerCase();
          const isDone = colTitle.includes("done") || colTitle.includes("conclu") || colTitle.includes("finaliz");
          return {
            id: k.id,
            title: k.title,
            priority: k.priority,
            due_date: k.due_date,
            isDone,
          };
        });

        // VSL URL
        let vslUrl = "";
        if (pData.vsl_url && typeof pData.vsl_url === "string") vslUrl = pData.vsl_url;
        else if (Array.isArray(pData.produtos) && pData.produtos.length > 0) {
          const prod = pData.produtos.find((x: any) => x?.status === "ativo") || pData.produtos[0];
          if (Array.isArray(prod?.links) && prod.links.length > 0) vslUrl = prod.links[0];
        }
        if (!vslUrl && pData.links && typeof pData.links === "object") vslUrl = (pData.links as any).site || "";
        if (!vslUrl) {
          if (pId === "jp_freitas") vslUrl = "https://codigodoscortesperfeitos.vercel.app";
          else if (pId === "linfaflow") vslUrl = "https://linfaflow.com/";
          else if (pId === "slimsoda") vslUrl = "https://slimsoda.com/";
        }

        // Checkout URL
        let checkoutUrl = "";
        let offerPrice = "R$ 47,00";
        if (pData.checkout_url && typeof pData.checkout_url === "string") checkoutUrl = pData.checkout_url;
        else if (pId === "jp_freitas") {
          checkoutUrl = "https://codigodoscortesperfeitos.vercel.app/inscricao";
          offerPrice = "R$ 47,00 (Curso) + R$ 27,00 Bump";
        } else if (pId === "linfaflow") {
          checkoutUrl = "https://linfaflow.com/checkout";
          offerPrice = "R$ 197,00 (Pote 1)";
        } else if (pId === "slimsoda") {
          checkoutUrl = "https://slimsoda.com/checkout";
          offerPrice = "$ 69,00";
        }

        // Meta Ads status
        const creatives = Array.isArray(pData.facebook_creatives) ? pData.facebook_creatives : [];
        const hasActiveAds = creatives.some((c: any) => c.status === "ACTIVE" || c.status === "ACTIVE_CAMPAIGN");
        const hasCreatives = creatives.length > 0;

        // Contagem de gargalos
        let bCount = 0;
        if (recentPendingConvs.length > 0) bCount++;
        if (abandonos24h.length > 0 || pix24h.length > 0) bCount++;
        if (hasCreatives && !hasActiveAds) bCount++;
        if (prov && !prov.is_active) bCount++;

        return {
          project: proj,
          receita24h,
          vendas24hCount: aprovadas24h.length,
          receita30d,
          abandonosCount: abandonos24h.length,
          pixPendentesCount: pix24h.length,
          leads24hCount: pLeads24h.length,
          hotLeadsCount: hotLeads.length,
          pendingConvsCount: recentPendingConvs.length,
          inboundMsgs24hCount: pInbound.length,
          waProvider: prov,
          aiConfig: ai,
          tasks: pTasks,
          vslUrl,
          checkoutUrl,
          offerPrice,
          hasActiveAds,
          hasCreatives,
          bottlenecksCount: bCount,
        };
      });

      // Ordenar: Prioritários primeiro (jp_freitas, linfaflow, slimsoda)
      const coreIds = ["jp_freitas", "linfaflow", "slimsoda"];
      mapped.sort((a, b) => {
        const aIdx = coreIds.indexOf(a.project.id);
        const bIdx = coreIds.indexOf(b.project.id);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        // Depois por gargalos decrescente
        if (b.bottlenecksCount !== a.bottlenecksCount) return b.bottlenecksCount - a.bottlenecksCount;
        return a.project.name.localeCompare(b.project.name);
      });

      setCardsData(mapped);
    } catch (e: any) {
      console.error("Erro ao carregar mapa operacional geral:", e);
      toast.error("Falha ao carregar dados do mapa geral");
    } finally {
      setLoading(false);
    }
  }, [projects]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Totais consolidados da operação
  const totals = useMemo(() => {
    const rec24 = cardsData.reduce((s, c) => s + c.receita24h, 0);
    const vendas24 = cardsData.reduce((s, c) => s + c.vendas24hCount, 0);
    const abandonos = cardsData.reduce((s, c) => s + c.abandonosCount + c.pixPendentesCount, 0);
    const pendingConvs = cardsData.reduce((s, c) => s + c.pendingConvsCount, 0);
    const inMsgs = cardsData.reduce((s, c) => s + c.inboundMsgs24hCount, 0);
    const leads24 = cardsData.reduce((s, c) => s + c.leads24hCount, 0);
    const totalGargalos = cardsData.reduce((s, c) => s + c.bottlenecksCount, 0);
    return { rec24, vendas24, abandonos, pendingConvs, inMsgs, leads24, totalGargalos };
  }, [cardsData]);

  // Filtragem
  const filteredCards = useMemo(() => {
    const coreIds = ["jp_freitas", "linfaflow", "slimsoda"];
    return cardsData.filter((c) => {
      if (search.trim()) {
        const term = search.toLowerCase();
        const matchName = c.project.name?.toLowerCase().includes(term);
        const matchCat = c.project.category?.toLowerCase().includes(term);
        const matchId = c.project.id?.toLowerCase().includes(term);
        if (!matchName && !matchCat && !matchId) return false;
      }
      if (filterMode === "core") return coreIds.includes(c.project.id);
      if (filterMode === "bottlenecks") return c.bottlenecksCount > 0;
      return true;
    });
  }, [cardsData, search, filterMode]);

  const copyToClipboard = (text: string, key: string, label: string) => {
    if (!text) {
      toast.error(`Nenhum link configurado para ${label}`);
      return;
    }
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`${label} copiado!`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDispatchWaBriefing = async () => {
    setDispatchingWa(true);
    try {
      const res = await fetch("https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/daily-briefing-wa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_jid: "120363409438175766@g.us", force: true }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Raio-X disparado no grupo Imperio X com sucesso!");
    } catch (e: any) {
      console.error(e);
      toast.error(`Falha ao disparar no WhatsApp: ${e.message}`);
    } finally {
      setDispatchingWa(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ======================================================== */}
      {/* 1. HERO COCKPIT & PULSO DA OPERAÇÃO                      */}
      {/* ======================================================== */}
      <Card className="bg-[#0E1013] border-[#1B1E23] overflow-hidden relative shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <CardContent className="p-5 sm:p-6 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs uppercase font-mono tracking-wider font-bold text-primary">
                  TORRE DE CONTROLE MULTIPROJETOS
                </span>
                <Badge variant="outline" className="text-[10px] font-mono border-white/10 text-muted-foreground">
                  ECOSSISTEMA VIVO
                </Badge>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                Mapa Geral da Operação
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                Visão macro de todos os projetos, o que falta alinhar (gargalos em aberto), demandas dos sócios e atalhos de navegação direta.
              </p>
            </div>

            {/* Ações Globais */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 gap-1.5 text-xs font-mono"
                onClick={handleDispatchWaBriefing}
                disabled={dispatchingWa}
              >
                {dispatchingWa ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Disparar Raio-X no WhatsApp
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-white/10 text-zinc-300 hover:border-primary/40 gap-1.5 text-xs"
                onClick={() => navigate("/inbox?tab=fila")}
              >
                <MessageCircle className="h-3.5 w-3.5 text-primary" />
                Fila Unificada ({totals.pendingConvs})
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={loadAllData}
                className="text-muted-foreground hover:text-white gap-1 text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>
          </div>

          {/* 4 CARDS DE KPI MACRO */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-[#1B1E23]">
            {/* KPI 1 */}
            <div className="rounded-lg bg-[#121418] border border-white/5 p-3.5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CreditCard className="h-3 w-3 text-primary" /> Receita 24h
              </div>
              <div className="font-mono text-xl font-bold text-white mt-1">
                R$ {totals.rec24.toFixed(2)}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {totals.vendas24} vendas aprovadas hoje
              </div>
            </div>

            {/* KPI 2 */}
            <div className="rounded-lg bg-[#121418] border border-white/5 p-3.5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Flame className="h-3 w-3 text-amber-400" /> Em Recuperação
              </div>
              <div className={`font-mono text-xl font-bold mt-1 ${totals.abandonos > 0 ? "text-amber-400" : "text-white"}`}>
                {totals.abandonos} abandonos
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {totals.abandonos > 0 ? "Dinheiro na mesa aguardando ação" : "Nenhum abandono pendente"}
              </div>
            </div>

            {/* KPI 3 */}
            <div className="rounded-lg bg-[#121418] border border-white/5 p-3.5 cursor-pointer hover:border-primary/40 transition-colors" onClick={() => navigate("/inbox?tab=fila")}>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <MessageCircle className="h-3 w-3 text-green-400" /> Fila WhatsApp
              </div>
              <div className={`font-mono text-xl font-bold mt-1 ${totals.pendingConvs > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                {totals.pendingConvs} paradas
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {totals.inMsgs} msgs recebidas em 24h
              </div>
            </div>

            {/* KPI 4 */}
            <div className="rounded-lg bg-[#121418] border border-white/5 p-3.5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3 text-red-400" /> Gargalos Detectados
              </div>
              <div className={`font-mono text-xl font-bold mt-1 ${totals.totalGargalos > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                {totals.totalGargalos} itens
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Em {cardsData.filter(c => c.bottlenecksCount > 0).length} projetos ativos
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ======================================================== */}
      {/* 2. BARRA DE FILTROS & BUSCA RÁPIDA                       */}
      {/* ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0E1013] border border-[#1B1E23] p-3 rounded-lg">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar por projeto, produto ou nicho..."
            className="pl-8 h-8 text-xs bg-black/40 border-white/10"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] uppercase font-mono text-muted-foreground mr-1">Filtro:</span>
          <Button
            size="sm"
            variant={filterMode === "all" ? "default" : "outline"}
            className="h-7 text-xs border-white/10"
            onClick={() => setFilterMode("all")}
          >
            Todos ({cardsData.length})
          </Button>
          <Button
            size="sm"
            variant={filterMode === "core" ? "default" : "outline"}
            className="h-7 text-xs border-white/10"
            onClick={() => setFilterMode("core")}
          >
            ⭐ Principais / Core (3)
          </Button>
          <Button
            size="sm"
            variant={filterMode === "bottlenecks" ? "default" : "outline"}
            className={`h-7 text-xs ${filterMode === "bottlenecks" ? "bg-amber-500 text-black" : "border-amber-500/40 text-amber-400"}`}
            onClick={() => setFilterMode("bottlenecks")}
          >
            ⚠️ Com Gargalos ({cardsData.filter(c => c.bottlenecksCount > 0).length})
          </Button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. GRID DO MAPA GRANDE — PROJETO POR PROJETO             */}
      {/* ======================================================== */}
      <div className="space-y-4">
        {filteredCards.map((c) => {
          const p = c.project;
          const emoji = PROJECT_EMOJIS[p.id] || "🎯";

          return (
            <Card
              key={p.id}
              className={`bg-[#0E1013] border transition-all duration-200 overflow-hidden ${
                c.bottlenecksCount > 0 ? "border-amber-500/30 hover:border-amber-500/60" : "border-[#1B1E23] hover:border-primary/40"
              }`}
            >
              {/* Header do Card do Projeto */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-black/60 to-transparent border-b border-[#1B1E23] flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center text-xl shrink-0">
                    {emoji}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3
                        className="text-base sm:text-lg font-bold text-white hover:text-primary transition-colors cursor-pointer flex items-center gap-1.5"
                        onClick={() => navigate(`/projetos/${p.id}`)}
                      >
                        {p.name}
                        <ArrowRight className="h-3.5 w-3.5 opacity-60" />
                      </h3>
                      <Badge variant="outline" className="text-[10px] font-mono border-white/10 text-muted-foreground">
                        {p.category || "Operação"}
                      </Badge>
                      {c.bottlenecksCount > 0 ? (
                        <Badge className="text-[10px] font-mono bg-amber-500/20 text-amber-300 border-amber-500/30">
                          {c.bottlenecksCount} GARGALOS VIVOS
                        </Badge>
                      ) : (
                        <Badge className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                          100% ALINHADO
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>ID: <code className="font-mono text-zinc-300">{p.id}</code></span>
                      <span>·</span>
                      <span>Receita 30d: <strong className="text-zinc-200 font-mono">R$ {c.receita30d.toFixed(2)}</strong></span>
                      <span>·</span>
                      <span>Hoje: <strong className="text-emerald-400 font-mono">R$ {c.receita24h.toFixed(2)}</strong> ({c.vendas24hCount} vendas)</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-primary/40 text-primary hover:bg-primary/10 gap-1.5"
                    onClick={() => navigate(`/projetos/${p.id}`)}
                  >
                    Abrir Cockpit do Projeto
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Corpo em 3 Colunas: Gargalos / Demandas / Ativos */}
              <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
                {/* COLUNA 1: ⚠️ O QUE FALTA ALINHAR (Gargalos) */}
                <div className="bg-[#121418] border border-[#1E2228] rounded-lg p-3.5 space-y-2.5 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-300 pb-1.5 border-b border-white/5">
                      <span className="flex items-center gap-1.5 text-amber-400 uppercase tracking-wider font-mono">
                        <AlertTriangle className="h-3.5 w-3.5" /> O Que Falta Alinhar
                      </span>
                      <span className="font-mono text-muted-foreground">{c.bottlenecksCount} pendência(s)</span>
                    </div>

                    {/* Item 1: Mensagens WhatsApp */}
                    {c.pendingConvsCount > 0 ? (
                      <div className="flex items-center justify-between p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate"><strong>{c.pendingConvsCount} conversas</strong> paradas ({c.inboundMsgs24hCount} msgs)</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[11px] bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 shrink-0"
                          onClick={() => navigate(`/inbox?tab=whatsapp`)}
                        >
                          Atender →
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-2 rounded bg-black/40 border border-white/5 text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span>Fila WhatsApp: Todas as mensagens respondidas</span>
                      </div>
                    )}

                    {/* Item 2: Carrinhos Abandonados */}
                    {c.abandonosCount > 0 || c.pixPendentesCount > 0 ? (
                      <div className="flex items-center justify-between p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <Flame className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate"><strong>{c.abandonosCount + c.pixPendentesCount} abandonos</strong> aguardando recuperação</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[11px] bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 shrink-0"
                          onClick={() => navigate(`/projetos/${p.id}?tab=financas`)}
                        >
                          Recuperar →
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-2 rounded bg-black/40 border border-white/5 text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span>Recuperação: Sem abandonos pendentes hoje</span>
                      </div>
                    )}

                    {/* Item 3: Status Meta Ads */}
                    {c.hasCreatives ? (
                      c.hasActiveAds ? (
                        <div className="flex items-center gap-2 p-2 rounded bg-black/40 border border-white/5 text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                          <span>Tráfego Pago: 🟢 Anúncios rodando no Meta Ads</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300">
                          <div className="flex items-center gap-2 truncate pr-2">
                            <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">Campanhas pausadas no Meta Ads</span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[11px] bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 shrink-0"
                            onClick={() => navigate(`/projetos/${p.id}?tab=midia`)}
                          >
                            Ver Criativos →
                          </Button>
                        </div>
                      )
                    ) : (
                      <div className="flex items-center justify-between p-2 rounded bg-black/40 border border-white/5 text-muted-foreground">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="truncate">Criativos: Gerar esteira de testes</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[11px] text-primary hover:bg-primary/10 shrink-0"
                          onClick={() => navigate(`/projetos/${p.id}?tab=criativos`)}
                        >
                          Gerar →
                        </Button>
                      </div>
                    )}
                  </div>

                  <p className="text-[10px] text-muted-foreground/80 italic pt-1 border-t border-white/5">
                    💡 Resolva os itens destacados para liberar escala de tráfego.
                  </p>
                </div>

                {/* COLUNA 2: 📋 DEMANDAS & KANBAN (O que executar) */}
                <div className="bg-[#121418] border border-[#1E2228] rounded-lg p-3.5 space-y-2.5 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-300 pb-1.5 border-b border-white/5">
                      <span className="flex items-center gap-1.5 text-primary uppercase tracking-wider font-mono">
                        <Layers className="h-3.5 w-3.5" /> Demandas & Tarefas
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-white"
                        onClick={() => navigate(`/projetos/${p.id}?tab=comando`)}
                      >
                        Ver Quadro →
                      </Button>
                    </div>

                    {c.tasks.length > 0 ? (
                      <div className="space-y-1.5">
                        {c.tasks.map((task) => (
                          <div
                            key={task.id}
                            className={`p-2 rounded border flex items-center justify-between gap-2 ${
                              task.isDone ? "bg-black/30 border-white/5 text-muted-foreground line-through" : "bg-black/60 border-white/10 text-zinc-200"
                            }`}
                          >
                            <span className="truncate">{task.title}</span>
                            {task.priority === "urgent" && (
                              <Badge className="text-[9px] bg-red-500/20 text-red-300 border-red-500/30 shrink-0">
                                URGENTE
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 text-center text-muted-foreground bg-black/30 rounded border border-white/5">
                        <p className="text-xs">Nenhuma tarefa pendente no quadro.</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      Leads 24h: <strong className="text-white">{c.leads24hCount}</strong>
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[11px] text-primary hover:bg-primary/10 gap-1"
                      onClick={() => navigate(`/leads?project=${p.id}`)}
                    >
                      Ver Leads →
                    </Button>
                  </div>
                </div>

                {/* COLUNA 3: 🌐 ATIVOS OFICIAIS & NAVEGAÇÃO */}
                <div className="bg-[#121418] border border-[#1E2228] rounded-lg p-3.5 space-y-2.5 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-300 pb-1.5 border-b border-white/5">
                      <span className="flex items-center gap-1.5 text-emerald-400 uppercase tracking-wider font-mono">
                        <Globe className="h-3.5 w-3.5" /> Ativos & Checkout
                      </span>
                      <Badge variant="outline" className="text-[9px] font-mono border-white/10 text-zinc-400">
                        {c.offerPrice}
                      </Badge>
                    </div>

                    {/* VSL Link */}
                    <div className="flex items-center justify-between gap-1.5 bg-black/50 p-2 rounded border border-white/5">
                      <div className="truncate pr-2">
                        <span className="text-[10px] uppercase font-mono text-muted-foreground block">Página / VSL:</span>
                        <span className="font-mono text-zinc-300 text-[11px] truncate block" title={c.vslUrl}>
                          {c.vslUrl || "Não configurado"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-white"
                          onClick={() => copyToClipboard(c.vslUrl, `vsl_${p.id}`, "Link da VSL")}
                          title="Copiar URL"
                        >
                          {copiedKey === `vsl_${p.id}` ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        </Button>
                        {c.vslUrl && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-white"
                            onClick={() => window.open(c.vslUrl, "_blank")}
                            title="Abrir em nova aba"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Checkout Link */}
                    <div className="flex items-center justify-between gap-1.5 bg-black/50 p-2 rounded border border-white/5">
                      <div className="truncate pr-2">
                        <span className="text-[10px] uppercase font-mono text-muted-foreground block">Checkout Oficial:</span>
                        <span className="font-mono text-zinc-300 text-[11px] truncate block" title={c.checkoutUrl}>
                          {c.checkoutUrl || "Não configurado"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-white"
                          onClick={() => copyToClipboard(c.checkoutUrl, `chk_${p.id}`, "Checkout")}
                          title="Copiar Checkout"
                        >
                          {copiedKey === `chk_${p.id}` ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        </Button>
                        {c.checkoutUrl && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-white"
                            onClick={() => window.open(c.checkoutUrl, "_blank")}
                            title="Abrir checkout"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Status Chip / IA */}
                    <div className="p-2 rounded bg-black/30 border border-white/5 flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Bot className="h-3.5 w-3.5 text-primary" />
                        Instância: <strong className="text-zinc-200">{c.waProvider?.instance_name || "Nenhuma"}</strong>
                      </span>
                      <span className="font-mono text-emerald-400">
                        {c.aiConfig?.full_autonomy ? "⚡ 100% IA" : "Co-piloto"}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[11px] text-muted-foreground hover:text-white gap-1 w-full justify-center"
                      onClick={() => navigate(`/projetos/${p.id}?tab=mapa`)}
                    >
                      <Layers className="h-3 w-3" />
                      Abrir Canvas Visual do Funil →
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

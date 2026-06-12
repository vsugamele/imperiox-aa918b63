import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Search, ChevronLeft, ChevronRight, ArrowDown, ArrowUp, ChevronRight as ChevronExpandRight, ChevronDown, SlidersHorizontal, ImageIcon, History } from "lucide-react";
import { toast } from "sonner";
import { StatusToggle } from "./StatusToggle";
import { RoasBadge, CpaCell } from "./RoasBadge";
import { BudgetEditor } from "./BudgetEditor";
import { BulkActionsBar } from "./BulkActionsBar";
import { BulkBudgetDialog, type BulkBudgetMode } from "./BulkBudgetDialog";
import { DeltaBadge } from "./DeltaBadge";
import { Sparkline } from "./Sparkline";
import { AnomalyBadge } from "./AnomalyBadge";
import { QuickFilters, type QuickFilterKey } from "./QuickFilters";
import { InlineRename } from "./InlineRename";
import { RowHistoryDrawer } from "./RowHistoryDrawer";
import { CampaignComparator } from "./CampaignComparator";
import { computeVerdict, verdictColor, type Verdict } from "@/lib/adsVerdict";
import { cn } from "@/lib/utils";
import { useRevenueMode, getRevenue, type RevenueMode } from "@/lib/revenueMode";

interface VendaItem {
  produto_nome?: string;
  utm_campaign?: string | null;
  valor: number;
  valor_liquido?: number | null;
}

interface Props {
  ads: any[];
  adsPrev?: any[];
  vendas?: VendaItem[];
  projectId?: string;
  onAfterToggle?: () => void;
  forcedSearch?: string;
  onSearchChange?: () => void;
  /** Série diária por campaign_id (para sparkline). Cada array tem ordem cronológica. */
  dailySpendByCamp?: Map<string, number[]>;
}

type Level = "campaign" | "adset" | "ad";
type SortKey = "name" | "valor" | "impressoes" | "cliques" | "ctr" | "cpc" | "ic" | "cpi" | "compras" | "cpa" | "receita" | "roas" | "daily_budget" | "hook_rate" | "cpm" | "frequencia" | "alcance" | "lp_views" | "lp_to_ckt" | "verdict" | "trend";

interface Row {
  level: Level;
  id: string;
  parent_id?: string | null;
  name: string;
  effective_status: string | null;
  daily_budget: number | null;
  thumbnail_url?: string | null;
  creative_body?: string | null;
  creative_title?: string | null;
  source?: string | null;
  valor: number;
  impressoes: number;
  cliques: number;
  link_clicks: number;
  init_checkout: number;
  compras: number;
  hook_rate: number;
  cpm: number;
  frequencia: number;
  alcance: number;
  lp_views: number;
  receita: number;
  ticket?: number;
}

const fnFor = (row: Row) => row.source === "zernio" ? "zernio-ads-toggle" : "facebook-ads-toggle";
const hasValidId = (row: Row) => !!row.id && row.id !== "—" && (row.source === "zernio" || /^\d+$/.test(row.id));

const PAGE_SIZES = [10, 20, 50] as const;

const COLUMN_GROUPS = {
  basic: { label: "Básico", cols: ["trend", "valor", "impressoes", "cliques", "ctr", "cpc"] as SortKey[] },
  funnel: { label: "Funil", cols: ["hook_rate", "cpm", "frequencia", "alcance", "lp_views", "lp_to_ckt", "ic", "cpi"] as SortKey[] },
  perf: { label: "Performance", cols: ["compras", "cpa", "receita", "roas", "daily_budget", "verdict"] as SortKey[] },
} as const;

const DEFAULT_VISIBLE = new Set<SortKey>([
  "trend", "valor", "cliques", "ctr", "ic", "cpi", "compras", "cpa", "receita", "roas", "daily_budget", "verdict",
]);

function buildRows(ads: any[], vendas: VendaItem[], revenueMode: RevenueMode): { campaigns: Row[]; adsetsByCampaign: Map<string, Row[]>; adsByAdset: Map<string, Row[]> } {
  // Receita por nome de campanha (utm) — respeita modo bruto/líquido
  const revByCamp = new Map<string, number>();
  let avgTicket = 0;
  if (vendas.length) {
    const total = vendas.reduce((s, v) => s + getRevenue(v, revenueMode), 0);
    avgTicket = total / vendas.length;
    for (const v of vendas) {
      const k = (v.utm_campaign || "").trim().toLowerCase();
      if (!k) continue;
      revByCamp.set(k, (revByCamp.get(k) || 0) + getRevenue(v, revenueMode));
    }
  }

  const aggregate = (key: string, rows: any[], level: Level, name: string, parent_id?: string | null): Row => {
    const r: Row = {
      level, id: key, parent_id: parent_id ?? null, name,
      effective_status: null, daily_budget: null,
      thumbnail_url: null, creative_body: null, creative_title: null, source: null,
      valor: 0, impressoes: 0, cliques: 0, link_clicks: 0, init_checkout: 0, compras: 0,
      hook_rate: 0, cpm: 0, frequencia: 0, alcance: 0, lp_views: 0, receita: 0,
    };
    let hookSum = 0, hookN = 0, cpmSum = 0, cpmN = 0, freqSum = 0, freqN = 0;
    for (const a of rows) {
      r.valor += Number(a.valor) || 0;
      r.impressoes += Number(a.impressoes) || 0;
      r.cliques += Number(a.cliques) || 0;
      r.link_clicks += Number(a.link_clicks) || 0;
      r.init_checkout += Number(a.init_checkout) || 0;
      r.compras += Number(a.compras) || 0;
      r.alcance += Number(a.alcance) || 0;
      r.lp_views += Number(a.landing_page_views) || 0;
      if (a.hook_rate != null) { hookSum += Number(a.hook_rate); hookN++; }
      if (a.cpm != null) { cpmSum += Number(a.cpm); cpmN++; }
      if (a.frequencia != null) { freqSum += Number(a.frequencia); freqN++; }
      if (!r.effective_status && a.effective_status) r.effective_status = a.effective_status;
      if (r.daily_budget == null && a.daily_budget != null) r.daily_budget = Number(a.daily_budget);
      if (!r.thumbnail_url && a.thumbnail_url) r.thumbnail_url = a.thumbnail_url;
      if (!r.creative_body && a.creative_body) r.creative_body = a.creative_body;
      if (!r.creative_title && a.creative_title) r.creative_title = a.creative_title;
      if (!r.source && a.source) r.source = a.source;
    }
    r.hook_rate = hookN ? hookSum / hookN : 0;
    r.cpm = cpmN ? cpmSum / cpmN : 0;
    r.frequencia = freqN ? freqSum / freqN : 0;
    const lname = name.trim().toLowerCase();
    r.receita = revByCamp.get(lname) || (level === "campaign" && r.compras > 0 && avgTicket ? avgTicket * r.compras : 0);
    r.ticket = r.compras > 0 ? r.receita / r.compras : undefined;
    return r;
  };

  // Group by campaign
  const byCamp = new Map<string, any[]>();
  for (const a of ads) {
    const k = a.campaign_id || a.campanha || "Sem nome";
    if (!byCamp.has(k)) byCamp.set(k, []);
    byCamp.get(k)!.push(a);
  }

  const campaigns: Row[] = [];
  const adsetsByCampaign = new Map<string, Row[]>();
  const adsByAdset = new Map<string, Row[]>();

  for (const [campKey, campRows] of byCamp.entries()) {
    const campName = campRows[0]?.campanha || "Sem nome";
    campaigns.push(aggregate(campKey, campRows, "campaign", campName));

    // adsets
    const byAdset = new Map<string, any[]>();
    for (const a of campRows) {
      const ak = a.adset_id || a.conjunto_anuncios || "—";
      if (!byAdset.has(ak)) byAdset.set(ak, []);
      byAdset.get(ak)!.push(a);
    }
    const adsetRows: Row[] = [];
    for (const [adsetKey, adsetRowsArr] of byAdset.entries()) {
      const adsetName = adsetRowsArr[0]?.conjunto_anuncios || "Sem conjunto";
      adsetRows.push(aggregate(adsetKey, adsetRowsArr, "adset", adsetName, campKey));

      // ads
      const byAd = new Map<string, any[]>();
      for (const a of adsetRowsArr) {
        const adk = a.ad_id || a.anuncio || "—";
        if (!byAd.has(adk)) byAd.set(adk, []);
        byAd.get(adk)!.push(a);
      }
      const adRows: Row[] = [];
      for (const [adKey, adArr] of byAd.entries()) {
        const adName = adArr[0]?.anuncio || "Sem anúncio";
        adRows.push(aggregate(adKey, adArr, "ad", adName, adsetKey));
      }
      adsByAdset.set(adsetKey, adRows);
    }
    adsetsByCampaign.set(campKey, adsetRows);
  }

  return { campaigns, adsetsByCampaign, adsByAdset };
}

function num(v: number) { return v.toLocaleString("pt-BR"); }
function brl(v: number) { return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function pct(v: number) { return `${v.toFixed(1)}%`; }

function enrich(r: Row, ticketMedioGlobal = 0) {
  const ctr = r.impressoes ? (r.cliques / r.impressoes) * 100 : 0;
  const cpc = r.cliques ? r.valor / r.cliques : 0;
  const cpi = r.init_checkout ? r.valor / r.init_checkout : 0;
  const cpa = r.compras ? r.valor / r.compras : 0;
  const roas = r.valor > 0 ? r.receita / r.valor : 0;
  const lp_to_ckt = r.lp_views ? (r.init_checkout / r.lp_views) * 100 : 0;
  const v = computeVerdict({
    valor: r.valor, compras: r.compras, receita: r.receita,
    frequencia: r.frequencia, ticketMedioGlobal,
  });
  return { ...r, ctr, cpc, cpi, cpa, roas, ic: r.init_checkout, lp_to_ckt, verdict: v.verdict, verdictReason: v.reason };
}

export function CampanhasTable({ ads, adsPrev = [], vendas = [], projectId, onAfterToggle, forcedSearch, onSearchChange, dailySpendByCamp }: Props) {
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("roas");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<Map<string, string>>(new Map());
  const [optimisticBudget, setOptimisticBudget] = useState<Map<string, number>>(new Map());
  const [optimisticName, setOptimisticName] = useState<Map<string, string>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState<Set<SortKey>>(new Set(DEFAULT_VISIBLE));
  const [bulkLoading, setBulkLoading] = useState(false);
  const [quickFilter, setQuickFilter] = useState<QuickFilterKey>(null);
  const [bulkBudgetOpen, setBulkBudgetOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<{ id: string; name: string } | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);

  const [revenueMode] = useRevenueMode();
  const { campaigns, adsetsByCampaign, adsByAdset } = useMemo(() => buildRows(ads, vendas, revenueMode), [ads, vendas, revenueMode]);

  // Período anterior — agrega por campaign_id para lookup Δ%
  const prevByCamp = useMemo(() => {
    const m = new Map<string, { valor: number; compras: number; cpa: number }>();
    if (!adsPrev?.length) return m;
    const grouped = new Map<string, any[]>();
    for (const a of adsPrev) {
      const k = a.campaign_id || a.campanha || "—";
      if (!grouped.has(k)) grouped.set(k, []);
      grouped.get(k)!.push(a);
    }
    grouped.forEach((items, k) => {
      const valor = items.reduce((s, x) => s + Number(x.valor || 0), 0);
      const compras = items.reduce((s, x) => s + Number(x.compras || 0), 0);
      const cpa = compras ? valor / compras : 0;
      m.set(k, { valor, compras, cpa });
    });
    return m;
  }, [adsPrev]);

  const ticketMedioGlobal = useMemo(() => {
    if (!vendas.length) return 0;
    return vendas.reduce((s, v) => s + getRevenue(v, revenueMode), 0) / vendas.length;
  }, [vendas, revenueMode]);

  // Busca forçada (vinda dos alertas)
  useEffect(() => {
    if (forcedSearch) { setSearch(forcedSearch); setPage(1); }
  }, [forcedSearch]);

  const enrichedCampaigns = useMemo(() => {
    const filtered = campaigns.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()));
    const e = filtered.map(r => enrich(r, ticketMedioGlobal));
    e.sort((a, b) => {
      const av = (a as any)[sortKey] ?? (sortKey === "name" ? a.name : 0);
      const bv = (b as any)[sortKey] ?? (sortKey === "name" ? b.name : 0);
      if (typeof av === "string" || typeof bv === "string") {
        return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return e;
  }, [campaigns, search, sortKey, sortDir, ticketMedioGlobal]);

  // Contagens dos filtros rápidos (sobre o universo já buscado, antes do filtro)
  const quickCounts = useMemo(() => {
    const c = { ESCALAR: 0, MATAR: 0, SATURADO: 0, SEM_VENDA: 0, PAUSADO: 0 };
    for (const r of enrichedCampaigns) {
      const v = (r as any).verdict as Verdict;
      if (v === "ESCALAR") c.ESCALAR++;
      if (v === "MATAR") c.MATAR++;
      if (r.frequencia > 4) c.SATURADO++;
      if (r.compras === 0 && r.valor > 50) c.SEM_VENDA++;
      const status = optimistic.get(r.id) ?? r.effective_status;
      if (status === "PAUSED") c.PAUSADO++;
    }
    return c;
  }, [enrichedCampaigns, optimistic]);

  // Aplica filtro rápido por cima
  const filteredByQuick = useMemo(() => {
    if (!quickFilter) return enrichedCampaigns;
    return enrichedCampaigns.filter((r) => {
      const v = (r as any).verdict as Verdict;
      const status = optimistic.get(r.id) ?? r.effective_status;
      if (quickFilter === "ESCALAR") return v === "ESCALAR";
      if (quickFilter === "MATAR") return v === "MATAR";
      if (quickFilter === "SATURADO") return r.frequencia > 4;
      if (quickFilter === "SEM_VENDA") return r.compras === 0 && r.valor > 50;
      if (quickFilter === "PAUSADO") return status === "PAUSED";
      return true;
    });
  }, [enrichedCampaigns, quickFilter, optimistic]);

  const totalPages = Math.max(1, Math.ceil(filteredByQuick.length / pageSize));
  const pageRows = filteredByQuick.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [quickFilter]);

  useEffect(() => { setSelected(new Set()); }, [projectId]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const callToggle = async (entity_type: Level, row: Row, next: "ACTIVE" | "PAUSED") => {
    if (!projectId) { toast.error("Selecione um projeto antes."); return false; }
    if (!hasValidId(row)) { toast.error("Entidade sem ID. Sincronize primeiro."); return false; }
    setTogglingId(row.id);
    const prev = optimistic.get(row.id) ?? row.effective_status;
    setOptimistic(m => new Map(m).set(row.id, next));
    try {
      const { data, error } = await supabase.functions.invoke(fnFor(row), {
        body: { project_id: projectId, entity_type, entity_id: row.id, entity_name: row.name, action: next, previous_status: prev },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || "Falha");
      return true;
    } catch (e: any) {
      setOptimistic(m => { const n = new Map(m); n.set(row.id, prev || "PAUSED"); return n; });
      toast.error(e.message || "Erro ao alterar status");
      return false;
    } finally {
      setTogglingId(null);
    }
  };

  const handleToggle = async (entity_type: Level, row: Row, next: "ACTIVE" | "PAUSED") => {
    const ok = await callToggle(entity_type, row, next);
    if (ok) {
      toast.success(next === "ACTIVE" ? "Ativado" : "Pausado");
      onAfterToggle?.();
    }
  };

  const handleBudget = async (entity_type: Level, row: Row, next: number) => {
    if (!projectId) { toast.error("Selecione um projeto antes."); return; }
    if (!hasValidId(row)) { toast.error("Entidade sem ID."); return; }
    const prev = row.daily_budget;
    setOptimisticBudget(m => new Map(m).set(row.id, next));
    try {
      const { data, error } = await supabase.functions.invoke(fnFor(row), {
        body: { project_id: projectId, entity_type, entity_id: row.id, entity_name: row.name, action: "UPDATE_BUDGET", daily_budget: next, previous_budget: prev },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || "Falha");
      toast.success(`Orçamento atualizado: ${brl(next)}`);
      onAfterToggle?.();
    } catch (e: any) {
      setOptimisticBudget(m => { const n = new Map(m); if (prev != null) n.set(row.id, prev); else n.delete(row.id); return n; });
      toast.error(e.message || "Erro ao atualizar orçamento");
    }
  };

  const runBulk = async (action: "ACTIVE" | "PAUSED" | "DUPLICATE_CAMPAIGN") => {
    if (!projectId) { toast.error("Selecione um projeto antes."); return; }
    const rows = enrichedCampaigns.filter(r => selected.has(r.id) && hasValidId(r));
    if (rows.length === 0) { toast.error("Nenhuma campanha válida selecionada"); return; }
    setBulkLoading(true);
    let okCount = 0, errCount = 0;
    const results = await Promise.allSettled(rows.map(r =>
      supabase.functions.invoke(fnFor(r), {
        body: {
          project_id: projectId, entity_type: "campaign", entity_id: r.id, entity_name: r.name,
          action, previous_status: r.effective_status,
        },
      })
    ));
    for (const res of results) {
      if (res.status === "fulfilled" && !(res.value as any)?.error && !(res.value as any)?.data?.error) okCount++;
      else errCount++;
    }
    setBulkLoading(false);
    setSelected(new Set());
    if (okCount) toast.success(`${okCount} campanha(s) processada(s)`);
    if (errCount) toast.error(`${errCount} falha(s)`);
    onAfterToggle?.();
  };

  const SortHeader = ({ k, label, align = "right" }: { k: SortKey; label: string; align?: "left" | "right" }) => (
    <TableHead className={cn("text-[10px] uppercase tracking-wider cursor-pointer select-none whitespace-nowrap", align === "right" && "text-right")} onClick={() => toggleSort(k)}>
      <span className={cn("inline-flex items-center gap-1", align === "right" && "justify-end w-full")}>
        {label}
        {sortKey === k && (sortDir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
      </span>
    </TableHead>
  );

  const isVisible = (k: SortKey) => visible.has(k);

  const renderSubRows = (campaign: Row, depth = 1) => {
    const adsets = adsetsByCampaign.get(campaign.id) || [];
    const sortedAdsets = [...adsets].map(r => enrich(r, ticketMedioGlobal)).sort((a, b) => b.valor - a.valor);
    return sortedAdsets.map((adset) => {
      const adsetExpanded = expanded.has(adset.id);
      const adsetStatus = optimistic.get(adset.id) ?? adset.effective_status;
      const adsetBudget = optimisticBudget.has(adset.id) ? optimisticBudget.get(adset.id)! : adset.daily_budget;
      return (
        <ReactFragment key={`adset-${adset.id}`} adset={adset} adsetStatus={adsetStatus} adsetBudget={adsetBudget} adsetExpanded={adsetExpanded}
          onExpand={() => setExpanded(s => { const n = new Set(s); n.has(adset.id) ? n.delete(adset.id) : n.add(adset.id); return n; })}
          onToggle={(next) => handleToggle("adset", adset, next)}
          onBudget={(next) => handleBudget("adset", adset, next)}
          loading={togglingId === adset.id}
          isVisible={isVisible}
          depth={depth}
          adsRows={(adsByAdset.get(adset.id) || []).map(r => enrich(r, ticketMedioGlobal)).sort((a, b) => b.valor - a.valor)}
          optimistic={optimistic}
          optimisticBudget={optimisticBudget}
          togglingId={togglingId}
          onAdToggle={(ad, next) => handleToggle("ad", ad, next)}
          onAdBudget={(ad, next) => handleBudget("ad", ad, next)}
        />
      );
    });
  };

  const visibleColCount = 4 /* expand+check+toggle+name */ + Array.from(visible).length;

  return (
    <div className="space-y-3">
      <QuickFilters active={quickFilter} counts={quickCounts} onChange={setQuickFilter} />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar campanha..."
            className="pl-9 h-9 bg-secondary/30 border-border/40 text-sm"
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5">
                <SlidersHorizontal className="h-3 w-3" /> Colunas ({visible.size})
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 bg-secondary/95 border-border/40">
              <div className="space-y-3 text-xs">
                {Object.entries(COLUMN_GROUPS).map(([gk, g]) => (
                  <div key={gk}>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{g.label}</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {g.cols.map((c) => (
                        <label key={c} className="flex items-center gap-1.5 cursor-pointer hover:text-foreground">
                          <Checkbox
                            checked={visible.has(c)}
                            onCheckedChange={(v) => setVisible(s => { const n = new Set(s); v ? n.add(c) : n.delete(c); return n; })}
                          />
                          <span className="capitalize">{labelFor(c)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <span>{enrichedCampaigns.length} registros</span>
          <span className="opacity-60">Exibir</span>
          {PAGE_SIZES.map((s) => (
            <button key={s} onClick={() => { setPageSize(s); setPage(1); }} className={cn("px-2 py-0.5 rounded", pageSize === s ? "bg-primary/20 text-primary" : "hover:bg-secondary/50")}>{s}</button>
          ))}
          <div className="flex items-center gap-1 ml-2">
            <Button size="icon" variant="ghost" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}><ChevronLeft className="h-3.5 w-3.5" /></Button>
            <span className="tabular-nums">{page}/{totalPages}</span>
            <Button size="icon" variant="ghost" className="h-7 w-7" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}><ChevronRight className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border/40 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border/30 hover:bg-transparent">
              <TableHead className="w-6"></TableHead>
              <TableHead className="w-8"></TableHead>
              <TableHead className="w-12"></TableHead>
              <SortHeader k="name" label="Nome" align="left" />
              {isVisible("trend") && <TableHead className="text-[10px] uppercase tracking-wider whitespace-nowrap">Tend.</TableHead>}
              {isVisible("valor") && <SortHeader k="valor" label="Invest." />}
              {isVisible("impressoes") && <SortHeader k="impressoes" label="Impr." />}
              {isVisible("cliques") && <SortHeader k="cliques" label="Cliq." />}
              {isVisible("ctr") && <SortHeader k="ctr" label="CTR" />}
              {isVisible("cpc") && <SortHeader k="cpc" label="CPC" />}
              {isVisible("hook_rate") && <SortHeader k="hook_rate" label="Hook" />}
              {isVisible("cpm") && <SortHeader k="cpm" label="CPM" />}
              {isVisible("frequencia") && <SortHeader k="frequencia" label="Freq" />}
              {isVisible("alcance") && <SortHeader k="alcance" label="Alcance" />}
              {isVisible("lp_views") && <SortHeader k="lp_views" label="LP Views" />}
              {isVisible("lp_to_ckt") && <SortHeader k="lp_to_ckt" label="LP→CKT" />}
              {isVisible("ic") && <SortHeader k="ic" label="IC" />}
              {isVisible("cpi") && <SortHeader k="cpi" label="CPI" />}
              {isVisible("compras") && <SortHeader k="compras" label="Compras" />}
              {isVisible("cpa") && <SortHeader k="cpa" label="CPA" />}
              {isVisible("receita") && <SortHeader k="receita" label="Receita" />}
              {isVisible("roas") && <SortHeader k="roas" label="ROAS" />}
              {isVisible("daily_budget") && <SortHeader k="daily_budget" label="Orç./Dia" />}
              {isVisible("verdict") && <SortHeader k="verdict" label="Veredito" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 && (
              <TableRow><TableCell colSpan={visibleColCount} className="text-center text-muted-foreground py-10 text-xs">Nenhuma campanha no período.</TableCell></TableRow>
            )}
            {pageRows.map((row) => {
              const id = row.id;
              const status = optimistic.get(id) ?? row.effective_status;
              const checked = selected.has(id);
              const isExpanded = expanded.has(id);
              const dailyBudget = optimisticBudget.has(id) ? optimisticBudget.get(id)! : row.daily_budget;
              return (
                <>
                  <TableRow key={id} className="group border-border/20 text-xs hover:bg-secondary/20">
                    <TableCell>
                      <button onClick={() => setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; })} className="text-muted-foreground hover:text-primary">
                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronExpandRight className="h-3.5 w-3.5" />}
                      </button>
                    </TableCell>
                    <TableCell><Checkbox checked={checked} onCheckedChange={(v) => {
                      setSelected(s => { const n = new Set(s); v ? n.add(id) : n.delete(id); return n; });
                    }} /></TableCell>
                    <TableCell>
                      <StatusToggle status={status} loading={togglingId === id} onChange={(next) => handleToggle("campaign", row, next)} />
                    </TableCell>
                    <TableCell className="font-medium text-foreground/90 max-w-[320px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {row.source === "zernio" && (
                          <span className="shrink-0 text-[9px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30" title="Sincronizado via Zernio">Zernio</span>
                        )}
                        <InlineRename
                          value={optimisticName.get(id) ?? row.name}
                          disabled={!hasValidId(row)}
                          onSave={async (next) => {
                            const prev = optimisticName.get(id) ?? row.name;
                            setOptimisticName(m => new Map(m).set(id, next));
                            const ok = await callRename(supabase, projectId, "campaign", row, next, prev);
                            if (!ok) setOptimisticName(m => { const n = new Map(m); n.set(id, prev); return n; });
                            else onAfterToggle?.();
                          }}
                          className="flex-1 min-w-0"
                        />
                        <button
                          onClick={() => setHistoryTarget({ id, name: optimisticName.get(id) ?? row.name })}
                          className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition shrink-0 text-muted-foreground hover:text-primary"
                          title="Ver histórico"
                        >
                          <History className="h-3 w-3" />
                        </button>
                      </div>
                    </TableCell>
                    {isVisible("trend") && <TableCell>
                      <Sparkline data={dailySpendByCamp?.get(id) || []} title="Gasto diário no período" />
                    </TableCell>}
                    {isVisible("valor") && <TableCell className="text-right tabular-nums">
                      <div className="flex flex-col items-end">
                        <span className="inline-flex items-center gap-1">
                          <AnomalyBadge series={dailySpendByCamp?.get(id) || []} label="gasto diário" />
                          {brl(row.valor)}
                        </span>
                        <DeltaBadge current={row.valor} previous={prevByCamp.get(row.id)?.valor || 0} inverse={false} />
                      </div>
                    </TableCell>}
                    {isVisible("impressoes") && <TableCell className="text-right tabular-nums">{num(row.impressoes)}</TableCell>}
                    {isVisible("cliques") && <TableCell className="text-right tabular-nums">{num(row.cliques)}</TableCell>}
                    {isVisible("ctr") && <TableCell className="text-right tabular-nums">{pct(row.ctr)}</TableCell>}
                    {isVisible("cpc") && <TableCell className="text-right tabular-nums">{row.cpc > 0 ? `R$ ${row.cpc.toFixed(2)}` : "—"}</TableCell>}
                    {isVisible("hook_rate") && <TableCell className="text-right tabular-nums">{row.hook_rate > 0 ? pct(row.hook_rate) : "—"}</TableCell>}
                    {isVisible("cpm") && <TableCell className="text-right tabular-nums">{row.cpm > 0 ? `R$ ${row.cpm.toFixed(2)}` : "—"}</TableCell>}
                    {isVisible("frequencia") && <TableCell className="text-right tabular-nums">{row.frequencia > 0 ? row.frequencia.toFixed(2) : "—"}</TableCell>}
                    {isVisible("alcance") && <TableCell className="text-right tabular-nums">{row.alcance ? num(row.alcance) : "—"}</TableCell>}
                    {isVisible("lp_views") && <TableCell className="text-right tabular-nums">{row.lp_views ? num(row.lp_views) : "—"}</TableCell>}
                    {isVisible("lp_to_ckt") && <TableCell className="text-right tabular-nums">{row.lp_to_ckt > 0 ? pct(row.lp_to_ckt) : "—"}</TableCell>}
                    {isVisible("ic") && <TableCell className="text-right tabular-nums">{row.ic || "—"}</TableCell>}
                    {isVisible("cpi") && <TableCell className="text-right tabular-nums">{row.cpi > 0 ? `R$ ${row.cpi.toFixed(2)}` : "—"}</TableCell>}
                    {isVisible("compras") && <TableCell className="text-right tabular-nums">{row.compras || "—"}</TableCell>}
                    {isVisible("cpa") && <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <CpaCell cpa={row.cpa} ticket={row.ticket} />
                        <DeltaBadge current={row.cpa} previous={prevByCamp.get(row.id)?.cpa || 0} inverse={true} />
                      </div>
                    </TableCell>}
                    {isVisible("receita") && <TableCell className="text-right tabular-nums">{row.receita ? brl(row.receita) : "—"}</TableCell>}
                    {isVisible("roas") && <TableCell className="text-right"><RoasBadge value={row.roas} /></TableCell>}
                    {isVisible("daily_budget") && <TableCell className="text-right">
                      <BudgetEditor value={dailyBudget} disabled={!hasValidId(row)} onSave={(n) => handleBudget("campaign", row, n)} />
                    </TableCell>}
                    {isVisible("verdict") && <TableCell className="text-right">
                      <span className={cn("inline-block px-2 py-0.5 rounded border text-[10px] font-medium tracking-wider", verdictColor((row as any).verdict as Verdict))} title={(row as any).verdictReason}>
                        {(row as any).verdict}
                      </span>
                    </TableCell>}
                  </TableRow>
                  {isExpanded && renderSubRows(row)}
                </>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <BulkActionsBar
        count={selected.size}
        loading={bulkLoading}
        onActivate={() => runBulk("ACTIVE")}
        onPause={() => runBulk("PAUSED")}
        onDuplicate={() => runBulk("DUPLICATE_CAMPAIGN")}
        onAdjustBudget={() => setBulkBudgetOpen(true)}
        onCompare={() => setCompareOpen(true)}
        onClear={() => setSelected(new Set())}
      />

      <CampaignComparator
        open={compareOpen}
        onOpenChange={setCompareOpen}
        campaigns={enrichedCampaigns.filter(c => selected.has(c.id)).slice(0, 4) as any}
        dailySpendByCamp={dailySpendByCamp}
      />

      <BulkBudgetDialog
        open={bulkBudgetOpen}
        onOpenChange={setBulkBudgetOpen}
        count={selected.size}
        loading={bulkLoading}
        onConfirm={async (mode, value) => {
          if (!projectId) { toast.error("Selecione um projeto antes."); return; }
          const rows = enrichedCampaigns.filter(r => selected.has(r.id) && hasValidId(r) && r.daily_budget != null);
          if (rows.length === 0) { toast.error("Nenhuma campanha com orçamento editável"); return; }
          setBulkLoading(true);
          const results = await Promise.allSettled(rows.map(r => {
            const prev = Number(r.daily_budget || 0);
            const next = mode === "increase_pct" ? prev * (1 + value / 100)
              : mode === "decrease_pct" ? prev * (1 - value / 100)
              : value;
            return supabase.functions.invoke(fnFor(r), {
              body: { project_id: projectId, entity_type: "campaign", entity_id: r.id, entity_name: r.name, action: "UPDATE_BUDGET", daily_budget: Number(next.toFixed(2)), previous_budget: prev },
            });
          }));
          let ok = 0, err = 0;
          for (const rr of results) {
            if (rr.status === "fulfilled" && !(rr.value as any)?.error && !(rr.value as any)?.data?.error) ok++; else err++;
          }
          setBulkLoading(false);
          setBulkBudgetOpen(false);
          setSelected(new Set());
          if (ok) toast.success(`${ok} orçamento(s) atualizado(s)`);
          if (err) toast.error(`${err} falha(s)`);
          onAfterToggle?.();
        }}
      />

      <RowHistoryDrawer
        open={!!historyTarget}
        onOpenChange={(v) => !v && setHistoryTarget(null)}
        entityId={historyTarget?.id || null}
        entityName={historyTarget?.name || null}
        projectId={projectId}
      />
    </div>
  );
}

async function callRename(supabaseClient: typeof supabase, projectId: string | undefined, entity_type: Level, row: Row, next: string, prev: string) {
  if (!projectId) { toast.error("Selecione um projeto antes."); return false; }
  if (!hasValidId(row)) { toast.error("Entidade sem ID."); return false; }
  try {
    const { data, error } = await supabaseClient.functions.invoke(fnFor(row), {
      body: { project_id: projectId, entity_type, entity_id: row.id, entity_name: prev, action: "RENAME", new_name: next, previous_name: prev },
    });
    if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || "Falha");
    toast.success("Renomeado");
    return true;
  } catch (e: any) {
    toast.error(e.message || "Erro ao renomear");
    return false;
  }
}


function labelFor(k: SortKey): string {
  const map: Record<string, string> = {
    valor: "Invest.", impressoes: "Impr.", cliques: "Cliq.", ctr: "CTR", cpc: "CPC",
    hook_rate: "Hook", cpm: "CPM", frequencia: "Freq", alcance: "Alcance",
    lp_views: "LP Views", lp_to_ckt: "LP→CKT", ic: "IC", cpi: "CPI",
    compras: "Compras", cpa: "CPA", receita: "Receita", roas: "ROAS", daily_budget: "Orç./Dia",
  };
  return map[k] || k;
}

// Sub-row wrapper para adsets/ads
function ReactFragment(props: {
  adset: Row & { ctr: number; cpc: number; cpi: number; cpa: number; roas: number; ic: number; lp_to_ckt: number };
  adsetStatus: string | null;
  adsetBudget: number | null;
  adsetExpanded: boolean;
  onExpand: () => void;
  onToggle: (next: "ACTIVE" | "PAUSED") => void;
  onBudget: (next: number) => void;
  loading: boolean;
  isVisible: (k: SortKey) => boolean;
  depth: number;
  adsRows: (Row & { ctr: number; cpc: number; cpi: number; cpa: number; roas: number; ic: number; lp_to_ckt: number })[];
  optimistic: Map<string, string>;
  optimisticBudget: Map<string, number>;
  togglingId: string | null;
  onAdToggle: (ad: Row, next: "ACTIVE" | "PAUSED") => void;
  onAdBudget: (ad: Row, next: number) => void;
}) {
  const { adset, adsetStatus, adsetBudget, adsetExpanded, onExpand, onToggle, onBudget, loading, isVisible, adsRows, optimistic, optimisticBudget, togglingId, onAdToggle, onAdBudget } = props;
  const indent = (lvl: number) => ({ paddingLeft: `${lvl * 18}px` });

  return (
    <>
      <TableRow className="border-border/10 text-xs bg-secondary/10 hover:bg-secondary/20">
        <TableCell>
          <button onClick={onExpand} className="text-muted-foreground hover:text-primary" style={indent(1)}>
            {adsetExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronExpandRight className="h-3 w-3" />}
          </button>
        </TableCell>
        <TableCell></TableCell>
        <TableCell>
          <StatusToggle status={adsetStatus} loading={loading} onChange={onToggle} />
        </TableCell>
        <TableCell className="text-muted-foreground max-w-[260px] truncate" title={adset.name}>
          <span className="text-[9px] uppercase tracking-wider mr-1.5 text-primary/60">conj</span>{adset.name}
        </TableCell>
        {isVisible("trend") && <TableCell></TableCell>}
        {isVisible("valor") && <TableCell className="text-right tabular-nums">{brl(adset.valor)}</TableCell>}
        {isVisible("impressoes") && <TableCell className="text-right tabular-nums">{num(adset.impressoes)}</TableCell>}
        {isVisible("cliques") && <TableCell className="text-right tabular-nums">{num(adset.cliques)}</TableCell>}
        {isVisible("ctr") && <TableCell className="text-right tabular-nums">{pct(adset.ctr)}</TableCell>}
        {isVisible("cpc") && <TableCell className="text-right tabular-nums">{adset.cpc > 0 ? `R$ ${adset.cpc.toFixed(2)}` : "—"}</TableCell>}
        {isVisible("hook_rate") && <TableCell className="text-right tabular-nums">{adset.hook_rate > 0 ? pct(adset.hook_rate) : "—"}</TableCell>}
        {isVisible("cpm") && <TableCell className="text-right tabular-nums">{adset.cpm > 0 ? `R$ ${adset.cpm.toFixed(2)}` : "—"}</TableCell>}
        {isVisible("frequencia") && <TableCell className="text-right tabular-nums">{adset.frequencia > 0 ? adset.frequencia.toFixed(2) : "—"}</TableCell>}
        {isVisible("alcance") && <TableCell className="text-right tabular-nums">{adset.alcance ? num(adset.alcance) : "—"}</TableCell>}
        {isVisible("lp_views") && <TableCell className="text-right tabular-nums">{adset.lp_views ? num(adset.lp_views) : "—"}</TableCell>}
        {isVisible("lp_to_ckt") && <TableCell className="text-right tabular-nums">{adset.lp_to_ckt > 0 ? pct(adset.lp_to_ckt) : "—"}</TableCell>}
        {isVisible("ic") && <TableCell className="text-right tabular-nums">{adset.ic || "—"}</TableCell>}
        {isVisible("cpi") && <TableCell className="text-right tabular-nums">{adset.cpi > 0 ? `R$ ${adset.cpi.toFixed(2)}` : "—"}</TableCell>}
        {isVisible("compras") && <TableCell className="text-right tabular-nums">{adset.compras || "—"}</TableCell>}
        {isVisible("cpa") && <TableCell className="text-right"><CpaCell cpa={adset.cpa} ticket={adset.ticket} /></TableCell>}
        {isVisible("receita") && <TableCell className="text-right tabular-nums">{adset.receita ? brl(adset.receita) : "—"}</TableCell>}
        {isVisible("roas") && <TableCell className="text-right"><RoasBadge value={adset.roas} /></TableCell>}
        {isVisible("daily_budget") && <TableCell className="text-right">
          <BudgetEditor value={adsetBudget} disabled={!hasValidId(adset)} onSave={onBudget} />
        </TableCell>}
        {isVisible("verdict") && <TableCell></TableCell>}
      </TableRow>

      {adsetExpanded && adsRows.map((ad) => {
        const adStatus = optimistic.get(ad.id) ?? ad.effective_status;
        const adBudget = optimisticBudget.has(ad.id) ? optimisticBudget.get(ad.id)! : ad.daily_budget;
        return (
          <TableRow key={`ad-${ad.id}`} className="border-border/10 text-xs hover:bg-secondary/20">
            <TableCell></TableCell>
            <TableCell></TableCell>
            <TableCell>
              <StatusToggle status={adStatus} loading={togglingId === ad.id} onChange={(n) => onAdToggle(ad, n)} />
            </TableCell>
            <TableCell className="text-muted-foreground/80 max-w-[260px] truncate" title={ad.name}>
              <span className="inline-block" style={indent(2)} />
              <span className="inline-flex items-center gap-1.5 align-middle">
                {ad.thumbnail_url ? (
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <img src={ad.thumbnail_url} alt="" className="h-7 w-7 rounded object-cover border border-border/40 cursor-pointer" />
                    </HoverCardTrigger>
                    <HoverCardContent side="right" className="w-64 p-2 bg-secondary border-border/40">
                      <img src={ad.thumbnail_url} alt="" className="w-full rounded mb-2" />
                      {ad.creative_title && <p className="text-xs font-medium text-foreground/90 mb-1">{ad.creative_title}</p>}
                      {ad.creative_body && <p className="text-[11px] text-muted-foreground leading-snug line-clamp-4">{ad.creative_body}</p>}
                    </HoverCardContent>
                  </HoverCard>
                ) : (
                  <span className="h-7 w-7 rounded bg-secondary/40 border border-border/30 inline-flex items-center justify-center"><ImageIcon className="h-3 w-3 text-muted-foreground/40" /></span>
                )}
                <span className="text-[9px] uppercase tracking-wider text-primary/40">ad</span>
                <span className="truncate">{ad.name}</span>
              </span>
            </TableCell>
            {isVisible("trend") && <TableCell></TableCell>}
            {isVisible("valor") && <TableCell className="text-right tabular-nums">{brl(ad.valor)}</TableCell>}
            {isVisible("impressoes") && <TableCell className="text-right tabular-nums">{num(ad.impressoes)}</TableCell>}
            {isVisible("cliques") && <TableCell className="text-right tabular-nums">{num(ad.cliques)}</TableCell>}
            {isVisible("ctr") && <TableCell className="text-right tabular-nums">{pct(ad.ctr)}</TableCell>}
            {isVisible("cpc") && <TableCell className="text-right tabular-nums">{ad.cpc > 0 ? `R$ ${ad.cpc.toFixed(2)}` : "—"}</TableCell>}
            {isVisible("hook_rate") && <TableCell className="text-right tabular-nums">{ad.hook_rate > 0 ? pct(ad.hook_rate) : "—"}</TableCell>}
            {isVisible("cpm") && <TableCell className="text-right tabular-nums">{ad.cpm > 0 ? `R$ ${ad.cpm.toFixed(2)}` : "—"}</TableCell>}
            {isVisible("frequencia") && <TableCell className="text-right tabular-nums">{ad.frequencia > 0 ? ad.frequencia.toFixed(2) : "—"}</TableCell>}
            {isVisible("alcance") && <TableCell className="text-right tabular-nums">{ad.alcance ? num(ad.alcance) : "—"}</TableCell>}
            {isVisible("lp_views") && <TableCell className="text-right tabular-nums">{ad.lp_views ? num(ad.lp_views) : "—"}</TableCell>}
            {isVisible("lp_to_ckt") && <TableCell className="text-right tabular-nums">{ad.lp_to_ckt > 0 ? pct(ad.lp_to_ckt) : "—"}</TableCell>}
            {isVisible("ic") && <TableCell className="text-right tabular-nums">{ad.ic || "—"}</TableCell>}
            {isVisible("cpi") && <TableCell className="text-right tabular-nums">{ad.cpi > 0 ? `R$ ${ad.cpi.toFixed(2)}` : "—"}</TableCell>}
            {isVisible("compras") && <TableCell className="text-right tabular-nums">{ad.compras || "—"}</TableCell>}
            {isVisible("cpa") && <TableCell className="text-right"><CpaCell cpa={ad.cpa} ticket={ad.ticket} /></TableCell>}
            {isVisible("receita") && <TableCell className="text-right tabular-nums">{ad.receita ? brl(ad.receita) : "—"}</TableCell>}
            {isVisible("roas") && <TableCell className="text-right"><RoasBadge value={ad.roas} /></TableCell>}
            {isVisible("daily_budget") && <TableCell className="text-right">
              <BudgetEditor value={adBudget} disabled={!hasValidId(ad)} onSave={(n) => onAdBudget(ad, n)} />
            </TableCell>}
            {isVisible("verdict") && <TableCell></TableCell>}
          </TableRow>
        );
      })}
    </>
  );
}

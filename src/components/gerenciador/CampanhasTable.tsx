import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight, ArrowDown, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { StatusToggle } from "./StatusToggle";
import { RoasBadge, CpaCell } from "./RoasBadge";
import { cn } from "@/lib/utils";

interface AdRow {
  campaign_id: string | null;
  campanha: string | null;
  effective_status: string | null;
  daily_budget: number | null;
  valor: number;
  impressoes: number;
  cliques: number;
  link_clicks: number | null;
  init_checkout: number | null;
  compras: number;
  receita?: number; // calculada
  ticket?: number;
}

interface VendaItem {
  produto_nome?: string;
  utm_campaign?: string | null;
  valor: number;
}

interface Props {
  ads: any[];
  vendas?: VendaItem[];
  projectId?: string;
  onAfterToggle?: () => void;
}

type SortKey = "campanha" | "valor" | "impressoes" | "cliques" | "ctr" | "cpc" | "ic" | "cpi" | "compras" | "cpa" | "receita" | "roas" | "daily_budget";

const PAGE_SIZES = [10, 20, 50] as const;

function aggregate(ads: any[], vendas: VendaItem[]): AdRow[] {
  const map = new Map<string, AdRow>();
  for (const a of ads) {
    const key = a.campaign_id || a.campanha || "Sem nome";
    const cur = map.get(key) || {
      campaign_id: a.campaign_id || null,
      campanha: a.campanha || "Sem nome",
      effective_status: a.effective_status || null,
      daily_budget: a.daily_budget ?? null,
      valor: 0, impressoes: 0, cliques: 0, link_clicks: 0, init_checkout: 0, compras: 0,
    };
    cur.valor += Number(a.valor) || 0;
    cur.impressoes += Number(a.impressoes) || 0;
    cur.cliques += Number(a.cliques) || 0;
    cur.link_clicks = (cur.link_clicks || 0) + (Number(a.link_clicks) || 0);
    cur.init_checkout = (cur.init_checkout || 0) + (Number(a.init_checkout) || 0);
    cur.compras += Number(a.compras) || 0;
    if (!cur.effective_status && a.effective_status) cur.effective_status = a.effective_status;
    if (cur.daily_budget == null && a.daily_budget != null) cur.daily_budget = Number(a.daily_budget);
    map.set(key, cur);
  }
  // Receita atribuída por nome de campanha (utm_campaign)
  const revByCamp = new Map<string, number>();
  for (const v of vendas) {
    const k = (v.utm_campaign || "").trim().toLowerCase();
    if (!k) continue;
    revByCamp.set(k, (revByCamp.get(k) || 0) + Number(v.valor || 0));
  }
  for (const row of map.values()) {
    const k = (row.campanha || "").trim().toLowerCase();
    row.receita = revByCamp.get(k) || (row.compras > 0 && vendas.length ?
      // fallback: ticket médio global × compras
      (vendas.reduce((s, v) => s + Number(v.valor || 0), 0) / vendas.length) * row.compras
      : 0);
    row.ticket = row.compras > 0 ? (row.receita || 0) / row.compras : undefined;
  }
  return Array.from(map.values());
}

function num(v: number) { return v.toLocaleString("pt-BR"); }
function brl(v: number) { return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

export function CampanhasTable({ ads, vendas = [], projectId, onAfterToggle }: Props) {
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("roas");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<Map<string, string>>(new Map());

  const rows = useMemo(() => {
    const agg = aggregate(ads, vendas);
    const filtered = agg.filter(r => !search || (r.campanha || "").toLowerCase().includes(search.toLowerCase()));
    const enriched = filtered.map(r => {
      const ctr = r.impressoes ? (r.cliques / r.impressoes) * 100 : 0;
      const cpc = r.cliques ? r.valor / r.cliques : 0;
      const ic = r.init_checkout || 0;
      const cpi = ic ? r.valor / ic : 0;
      const cpa = r.compras ? r.valor / r.compras : 0;
      const roas = r.valor > 0 ? (r.receita || 0) / r.valor : 0;
      return { ...r, ctr, cpc, ic, cpi, cpa, roas };
    });
    enriched.sort((a, b) => {
      const av = (a as any)[sortKey] ?? 0;
      const bv = (b as any)[sortKey] ?? 0;
      if (typeof av === "string" || typeof bv === "string") {
        return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return enriched;
  }, [ads, vendas, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const handleToggle = async (row: any, next: "ACTIVE" | "PAUSED") => {
    if (!row.campaign_id) {
      toast.error("Esta campanha ainda não tem ID da Meta. Sincronize Facebook Ads primeiro.");
      return;
    }
    if (!projectId) {
      toast.error("Selecione um projeto antes de pausar/ativar campanhas.");
      return;
    }
    const id = row.campaign_id;
    setTogglingId(id);
    const prev = row.effective_status;
    setOptimistic(m => new Map(m).set(id, next));
    try {
      const { data, error } = await supabase.functions.invoke("facebook-ads-toggle", {
        body: {
          project_id: projectId,
          entity_type: "campaign",
          entity_id: id,
          entity_name: row.campanha,
          action: next,
          previous_status: prev,
        },
      });
      if (error || (data as any)?.error) {
        const msg = (data as any)?.error || error?.message || "Falha ao atualizar";
        throw new Error(msg);
      }
      toast.success(next === "ACTIVE" ? "Campanha ativada" : "Campanha pausada");
      onAfterToggle?.();
    } catch (e: any) {
      // rollback otimista
      setOptimistic(m => { const n = new Map(m); n.set(id, prev || "PAUSED"); return n; });
      toast.error(e.message || "Erro ao alterar status");
    } finally {
      setTogglingId(null);
    }
  };

  const SortHeader = ({ k, label, align = "right" }: { k: SortKey; label: string; align?: "left" | "right" }) => (
    <TableHead className={cn("text-[10px] uppercase tracking-wider cursor-pointer select-none whitespace-nowrap", align === "right" && "text-right")} onClick={() => toggleSort(k)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === k && (sortDir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
      </span>
    </TableHead>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
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
          <span>{rows.length} registros</span>
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
              <TableHead className="w-8"></TableHead>
              <TableHead className="w-12"></TableHead>
              <SortHeader k="campanha" label="Nome" align="left" />
              <SortHeader k="valor" label="Invest." />
              <SortHeader k="impressoes" label="Impr." />
              <SortHeader k="cliques" label="Cliq." />
              <SortHeader k="ctr" label="CTR" />
              <SortHeader k="cpc" label="CPC" />
              <SortHeader k="ic" label="IC" />
              <SortHeader k="cpi" label="CPI" />
              <SortHeader k="compras" label="Compras" />
              <SortHeader k="cpa" label="CPA" />
              <SortHeader k="receita" label="Receita" />
              <SortHeader k="roas" label="ROAS" />
              <SortHeader k="daily_budget" label="Orç./Dia" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length === 0 && (
              <TableRow><TableCell colSpan={15} className="text-center text-muted-foreground py-10 text-xs">Nenhuma campanha no período.</TableCell></TableRow>
            )}
            {pageRows.map((row, idx) => {
              const id = row.campaign_id || `row-${idx}`;
              const status = optimistic.get(id) ?? row.effective_status;
              const checked = selected.has(id);
              return (
                <TableRow key={id} className="border-border/20 text-xs hover:bg-secondary/20">
                  <TableCell><Checkbox checked={checked} onCheckedChange={(v) => {
                    setSelected(s => { const n = new Set(s); v ? n.add(id) : n.delete(id); return n; });
                  }} /></TableCell>
                  <TableCell>
                    <StatusToggle
                      status={status}
                      loading={togglingId === id}
                      onChange={(next) => handleToggle(row, next)}
                    />
                  </TableCell>
                  <TableCell className="font-medium text-foreground/90 max-w-[280px] truncate" title={row.campanha || ""}>
                    {row.campanha}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{brl(row.valor)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(row.impressoes)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(row.cliques)}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.ctr.toFixed(1)}%</TableCell>
                  <TableCell className="text-right tabular-nums">{row.cpc > 0 ? `R$ ${row.cpc.toFixed(2)}` : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.ic || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.cpi > 0 ? `R$ ${row.cpi.toFixed(2)}` : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.compras || "—"}</TableCell>
                  <TableCell className="text-right"><CpaCell cpa={row.cpa} ticket={row.ticket} /></TableCell>
                  <TableCell className="text-right tabular-nums">{row.receita ? brl(row.receita) : "—"}</TableCell>
                  <TableCell className="text-right"><RoasBadge value={row.roas} /></TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{row.daily_budget ? brl(row.daily_budget) : "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

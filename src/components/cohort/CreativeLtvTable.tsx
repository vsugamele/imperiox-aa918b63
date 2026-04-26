import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreativeRoasRow, CreativeGroupBy, fmtBRL, MatchingReport } from "@/lib/creativeLtv";
import { TrendingUp, TrendingDown, ArrowUpDown, Layers, ShieldCheck, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  data: CreativeRoasRow[];
  groupBy: CreativeGroupBy;
  onGroupByChange: (g: CreativeGroupBy) => void;
  report?: MatchingReport;
}

type SortKey = "roasReal" | "roasFront" | "spend" | "receitaTotal" | "ltv" | "cpa" | "backendShare";

const roasColor = (r: number) => {
  if (r >= 2) return "text-emerald-400 border-emerald-400/40 bg-emerald-400/10";
  if (r >= 1) return "text-amber-400 border-amber-400/40 bg-amber-400/10";
  if (r > 0) return "text-red-400 border-red-400/40 bg-red-400/10";
  return "text-muted-foreground border-border";
};

export function CreativeLtvTable({ data, groupBy, onGroupByChange, report }: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("roasReal");
  const [minSpend, setMinSpend] = useState<string>("0");

  const rows = useMemo(() => {
    const min = Number(minSpend) || 0;
    let r = data.filter((row) => row.spend >= min);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((row) =>
        row.campanha.toLowerCase().includes(q) ||
        row.conjunto.toLowerCase().includes(q) ||
        row.anuncio.toLowerCase().includes(q),
      );
    }
    r = [...r].sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number));
    return r;
  }, [data, search, sortKey, minSpend]);

  const totals = useMemo(() => {
    const spend = rows.reduce((s, r) => s + r.spend, 0);
    const receita = rows.reduce((s, r) => s + r.receitaTotal, 0);
    const principal = rows.reduce((s, r) => s + r.receitaPrincipal, 0);
    const backend = rows.reduce((s, r) => s + r.receitaBackend, 0);
    const buyers = rows.reduce((s, r) => s + r.vendasReais, 0);
    return {
      spend,
      receita,
      principal,
      backend,
      buyers,
      roasReal: spend > 0 ? receita / spend : 0,
      roasFront: spend > 0 ? principal / spend : 0,
      backendShare: receita > 0 ? (backend / receita) * 100 : 0,
    };
  }, [rows]);

  return (
    <Card>
      <CardHeader className="pb-3 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Layers className="h-4 w-4" />
            ROAS Real por {groupBy === "campanha" ? "Campanha" : groupBy === "conjunto" ? "Conjunto" : "Anúncio"}
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Select value={groupBy} onValueChange={(v: CreativeGroupBy) => onGroupByChange(v)}>
              <SelectTrigger className="w-[150px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="campanha">Por Campanha</SelectItem>
                <SelectItem value="conjunto">Por Conjunto</SelectItem>
                <SelectItem value="anuncio">Por Anúncio</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortKey} onValueChange={(v: SortKey) => setSortKey(v)}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <ArrowUpDown className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="roasReal">ROAS real (↓)</SelectItem>
                <SelectItem value="roasFront">ROAS front (↓)</SelectItem>
                <SelectItem value="spend">Investimento (↓)</SelectItem>
                <SelectItem value="receitaTotal">Receita total (↓)</SelectItem>
                <SelectItem value="ltv">LTV (↓)</SelectItem>
                <SelectItem value="cpa">CPA (↓)</SelectItem>
                <SelectItem value="backendShare">% Backend (↓)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Input
            placeholder="Buscar campanha/conjunto/anúncio…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs max-w-xs"
          />
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>Spend mín:</span>
            <Input
              type="number"
              value={minSpend}
              onChange={(e) => setMinSpend(e.target.value)}
              className="h-8 w-24 text-xs"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs pt-1">
          <div className="border border-border rounded p-2">
            <p className="text-muted-foreground text-[10px] uppercase">Spend</p>
            <p className="font-mono font-bold">{fmtBRL(totals.spend)}</p>
          </div>
          <div className="border border-border rounded p-2">
            <p className="text-muted-foreground text-[10px] uppercase">Receita total</p>
            <p className="font-mono font-bold text-primary">{fmtBRL(totals.receita)}</p>
          </div>
          <div className="border border-border rounded p-2">
            <p className="text-muted-foreground text-[10px] uppercase">ROAS real</p>
            <p className="font-mono font-bold text-primary">{totals.roasReal.toFixed(2)}x</p>
          </div>
          <div className="border border-border rounded p-2">
            <p className="text-muted-foreground text-[10px] uppercase">ROAS front</p>
            <p className="font-mono font-bold">{totals.roasFront.toFixed(2)}x</p>
          </div>
          <div className="border border-border rounded p-2">
            <p className="text-muted-foreground text-[10px] uppercase">% Backend</p>
            <p className="font-mono font-bold">{totals.backendShare.toFixed(0)}%</p>
          </div>
        </div>
        {report && report.totalVendas > 0 && (
          <div className="border border-border rounded p-2 text-xs space-y-1.5 bg-muted/20">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span className="uppercase tracking-wider text-[10px]">Qualidade do match</span>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                <Badge variant="outline" className="text-emerald-400 border-emerald-400/40 bg-emerald-400/10 font-mono text-[10px]">
                  Exato {report.byConfidence.exact.count} · {fmtBRL(report.byConfidence.exact.receita)}
                </Badge>
                <Badge variant="outline" className="text-sky-400 border-sky-400/40 bg-sky-400/10 font-mono text-[10px]">
                  Conjunto {report.byConfidence.adset.count} · {fmtBRL(report.byConfidence.adset.receita)}
                </Badge>
                <Badge variant="outline" className="text-amber-400 border-amber-400/40 bg-amber-400/10 font-mono text-[10px]">
                  Campanha {report.byConfidence.campaign.count} · {fmtBRL(report.byConfidence.campaign.receita)}
                </Badge>
                {report.unmatched > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="text-red-400 border-red-400/40 bg-red-400/10 font-mono text-[10px] cursor-help">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Sem match {report.unmatched} · {fmtBRL(report.receitaUnmatched)}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs font-semibold mb-1">Vendas sem UTM atribuível</p>
                        <p className="text-[10px] text-muted-foreground">
                          Receita orgânica/direta ou UTM não casa com nenhuma campanha em ads_spend. Não entram no ROAS pago.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground">
              {((report.receitaMatched / Math.max(report.totalReceita, 1)) * 100).toFixed(1)}% da receita atribuída · {report.matched}/{report.totalVendas} vendas
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground sticky left-0 bg-muted/40">
                  {groupBy === "campanha" ? "Campanha" : groupBy === "conjunto" ? "Conjunto" : "Anúncio"}
                </th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Spend</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Vendas</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">CPA</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Front</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Backend</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">% Back</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">LTV</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">ROAS front</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">ROAS real</th>
                <th className="text-center px-3 py-2 font-semibold text-muted-foreground">Conf.</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="text-center text-muted-foreground py-8">
                    Sem dados. Sincroniza Facebook Ads e captura utm_campaign nos leads/vendas.
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const lift = r.roasFront > 0 ? ((r.roasReal - r.roasFront) / r.roasFront) * 100 : 0;
                return (
                  <tr key={r.key} className="border-t border-border hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono sticky left-0 bg-background hover:bg-muted/20 max-w-[280px]">
                      <div className="truncate font-semibold" title={r.key}>{r.key}</div>
                      {groupBy !== "campanha" && (
                        <div className="text-[10px] text-muted-foreground truncate">{r.campanha}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(r.spend)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.vendasReais}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {r.cpa > 0 ? fmtBRL(r.cpa) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(r.receitaPrincipal)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-400">{fmtBRL(r.receitaBackend)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {r.backendShare > 0 ? `${r.backendShare.toFixed(0)}%` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">
                      {r.ltv > 0 ? fmtBRL(r.ltv) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Badge variant="outline" className={cn("font-mono", roasColor(r.roasFront))}>
                        {r.roasFront > 0 ? `${r.roasFront.toFixed(2)}x` : "—"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Badge variant="outline" className={cn("font-mono font-bold", roasColor(r.roasReal))}>
                          {r.roasReal > 0 ? (
                            <>
                              {r.roasReal >= 1 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                              {r.roasReal.toFixed(2)}x
                            </>
                          ) : "—"}
                        </Badge>
                        {lift > 5 && (
                          <span className="text-[10px] text-emerald-400 font-mono">+{lift.toFixed(0)}%</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.confidenceScore > 0 ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "font-mono text-[10px] cursor-help",
                                  r.confidenceScore >= 85
                                    ? "text-emerald-400 border-emerald-400/40 bg-emerald-400/10"
                                    : r.confidenceScore >= 60
                                    ? "text-sky-400 border-sky-400/40 bg-sky-400/10"
                                    : "text-amber-400 border-amber-400/40 bg-amber-400/10",
                                )}
                              >
                                {r.confidenceScore.toFixed(0)}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-[10px] space-y-0.5">
                                <p>Exato: {r.matchExact} ({fmtBRL(r.receitaExact)})</p>
                                <p>Conjunto: {r.matchAdset} ({fmtBRL(r.receitaAdset)})</p>
                                <p>Campanha: {r.matchCampaign} ({fmtBRL(r.receitaCampaign)})</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-muted-foreground text-[10px]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

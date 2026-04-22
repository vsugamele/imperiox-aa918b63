import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import { TrendingUp, TrendingDown, Calendar, Target, ChevronRight, Zap } from "lucide-react";

interface ProjectSummary { id: string; name: string; receita: number; custo: number; lucro: number; roi: number; ads: number; roas: number; cpa: number; vendasCount: number; }
interface DailyData { date: string; ads: number; vendas: number; }
interface CampaignEfficiency { campanha: string; gasto: number; vendas: number; receita: number; roas: number; }
interface Props {
  projectSummaries: ProjectSummary[];
  dailyData?: DailyData[];
  totalAds?: number;
  totalVendas?: number;
  totalVendasCount?: number;
  totalCustos?: number;
  filterDateFrom?: string;
  totalCliques?: number;
  totalCheckouts?: number;
  campaignEfficiency?: CampaignEfficiency[];
}

export function FinancasOverview({ projectSummaries, dailyData = [], totalAds = 0, totalVendas = 0, totalVendasCount = 0, totalCustos = 0, filterDateFrom, totalCliques = 0, totalCheckouts = 0, campaignEfficiency = [] }: Props) {
  const realROAS = totalAds > 0 ? totalVendas / totalAds : 0;
  const realCPA = totalVendasCount > 0 ? totalAds / totalVendasCount : 0;

  const now = new Date();
  const diasPassados = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projecaoReceita = diasPassados > 0 ? (totalVendas / diasPassados) * daysInMonth : 0;
  const projecaoCusto = diasPassados > 0 ? ((totalAds + totalCustos) / diasPassados) * daysInMonth : 0;
  const projecaoLucro = projecaoReceita - projecaoCusto;
  const progressPct = Math.min((diasPassados / daysInMonth) * 100, 100);

  const isCurrentMonthFilter = !filterDateFrom || (() => {
    const from = new Date(filterDateFrom + "T00:00:00");
    return from.getMonth() === now.getMonth() && from.getFullYear() === now.getFullYear();
  })();

  return (
    <div className="space-y-6">
      {isCurrentMonthFilter && totalVendas > 0 && (
        <Card className="border-border bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Resumo do Mês — {now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</h3>
              <Badge variant="outline" className="text-[10px] ml-auto">Dia {diasPassados}/{daysInMonth}</Badge>
            </div>
            <Progress value={progressPct} className="h-2" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div><p className="text-[10px] text-muted-foreground uppercase">Receita Atual</p><p className="text-lg font-mono font-bold text-emerald-400">R$ {totalVendas.toFixed(2)}</p></div>
              <div><p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">Projeção <Target className="h-3 w-3" /></p><p className="text-lg font-mono font-bold text-primary">R$ {projecaoReceita.toFixed(2)}</p></div>
              <div><p className="text-[10px] text-muted-foreground uppercase">Custo Projetado</p><p className="text-lg font-mono font-bold text-red-400">R$ {projecaoCusto.toFixed(2)}</p></div>
              <div><p className="text-[10px] text-muted-foreground uppercase">Lucro Projetado</p><p className={`text-lg font-mono font-bold ${projecaoLucro >= 0 ? "text-emerald-400" : "text-red-400"}`}>R$ {projecaoLucro.toFixed(2)}</p>{projecaoLucro >= 0 ? <TrendingUp className="h-3 w-3 text-emerald-400 inline" /> : <TrendingDown className="h-3 w-3 text-red-400 inline" />}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {totalAds > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border-border bg-gradient-to-br from-emerald-500/10 to-emerald-500/5"><CardContent className="p-4"><p className="text-xs text-muted-foreground">ROAS Real</p><p className="text-2xl font-mono font-bold text-emerald-400">{realROAS.toFixed(2)}x</p><p className="text-[10px] text-muted-foreground">Receita vendas / Gasto ads</p></CardContent></Card>
          <Card className="border-border bg-gradient-to-br from-blue-500/10 to-blue-500/5"><CardContent className="p-4"><p className="text-xs text-muted-foreground">CPA Real</p><p className="text-2xl font-mono font-bold text-blue-400">R$ {realCPA.toFixed(2)}</p><p className="text-[10px] text-muted-foreground">Gasto ads / Nº vendas</p></CardContent></Card>
          <Card className="border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Investido em Ads</p><p className="text-2xl font-mono font-bold text-red-400">R$ {totalAds.toFixed(2)}</p></CardContent></Card>
          <Card className="border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Receita Vendas</p><p className="text-2xl font-mono font-bold text-emerald-400">R$ {totalVendas.toFixed(2)}</p></CardContent></Card>
        </div>
      )}

      {dailyData.length > 0 && (
        <Card className="border-border"><CardContent className="pt-6">
          <h3 className="text-sm font-semibold text-muted-foreground mb-4">📈 Ads vs Vendas (Timeline)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={dailyData} margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
              <Legend />
              <Area type="monotone" dataKey="vendas" name="Receita Vendas" stroke="hsl(142 76% 36%)" fill="hsl(142 76% 36% / 0.2)" />
              <Area type="monotone" dataKey="ads" name="Gasto Ads" stroke="hsl(0 84% 60%)" fill="hsl(0 84% 60% / 0.15)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent></Card>
      )}

      {/* === MINI-FUNIL: Investido → Cliques → Checkouts → Vendas → Receita → Lucro === */}
      {(totalAds > 0 || totalVendas > 0) && (() => {
        const lucro = totalVendas - totalAds - totalCustos;
        const steps = [
          { label: "Investido", value: `R$ ${totalAds.toFixed(0)}`, raw: totalAds, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
          { label: "Cliques", value: totalCliques > 0 ? totalCliques.toLocaleString("pt-BR") : "—", raw: totalCliques, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
          { label: "Checkouts", value: totalCheckouts > 0 ? totalCheckouts.toLocaleString("pt-BR") : "—", raw: totalCheckouts, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
          { label: "Vendas", value: totalVendasCount.toLocaleString("pt-BR"), raw: totalVendasCount, color: "text-primary", bg: "bg-primary/10 border-primary/30" },
          { label: "Receita", value: `R$ ${totalVendas.toFixed(0)}`, raw: totalVendas, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
          { label: "Lucro", value: `R$ ${lucro.toFixed(0)}`, raw: lucro, color: lucro >= 0 ? "text-emerald-400" : "text-red-400", bg: lucro >= 0 ? "bg-emerald-500/15 border-emerald-500/30" : "bg-red-500/15 border-red-500/30" },
        ];
        return (
          <Card className="border-border">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Mini-Funil Financeiro
                <Badge variant="outline" className="text-[10px] ml-auto">Investido → Lucro</Badge>
              </h3>
              <div className="flex items-stretch gap-1.5 overflow-x-auto pb-1">
                {steps.map((s, i) => (
                  <div key={s.label} className="flex items-center gap-1.5 flex-1 min-w-[110px]">
                    <div className={`flex-1 rounded-lg border p-3 ${s.bg}`}>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
                      <p className={`text-base font-mono font-bold ${s.color} truncate`}>{s.value}</p>
                    </div>
                    {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* === EFICIÊNCIA POR CAMPANHA (cruzamento Ads × Vendas via UTM) === */}
      {campaignEfficiency.length > 0 && (
        <Card className="border-border">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" /> Eficiência por Campanha
              <Badge variant="outline" className="text-[10px] ml-auto">Top 10 · ordenado por ROAS</Badge>
            </h3>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campanha</TableHead>
                    <TableHead className="text-right">Gasto</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead className="text-right">ROAS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaignEfficiency.slice(0, 10).map((c) => (
                    <TableRow key={c.campanha}>
                      <TableCell className="text-xs max-w-[280px] truncate font-medium">{c.campanha}</TableCell>
                      <TableCell className="text-right font-mono text-red-400 text-xs">R$ {c.gasto.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{c.vendas}</TableCell>
                      <TableCell className="text-right font-mono text-emerald-400 text-xs">R$ {c.receita.toFixed(2)}</TableCell>
                      <TableCell className={`text-right font-mono font-bold text-xs ${c.roas >= 2 ? "text-emerald-400" : c.roas >= 1 ? "text-amber-400" : "text-red-400"}`}>
                        {c.roas > 0 ? `${c.roas.toFixed(2)}x` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Project summary table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Projeto</TableHead>
              <TableHead className="text-right">Receita</TableHead>
              <TableHead className="text-right">Investido Ads</TableHead>
              <TableHead className="text-right">Custos Op.</TableHead>
              <TableHead className="text-right">Lucro</TableHead>
              <TableHead className="text-right">ROAS</TableHead>
              <TableHead className="text-right">CPA</TableHead>
              <TableHead className="text-right">ROI%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projectSummaries.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-right font-mono text-emerald-400">R$ {p.receita.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-blue-400">{p.ads > 0 ? `R$ ${p.ads.toFixed(2)}` : "—"}</TableCell>
                <TableCell className="text-right font-mono text-red-400">R$ {(p.custo - p.ads).toFixed(2)}</TableCell>
                <TableCell className={`text-right font-mono ${p.lucro >= 0 ? "text-emerald-400" : "text-red-400"}`}>R$ {p.lucro.toFixed(2)}</TableCell>
                <TableCell className={`text-right font-mono font-bold ${p.roas >= 2 ? "text-emerald-400" : p.roas >= 1 ? "text-yellow-400" : p.roas > 0 ? "text-red-400" : "text-muted-foreground"}`}>
                  {p.roas > 0 ? `${p.roas.toFixed(2)}x` : "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-orange-400">
                  {p.cpa > 0 ? `R$ ${p.cpa.toFixed(2)}` : "—"}
                </TableCell>
                <TableCell className={`text-right font-mono font-bold ${p.roi >= 0 ? "text-emerald-400" : "text-red-400"}`}>{p.roi.toFixed(1)}%</TableCell>
              </TableRow>
            ))}
            {projectSummaries.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum projeto com dados financeiros</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

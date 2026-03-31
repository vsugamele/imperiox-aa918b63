import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Target, Users, ShoppingCart, BarChart3 } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { subDays, startOfMonth, parseISO, isWithinInterval, isValid } from "date-fns";

interface AdsSpend {
  id: string; project_id: string; plataforma: string; campanha: string | null;
  conjunto_anuncios?: string | null; data_ref: string; valor: number;
  impressoes: number; cliques: number; leads: number; compras?: number;
  custo_por_compra?: number; ctr?: number; moeda: string;
}
interface Venda {
  id: string; project_id: string; produto_nome: string; valor: number;
  plataforma: string; status: string; data_venda: string;
}
interface Project { id: string; name: string; icon?: string; }

interface Props {
  ads: AdsSpend[];
  vendas: Venda[];
  projects: Project[];
}

const PERIODS = [
  { label: "7 dias", value: "7d", days: 7 },
  { label: "30 dias", value: "30d", days: 30 },
  { label: "Mês Atual", value: "month", days: 0 },
  { label: "90 dias", value: "90d", days: 90 },
];

export function FinancasPerformance({ ads, vendas, projects }: Props) {
  const [period, setPeriod] = useState("30d");
  const [filterProject, setFilterProject] = useState("all");
  const [filterProduct, setFilterProduct] = useState("all");

  const periodRange = useMemo(() => {
    const now = new Date();
    const p = PERIODS.find(x => x.value === period);
    if (period === "month") return { start: startOfMonth(now), end: now };
    return { start: subDays(now, p?.days || 30), end: now };
  }, [period]);

  const products = useMemo(() => {
    const set = new Set(vendas.map(v => v.produto_nome).filter(Boolean));
    return Array.from(set).sort();
  }, [vendas]);

  const fAds = useMemo(() => ads.filter(a => {
    if (filterProject !== "all" && a.project_id !== filterProject) return false;
    const d = parseISO(a.data_ref);
    return isValid(d) && isWithinInterval(d, periodRange);
  }), [ads, filterProject, periodRange]);

  const fVendas = useMemo(() => vendas.filter(v => {
    if (filterProject !== "all" && v.project_id !== filterProject) return false;
    if (filterProduct !== "all" && v.produto_nome !== filterProduct) return false;
    const d = parseISO(v.data_venda);
    return isValid(d) && isWithinInterval(d, periodRange);
  }), [vendas, filterProject, filterProduct, periodRange]);

  const totalAds = fAds.reduce((s, a) => s + a.valor, 0);
  const totalReceita = fVendas.reduce((s, v) => s + v.valor, 0);
  const totalVendas = fVendas.length;
  const roas = totalAds > 0 ? totalReceita / totalAds : 0;
  const cpa = totalVendas > 0 ? totalAds / totalVendas : 0;
  const lucro = totalReceita - totalAds;

  // Timeline data
  const dailyData = useMemo(() => {
    const map = new Map<string, { date: string; ads: number; receita: number }>();
    fAds.forEach(a => {
      const d = a.data_ref;
      const cur = map.get(d) || { date: d, ads: 0, receita: 0 };
      cur.ads += a.valor;
      map.set(d, cur);
    });
    fVendas.forEach(v => {
      const d = v.data_venda?.slice(0, 10);
      if (!d) return;
      const cur = map.get(d) || { date: d, ads: 0, receita: 0 };
      cur.receita += v.valor;
      map.set(d, cur);
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [fAds, fVendas]);

  // Campaign breakdown
  const campaigns = useMemo(() => {
    const map = new Map<string, { campanha: string; investido: number; impressoes: number; cliques: number; leads: number; compras: number }>();
    fAds.forEach(a => {
      const key = a.campanha || "Sem nome";
      const cur = map.get(key) || { campanha: key, investido: 0, impressoes: 0, cliques: 0, leads: 0, compras: 0 };
      cur.investido += a.valor;
      cur.impressoes += a.impressoes;
      cur.cliques += a.cliques;
      cur.leads += a.leads;
      cur.compras += (a.compras || 0);
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.investido - a.investido);
  }, [fAds]);

  // Product breakdown
  const productBreakdown = useMemo(() => {
    const map = new Map<string, { produto: string; receita: number; vendas: number }>();
    fVendas.forEach(v => {
      const key = v.produto_nome || "Sem nome";
      const cur = map.get(key) || { produto: key, receita: 0, vendas: 0 };
      cur.receita += v.valor;
      cur.vendas += 1;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.receita - a.receita);
  }, [fVendas]);

  const kpis = [
    { label: "Investido Ads", value: `R$ ${totalAds.toFixed(2)}`, icon: BarChart3, color: "text-red-400" },
    { label: "Receita", value: `R$ ${totalReceita.toFixed(2)}`, icon: TrendingUp, color: "text-emerald-400" },
    { label: "ROAS", value: `${roas.toFixed(2)}x`, icon: Target, color: "text-amber-400" },
    { label: "CPA", value: `R$ ${cpa.toFixed(2)}`, icon: Users, color: "text-blue-400" },
    { label: "Vendas", value: String(totalVendas), icon: ShoppingCart, color: "text-violet-400" },
    { label: "Lucro", value: `R$ ${lucro.toFixed(2)}`, icon: DollarSign, color: lucro >= 0 ? "text-emerald-400" : "text-red-400" },
  ];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Projeto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Projetos</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.icon || "📁"} {p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterProduct} onValueChange={setFilterProduct}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Produto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Produtos</SelectItem>
            {products.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <Button key={p.value} size="sm" variant={period === p.value ? "default" : "outline"} onClick={() => setPeriod(p.value)}>
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map(k => (
          <Card key={k.label} className="border-border">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="p-2 rounded-xl bg-muted"><k.icon className="h-4 w-4 text-muted-foreground" /></div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{k.label}</p>
                <p className={`text-lg font-mono font-bold ${k.color}`}>{k.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Timeline Chart */}
      {dailyData.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ads vs Receita (Timeline)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Legend />
                <Line type="monotone" dataKey="ads" name="Ads (R$)" stroke="hsl(0 84% 60%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="receita" name="Receita (R$)" stroke="hsl(142 71% 45%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Campaign Table */}
      {campaigns.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Performance por Campanha</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Investido</TableHead>
                    <TableHead>Impressões</TableHead>
                    <TableHead>Cliques</TableHead>
                    <TableHead>CTR</TableHead>
                    <TableHead>Leads</TableHead>
                    <TableHead>Compras</TableHead>
                    <TableHead>CPA</TableHead>
                    <TableHead>ROAS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map(c => {
                    const ctr = c.impressoes > 0 ? (c.cliques / c.impressoes) * 100 : 0;
                    const campCpa = c.compras > 0 ? c.investido / c.compras : 0;
                    // Find matching sales for this campaign period
                    const campRoas = c.investido > 0 ? (totalReceita / campaigns.length) / c.investido : 0;
                    return (
                      <TableRow key={c.campanha}>
                        <TableCell className="font-medium text-sm max-w-[200px] truncate">{c.campanha}</TableCell>
                        <TableCell className="font-mono text-red-400">R$ {c.investido.toFixed(2)}</TableCell>
                        <TableCell className="font-mono text-xs">{c.impressoes.toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="font-mono text-xs">{c.cliques.toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="font-mono text-xs">{ctr.toFixed(2)}%</TableCell>
                        <TableCell className="font-mono text-xs">{c.leads}</TableCell>
                        <TableCell className="font-mono text-xs">{c.compras}</TableCell>
                        <TableCell className="font-mono text-xs">R$ {campCpa.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={campRoas >= 1 ? "default" : "destructive"} className="font-mono">
                            {campRoas.toFixed(2)}x
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Product Breakdown */}
      {productBreakdown.length > 0 && (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Breakdown por Produto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {productBreakdown.map(p => (
                <Card key={p.produto} className="border-border bg-muted/30">
                  <CardContent className="p-4 space-y-1">
                    <p className="font-medium text-sm truncate">{p.produto}</p>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Receita</span>
                      <span className="font-mono text-emerald-400">R$ {p.receita.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Vendas</span>
                      <span className="font-mono">{p.vendas}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Ticket Médio</span>
                      <span className="font-mono">R$ {(p.vendas > 0 ? p.receita / p.vendas : 0).toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {fAds.length === 0 && fVendas.length === 0 && (
        <p className="text-center text-muted-foreground py-12">Nenhum dado de performance encontrado para o período selecionado</p>
      )}
    </div>
  );
}

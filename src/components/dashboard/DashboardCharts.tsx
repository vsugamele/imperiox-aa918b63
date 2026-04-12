import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, ShoppingCart, DollarSign } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";

interface Props {
  period: string;
  projectFilter: string;
  productFilter?: string;
}

const COLORS_PIE = ["hsl(var(--primary))", "hsl(142, 71%, 45%)", "hsl(45, 93%, 47%)", "hsl(262, 83%, 58%)", "hsl(199, 89%, 48%)", "hsl(340, 82%, 52%)"];

export default function DashboardCharts({ period, projectFilter }: Props) {
  const [leadsTrend, setLeadsTrend] = useState<any[]>([]);
  const [funnelData, setFunnelData] = useState<any[]>([]);
  const [receitaVsCusto, setReceitaVsCusto] = useState<any[]>([]);
  const [receitaPorProjeto, setReceitaPorProjeto] = useState<any[]>([]);
  const [receitaPorProduto, setReceitaPorProduto] = useState<any[]>([]);
  const [roasData, setRoasData] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      // Leads trend last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [leadsRawRes, totalLeadsRes, pixLeadsRes, buyersRes, costsRes, revsRes, vendasRes, adsRes, finResumo] = await Promise.all([
        supabase.from("imphq_leads").select("created_at").gte("created_at", thirtyDaysAgo.toISOString()),
        supabase.from("imphq_leads").select("id", { count: "exact", head: true }),
        supabase.from("imphq_leads").select("id", { count: "exact", head: true }).not("data->ultimo_evento", "is", null),
        supabase.from("imphq_leads").select("id", { count: "exact", head: true }).eq("status", "cliente"),
        supabase.from("imphq_project_costs").select("valor, moeda, created_at"),
        supabase.from("imphq_project_revenue").select("valor, created_at"),
        supabase.from("imphq_vendas").select("valor, status, created_at, produto_nome").eq("status", "aprovado"),
        supabase.from("imphq_ads_spend").select("valor, data"),
        supabase.from("vw_financas_resumo").select("*").gt("receita_total", 0).order("lucro_liquido", { ascending: false }).limit(5),
      ]);

      // Leads trend
      const leadsByDay: Record<string, number> = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        leadsByDay[d.toISOString().split("T")[0]] = 0;
      }
      (leadsRawRes.data || []).forEach((l: any) => {
        const day = l.created_at?.split("T")[0];
        if (day && leadsByDay[day] !== undefined) leadsByDay[day]++;
      });
      setLeadsTrend(Object.entries(leadsByDay).map(([date, count]) => ({ date: date.slice(5), count })));

      // Funnel
      setFunnelData([
        { stage: "Leads", value: totalLeadsRes.count || 0, fill: "hsl(var(--primary))" },
        { stage: "Pix", value: pixLeadsRes.count || 0, fill: "hsl(45, 93%, 47%)" },
        { stage: "Compra", value: buyersRes.count || 0, fill: "hsl(142, 71%, 45%)" },
      ]);

      // Revenue vs Cost by month (last 6 months)
      const monthMap: Record<string, { receita: number; custo: number; ads: number }> = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthMap[key] = { receita: 0, custo: 0, ads: 0 };
      }

      (revsRes.data || []).forEach((r: any) => { const m = r.created_at?.slice(0, 7); if (m && monthMap[m]) monthMap[m].receita += parseFloat(r.valor) || 0; });
      (vendasRes.data || []).forEach((v: any) => { const m = v.created_at?.slice(0, 7); if (m && monthMap[m]) monthMap[m].receita += parseFloat(v.valor) || 0; });
      (costsRes.data || []).forEach((c: any) => { const m = c.created_at?.slice(0, 7); const val = parseFloat(c.valor) || 0; if (m && monthMap[m]) monthMap[m].custo += c.moeda === "USD" ? val * 5.2 : val; });
      (adsRes.data || []).forEach((a: any) => { const m = a.data?.slice(0, 7); if (m && monthMap[m]) monthMap[m].ads += parseFloat(a.valor) || 0; });

      setReceitaVsCusto(Object.entries(monthMap).map(([month, v]) => ({ month: month.slice(5), receita: v.receita, custo: v.custo + v.ads })));

      // Receita por Projeto
      setReceitaPorProjeto((finResumo.data || []).filter((f: any) => Number(f.receita_total) > 0).map((f: any) => ({ name: `${f.project_icon || "📁"} ${f.project_name || "?"}`, value: Number(f.receita_total) || 0 })).sort((a: any, b: any) => b.value - a.value).slice(0, 5));

      // Receita por Produto
      const prodMap = new Map<string, number>();
      (vendasRes.data || []).forEach((v: any) => { const prod = v.produto_nome || "Sem produto"; prodMap.set(prod, (prodMap.get(prod) || 0) + (parseFloat(v.valor) || 0)); });
      setReceitaPorProduto(Array.from(prodMap.entries()).map(([name, value], i) => ({ name, value, fill: COLORS_PIE[i % COLORS_PIE.length] })).sort((a, b) => b.value - a.value).slice(0, 6));

      // ROAS
      setRoasData(Object.entries(monthMap).map(([month, v]) => { const totalCusto = v.custo + v.ads; return { month: month.slice(5), roas: totalCusto > 0 ? parseFloat((v.receita / totalCusto).toFixed(2)) : 0 }; }));
    }
    load();
  }, [period, projectFilter]);

  return (
    <>
      {/* Leads Trend + Receita vs Custo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Leads (30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={leadsTrend}>
                <defs><linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} /><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="url(#leadGrad)" strokeWidth={2} name="Leads" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-400" /> Receita vs Custo (6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={receitaVsCusto}>
                <defs>
                  <linearGradient id="recGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                  <linearGradient id="custGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} /><stop offset="95%" stopColor="#ef4444" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                <Area type="monotone" dataKey="receita" stroke="#10b981" fill="url(#recGrad)" strokeWidth={2} name="Receita" />
                <Area type="monotone" dataKey="custo" stroke="#ef4444" fill="url(#custGrad)" strokeWidth={2} name="Custo" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Funnel */}
      {funnelData.some(f => f.value > 0) && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-primary" /> Funil de Conversão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-6 justify-center py-4">
              {funnelData.map((f, i) => {
                const maxVal = Math.max(...funnelData.map(d => d.value), 1);
                const height = Math.max(30, (f.value / maxVal) * 120);
                const prevVal = i > 0 ? funnelData[i - 1].value : null;
                const conv = prevVal && prevVal > 0 ? ((f.value / prevVal) * 100).toFixed(1) : null;
                return (
                  <div key={f.stage} className="flex flex-col items-center gap-2">
                    <span className="text-xl font-mono font-bold" style={{ color: f.fill }}>{f.value}</span>
                    <div className="w-20 rounded-t-lg transition-all" style={{ height, backgroundColor: f.fill, opacity: 0.7 }} />
                    <span className="text-xs font-medium">{f.stage}</span>
                    {conv && <Badge variant="outline" className="text-[9px]">{conv}%</Badge>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Extra Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {receitaPorProjeto.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base flex items-center gap-2"><DollarSign className="h-4 w-4 text-emerald-400" /> Receita por Projeto</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={receitaPorProjeto} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={100} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                  <Bar dataKey="value" fill="hsl(142, 71%, 45%)" radius={[0, 4, 4, 0]} name="Receita" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {receitaPorProduto.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-primary" /> Receita por Produto</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={receitaPorProduto} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} label={({ name, percent }) => `${name.slice(0, 12)} ${(percent * 100).toFixed(0)}%`}>
                    {receitaPorProduto.map((entry: any, i: number) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {roasData.some(r => r.roas > 0) && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> ROAS por Mês</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={roasData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => `${v}x`} />
                  <Bar dataKey="roas" name="ROAS" radius={[4, 4, 0, 0]}>
                    {roasData.map((entry: any, i: number) => <Cell key={i} fill={entry.roas >= 1 ? "hsl(142, 71%, 45%)" : "hsl(0, 84%, 60%)"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

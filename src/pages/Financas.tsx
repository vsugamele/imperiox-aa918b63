import { useEffect, useState, useMemo } from "react";
import { SectionInfo } from "@/components/SectionInfo";
import { toLocalDateStr, localDaysAgo } from "@/lib/periodUtils";
import { sectionHelpTexts } from "@/data/sectionHelpTexts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DollarSign, Plus, Trash2, Pencil, TrendingUp, TrendingDown, Percent, Target, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { FinancasOverview } from "@/components/financas/FinancasOverview";
import { FinancasAds } from "@/components/financas/FinancasAds";
import { FinancasProdutos } from "@/components/financas/FinancasProdutos";
import { FinancasPerformance } from "@/components/financas/FinancasPerformance";
import { RevenueModeToggle } from "@/components/shared/RevenueModeToggle";
import { useRevenueMode, getRevenue } from "@/lib/revenueMode";

const USD_BRL = 5.2;
const TIPOS = ["SaaS", "API", "Infra", "Ads", "Freelancer", "Outro"];

interface Custo { id: string; nome: string; tipo?: string; valor: number; moeda?: string; }
interface ProjectCost { id: string; project_id: string; nome: string; categoria: string; valor: number; moeda: string; }
interface ProjectRevenue { id: string; project_id: string; descricao: string; valor: number; fonte: string; data_ref: string; }
interface Venda { id: string; project_id: string; produto_nome: string; valor: number; valor_liquido?: number | null; plataforma: string; status: string; data_venda: string; }
interface AdsSpend { id: string; project_id: string; plataforma: string; campanha: string | null; conjunto_anuncios?: string | null; data_ref: string; valor: number; impressoes: number; alcance?: number; cliques: number; leads: number; compras?: number; custo_por_compra?: number; hook_rate?: number; hold_rate?: number; ctr?: number; frequencia?: number; moeda: string; }
interface Project { id: string; name: string; icon?: string; briefing?: any; }

export default function Financas() {
  const [custos, setCustos] = useState<Custo[]>([]);
  const [projectCosts, setProjectCosts] = useState<ProjectCost[]>([]);
  const [projectRevenues, setProjectRevenues] = useState<ProjectRevenue[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [ads, setAds] = useState<AdsSpend[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filterProject, setFilterProject] = useState("all");
  const [filterProduct, setFilterProduct] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [showCustoDialog, setShowCustoDialog] = useState(false);
  const [editingCusto, setEditingCusto] = useState<Custo | null>(null);
  const [custoForm, setCustoForm] = useState({ nome: "", tipo: "SaaS", valor: "", moeda: "BRL" });

  const load = async () => {
    const [r1, r2, r3, r4, r5, r6] = await Promise.all([
      supabase.from("imphq_custos").select("*").order("nome"),
      supabase.from("imphq_project_costs").select("*"),
      supabase.from("imphq_project_revenue").select("*"),
      supabase.from("imphq_vendas").select("*").eq("status", "aprovado"),
      supabase.from("imphq_ads_spend").select("*").order("data_ref", { ascending: false }),
      supabase.from("imphq_projects").select("id, name, icon, briefing" as any).or("is_archived.eq.false,is_archived.is.null"),
    ]);
    setCustos((r1.data || []).map((c: any) => ({ ...c, valor: parseFloat(c.valor) || 0 })));
    setProjectCosts((r2.data || []).map((c: any) => ({ ...c, valor: parseFloat(c.valor) || 0 })));
    setProjectRevenues((r3.data || []).map((c: any) => ({ ...c, valor: parseFloat(c.valor) || 0 })));
    setVendas((r4.data || []).map((v: any) => ({ ...v, valor: parseFloat(v.valor) || 0 })));
    setAds((r5.data || []).map((a: any) => ({
      ...a,
      valor: parseFloat(a.valor) || 0,
      impressoes: a.impressoes || 0,
      cliques: a.cliques || 0,
      leads: a.leads || 0,
      alcance: a.alcance || 0,
      compras: a.compras || 0,
      custo_por_compra: parseFloat(a.custo_por_compra) || 0,
      hook_rate: parseFloat(a.hook_rate) || 0,
      hold_rate: parseFloat(a.hold_rate) || 0,
      ctr: parseFloat(a.ctr) || 0,
      frequencia: parseFloat(a.frequencia) || 0,
    })));
    setProjects((r6.data || []) as unknown as Project[]);
  };

  useEffect(() => { load(); }, []);

  // Date filter helper
  const inDateRange = (dateStr: string | null | undefined) => {
    if (!dateStr) return true;
    const d = dateStr.slice(0, 10);
    if (filterDateFrom && d < filterDateFrom) return false;
    if (filterDateTo && d > filterDateTo) return false;
    return true;
  };

  const setQuickDate = (days: number | "month" | "all") => {
    if (days === "all") { setFilterDateFrom(""); setFilterDateTo(""); return; }
    setFilterDateTo(toLocalDateStr());
    if (days === "month") {
      const now = new Date();
      setFilterDateFrom(toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1)));
    } else {
      setFilterDateFrom(localDaysAgo(days as number));
    }
  };

  // Unique products from vendas
  const uniqueProducts = [...new Set(vendas.map(v => v.produto_nome).filter(Boolean))].sort();

  // Filtered data
  const fp = filterProject;

  // Calculate days in filter range for prorating recurring global costs
  const periodDays = useMemo(() => {
    if (!filterDateFrom && !filterDateTo) return 30; // default: treat as 1 month
    const from = filterDateFrom ? new Date(filterDateFrom) : new Date(filterDateTo);
    const to = filterDateTo ? new Date(filterDateTo) : new Date(filterDateFrom);
    const diff = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
    return diff;
  }, [filterDateFrom, filterDateTo]);

  // Global costs are monthly recurring — prorate to period
  const fCustos = custos;
  const custoProrateFactor = periodDays / 30;

  // Project costs filtered by date (using data_pagamento or created_at)
  const fProjectCosts = (fp === "all" ? projectCosts : projectCosts.filter(c => c.project_id === fp))
    .filter(c => inDateRange((c as any).data_pagamento || (c as any).created_at));
  const fProjectRevenues = (fp === "all" ? projectRevenues : projectRevenues.filter(r => r.project_id === fp)).filter(r => inDateRange(r.data_ref));
  const fVendas = (fp === "all" ? vendas : vendas.filter(v => v.project_id === fp))
    .filter(v => inDateRange(v.data_venda))
    .filter(v => filterProduct === "all" || v.produto_nome === filterProduct);
  const fAds = (fp === "all" ? ads : ads.filter(a => a.project_id === fp)).filter(a => inDateRange(a.data_ref));

  // KPI calculations
  const custosGlobaisBRL = fCustos.reduce((a, c) => a + (c.moeda === "USD" ? c.valor * USD_BRL : c.valor), 0) * custoProrateFactor;
  const custosProjetoBRL = fProjectCosts.reduce((a, c) => a + (c.moeda === "USD" ? c.valor * USD_BRL : c.valor), 0);
  const adsTotal = fAds.reduce((a, b) => a + b.valor, 0);

  const receitaVendas = fVendas.reduce((a, v) => a + v.valor, 0);
  const receitaManual = fProjectRevenues.reduce((a, r) => a + r.valor, 0);
  const totalReceita = receitaVendas + receitaManual;

  // Proporcionalizar ads quando filtro de produto ativo
  const allVendasFiltered = (fp === "all" ? vendas : vendas.filter(v => v.project_id === fp))
    .filter(v => inDateRange(v.data_venda));
  const receitaTotalSemFiltroProduto = allVendasFiltered.reduce((a, v) => a + v.valor, 0);
  const adsProportional = filterProduct !== "all" && receitaTotalSemFiltroProduto > 0
    ? adsTotal * (receitaVendas / receitaTotalSemFiltroProduto)
    : adsTotal;

  const totalCusto = custosGlobaisBRL + custosProjetoBRL + adsProportional;
  const lucro = totalReceita - totalCusto;
  const roi = totalCusto > 0 ? (lucro / totalCusto) * 100 : 0;
  const roas = adsProportional > 0 ? totalReceita / adsProportional : 0;

  // Project summaries (using filtered data)
  const projectSummaries = projects.map(p => {
    const pCosts = fProjectCosts.filter(c => c.project_id === p.id).reduce((a, c) => a + (c.moeda === "USD" ? c.valor * USD_BRL : c.valor), 0);
    const pAds = fAds.filter(a => a.project_id === p.id).reduce((a, b) => a + b.valor, 0);
    const pVendas = fVendas.filter(v => v.project_id === p.id).reduce((a, v) => a + v.valor, 0);
    const pVendasCount = fVendas.filter(v => v.project_id === p.id).length;
    const pRevenues = fProjectRevenues.filter(r => r.project_id === p.id).reduce((a, r) => a + r.valor, 0);
    const receita = pVendas + pRevenues;
    const custo = pCosts + pAds;
    const lucro = receita - custo;
    const roas = pAds > 0 ? receita / pAds : 0;
    const cpa = pVendasCount > 0 && pAds > 0 ? pAds / pVendasCount : 0;
    return { id: p.id, name: p.name, receita, custo, lucro, roi: custo > 0 ? (lucro / custo) * 100 : 0, ads: pAds, roas, cpa, vendasCount: pVendasCount };
  }).filter(p => p.receita > 0 || p.custo > 0);

  // Daily timeline data for overview (ads vs vendas)
  const dailyMap = new Map<string, { ads: number; vendas: number }>();
  fAds.forEach(a => {
    const d = a.data_ref;
    const cur = dailyMap.get(d) || { ads: 0, vendas: 0 };
    cur.ads += a.valor;
    dailyMap.set(d, cur);
  });
  fVendas.forEach(v => {
    const d = v.data_venda?.slice(0, 10);
    if (!d) return;
    const cur = dailyMap.get(d) || { ads: 0, vendas: 0 };
    cur.vendas += v.valor;
    dailyMap.set(d, cur);
  });
  const dailyData = Array.from(dailyMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Custo CRUD
  const openNewCusto = () => { setEditingCusto(null); setCustoForm({ nome: "", tipo: "SaaS", valor: "", moeda: "BRL" }); setShowCustoDialog(true); };
  const openEditCusto = (c: Custo) => { setEditingCusto(c); setCustoForm({ nome: c.nome, tipo: c.tipo || "SaaS", valor: String(c.valor), moeda: c.moeda || "BRL" }); setShowCustoDialog(true); };
  const saveCusto = async () => {
    if (!custoForm.nome.trim()) { toast.error("Nome obrigatório"); return; }
    const payload = { nome: custoForm.nome, tipo: custoForm.tipo, valor: parseFloat(custoForm.valor) || 0, moeda: custoForm.moeda };
    if (editingCusto) {
      const { error } = await supabase.from("imphq_custos").update(payload).eq("id", editingCusto.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("imphq_custos").insert({ id: crypto.randomUUID(), ...payload });
      if (error) { toast.error(error.message); return; }
    }
    setShowCustoDialog(false);
    toast.success(editingCusto ? "Atualizado!" : "Adicionado!");
    load();
  };
  const removeCusto = async (id: string) => { await supabase.from("imphq_custos").delete().eq("id", id); toast.success("Removido"); load(); };

  const kpis = [
    { label: "Receita Total", value: `R$ ${totalReceita.toFixed(2)}`, icon: TrendingUp, gradient: "from-emerald-500/15 to-emerald-500/5", iconBg: "bg-emerald-500/15 text-emerald-400", textColor: "text-emerald-400" },
    { label: "🏢 Custo Empresa", value: `R$ ${custosGlobaisBRL.toFixed(2)}`, icon: TrendingDown, gradient: "from-red-500/15 to-red-500/5", iconBg: "bg-red-500/15 text-red-400", textColor: "text-red-400" },
    { label: "📁 Custo Projetos", value: `R$ ${(custosProjetoBRL + adsProportional).toFixed(2)}`, icon: TrendingDown, gradient: "from-orange-500/15 to-orange-500/5", iconBg: "bg-orange-500/15 text-orange-400", textColor: "text-orange-400" },
    { label: "Lucro", value: `R$ ${lucro.toFixed(2)}`, icon: DollarSign, gradient: lucro >= 0 ? "from-emerald-500/15 to-emerald-500/5" : "from-red-500/15 to-red-500/5", iconBg: lucro >= 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400", textColor: lucro >= 0 ? "text-emerald-400" : "text-red-400" },
    { label: "ROI", value: `${roi.toFixed(1)}%`, icon: Percent, gradient: "from-blue-500/15 to-blue-500/5", iconBg: "bg-blue-500/15 text-blue-400", textColor: "text-blue-400" },
    ...(adsProportional > 0 ? [{ label: "ROAS", value: roas.toFixed(2) + "x", icon: Target, gradient: "from-amber-500/15 to-amber-500/5", iconBg: "bg-amber-500/15 text-amber-400", textColor: "text-amber-400" }] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-3xl font-bold text-primary flex items-center gap-2">💰 Finanças <SectionInfo {...sectionHelpTexts.financas} /></h1>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => {
            const headers = ["Tipo","Projeto","Descrição","Valor","Data"];
            const rows = [
              ...fVendas.map(v => ["Venda", projects.find(p=>p.id===v.project_id)?.name||"", v.produto_nome, `R$ ${v.valor.toFixed(2)}`, v.data_venda?.split("T")[0]||""]),
              ...fProjectRevenues.map(r => ["Receita Manual", projects.find(p=>p.id===r.project_id)?.name||"", r.descricao, `R$ ${r.valor.toFixed(2)}`, r.data_ref||""]),
              ...fProjectCosts.map(c => ["Custo Projeto", projects.find(p=>p.id===c.project_id)?.name||"", c.nome, `R$ ${c.valor.toFixed(2)}`, ""]),
              ...fAds.map(a => ["Ads", projects.find(p=>p.id===a.project_id)?.name||"", a.campanha||a.plataforma, `R$ ${a.valor.toFixed(2)}`, a.data_ref||""]),
            ];
            const csv = [headers,...rows].map(r => r.map(c=>`"${(c||"").replace(/"/g,'""')}"`).join(",")).join("\n");
            const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href=url; a.download=`financas_${new Date().toISOString().split("T")[0]}.csv`; a.click();
            URL.revokeObjectURL(url);
            toast.success("Relatório financeiro exportado");
          }}>📥 Export CSV</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-[200px] h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Projetos</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.icon || "📁"} {p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {uniqueProducts.length > 0 && (
          <Select value={filterProduct} onValueChange={setFilterProduct}>
            <SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Produtos</SelectItem>
              {uniqueProducts.map(p => <SelectItem key={p} value={p}>📦 {p}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="w-[140px] h-9 text-xs" />
        <span className="text-xs text-muted-foreground">até</span>
        <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="w-[140px] h-9 text-xs" />
        <div className="flex gap-1">
          {[
            { label: "Hoje", val: 0 },
            { label: "7d", val: 7 },
            { label: "30d", val: 30 },
            { label: "Mês", val: "month" as const },
            { label: "Todos", val: "all" as const },
          ].map(b => (
            <Button key={b.label} size="sm" variant="ghost" className="h-7 text-[10px] px-2" onClick={() => setQuickDate(b.val)}>
              {b.label}
            </Button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map((k, i) => (
          <Card key={k.label} className={`bg-gradient-to-br ${k.gradient} border-border animate-fade-in`} style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`p-2.5 rounded-xl ${k.iconBg}`}><k.icon className="h-4 w-4" /></div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{k.label}</p>
                <p className={`text-xl font-mono font-bold ${k.textColor}`}>{k.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="custos">Custos</TabsTrigger>
          <TabsTrigger value="receitas">Receitas</TabsTrigger>
          <TabsTrigger value="ads">Ads</TabsTrigger>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <FinancasOverview
            projectSummaries={projectSummaries}
            dailyData={dailyData}
            totalAds={adsProportional}
            totalVendas={receitaVendas}
            totalVendasCount={fVendas.length}
            totalCustos={custosGlobaisBRL + custosProjetoBRL}
            filterDateFrom={filterDateFrom}
          />
        </TabsContent>

        <TabsContent value="custos">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Custos Globais (Ferramentas)</h2>
              <Button size="sm" onClick={openNewCusto}><Plus className="h-4 w-4 mr-1" /> Nova Ferramenta</Button>
            </div>
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ferramenta</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Moeda</TableHead>
                    <TableHead>Em R$</TableHead>
                    <TableHead className="w-[80px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fCustos.map(c => {
                    const brl = c.moeda === "USD" ? c.valor * USD_BRL : c.valor;
                    return (
                      <TableRow key={c.id} className="hover:bg-muted/30 group">
                        <TableCell className="font-medium">{c.nome}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.tipo || "—"}</TableCell>
                        <TableCell className="font-mono">{c.valor.toFixed(2)}</TableCell>
                        <TableCell className="text-xs">{c.moeda || "BRL"}</TableCell>
                        <TableCell className="font-mono text-primary">R$ {brl.toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditCusto(c)}><Pencil className="h-3 w-3" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeCusto(c.id)}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {fCustos.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma ferramenta cadastrada</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>

            {fProjectCosts.length > 0 && (
              <>
                <h2 className="text-lg font-semibold mt-6">Custos por Projeto</h2>
                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Projeto</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fProjectCosts.map(c => (
                        <TableRow key={c.id}>
                          <TableCell className="text-xs">{projects.find(p => p.id === c.project_id)?.name || c.project_id}</TableCell>
                          <TableCell className="font-medium">{c.nome}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{c.categoria}</TableCell>
                          <TableCell className="font-mono text-red-400">R$ {c.valor.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="receitas">
          <div className="space-y-4">
            {fVendas.length > 0 && (
              <>
                <h2 className="text-lg font-semibold">Vendas (Webhook)</h2>
                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Projeto</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Plataforma</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fVendas.slice(0, 50).map(v => (
                        <TableRow key={v.id}>
                          <TableCell className="text-xs">{projects.find(p => p.id === v.project_id)?.name || v.project_id}</TableCell>
                          <TableCell className="font-medium text-sm">{v.produto_nome}</TableCell>
                          <TableCell className="text-xs">{v.plataforma}</TableCell>
                          <TableCell className="font-mono text-emerald-400">R$ {v.valor.toFixed(2)}</TableCell>
                          <TableCell className="text-xs font-mono">{new Date(v.data_venda).toLocaleDateString("pt-BR")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
            {fProjectRevenues.length > 0 && (
              <>
                <h2 className="text-lg font-semibold">Receitas Manuais</h2>
                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Projeto</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Fonte</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fProjectRevenues.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs">{projects.find(p => p.id === r.project_id)?.name || r.project_id}</TableCell>
                          <TableCell className="font-medium text-sm">{r.descricao}</TableCell>
                          <TableCell className="text-xs">{r.fonte}</TableCell>
                          <TableCell className="font-mono text-emerald-400">R$ {r.valor.toFixed(2)}</TableCell>
                          <TableCell className="text-xs font-mono">{r.data_ref}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
            {fVendas.length === 0 && fProjectRevenues.length === 0 && (
              <p className="text-center text-muted-foreground py-12">Nenhuma receita registrada</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="ads">
          {fAds.length === 0 && ads.length > 0 && (filterDateFrom || filterDateTo) && (
            <Card className="mb-4 border-amber-500/30 bg-amber-500/5">
              <CardContent className="flex items-center gap-3 p-4">
                <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-300">Nenhum dado de Ads neste período</p>
                  <p className="text-xs text-muted-foreground">
                    Dados existem entre {ads[ads.length - 1]?.data_ref?.slice(0, 10)} e {ads[0]?.data_ref?.slice(0, 10)}. Ajuste o filtro de datas.
                  </p>
                </div>
                <Button size="sm" variant="outline" className="shrink-0 text-xs" onClick={() => setQuickDate("all")}>
                  Ver todos
                </Button>
              </CardContent>
            </Card>
          )}
          <FinancasAds ads={fAds} projects={projects} onRefresh={load} filterProjectId={filterProject === "all" ? "" : filterProject} vendas={fVendas} />
        </TabsContent>

        <TabsContent value="produtos">
          <FinancasProdutos
            vendas={fVendas}
            revenues={fProjectRevenues.map(r => ({ id: r.id, descricao: r.descricao, valor: r.valor, produto_nome: (r as any).produto_nome || null }))}
            costs={fProjectCosts.map(c => ({ id: c.id, nome: c.nome, valor: c.valor, produto_nome: (c as any).produto_nome || null }))}
            ads={fAds.map(a => ({ id: a.id, valor: a.valor, campanha: a.campanha }))}
            briefingProdutos={projects.flatMap(p => {
              const b = p.briefing as any;
              return Array.isArray(b?.produtos) ? b.produtos : [];
            })}
          />
        </TabsContent>

        <TabsContent value="performance">
          <FinancasPerformance ads={fAds} vendas={fVendas} projects={projects} />
        </TabsContent>
      </Tabs>

      {/* Custo Dialog */}
      <Dialog open={showCustoDialog} onOpenChange={setShowCustoDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingCusto ? "Editar Ferramenta" : "Nova Ferramenta"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={custoForm.nome} onChange={e => setCustoForm({ ...custoForm, nome: e.target.value })} placeholder="Ex: Supabase, ChatGPT..." /></div>
            <div>
              <Label>Tipo</Label>
              <Select value={custoForm.tipo} onValueChange={v => setCustoForm({ ...custoForm, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor</Label><Input type="number" value={custoForm.valor} onChange={e => setCustoForm({ ...custoForm, valor: e.target.value })} placeholder="0.00" /></div>
              <div>
                <Label>Moeda</Label>
                <Select value={custoForm.moeda} onValueChange={v => setCustoForm({ ...custoForm, moeda: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BRL">BRL (R$)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={saveCusto}>{editingCusto ? "Salvar" : "Criar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

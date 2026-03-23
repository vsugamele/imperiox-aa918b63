import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, TrendingDown, Percent, Plus, Trash2, Receipt, Wallet, Megaphone, ShoppingCart, Upload, Target, Pencil, Paperclip, ExternalLink, Package } from "lucide-react";
import { toast } from "sonner";
import { AdsImportDialog } from "@/components/financas/AdsImportDialog";
import { FileUpload } from "@/components/FileUpload";
import { FinancasProdutos } from "@/components/financas/FinancasProdutos";

interface Cost {
  id: string; nome: string; categoria: string; valor: number; moeda: string; recorrente: boolean; documento_url?: string | null;
}
interface Revenue {
  id: string; descricao: string; valor: number; fonte: string; data_ref: string;
  produto_nome?: string | null; documento_url?: string | null;
}
interface AdsSpend {
  id: string; plataforma: string; campanha: string | null; conjunto_anuncios?: string | null;
  anuncio?: string | null; data_ref: string; valor: number; impressoes: number; alcance?: number;
  cliques: number; leads: number; compras?: number; custo_por_compra?: number;
  hook_rate?: number; ctr?: number; frequencia?: number;
}
interface Venda {
  id: string; produto_nome: string; valor: number; plataforma: string; status: string; data_venda: string;
}

const COST_CATS = ["Ferramentas", "Ads", "Freelancer", "Infra", "Outro"];
const REV_SOURCES = ["Manual", "Hotmart", "Stripe", "Kiwify", "Outro"];

export function ProjetoFinancas({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const [costs, setCosts] = useState<Cost[]>([]);
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [ads, setAds] = useState<AdsSpend[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [showCostForm, setShowCostForm] = useState(false);
  const [showRevForm, setShowRevForm] = useState(false);
  const [showAdsImport, setShowAdsImport] = useState(false);
  const [editingCost, setEditingCost] = useState<Cost | null>(null);
  const [editingRevenue, setEditingRevenue] = useState<Revenue | null>(null);
  const [costForm, setCostForm] = useState({ nome: "", categoria: "Outro", valor: "", moeda: "BRL", recorrente: true, documento_url: "" });
  const [revForm, setRevForm] = useState({ descricao: "", valor: "", fonte: "Manual", data_ref: new Date().toISOString().split("T")[0], produto_nome: "", documento_url: "" });
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => { loadData(); }, [projectId]);

  const loadData = async () => {
    const [c, r, a, v, p] = await Promise.all([
      supabase.from("imphq_project_costs").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
      supabase.from("imphq_project_revenue").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
      supabase.from("imphq_ads_spend").select("*").eq("project_id", projectId).order("data_ref", { ascending: false }),
      supabase.from("imphq_vendas").select("*").eq("project_id", projectId).eq("status", "aprovado").order("data_venda", { ascending: false }),
      supabase.from("imphq_projects").select("id, name").order("name"),
    ]);
    setCosts((c.data || []).map((x: any) => ({ ...x, valor: parseFloat(x.valor) || 0 })));
    setRevenues((r.data || []).map((x: any) => ({ ...x, valor: parseFloat(x.valor) || 0 })));
    setAds((a.data || []).map((x: any) => ({
      ...x, valor: parseFloat(x.valor) || 0, impressoes: x.impressoes || 0,
      cliques: x.cliques || 0, leads: x.leads || 0, alcance: x.alcance || 0,
      compras: x.compras || 0, custo_por_compra: parseFloat(x.custo_por_compra) || 0,
      hook_rate: parseFloat(x.hook_rate) || 0, ctr: parseFloat(x.ctr) || 0,
      frequencia: parseFloat(x.frequencia) || 0,
    })));
    setVendas((v.data || []).map((x: any) => ({ ...x, valor: parseFloat(x.valor) || 0 })));
    setProjects((p.data || []) as { id: string; name: string }[]);
  };

  // KPIs
  const totalCost = costs.reduce((s, c) => s + (c.moeda === "USD" ? c.valor * 5.2 : c.valor), 0);
  const totalRev = revenues.reduce((s, r) => s + r.valor, 0);
  const totalAds = ads.reduce((s, a) => s + a.valor, 0);
  const totalVendas = vendas.reduce((s, v) => s + v.valor, 0);
  const totalReceita = totalRev + totalVendas;
  const totalCusto = totalCost + totalAds;
  const profit = totalReceita - totalCusto;
  const roi = totalCusto > 0 ? ((profit / totalCusto) * 100) : 0;
  const roas = totalAds > 0 ? totalReceita / totalAds : 0;

  // Ads KPIs
  const totalCliques = ads.reduce((s, a) => s + a.cliques, 0);
  const totalCompras = ads.reduce((s, a) => s + (a.compras || 0), 0);
  const cpc = totalCliques > 0 ? totalAds / totalCliques : 0;
  const cpl = ads.reduce((s, a) => s + a.leads, 0) > 0 ? totalAds / ads.reduce((s, a) => s + a.leads, 0) : 0;

  const openCostFormForNew = () => {
    setEditingCost(null);
    setCostForm({ nome: "", categoria: "Outro", valor: "", moeda: "BRL", recorrente: true, documento_url: "" });
    setShowCostForm(true);
  };

  const openCostFormForEdit = (cost: Cost) => {
    setEditingCost(cost);
    setCostForm({
      nome: cost.nome,
      categoria: cost.categoria,
      valor: String(cost.valor),
      moeda: cost.moeda,
      recorrente: cost.recorrente,
      documento_url: cost.documento_url || "",
    });
    setShowCostForm(true);
  };

  const saveCost = async () => {
    if (!costForm.nome.trim() || !costForm.valor) { toast.error("Preencha nome e valor"); return; }
    const payload = {
      nome: costForm.nome,
      categoria: costForm.categoria,
      valor: parseFloat(costForm.valor),
      moeda: costForm.moeda,
      recorrente: costForm.recorrente,
      documento_url: costForm.documento_url || null,
    };

    if (editingCost) {
      const { error } = await supabase.from("imphq_project_costs").update(payload).eq("id", editingCost.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Custo atualizado!");
    } else {
      const { error } = await supabase.from("imphq_project_costs").insert([{
        ...payload, project_id: projectId, user_id: user?.id,
      }]);
      if (error) { toast.error(error.message); return; }
      toast.success("Custo adicionado!");
    }
    setShowCostForm(false);
    setEditingCost(null);
    loadData();
  };

  const openRevFormForNew = () => {
    setEditingRevenue(null);
    setRevForm({ descricao: "", valor: "", fonte: "Manual", data_ref: new Date().toISOString().split("T")[0], produto_nome: "", documento_url: "" });
    setShowRevForm(true);
  };

  const openRevFormForEdit = (rev: Revenue) => {
    setEditingRevenue(rev);
    setRevForm({
      descricao: rev.descricao,
      valor: String(rev.valor),
      fonte: rev.fonte,
      data_ref: rev.data_ref,
      produto_nome: rev.produto_nome || "",
      documento_url: rev.documento_url || "",
    });
    setShowRevForm(true);
  };

  const saveRevenue = async () => {
    if (!revForm.descricao.trim() || !revForm.valor) { toast.error("Preencha descrição e valor"); return; }
    const payload = {
      descricao: revForm.descricao,
      valor: parseFloat(revForm.valor),
      fonte: revForm.fonte,
      data_ref: revForm.data_ref,
      produto_nome: revForm.produto_nome || null,
      documento_url: revForm.documento_url || null,
    } as any;

    if (editingRevenue) {
      const { error } = await supabase.from("imphq_project_revenue").update(payload).eq("id", editingRevenue.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Receita atualizada!");
    } else {
      const { error } = await supabase.from("imphq_project_revenue").insert([{
        ...payload, project_id: projectId, user_id: user?.id,
      }]);
      if (error) { toast.error(error.message); return; }
      toast.success("Receita adicionada!");
    }
    setShowRevForm(false);
    setEditingRevenue(null);
    setRevForm({ descricao: "", valor: "", fonte: "Manual", data_ref: new Date().toISOString().split("T")[0], produto_nome: "", documento_url: "" });
    loadData();
  };

  const deleteCost = async (id: string) => {
    await supabase.from("imphq_project_costs").delete().eq("id", id);
    setCosts(prev => prev.filter(c => c.id !== id));
    toast.success("Removido");
  };

  const deleteRevenue = async (id: string) => {
    await supabase.from("imphq_project_revenue").delete().eq("id", id);
    setRevenues(prev => prev.filter(r => r.id !== id));
    toast.success("Removido");
  };

  const deleteAd = async (id: string) => {
    await supabase.from("imphq_ads_spend").delete().eq("id", id);
    setAds(prev => prev.filter(a => a.id !== id));
    toast.success("Removido");
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const kpis = [
    { label: "Receita Total", value: fmt(totalReceita), icon: TrendingUp, color: "text-emerald-400", bg: "from-emerald-500/15 to-emerald-500/5" },
    { label: "Custo Total", value: fmt(totalCusto), icon: TrendingDown, color: "text-red-400", bg: "from-red-500/15 to-red-500/5" },
    { label: "Lucro", value: fmt(profit), icon: profit >= 0 ? TrendingUp : TrendingDown, color: profit >= 0 ? "text-emerald-400" : "text-red-400", bg: profit >= 0 ? "from-emerald-500/15 to-emerald-500/5" : "from-red-500/15 to-red-500/5" },
    { label: "ROI", value: `${roi.toFixed(1)}%`, icon: Percent, color: roi >= 0 ? "text-primary" : "text-red-400", bg: "from-primary/15 to-primary/5" },
    { label: "ROAS", value: `${roas.toFixed(2)}x`, icon: Target, color: "text-amber-400", bg: "from-amber-500/15 to-amber-500/5" },
  ];

  const maxBar = Math.max(totalCusto, totalReceita, 1);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {kpis.map((k) => (
          <Card key={k.label} className={`bg-gradient-to-br ${k.bg} border-border`}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`p-2 rounded-xl bg-background/50 ${k.color}`}>
                <k.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{k.label}</p>
                <p className={`text-lg font-mono font-bold ${k.color}`}>{k.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Visual comparison bar */}
      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Custo vs Receita</p>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-16">Custo</span>
              <div className="flex-1 bg-secondary/30 rounded-full h-5 overflow-hidden">
                <div className="h-full bg-red-500/60 rounded-full transition-all duration-500" style={{ width: `${(totalCusto / maxBar) * 100}%` }} />
              </div>
              <span className="text-xs font-mono text-red-400 w-28 text-right">{fmt(totalCusto)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-16">Receita</span>
              <div className="flex-1 bg-secondary/30 rounded-full h-5 overflow-hidden">
                <div className="h-full bg-emerald-500/60 rounded-full transition-all duration-500" style={{ width: `${(totalReceita / maxBar) * 100}%` }} />
              </div>
              <span className="text-xs font-mono text-emerald-400 w-28 text-right">{fmt(totalReceita)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="custos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="custos" className="gap-1.5"><Receipt className="h-3.5 w-3.5" /> Custos</TabsTrigger>
          <TabsTrigger value="receitas" className="gap-1.5"><Wallet className="h-3.5 w-3.5" /> Receitas</TabsTrigger>
          <TabsTrigger value="ads" className="gap-1.5"><Megaphone className="h-3.5 w-3.5" /> Ads</TabsTrigger>
          <TabsTrigger value="vendas" className="gap-1.5"><ShoppingCart className="h-3.5 w-3.5" /> Vendas</TabsTrigger>
          <TabsTrigger value="produtos" className="gap-1.5"><Package className="h-3.5 w-3.5" /> Produtos</TabsTrigger>
        </TabsList>

        {/* Custos Tab */}
        <TabsContent value="custos">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm uppercase tracking-wider text-red-400 font-sans flex items-center gap-2">
                <Receipt className="h-4 w-4" /> Custos do Projeto
              </CardTitle>
              <Button size="sm" variant="outline" onClick={openCostFormForNew}><Plus className="h-3.5 w-3.5 mr-1" /> Custo</Button>
            </CardHeader>
            <CardContent>
              {costs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum custo registrado</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Cat.</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-8"></TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {costs.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="text-sm">
                          {c.nome}
                          {c.recorrente && <Badge variant="outline" className="ml-2 text-[9px] py-0">mensal</Badge>}
                        </TableCell>
                        <TableCell><Badge variant="secondary" className="text-[10px]">{c.categoria}</Badge></TableCell>
                        <TableCell className="text-right font-mono text-sm text-red-400">
                          {c.moeda === "USD" ? `$${c.valor.toFixed(2)}` : fmt(c.valor)}
                        </TableCell>
                        <TableCell>
                          {c.documento_url && (
                            <a href={c.documento_url} target="_blank" rel="noopener noreferrer" title="Ver documento">
                              <Paperclip className="h-3.5 w-3.5 text-primary hover:text-primary/80" />
                            </a>
                          )}
                        </TableCell>
                        <TableCell className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-primary" onClick={() => openCostFormForEdit(c)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive" onClick={() => deleteCost(c.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Receitas Tab */}
        <TabsContent value="receitas">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm uppercase tracking-wider text-emerald-400 font-sans flex items-center gap-2">
                <Wallet className="h-4 w-4" /> Receitas Manuais
              </CardTitle>
              <Button size="sm" variant="outline" onClick={openRevFormForNew}><Plus className="h-3.5 w-3.5 mr-1" /> Receita</Button>
            </CardHeader>
            <CardContent>
              {revenues.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma receita registrada</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Fonte</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-8"></TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revenues.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm">{r.descricao}</TableCell>
                        <TableCell>{r.produto_nome && <Badge variant="outline" className="text-[10px]">{r.produto_nome}</Badge>}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-[10px]">{r.fonte}</Badge></TableCell>
                        <TableCell className="text-right font-mono text-sm text-emerald-400">{fmt(r.valor)}</TableCell>
                        <TableCell>
                          {r.documento_url && (
                            <a href={r.documento_url} target="_blank" rel="noopener noreferrer" title="Ver documento">
                              <Paperclip className="h-3.5 w-3.5 text-primary hover:text-primary/80" />
                            </a>
                          )}
                        </TableCell>
                        <TableCell className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-primary" onClick={() => openRevFormForEdit(r)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive" onClick={() => deleteRevenue(r.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ads Tab */}
        <TabsContent value="ads">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm uppercase tracking-wider text-blue-400 font-sans flex items-center gap-2">
                <Megaphone className="h-4 w-4" /> Investimento em Ads
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setShowAdsImport(true)}>
                <Upload className="h-3.5 w-3.5 mr-1" /> Importar CSV
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {ads.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Investido", value: fmt(totalAds), color: "text-blue-400" },
                    { label: "CPC", value: fmt(cpc), color: "text-amber-400" },
                    { label: "CPL", value: fmt(cpl), color: "text-violet-400" },
                    { label: "Compras", value: String(totalCompras), color: "text-emerald-400" },
                  ].map(k => (
                    <div key={k.label} className="rounded-lg border border-border p-3 bg-secondary/20">
                      <p className="text-[10px] text-muted-foreground uppercase">{k.label}</p>
                      <p className={`text-lg font-mono font-bold ${k.color}`}>{k.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {ads.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <Megaphone className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                  <p className="text-sm text-muted-foreground">Nenhum dado de Ads importado</p>
                  <p className="text-xs text-muted-foreground/70">Importe um relatório CSV do Facebook Ads para começar</p>
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campanha</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Impr.</TableHead>
                        <TableHead>Cliques</TableHead>
                        <TableHead>CTR</TableHead>
                        <TableHead>Compras</TableHead>
                        <TableHead className="w-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ads.slice(0, 50).map(a => (
                        <TableRow key={a.id}>
                          <TableCell className="text-xs max-w-[180px] truncate">{a.campanha || "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{a.data_ref}</TableCell>
                          <TableCell className="text-xs font-mono text-blue-400">{fmt(a.valor)}</TableCell>
                          <TableCell className="text-xs font-mono">{a.impressoes.toLocaleString()}</TableCell>
                          <TableCell className="text-xs font-mono">{a.cliques}</TableCell>
                          <TableCell className="text-xs font-mono">{(a.ctr || 0).toFixed(2)}%</TableCell>
                          <TableCell className="text-xs font-mono">{a.compras || 0}</TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-destructive" onClick={() => deleteAd(a.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {ads.length > 50 && <p className="text-xs text-muted-foreground text-center py-2">...e mais {ads.length - 50} registros</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vendas Tab */}
        <TabsContent value="vendas">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm uppercase tracking-wider text-emerald-400 font-sans flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" /> Vendas Reais ({vendas.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {vendas.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <ShoppingCart className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                  <p className="text-sm text-muted-foreground">Nenhuma venda registrada</p>
                  <p className="text-xs text-muted-foreground/70">Vendas aparecem automaticamente via webhook ou importação</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="rounded-lg border border-border p-3 bg-secondary/20">
                      <p className="text-[10px] text-muted-foreground uppercase">Total Vendas</p>
                      <p className="text-lg font-mono font-bold text-emerald-400">{fmt(totalVendas)}</p>
                    </div>
                    <div className="rounded-lg border border-border p-3 bg-secondary/20">
                      <p className="text-[10px] text-muted-foreground uppercase">Quantidade</p>
                      <p className="text-lg font-mono font-bold text-foreground">{vendas.length}</p>
                    </div>
                    <div className="rounded-lg border border-border p-3 bg-secondary/20">
                      <p className="text-[10px] text-muted-foreground uppercase">Ticket Médio</p>
                      <p className="text-lg font-mono font-bold text-amber-400">{fmt(vendas.length > 0 ? totalVendas / vendas.length : 0)}</p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border overflow-hidden max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead>Plataforma</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vendas.slice(0, 50).map(v => (
                          <TableRow key={v.id}>
                            <TableCell className="text-sm font-medium">{v.produto_nome}</TableCell>
                            <TableCell><Badge variant="secondary" className="text-[10px]">{v.plataforma}</Badge></TableCell>
                            <TableCell className="font-mono text-sm text-emerald-400">{fmt(v.valor)}</TableCell>
                            <TableCell className="text-xs font-mono">{new Date(v.data_venda).toLocaleDateString("pt-BR")}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {vendas.length > 50 && <p className="text-xs text-muted-foreground text-center py-2">...e mais {vendas.length - 50} vendas</p>}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Produtos Tab */}
        <TabsContent value="produtos">
          <FinancasProdutos vendas={vendas} />
        </TabsContent>
      </Tabs>

      {/* Cost Form Dialog (Add / Edit) */}
      <Dialog open={showCostForm} onOpenChange={(open) => { setShowCostForm(open); if (!open) setEditingCost(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingCost ? "Editar Custo" : "Adicionar Custo"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={costForm.nome} onChange={e => setCostForm({ ...costForm, nome: e.target.value })} placeholder="Ex: ClickFunnels" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Select value={costForm.categoria} onValueChange={v => setCostForm({ ...costForm, categoria: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{COST_CATS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Moeda</Label>
                <Select value={costForm.moeda} onValueChange={v => setCostForm({ ...costForm, moeda: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BRL">BRL (R$)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Valor</Label><Input type="number" step="0.01" value={costForm.valor} onChange={e => setCostForm({ ...costForm, valor: e.target.value })} placeholder="0.00" /></div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={costForm.recorrente} onChange={e => setCostForm({ ...costForm, recorrente: e.target.checked })} className="rounded border-border" />
              Custo recorrente (mensal)
            </label>

            {/* Document upload */}
            <div className="space-y-2">
              <Label>Documento (NF, comprovante)</Label>
              <div className="flex items-center gap-2">
                <FileUpload
                  bucket="project-docs"
                  path={`costs/${projectId}`}
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  label="Anexar"
                  onUpload={(url) => setCostForm({ ...costForm, documento_url: url })}
                />
                {costForm.documento_url && (
                  <a href={costForm.documento_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <ExternalLink className="h-3 w-3" /> Ver anexo
                  </a>
                )}
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={saveCost}>{editingCost ? "Salvar" : "Adicionar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revenue Form Dialog */}
      <Dialog open={showRevForm} onOpenChange={setShowRevForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Receita</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Descrição</Label><Input value={revForm.descricao} onChange={e => setRevForm({ ...revForm, descricao: e.target.value })} placeholder="Ex: Venda curso X" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fonte</Label>
                <Select value={revForm.fonte} onValueChange={v => setRevForm({ ...revForm, fonte: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{REV_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Data Ref.</Label><Input type="date" value={revForm.data_ref} onChange={e => setRevForm({ ...revForm, data_ref: e.target.value })} /></div>
            </div>
            <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={revForm.valor} onChange={e => setRevForm({ ...revForm, valor: e.target.value })} placeholder="0.00" /></div>
          </div>
          <DialogFooter><Button onClick={addRevenue}>Adicionar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ads Import Dialog */}
      <AdsImportDialog
        open={showAdsImport}
        onOpenChange={setShowAdsImport}
        projects={projects}
        onImported={loadData}
      />
    </div>
  );
}

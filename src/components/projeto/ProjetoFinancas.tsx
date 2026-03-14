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
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, TrendingDown, Percent, Plus, Trash2, Receipt, Wallet } from "lucide-react";
import { toast } from "sonner";

interface Cost {
  id: string;
  nome: string;
  categoria: string;
  valor: number;
  moeda: string;
  recorrente: boolean;
}

interface Revenue {
  id: string;
  descricao: string;
  valor: number;
  fonte: string;
  data_ref: string;
}

const COST_CATS = ["Ferramentas", "Ads", "Freelancer", "Infra", "Outro"];
const REV_SOURCES = ["Manual", "Hotmart", "Stripe", "Kiwify", "Outro"];

export function ProjetoFinancas({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const [costs, setCosts] = useState<Cost[]>([]);
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [showCostForm, setShowCostForm] = useState(false);
  const [showRevForm, setShowRevForm] = useState(false);
  const [costForm, setCostForm] = useState({ nome: "", categoria: "Outro", valor: "", moeda: "BRL", recorrente: true });
  const [revForm, setRevForm] = useState({ descricao: "", valor: "", fonte: "Manual", data_ref: new Date().toISOString().split("T")[0] });

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    const [c, r] = await Promise.all([
      supabase.from("imphq_project_costs").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
      supabase.from("imphq_project_revenue").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    ]);
    setCosts((c.data || []).map((x: any) => ({ ...x, valor: parseFloat(x.valor) || 0 })));
    setRevenues((r.data || []).map((x: any) => ({ ...x, valor: parseFloat(x.valor) || 0 })));
  };

  const totalCost = costs.reduce((s, c) => s + (c.moeda === "USD" ? c.valor * 5.2 : c.valor), 0);
  const totalRev = revenues.reduce((s, r) => s + r.valor, 0);
  const profit = totalRev - totalCost;
  const roi = totalCost > 0 ? ((profit / totalCost) * 100) : 0;

  const addCost = async () => {
    if (!costForm.nome.trim() || !costForm.valor) { toast.error("Preencha nome e valor"); return; }
    const { error } = await supabase.from("imphq_project_costs").insert([{
      project_id: projectId,
      user_id: user?.id,
      nome: costForm.nome,
      categoria: costForm.categoria,
      valor: parseFloat(costForm.valor),
      moeda: costForm.moeda,
      recorrente: costForm.recorrente,
    }]);
    if (error) { toast.error(error.message); return; }
    toast.success("Custo adicionado!");
    setShowCostForm(false);
    setCostForm({ nome: "", categoria: "Outro", valor: "", moeda: "BRL", recorrente: true });
    loadData();
  };

  const addRevenue = async () => {
    if (!revForm.descricao.trim() || !revForm.valor) { toast.error("Preencha descrição e valor"); return; }
    const { error } = await supabase.from("imphq_project_revenue").insert([{
      project_id: projectId,
      user_id: user?.id,
      descricao: revForm.descricao,
      valor: parseFloat(revForm.valor),
      fonte: revForm.fonte,
      data_ref: revForm.data_ref,
    }]);
    if (error) { toast.error(error.message); return; }
    toast.success("Receita adicionada!");
    setShowRevForm(false);
    setRevForm({ descricao: "", valor: "", fonte: "Manual", data_ref: new Date().toISOString().split("T")[0] });
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

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const kpis = [
    { label: "Custo Total", value: fmt(totalCost), icon: Receipt, color: "text-red-400", bg: "from-red-500/15 to-red-500/5" },
    { label: "Receita Total", value: fmt(totalRev), icon: Wallet, color: "text-emerald-400", bg: "from-emerald-500/15 to-emerald-500/5" },
    { label: "Lucro", value: fmt(profit), icon: profit >= 0 ? TrendingUp : TrendingDown, color: profit >= 0 ? "text-emerald-400" : "text-red-400", bg: profit >= 0 ? "from-emerald-500/15 to-emerald-500/5" : "from-red-500/15 to-red-500/5" },
    { label: "ROI", value: `${roi.toFixed(1)}%`, icon: Percent, color: roi >= 0 ? "text-primary" : "text-red-400", bg: "from-primary/15 to-primary/5" },
  ];

  // Visual bar
  const maxBar = Math.max(totalCost, totalRev, 1);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <Card key={k.label} className={`bg-gradient-to-br ${k.bg} border-border`}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`p-2.5 rounded-xl bg-background/50 ${k.color}`}>
                <k.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{k.label}</p>
                <p className={`text-xl font-mono font-bold ${k.color}`}>{k.value}</p>
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
                <div className="h-full bg-red-500/60 rounded-full transition-all duration-500" style={{ width: `${(totalCost / maxBar) * 100}%` }} />
              </div>
              <span className="text-xs font-mono text-red-400 w-28 text-right">{fmt(totalCost)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-16">Receita</span>
              <div className="flex-1 bg-secondary/30 rounded-full h-5 overflow-hidden">
                <div className="h-full bg-emerald-500/60 rounded-full transition-all duration-500" style={{ width: `${(totalRev / maxBar) * 100}%` }} />
              </div>
              <span className="text-xs font-mono text-emerald-400 w-28 text-right">{fmt(totalRev)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Custos */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm uppercase tracking-wider text-red-400 font-sans flex items-center gap-2">
              <Receipt className="h-4 w-4" /> Custos do Projeto
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowCostForm(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Custo</Button>
          </CardHeader>
          <CardContent>
            {costs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum custo registrado</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Nome</TableHead><TableHead>Cat.</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="w-8"></TableHead></TableRow>
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

        {/* Receitas */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm uppercase tracking-wider text-emerald-400 font-sans flex items-center gap-2">
              <Wallet className="h-4 w-4" /> Receitas do Projeto
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowRevForm(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Receita</Button>
          </CardHeader>
          <CardContent>
            {revenues.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma receita registrada</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Descrição</TableHead><TableHead>Fonte</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="w-8"></TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {revenues.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{r.descricao}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-[10px]">{r.fonte}</Badge></TableCell>
                      <TableCell className="text-right font-mono text-sm text-emerald-400">{fmt(r.valor)}</TableCell>
                      <TableCell>
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
      </div>

      {/* Cost Form Dialog */}
      <Dialog open={showCostForm} onOpenChange={setShowCostForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Custo</DialogTitle></DialogHeader>
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
          </div>
          <DialogFooter><Button onClick={addCost}>Adicionar</Button></DialogFooter>
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
    </div>
  );
}

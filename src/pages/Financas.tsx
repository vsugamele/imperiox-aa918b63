import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DollarSign, Plus, Trash2, Pencil, Hash, TrendingDown } from "lucide-react";
import { toast } from "sonner";

const USD_BRL = 5.2;
const TIPOS = ["SaaS", "API", "Infra", "Ads", "Freelancer", "Outro"];

interface Custo {
  id: string;
  nome: string;
  tipo?: string;
  valor: number;
  moeda?: string;
}

export default function Financas() {
  const [custos, setCustos] = useState<Custo[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Custo | null>(null);
  const [form, setForm] = useState({ nome: "", tipo: "SaaS", valor: "", moeda: "BRL" });

  const load = async () => {
    const { data } = await supabase.from("imphq_custos").select("*").order("nome");
    setCustos((data || []).map((c: any) => ({ ...c, valor: parseFloat(c.valor) || 0 })));
  };

  useEffect(() => { load(); }, []);

  const totalBRL = custos.reduce((acc, c) => acc + (c.moeda === "USD" ? c.valor * USD_BRL : c.valor), 0);
  const totalUSD = custos.reduce((acc, c) => acc + (c.moeda === "USD" ? c.valor : 0), 0);
  const avgPerTool = custos.length > 0 ? totalBRL / custos.length : 0;

  const openNew = () => {
    setEditing(null);
    setForm({ nome: "", tipo: "SaaS", valor: "", moeda: "BRL" });
    setShowDialog(true);
  };

  const openEdit = (c: Custo) => {
    setEditing(c);
    setForm({ nome: c.nome, tipo: c.tipo || "SaaS", valor: String(c.valor), moeda: c.moeda || "BRL" });
    setShowDialog(true);
  };

  const save = async () => {
    if (!form.nome.trim()) { toast.error("Nome obrigatório"); return; }
    const payload = { nome: form.nome, tipo: form.tipo, valor: parseFloat(form.valor) || 0, moeda: form.moeda };

    if (editing) {
      const { error } = await supabase.from("imphq_custos").update(payload).eq("id", editing.id);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Atualizado!");
    } else {
      const { error } = await supabase.from("imphq_custos").insert({ id: crypto.randomUUID(), ...payload });
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Ferramenta adicionada!");
    }
    setShowDialog(false);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("imphq_custos").delete().eq("id", id);
    toast.success("Removido");
    load();
  };

  const kpis = [
    { label: "Custo Mensal Total", value: `R$ ${totalBRL.toFixed(2)}`, icon: DollarSign, gradient: "from-red-500/15 to-red-500/5", iconBg: "bg-red-500/15 text-red-400", textColor: "text-red-400" },
    { label: "Total em USD", value: `$ ${totalUSD.toFixed(2)}`, icon: DollarSign, gradient: "from-blue-500/15 to-blue-500/5", iconBg: "bg-blue-500/15 text-blue-400", textColor: "text-blue-400" },
    { label: "Ferramentas", value: custos.length, icon: Hash, gradient: "from-emerald-500/15 to-emerald-500/5", iconBg: "bg-emerald-500/15 text-emerald-400", textColor: "text-emerald-400" },
    { label: "Média / Ferramenta", value: `R$ ${avgPerTool.toFixed(2)}`, icon: TrendingDown, gradient: "from-amber-500/15 to-amber-500/5", iconBg: "bg-amber-500/15 text-amber-400", textColor: "text-amber-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-primary">💰 Finanças</h1>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova Ferramenta</Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <Card key={k.label} className={`bg-gradient-to-br ${k.gradient} border-border animate-fade-in`} style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`p-3 rounded-xl ${k.iconBg}`}>
                <k.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className={`text-2xl font-mono font-bold ${k.textColor}`}>{k.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden animate-fade-in" style={{ animationDelay: "320ms", animationFillMode: "both" }}>
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
            {custos.map((c) => {
              const brl = c.moeda === "USD" ? c.valor * USD_BRL : c.valor;
              return (
                <TableRow key={c.id} className="hover:bg-muted/30 transition-colors group">
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.tipo || "—"}</TableCell>
                  <TableCell className="font-mono">{c.valor.toFixed(2)}</TableCell>
                  <TableCell className="text-xs">{c.moeda || "BRL"}</TableCell>
                  <TableCell className="font-mono text-primary">R$ {brl.toFixed(2)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(c.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {custos.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma ferramenta cadastrada</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Ferramenta" : "Nova Ferramenta"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Supabase, ChatGPT..." /></div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor</Label><Input type="number" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} placeholder="0.00" /></div>
              <div>
                <Label>Moeda</Label>
                <Select value={form.moeda} onValueChange={v => setForm({ ...form, moeda: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BRL">BRL (R$)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={save}>{editing ? "Salvar" : "Criar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Upload, MousePointerClick, Eye, Target, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { AdsImportDialog } from "./AdsImportDialog";

interface AdsSpend {
  id: string;
  project_id: string;
  plataforma: string;
  campanha: string | null;
  conjunto_anuncios?: string | null;
  data_ref: string;
  valor: number;
  impressoes: number;
  alcance?: number;
  cliques: number;
  leads: number;
  compras?: number;
  custo_por_compra?: number;
  hook_rate?: number;
  hold_rate?: number;
  ctr?: number;
  frequencia?: number;
  moeda: string;
}

interface Props {
  ads: AdsSpend[];
  projects: { id: string; name: string }[];
  onRefresh: () => void;
  filterProjectId: string;
}

export function FinancasAds({ ads, projects, onRefresh, filterProjectId }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState<AdsSpend | null>(null);
  const [form, setForm] = useState({ project_id: "", plataforma: "Facebook", campanha: "", data_ref: "", valor: "", impressoes: "0", cliques: "0", leads: "0" });

  const totalGasto = ads.reduce((a, b) => a + b.valor, 0);
  const totalCliques = ads.reduce((a, b) => a + b.cliques, 0);
  const totalLeads = ads.reduce((a, b) => a + b.leads, 0);
  const totalImpr = ads.reduce((a, b) => a + b.impressoes, 0);
  const totalCompras = ads.reduce((a, b) => a + (b.compras || 0), 0);
  const avgCTR = ads.length > 0 ? ads.reduce((a, b) => a + (b.ctr || 0), 0) / ads.length : 0;
  const avgHookRate = ads.length > 0 ? ads.reduce((a, b) => a + (b.hook_rate || 0), 0) / ads.length : 0;
  const cpc = totalCliques > 0 ? totalGasto / totalCliques : 0;
  const cpl = totalLeads > 0 ? totalGasto / totalLeads : 0;

  const kpis = [
    { label: "Total Investido", value: `R$ ${totalGasto.toFixed(2)}`, icon: Target, color: "text-red-400" },
    { label: "CPC", value: `R$ ${cpc.toFixed(2)}`, icon: MousePointerClick, color: "text-blue-400" },
    { label: "CPL", value: `R$ ${cpl.toFixed(2)}`, icon: Target, color: "text-amber-400" },
    { label: "Impressões", value: totalImpr.toLocaleString(), icon: Eye, color: "text-muted-foreground" },
    { label: "Compras", value: totalCompras.toString(), icon: BarChart3, color: "text-emerald-400" },
    { label: "CTR Médio", value: `${avgCTR.toFixed(2)}%`, icon: MousePointerClick, color: "text-blue-400" },
    { label: "Hook Rate", value: `${avgHookRate.toFixed(1)}%`, icon: Eye, color: "text-amber-400" },
    { label: "Cliques", value: totalCliques.toLocaleString(), icon: MousePointerClick, color: "text-muted-foreground" },
  ];

  const openNew = () => {
    setEditing(null);
    setForm({ project_id: filterProjectId || "", plataforma: "Facebook", campanha: "", data_ref: new Date().toISOString().slice(0, 10), valor: "", impressoes: "0", cliques: "0", leads: "0" });
    setShowForm(true);
  };

  const openEdit = (a: AdsSpend) => {
    setEditing(a);
    setForm({ project_id: a.project_id, plataforma: a.plataforma, campanha: a.campanha || "", data_ref: a.data_ref, valor: String(a.valor), impressoes: String(a.impressoes), cliques: String(a.cliques), leads: String(a.leads) });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.project_id) { toast.error("Selecione um projeto"); return; }
    if (!form.data_ref) { toast.error("Data obrigatória"); return; }
    const payload = {
      project_id: form.project_id,
      plataforma: form.plataforma,
      campanha: form.campanha || null,
      data_ref: form.data_ref,
      valor: parseFloat(form.valor) || 0,
      impressoes: parseInt(form.impressoes) || 0,
      cliques: parseInt(form.cliques) || 0,
      leads: parseInt(form.leads) || 0,
    };
    if (editing) {
      const { error } = await supabase.from("imphq_ads_spend").update(payload as any).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Atualizado!");
    } else {
      const { error } = await supabase.from("imphq_ads_spend").insert(payload as any);
      if (error) { toast.error(error.message); return; }
      toast.success("Gasto adicionado!");
    }
    setShowForm(false);
    onRefresh();
  };

  const remove = async (id: string) => {
    await supabase.from("imphq_ads_spend").delete().eq("id", id);
    toast.success("Removido");
    onRefresh();
  };

  const getProjectName = (pid: string) => projects.find(p => p.id === pid)?.name || pid;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.slice(0, 8).map(k => (
          <Card key={k.label} className="border-border">
            <CardContent className="flex items-center gap-3 p-4">
              <k.icon className={`h-5 w-5 ${k.color}`} />
              <div>
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className={`text-lg font-mono font-bold ${k.color}`}>{k.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo Gasto</Button>
        <Button size="sm" variant="outline" onClick={() => setShowImport(true)}><Upload className="h-4 w-4 mr-1" /> Importar CSV</Button>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Projeto</TableHead>
              <TableHead>Campanha</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Impr.</TableHead>
              <TableHead>Alcance</TableHead>
              <TableHead>Cliques</TableHead>
              <TableHead>Compras</TableHead>
              <TableHead>CTR</TableHead>
              <TableHead>Hook</TableHead>
              <TableHead className="w-[70px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ads.slice(0, 100).map(a => (
              <TableRow key={a.id} className="group hover:bg-muted/30">
                <TableCell className="text-xs">{getProjectName(a.project_id)}</TableCell>
                <TableCell className="text-xs max-w-[120px] truncate">{a.campanha || "—"}</TableCell>
                <TableCell className="text-xs font-mono">{a.data_ref}</TableCell>
                <TableCell className="font-mono text-red-400 text-xs">R$ {a.valor.toFixed(2)}</TableCell>
                <TableCell className="font-mono text-xs">{a.impressoes.toLocaleString()}</TableCell>
                <TableCell className="font-mono text-xs">{(a.alcance || 0).toLocaleString()}</TableCell>
                <TableCell className="font-mono text-xs">{a.cliques}</TableCell>
                <TableCell className="font-mono text-xs">{a.compras || 0}</TableCell>
                <TableCell className="font-mono text-xs">{(a.ctr || 0).toFixed(2)}%</TableCell>
                <TableCell className="font-mono text-xs">{(a.hook_rate || 0).toFixed(1)}%</TableCell>
                <TableCell>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(a)}><Pencil className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(a.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {ads.length === 0 && (
              <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                <div className="space-y-2">
                  <p>Nenhum dado de Ads disponível</p>
                  <p className="text-[11px]">Importe um CSV de relatório ou conecte a API do Facebook/Google para importação automática.</p>
                </div>
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Gasto" : "Novo Gasto de Ads"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Projeto</Label>
              <Select value={form.project_id} onValueChange={v => setForm({ ...form, project_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Plataforma</Label>
                <Select value={form.plataforma} onValueChange={v => setForm({ ...form, plataforma: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Facebook">Facebook</SelectItem>
                    <SelectItem value="Google">Google</SelectItem>
                    <SelectItem value="TikTok">TikTok</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Data</Label><Input type="date" value={form.data_ref} onChange={e => setForm({ ...form, data_ref: e.target.value })} /></div>
            </div>
            <div><Label>Campanha</Label><Input value={form.campanha} onChange={e => setForm({ ...form, campanha: e.target.value })} placeholder="Nome da campanha" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor (R$)</Label><Input type="number" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} /></div>
              <div><Label>Impressões</Label><Input type="number" value={form.impressoes} onChange={e => setForm({ ...form, impressoes: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cliques</Label><Input type="number" value={form.cliques} onChange={e => setForm({ ...form, cliques: e.target.value })} /></div>
              <div><Label>Leads</Label><Input type="number" value={form.leads} onChange={e => setForm({ ...form, leads: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={save}>{editing ? "Salvar" : "Criar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AdsImportDialog open={showImport} onOpenChange={setShowImport} projects={projects} onImported={onRefresh} />
    </div>
  );
}

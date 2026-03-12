import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ChevronLeft, Eye, ShoppingCart, ArrowRight, ChevronUp, ChevronDown, Save } from "lucide-react";
import { toast } from "sonner";

interface Etapa { nome: string; visitantes: number; conversoes: number; }
interface Funil {
  id: string; nome: string; tipo?: string; status?: string; url?: string;
  project_id?: string; data: { etapas?: Etapa[] }; criado_em?: string;
}

const DEFAULT_ETAPAS: Etapa[] = [
  { nome: "Anúncio", visitantes: 0, conversoes: 0 },
  { nome: "Opt-in", visitantes: 0, conversoes: 0 },
  { nome: "VSL/Webinar", visitantes: 0, conversoes: 0 },
  { nome: "Checkout", visitantes: 0, conversoes: 0 },
  { nome: "Upsell", visitantes: 0, conversoes: 0 },
];

function getConversionColor(taxa: number) {
  if (taxa >= 30) return { bg: "bg-emerald-500/15", border: "border-emerald-500/40", text: "text-emerald-400", dot: "bg-emerald-400" };
  if (taxa >= 10) return { bg: "bg-amber-500/15", border: "border-amber-500/40", text: "text-amber-400", dot: "bg-amber-400" };
  return { bg: "bg-red-500/15", border: "border-red-500/40", text: "text-red-400", dot: "bg-red-400" };
}

export default function Funis() {
  const [funis, setFunis] = useState<Funil[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [filterProject, setFilterProject] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [selectedFunil, setSelectedFunil] = useState<Funil | null>(null);
  const [form, setForm] = useState({ nome: "", tipo: "Perpétuo", status: "Rascunho", project_id: "" });

  const load = async () => {
    const [fRes, pRes] = await Promise.all([
      supabase.from("imphq_funis").select("*").order("updated_at", { ascending: false }),
      supabase.from("imphq_projects").select("id, name").order("name"),
    ]);
    setFunis((fRes.data || []).map((f: any) => ({ ...f, data: f.data || {} })));
    setProjects(pRes.data || []);
  };

  useEffect(() => { load(); }, []);

  const filtered = funis.filter(f => filterProject === "all" || f.project_id === filterProject);

  const createFunil = async () => {
    if (!form.nome.trim()) { toast.error("Nome obrigatório"); return; }
    const id = crypto.randomUUID();
    const { error } = await supabase.from("imphq_funis").insert([{
      id, nome: form.nome, tipo: form.tipo, status: form.status,
      project_id: form.project_id || null,
      data: { etapas: DEFAULT_ETAPAS } as any,
    }]);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Funil criado!"); setShowNew(false);
    setForm({ nome: "", tipo: "Perpétuo", status: "Rascunho", project_id: "" }); load();
  };

  const deleteFunil = async (id: string) => {
    await supabase.from("imphq_funis").delete().eq("id", id);
    toast.success("Funil removido"); setSelectedFunil(null); load();
  };

  const updateEtapa = async (funilId: string, etapas: Etapa[]) => {
    await supabase.from("imphq_funis").update({ data: { etapas } as any }).eq("id", funilId);
    setSelectedFunil(prev => prev ? { ...prev, data: { ...prev.data, etapas } } : null);
  };

  const addEtapa = () => {
    if (!selectedFunil) return;
    const etapas = [...(selectedFunil.data.etapas || []), { nome: "Nova Etapa", visitantes: 0, conversoes: 0 }];
    updateEtapa(selectedFunil.id, etapas);
  };
  const removeEtapa = (idx: number) => {
    if (!selectedFunil) return;
    updateEtapa(selectedFunil.id, (selectedFunil.data.etapas || []).filter((_, i) => i !== idx));
  };
  const moveEtapa = (idx: number, dir: -1 | 1) => {
    if (!selectedFunil) return;
    const etapas = [...(selectedFunil.data.etapas || [])];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= etapas.length) return;
    [etapas[idx], etapas[newIdx]] = [etapas[newIdx], etapas[idx]];
    updateEtapa(selectedFunil.id, etapas);
  };
  const setEtapaField = (idx: number, field: keyof Etapa, value: string | number) => {
    if (!selectedFunil) return;
    const etapas = [...(selectedFunil.data.etapas || [])];
    etapas[idx] = { ...etapas[idx], [field]: value };
    setSelectedFunil({ ...selectedFunil, data: { ...selectedFunil.data, etapas } });
  };
  const saveEtapas = () => {
    if (!selectedFunil) return;
    updateEtapa(selectedFunil.id, selectedFunil.data.etapas || []);
    toast.success("Etapas salvas!");
  };

  const projectName = (id?: string) => projects.find(p => p.id === id)?.name || "";

  // Canvas detail view
  if (selectedFunil) {
    const etapas = selectedFunil.data.etapas || [];
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedFunil(null); load(); }}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h1 className="font-display text-2xl font-bold text-primary">{selectedFunil.nome}</h1>
          <Badge variant="outline">{selectedFunil.tipo}</Badge>
          <Badge variant={selectedFunil.status === "Ativo" ? "default" : "secondary"}>{selectedFunil.status}</Badge>
          {selectedFunil.project_id && <Badge variant="outline" className="text-[10px]">{projectName(selectedFunil.project_id)}</Badge>}
        </div>

        {/* Canvas Area */}
        <div className="relative rounded-xl border border-border bg-[radial-gradient(circle,hsl(var(--border))_1px,transparent_1px)] bg-[size:20px_20px] p-8 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            {etapas.map((etapa, i) => {
              const taxa = etapa.visitantes > 0 ? (etapa.conversoes / etapa.visitantes) * 100 : 0;
              const colors = getConversionColor(taxa);
              return (
                <div key={i} className="flex items-center">
                  <div className={`rounded-xl border-2 ${colors.border} ${colors.bg} backdrop-blur-sm min-w-[180px] p-4 space-y-3 relative`}>
                    {/* Move buttons */}
                    <div className="absolute -top-2 right-2 flex gap-0.5">
                      <Button size="icon" variant="ghost" className="h-5 w-5 bg-card border border-border" onClick={() => moveEtapa(i, -1)} disabled={i === 0}>
                        <ChevronUp className="h-2.5 w-2.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-5 w-5 bg-card border border-border" onClick={() => moveEtapa(i, 1)} disabled={i === etapas.length - 1}>
                        <ChevronDown className="h-2.5 w-2.5" />
                      </Button>
                    </div>

                    {/* Status dot */}
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${colors.dot}`} />
                      <Input
                        value={etapa.nome}
                        onChange={e => setEtapaField(i, "nome", e.target.value)}
                        className="h-7 text-xs font-bold bg-transparent border-none p-0 focus-visible:ring-0"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Eye className="h-2.5 w-2.5" /> Visitas</p>
                        <Input type="number" value={etapa.visitantes} onChange={e => setEtapaField(i, "visitantes", parseInt(e.target.value) || 0)} className="h-7 text-xs font-mono bg-card/50 border-border p-1" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1"><ShoppingCart className="h-2.5 w-2.5" /> Conv.</p>
                        <Input type="number" value={etapa.conversoes} onChange={e => setEtapaField(i, "conversoes", parseInt(e.target.value) || 0)} className="h-7 text-xs font-mono bg-card/50 border-border p-1" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-mono font-bold ${colors.text}`}>{taxa.toFixed(1)}%</span>
                      <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => removeEtapa(i)}>
                        <Trash2 className="h-2.5 w-2.5 text-destructive" />
                      </Button>
                    </div>

                    {/* Conversion bar */}
                    <div className="w-full h-1.5 bg-card/30 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${colors.dot}`} style={{ width: `${Math.min(taxa, 100)}%` }} />
                    </div>
                  </div>

                  {/* SVG connector */}
                  {i < etapas.length - 1 && (
                    <svg width="40" height="40" className="shrink-0 mx-1">
                      <defs>
                        <marker id={`arrow-${i}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                          <path d="M0,0 L6,3 L0,6" fill="hsl(var(--primary))" opacity="0.6" />
                        </marker>
                      </defs>
                      <path d="M0,20 C15,20 25,20 38,20" stroke="hsl(var(--primary))" strokeWidth="2" fill="none" opacity="0.4" markerEnd={`url(#arrow-${i})`} />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={addEtapa}><Plus className="h-3 w-3 mr-1" /> Etapa</Button>
          <Button size="sm" onClick={saveEtapas}><Save className="h-3 w-3 mr-1" /> Salvar</Button>
          <Button size="sm" variant="destructive" onClick={() => deleteFunil(selectedFunil.id)}><Trash2 className="h-3 w-3 mr-1" /> Excluir</Button>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-primary">🔗 Funis</h1>
        <Button size="sm" onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" /> Novo Funil</Button>
      </div>

      <div className="flex items-center gap-3">
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue placeholder="Filtrar por projeto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Projetos</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-xs">{filtered.length} funis</Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(f => {
          const etapas = f.data?.etapas || [];
          return (
            <Card key={f.id} className="bg-card border-border hover:border-primary/20 cursor-pointer transition-colors" onClick={() => setSelectedFunil(f)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-sm">{f.nome}</h3>
                  <Badge variant="outline" className="text-[10px]">{f.status || "Rascunho"}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{f.tipo || "Perpétuo"} • {etapas.length} etapas</p>
                {f.project_id && <p className="text-[10px] text-muted-foreground mt-1">{projectName(f.project_id)}</p>}
                {etapas.length > 0 && (
                  <div className="flex items-center gap-1 mt-2 overflow-hidden">
                    {etapas.slice(0, 5).map((e, i) => {
                      const taxa = e.visitantes > 0 ? (e.conversoes / e.visitantes) * 100 : 0;
                      const c = getConversionColor(taxa);
                      return (
                        <div key={i} className="flex items-center">
                          <div className={`px-1.5 py-0.5 rounded text-[8px] font-medium ${c.bg} ${c.text} border ${c.border}`}>{e.nome}</div>
                          {i < Math.min(etapas.length, 5) - 1 && <ArrowRight className="h-2 w-2 text-muted-foreground/50 mx-0.5 shrink-0" />}
                        </div>
                      );
                    })}
                    {etapas.length > 5 && <span className="text-[9px] text-muted-foreground">+{etapas.length - 5}</span>}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">Nenhum funil cadastrado</p>}
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Funil</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Funil VSL Principal" /></div>
            <div>
              <Label>Projeto</Label>
              <Select value={form.project_id} onValueChange={v => setForm({ ...form, project_id: v })}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Perpétuo">Perpétuo</SelectItem>
                    <SelectItem value="Lançamento">Lançamento</SelectItem>
                    <SelectItem value="Webinar">Webinar</SelectItem>
                    <SelectItem value="VSL">VSL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Rascunho">Rascunho</SelectItem>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                    <SelectItem value="Pausado">Pausado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={createFunil}>Criar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

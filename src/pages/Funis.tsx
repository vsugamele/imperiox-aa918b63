import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ArrowRight, ChevronLeft, Eye, Users, ShoppingCart } from "lucide-react";
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

export default function Funis() {
  const [funis, setFunis] = useState<Funil[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [selectedFunil, setSelectedFunil] = useState<Funil | null>(null);
  const [form, setForm] = useState({ nome: "", tipo: "Perpétuo", status: "Rascunho" });

  const load = async () => {
    const { data } = await supabase.from("imphq_funis").select("*").order("updated_at", { ascending: false });
    setFunis((data || []).map((f: any) => ({ ...f, data: f.data || {} })));
  };

  useEffect(() => { load(); }, []);

  const createFunil = async () => {
    if (!form.nome.trim()) { toast.error("Nome obrigatório"); return; }
    const id = crypto.randomUUID();
    const etapasData = DEFAULT_ETAPAS.map(e => ({ nome: e.nome, visitantes: e.visitantes, conversoes: e.conversoes }));
    const { error } = await supabase.from("imphq_funis").insert([{
      id, nome: form.nome, tipo: form.tipo, status: form.status,
      data: { etapas: etapasData } as unknown as Record<string, unknown>,
    }]);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Funil criado!"); setShowNew(false); setForm({ nome: "", tipo: "Perpétuo", status: "Rascunho" });
    load();
  };

  const deleteFunil = async (id: string) => {
    await supabase.from("imphq_funis").delete().eq("id", id);
    toast.success("Funil removido"); setSelectedFunil(null); load();
  };

  const updateEtapa = async (funilId: string, etapas: Etapa[]) => {
    const etapasData = etapas.map(e => ({ nome: e.nome, visitantes: e.visitantes, conversoes: e.conversoes }));
    await supabase.from("imphq_funis").update({ data: { etapas: etapasData } as unknown as Record<string, unknown> }).eq("id", funilId);
    setSelectedFunil(prev => prev ? { ...prev, data: { ...prev.data, etapas } } : null);
  };

  const addEtapa = () => {
    if (!selectedFunil) return;
    const etapas = [...(selectedFunil.data.etapas || []), { nome: "Nova Etapa", visitantes: 0, conversoes: 0 }];
    updateEtapa(selectedFunil.id, etapas);
  };

  const removeEtapa = (idx: number) => {
    if (!selectedFunil) return;
    const etapas = (selectedFunil.data.etapas || []).filter((_, i) => i !== idx);
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

  // Detail view
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
        </div>

        {/* Pipeline Visual */}
        <div className="flex items-stretch gap-1 overflow-x-auto pb-4">
          {etapas.map((etapa, i) => {
            const taxa = etapa.visitantes > 0 ? ((etapa.conversoes / etapa.visitantes) * 100).toFixed(1) : "0";
            return (
              <div key={i} className="flex items-center">
                <Card className="bg-card border-border min-w-[160px]">
                  <CardContent className="p-3 space-y-2">
                    <Input
                      value={etapa.nome}
                      onChange={e => setEtapaField(i, "nome", e.target.value)}
                      className="h-7 text-xs font-bold bg-transparent border-none p-0 focus-visible:ring-0"
                    />
                    <div className="grid grid-cols-2 gap-1">
                      <div>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Eye className="h-2.5 w-2.5" /> Visitas</p>
                        <Input
                          type="number" value={etapa.visitantes}
                          onChange={e => setEtapaField(i, "visitantes", parseInt(e.target.value) || 0)}
                          className="h-6 text-xs font-mono bg-secondary border-none p-1"
                        />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1"><ShoppingCart className="h-2.5 w-2.5" /> Conv.</p>
                        <Input
                          type="number" value={etapa.conversoes}
                          onChange={e => setEtapaField(i, "conversoes", parseInt(e.target.value) || 0)}
                          className="h-6 text-xs font-mono bg-secondary border-none p-1"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-primary">{taxa}%</span>
                      <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => removeEtapa(i)}>
                        <Trash2 className="h-2.5 w-2.5 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                {i < etapas.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground mx-1 shrink-0" />}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={addEtapa}><Plus className="h-3 w-3 mr-1" /> Etapa</Button>
          <Button size="sm" onClick={saveEtapas}>Salvar Etapas</Button>
          <Button size="sm" variant="destructive" onClick={() => deleteFunil(selectedFunil.id)}><Trash2 className="h-3 w-3 mr-1" /> Excluir Funil</Button>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-primary">Funis</h1>
        <Button size="sm" onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" /> Novo Funil</Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {funis.map((f) => {
          const etapas = f.data?.etapas || [];
          return (
            <Card key={f.id} className="bg-card border-border hover:border-primary/20 cursor-pointer transition-colors" onClick={() => setSelectedFunil(f)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-sm">{f.nome}</h3>
                  <Badge variant="outline" className="text-[10px]">{f.status || "Rascunho"}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{f.tipo || "Perpétuo"} • {etapas.length} etapas</p>
                {etapas.length > 0 && (
                  <div className="flex items-center gap-1 mt-2">
                    {etapas.map((e, i) => (
                      <div key={i} className="flex items-center">
                        <span className="text-[9px] text-muted-foreground truncate max-w-[60px]">{e.nome}</span>
                        {i < etapas.length - 1 && <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/50 mx-0.5" />}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {funis.length === 0 && <p className="text-sm text-muted-foreground">Nenhum funil cadastrado</p>}
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Funil</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Funil VSL Principal" /></div>
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

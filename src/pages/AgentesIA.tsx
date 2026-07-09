import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Bot, Plus, Pencil, Trash2, BarChart3, Sparkles, ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { toast } from "sonner";

interface Agent {
  id: string;
  nome: string;
  avatar_url: string | null;
  project_id: string | null;
  ativo: boolean;
}

export default function AgentesIA() {
  const nav = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ nome: "", project_id: "" });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [aRes, pRes] = await Promise.all([
      supabase.from("imphq_ai_agents" as any).select("id, nome, avatar_url, project_id, ativo").order("created_at", { ascending: false }),
      supabase.from("imphq_projects").select("id, name").order("name"),
    ]);
    setAgents(((aRes.data as any[]) || []) as Agent[]);
    setProjects((pRes.data as any[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.nome.trim()) { toast.error("Nome obrigatório"); return; }
    const { data, error } = await (supabase.from("imphq_ai_agents" as any).insert({
      nome: form.nome,
      project_id: form.project_id || null,
    }) as any).select("id").single();
    if (error) { toast.error(error.message); return; }
    setShowNew(false);
    toast.success("Agente criado");
    nav(`/openflow/agentes/${(data as any).id}`);
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir agente?")) return;
    const { error } = await supabase.from("imphq_ai_agents" as any).delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Excluído"); load(); }
  };

  return (
    <div className="container mx-auto p-4 lg:p-8 space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => nav("/openflow")} className="h-9 w-9">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title="Agentes IA" subtitle="Crie agentes de IA para suas automações" icon={Bot} />
      </div>

      <div className="flex justify-between items-center gap-4">
        <div className="rounded-2xl px-4 py-3 bg-gradient-to-r from-primary/15 to-primary/5 border border-primary/20 text-sm text-primary">
          <span className="font-semibold">{agents.length}</span> {agents.length === 1 ? "agente criado" : "agentes criados"}
        </div>
        <Button onClick={() => setShowNew(true)} className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
          <Plus className="h-4 w-4 mr-2" /> Novo Agente
        </Button>
      </div>

      {loading ? (
        <div className="text-center text-sm text-muted-foreground py-16">Carregando…</div>
      ) : agents.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl">
          <Bot className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum agente ainda. Crie o primeiro pra ativar respostas inteligentes nos seus fluxos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {agents.map(a => {
            const project = projects.find(p => p.id === a.project_id)?.name;
            return (
              <Card key={a.id} className="bg-secondary/40 border-white/5 hover:border-primary/30 transition-all group">
                <CardContent className="p-6 flex flex-col items-center text-center">
                  <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-emerald-400" title="Métricas">
                      <BarChart3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-primary" onClick={() => nav(`/openflow/agentes/${a.id}`)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-rose-400" onClick={() => remove(a.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary/40 to-primary/10 border-2 border-primary/20 flex items-center justify-center overflow-hidden mb-4">
                    {a.avatar_url ? (
                      <img src={a.avatar_url} alt={a.nome} className="w-full h-full object-cover" />
                    ) : (
                      <Bot className="h-10 w-10 text-primary" />
                    )}
                  </div>
                  <h3 className="font-display text-lg font-semibold text-slate-100">{a.nome}</h3>
                  {project && <p className="text-[11px] text-muted-foreground mt-1">{project}</p>}
                  <Button
                    onClick={() => nav(`/openflow/agentes/${a.id}`)}
                    className="mt-4 w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-2" /> Gerenciar
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="bg-secondary/95 border-white/10">
          <DialogHeader><DialogTitle>Novo Agente IA</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome do Agente</Label>
              <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Laila, Imperius, ..." />
            </div>
            <div className="space-y-2">
              <Label>Projeto (opcional)</Label>
              <Select value={form.project_id || "none"} onValueChange={v => setForm({ ...form, project_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Global" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Global</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={create} className="w-full bg-primary text-primary-foreground font-semibold">Criar Agente</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

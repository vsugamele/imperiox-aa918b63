import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Mail, Plus, Play, Pause, Users, TrendingUp, UserPlus } from "lucide-react";
import { BulkEnrollDialog } from "@/components/nurture/BulkEnrollDialog";
import { TagAutocomplete } from "@/components/projeto/TagAutocomplete";
import { GuideDrawer } from "@/components/assistente/GuideDrawer";
import { ConteudoTabs } from "@/components/planejar/ConteudoTabs";


interface Sequence {
  id: string;
  project_id: string;
  produto_nome: string;
  nome: string;
  objetivo: string | null;
  duracao_dias: number;
  cadencia: string;
  ativa: boolean;
  total_leads_ativos: number;
  total_emails_enviados: number;
  total_conversoes: number;
  receita_atribuida: number;
}

export default function Nutricao() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [form, setForm] = useState<any>({ project_id: "", produto_nome: "", nome: "", objetivo: "", duracao_dias: 365, cadencia: "diaria", filter_tags: [] as string[], filter_tags_mode: "any" });

  const load = async () => {
    setLoading(true);
    const [s, p] = await Promise.all([
      supabase.from("imphq_nurture_sequences").select("*").order("created_at", { ascending: false }),
      supabase.from("imphq_projects").select("id, name").order("name"),
    ]);
    setSequences((s.data as any) || []);
    setProjects(p.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.project_id || !form.produto_nome || !form.nome) {
      toast.error("Preencha projeto, produto e nome");
      return;
    }
    const { error } = await supabase.from("imphq_nurture_sequences").insert(form);
    if (error) { toast.error(error.message); return; }
    toast.success("Sequência criada");
    setOpen(false);
    setForm({ project_id: "", produto_nome: "", nome: "", objetivo: "", duracao_dias: 365, cadencia: "diaria", filter_tags: [], filter_tags_mode: "any" });
    load();
  };

  const toggleAtiva = async (id: string, ativa: boolean) => {
    await supabase.from("imphq_nurture_sequences").update({ ativa: !ativa }).eq("id", id);
    load();
  };

  const runScheduler = async () => {
    toast.info("Disparando scheduler...");
    const { data, error } = await supabase.functions.invoke("nurture-scheduler", { body: { trigger: "manual" } });
    if (error) toast.error(error.message);
    else toast.success(`Processados: ${data?.summary?.processed ?? 0} • Enviados: ${data?.summary?.sent ?? 0}`);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <ConteudoTabs />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display flex items-center gap-3">
            <Mail className="h-8 w-8 text-primary" /> Nutrição IA
          </h1>
          <p className="text-muted-foreground mt-1">Sequências de e-mail por produto. Lead → Comprador em até 1 ano.</p>
        </div>
        <div className="flex gap-2">
          <GuideDrawer area="nutricao" />
          <Button variant="outline" onClick={() => setBulkOpen(true)}><UserPlus className="h-4 w-4 mr-2" /> Inscrição em massa</Button>
          <Button variant="outline" onClick={runScheduler}>Rodar agora</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Nova sequência</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Criar sequência de nutrição</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label>Projeto</Label>
                  <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Produto (nome exato em imphq_vendas.produto_nome)</Label>
                  <Input value={form.produto_nome} onChange={(e) => setForm({ ...form, produto_nome: e.target.value })} placeholder="Ex: Código dos Cortes Perfeitos" />
                </div>
                <div>
                  <Label>Nome da sequência</Label>
                  <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Nutrição 1 ano - Cortes" />
                </div>
                <div>
                  <Label>Objetivo</Label>
                  <Textarea value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} placeholder="O que essa sequência precisa fazer?" rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Duração (dias)</Label>
                    <Input type="number" value={form.duracao_dias} onChange={(e) => setForm({ ...form, duracao_dias: parseInt(e.target.value) || 365 })} />
                  </div>
                  <div>
                    <Label>Cadência</Label>
                    <Select value={form.cadencia} onValueChange={(v) => setForm({ ...form, cadencia: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="diaria">Diária</SelectItem>
                        <SelectItem value="semanal">Semanal</SelectItem>
                        <SelectItem value="quinzenal">Quinzenal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Filtrar por tags do formulário (opcional)</Label>
                  <TagAutocomplete tags={form.filter_tags || []} onChange={(tags) => setForm({ ...form, filter_tags: tags })} placeholder="ex: vip-cortes" />
                  <p className="text-[11px] text-muted-foreground mt-1">Só entram leads que tenham essas tags. Vazio = todos os leads.</p>
                </div>
                {form.filter_tags?.length > 1 && (
                  <div>
                    <Label>Modo</Label>
                    <Select value={form.filter_tags_mode} onValueChange={(v) => setForm({ ...form, filter_tags_mode: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Qualquer tag</SelectItem>
                        <SelectItem value="all">Todas as tags</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button className="w-full" onClick={create}>Criar</Button>

              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : sequences.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Nenhuma sequência ainda. Crie a primeira para começar a nutrir leads automaticamente.
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sequences.map(s => (
            <Card key={s.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{s.nome}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">{s.produto_nome}</p>
                  </div>
                  <Switch checked={s.ativa} onCheckedChange={() => toggleAtiva(s.id, s.ativa)} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {s.objetivo && <p className="text-xs text-muted-foreground line-clamp-2">{s.objetivo}</p>}
                <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-border">
                  <div><div className="text-lg font-semibold flex items-center justify-center gap-1"><Users className="h-3 w-3" />{s.total_leads_ativos}</div><div className="text-[10px] text-muted-foreground">Leads</div></div>
                  <div><div className="text-lg font-semibold flex items-center justify-center gap-1"><Mail className="h-3 w-3" />{s.total_emails_enviados}</div><div className="text-[10px] text-muted-foreground">Enviados</div></div>
                  <div><div className="text-lg font-semibold flex items-center justify-center gap-1"><TrendingUp className="h-3 w-3" />{s.total_conversoes}</div><div className="text-[10px] text-muted-foreground">Conv.</div></div>
                </div>
                <div className="text-xs text-muted-foreground flex justify-between pt-2 border-t border-border">
                  <span>{s.cadencia} • {s.duracao_dias}d</span>
                  <span className="font-medium text-emerald-400">R$ {Number(s.receita_atribuida || 0).toFixed(0)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <BulkEnrollDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        sequences={sequences.map(s => ({ id: s.id, nome: s.nome, produto: s.produto_nome }))}
        onDone={load}
      />
    </div>
  );
}

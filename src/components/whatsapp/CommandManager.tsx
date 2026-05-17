import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Zap, GripVertical } from "lucide-react";
import { toast } from "sonner";

interface SequenceStep {
  content: string;
  delay_seconds?: number;
  media_url?: string;
  media_type?: string;
}

interface Command {
  id: string;
  project_id: string;
  trigger_word: string;
  response_text: string | null;
  response_media_url: string | null;
  media_type: string;
  is_active: boolean;
  sequence?: SequenceStep[];
  created_at: string;
}

interface Props {
  projects: { id: string; name: string }[];
}

const emptyForm = {
  project_id: "",
  trigger_word: "",
  response_text: "",
  sequence: [] as SequenceStep[],
  mode: "single" as "single" | "sequence",
};

export default function CommandManager({ projects }: Props) {
  const [commands, setCommands] = useState<Command[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("imphq_wa_commands")
      .select("*")
      .order("created_at", { ascending: false });
    setCommands((data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setShowCreate(true); };

  const openEdit = (c: Command) => {
    const seq = Array.isArray(c.sequence) ? c.sequence : [];
    setEditingId(c.id);
    setForm({
      project_id: c.project_id,
      trigger_word: c.trigger_word,
      response_text: c.response_text || "",
      sequence: seq,
      mode: seq.length > 0 ? "sequence" : "single",
    });
    setShowCreate(true);
  };

  const save = async () => {
    if (!form.trigger_word || !form.project_id) { toast.error("Projeto e palavra-chave obrigatórios"); return; }
    const payload: any = {
      project_id: form.project_id,
      trigger_word: form.trigger_word.toLowerCase().trim().replace(/^\//, ""),
      response_text: form.mode === "single" ? (form.response_text || null) : null,
      sequence: form.mode === "sequence" ? form.sequence.filter(s => s.content.trim()) : [],
      media_type: "text",
      is_active: true,
    };
    if (editingId) {
      const { error } = await supabase.from("imphq_wa_commands").update(payload).eq("id", editingId);
      if (error) { toast.error(error.message); return; }
      toast.success("Comando atualizado!");
    } else {
      const { error } = await supabase.from("imphq_wa_commands").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Comando criado!");
    }
    setShowCreate(false);
    setForm(emptyForm);
    setEditingId(null);
    load();
  };

  const toggle = async (id: string, active: boolean) => {
    await supabase.from("imphq_wa_commands").update({ is_active: active } as any).eq("id", id);
    setCommands(prev => prev.map(c => c.id === id ? { ...c, is_active: active } : c));
  };

  const remove = async (id: string) => {
    await supabase.from("imphq_wa_commands").delete().eq("id", id);
    toast.success("Comando removido");
    load();
  };

  const addStep = () => setForm(f => ({ ...f, sequence: [...f.sequence, { content: "", delay_seconds: 2 }] }));
  const updateStep = (i: number, patch: Partial<SequenceStep>) => setForm(f => ({
    ...f, sequence: f.sequence.map((s, idx) => idx === i ? { ...s, ...patch } : s),
  }));
  const removeStep = (i: number) => setForm(f => ({ ...f, sequence: f.sequence.filter((_, idx) => idx !== i) }));

  const projectName = (id: string) => projects.find(p => p.id === id)?.name || "—";

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">⚡ Comandos</h2>
          <p className="text-xs text-muted-foreground">Atalhos disparáveis por <code>/palavra</code> no chat. Suporta sequência de mensagens com delay.</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Novo Comando
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : commands.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Zap className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">Nenhum comando criado.</p>
            <p className="text-xs text-muted-foreground mt-1">No chat, digite <code>/</code> para disparar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {commands.map(cmd => {
            const seqLen = Array.isArray(cmd.sequence) ? cmd.sequence.length : 0;
            return (
              <Card key={cmd.id} className={`${cmd.is_active ? "" : "opacity-60"} cursor-pointer hover:border-primary/40 transition-colors`} onClick={() => openEdit(cmd)}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs font-mono">/{cmd.trigger_word}</Badge>
                      {seqLen > 0 && <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/30">seq {seqLen}</Badge>}
                      <span className="text-[10px] text-muted-foreground">{projectName(cmd.project_id)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {cmd.response_text || cmd.sequence?.[0]?.content || "—"}
                    </p>
                  </div>
                  <Switch checked={cmd.is_active} onCheckedChange={v => toggle(cmd.id, v)} onClick={e => e.stopPropagation()} />
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={e => { e.stopPropagation(); remove(cmd.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl bg-secondary/40 max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Editar Comando" : "Novo Comando"}</DialogTitle></DialogHeader>
          <div className="space-y-3 leading-7">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Projeto</Label>
                <Select value={form.project_id} onValueChange={v => setForm({ ...form, project_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Palavra-chave (sem /)</Label>
                <Input value={form.trigger_word} onChange={e => setForm({ ...form, trigger_word: e.target.value })} placeholder="oi, preco, link" />
              </div>
            </div>

            <div>
              <Label className="text-xs">Modo</Label>
              <div className="flex gap-2 mt-1">
                <Button size="sm" variant={form.mode === "single" ? "default" : "outline"} onClick={() => setForm(f => ({ ...f, mode: "single" }))}>
                  Mensagem única
                </Button>
                <Button size="sm" variant={form.mode === "sequence" ? "default" : "outline"} onClick={() => setForm(f => ({ ...f, mode: "sequence", sequence: f.sequence.length === 0 ? [{ content: f.response_text || "", delay_seconds: 0 }] : f.sequence }))}>
                  Sequência (várias msgs)
                </Button>
              </div>
            </div>

            {form.mode === "single" ? (
              <div>
                <Label>Resposta</Label>
                <Textarea value={form.response_text} onChange={e => setForm({ ...form, response_text: e.target.value })} placeholder="Texto enviado. Use {nome} {telefone} {projeto}" rows={4} />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Passos da sequência</Label>
                  <Button size="sm" variant="outline" onClick={addStep}><Plus className="h-3 w-3 mr-1" /> Passo</Button>
                </div>
                {form.sequence.length === 0 && <p className="text-xs text-muted-foreground">Nenhum passo. Clique em "+ Passo".</p>}
                {form.sequence.map((s, i) => (
                  <div key={i} className="flex gap-2 items-start p-2 bg-background/40 rounded border border-border/50">
                    <GripVertical className="h-4 w-4 text-muted-foreground mt-2 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Textarea
                        value={s.content}
                        onChange={e => updateStep(i, { content: e.target.value })}
                        placeholder={`Mensagem ${i + 1}`}
                        rows={2}
                        className="text-sm"
                      />
                      <div className="flex items-center gap-2">
                        <Label className="text-[10px] text-muted-foreground">Delay (s) após anterior:</Label>
                        <Input
                          type="number"
                          min={0}
                          value={s.delay_seconds ?? 0}
                          onChange={e => updateStep(i, { delay_seconds: Number(e.target.value) })}
                          className="h-7 w-20 text-xs"
                          disabled={i === 0}
                        />
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0" onClick={() => removeStep(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={save}>{editingId ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

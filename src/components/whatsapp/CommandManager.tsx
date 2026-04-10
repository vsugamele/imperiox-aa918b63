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
import { Plus, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";

interface Command {
  id: string;
  project_id: string;
  trigger_word: string;
  response_text: string | null;
  response_media_url: string | null;
  media_type: string;
  is_active: boolean;
  created_at: string;
}

interface Props {
  projects: { id: string; name: string }[];
}

export default function CommandManager({ projects }: Props) {
  const [commands, setCommands] = useState<Command[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ project_id: "", trigger_word: "", response_text: "", media_type: "text" });

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

  const create = async () => {
    if (!form.trigger_word || !form.project_id) { toast.error("Projeto e palavra-chave obrigatórios"); return; }
    const { error } = await supabase.from("imphq_wa_commands").insert({
      project_id: form.project_id,
      trigger_word: form.trigger_word.toLowerCase().trim(),
      response_text: form.response_text || null,
      media_type: form.media_type,
      is_active: true,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Comando criado!");
    setShowCreate(false);
    setForm({ project_id: "", trigger_word: "", response_text: "", media_type: "text" });
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

  const projectName = (id: string) => projects.find(p => p.id === id)?.name || "—";

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">⚡ Comandos</h2>
          <p className="text-xs text-muted-foreground">Auto-respostas por palavra-chave nas conversas</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
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
            <p className="text-xs text-muted-foreground mt-1">Crie comandos para responder automaticamente quando alguém enviar uma palavra-chave.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {commands.map(cmd => (
            <Card key={cmd.id} className={`${cmd.is_active ? "" : "opacity-60"}`}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs font-mono">/{cmd.trigger_word}</Badge>
                    <span className="text-[10px] text-muted-foreground">{projectName(cmd.project_id)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{cmd.response_text || "—"}</p>
                </div>
                <Switch checked={cmd.is_active} onCheckedChange={v => toggle(cmd.id, v)} />
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(cmd.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Comando</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Projeto</Label>
              <Select value={form.project_id} onValueChange={v => setForm({ ...form, project_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Palavra-chave (trigger)</Label>
              <Input value={form.trigger_word} onChange={e => setForm({ ...form, trigger_word: e.target.value })} placeholder="Ex: oi, preço, cardápio" />
            </div>
            <div>
              <Label>Resposta automática</Label>
              <Textarea value={form.response_text} onChange={e => setForm({ ...form, response_text: e.target.value })} placeholder="Texto que será enviado..." rows={3} />
            </div>
          </div>
          <DialogFooter><Button onClick={create}>Criar Comando</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

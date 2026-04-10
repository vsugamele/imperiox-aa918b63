import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";

interface WaTemplate {
  id: string; name: string; content: string; category: string; project_id: string | null;
}

interface Props {
  templates: WaTemplate[];
  projects: { id: string; name: string }[];
  onReload: () => void;
}

export default function TemplateManager({ templates, projects, onReload }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<WaTemplate | null>(null);
  const [form, setForm] = useState({ name: "", content: "", category: "geral", project_id: "" });

  const projectName = (id: string) => projects.find(p => p.id === id)?.name || "—";

  const save = async () => {
    if (!form.name.trim() || !form.content.trim()) { toast.error("Nome e conteúdo obrigatórios"); return; }
    if (editing) {
      const { error } = await supabase.from("imphq_wa_templates").update({
        name: form.name, content: form.content, category: form.category,
        project_id: form.project_id || null,
      }).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Template atualizado!");
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("imphq_wa_templates").insert({
        name: form.name, content: form.content,
        category: form.category, project_id: form.project_id || null,
        user_id: user?.id,
      });
      if (error) { toast.error(error.message); return; }
      toast.success("Template criado!");
    }
    setShowForm(false); setEditing(null);
    setForm({ name: "", content: "", category: "geral", project_id: "" });
    onReload();
  };

  const remove = async (id: string) => {
    await supabase.from("imphq_wa_templates").delete().eq("id", id);
    toast.success("Template removido"); onReload();
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setEditing(null); setForm({ name: "", content: "", category: "geral", project_id: "" }); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Novo Template
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(t => (
          <Card key={t.id} className="bg-card border-border">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm">{t.name}</h3>
                <Badge variant="outline" className="text-[9px]">{t.category}</Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{t.content}</p>
              {t.project_id && <p className="text-[10px] text-muted-foreground">{projectName(t.project_id)}</p>}
              <div className="flex gap-1 pt-1">
                <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => {
                  setEditing(t);
                  setForm({ name: t.name, content: t.content, category: t.category, project_id: t.project_id || "" });
                  setShowForm(true);
                }}><Edit className="h-3 w-3 mr-1" /> Editar</Button>
                <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive" onClick={() => remove(t.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {templates.length === 0 && (
          <div className="col-span-full text-center py-8">
            <p className="text-sm text-muted-foreground mb-2">Nenhum template criado</p>
            <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Criar primeiro template
            </Button>
          </div>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Template" : "Novo Template"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Boas-vindas" /></div>
            <div>
              <Label>Conteúdo</Label>
              <Textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={4} placeholder="Olá {{nome}}, tudo bem?" />
              <p className="text-[10px] text-muted-foreground mt-1">Variáveis: {"{{nome}}"}, {"{{telefone}}"}, {"{{produto}}"}</p>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="geral">Geral</SelectItem>
                  <SelectItem value="boas-vindas">Boas-vindas</SelectItem>
                  <SelectItem value="follow-up">Follow-up</SelectItem>
                  <SelectItem value="vendas">Vendas</SelectItem>
                  <SelectItem value="suporte">Suporte</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Projeto (opcional)</Label>
              <Select value={form.project_id || "none"} onValueChange={v => setForm({ ...form, project_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={save}>{editing ? "Salvar" : "Criar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Plus, Trash2, Edit2, Save, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Objection = {
  id: string;
  objecao: string;
  resposta_padrao: string | null;
  contexto_produto: string | null;
  projeto_id: string | null;
  score_uso: number;
  origem: string;
  status: string;
};

export function ObjectionsLibrary() {
  const [items, setItems] = useState<Objection[]>([]);
  const [projetos, setProjetos] = useState<any[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Objection>>({});
  const [creating, setCreating] = useState(false);
  const [filterProj, setFilterProj] = useState<string>("__all__");

  const load = async () => {
    let q = supabase.from("imphq_wa_objections").select("*").order("score_uso", { ascending: false });
    if (filterProj !== "__all__") q = filterProj === "global" ? q.is("projeto_id", null) : q.eq("projeto_id", filterProj);
    const { data } = await q;
    setItems((data as any) || []);
  };

  useEffect(() => {
    supabase.from("imphq_projects").select("id, name").then(({ data }) => setProjetos(data || []));
  }, []);

  useEffect(() => { load(); }, [filterProj]);

  const save = async (id?: string) => {
    if (!draft.objecao || !draft.resposta_padrao) {
      toast.error("Preencha objeção e resposta");
      return;
    }
    const payload = {
      objecao: draft.objecao,
      resposta_padrao: draft.resposta_padrao,
      contexto_produto: draft.contexto_produto || null,
      projeto_id: draft.projeto_id || null,
      origem: id ? undefined : "manual",
    };
    const { error } = id
      ? await supabase.from("imphq_wa_objections").update(payload).eq("id", id)
      : await supabase.from("imphq_wa_objections").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Salvo");
    setEditing(null);
    setCreating(false);
    setDraft({});
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir objeção?")) return;
    await supabase.from("imphq_wa_objections").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-primary">📚 Biblioteca de Objeções</h2>
          <p className="text-xs text-muted-foreground mt-1">Respostas padrão usadas automaticamente pela IA quando detecta objeção conhecida.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterProj} onValueChange={setFilterProj}>
            <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos projetos</SelectItem>
              <SelectItem value="global">Global</SelectItem>
              {projetos.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => { setCreating(true); setDraft({}); }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Nova
          </Button>
        </div>
      </div>

      {creating && (
        <Card className="p-4 bg-secondary/40 border-primary/30 space-y-3">
          <Input placeholder="Objeção (ex: 'tá caro')" value={draft.objecao || ""} onChange={(e) => setDraft({ ...draft, objecao: e.target.value })} />
          <Textarea placeholder="Resposta padrão..." rows={4} value={draft.resposta_padrao || ""} onChange={(e) => setDraft({ ...draft, resposta_padrao: e.target.value })} />
          <div className="flex gap-2">
            <Select value={draft.projeto_id || "global"} onValueChange={(v) => setDraft({ ...draft, projeto_id: v === "global" ? undefined : v })}>
              <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Projeto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global (todos projetos)</SelectItem>
                {projetos.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" onClick={() => { setCreating(false); setDraft({}); }}><X className="h-3.5 w-3.5" /></Button>
            <Button size="sm" onClick={() => save()}><Save className="h-3.5 w-3.5 mr-1" /> Salvar</Button>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma objeção cadastrada. A IA criará rascunhos quando detectar objeções recorrentes.</p>
        ) : items.map((o) => (
          <Card key={o.id} className="p-4 bg-secondary/40 leading-7">
            {editing === o.id ? (
              <div className="space-y-2">
                <Input value={draft.objecao || o.objecao} onChange={(e) => setDraft({ ...draft, objecao: e.target.value })} />
                <Textarea rows={3} value={draft.resposta_padrao || o.resposta_padrao || ""} onChange={(e) => setDraft({ ...draft, resposta_padrao: e.target.value })} />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setDraft({}); }}><X className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" onClick={() => save(o.id)}><Save className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1">
                    <p className="font-medium">{o.objecao}</p>
                    <p className="text-sm text-muted-foreground mt-1">{o.resposta_padrao || <em className="text-amber-400">Sem resposta cadastrada</em>}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {o.origem === "ai" && <Badge variant="outline" className="text-[10px]"><Sparkles className="h-2.5 w-2.5 mr-1" />IA</Badge>}
                    <Badge variant="outline" className="text-[10px]">{o.score_uso}× usada</Badge>
                  </div>
                </div>
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setEditing(o.id); setDraft({}); }}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-red-400" onClick={() => remove(o.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

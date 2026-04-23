import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NotebookPen, Plus, Pin, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface Props { projectId: string; }

export function ProjetoNotasCard({ projectId }: Props) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await (supabase as any).from("imphq_project_notes")
      .select("*").eq("project_id", projectId)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20);
    setNotes(data || []);
  };

  useEffect(() => { load(); }, [projectId]);

  const save = async () => {
    if (!content.trim()) return;
    setSaving(true);
    const sb: any = supabase;
    const { error } = await sb.from("imphq_project_notes").insert({
      project_id: projectId,
      author_id: user?.id || null,
      author_name: (user as any)?.email?.split("@")[0] || "Usuário",
      content: content.trim(),
    });
    setSaving(false);
    if (error) { toast.error("Erro ao salvar"); return; }
    setContent(""); setAdding(false); load();
  };

  const togglePin = async (n: any) => {
    await (supabase as any).from("imphq_project_notes").update({ pinned: !n.pinned }).eq("id", n.id);
    load();
  };

  const remove = async (id: string) => {
    await (supabase as any).from("imphq_project_notes").delete().eq("id", id);
    load();
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <NotebookPen className="h-4 w-4 text-primary" /> Diário de Bordo
        </CardTitle>
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setAdding(!adding)}>
          <Plus className="h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {adding && (
          <div className="space-y-2">
            <Textarea
              placeholder="O que aconteceu hoje? Decisão estratégica? Aprendizado?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              className="text-xs"
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => { setAdding(false); setContent(""); }}>Cancelar</Button>
              <Button size="sm" onClick={save} disabled={saving || !content.trim()}>{saving ? "..." : "Salvar"}</Button>
            </div>
          </div>
        )}

        {notes.length === 0 && !adding && (
          <div className="text-xs text-muted-foreground text-center py-4">
            Sem notas ainda. <button onClick={() => setAdding(true)} className="text-primary hover:underline">Criar a primeira</button>
          </div>
        )}

        <div className="space-y-2 max-h-[280px] overflow-auto">
          {notes.map((n) => (
            <div key={n.id} className="bg-muted/30 rounded p-2 group relative">
              <div className="text-xs text-foreground whitespace-pre-wrap">{n.content}</div>
              <div className="flex items-center justify-between mt-1.5">
                <div className="text-[10px] text-muted-foreground">
                  {n.author_name} · {format(new Date(n.created_at), "dd/MM HH:mm", { locale: ptBR })}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => togglePin(n)} className={`text-[10px] ${n.pinned ? "text-primary" : "text-muted-foreground"}`}>
                    <Pin className="h-3 w-3" />
                  </button>
                  <button onClick={() => remove(n.id)} className="text-[10px] text-red-400">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
              {n.pinned && <div className="absolute top-1 right-1"><Pin className="h-2.5 w-2.5 text-primary fill-primary" /></div>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

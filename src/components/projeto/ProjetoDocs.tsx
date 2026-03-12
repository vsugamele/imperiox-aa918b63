import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, FileText, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

interface Props {
  projectId: string;
}

export function ProjetoDocs({ projectId }: Props) {
  const [docs, setDocs] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);

  const fetchDocs = async () => {
    const { data } = await supabase.from("imphq_docs").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
    setDocs(data || []);
  };

  useEffect(() => { fetchDocs(); }, [projectId]);

  const createDoc = async () => {
    const { data, error } = await supabase.from("imphq_docs").insert({ project_id: projectId, title: "Novo Documento", content: "" }).select().single();
    if (error) { toast.error("Erro ao criar doc"); return; }
    setDocs([data, ...docs]);
    setEditing(data);
  };

  const saveDoc = async () => {
    if (!editing) return;
    const { error } = await supabase.from("imphq_docs").update({ title: editing.title, content: editing.content }).eq("id", editing.id);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Salvo!");
    setEditing(null);
    fetchDocs();
  };

  const deleteDoc = async (id: string) => {
    await supabase.from("imphq_docs").delete().eq("id", id);
    setDocs(docs.filter((d) => d.id !== id));
    if (editing?.id === id) setEditing(null);
  };

  if (editing) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="bg-secondary text-lg font-medium max-w-md" />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button size="sm" onClick={saveDoc}><Save className="h-3 w-3 mr-1" /> Salvar</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={editing.content || ""}
            onChange={(e) => setEditing({ ...editing, content: e.target.value })}
            className="bg-secondary min-h-[400px] font-mono text-sm"
            placeholder="Escreva o conteúdo do documento..."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">📄 Documentos do Projeto</CardTitle>
        <Button size="sm" variant="outline" onClick={createDoc}><Plus className="h-3 w-3 mr-1" /> Novo Doc</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {docs.map((d) => (
          <div key={d.id} className="flex items-center justify-between p-3 rounded-md bg-secondary/50 border border-border hover:bg-secondary transition-colors cursor-pointer" onClick={() => setEditing(d)}>
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-sm">{d.title}</span>
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); deleteDoc(d.id); }}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        {docs.length === 0 && <p className="text-sm text-muted-foreground">Nenhum documento ainda.</p>}
      </CardContent>
    </Card>
  );
}

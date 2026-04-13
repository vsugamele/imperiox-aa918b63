import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, FileText, Trash2, Save, Download, Upload, Eye } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  projectId: string;
}

export function ProjetoDocs({ projectId }: Props) {
  const [docs, setDocs] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [expertDocIds, setExpertDocIds] = useState<string[]>([]);
  const importRef = useRef<HTMLInputElement>(null);

  const fetchDocs = async () => {
    const { data } = await supabase.from("imphq_docs").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
    setDocs(data || []);
  };

  const fetchExpertDocIds = async () => {
    const { data } = await supabase.from("imphq_projects").select("data").eq("id", projectId).single();
    const d = typeof data?.data === "string" ? JSON.parse(data.data) : (data?.data || {});
    setExpertDocIds(d.expert_doc_ids || []);
  };

  useEffect(() => { fetchDocs(); fetchExpertDocIds(); }, [projectId]);

  const toggleExpertDoc = async (docId: string) => {
    const newIds = expertDocIds.includes(docId)
      ? expertDocIds.filter((id) => id !== docId)
      : [...expertDocIds, docId];

    // Fetch current project data, merge, and save
    const { data: proj } = await supabase.from("imphq_projects").select("data").eq("id", projectId).single();
    const currentData = typeof proj?.data === "string" ? JSON.parse(proj.data) : (proj?.data || {});
    const updatedData = { ...currentData, expert_doc_ids: newIds };

    const { error } = await supabase.from("imphq_projects").update({ data: updatedData } as any).eq("id", projectId);
    if (error) { toast.error("Erro ao atualizar visibilidade"); return; }

    setExpertDocIds(newIds);
    toast.success(newIds.includes(docId) ? "Documento visível no Portal do Expert" : "Documento removido do Portal do Expert");
  };

  const createDoc = async () => {
    const newId = crypto.randomUUID();
    const { data, error } = await supabase.from("imphq_docs").insert({ id: newId, project_id: projectId, title: "Novo Documento", content: "" } as any).select().single();
    if (error) { toast.error("Erro ao criar doc: " + error.message); return; }
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
    // Also remove from expert_doc_ids if present
    if (expertDocIds.includes(id)) {
      const newIds = expertDocIds.filter((i) => i !== id);
      const { data: proj } = await supabase.from("imphq_projects").select("data").eq("id", projectId).single();
      const currentData = typeof proj?.data === "string" ? JSON.parse(proj.data) : (proj?.data || {});
      await supabase.from("imphq_projects").update({ data: { ...currentData, expert_doc_ids: newIds } } as any).eq("id", projectId);
      setExpertDocIds(newIds);
    }
  };

  const downloadDoc = (doc: any) => {
    const blob = new Blob([doc.content || ""], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(doc.title || "documento").replace(/[^a-zA-Z0-9_-]/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      const text = await file.text();
      const title = file.name.replace(/\.[^.]+$/, "");
      const newId = crypto.randomUUID();
      const { data, error } = await supabase.from("imphq_docs").insert({ id: newId, project_id: projectId, title, content: text } as any).select().single();
      if (!error && data) setDocs(prev => [data, ...prev]);
    }
    toast.success(`${files.length} doc(s) importado(s)`);
    if (importRef.current) importRef.current.value = "";
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
        <div className="flex gap-2">
          <input ref={importRef} type="file" multiple accept=".txt,.md,.doc,.docx" onChange={handleImport} className="hidden" />
          <Button size="sm" variant="outline" onClick={() => importRef.current?.click()}>
            <Upload className="h-3 w-3 mr-1" /> Importar
          </Button>
          <Button size="sm" variant="outline" onClick={createDoc}><Plus className="h-3 w-3 mr-1" /> Novo Doc</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {docs.map((d) => {
          const isShared = expertDocIds.includes(d.id);
          return (
            <div key={d.id} className="flex items-center justify-between p-3 rounded-md bg-secondary/50 border border-border hover:bg-secondary transition-colors cursor-pointer" onClick={() => setEditing(d)}>
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm">{d.title}</span>
                {isShared && (
                  <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full flex items-center gap-1">
                    <Eye className="h-3 w-3" /> Expert
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div onClick={(e) => e.stopPropagation()} className="flex items-center">
                      <Switch
                        checked={isShared}
                        onCheckedChange={() => toggleExpertDoc(d.id)}
                        className="scale-75"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs">{isShared ? "Visível no Portal do Expert" : "Habilitar para o Expert"}</p>
                  </TooltipContent>
                </Tooltip>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); downloadDoc(d); }}>
                  <Download className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); deleteDoc(d.id); }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
        {docs.length === 0 && <p className="text-sm text-muted-foreground">Nenhum documento ainda.</p>}
      </CardContent>
    </Card>
  );
}

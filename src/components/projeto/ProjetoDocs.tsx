import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, FileText, Trash2, Save, Download, Upload, Eye, FileIcon } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DocViewerDialog } from "./DocViewerDialog";

interface Props {
  projectId: string;
}

const FILE_MARKER = /^\[\[file:(.+?)\|(.+?)\]\]$/;
function parseDocContent(content: string | null | undefined): { kind: "file" | "text"; url?: string; mime?: string } {
  if (!content) return { kind: "text" };
  const m = content.trim().match(FILE_MARKER);
  if (m) return { kind: "file", url: m[1], mime: m[2] };
  return { kind: "text" };
}

export function ProjetoDocs({ projectId }: Props) {
  const [docs, setDocs] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [viewing, setViewing] = useState<any>(null);
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

  const downloadDoc = async (doc: any) => {
    const parsed = parseDocContent(doc.content);
    if (parsed.kind === "file" && parsed.url) {
      try {
        const res = await fetch(parsed.url);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const ext = parsed.url.split(".").pop()?.split("?")[0] || "bin";
        a.href = url;
        a.download = `${(doc.title || "documento").replace(/[^a-zA-Z0-9_.-]/g, "_")}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        window.open(parsed.url, "_blank");
      }
      return;
    }
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
    let ok = 0;
    for (const file of Array.from(files)) {
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      const title = file.name.replace(/\.[^.]+$/, "");
      const isText = ["txt", "md", "markdown"].includes(ext) || file.type.startsWith("text/");
      let content = "";
      if (isText) {
        content = await file.text();
      } else {
        // upload binary to storage
        const path = `docs/${projectId}/${crypto.randomUUID()}.${ext || "bin"}`;
        const { error: upErr } = await supabase.storage.from("project-media").upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (upErr) { toast.error(`Falha ao subir ${file.name}: ${upErr.message}`); continue; }
        const { data: urlData } = supabase.storage.from("project-media").getPublicUrl(path);
        content = `[[file:${urlData.publicUrl}|${file.type || "application/octet-stream"}]]`;
      }
      const newId = crypto.randomUUID();
      const { data, error } = await supabase.from("imphq_docs").insert({ id: newId, project_id: projectId, title, content } as any).select().single();
      if (!error && data) { setDocs(prev => [data, ...prev]); ok++; }
      else if (error) toast.error(`Erro: ${error.message}`);
    }
    if (ok > 0) toast.success(`${ok} doc(s) importado(s)`);
    if (importRef.current) importRef.current.value = "";
  };

  if (editing) {
    const parsedEdit = parseDocContent(editing.content);
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
          {parsedEdit.kind === "file" ? (
            <div className="p-6 rounded-md bg-secondary/40 text-sm space-y-3 leading-7">
              <p className="flex items-center gap-2"><FileIcon className="h-4 w-4 text-primary" /> Documento de arquivo ({parsedEdit.mime}).</p>
              <p className="text-muted-foreground">Use Visualizar ou Baixar na lista. O título pode ser editado acima.</p>
              <Button size="sm" variant="outline" onClick={() => setViewing(editing)}>
                <Eye className="h-3 w-3 mr-1" /> Visualizar
              </Button>
            </div>
          ) : (
            <Textarea
              value={editing.content || ""}
              onChange={(e) => setEditing({ ...editing, content: e.target.value })}
              className="bg-secondary min-h-[400px] font-mono text-sm"
              placeholder="Escreva o conteúdo do documento..."
            />
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">📄 Documentos do Projeto</CardTitle>
        <div className="flex gap-2">
          <input ref={importRef} type="file" multiple accept=".txt,.md,.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" onChange={handleImport} className="hidden" />
          <Button size="sm" variant="outline" onClick={() => importRef.current?.click()}>
            <Upload className="h-3 w-3 mr-1" /> Importar
          </Button>
          <Button size="sm" variant="outline" onClick={createDoc}><Plus className="h-3 w-3 mr-1" /> Novo Doc</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {docs.map((d) => {
          const isShared = expertDocIds.includes(d.id);
          const parsed = parseDocContent(d.content);
          const isFile = parsed.kind === "file";
          return (
            <div
              key={d.id}
              className="flex items-center justify-between p-3 rounded-md bg-secondary/50 border border-border hover:bg-secondary transition-colors cursor-pointer"
              onClick={() => (isFile ? setViewing(d) : setEditing(d))}
            >
              <div className="flex items-center gap-3 min-w-0">
                {isFile ? <FileIcon className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-primary" />}
                <span className="text-sm truncate">{d.title}</span>
                {isFile && <span className="text-[10px] text-muted-foreground uppercase">{parsed.mime?.split("/")[1]}</span>}
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
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setViewing(d); }} title="Visualizar">
                  <Eye className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); downloadDoc(d); }} title="Baixar">
                  <Download className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); deleteDoc(d.id); }} title="Excluir">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
        {docs.length === 0 && <p className="text-sm text-muted-foreground">Nenhum documento ainda.</p>}
      </CardContent>
      {viewing && (() => {
        const p = parseDocContent(viewing.content);
        return (
          <DocViewerDialog
            open={!!viewing}
            onOpenChange={(v) => !v && setViewing(null)}
            title={viewing.title}
            kind={p.kind}
            url={p.url}
            mime={p.mime}
            content={viewing.content}
          />
        );
      })()}
    </Card>
  );
}

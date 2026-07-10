import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FolderOpen, Upload, Loader2, Trash2, FileText, RefreshCw } from "lucide-react";

interface FileEntry {
  name: string;
  path: string;
  size?: number;
  chunks?: number;
}

interface Props {
  agentId: string;
  files: any[];
  onChange: (files: FileEntry[]) => void;
}

const ACCEPT = ".txt,.md,.csv,.json,.pdf,.docx";

export default function ArquivosTab({ agentId, files, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [reprocessing, setReprocessing] = useState<string | null>(null);
  const [chunkCounts, setChunkCounts] = useState<Record<string, number>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const list: FileEntry[] = Array.isArray(files) ? files as FileEntry[] : [];

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("imphq_agent_knowledge" as any)
        .select("source_path")
        .eq("agent_id", agentId);
      const counts: Record<string, number> = {};
      ((data as any[]) || []).forEach((r) => {
        if (r.source_path) counts[r.source_path] = (counts[r.source_path] || 0) + 1;
      });
      setChunkCounts(counts);
    })();
  }, [agentId, files]);

  const handleFiles = async (fs: FileList | null) => {
    if (!fs || !fs.length) return;
    setUploading(true);
    const next: FileEntry[] = [...list];
    for (const f of Array.from(fs)) {
      try {
        const path = `${agentId}/${Date.now()}-${f.name.replace(/[^\w.-]+/g, "_")}`;
        const up = await supabase.storage.from("agent-knowledge").upload(path, f, { upsert: false });
        if (up.error) throw up.error;
        const { data, error } = await supabase.functions.invoke("agent-ingest-file", {
          body: { agent_id: agentId, file_path: path, file_name: f.name },
        });
        if (error || (data as any)?.error) throw new Error(error?.message || (data as any)?.error);
        next.push({ name: f.name, path, size: f.size, chunks: (data as any)?.chunks });
        toast.success(`${f.name} — ${(data as any)?.chunks || 0} trechos indexados`);
      } catch (e: any) {
        toast.error(`${f.name}: ${e?.message || "falha"}`);
      }
    }
    onChange(next);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = async (fe: FileEntry) => {
    if (!confirm(`Remover "${fe.name}" e seus trechos?`)) return;
    try {
      await supabase.storage.from("agent-knowledge").remove([fe.path]);
      await supabase.from("imphq_agent_knowledge" as any).delete().eq("agent_id", agentId).eq("source_path", fe.path);
      onChange(list.filter((x) => x.path !== fe.path));
      toast.success("Arquivo removido");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao remover");
    }
  };

  const reprocess = async (fe: FileEntry) => {
    setReprocessing(fe.path);
    try {
      const { data, error } = await supabase.functions.invoke("agent-ingest-file", {
        body: { agent_id: agentId, file_path: fe.path, file_name: fe.name },
      });
      if (error || (data as any)?.error) throw new Error(error?.message || (data as any)?.error);
      onChange(list.map((x) => (x.path === fe.path ? { ...x, chunks: (data as any)?.chunks } : x)));
      toast.success(`${fe.name} reprocessado — ${(data as any)?.chunks || 0} trechos`);
    } catch (e: any) {
      toast.error(e?.message || "Falha");
    } finally {
      setReprocessing(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-display text-lg font-semibold">Arquivos de Conhecimento (RAG)</h3>
          <p className="text-sm text-muted-foreground">Envie .txt, .md, .csv, .json, .pdf ou .docx — chunks + embeddings automáticos.</p>
        </div>
        <input ref={inputRef} type="file" accept={ACCEPT} multiple hidden onChange={(e) => handleFiles(e.target.files)} />
        <Button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
        >
          {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          Enviar arquivos
        </Button>
      </div>

      {list.length === 0 ? (
        <div
          className="border-2 border-dashed border-white/10 rounded-2xl p-12 text-center bg-secondary/20 cursor-pointer hover:border-primary/40 transition"
          onClick={() => inputRef.current?.click()}
        >
          <FolderOpen className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum arquivo — clique para enviar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((f) => (
            <div key={f.path} className="flex items-center justify-between gap-4 bg-secondary/40 border border-white/5 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{f.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {(chunkCounts[f.path] ?? f.chunks ?? 0)} trechos
                    {f.size ? ` • ${(f.size / 1024).toFixed(1)} KB` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={reprocessing === f.path} onClick={() => reprocess(f)} title="Reprocessar">
                  {reprocessing === f.path ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-rose-400" onClick={() => remove(f)} title="Remover">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

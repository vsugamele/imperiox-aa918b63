import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Trash2, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Row {
  id: string; status: string; channel: string; media_url: string | null;
  media_kind: string | null; caption: string | null; scheduled_at: string | null;
  published_at: string | null; error: string | null; created_at: string;
}

const STATUS_COLOR: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  agendado: "bg-blue-500/20 text-blue-400 border-blue-500/40",
  pendente: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  pronto_para_publicar: "bg-cyan-500/20 text-cyan-400 border-cyan-500/40",
  publicado: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
  erro: "bg-destructive/20 text-destructive border-destructive/40",
};

export function StudioPublicationsPanel({ workflowId }: { workflowId: string | null }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  const load = async () => {
    if (!workflowId) return;
    setLoading(true);
    const { data } = await (supabase.from("imphq_studio_publications") as any)
      .select("id,status,channel,media_url,media_kind,caption,scheduled_at,published_at,error,created_at")
      .eq("workflow_id", workflowId)
      .order("created_at", { ascending: false })
      .limit(50);
    setRows((data as Row[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [workflowId]);

  useEffect(() => {
    if (!workflowId) return;
    const ch = supabase.channel(`pubs-${workflowId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "imphq_studio_publications", filter: `workflow_id=eq.${workflowId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [workflowId]);

  const runWorker = async () => {
    setRunning(true);
    try {
      const { error } = await supabase.functions.invoke("studio-publish-worker", { body: { trigger: "manual" } });
      if (error) throw error;
      toast.success("Fila processada");
      await load();
    } catch (e: any) { toast.error(e.message || "Falha no worker"); }
    finally { setRunning(false); }
  };

  const remove = async (id: string) => {
    await (supabase.from("imphq_studio_publications") as any).delete().eq("id", id);
    setRows(prev => prev.filter(r => r.id !== id));
  };

  if (!workflowId) return null;

  return (
    <div className="rounded-lg border border-border/60 bg-secondary/30 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Send className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium">Fila de publicações</span>
        <span className="text-[10px] text-muted-foreground">({rows.length})</span>
        <div className="flex-1" />
        <Button size="sm" variant="ghost" onClick={runWorker} disabled={running} className="h-7 text-[11px] gap-1">
          {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Processar agora
        </Button>
      </div>
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <div className="text-[11px] text-muted-foreground py-3 text-center">Nenhuma publicação ainda. Adicione blocos <b>📤 Publicar/Salvar</b> ao final do fluxo.</div>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {rows.map(r => (
            <div key={r.id} className="flex items-center gap-2 rounded border border-border/40 bg-background/40 p-2 text-[11px]">
              {r.media_url && (r.media_kind === "video" ? (
                <video src={r.media_url} className="w-10 h-10 rounded object-cover" />
              ) : (
                <img src={r.media_url} className="w-10 h-10 rounded object-cover" />
              ))}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase border ${STATUS_COLOR[r.status] || "bg-muted"}`}>{r.status.replace(/_/g, " ")}</span>
                  <span className="text-[10px] text-muted-foreground">{r.channel}</span>
                  {r.scheduled_at && <span className="text-[10px] text-blue-400">⏰ {new Date(r.scheduled_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>}
                  <span className="text-[10px] text-muted-foreground ml-auto">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ptBR })}</span>
                </div>
                {r.caption && <div className="text-muted-foreground truncate mt-0.5">{r.caption}</div>}
                {r.error && <div className="text-destructive truncate mt-0.5">⚠ {r.error}</div>}
              </div>
              {r.media_url && (
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => window.open(r.media_url!, "_blank")}>
                  <ExternalLink className="h-3 w-3" />
                </Button>
              )}
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => remove(r.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

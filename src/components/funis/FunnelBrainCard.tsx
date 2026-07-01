import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Brain, AlertTriangle, X, Loader2, Sparkles, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Signal {
  id: string;
  projeto_id: string;
  signal_type: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  reasoning?: string | null;
  suggested_action: any;
  status: string;
  created_at: string;
}

interface Props {
  projectId?: string;
  onRunAudit?: () => void;
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: "border-red-500/50 bg-red-500/10 text-red-300",
  high: "border-orange-500/50 bg-orange-500/10 text-orange-300",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  low: "border-sky-500/40 bg-sky-500/10 text-sky-300",
};

export function FunnelBrainCard({ projectId, onRunAudit }: Props) {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("imphq_funnel_brain_signals")
      .select("*")
      .eq("status", "active")
      .order("severity", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(8);
    if (projectId) q = q.eq("projeto_id", projectId);
    const { data } = await q;
    setSignals((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`brain-signals-${projectId || "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "imphq_funnel_brain_signals" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const trigger = async () => {
    setGenerating(true);
    try {
      const { error } = await supabase.functions.invoke("funnel-brain-tick", {
        body: { project_id: projectId },
      });
      if (error) throw error;
      toast.success("Cérebro atualizado");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao atualizar");
    } finally {
      setGenerating(false);
    }
  };

  const dismiss = async (id: string) => {
    await supabase.from("imphq_funnel_brain_signals").update({ status: "dismissed" }).eq("id", id);
    setSignals((prev) => prev.filter((s) => s.id !== id));
  };

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed bottom-4 right-4 z-30 rounded-full bg-pink-600/90 hover:bg-pink-500 text-white px-3 py-2 text-xs shadow-lg flex items-center gap-1.5"
      >
        <Brain className="h-3.5 w-3.5" />
        Cérebro {signals.length > 0 && <Badge className="bg-white/20">{signals.length}</Badge>}
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-30 w-[340px] bg-[#0a0608]/95 backdrop-blur border border-pink-500/30 rounded-xl shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-pink-500/20 bg-pink-500/5">
        <div className="flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-pink-400" />
          <span className="text-xs font-semibold text-foreground/90">Cérebro do Funil</span>
          {signals.length > 0 && <Badge variant="outline" className="text-[9px] px-1 py-0">{signals.length}</Badge>}
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={trigger} disabled={generating}>
            {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setCollapsed(true)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="max-h-[360px] overflow-y-auto p-2 space-y-1.5">
        {loading && (
          <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-pink-400" /></div>
        )}
        {!loading && signals.length === 0 && (
          <div className="text-center py-6 space-y-2">
            <p className="text-[11px] text-muted-foreground">Nenhum alerta crítico agora.</p>
            <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={trigger} disabled={generating}>
              <Sparkles className="h-3 w-3 mr-1" /> Analisar projeto
            </Button>
          </div>
        )}
        {signals.map((s) => (
          <div key={s.id} className={cn("rounded-lg border p-2 space-y-1", SEVERITY_STYLES[s.severity])}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-1.5 min-w-0 flex-1">
                <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold leading-tight">{s.title}</p>
                  {s.reasoning && <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{s.reasoning}</p>}
                </div>
              </div>
              <button onClick={() => dismiss(s.id)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
                <X className="h-3 w-3" />
              </button>
            </div>
            {s.suggested_action?.cta && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 w-full text-[10px] gap-1 border-current/40"
                onClick={() => {
                  if (s.suggested_action?.kind === "run_audit" && onRunAudit) onRunAudit();
                  else toast.info(s.suggested_action?.cta);
                }}
              >
                {s.suggested_action.cta} <ChevronRight className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

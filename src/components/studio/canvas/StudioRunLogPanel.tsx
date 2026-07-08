import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Terminal, Trash2 } from "lucide-react";

interface Props {
  workflowId: string | null;
  nodeTitles: Record<string, string>;
}

interface LogEvent {
  id: string;
  node_id: string | null;
  level: string;
  message: string;
  created_at: string;
}

export function StudioRunLogPanel({ workflowId, nodeTitles }: Props) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!workflowId) { setEvents([]); return; }
    // seed com últimos 30
    supabase
      .from("imphq_studio_canvas_run_events")
      .select("id,node_id,level,message,created_at")
      .eq("workflow_id", workflowId)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => { if (data) setEvents([...data].reverse() as any); });

    const ch = supabase
      .channel(`studio-log-${workflowId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "imphq_studio_canvas_run_events",
        filter: `workflow_id=eq.${workflowId}`,
      }, (payload) => {
        setEvents(prev => [...prev.slice(-99), payload.new as any]);
        setOpen(true);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [workflowId]);

  useEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [events, open]);

  const clear = () => setEvents([]);

  return (
    <div className={cn(
      "absolute bottom-0 left-0 right-0 border-t border-border/60 bg-[#0a0608]/95 backdrop-blur transition-all z-20",
      open ? "h-52" : "h-8"
    )}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full h-8 px-3 flex items-center justify-between text-[11px] text-muted-foreground hover:text-primary"
      >
        <div className="flex items-center gap-1.5">
          <Terminal className="h-3 w-3" />
          <span className="font-mono">Run log</span>
          {events.length > 0 && <span className="text-primary">({events.length})</span>}
          {events.length > 0 && (
            <span className="ml-2 truncate max-w-[400px] text-muted-foreground/70">
              último: {events[events.length - 1].message}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {open && events.length > 0 && (
            <span
              onClick={(e) => { e.stopPropagation(); clear(); }}
              className="hover:text-rose-400"
              role="button"
            >
              <Trash2 className="h-3 w-3" />
            </span>
          )}
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
        </div>
      </button>
      {open && (
        <div ref={scrollRef} className="h-[calc(100%-2rem)] overflow-y-auto px-3 py-1 font-mono text-[11px] space-y-0.5">
          {events.length === 0 && <div className="text-muted-foreground/50 italic">Nenhum evento ainda.</div>}
          {events.map(ev => {
            const t = new Date(ev.created_at).toLocaleTimeString();
            const tag = ev.node_id ? nodeTitles[ev.node_id]?.slice(0, 24) || ev.node_id.slice(0, 6) : "system";
            return (
              <div key={ev.id} className={cn(
                "flex gap-2",
                ev.level === "error" && "text-rose-400",
                ev.level === "success" && "text-emerald-400",
                ev.level === "warn" && "text-amber-400",
                ev.level === "info" && "text-muted-foreground",
              )}>
                <span className="text-muted-foreground/50 shrink-0">{t}</span>
                <span className="text-primary/70 shrink-0 w-24 truncate">[{tag}]</span>
                <span className="flex-1">{ev.message}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

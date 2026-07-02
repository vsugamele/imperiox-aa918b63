import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export function OperationsFooter() {
  const { data } = useQuery({
    queryKey: ["cockpit", "operations"],
    staleTime: 60_000,
    refetchInterval: 120_000,
    queryFn: async () => {
      const now = Date.now();
      const since24 = new Date(now - 24 * 3600_000).toISOString();
      const startToday = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

      const [msgsRes, activeConvRes, tasksRes] = await Promise.all([
        (supabase as any)
          .from("imphq_wa_messages")
          .select("from_ai, direction")
          .eq("direction", "out")
          .gte("created_at", since24),
        (supabase as any)
          .from("imphq_wa_conversations")
          .select("id", { count: "exact", head: true })
          .gte("last_message_at", since24),
        supabase
          .from("imphq_tasks" as any)
          .select("id", { count: "exact", head: true })
          .neq("status", "done")
          .lte("due_date", startToday.split("T")[0]),
      ]);

      const msgs = (msgsRes.data || []) as any[];
      const total = msgs.length;
      const aiCount = msgs.filter((m: any) => m.from_ai).length;
      const aiShare = total > 0 ? (aiCount / total) * 100 : 0;

      return {
        aiShare,
        totalMsgs: total,
        activeConv: activeConvRes.count || 0,
        tasksDue: tasksRes.count || 0,
      };
    },
  });

  const d = data || { aiShare: 0, totalMsgs: 0, activeConv: 0, tasksDue: 0 };

  const items = [
    { label: "IA autônoma 24h", value: `${d.aiShare.toFixed(0)}%`, meta: `${d.totalMsgs} msgs`, to: "/ai-saude" },
    { label: "Conversas ativas", value: String(d.activeConv), meta: "últimas 24h", to: "/inbox" },
    { label: "Tarefas vencidas", value: String(d.tasksDue), meta: "hoje ou antes", to: "/tarefas" },
    { label: "Recuperação", value: "Ver", meta: "boletos & pix", to: "/recuperacao" },
  ];

  return (
    <section className="border-t border-border/60 pt-4">
      <div className="text-[9px] tracking-[0.32em] uppercase text-gold/70 font-medium mb-2">
        Operação
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border/30 border border-border/40">
        {items.map((it) => (
          <Link
            key={it.label}
            to={it.to}
            className="bg-background p-3 hover:bg-secondary/20 transition-colors group"
          >
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70">
              {it.label}
            </div>
            <div
              className="text-xl italic text-foreground group-hover:text-gold transition-colors tabular-nums leading-tight mt-0.5"
              style={{ fontFamily: "Cormorant Garamond, serif" }}
            >
              {it.value}
            </div>
            <div className="text-[10px] text-muted-foreground/60 mt-0.5">{it.meta}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

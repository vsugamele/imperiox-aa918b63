import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
function useFunnelLiveActivity(projectId: string): { count: number; recent: string[] } {
  const [count, setCount] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const recentRef = useRef<{ at: number; label: string }[]>([]);

  useEffect(() => {
    if (!projectId) { setCount(0); setRecent([]); return; }

    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    let cancel = false;

    (async () => {
      const { count: c } = await supabase
        .from("imphq_funnel_events")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .gte("created_at", since);
      if (!cancel) setCount(c || 0);
    })();

    const ch = supabase
      .channel(`funnel-live-${projectId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "imphq_funnel_events", filter: `project_id=eq.${projectId}` },
        (payload) => {
          const row = payload.new || {};
          const label = `${row.step || "evento"} · ${(row.utm_source || row.utm_campaign || "direto").slice(0, 18)}`;
          recentRef.current = [{ at: Date.now(), label }, ...recentRef.current].slice(0, 8);
          setRecent(recentRef.current.map(r => r.label));
          setCount(c => c + 1);
        })
      .subscribe();

    const cleanup = setInterval(() => {
      const cutoff = Date.now() - 15 * 60 * 1000;
      recentRef.current = recentRef.current.filter(r => r.at >= cutoff);
    }, 30000);

    return () => {
      cancel = true;
      supabase.removeChannel(ch);
      clearInterval(cleanup);
    };
  }, [projectId]);

  return { count, recent };
}

export { useFunnelLiveActivity };

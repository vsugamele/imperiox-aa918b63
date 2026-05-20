import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

let cache: string[] | null = null;
let cacheAt = 0;
const TTL = 60_000;

export function useLeadTags() {
  const [tags, setTags] = useState<string[]>(cache || []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    const now = Date.now();
    if (cache && now - cacheAt < TTL) {
      setTags(cache);
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("imphq_leads")
        .select("tags")
        .not("tags", "is", null)
        .limit(5000);
      const counts = new Map<string, number>();
      (data || []).forEach((row: any) => {
        (row.tags || []).forEach((t: any) => {
          if (typeof t !== "string") return;
          const k = t.trim();
          if (!k) return;
          counts.set(k, (counts.get(k) || 0) + 1);
        });
      });
      const sorted = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([t]) => t);
      cache = sorted;
      cacheAt = Date.now();
      if (alive) {
        setTags(sorted);
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return { tags, loading };
}

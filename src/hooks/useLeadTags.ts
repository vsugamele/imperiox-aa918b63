import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LeadTagCount = { tag: string; count: number };

const cache = new Map<string, { data: LeadTagCount[]; at: number }>();
const TTL = 60_000;

export function useLeadTags(projectId?: string | null) {
  const key = projectId || "__all__";
  const cached = cache.get(key);
  const [counts, setCounts] = useState<LeadTagCount[]>(cached?.data || []);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    const now = Date.now();
    const c = cache.get(key);
    if (c && now - c.at < TTL) {
      setCounts(c.data);
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_lead_tag_counts", {
        p_project_id: projectId || null,
        p_limit: 50,
      });
      if (error) {
        console.error("[useLeadTags] rpc error", error);
        if (alive) setLoading(false);
        return;
      }
      const arr: LeadTagCount[] = (data || []).map((r: any) => ({
        tag: r.tag,
        count: Number(r.count) || 0,
      }));
      cache.set(key, { data: arr, at: Date.now() });
      if (alive) {
        setCounts(arr);
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [key, projectId]);

  return { tags: counts.map(c => c.tag), counts, loading };
}


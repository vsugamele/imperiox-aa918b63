import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { normalizeVariants, pageKey, slugify, splitReport, type PageMetricValues, type SplitVariant } from "@shared/page-split";

export const SPLIT_BASE_URL = "https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/split/";

export interface PageSplit {
  id: string; slug: string; nome: string; status: string; vencedor: string | null; created_at: string;
  link: string; variantes: SplitVariant[]; report: ReturnType<typeof splitReport>;
}

/** Testes A/B/C de página do projeto, com envios por variante e as métricas do rastreador por página. */
export function usePageSplits(projectId: string | null) {
  return useQuery({
    queryKey: ["page-splits", projectId],
    enabled: !!projectId,
    refetchInterval: 120_000,
    queryFn: async (): Promise<PageSplit[]> => {
      const { data: splits, error } = await supabase.from("imphq_page_splits").select("id, slug, nome, status, vencedor, variantes, created_at")
        .eq("project_id", projectId as string).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      if (!splits?.length) return [];
      const since = splits.reduce((m, s) => (s.created_at < m ? s.created_at : m), splits[0].created_at);
      const [countsRes, pagesRes] = await Promise.all([
        supabase.rpc("imphq_split_counts", { p_split_ids: splits.map((s) => s.id) }),
        supabase.rpc("imphq_page_metrics", { p_project_id: projectId as string, p_since: since }),
      ]);
      if (countsRes.error) throw countsRes.error;
      const counts = (countsRes.data ?? []) as Array<{ split_id: string; variante: string; enviados: number }>;
      const rawPages = !pagesRes.error && pagesRes.data && typeof pagesRes.data === "object" ? (pagesRes.data as { pages?: Array<{ url: string; values: PageMetricValues }> }).pages ?? [] : [];
      const pages: Record<string, PageMetricValues> = Object.fromEntries(rawPages.map((p) => [pageKey(p.url), p.values]));
      return splits.map((s) => {
        const variantes = normalizeVariants(s.variantes);
        const hits = Object.fromEntries(counts.filter((c) => c.split_id === s.id).map((c) => [c.variante, Number(c.enviados)]));
        return { id: s.id, slug: s.slug, nome: s.nome, status: s.status, vencedor: s.vencedor, created_at: s.created_at, link: SPLIT_BASE_URL + s.slug, variantes, report: splitReport(variantes, hits, pages) };
      });
    },
  });
}

export function useCreatePageSplit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, nome, variantes }: { projectId: string; nome: string; variantes: Array<{ url: string; peso: number }> }) => {
      const list = normalizeVariants(variantes.map((v, i) => ({ key: String.fromCharCode(65 + i), url: v.url, peso: v.peso })));
      if (list.length < 2) throw new Error("Coloque pelo menos 2 páginas com link completo (https://…)");
      const { data: auth } = await supabase.auth.getUser();
      const slug = `${slugify(nome)}-${Math.random().toString(36).slice(2, 6)}`;
      const { error } = await supabase.from("imphq_page_splits").insert({ project_id: projectId, slug, nome: nome.trim() || "Teste de página", variantes: list as unknown as Json, created_by: auth.user?.email ?? null });
      if (error) throw error;
      return SPLIT_BASE_URL + slug;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["page-splits"] }),
  });
}

export function useEndPageSplit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, vencedor }: { id: string; vencedor: string | null }) => {
      const { error } = await supabase.from("imphq_page_splits").update({ status: "encerrado", vencedor, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["page-splits"] }),
  });
}

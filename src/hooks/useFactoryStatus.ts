import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FactoryStatus } from "@/lib/creative-flow";

/** Estado de cada passo da fábrica de criativos de um projeto (UX1.2). Só contagens: leve para abrir a tela. */
export function useFactoryStatus(projectId: string | null) {
  return useQuery({
    queryKey: ["factory-status", projectId],
    enabled: !!projectId,
    refetchInterval: 30_000,
    queryFn: async (): Promise<FactoryStatus> => {
      const pid = projectId as string;
      const [cast, refs, refsOk, fontes, levas, orders] = await Promise.all([
        supabase.from("imphq_avatar_studio_projects").select("papel, avatar_photos, ativo").eq("project_id", pid),
        supabase.from("imphq_referencias").select("id", { count: "exact", head: true }).eq("project_id", pid),
        supabase.from("imphq_referencias").select("id", { count: "exact", head: true }).eq("project_id", pid).in("copy_lib_status", ["firme", "revisado"]),
        supabase.from("imphq_mining_sources").select("id", { count: "exact", head: true }).eq("project_id", pid).eq("ativo", true),
        supabase.from("imphq_creative_batches").select("status").eq("project_id", pid).eq("briefing->>tipo", "leva"),
        supabase.from("imphq_test_orders").select("id, status").eq("project_id", pid).neq("status", "cancelado"),
      ]);
      for (const r of [cast, refs, refsOk, fontes, levas, orders]) if (r.error) throw r.error;
      const ativos = (cast.data ?? []).filter((c) => c.ativo !== false);
      const visual = ativos.filter((c) => c.papel !== "publico");
      const orderIds = (orders.data ?? []).map((o) => o.id);
      const variants = orderIds.length
        ? await supabase.from("imphq_test_variants").select("status, molde_variacao").in("order_id", orderIds)
        : { data: [] as Array<{ status: string; molde_variacao: string | null }>, error: null };
      if (variants.error) throw variants.error;
      const levaStatus = (st: string) => (levas.data ?? []).filter((l) => l.status === st).length;
      return {
        elenco: {
          visual: visual.length,
          comFoto: visual.filter((c) => Array.isArray(c.avatar_photos) && c.avatar_photos.length > 0).length,
          persona: ativos.filter((c) => c.papel === "publico" || c.papel === "ambos").length,
        },
        mercado: { referencias: refs.count ?? 0, classificadas: refsOk.count ?? 0, fontes: fontes.count ?? 0 },
        levas: { planejadas: levaStatus("planejado"), aprovadas: levaStatus("aprovado"), gerando: levaStatus("processing"), prontas: levaStatus("completed") },
        testes: { noAr: (orders.data ?? []).filter((o) => o.status === "no_ar").length, total: (orders.data ?? []).length },
        placar: {
          vencedores: (variants.data ?? []).filter((v) => v.status === "vencedor").length,
          moldes: (variants.data ?? []).filter((v) => v.molde_variacao === "V00").length,
        },
      };
    },
  });
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildProjectMap, type ProjectMap, type ProjectMapInput } from "@shared/project-map";

const DAY = 24 * 60 * 60 * 1000;

async function countRows(query: PromiseLike<{ count: number | null; error: unknown }>): Promise<number> {
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function loadCompanyMap(): Promise<ProjectMap[]> {
  const since30d = new Date(Date.now() - 30 * DAY).toISOString();
  const since7d = new Date(Date.now() - 7 * DAY).toISOString();

  const [projectsRes, competitorsRes, nodesRes, salesRes, providersRes, aiRes] = await Promise.all([
    supabase.from("imphq_projects").select("id, name, data, avatar").or("is_archived.eq.false,is_archived.is.null").order("name"),
    supabase.from("imphq_competitors").select("project_id, name, url, oferta_principal, preco, mecanismo_unico, headline, paginas_funil"),
    supabase.from("imphq_company_map_nodes").select("linked_project_id, label, url, kind").not("linked_project_id", "is", null),
    supabase.from("imphq_vendas").select("project_id, produto_nome").eq("status", "aprovado").gte("created_at", since30d),
    supabase.from("imphq_wa_providers").select("project_id, is_active"),
    supabase.from("imphq_wa_ai_config").select("project_id, enabled, draft_mode"),
  ]);
  for (const res of [projectsRes, competitorsRes, nodesRes, salesRes, providersRes, aiRes]) {
    if (res.error) throw res.error;
  }

  const projects = projectsRes.data ?? [];
  const activityCounts = await Promise.all(projects.map(async (p) => {
    const [incoming, outgoing, events] = await Promise.all([
      countRows(supabase.from("imphq_wa_messages").select("id", { count: "exact", head: true }).eq("project_id", p.id).eq("direction", "incoming").gte("created_at", since30d)),
      countRows(supabase.from("imphq_wa_messages").select("id", { count: "exact", head: true }).eq("project_id", p.id).eq("direction", "outgoing").gte("created_at", since30d)),
      countRows(supabase.from("imphq_funnel_events").select("id", { count: "exact", head: true }).eq("project_id", p.id).gte("created_at", since7d)),
    ]);
    return { incoming, outgoing, events };
  }));

  return projects.map((project, index): ProjectMap => {
    const sales: Record<string, number> = {};
    for (const sale of salesRes.data ?? []) {
      if (sale.project_id !== project.id || !sale.produto_nome) continue;
      sales[sale.produto_nome] = (sales[sale.produto_nome] ?? 0) + 1;
    }
    const aiConfigs = (aiRes.data ?? []).filter((c) => c.project_id === project.id);
    const input: ProjectMapInput = {
      project,
      competitors: (competitorsRes.data ?? []).filter((c) => c.project_id === project.id),
      mapNodes: (nodesRes.data ?? []).filter((n) => n.linked_project_id === project.id),
      activity: {
        approvedSales30dByProduct: sales,
        waIncoming30d: activityCounts[index].incoming,
        waOutgoing30d: activityCounts[index].outgoing,
        funnelEvents7d: activityCounts[index].events,
        activeWaProviders: (providersRes.data ?? []).filter((p) => p.project_id === project.id && p.is_active).length,
        aiEnabled: aiConfigs.length ? aiConfigs.some((c) => c.enabled) : null,
        aiDraftMode: aiConfigs.length ? aiConfigs.every((c) => c.draft_mode) : null,
      },
    };
    return buildProjectMap(input);
  });
}

/** Mapa da Empresa: todos os projetos ativos lidos pela regra única de `@shared/project-map`. */
export function useCompanyMap() {
  return useQuery({
    queryKey: ["company-map"],
    queryFn: loadCompanyMap,
    staleTime: 5 * 60_000,
  });
}

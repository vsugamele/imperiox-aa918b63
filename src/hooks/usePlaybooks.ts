import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { planPlaybook, type Playbook } from "@shared/playbooks";
import { playbookFromRows, writePlaybookPlan, type ApplyResult } from "@shared/playbook-apply";

export interface PlaybookApplication { id: string; playbook_id: string; project_id: string; map_id: string; status: string; created_at: string }
export interface PlaybookLibrary { playbooks: Playbook[]; applications: PlaybookApplication[] }

async function loadPlaybooks(): Promise<PlaybookLibrary> {
  const [pbRes, stRes, apRes] = await Promise.all([
    supabase.from("imphq_playbooks").select("*").eq("ativo", true).order("familia"),
    supabase.from("imphq_playbook_steps").select("*").order("ordem"),
    supabase.from("imphq_playbook_applications").select("id, playbook_id, project_id, map_id, status, created_at").order("created_at", { ascending: false }),
  ]);
  for (const res of [pbRes, stRes, apRes]) if (res.error) throw res.error;
  const steps = stRes.data ?? [];
  return {
    playbooks: (pbRes.data ?? []).map((row) => playbookFromRows(row, steps.filter((s) => s.playbook_id === row.id))),
    applications: apRes.data ?? [],
  };
}

/** Biblioteca de estratégias (imphq_playbooks) com onde cada uma já foi aplicada. */
export function usePlaybooks() {
  return useQuery({ queryKey: ["playbooks"], queryFn: loadPlaybooks, staleTime: 5 * 60_000 });
}

export interface MapContext {
  nodes: Array<{ id: string; label: string; kind: string; position: { x?: number; y?: number } | null; height: number | null }>;
  frames: Array<{ y: number; height: number }>;
  edges: Set<string>;
}

async function loadMapContext(mapId: string): Promise<MapContext> {
  const [nodesRes, framesRes, edgesRes] = await Promise.all([
    supabase.from("imphq_company_map_nodes").select("id, label, kind, position, height").eq("map_id", mapId),
    supabase.from("imphq_company_map_annotations").select("y, height").eq("map_id", mapId).eq("kind", "frame"),
    supabase.from("imphq_company_map_edges").select("source_id, target_id").eq("map_id", mapId),
  ]);
  for (const res of [nodesRes, framesRes, edgesRes]) if (res.error) throw res.error;
  return {
    nodes: (nodesRes.data ?? []).map((n) => ({
      id: n.id, label: n.label, kind: n.kind, height: n.height,
      position: n.position && typeof n.position === "object" && !Array.isArray(n.position) ? n.position as { x?: number; y?: number } : null,
    })),
    frames: framesRes.data ?? [],
    edges: new Set((edgesRes.data ?? []).map((e) => `${e.source_id}>${e.target_id}`)),
  };
}

/** Etapas, seções e setas atuais do mapa: base da prévia (o plano é recalculado na tela, sem gravar nada). */
export function useMapContext(mapId: string | null) {
  return useQuery({ queryKey: ["playbook-map-context", mapId], enabled: !!mapId, queryFn: () => loadMapContext(mapId as string) });
}

export interface ProjectOption { id: string; name: string }
export interface MapOption { id: string; name: string; archived_at: string | null }

/** Projetos ativos e mapas, para escolher onde aplicar. */
export function useProjectsAndMaps() {
  return useQuery({
    queryKey: ["playbook-targets"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<{ projects: ProjectOption[]; maps: MapOption[] }> => {
      const [projRes, mapsRes] = await Promise.all([
        supabase.from("imphq_projects").select("id, name").or("is_archived.eq.false,is_archived.is.null").order("name"),
        supabase.from("imphq_company_maps").select("id, name, archived_at").order("name"),
      ]);
      for (const res of [projRes, mapsRes]) if (res.error) throw res.error;
      return { projects: projRes.data ?? [], maps: (mapsRes.data ?? []).filter((m) => !m.archived_at) };
    },
  });
}

interface ApplyInput { playbook: Playbook; projectId: string; mapId: string; params: Record<string, string> }

/** Faz backup do mapa e desenha o playbook (mesma regra do apply_playbook do MCP). */
export function useApplyPlaybook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ playbook, projectId, mapId, params }: ApplyInput): Promise<ApplyResult> => {
      // Lê o mapa de novo na hora de gravar: a prévia pode estar velha.
      const ctx = await loadMapContext(mapId);
      const plan = planPlaybook(playbook, ctx, params);
      const { error: snapErr } = await supabase.rpc("imphq_snapshot_company_map", { p_map_id: mapId, p_reason: `Antes de aplicar o playbook ${playbook.id} (tela Estratégias)` });
      if (snapErr) throw snapErr;
      const { data: auth } = await supabase.auth.getUser();
      return writePlaybookPlan(plan, {
        playbook, mapId, projectId, params, appliedBy: auth.user?.email ?? "tela",
        existingEdges: ctx.edges, newId: () => crypto.randomUUID(),
      }, {
        insertFrame: async (row) => { const { error } = await supabase.from("imphq_company_map_annotations").insert(row); if (error) throw error; },
        insertNode: async (row) => {
          const { data, error } = await supabase.from("imphq_company_map_nodes").insert(row).select("id").single();
          if (error) throw error;
          return data.id;
        },
        insertEdge: async (row) => { const { error } = await supabase.from("imphq_company_map_edges").insert(row); if (error) throw error; },
        insertApplication: async (row) => { const { error } = await supabase.from("imphq_playbook_applications").insert(row); if (error) throw error; },
      });
    },
    onSuccess: () => {
      for (const key of ["playbooks", "playbook-map-context", "today-board", "company-map"]) qc.invalidateQueries({ queryKey: [key] });
    },
  });
}

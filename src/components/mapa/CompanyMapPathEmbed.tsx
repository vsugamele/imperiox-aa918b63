import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Layers, Loader2, Map as MapIcon, Plus, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { MapPathView, type PathRole } from "@/components/funis/MapPathView";
import { useMapPathMetrics } from "@/hooks/useMapPathMetrics";
import { nodeMetricSnapshot } from "@/lib/map-stage-metrics";
import { localDate } from "@shared/map-steps";
import type { MapNode, ChecklistItem } from "@/components/funis/map-node-model";

interface ProjectItem {
  id: string;
  name: string;
  score?: number;
}

interface CompanyMapPathEmbedProps {
  projects: ProjectItem[];
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  operationMapIdsByProject?: Record<string, string>;
}

export function CompanyMapPathEmbed({
  projects,
  selectedProjectId,
  onSelectProject,
  operationMapIdsByProject = {},
}: CompanyMapPathEmbedProps) {
  const activeProjectId = selectedProjectId || projects[0]?.id || null;
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  const [mapId, setMapId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [edges, setEdges] = useState<Array<{ source: string; target: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // Load or discover the map for the active project
  useEffect(() => {
    if (!activeProjectId) {
      setMapId(null);
      setNodes([]);
      setEdges([]);
      return;
    }

    let isMounted = true;
    setLoading(true);

    (async () => {
      try {
        // 1. Check if known from operationMapIdsByProject
        let targetMapId = operationMapIdsByProject[activeProjectId] || null;

        // 2. If not known, search imphq_company_maps by project name
        if (!targetMapId && activeProject) {
          const { data: maps } = await supabase
            .from("imphq_company_maps")
            .select("id, name, updated_at")
            .is("archived_at", null)
            .ilike("name", `%${activeProject.name}%`)
            .order("updated_at", { ascending: false })
            .limit(1);

          if (maps && maps.length > 0) {
            targetMapId = maps[0].id;
          }
        }

        // 3. Fallback: most recently updated map
        if (!targetMapId) {
          const { data: maps } = await supabase
            .from("imphq_company_maps")
            .select("id, name, updated_at")
            .is("archived_at", null)
            .order("updated_at", { ascending: false })
            .limit(1);

          if (maps && maps.length > 0) {
            targetMapId = maps[0].id;
          }
        }

        if (!targetMapId) {
          if (isMounted) {
            setMapId(null);
            setNodes([]);
            setEdges([]);
            setLoading(false);
          }
          return;
        }

        // Load nodes and edges
        const [{ data: nData }, { data: eData }] = await Promise.all([
          supabase.from("imphq_company_map_nodes").select("*").eq("map_id", targetMapId),
          supabase.from("imphq_company_map_edges").select("*").eq("map_id", targetMapId),
        ]);

        if (isMounted) {
          setMapId(targetMapId);
          setNodes((nData || []).map((n) => {
            const pos = n.position && typeof n.position === "object" && !Array.isArray(n.position) ? (n.position as { x?: number; y?: number }) : { x: 0, y: 0 };
            const checklistItems: ChecklistItem[] = Array.isArray(n.checklist)
              ? (n.checklist as Array<Record<string, unknown>>).map((it, idx) => ({
                  id: typeof it?.id === "string" ? it.id : String(idx),
                  text: typeof it?.text === "string" ? it.text : String(it || ""),
                  done: Boolean(it?.done),
                }))
              : [];
            return {
              id: n.id,
              map_id: n.map_id,
              label: n.label,
              kind: n.kind,
              color: n.color || "#fff",
              position: { x: Number(pos.x) || 0, y: Number(pos.y) || 0 },
              size: (n.size as MapNode["size"]) || "M",
              description: n.description,
              notes: n.notes,
              url: n.url,
              linked_project_id: n.linked_project_id || activeProjectId,
              metrics_target: n.metrics_target,
              step_status: n.step_status,
              path_role: n.path_role,
              checklist: checklistItems,
            };
          }));
          setEdges((eData || []).map((e) => ({ source: e.source_id, target: e.target_id })));
          setLoading(false);
        }
      } catch (err) {
        console.error("Erro ao carregar mapa operacional:", err);
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [activeProjectId, activeProject?.name, operationMapIdsByProject]);

  // Real-time project metrics
  const pathProjectIds = useMemo(() => {
    const ids = new Set<string>();
    if (activeProjectId) ids.add(activeProjectId);
    nodes.forEach((n) => {
      if (n.linked_project_id) ids.add(n.linked_project_id);
    });
    return [...ids];
  }, [activeProjectId, nodes]);

  const pathMetrics = useMapPathMetrics(pathProjectIds, pathProjectIds.length > 0);
  const pathMetricsByNode = useMemo(() => {
    return Object.fromEntries(
      nodes.map((node) => [node.id, nodeMetricSnapshot(node, pathMetrics.data ?? {})])
    );
  }, [nodes, pathMetrics.data]);

  // Role toggle
  const handleSetRole = async (nodeId: string, role: PathRole) => {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, path_role: role } : n)));
    await supabase.from("imphq_company_map_nodes").update({ path_role: role }).eq("id", nodeId);
  };

  // Create map for active project
  const handleCreateProjectMap = async () => {
    if (!activeProject) return;
    setCreating(true);
    try {
      const mapName = `Mapa · ${activeProject.name}`;
      const { data: newMap, error: mapErr } = await supabase
        .from("imphq_company_maps")
        .insert({ name: mapName })
        .select("id, name")
        .single();

      if (mapErr || !newMap) throw mapErr;

      // Seed canonical starter nodes (Aquisição -> VSL -> Checkout -> Compra)
      const starterNodes = [
        {
          map_id: newMap.id,
          label: "Meta Ads (Criativos de Escala)",
          kind: "meta_ads",
          color: "#3b82f6",
          position: { x: 100, y: 100 },
          linked_project_id: activeProject.id,
          step_status: "in_progress",
          path_role: "principal",
          description: "O QUÊ: Anúncios pagos Meta\nSAÍDA: 3 criativos validados rodando abaixo do CPA alvo",
          checklist: [],
        },
        {
          map_id: newMap.id,
          label: "VSL / Página de Oferta",
          kind: "vsl",
          color: "#8b5cf6",
          position: { x: 400, y: 100 },
          linked_project_id: activeProject.id,
          step_status: "pending",
          path_role: "principal",
          metrics_target: { key: "taxa_clique_cta", meta: "acima de 8%" },
          description: "O QUÊ: Página principal com VSL e mecanismo\nSAÍDA: Taxa de clique no CTA > 8%",
          checklist: [],
        },
        {
          map_id: newMap.id,
          label: "Checkout",
          kind: "checkout",
          color: "#f59e0b",
          position: { x: 700, y: 100 },
          linked_project_id: activeProject.id,
          step_status: "pending",
          path_role: "principal",
          description: "O QUÊ: Checkout do produto principal\nSAÍDA: Conversão de checkout > 15%",
          checklist: [],
        },
        {
          map_id: newMap.id,
          label: "Venda Aprovada",
          kind: "compra",
          color: "#10b981",
          position: { x: 1000, y: 100 },
          linked_project_id: activeProject.id,
          step_status: "pending",
          path_role: "principal",
          metrics_target: { key: "cpa", meta: "até o CPA alvo" },
          description: "O QUÊ: Confirmação e entrega do produto\nSAÍDA: CPA médio lucrativo e ROAS sustentável",
          checklist: [],
        },
      ];

      const { data: createdNodes, error: nodeErr } = await supabase
        .from("imphq_company_map_nodes")
        .insert(starterNodes)
        .select("*");

      if (nodeErr || !createdNodes) throw nodeErr;

      // Seed connecting edges
      const starterEdges = [
        { map_id: newMap.id, source_id: createdNodes[0].id, target_id: createdNodes[1].id, source_kind: "step", target_kind: "step" },
        { map_id: newMap.id, source_id: createdNodes[1].id, target_id: createdNodes[2].id, source_kind: "step", target_kind: "step" },
        { map_id: newMap.id, source_id: createdNodes[2].id, target_id: createdNodes[3].id, source_kind: "step", target_kind: "step" },
      ];

      await supabase.from("imphq_company_map_edges").insert(starterEdges);

      setMapId(newMap.id);
      setNodes(createdNodes.map((n) => {
        const pos = n.position && typeof n.position === "object" && !Array.isArray(n.position) ? (n.position as { x?: number; y?: number }) : { x: 0, y: 0 };
        return {
          id: n.id,
          map_id: n.map_id,
          label: n.label,
          kind: n.kind,
          color: n.color || "#fff",
          position: { x: Number(pos.x) || 0, y: Number(pos.y) || 0 },
          size: "M",
          description: n.description,
          notes: n.notes,
          linked_project_id: activeProject.id,
          step_status: n.step_status,
          path_role: n.path_role,
          checklist: [],
        };
      }));
      setEdges(starterEdges.map((e) => ({ source: e.source_id, target: e.target_id })));
    } catch (err) {
      console.error("Erro ao criar mapa do projeto:", err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Seletor de Projetos com Pills Rápidas */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-card/60 p-2.5 backdrop-blur">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-1.5 flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5 text-primary" /> Operação:
          </span>
          {projects.map((proj) => {
            const isSelected = proj.id === activeProjectId;
            return (
              <button
                key={proj.id}
                type="button"
                onClick={() => onSelectProject(proj.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                  isSelected
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <span>{proj.name}</span>
                {proj.score !== undefined && (
                  <span className={cn(
                    "rounded px-1.5 py-0.2 text-[10px] font-mono",
                    isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-secondary text-muted-foreground"
                  )}>
                    {proj.score}%
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {mapId && (
          <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs">
            <Link to={`/funis?view=mapa&map=${mapId}`}>
              <Layers className="h-3.5 w-3.5" /> Abrir no Canvas 2D
            </Link>
          </Button>
        )}
      </div>

      {/* Conteúdo do Caminho */}
      {loading ? (
        <div className="flex h-96 items-center justify-center gap-2 rounded-xl border border-border/60 bg-card/20 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" /> Lendo o caminho operacional do projeto...
        </div>
      ) : nodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card/30 p-12 text-center">
          <div className="rounded-full bg-primary/10 p-3 mb-3">
            <MapIcon className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            {activeProject ? `Mapa de ${activeProject.name}` : "Nenhum mapa encontrado"}
          </h3>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">
            Este projeto ainda não possui um mapa operacional de funil configurado. Crie uma estrutura básica em 1 clique para acompanhar as métricas em linha.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 justify-center">
            <Button size="sm" onClick={handleCreateProjectMap} disabled={creating} className="gap-1.5">
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Criar Estrutura Inicial do Funil
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/funis?view=mapa">
                <MapIcon className="mr-1.5 h-3.5 w-3.5" /> Montar no Canvas
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative min-h-[680px] rounded-xl border border-border/80 bg-card/40 shadow-sm overflow-hidden">
          <MapPathView
            nodes={nodes}
            edges={edges}
            today={localDate()}
            metricsByNode={pathMetricsByNode}
            projectMetrics={pathMetrics.data}
            onOpen={(id) => {
              // Redirect to canvas focused on that node
              if (mapId) {
                window.location.href = `/funis?view=mapa&map=${mapId}&node=${id}`;
              }
            }}
            onSetRole={handleSetRole}
            onSwitchToCanvas={mapId ? () => {
              window.location.href = `/funis?view=mapa&map=${mapId}`;
            } : undefined}
          />
        </div>
      )}
    </div>
  );
}

import type { Json } from "@/integrations/supabase/types";
import type { NodeStats } from "@/hooks/useCompanyMapLiveStats";
import type { TacticalLens } from "@/components/funis/CompanyMapTacticalBar";

export interface ChecklistItem { id: string; text: string; done: boolean }

export interface MapNode {
  id: string; map_id: string; label: string; kind: string; color: string;
  description?: string | null; notes?: string | null; url?: string | null;
  image_url?: string | null;
  position: { x: number; y: number }; size: string;
  width?: number | null; height?: number | null;
  checklist: ChecklistItem[];
  show_live_kpis?: boolean;
  linked_funnel_id?: string | null; linked_project_id?: string | null; linked_flow_id?: string | null;
  linked_wa_provider_id?: string | null;
  stage_role?: string | null;
  executor_type?: string | null;
  linked_skill_id?: string | null;
  api_binding?: Json | null;
  metrics_target?: Json | null;
  /** Último print automático da página (scripts/map-prints.mjs). */
  print_meta?: Json | null;
  /** Status declarado (null = não declarado), dono e prazo — UX1.1. */
  step_status?: string | null;
  owner_member_id?: string | null;
  due_date?: string | null;
  status_changed_at?: string | null;
  status_changed_by?: string | null;
  /** Ajuste manual da visão Caminho: principal, alternativa ou null (automático) — MAP2.3. */
  path_role?: string | null;
}

export interface MapNodeData extends MapNode {
  onGenerateCopy?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
  onToggleItem?: (id: string, itemId: string, done: boolean) => void;
  waInfo?: { phone?: string; instance?: string; provider: string; conversations?: number } | null;
  liveStats?: NodeStats | null;
  activeLens?: TacticalLens;
  isSimulatedActive?: boolean;
  /** Posição da etapa na ordem do fluxo (seguindo as setas); ausente em cartões fora do fluxo. */
  stepNumber?: number | null;
}

export const SIZE_PRESETS: Record<string, { min: number; max: number; label: string }> = {
  S: { min: 200, max: 240, label: "Pequeno" },
  M: { min: 240, max: 290, label: "Médio" },
  L: { min: 290, max: 360, label: "Grande" },
  XL: { min: 360, max: 460, label: "Extra" },
};

export function matchesLens(node: { label: string; kind: string; notes?: string | null; description?: string | null }, lens: TacticalLens): boolean {
  if (lens === "all") return true;
  const text = `${node.label} ${node.description || ""} ${node.notes || ""}`.toLowerCase();
  if (lens === "jp") {
    return text.includes("jp") || text.includes("corte") || text.includes("barbeiro") || text.includes("webinar") || text.includes("formação") || text.includes("10k");
  }
  if (lens === "bifi") {
    return text.includes("bifi") || text.includes("linfa") || text.includes("slimsoda") || text.includes("suplement") || text.includes("pdp") || text.includes("advertorial") || text.includes("vsl");
  }
  if (lens === "geelark") {
    return text.includes("geelark") || text.includes("phone") || text.includes("celular") || text.includes("perfil") || text.includes("instagram") || text.includes("tiktok") || text.includes("reel") || text.includes("orgânic");
  }
  if (lens === "infra") {
    return text.includes("evolution") || text.includes("zernio") || text.includes("n8n") || text.includes("kiwify") || text.includes("ticto") || text.includes("webhook") || text.includes("api") || text.includes("openrouter");
  }
  return true;
}

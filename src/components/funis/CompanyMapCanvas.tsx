import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  addEdge, applyEdgeChanges, applyNodeChanges,
  type Node, type Edge, type Connection, type NodeChange, type EdgeChange,
  Handle, Position, useReactFlow, NodeResizer,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Plus, Trash2, Save, Building2, Target, Users, Megaphone, ShoppingCart, Wrench, FileText, Link2, X, Check, Wand2, LayoutGrid, Download, Sparkles, TrendingUp, ListChecks, Copy, MousePointer, Pencil, Instagram, Facebook, Youtube, Twitter, Linkedin, Music2, GraduationCap, Smartphone, MessageCircle, Phone, Square, StickyNote, Type, ArrowUpRight, ChevronsUp, ChevronsDown, ChevronsLeft, ChevronsRight, Film, Globe, MousePointerClick, Mail, CreditCard, TrendingDown, PackagePlus, Palette, ExternalLink, Image as ImageIcon, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAP_TEMPLATES } from "./mapTemplates";
import { applyTemplate, autopopulateFromBusiness, autopopulateFromProject, autoLayout, exportMapPng } from "./companyMapHelpers";
import { useCompanyMapLiveStats, pickKpiForKind } from "@/hooks/useCompanyMapLiveStats";
import { NodeCopyDialog } from "./NodeCopyDialog";
import { annotationNodeTypes, ANNOTATION_DEFAULTS, ANNOTATION_KIND_TO_TYPE, type AnnotationKind, type AnnotationData } from "./MapAnnotationNodes";
import { StrategicGapsPanel } from "./StrategicGapsPanel";


const KIND_PRESETS: Record<string, { label: string; color: string; icon: any }> = {
  vertical:      { label: "Vertical / Unidade",  color: "#c9922a", icon: Building2 },
  area:          { label: "Área / Time",         color: "#3b82f6", icon: Users },
  oferta:        { label: "Oferta / Produto",    color: "#10b981", icon: ShoppingCart },
  processo:      { label: "Processo",            color: "#8b5cf6", icon: Wrench },
  meta:          { label: "Meta / KPI",          color: "#ef4444", icon: Target },
  doc:           { label: "Documento",           color: "#64748b", icon: FileText },
  // Estratégia de vendas
  vsl:           { label: "VSL",                 color: "#ec4899", icon: Film },
  pagina_vendas: { label: "Página de Vendas",    color: "#f97316", icon: Globe },
  captura:       { label: "Captura / Optin",     color: "#06b6d4", icon: MousePointerClick },
  checkout:      { label: "Checkout",            color: "#84cc16", icon: CreditCard },
  orderbump:     { label: "Orderbump",           color: "#fbbf24", icon: PackagePlus },
  upsell:        { label: "Upsell",              color: "#22c55e", icon: TrendingUp },
  downsell:      { label: "Downsell",            color: "#f43f5e", icon: TrendingDown },
  email:         { label: "E-mail / Nurture",    color: "#818cf8", icon: Mail },
  anuncio:       { label: "Anúncio / Tráfego",   color: "#eab308", icon: Target },
  // Produtos digitais
  area_membros:  { label: "Área de Membros",     color: "#a855f7", icon: GraduationCap },
  app:           { label: "APP / Produto",       color: "#0ea5e9", icon: Smartphone },
  // Canais
  canal:         { label: "Canal (genérico)",    color: "#f59e0b", icon: Megaphone },
  whatsapp:      { label: "WhatsApp",            color: "#25d366", icon: MessageCircle },
  // Redes sociais
  instagram:     { label: "Instagram",           color: "#e1306c", icon: Instagram },
  facebook:      { label: "Facebook",            color: "#1877f2", icon: Facebook },
  youtube:       { label: "YouTube",             color: "#ff0000", icon: Youtube },
  tiktok:        { label: "TikTok",              color: "#000000", icon: Music2 },
  linkedin:      { label: "LinkedIn",            color: "#0a66c2", icon: Linkedin },
  twitter:       { label: "X / Twitter",         color: "#1da1f2", icon: Twitter },
  // Mídia
  imagem:        { label: "Imagem",               color: "#c9922a", icon: ImageIcon },
};

const KIND_CATEGORIES: { label: string; keys: string[] }[] = [
  { label: "Estrutura",         keys: ["vertical", "area", "processo", "meta", "doc"] },
  { label: "Estratégia de Vendas", keys: ["captura", "vsl", "pagina_vendas", "checkout", "orderbump", "upsell", "downsell", "email", "anuncio"] },
  { label: "Ofertas & Produto", keys: ["oferta", "area_membros", "app"] },
  { label: "Canais",            keys: ["whatsapp", "canal"] },
  { label: "Redes Sociais",     keys: ["instagram", "facebook", "youtube", "tiktok", "linkedin", "twitter"] },
  { label: "Mídia",             keys: ["imagem"] },
];

const SIZE_PRESETS: Record<string, { min: number; max: number; label: string }> = {
  S: { min: 160, max: 200, label: "Pequeno" },
  M: { min: 200, max: 260, label: "Médio" },
  L: { min: 260, max: 340, label: "Grande" },
  XL:{ min: 340, max: 440, label: "Extra" },
};

const COLOR_PALETTE = [
  "#c9922a", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444", "#64748b",
  "#ec4899", "#f97316", "#06b6d4", "#84cc16", "#fbbf24", "#22c55e",
  "#f43f5e", "#818cf8", "#eab308", "#a855f7", "#0ea5e9", "#f59e0b",
  "#25d366", "#e1306c", "#1877f2", "#ff0000",
];

interface ChecklistItem { id: string; text: string; done: boolean; }
interface MapNode {
  id: string; map_id: string; label: string; kind: string; color: string;
  description?: string | null; notes?: string | null; url?: string | null;
  image_url?: string | null;
  position: { x: number; y: number }; size: string;
  width?: number | null; height?: number | null;
  checklist: ChecklistItem[];
  show_live_kpis?: boolean;
  linked_funnel_id?: string | null; linked_project_id?: string | null; linked_flow_id?: string | null;
  linked_wa_provider_id?: string | null;
}

// Helpers for image nodes
async function pickImageFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*";
    inp.onchange = () => resolve(inp.files?.[0] || null);
    (inp as any).oncancel = () => resolve(null);
    inp.click();
  });
}

async function uploadMapImage(mapId: string, file: File): Promise<string | null> {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${mapId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from("company-map-images").upload(path, file, {
    upsert: false, contentType: file.type || undefined,
  });
  if (upErr) { toast.error("Erro ao enviar imagem"); return null; }
  // Long-lived signed URL (10 years) — bucket is private
  const { data, error } = await supabase.storage
    .from("company-map-images")
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (error || !data?.signedUrl) { toast.error("Erro ao gerar URL da imagem"); return null; }
  return data.signedUrl;
}

function MapNodeCard({ data, selected }: { data: any; selected?: boolean }) {
  const preset = KIND_PRESETS[data.kind] || KIND_PRESETS.canal;
  const Icon = preset.icon;
  const checklist: ChecklistItem[] = data.checklist || [];
  const done = checklist.filter((c) => c.done).length;
  const total = checklist.length;
  const preview = checklist.slice(0, 3);
  const rest = Math.max(0, total - preview.length);
  const waInfo = data.waInfo; // { phone, instance, provider, conversations }
  const sizeCfg = SIZE_PRESETS[data.size || "M"] || SIZE_PRESETS.M;
  const url: string | null = data.url || null;
  const hasCustomSize = !!(data.width && data.height);
  return (
    <div
      className="group relative rounded-xl border-2 bg-card/95 backdrop-blur px-3 py-2 shadow-lg hover:shadow-xl transition-all cursor-pointer overflow-hidden"
      style={
        hasCustomSize
          ? { borderColor: data.color, width: "100%", height: "100%" }
          : { borderColor: data.color, minWidth: sizeCfg.min, maxWidth: sizeCfg.max }
      }
    >
      <NodeResizer
        isVisible={selected}
        minWidth={140}
        minHeight={60}
        lineClassName="!border-primary/60"
        handleClassName="!bg-primary !border-primary !w-2 !h-2"
      />
      <Handle type="target" position={Position.Top} style={{ background: data.color }} />

      {/* Quick actions on hover */}
      <div className="nodrag absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-card border border-border/60 rounded-md shadow-lg p-0.5 z-10">
        <button
          className="p-1 rounded hover:bg-pink-500/20 text-muted-foreground hover:text-pink-400"
          onClick={(e) => { e.stopPropagation(); data.onGenerateCopy?.(data.id); }}
          title="Gerar copy IA para este nó"
        >
          <Sparkles className="h-3 w-3" />
        </button>
        <button
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          onClick={(e) => { e.stopPropagation(); data.onDuplicate?.(data.id); }}
          title="Duplicar"
        >
          <Copy className="h-3 w-3" />
        </button>
        <button
          className="p-1 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400"
          onClick={(e) => { e.stopPropagation(); data.onDelete?.(data.id); }}
          title="Excluir"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>


      <div className="flex items-center gap-2 mb-1">
        <div className="p-1 rounded" style={{ background: `${data.color}20`, color: data.color }}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{preset.label}</span>
      </div>
      <p className="text-sm font-medium leading-snug">{data.label}</p>
      {data.kind === "imagem" && data.image_url && (
        <img
          src={data.image_url}
          alt={data.label}
          className={cn(
            "mt-2 w-full rounded border border-border/30 object-cover",
            hasCustomSize ? "flex-1 h-auto max-h-full" : "max-h-64"
          )}
          draggable={false}
        />
      )}
      {data.description && <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{data.description}</p>}
      {url && (
        <a
          href={url} target="_blank" rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="nodrag mt-1 inline-flex items-center gap-1 text-[10px] text-primary hover:underline truncate max-w-full"
        >
          <ExternalLink className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{url.replace(/^https?:\/\//, "")}</span>
        </a>
      )}

      {/* WhatsApp channel enrichment */}
      {waInfo && (
        <div className="mt-2 pt-2 border-t border-border/40 space-y-0.5">
          {waInfo.phone && (
            <div className="flex items-center gap-1 text-[10px] text-emerald-400">
              <Phone className="h-2.5 w-2.5" /> {waInfo.phone}
            </div>
          )}
          {waInfo.instance && (
            <div className="text-[9px] text-muted-foreground truncate">📱 {waInfo.instance}</div>
          )}
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">{waInfo.provider || "wa"}</span>
            {typeof waInfo.conversations === "number" && (
              <Badge variant="outline" className="h-4 px-1 text-[9px]">{waInfo.conversations} conv.</Badge>
            )}
          </div>
        </div>
      )}

      {total > 0 && (
        <div className="mt-2 pt-2 border-t border-border/40">
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="text-muted-foreground flex items-center gap-1"><ListChecks className="h-3 w-3" /> Checklist</span>
            <Badge variant="outline" className="text-[9px] h-4 px-1">{done}/{total}</Badge>
          </div>
          <div className="space-y-0.5 nodrag">
            {preview.map((c) => (
              <label
                key={c.id}
                className="flex items-start gap-1.5 text-[10px] leading-tight cursor-pointer hover:bg-white/5 rounded px-1 py-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={c.done}
                  className="h-3 w-3 mt-0.5"
                  onCheckedChange={(v) => data.onToggleItem?.(data.id, c.id, !!v)}
                />
                <span className={c.done ? "line-through text-muted-foreground" : ""}>{c.text || "—"}</span>
              </label>
            ))}
            {rest > 0 && <div className="text-[9px] text-muted-foreground pl-5">+{rest} itens</div>}
          </div>
        </div>
      )}
      {(() => {
        const kpi = pickKpiForKind(data.kind, data.liveStats);
        if (!kpi) return null;
        const toneClass = kpi.tone === "good" ? "text-emerald-400" : kpi.tone === "warn" ? "text-amber-400" : kpi.tone === "bad" ? "text-red-400" : "text-muted-foreground";
        const dotClass = kpi.tone === "good" ? "bg-emerald-400" : kpi.tone === "warn" ? "bg-amber-400" : kpi.tone === "bad" ? "bg-red-400" : "bg-muted-foreground";
        return (
          <div className="mt-1.5 pt-1.5 border-t border-border/40 flex items-center justify-between text-[10px]">
            <span className={`${toneClass} font-medium flex items-center gap-1`}>
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotClass}`} />
              {kpi.primary}
            </span>
            <span className="text-muted-foreground">{kpi.secondary}</span>
          </div>
        );
      })()}
      <Handle type="source" position={Position.Bottom} style={{ background: data.color }} />
    </div>
  );
}

const nodeTypes = { mapnode: MapNodeCard, ...annotationNodeTypes };

interface MapAnnotation {
  id: string; map_id: string; kind: AnnotationKind;
  x: number; y: number; width: number; height: number;
  text: string; style: AnnotationData["style"]; z_index: number;
}
const ANN_PREFIX = "ann-";
const annTable = "imphq_company_map_annotations" as any;

interface WaProvider {
  id: string; project_id: string; provider: string;
  display_name?: string | null; instance_name?: string | null;
  phone_number_id?: string | null; twilio_from?: string | null;
  is_active?: boolean | null;
}

function InnerMap({ projects }: { projects: any[] }) {
  const [mapId, setMapId] = useState<string | null>(null);
  const [maps, setMaps] = useState<{ id: string; name: string }[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [rawNodes, setRawNodes] = useState<MapNode[]>([]);
  const [selected, setSelected] = useState<MapNode | null>(null);
  const [funis, setFunis] = useState<{ id: string; nome: string }[]>([]);
  const [flows, setFlows] = useState<{ id: string; name: string }[]>([]);
  const [waProviders, setWaProviders] = useState<WaProvider[]>([]);
  const [waConvCounts, setWaConvCounts] = useState<Record<string, number>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [checklistPanel, setChecklistPanel] = useState(false);
  const [checklistFilter, setChecklistFilter] = useState<"pending" | "done" | "all">("pending");
  const [copyDialog, setCopyDialog] = useState<{ nodeId: string; label: string; kind: string; projectId: string } | null>(null);
  const [annotations, setAnnotations] = useState<MapAnnotation[]>([]);
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ screenX: number; screenY: number; flowX: number; flowY: number; annotationId?: string } | null>(null);
  const [paletteCollapsed, setPaletteCollapsed] = useState(() => localStorage.getItem("funis:palette-collapsed") === "true");
  const { setCenter, screenToFlowPosition } = useReactFlow();
  useEffect(() => {
    localStorage.setItem("funis:palette-collapsed", String(paletteCollapsed));
  }, [paletteCollapsed]);


  // load maps list
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("imphq_company_maps").select("id,name").order("created_at");
      const list = data || [];
      if (list.length === 0) {
        const { data: created } = await supabase.from("imphq_company_maps").insert({ name: "Mapa Principal" }).select("id,name").single();
        if (created) { setMaps([created]); setMapId(created.id); }
      } else {
        setMaps(list);
        setMapId(list[0].id);
      }
    })();
    supabase.from("imphq_funis").select("id,nome").then(({ data }) => setFunis(data || []));
    supabase.from("imphq_flows").select("id,nome").then(({ data }) => setFlows(((data || []) as any[]).map(d => ({ id: d.id, name: d.nome }))));
    supabase.from("imphq_wa_providers").select("id,project_id,provider,display_name,instance_name,phone_number_id,twilio_from,is_active")
      .then(({ data }) => setWaProviders((data || []) as WaProvider[]));
  }, []);

  // conversation counts per provider (best-effort — grouped by project)
  useEffect(() => {
    (async () => {
      const projectIds = Array.from(new Set(waProviders.map(p => p.project_id).filter(Boolean)));
      if (projectIds.length === 0) return;
      const counts: Record<string, number> = {};
      await Promise.all(projectIds.map(async (pid) => {
        const { count } = await supabase.from("imphq_wa_conversations")
          .select("id", { count: "exact", head: true })
          .eq("project_id", pid);
        counts[pid] = count || 0;
      }));
      setWaConvCounts(counts);
    })();
  }, [waProviders]);

  // Toggle single checklist item directly on the canvas (stable ref via setState updater)
  const toggleChecklistItem = useCallback(async (nodeId: string, itemId: string, done: boolean) => {
    let nextChecklist: ChecklistItem[] = [];
    setRawNodes(list => list.map(r => {
      if (r.id !== nodeId) return r;
      nextChecklist = (r.checklist || []).map(c => c.id === itemId ? { ...c, done } : c);
      return { ...r, checklist: nextChecklist };
    }));
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, checklist: nextChecklist } } : n));
    await supabase.from("imphq_company_map_nodes").update({ checklist: nextChecklist as any }).eq("id", nodeId);
  }, []);

  // Refs to break the loadMap → data → callback recreation loop
  const rawNodesRef = useRef<MapNode[]>([]);
  const projectsRef = useRef<any[]>(projects);
  const waProvidersRef = useRef<WaProvider[]>([]);
  const waConvCountsRef = useRef<Record<string, number>>({});
  useEffect(() => { rawNodesRef.current = rawNodes; }, [rawNodes]);
  useEffect(() => { projectsRef.current = projects; }, [projects]);
  useEffect(() => { waProvidersRef.current = waProviders; }, [waProviders]);
  useEffect(() => { waConvCountsRef.current = waConvCounts; }, [waConvCounts]);

  const loadMapRef = useRef<((id: string) => Promise<void>) | null>(null);

  // single-node quick actions (stable — read from refs)
  const duplicateNode = useCallback(async (nodeId: string) => {
    const src = await supabase.from("imphq_company_map_nodes").select("*").eq("id", nodeId).maybeSingle();
    const n: any = src.data;
    if (!n) { toast.error("Nó não encontrado"); return; }
    const { map_id, kind, color, label, description, notes, checklist, position, show_live_kpis, linked_funnel_id, linked_project_id, linked_flow_id, linked_wa_provider_id } = n;
    const { error } = await supabase.from("imphq_company_map_nodes").insert({
      map_id, kind, color, label: `${label} (cópia)`, description, notes,
      checklist: (checklist || []) as any,
      position: { x: (position?.x || 0) + 40, y: (position?.y || 0) + 40 },
      show_live_kpis, linked_funnel_id, linked_project_id, linked_flow_id, linked_wa_provider_id,
    });
    if (error) { toast.error("Erro ao duplicar"); return; }
    if (n.map_id) await loadMapRef.current?.(n.map_id);
    toast.success("Duplicado");
  }, []);

  const deleteNodeById = useCallback(async (nodeId: string) => {
    if (!confirm("Excluir este nó?")) return;
    const cur = rawNodesRef.current.find(r => r.id === nodeId);
    const { error } = await supabase.from("imphq_company_map_nodes").delete().eq("id", nodeId);
    if (error) { toast.error("Erro ao excluir"); return; }
    if (cur?.map_id) await loadMapRef.current?.(cur.map_id);
  }, []);

  const openCopyDialog = useCallback((nodeId: string) => {
    const n = rawNodesRef.current.find(r => r.id === nodeId);
    if (!n) return;
    const pid = n.linked_project_id || projectsRef.current[0]?.id;
    if (!pid) { toast.error("Vincule um projeto ao nó (ou crie um projeto) para gerar copy contextual."); return; }
    setCopyDialog({ nodeId, label: n.label, kind: n.kind, projectId: pid });
  }, []);


  // load nodes/edges/annotations — stable (deps são refs), sem loop de recarga
  const loadMap = useCallback(async (id: string) => {
    const [{ data: nds, error: nErr }, { data: eds, error: eErr }, { data: anns }] = await Promise.all([
      supabase.from("imphq_company_map_nodes").select("*").eq("map_id", id),
      supabase.from("imphq_company_map_edges").select("*").eq("map_id", id),
      supabase.from(annTable).select("*").eq("map_id", id) as any,
    ]);
    if (nErr || eErr) { toast.error("Erro ao carregar mapa"); return; }
    const list = (nds || []) as any as MapNode[];
    setRawNodes(list);
    setAnnotations(((anns || []) as any) as MapAnnotation[]);
    const providers = waProvidersRef.current;
    const counts = waConvCountsRef.current;
    setNodes(nds2 => {
      // preserve annotations already merged (they get re-merged by a dedicated effect)
      const annNodes = nds2.filter(n => n.id.startsWith(ANN_PREFIX));
      const baseNodes = list.map(n => {
        const wa = n.linked_wa_provider_id ? providers.find(p => p.id === n.linked_wa_provider_id) : null;
        const waInfo = wa ? {
          phone: wa.twilio_from || wa.phone_number_id || null,
          instance: wa.instance_name || wa.display_name || null,
          provider: wa.provider,
          conversations: counts[wa.project_id],
        } : null;
        return {
          id: n.id, type: "mapnode",
          position: n.position || { x: 0, y: 0 },
          ...(n.width && n.height ? { width: n.width, height: n.height, style: { width: n.width, height: n.height } } : {}),
          data: { ...n, onToggleItem: toggleChecklistItem, onDuplicate: duplicateNode, onDelete: deleteNodeById, onGenerateCopy: openCopyDialog, waInfo },
        } as Node;
      });
      return [...baseNodes, ...annNodes];
    });
    setEdges((eds || []).map((e: any) => ({
      id: e.id, source: e.source_id, target: e.target_id,
      animated: e.style !== "dashed",
      label: e.label || undefined,
      style: { stroke: "#c9922a", strokeWidth: 2, strokeDasharray: e.style === "dashed" ? "6 4" : undefined },
    })));
  }, [toggleChecklistItem, duplicateNode, deleteNodeById, openCopyDialog]);

  loadMapRef.current = loadMap;

  // Re-inject waInfo quando providers/contagens chegam depois do carregamento inicial
  useEffect(() => {
    setNodes(nds => nds.map(n => {
      const pid = (n.data as any)?.linked_wa_provider_id;
      if (!pid) return n;
      const wa = waProviders.find(p => p.id === pid);
      if (!wa) return n;
      const waInfo = {
        phone: wa.twilio_from || wa.phone_number_id || null,
        instance: wa.instance_name || wa.display_name || null,
        provider: wa.provider,
        conversations: waConvCounts[wa.project_id],
      };
      return { ...n, data: { ...n.data, waInfo } };
    }));
  }, [waProviders, waConvCounts]);

  // live KPIs for project-linked nodes
  const liveProjectIds = useMemo(
    () => Array.from(new Set(rawNodes.filter(n => n.linked_project_id).map(n => n.linked_project_id!))),
    [rawNodes]
  );
  const { data: liveStats } = useCompanyMapLiveStats(liveProjectIds);

  // re-inject live stats only (avoid full data replace to prevent flicker during drag)
  useEffect(() => {
    if (!liveStats) return;
    setNodes(nds => nds.map(n => {
      const pid = (n.data as any)?.linked_project_id;
      const stats = pid ? liveStats[pid] : null;
      if ((n.data as any)?.liveStats === stats) return n;
      return { ...n, data: { ...n.data, liveStats: stats } };
    }));
  }, [liveStats]);

  useEffect(() => { if (mapId) loadMap(mapId); }, [mapId, loadMap]);

  // ---------- Annotations helpers ----------
  const updateAnnotationText = useCallback(async (id: string, text: string) => {
    const annId = id.startsWith(ANN_PREFIX) ? id.slice(ANN_PREFIX.length) : id;
    setAnnotations(list => list.map(a => a.id === annId ? { ...a, text } : a));
    setEditingAnnotationId(null);
    await supabase.from(annTable).update({ text }).eq("id", annId);
  }, []);

  // Merge annotations into React Flow nodes whenever they (or edit state) change.
  useEffect(() => {
    setNodes(nds => {
      const base = nds.filter(n => !n.id.startsWith(ANN_PREFIX));
      const annNodes: Node[] = annotations.map(a => ({
        id: `${ANN_PREFIX}${a.id}`,
        type: ANNOTATION_KIND_TO_TYPE[a.kind],
        position: { x: a.x, y: a.y },
        width: a.width,
        height: a.height,
        style: { width: a.width, height: a.height },
        zIndex: a.z_index ?? 0,
        draggable: true,
        selectable: true,
        data: {
          kind: a.kind,
          text: a.text || "",
          style: a.style || {},
          editingId: editingAnnotationId,
          onTextChange: updateAnnotationText,
        } as unknown as Record<string, unknown>,
      }));
      return [...annNodes, ...base]; // annotations rendered behind by DOM order + lower zIndex
    });
  }, [annotations, editingAnnotationId, updateAnnotationText]);

  const addAnnotation = useCallback(async (kind: AnnotationKind, x: number, y: number) => {
    if (!mapId) return;
    const def = ANNOTATION_DEFAULTS[kind];
    const payload = {
      map_id: mapId, kind,
      x: x - def.w / 2, y: y - def.h / 2,
      width: def.w, height: def.h,
      text: def.text, style: def.style as any, z_index: 0,
    };
    const { data, error } = await (supabase.from(annTable) as any).insert(payload).select().single();
    if (error) { toast.error("Erro ao adicionar anotação"); return; }
    setAnnotations(list => [...list, data as MapAnnotation]);
    if ((kind === "note" || kind === "label" || kind === "frame")) setEditingAnnotationId(`${ANN_PREFIX}${data.id}`);
  }, [mapId]);

  const deleteAnnotation = useCallback(async (annId: string) => {
    setAnnotations(list => list.filter(a => a.id !== annId));
    await supabase.from(annTable).delete().eq("id", annId);
  }, []);

  const duplicateAnnotation = useCallback(async (annId: string) => {
    const src = annotations.find(a => a.id === annId);
    if (!src || !mapId) return;
    const { data, error } = await (supabase.from(annTable) as any).insert({
      map_id: mapId, kind: src.kind, x: src.x + 30, y: src.y + 30,
      width: src.width, height: src.height, text: src.text, style: src.style as any, z_index: src.z_index,
    }).select().single();
    if (error) { toast.error("Erro"); return; }
    setAnnotations(list => [...list, data as MapAnnotation]);
  }, [annotations, mapId]);

  const changeAnnotationZ = useCallback(async (annId: string, dir: "up" | "down") => {
    const src = annotations.find(a => a.id === annId); if (!src) return;
    const next = (src.z_index || 0) + (dir === "up" ? 1 : -1);
    setAnnotations(list => list.map(a => a.id === annId ? { ...a, z_index: next } : a));
    await supabase.from(annTable).update({ z_index: next }).eq("id", annId);
  }, [annotations]);

  const changeArrowOrientation = useCallback(async (annId: string, orientation: "diag-down" | "diag-up" | "horizontal" | "vertical") => {
    const src = annotations.find(a => a.id === annId); if (!src) return;
    const nextStyle = { ...(src.style || {}), orientation };
    setAnnotations(list => list.map(a => a.id === annId ? { ...a, style: nextStyle } : a));
    await supabase.from(annTable).update({ style: nextStyle as any }).eq("id", annId);
  }, [annotations]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(nds => applyNodeChanges(changes, nds));
    changes.forEach(async (c: any) => {
      const isAnn = typeof c.id === "string" && c.id.startsWith(ANN_PREFIX);
      const rawId = isAnn ? c.id.slice(ANN_PREFIX.length) : c.id;
      if (c.type === "position" && c.dragging === false && c.position) {
        if (isAnn) {
          setAnnotations(list => list.map(a => a.id === rawId ? { ...a, x: c.position.x, y: c.position.y } : a));
          await supabase.from(annTable).update({ x: c.position.x, y: c.position.y }).eq("id", rawId);
        } else {
          await supabase.from("imphq_company_map_nodes").update({ position: c.position }).eq("id", c.id);
        }
      }
      if (c.type === "dimensions" && isAnn && c.dimensions && (c.resizing === false || c.resizing === undefined)) {
        const { width, height } = c.dimensions;
        if (width && height) {
          setAnnotations(list => list.map(a => a.id === rawId ? { ...a, width, height } : a));
          await supabase.from(annTable).update({ width, height }).eq("id", rawId);
        }
      }
    });
  }, []);

  const onSelectionChange = useCallback(({ nodes: sel }: { nodes: Node[] }) => {
    setSelectedIds(sel.map(n => n.id));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges(eds => applyEdgeChanges(changes, eds));
    changes.forEach(async (c: any) => {
      if (c.type === "remove") {
        await supabase.from("imphq_company_map_edges").delete().eq("id", c.id);
      }
    });
  }, []);

  const onConnect = useCallback(async (conn: Connection) => {
    if (!mapId || !conn.source || !conn.target) return;
    const { data } = await supabase.from("imphq_company_map_edges")
      .insert({ map_id: mapId, source_id: conn.source, target_id: conn.target })
      .select().single();
    if (data) setEdges(eds => addEdge({ id: data.id, source: conn.source!, target: conn.target!, animated: true, style: { stroke: "#c9922a", strokeWidth: 2 } }, eds));
  }, [mapId]);

  const addNode = async (kind: string, customLabel?: string) => {
    if (!mapId) return;
    const preset = KIND_PRESETS[kind] || KIND_PRESETS.canal;

    // Imagem: pede arquivo antes, faz upload, e só então cria o nó
    let image_url: string | null = null;
    let autoLabel: string | null = null;
    if (kind === "imagem") {
      const file = await pickImageFile();
      if (!file) return;
      const t = toast.loading("Enviando imagem...");
      image_url = await uploadMapImage(mapId, file);
      toast.dismiss(t);
      if (!image_url) return;
      autoLabel = file.name.replace(/\.[^.]+$/, "");
    }

    const { data } = await supabase.from("imphq_company_map_nodes").insert({
      map_id: mapId, kind, color: preset.color,
      label: customLabel || autoLabel || `Novo ${preset.label}`,
      image_url,
      position: { x: 200 + Math.random() * 400, y: 150 + Math.random() * 300 },
    } as any).select().single();
    if (data) { await loadMap(mapId); toast.success(`${preset.label} adicionado`); }
  };

  const createMap = async () => {
    const name = prompt("Nome do novo mapa:");
    if (!name) return;
    const { data } = await supabase.from("imphq_company_maps").insert({ name }).select().single();
    if (data) { setMaps(m => [...m, data]); setMapId(data.id); }
  };

  const renameMap = async () => {
    if (!mapId) return;
    const cur = maps.find(m => m.id === mapId);
    const name = prompt("Novo nome do mapa:", cur?.name || "");
    if (!name || name === cur?.name) return;
    await supabase.from("imphq_company_maps").update({ name }).eq("id", mapId);
    setMaps(ms => ms.map(m => m.id === mapId ? { ...m, name } : m));
    toast.success("Mapa renomeado");
  };

  const deleteMap = async () => {
    if (!mapId) return;
    if (maps.length <= 1) { toast.error("Mantenha pelo menos 1 mapa"); return; }
    const cur = maps.find(m => m.id === mapId);
    if (!confirm(`Excluir o mapa "${cur?.name}"? Todos os nós e conexões serão perdidos.`)) return;
    await supabase.from("imphq_company_map_nodes").delete().eq("map_id", mapId);
    await supabase.from("imphq_company_map_edges").delete().eq("map_id", mapId);
    await supabase.from("imphq_company_maps").delete().eq("id", mapId);
    const next = maps.filter(m => m.id !== mapId);
    setMaps(next);
    setMapId(next[0]?.id || null);
    toast.success("Mapa excluído");
  };

  const onNodeClick = (_: any, node: Node) => {
    // Se há multi-seleção ativa, não abrir painel (permitir mover em grupo)
    if (selectedIds.length > 1 && selectedIds.includes(node.id)) return;
    const raw = rawNodes.find(r => r.id === node.id);
    if (raw) setSelected({ ...raw, checklist: raw.checklist || [] });
  };

  const saveSelected = async () => {
    if (!selected) return;
    const { error } = await supabase.from("imphq_company_map_nodes").update({
      label: selected.label, description: selected.description, notes: selected.notes,
      color: selected.color, kind: selected.kind, checklist: selected.checklist as any,
      size: selected.size || "M",
      url: selected.url || null,
      image_url: selected.image_url || null,
      show_live_kpis: !!selected.show_live_kpis,
      linked_funnel_id: selected.linked_funnel_id || null,
      linked_project_id: selected.linked_project_id || null,
      linked_flow_id: selected.linked_flow_id || null,
      linked_wa_provider_id: selected.linked_wa_provider_id || null,
    } as any).eq("id", selected.id);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Salvo");
    if (mapId) await loadMap(mapId);
    setSelected(null);
  };

  const runAutoLayout = async () => {
    const next = autoLayout(nodes, edges);
    setNodes(next);
    await Promise.all(next.map(n =>
      supabase.from("imphq_company_map_nodes").update({ position: n.position }).eq("id", n.id)
    ));
    toast.success("Organizado");
  };

  const handleTemplate = async (tplId: string) => {
    if (!mapId) return;
    const tpl = MAP_TEMPLATES.find(t => t.id === tplId);
    if (!tpl) return;
    if (!confirm(`Carregar template "${tpl.name}"? Os nós atuais deste mapa serão substituídos.`)) return;
    await applyTemplate(mapId, tpl);
    await loadMap(mapId);
    toast.success("Template carregado");
  };

  const handleAutopopulate = async () => {
    if (!mapId) return;
    if (!confirm("Gerar mapa a partir dos seus projetos, fluxos e canais? Os nós atuais serão substituídos.")) return;
    const t = toast.loading("Gerando mapa...");
    try { await autopopulateFromBusiness(mapId); await loadMap(mapId); toast.success("Mapa gerado", { id: t }); }
    catch (e: any) { toast.error(e.message || "Erro", { id: t }); }
  };

  const handleAutopopulateProject = async (projectId: string) => {
    if (!mapId) return;
    const proj = projects.find(p => p.id === projectId);
    if (!confirm(`Gerar mapa do projeto "${proj?.name || projectId}"? Os nós atuais serão substituídos.`)) return;
    const t = toast.loading("Gerando mapa do projeto...");
    try { await autopopulateFromProject(mapId, projectId); await loadMap(mapId); toast.success("Mapa do projeto gerado", { id: t }); }
    catch (e: any) { toast.error(e.message || "Erro", { id: t }); }
  };

  const handleExport = async () => {
    try { await exportMapPng(); toast.success("PNG baixado"); }
    catch (e: any) { toast.error(e.message || "Erro ao exportar"); }
  };


  const deleteNode = async () => {
    if (!selected) return;
    if (!confirm("Excluir este nó e suas conexões?")) return;
    await supabase.from("imphq_company_map_nodes").delete().eq("id", selected.id);
    setSelected(null);
    if (mapId) await loadMap(mapId);
  };

  // ============ Bulk selection actions ============
  const bulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Excluir ${selectedIds.length} nós e suas conexões?`)) return;
    await supabase.from("imphq_company_map_nodes").delete().in("id", selectedIds);
    setSelectedIds([]);
    if (mapId) await loadMap(mapId);
    toast.success("Selecionados excluídos");
  };

  const bulkDuplicate = async () => {
    if (!mapId || selectedIds.length === 0) return;
    const originals = rawNodes.filter(n => selectedIds.includes(n.id));
    const payload = originals.map(n => ({
      map_id: mapId, kind: n.kind, color: n.color,
      label: `${n.label} (cópia)`, description: n.description, notes: n.notes,
      checklist: (n.checklist || []) as any,
      position: { x: (n.position?.x || 0) + 40, y: (n.position?.y || 0) + 40 },
    }));
    await supabase.from("imphq_company_map_nodes").insert(payload);
    setSelectedIds([]);
    if (mapId) await loadMap(mapId);
    toast.success("Duplicados");
  };

  const bulkChangeKind = async (kind: string) => {
    if (selectedIds.length === 0) return;
    const preset = KIND_PRESETS[kind];
    await supabase.from("imphq_company_map_nodes")
      .update({ kind, color: preset.color })
      .in("id", selectedIds);
    if (mapId) await loadMap(mapId);
    toast.success("Tipo aplicado");
  };

  // ============ Aggregated checklist ============
  const aggregatedChecklist = useMemo(() => {
    const rows: { nodeId: string; nodeLabel: string; nodeColor: string; nodeKind: string; item: ChecklistItem; position: { x: number; y: number } }[] = [];
    rawNodes.forEach(n => (n.checklist || []).forEach(item => rows.push({
      nodeId: n.id, nodeLabel: n.label, nodeColor: n.color, nodeKind: n.kind, item, position: n.position,
    })));
    return rows.filter(r => checklistFilter === "all" ? true : checklistFilter === "done" ? r.item.done : !r.item.done);
  }, [rawNodes, checklistFilter]);

  const totalDone = rawNodes.reduce((a, n) => a + (n.checklist || []).filter(c => c.done).length, 0);
  const totalItems = rawNodes.reduce((a, n) => a + (n.checklist || []).length, 0);

  const focusNode = (id: string, position: { x: number; y: number }) => {
    setCenter(position.x + 100, position.y + 40, { zoom: 1.2, duration: 500 });
  };

  return (
    <div className="relative h-[calc(100vh-200px)] border border-border/40 rounded-lg overflow-hidden bg-[#0a0809]">
      {/* Top toolbar */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-card/80 backdrop-blur border border-border/40 rounded-lg p-1.5">
        <Select value={mapId || ""} onValueChange={setMapId}>
          <SelectTrigger className="h-7 text-xs w-[180px] border-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            {maps.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={renameMap} title="Renomear mapa">
          <Pencil className="h-3 w-3" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400" onClick={deleteMap} title="Excluir mapa">
          <Trash2 className="h-3 w-3" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={createMap}>
          <Plus className="h-3 w-3" /> Novo mapa
        </Button>
        <div className="w-px h-5 bg-border/40 mx-1" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
              <Sparkles className="h-3 w-3" /> Template
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[260px]">
            {MAP_TEMPLATES.map(t => (
              <DropdownMenuItem key={t.id} onClick={() => handleTemplate(t.id)} className="flex-col items-start gap-0.5">
                <span className="text-sm font-medium">{t.name}</span>
                <span className="text-[10px] text-muted-foreground">{t.description}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={handleAutopopulate}>
          <Wand2 className="h-3 w-3" /> Gerar do meu negócio
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
              <Wand2 className="h-3 w-3" /> Gerar do projeto
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[240px] max-h-[400px] overflow-y-auto">
            {projects.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum projeto</div>}
            {projects.map(p => (
              <DropdownMenuItem key={p.id} onClick={() => handleAutopopulateProject(p.id)}>
                {p.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={runAutoLayout}>
          <LayoutGrid className="h-3 w-3" /> Organizar
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setChecklistPanel(true)}>
          <ListChecks className="h-3 w-3" /> Checklist
          {totalItems > 0 && <Badge variant="outline" className="h-4 px-1 text-[9px] ml-1">{totalDone}/{totalItems}</Badge>}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={handleExport}>
          <Download className="h-3 w-3" /> PNG
        </Button>
      </div>

      {/* Palette (grouped by category) */}
      <div
        className={cn(
          "absolute top-3 right-3 z-10 flex flex-col bg-card/80 backdrop-blur border border-border/40 rounded-lg transition-all",
          paletteCollapsed
            ? "w-9 h-9 p-1 overflow-hidden items-center justify-center cursor-pointer"
            : "p-2 gap-2 w-[210px] max-h-[calc(100vh-260px)] overflow-y-auto"
        )}
        onClick={() => paletteCollapsed && setPaletteCollapsed(false)}
        title={paletteCollapsed ? "Adicionar nó" : undefined}
      >
        {!paletteCollapsed ? (
          <>
            <div className="flex items-center justify-between">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground px-1">Adicionar nó</p>
              <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setPaletteCollapsed(true)}>
                <ChevronsRight className="h-3 w-3" />
              </Button>
            </div>
            {KIND_CATEGORIES.map(cat => (
              <div key={cat.label} className="space-y-0.5">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground/70 px-1 pt-1 border-t border-border/30">{cat.label}</p>
                {cat.keys.map(key => {
                  const p = KIND_PRESETS[key]; if (!p) return null;
                  const Icon = p.icon;
                  return (
                    <Button key={key} size="sm" variant="ghost" className="h-7 w-full text-xs justify-start gap-2"
                      onClick={() => addNode(key)}>
                      <div className="p-0.5 rounded" style={{ background: `${p.color}30`, color: p.color }}>
                        <Icon className="h-3 w-3" />
                      </div>
                      <span className="truncate">{p.label}</span>
                    </Button>
                  );
                })}
              </div>
            ))}
          </>
        ) : (
          <Plus className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Bulk selection toolbar */}
      {selectedIds.length >= 2 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-card/95 backdrop-blur border border-primary/40 rounded-lg p-2 shadow-xl">
          <div className="flex items-center gap-1.5 px-2 text-xs">
            <MousePointer className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium">{selectedIds.length} selecionados</span>
          </div>
          <div className="w-px h-5 bg-border/40" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                <Wrench className="h-3 w-3" /> Mudar tipo
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {Object.entries(KIND_PRESETS).map(([k, p]) => (
                <DropdownMenuItem key={k} onClick={() => bulkChangeKind(k)}>{p.label}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={bulkDuplicate}>
            <Copy className="h-3 w-3" /> Duplicar
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-red-400" onClick={bulkDelete}>
            <Trash2 className="h-3 w-3" /> Excluir
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => { setSelectedIds([]); setNodes(nds => nds.map(n => n.selected ? { ...n, selected: false } : n)); }}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-[10px] text-muted-foreground bg-card/80 backdrop-blur px-3 py-1 rounded-full border border-border/40 pointer-events-none">
        Arraste no vazio = selecionar em área · Ctrl/Cmd + clique = adicionar · Botão direito = anotações · Duplo-clique = editar texto
      </div>
      <ReactFlow
        nodes={nodes} edges={edges} nodeTypes={nodeTypes}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        onConnect={onConnect} onNodeClick={onNodeClick}
        onSelectionChange={onSelectionChange}
        onPaneContextMenu={(event) => {
          const e = event as unknown as React.MouseEvent;
          e.preventDefault();
          const flow = screenToFlowPosition({ x: e.clientX, y: e.clientY });
          setCtxMenu({ screenX: e.clientX, screenY: e.clientY, flowX: flow.x, flowY: flow.y });
        }}
        onNodeContextMenu={(e, node) => {
          if (!node.id.startsWith(ANN_PREFIX)) return;
          e.preventDefault();
          const flow = screenToFlowPosition({ x: e.clientX, y: e.clientY });
          setCtxMenu({ screenX: e.clientX, screenY: e.clientY, flowX: flow.x, flowY: flow.y, annotationId: node.id.slice(ANN_PREFIX.length) });
        }}
        onNodeDoubleClick={(_, node) => {
          if (node.id.startsWith(ANN_PREFIX)) setEditingAnnotationId(node.id);
        }}
        onPaneClick={() => { setCtxMenu(null); setEditingAnnotationId(null); }}
        selectionOnDrag
        selectionMode={"partial" as any}
        panOnDrag={[1, 2]}
        multiSelectionKeyCode={["Meta", "Control"]}
        nodesDraggable
        selectNodesOnDrag={false}
        deleteKeyCode={null}
        fitView proOptions={{ hideAttribution: true }}
      >
        <Background color="#1f1d1e" gap={20} />
        <Controls className="!bg-card !border-border" />
        <MiniMap className="!bg-card !border-border" nodeColor={(n: any) => n.data?.color || "#c9922a"} />
      </ReactFlow>

      {/* Strategic gaps floating panel */}
      <div className="absolute bottom-3 right-3 z-10 hidden md:block">
        <StrategicGapsPanel
          nodes={rawNodes.map(n => ({ id: n.id, kind: n.kind, label: n.label, description: n.description }))}
          edges={edges.map(e => ({ source: e.source, target: e.target }))}
          onCreateNode={(kind, label) => addNode(kind, label)}
        />
      </div>


      {/* Canvas context menu (annotations) */}
      {ctxMenu && (
        <div
          className="fixed z-50 min-w-[200px] bg-card border border-border/60 rounded-md shadow-xl py-1 text-sm"
          style={{ left: ctxMenu.screenX, top: ctxMenu.screenY }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {!ctxMenu.annotationId && (
            <>
              <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Adicionar anotação</div>
              <button className="w-full text-left px-3 py-1.5 hover:bg-secondary/60 flex items-center gap-2"
                onClick={() => { addAnnotation("frame", ctxMenu.flowX, ctxMenu.flowY); setCtxMenu(null); }}>
                <Square className="h-3.5 w-3.5" /> Caixa tracejada
              </button>
              <button className="w-full text-left px-3 py-1.5 hover:bg-secondary/60 flex items-center gap-2"
                onClick={() => { addAnnotation("note", ctxMenu.flowX, ctxMenu.flowY); setCtxMenu(null); }}>
                <StickyNote className="h-3.5 w-3.5" /> Nota (sticky)
              </button>
              <button className="w-full text-left px-3 py-1.5 hover:bg-secondary/60 flex items-center gap-2"
                onClick={() => { addAnnotation("label", ctxMenu.flowX, ctxMenu.flowY); setCtxMenu(null); }}>
                <Type className="h-3.5 w-3.5" /> Título/label grande
              </button>
              <button className="w-full text-left px-3 py-1.5 hover:bg-secondary/60 flex items-center gap-2"
                onClick={() => { addAnnotation("arrow", ctxMenu.flowX, ctxMenu.flowY); setCtxMenu(null); }}>
                <ArrowUpRight className="h-3.5 w-3.5" /> Seta / linha
              </button>
            </>
          )}
          {ctxMenu.annotationId && (() => {
            const ann = annotations.find(a => a.id === ctxMenu.annotationId);
            if (!ann) return null;
            return (
              <>
                <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Anotação</div>
                <button className="w-full text-left px-3 py-1.5 hover:bg-secondary/60 flex items-center gap-2"
                  onClick={() => { setEditingAnnotationId(`${ANN_PREFIX}${ann.id}`); setCtxMenu(null); }}>
                  <Pencil className="h-3.5 w-3.5" /> Editar texto
                </button>
                <button className="w-full text-left px-3 py-1.5 hover:bg-secondary/60 flex items-center gap-2"
                  onClick={() => { duplicateAnnotation(ann.id); setCtxMenu(null); }}>
                  <Copy className="h-3.5 w-3.5" /> Duplicar
                </button>
                <button className="w-full text-left px-3 py-1.5 hover:bg-secondary/60 flex items-center gap-2"
                  onClick={() => { changeAnnotationZ(ann.id, "up"); setCtxMenu(null); }}>
                  <ChevronsUp className="h-3.5 w-3.5" /> Trazer pra frente
                </button>
                <button className="w-full text-left px-3 py-1.5 hover:bg-secondary/60 flex items-center gap-2"
                  onClick={() => { changeAnnotationZ(ann.id, "down"); setCtxMenu(null); }}>
                  <ChevronsDown className="h-3.5 w-3.5" /> Enviar pra trás
                </button>
                {ann.kind === "arrow" && (
                  <>
                    <div className="border-t border-border/40 my-1" />
                    <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Direção</div>
                    {(["diag-down","diag-up","horizontal","vertical"] as const).map(o => (
                      <button key={o} className="w-full text-left px-3 py-1 hover:bg-secondary/60 text-xs"
                        onClick={() => { changeArrowOrientation(ann.id, o); setCtxMenu(null); }}>
                        {o === "diag-down" ? "Diagonal ↘" : o === "diag-up" ? "Diagonal ↗" : o === "horizontal" ? "Horizontal →" : "Vertical ↓"}
                      </button>
                    ))}
                  </>
                )}
                <div className="border-t border-border/40 my-1" />
                <button className="w-full text-left px-3 py-1.5 hover:bg-secondary/60 flex items-center gap-2 text-red-400"
                  onClick={() => { deleteAnnotation(ann.id); setCtxMenu(null); }}>
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </button>
              </>
            );
          })()}
        </div>
      )}

      {/* Aggregated checklist panel */}
      <Sheet open={checklistPanel} onOpenChange={setChecklistPanel}>
        <SheetContent className="w-[440px] sm:max-w-[440px] overflow-y-auto bg-secondary/40">
          <SheetHeader>
            <SheetTitle className="font-serif flex items-center gap-2">
              <ListChecks className="h-4 w-4" /> Checklist do mapa
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{totalDone} de {totalItems} concluídos</span>
              <div className="flex gap-1">
                {(["pending", "done", "all"] as const).map(f => (
                  <Button key={f} size="sm" variant={checklistFilter === f ? "default" : "ghost"}
                    className="h-6 text-[10px] px-2" onClick={() => setChecklistFilter(f)}>
                    {f === "pending" ? "Pendentes" : f === "done" ? "Feitos" : "Todos"}
                  </Button>
                ))}
              </div>
            </div>
            <div className="h-1.5 bg-muted/30 rounded overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${totalItems ? (totalDone / totalItems) * 100 : 0}%` }} />
            </div>

            {aggregatedChecklist.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">
                {totalItems === 0 ? "Nenhum item de checklist ainda. Abra um nó pra adicionar." : "Nada por aqui com esse filtro."}
              </p>
            )}

            <div className="space-y-1">
              {aggregatedChecklist.map((r) => (
                <div key={`${r.nodeId}-${r.item.id}`} className="flex items-start gap-2 p-2 rounded border border-border/30 hover:border-border/60 bg-card/40">
                  <Checkbox
                    checked={r.item.done}
                    className="mt-0.5"
                    onCheckedChange={(v) => toggleChecklistItem(r.nodeId, r.item.id, !!v)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs ${r.item.done ? "line-through text-muted-foreground" : ""}`}>{r.item.text || "—"}</p>
                    <button
                      onClick={() => { focusNode(r.nodeId, r.position); setChecklistPanel(false); }}
                      className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1 mt-0.5"
                    >
                      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: r.nodeColor }} />
                      {r.nodeLabel}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Editor sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:w-[480px] sm:max-w-[480px] overflow-y-auto bg-secondary/40">
          <SheetHeader><SheetTitle className="font-serif">Editar nó do mapa</SheetTitle></SheetHeader>
          {selected && (
            <div className="space-y-4 mt-4">
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={selected.kind} onValueChange={(v) => setSelected({ ...selected, kind: v, color: KIND_PRESETS[v].color })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-[360px]">
                    {KIND_CATEGORIES.map(cat => (
                      <div key={cat.label}>
                        <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">{cat.label}</div>
                        {cat.keys.map(k => KIND_PRESETS[k] && (
                          <SelectItem key={k} value={k}>{KIND_PRESETS[k].label}</SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Rótulo</Label>
                <Input value={selected.label} onChange={e => setSelected({ ...selected, label: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs flex items-center gap-1"><Palette className="h-3 w-3" /> Cor</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {COLOR_PALETTE.map(c => (
                      <button
                        key={c} type="button"
                        onClick={() => setSelected({ ...selected, color: c })}
                        className={`w-5 h-5 rounded border transition-all ${selected.color === c ? "ring-2 ring-offset-1 ring-offset-background ring-primary scale-110" : "border-border/40"}`}
                        style={{ background: c }}
                      />
                    ))}
                    <input
                      type="color" value={selected.color}
                      onChange={e => setSelected({ ...selected, color: e.target.value })}
                      className="w-5 h-5 rounded border border-border/40 bg-transparent cursor-pointer"
                      title="Cor customizada"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Tamanho</Label>
                  <div className="grid grid-cols-4 gap-1 mt-1">
                    {(["S","M","L","XL"] as const).map(s => (
                      <Button
                        key={s} size="sm" type="button"
                        variant={(selected.size || "M") === s ? "default" : "outline"}
                        className="h-7 text-[10px] px-0"
                        onClick={() => setSelected({ ...selected, size: s })}
                      >{s}</Button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs flex items-center gap-1"><Link2 className="h-3 w-3" /> URL (opcional)</Label>
                <Input
                  type="url" placeholder="https://..."
                  value={selected.url || ""}
                  onChange={e => setSelected({ ...selected, url: e.target.value })}
                />
              </div>
              {selected.kind === "imagem" && (
                <div>
                  <Label className="text-xs flex items-center gap-1"><ImageIcon className="h-3 w-3" /> Imagem</Label>
                  {selected.image_url && (
                    <img src={selected.image_url} alt={selected.label}
                      className="w-full max-h-48 object-contain rounded border border-border/40 my-2 bg-black/20" />
                  )}
                  <Button size="sm" variant="outline" className="w-full gap-1 mt-1"
                    onClick={async () => {
                      const file = await pickImageFile();
                      if (!file || !mapId) return;
                      const t = toast.loading("Enviando imagem...");
                      const url = await uploadMapImage(mapId, file);
                      toast.dismiss(t);
                      if (!url) return;
                      setSelected({ ...selected, image_url: url });
                      toast.success("Imagem atualizada — clique em Salvar");
                    }}>
                    <Upload className="h-3 w-3" /> {selected.image_url ? "Trocar imagem" : "Enviar imagem"}
                  </Button>
                </div>
              )}
              <div>
                <Label className="text-xs">Descrição (o que cuida)</Label>
                <Textarea rows={2} value={selected.description || ""}
                  onChange={e => setSelected({ ...selected, description: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Como cuida / observações</Label>
                <Textarea rows={3} value={selected.notes || ""}
                  onChange={e => setSelected({ ...selected, notes: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Projeto</Label>
                  <Select value={selected.linked_project_id || "none"}
                    onValueChange={(v) => setSelected({ ...selected, linked_project_id: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Funil</Label>
                  <Select value={selected.linked_funnel_id || "none"}
                    onValueChange={(v) => setSelected({ ...selected, linked_funnel_id: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {funis.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {selected.linked_project_id && (
                <label className="flex items-center gap-2 text-xs cursor-pointer p-2 rounded bg-emerald-500/5 border border-emerald-500/20">
                  <Checkbox checked={!!selected.show_live_kpis}
                    onCheckedChange={(v) => setSelected({ ...selected, show_live_kpis: !!v })} />
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Mostrar KPIs ao vivo (faturamento 30d + leads abertos)</span>
                </label>
              )}
              <div>
                <Label className="text-xs">Fluxo (OpenFlow)</Label>
                <Select value={selected.linked_flow_id || "none"}
                  onValueChange={(v) => setSelected({ ...selected, linked_flow_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {flows.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Chip / Canal WhatsApp</Label>
                <Select value={selected.linked_wa_provider_id || "none"}
                  onValueChange={(v) => setSelected({ ...selected, linked_wa_provider_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {waProviders.map(w => {
                      const proj = projects.find(p => p.id === w.project_id);
                      const label = `${w.display_name || w.instance_name || w.provider}${proj ? ` · ${proj.name}` : ""}`;
                      return <SelectItem key={w.id} value={w.id}>{label}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
                {selected.linked_wa_provider_id && (() => {
                  const w = waProviders.find(p => p.id === selected.linked_wa_provider_id);
                  if (!w) return null;
                  return (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {w.twilio_from || w.phone_number_id || "sem telefone"} · {waConvCounts[w.project_id] ?? 0} conversas
                    </p>
                  );
                })()}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs">Checklist</Label>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1"
                    onClick={() => setSelected({ ...selected, checklist: [...selected.checklist, { id: crypto.randomUUID(), text: "", done: false }] })}>
                    <Plus className="h-3 w-3" /> Item
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {selected.checklist.map((c, i) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <Checkbox checked={c.done} onCheckedChange={(v) => {
                        const cl = [...selected.checklist]; cl[i] = { ...c, done: !!v };
                        setSelected({ ...selected, checklist: cl });
                      }} />
                      <Input className="h-7 text-xs" value={c.text} placeholder="Tarefa..."
                        onChange={e => {
                          const cl = [...selected.checklist]; cl[i] = { ...c, text: e.target.value };
                          setSelected({ ...selected, checklist: cl });
                        }} />
                      <Button size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => setSelected({ ...selected, checklist: selected.checklist.filter(x => x.id !== c.id) })}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border/40">
                <Button variant="ghost" size="sm" className="text-red-400 gap-1" onClick={deleteNode}>
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </Button>
                <Button size="sm" className="gap-1" onClick={saveSelected}>
                  <Save className="h-3.5 w-3.5" /> Salvar
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {copyDialog && (
        <NodeCopyDialog
          open={!!copyDialog}
          onClose={() => setCopyDialog(null)}
          projectId={copyDialog.projectId}
          nodeId={copyDialog.nodeId}
          assetKind={copyDialog.kind}
          assetLabel={copyDialog.label}
        />
      )}
    </div>
  );
}


export function CompanyMapCanvas({ projects }: { projects: any[] }) {
  return <ReactFlowProvider><InnerMap projects={projects} /></ReactFlowProvider>;
}

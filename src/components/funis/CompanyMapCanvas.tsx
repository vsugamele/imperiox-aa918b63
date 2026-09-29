import { parsePosition, parseChecklist, parseAnnotationKind, parseAnnotationStyle } from "@/components/funis/company-map-data";
import { record, toJson, parseProjectData } from "@/lib/funis-data";
import type { Tables } from "@/integrations/supabase/types";
import type { NodeStats } from "@/hooks/useCompanyMapLiveStats";
import { errorMessage } from "@/lib/error-message";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  addEdge, applyEdgeChanges, applyNodeChanges, ConnectionMode, SelectionMode,
  type Node, type NodeProps, type NodePositionChange, type Edge, type Connection, type NodeChange, type EdgeChange,
  Handle, Position, useReactFlow, NodeResizer, ViewportPortal,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Plus, Trash2, Save, Building2, Target, Users, Megaphone, ShoppingCart, Wrench, FileText, Link2, X, Check, Wand2, LayoutGrid, Download, Sparkles, TrendingUp, ListChecks, Copy, MousePointer, Pencil, Instagram, Facebook, Youtube, Twitter, Linkedin, Music2, GraduationCap, Smartphone, MessageCircle, Phone, Square, StickyNote, Type, ArrowUpRight, ChevronsUp, ChevronsDown, ChevronsLeft, ChevronsRight, Film, Globe, MousePointerClick, Mail, CreditCard, TrendingDown, PackagePlus, Palette, ExternalLink, Image as ImageIcon, Upload, MessageSquare, AlignLeft, AlignCenter, AlignRight, AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter, CalendarClock, Share2, Rocket, Calendar, CheckCircle2, Workflow, Bot, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAP_TEMPLATES } from "@/components/funis/mapTemplates";
import { applyTemplate, autopopulateFromBusiness, autopopulateFromProject, autoLayout, exportMapPng } from "@/components/funis/companyMapHelpers";
import { useCompanyMapLiveStats, pickKpiForKind } from "@/hooks/useCompanyMapLiveStats";
import { NodeCopyDialog } from "@/components/funis/NodeCopyDialog";
import { annotationNodeTypes } from "@/components/funis/map-annotation-registry";
import { ANNOTATION_DEFAULTS, ANNOTATION_KIND_TO_TYPE, detectReelPlatform, extractReelAuthor, extractReelThumb, type AnnotationKind, type AnnotationData } from "@/components/funis/map-annotation-data";
import { StrategicGapsPanel } from "@/components/funis/StrategicGapsPanel";
import { ReferenciasPicker } from "@/components/funis/ReferenciasPicker";
import { ImageLightbox } from "@/components/shared/ImageLightbox";
import { PresenceCursors } from "@/components/funis/PresenceCursors";
import { MapCommentsPanel } from "@/components/funis/MapCommentsPanel";
import CampaignStepEditor from "@/components/whatsapp/CampaignStepEditor";

function extractWaCampaignId(notes?: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/\[wa_campaign:([a-zA-Z0-9_-]+)\]/);
  return match ? match[1] : null;
}

function setWaCampaignInNotes(notes: string | null | undefined, campaignId: string | null): string {
  const current = (notes || "").replace(/\[wa_campaign:[a-zA-Z0-9_-]+\]/g, "").trim();
  if (!campaignId) return current;
  return current ? `${current}\n[wa_campaign:${campaignId}]` : `[wa_campaign:${campaignId}]`;
}

function extractProductId(notes?: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/\[product_name:([^\]]+)\]/);
  return match ? match[1] : null;
}

function setProductIdInNotes(notes: string | null | undefined, prodName: string | null): string {
  const current = (notes || "").replace(/\[product_name:[^\]]+\]/g, "").trim();
  if (!prodName) return current;
  return current ? `${current}\n[product_name:${prodName}]` : `[product_name:${prodName}]`;
}

export interface AgentExecutionData {
  executor: string;
  skill: string;
  status: "pending" | "in_progress" | "ready_review" | "done";
  prompt: string;
  output_url: string;
}

export function extractAgentData(notes?: string | null): AgentExecutionData {
  if (!notes) {
    return { executor: "human_general", skill: "none", status: "pending", prompt: "", output_url: "" };
  }
  const executor = notes.match(/\[agent_executor:([^\]]+)\]/)?.[1] || "human_general";
  const skill = notes.match(/\[agent_skill:([^\]]+)\]/)?.[1] || "none";
  const status = (notes.match(/\[agent_status:([^\]]+)\]/)?.[1] || "pending") as any;
  const output_url = notes.match(/\[agent_output:([^\]]+)\]/)?.[1] || "";

  let prompt = "";
  const multiMatch = notes.match(/\[agent_prompt_start\]([\s\S]*?)\[agent_prompt_end\]/);
  if (multiMatch) {
    prompt = multiMatch[1].trim();
  } else {
    const singleMatch = notes.match(/\[agent_prompt:([^\]]+)\]/);
    if (singleMatch) prompt = singleMatch[1].trim();
  }

  return { executor, skill, status, prompt, output_url };
}

export function updateAgentDataInNotes(notes: string | null | undefined, data: Partial<AgentExecutionData>): string {
  let text = notes || "";
  text = text.replace(/\[agent_executor:[^\]]*\]/g, "")
             .replace(/\[agent_skill:[^\]]*\]/g, "")
             .replace(/\[agent_status:[^\]]*\]/g, "")
             .replace(/\[agent_output:[^\]]*\]/g, "")
             .replace(/\[agent_prompt:[^\]]*\]/g, "")
             .replace(/\[agent_prompt_start\][\s\S]*?\[agent_prompt_end\]/g, "")
             .trim();

  const current = extractAgentData(notes);
  const updated: AgentExecutionData = { ...current, ...data };

  const tags: string[] = [];
  if (updated.executor && updated.executor !== "human_general") tags.push(`[agent_executor:${updated.executor}]`);
  if (updated.skill && updated.skill !== "none") tags.push(`[agent_skill:${updated.skill}]`);
  if (updated.status && updated.status !== "pending") tags.push(`[agent_status:${updated.status}]`);
  if (updated.output_url) tags.push(`[agent_output:${updated.output_url}]`);
  if (updated.prompt) tags.push(`[agent_prompt_start]\n${updated.prompt.trim()}\n[agent_prompt_end]`);

  if (tags.length === 0) return text;
  return text ? `${text}\n\n${tags.join("\n")}` : tags.join("\n");
}

const KIND_PRESETS: Record<string, { label: string; color: string; icon: LucideIcon }> = {
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
    inp.oncancel = () => resolve(null);
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

interface MapNodeData extends MapNode {
 onGenerateCopy?: (id: string) => void; onDuplicate?: (id: string) => void; onDelete?: (id: string) => void;
 onToggleItem?: (id: string, itemId: string, done: boolean) => void;
 waInfo?: { phone?: string; instance?: string; provider: string; conversations?: number } | null;
 liveStats?: NodeStats | null;
}
function MapNodeCard({ data, selected }: { data: MapNodeData; selected?: boolean }) {
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
        lineClassName="!border-primary/70 !border-2"
        handleClassName="!w-3 !h-3 !rounded-sm !bg-primary !border-2 !border-background"
      />
      {/* Handles em todos os lados — source+target sobrepostos, target embaixo (recebe drop), source acima (inicia drag). Área de hit ampliada. */}
      {[Position.Top, Position.Right, Position.Bottom, Position.Left].map((pos) => {
        const baseStyle: React.CSSProperties = {
          width: 18, height: 18, background: data.color, border: "2px solid #080607",
          borderRadius: 999, opacity: 0.9, transition: "opacity 120ms, transform 120ms",
          pointerEvents: "auto",
        };
        return (
          <div key={`h-${pos}`}>
            <Handle
              id={`${pos}-t`}
              type="target"
              position={pos}
              style={{ ...baseStyle, zIndex: 10, background: "transparent", border: "none", opacity: 0 }}
              isConnectableStart={false}
            />
            <Handle
              id={`${pos}-s`}
              type="source"
              position={pos}
              style={{ ...baseStyle, zIndex: 11 }}
              className="hover:!opacity-100 hover:!scale-125"
              title="Arraste para conectar"
            />
          </div>
        );
      })}


      {/* Quick actions on hover */}
      <div className="nodrag absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-card border border-border/60 rounded-md shadow-lg p-0.5 z-10">
        <button
          className="p-1 rounded hover:bg-purple-500/20 text-muted-foreground hover:text-purple-400"
          onClick={(e) => {
            e.stopPropagation();
            const ag = extractAgentData(data.notes);
            const pName = (data.notes || "").match(/\[product_name:([^\]]+)\]/)?.[1] || "";
            const textToCopy = ag.prompt || `Ação: ${data.label}\nDescrição: ${data.description || ""}${pName ? `\nProduto: ${pName}` : ""}`;
            navigator.clipboard.writeText(textToCopy);
            toast.success("Playbook do Agente copiado para área de transferência!");
          }}
          title="Copiar Playbook do Agente para Claude/Codex/Antigravity"
        >
          <Bot className="h-3 w-3" />
        </button>
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
          onClick={(e) => {
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent("open-image-lightbox", { detail: { url: data.image_url, label: data.label } }));
          }}
          className={cn(
            "mt-2 w-full rounded border border-border/30 object-cover cursor-zoom-in",
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

      {/* Agent Execution Pill */}
      {(() => {
        const ag = extractAgentData(data.notes);
        if (ag.executor === "human_general" && !ag.prompt && !ag.output_url) return null;

        const execName =
          ag.executor === "ai_higgsfield" ? "🤖 Higgsfield IA" :
          ag.executor === "ai_google_flow" ? "🌐 Google Flow" :
          ag.executor === "ai_copywriter" ? "✍️ Copywriter IA" :
          ag.executor === "openflow" ? "⚡ OpenFlow WA" :
          ag.executor === "human_traffic" ? "👤 JP / Tráfego" :
          ag.executor === "human_design" ? "🎨 Design / Vídeo" : "👥 Time Humano";

        return (
          <div className="mt-2 pt-1.5 border-t border-border/30 flex items-center justify-between gap-1 text-[9px] font-mono">
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/25 truncate font-semibold"
              title={ag.skill && ag.skill !== "none" ? `Skill: ${ag.skill}` : undefined}
            >
              <Bot className="h-2.5 w-2.5 shrink-0 text-purple-400" />
              {execName}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {ag.output_url && (
                <a
                  href={ag.output_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:underline flex items-center gap-0.5 text-[8px]"
                  title="Abrir entregável"
                >
                  <ExternalLink className="h-2 w-2" /> Output
                </a>
              )}
              <span className={cn(
                "px-1 py-0.5 rounded text-[8px] uppercase tracking-wider font-semibold",
                ag.status === "done" ? "bg-emerald-500/20 text-emerald-300" :
                ag.status === "in_progress" ? "bg-blue-500/20 text-blue-300 animate-pulse" :
                ag.status === "ready_review" ? "bg-amber-500/20 text-amber-300" :
                "bg-zinc-800 text-zinc-400"
              )}>
                {ag.status === "done" ? "✓ Pronto" :
                 ag.status === "in_progress" ? "Executando" :
                 ag.status === "ready_review" ? "Revisar" : "Pendente"}
              </span>
            </div>
          </div>
        );
      })()}

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

    </div>
  );
}

const nodeTypes = Object.freeze({
  mapnode: MapNodeCard,
  annotation_frame: annotationNodeTypes.annotation_frame,
  annotation_note: annotationNodeTypes.annotation_note,
  annotation_label: annotationNodeTypes.annotation_label,
  annotation_arrow: annotationNodeTypes.annotation_arrow,
  annotation_reel: annotationNodeTypes.annotation_reel,
  annotation_script: annotationNodeTypes.annotation_script,
  annotation_copy: annotationNodeTypes.annotation_copy,
  annotation_ad_asset: annotationNodeTypes.annotation_ad_asset,
  annotation_schedule: annotationNodeTypes.annotation_schedule,
  annotation_account: annotationNodeTypes.annotation_account,

});


// MiniMap node color resolver - stable ref
const miniMapNodeColor = (n: Node) => typeof n.data.color === "string" ? n.data.color : "#c9922a";

interface MapAnnotation {
  id: string; map_id: string; kind: AnnotationKind;
  x: number; y: number; width: number; height: number;
  text: string; style: AnnotationData["style"]; z_index: number;
}
const ANN_PREFIX = "ann-";
const annTable = "imphq_company_map_annotations";

const ANNOTATION_MIN_SIZE: Record<AnnotationKind, { w: number; h: number }> = {
  frame: { w: 120, h: 80 },
  note: { w: 100, h: 60 },
  label: { w: 80, h: 30 },
  arrow: { w: 40, h: 20 },
  reel: { w: 160, h: 200 },
  script: { w: 200, h: 160 },
  copy: { w: 200, h: 120 },
  ad_asset: { w: 200, h: 200 },
  schedule: { w: 240, h: 200 },
  account: { w: 200, h: 80 },
};



function clampDimension(value: unknown, min: number) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.round(n)) : min;
}

function clampAnnotationLayout<T extends { kind: AnnotationKind; width: number; height: number }>(annotation: T): T {
  const min = ANNOTATION_MIN_SIZE[annotation.kind] || { w: 1, h: 1 };
  return {
    ...annotation,
    width: clampDimension(annotation.width, min.w),
    height: clampDimension(annotation.height, min.h),
  };
}

interface WaProvider {
  id: string; project_id: string; provider: string;
  display_name?: string | null; instance_name?: string | null;
  phone_number_id?: string | null; twilio_from?: string | null;
  is_active?: boolean | null;
}

function InnerMap({
  projects,
  initialProjectId,
  onNavigateTab,
}: {
  projects: Pick<Tables<"imphq_projects">, "id" | "name" | "data">[];
  initialProjectId?: string;
  onNavigateTab?: (tab: string) => void;
}) {
  const annotationsRef = useRef<MapAnnotation[]>([]);
  const [mapId, setMapId] = useState<string | null>(null);
  const [maps, setMaps] = useState<{ id: string; name: string }[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [rawNodes, setRawNodes] = useState<MapNode[]>([]);
  const [selected, setSelected] = useState<MapNode | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const autoSaveTimerRef = useRef<number | null>(null);
  const selectedBaselineIdRef = useRef<string | null>(null);
  const [funis, setFunis] = useState<{ id: string; nome: string }[]>([]);
  const [flows, setFlows] = useState<{ id: string; name: string }[]>([]);
  const [waProviders, setWaProviders] = useState<WaProvider[]>([]);
  const [waConvCounts, setWaConvCounts] = useState<Record<string, number>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [guides, setGuides] = useState<{ v: { x: number; y1: number; y2: number }[]; h: { y: number; x1: number; x2: number }[] }>({ v: [], h: [] });

  // Hub Lançamento / WhatsApp Campaigns & Step Editor
  const [waCampaigns, setWaCampaigns] = useState<Tables<"imphq_wa_campaigns">[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [campaignGroups, setCampaignGroups] = useState<{ id: string; name: string; jid?: string }[]>([]);
  const [stepEditorOpen, setStepEditorOpen] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [waSubMode, setWaSubMode] = useState<"x1" | "grupo">("x1");

  const currentCampaign = useMemo(() => {
    return waCampaigns.find(c => c.id === selectedCampaignId) || null;
  }, [waCampaigns, selectedCampaignId]);

  // Gerador de Fluxo por IA
  const [aiFlowModalOpen, setAiFlowModalOpen] = useState(false);
  const [aiFlowPreset, setAiFlowPreset] = useState<string>("vsl_perpetuo");
  const [aiFlowCustomText, setAiFlowCustomText] = useState("");
  const [aiFlowProduct, setAiFlowProduct] = useState("");
  const [aiFlowReplace, setAiFlowReplace] = useState(true);
  const [aiFlowGenerating, setAiFlowGenerating] = useState(false);

  const effectiveProjectId = selected?.linked_project_id || initialProjectId || null;
  const currentProject = projects.find(p => p.id === (effectiveProjectId || projects[0]?.id));
  const projectProductsList = useMemo(() => {
    if (!currentProject) return [];
    const data = parseProjectData(currentProject.data);
    return data.produtos || [];
  }, [currentProject]);

  useEffect(() => {
    if (!effectiveProjectId) {
      setWaCampaigns([]);
      return;
    }
    supabase
      .from("imphq_wa_campaigns")
      .select("*")
      .eq("project_id", effectiveProjectId)
      .order("created_at", { ascending: false })
      .then(({ data }) => setWaCampaigns(data || []));
  }, [effectiveProjectId]);

  useEffect(() => {
    if (!selected) {
      setSelectedCampaignId(null);
      return;
    }
    const campId = extractWaCampaignId(selected.notes);
    if (campId) {
      setSelectedCampaignId(campId);
      setWaSubMode("grupo");
    } else if (selected.linked_flow_id) {
      setWaSubMode("x1");
    }
  }, [selected]);

  const isWaKind = selected?.kind === "whatsapp";
  const isProductKind = ["checkout", "orderbump", "upsell", "downsell", "produto", "oferta"].includes(String(selected?.kind || ""));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projectProducts = projectProductsList as any[];

  const handleSelectCampaign = (value: string) => {
    if (!selected) return;
    const id = value === "none" ? null : value;
    setSelectedCampaignId(id);
    setSelected({ ...selected, notes: setWaCampaignInNotes(selected.notes, id) });
  };

  const handleCreateCampaign = async () => {
    const name = newCampaignName.trim();
    if (!name || !effectiveProjectId || !selected) return;
    const { data, error } = await supabase
      .from("imphq_wa_campaigns")
      .insert({ name, project_id: effectiveProjectId } as never)
      .select("*")
      .single();
    if (error || !data) { toast.error("Falha ao criar campanha"); return; }
    setWaCampaigns(prev => [data, ...prev]);
    setCreatingCampaign(false);
    setNewCampaignName("");
    handleSelectCampaign(data.id);
  };

  const handleLinkProduct = (value: string) => {
    if (!selected) return;
    const name = value === "none" ? null : value;
    setSelected({ ...selected, notes: setProductIdInNotes(selected.notes, name) });
  };

  const [checklistPanel, setChecklistPanel] = useState(false);
  const [checklistFilter, setChecklistFilter] = useState<"pending" | "done" | "all">("pending");
  const [copyDialog, setCopyDialog] = useState<{ nodeId: string; label: string; kind: string; projectId: string } | null>(null);
  const [annotations, _setAnnotations] = useState<MapAnnotation[]>([]);
  const setAnnotations = useCallback((updater: React.SetStateAction<MapAnnotation[]>) => {
    _setAnnotations(prev => {
      const next = typeof updater === "function" ? (updater as (p: MapAnnotation[]) => MapAnnotation[])(prev) : updater;
      annotationsRef.current = next;
      return next;
    });
  }, []);
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ screenX: number; screenY: number; flowX: number; flowY: number; annotationId?: string; edgeId?: string } | null>(null);
  const [commentsTarget, setCommentsTarget] = useState<{ id: string; label?: string } | null>(null);
  const [paletteCollapsed, setPaletteCollapsed] = useState(() => localStorage.getItem("funis:palette-collapsed") === "true");
  const [libPickerOpen, setLibPickerOpen] = useState(false);
  const [libPickerMode, setLibPickerMode] = useState<"edit" | "new-image">("edit");
  const [imageSourceOpen, setImageSourceOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; label?: string } | null>(null);
  useEffect(() => {
    const h = (e: Event) => { if (!(e instanceof CustomEvent)) return; const detail = record(e.detail); if (typeof detail.url === "string") setLightbox({ url: detail.url, label: typeof detail.label === "string" ? detail.label : undefined }); };
    window.addEventListener("open-image-lightbox", h);
    return () => window.removeEventListener("open-image-lightbox", h);
  }, []);
  const { setCenter, screenToFlowPosition, fitView } = useReactFlow();
  const navigate = useNavigate();
  useEffect(() => {
    localStorage.setItem("funis:palette-collapsed", String(paletteCollapsed));
  }, [paletteCollapsed]);

  // load maps list
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("imphq_company_maps").select("id,name").order("created_at");
      const list = data || [];
      if (initialProjectId) {
        const curProj = projects.find(p => p.id === initialProjectId);
        const projMapName = curProj ? `Mapa · ${curProj.name}` : `Mapa · ${initialProjectId}`;
        const existingMap = list.find(m =>
          m.name.toLowerCase() === projMapName.toLowerCase() ||
          (curProj && m.name.toLowerCase().includes(curProj.name.toLowerCase()))
        );
        if (existingMap) {
          setMaps(list);
          setMapId(existingMap.id);
        } else {
          const { data: created } = await supabase.from("imphq_company_maps").insert({ name: projMapName }).select("id,name").single();
          if (created) {
            setMaps([created, ...list]);
            setMapId(created.id);
          } else {
            setMaps(list);
            if (list.length > 0) setMapId(list[0].id);
          }
        }
      } else {
        if (list.length === 0) {
          const { data: created } = await supabase.from("imphq_company_maps").insert({ name: "Mapa Principal" }).select("id,name").single();
          if (created) { setMaps([created]); setMapId(created.id); }
        } else {
          setMaps(list);
          setMapId(list[0].id);
        }
      }
    })();
    supabase.from("imphq_funis").select("id,nome").then(({ data }) => setFunis(data || []));
    supabase.from("imphq_flows").select("id,nome").then(({ data }) => setFlows((data || []).map(d => ({ id: d.id, name: d.nome }))));
    supabase.from("imphq_wa_providers").select("id,project_id,provider,display_name,instance_name,phone_number_id,twilio_from,is_active")
      .then(({ data }) => setWaProviders((data || []) as WaProvider[]));
  }, [initialProjectId, projects]);

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
    await supabase.from("imphq_company_map_nodes").update({ checklist: toJson(nextChecklist) }).eq("id", nodeId);
  }, []);

  // Refs to break the loadMap → data → callback recreation loop
  const rawNodesRef = useRef<MapNode[]>([]);
  const projectsRef = useRef(projects);
  const waProvidersRef = useRef<WaProvider[]>([]);
  const waConvCountsRef = useRef<Record<string, number>>({});
  useEffect(() => { rawNodesRef.current = rawNodes; }, [rawNodes]);
  useEffect(() => { projectsRef.current = projects; }, [projects]);
  useEffect(() => { waProvidersRef.current = waProviders; }, [waProviders]);
  useEffect(() => { waConvCountsRef.current = waConvCounts; }, [waConvCounts]);

  const loadMapRef = useRef<((id: string) => Promise<void>) | null>(null);
  const pendingAnnotationLayoutRef = useRef<Record<string, Partial<Pick<MapAnnotation, "x" | "y" | "width" | "height">>>>({});

  // single-node quick actions (stable — read from refs)
  const duplicateNode = useCallback(async (nodeId: string) => {
    const src = await supabase.from("imphq_company_map_nodes").select("*").eq("id", nodeId).maybeSingle();
    const n = src.data;
    if (!n) { toast.error("Nó não encontrado"); return; }
    const { map_id, kind, color, label, description, notes, checklist, position, show_live_kpis, linked_funnel_id, linked_project_id, linked_flow_id, linked_wa_provider_id } = n;
    const { error } = await supabase.from("imphq_company_map_nodes").insert({
      map_id, kind, color, label: `${label} (cópia)`, description, notes,
      checklist: checklist || [],
      position: { x: parsePosition(position).x + 40, y: parsePosition(position).y + 40 },
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
      supabase.from(annTable).select("*").eq("map_id", id),
    ]);
    if (nErr || eErr) { toast.error("Erro ao carregar mapa"); return; }
    const list: MapNode[] = (nds || []).map(n => ({ ...n, position: parsePosition(n.position), checklist: parseChecklist(n.checklist) }));
    setRawNodes(list);
    // tolerante: uma anotação corrompida não pode impedir o mapa inteiro de abrir
    const parsedAnns: MapAnnotation[] = [];
    for (const a of anns || []) {
      try {
        parsedAnns.push(clampAnnotationLayout({ ...a, kind: parseAnnotationKind(a.kind), style: parseAnnotationStyle(a.style) }));
      } catch (err) {
        console.warn("[mapa] anotação ignorada por dados inválidos", a.id, err);
      }
    }
    setAnnotations(parsedAnns);
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
    setEdges((eds || []).map((e) => ({
      id: e.id,
      source: e.source_kind === "annotation" ? `${ANN_PREFIX}${e.source_id}` : e.source_id,
      target: e.target_kind === "annotation" ? `${ANN_PREFIX}${e.target_id}` : e.target_id,
      sourceHandle: e.source_handle || undefined,
      targetHandle: e.target_handle || undefined,
      animated: e.style !== "dashed",
      label: e.label || undefined,
      interactionWidth: 24,
      style: { stroke: "#c9922a", strokeWidth: 2, strokeDasharray: e.style === "dashed" ? "6 4" : undefined, cursor: "pointer" },
    })));
  }, [toggleChecklistItem, duplicateNode, deleteNodeById, openCopyDialog, setAnnotations]);

  loadMapRef.current = loadMap;

  // Re-inject waInfo quando providers/contagens chegam depois do carregamento inicial
  useEffect(() => {
    setNodes(nds => nds.map(n => {
      const pid = n.data.linked_wa_provider_id;
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
      const pid = n.data.linked_project_id;
      const stats = typeof pid === "string" ? liveStats[pid] : null;
      if (n.data.liveStats === stats) return n;
      return { ...n, data: { ...n.data, liveStats: stats } };
    }));
  }, [liveStats]);

  useEffect(() => {
    if (!mapId) return;
    // limpa o mapa anterior para não parecer que a troca não aconteceu
    setNodes([]); setEdges([]); setRawNodes([]); setAnnotations([]); setSelected(null); setSelectedIds([]);
    loadMap(mapId);
  }, [mapId, loadMap, setAnnotations]);

  // Posição no centro da viewport atual (com jitter pra não empilhar)
  const nextDropPosition = useCallback(() => {
    try {
      const c = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      return { x: c.x - 110 + (Math.random() * 80 - 40), y: c.y - 60 + (Math.random() * 80 - 40) };
    } catch {
      return { x: 200 + Math.random() * 400, y: 150 + Math.random() * 300 };
    }
  }, [screenToFlowPosition]);

  // Colar imagem (Ctrl+V) — cria nó novo ou atualiza o nó selecionado
  useEffect(() => {
    if (!mapId) return;
    const IMG_URL_RE = /^https?:\/\/\S+\.(png|jpe?g|webp|gif|avif|svg)(\?.*)?$/i;
    const handler = async (e: ClipboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt?.closest?.('input, textarea, [contenteditable="true"], [role="textbox"]')) return;
      const items = Array.from(e.clipboardData?.items || []);
      const imgItem = items.find(i => i.type.startsWith("image/"));
      let url: string | null = null;
      if (imgItem) {
        const file = imgItem.getAsFile();
        if (!file) return;
        e.preventDefault();
        toast.loading("Enviando imagem colada...", { id: "paste-img" });
        url = await uploadMapImage(mapId, file);
        toast.dismiss("paste-img");
        if (!url) return;
      } else {
        const text = e.clipboardData?.getData("text/plain")?.trim() || "";
        if (!IMG_URL_RE.test(text)) return;
        e.preventDefault();
        url = text;
      }
      if (selected) {
        setSelected({ ...selected, image_url: url });
        await supabase.from("imphq_company_map_nodes").update({ image_url: url }).eq("id", selected.id);
        await loadMap(mapId);
        toast.success("Imagem atualizada");
        return;
      }
      const preset = KIND_PRESETS["imagem"] || KIND_PRESETS.canal;
      const { data } = await supabase.from("imphq_company_map_nodes").insert({
        map_id: mapId, kind: "imagem", color: preset.color,
        label: "Imagem colada", image_url: url,
        position: nextDropPosition(),
      }).select().single();
      if (data) { await loadMap(mapId); toast.success("Imagem colada"); }
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [mapId, selected, loadMap, nextDropPosition]);

  // ---------- Annotations helpers ----------
  const updateAnnotationText = useCallback(async (id: string, text: string) => {
    const annId = id.startsWith(ANN_PREFIX) ? id.slice(ANN_PREFIX.length) : id;
    setAnnotations(list => list.map(a => a.id === annId ? { ...a, text } : a));
    setEditingAnnotationId(null);
    await supabase.from(annTable).update({ text }).eq("id", annId);
  }, [setAnnotations]);

  const updateAnnotationStyle = useCallback(async (id: string, patch: Partial<NonNullable<AnnotationData["style"]>>) => {
    const annId = id.startsWith(ANN_PREFIX) ? id.slice(ANN_PREFIX.length) : id;
    let next: AnnotationData["style"] | undefined;
    setAnnotations(list => list.map(a => {
      if (a.id !== annId) return a;
      next = { ...(a.style || {}), ...patch };
      return { ...a, style: next };
    }));
    if (next) await supabase.from(annTable).update({ style: toJson(next) }).eq("id", annId);
  }, [setAnnotations]);

  const uploadReelImage = useCallback(async (id: string) => {
    if (!mapId) return;
    const file = await pickImageFile();
    if (!file) return;
    toast.loading("Enviando imagem...", { id: "reel-img" });
    const url = await uploadMapImage(mapId, file);
    if (!url) { toast.dismiss("reel-img"); return; }
    await updateAnnotationStyle(id, { thumb: url, thumb_proxy: undefined });
    toast.success("Imagem adicionada", { id: "reel-img" });
  }, [mapId, updateAnnotationStyle]);


  // AI generator for script/copy/ad_asset nodes
  const generateAnnotation = useCallback(async (annNodeId: string, kind: AnnotationKind) => {
    const rawId = annNodeId.startsWith(ANN_PREFIX) ? annNodeId.slice(ANN_PREFIX.length) : annNodeId;
    const src = annotationsRef.current.find(a => a.id === rawId);
    if (!src) return;
    // set generating flag
    setAnnotations(list => list.map(a => a.id === rawId ? { ...a, style: { ...(a.style || {}), generating: true } } : a));
    try {
      const promptByKind: Record<string, string> = {
        script: `Escreva um roteiro curto (Hook + Desenvolvimento + CTA) em pt-BR sobre: "${src.style?.heading || src.text || "produto"}". Máximo 8 linhas, tom estratégico Imperius.`,
        copy: `Escreva uma copy publicitária curta em pt-BR (headline + 2-3 linhas + CTA) sobre: "${src.style?.heading || src.text || "produto"}". Direto, cortante, sem clichê.`,
        ad_asset: `Descreva um briefing de ativo de anúncio (visual, ângulo, mensagem-chave, formato) em pt-BR para: "${src.style?.heading || src.text || "produto"}". Máx 6 linhas.`,
      };
      const prompt = promptByKind[kind] || promptByKind.copy;
      const { data, error } = await supabase.functions.invoke("chat-with-ai", {
        body: { messages: [{ role: "user", content: prompt }] },
      });
      if (error) throw error;
      const response = record(data);
      const choices = Array.isArray(response.choices) ? response.choices : [];
      const message = record(record(choices[0]).message);
      const content = typeof message.content === "string" ? message.content : typeof response.content === "string" ? response.content : "";
      if (!content) throw new Error("Sem resposta");
      const nextText = String(content).trim();
      setAnnotations(list => list.map(a => a.id === rawId ? { ...a, text: nextText, style: { ...(a.style || {}), generating: false } } : a));
      await supabase.from(annTable).update({ text: nextText, style: toJson({ ...(src.style || {}), generating: false }) }).eq("id", rawId);
      toast.success("Gerado");
    } catch (e: unknown) {
      setAnnotations(list => list.map(a => a.id === rawId ? { ...a, style: { ...(a.style || {}), generating: false } } : a));
      toast.error(errorMessage(e) || "Erro ao gerar");
    }
  }, [setAnnotations]);


  // Merge annotations into React Flow nodes whenever they (or edit state) change.
  useEffect(() => {
    setNodes(nds => {
      const base = nds.filter(n => !n.id.startsWith(ANN_PREFIX));
      const previousById = new Map(nds.map(n => [n.id, n]));
      const annNodes: Node[] = annotations.map(raw => {
        const a = clampAnnotationLayout(raw);
        const id = `${ANN_PREFIX}${a.id}`;
        const previous = previousById.get(id);
        const isGenerator = a.kind === "script" || a.kind === "copy" || a.kind === "ad_asset";
        return {
          id,
          type: ANNOTATION_KIND_TO_TYPE[a.kind],
          position: { x: a.x, y: a.y },
          width: a.width,
          height: a.height,
          style: { width: a.width, height: a.height },
          zIndex: a.z_index ?? 0,
          draggable: true,
          selectable: true,
          selected: previous?.selected || editingAnnotationId === id,
          ...(a.kind === "frame" ? { dragHandle: ".frame-handle" } : {}),
          data: {
            kind: a.kind,
            text: a.text || "",
            style: a.style || {},
            editingId: editingAnnotationId,
            onTextChange: updateAnnotationText,
            onUploadImage: (a.kind === "reel" || a.kind === "ad_asset") ? uploadReelImage : undefined,
            onGenerate: isGenerator ? generateAnnotation : undefined,
            onStyleChange: updateAnnotationStyle,
          },
        } as Node;
      });

      return [...annNodes, ...base]; // annotations rendered behind by DOM order + lower zIndex
    });
  }, [annotations, editingAnnotationId, updateAnnotationText, updateAnnotationStyle, uploadReelImage, generateAnnotation]);


  const addAnnotation = useCallback(async (kind: AnnotationKind, x: number, y: number, extraStyle?: AnnotationData["style"], overrideText?: string) => {
    if (!mapId) return;
    const def = ANNOTATION_DEFAULTS[kind];
    const style = { ...(def.style || {}), ...(extraStyle || {}) };
    const payload = {
      map_id: mapId, kind,
      x: x - def.w / 2, y: y - def.h / 2,
      width: def.w, height: def.h,
      text: overrideText ?? def.text, style: toJson(style), z_index: 0,
    };
    const { data, error } = await supabase.from(annTable).insert(payload).select().single();
    if (error) { toast.error("Erro ao adicionar anotação"); return; }
    setAnnotations(list => [...list, { ...data, kind: parseAnnotationKind(data.kind), style: parseAnnotationStyle(data.style) }]);
    if ((kind === "note" || kind === "label" || kind === "frame")) setEditingAnnotationId(`${ANN_PREFIX}${data.id}`);
  }, [mapId, setAnnotations]);

  const [reelDialog, setReelDialog] = useState<{ x: number; y: number } | null>(null);
  const [reelInput, setReelInput] = useState("");

  const submitReels = useCallback(async (baseX: number, baseY: number) => {
    const urls = reelInput.split(/\s+/).map(s => s.trim()).filter(u => /^https?:\/\//i.test(u));
    if (!urls.length) { toast.error("Cole ao menos um link válido"); return; }
    toast.loading(`Buscando preview de ${urls.length} link(s)...`, { id: "reel-preview" });
    await Promise.all(urls.map(async (url, i) => {
      const platform = detectReelPlatform(url);
      let author = extractReelAuthor(url);
      let thumb = extractReelThumb(url);
      let thumb_proxy: string | undefined;
      let title: string | undefined;
      let description: string | undefined;
      try {
        const { data } = await supabase.functions.invoke("link-preview", { body: { url } });
        if (data) {
          thumb = data.thumb || thumb;
          thumb_proxy = data.thumb_proxy;
          author = data.author || author;
          title = data.title;
          description = data.description;
        }
      } catch (e) { console.warn("link-preview falhou", e); }
      const col = i % 4;
      const row = Math.floor(i / 4);
      await addAnnotation("reel", baseX + col * 240, baseY + row * 340, { url, platform, author, thumb, thumb_proxy, title, description }, "");
    }));
    toast.success(`${urls.length} reel(s) adicionado(s)`, { id: "reel-preview" });
    setReelInput("");
    setReelDialog(null);
  }, [reelInput, addAnnotation]);


  const deleteAnnotation = useCallback(async (annId: string) => {
    setAnnotations(list => list.filter(a => a.id !== annId));
    await supabase.from(annTable).delete().eq("id", annId);
  }, [setAnnotations]);

  const duplicateAnnotation = useCallback(async (annId: string) => {
    const src = annotations.find(a => a.id === annId);
    if (!src || !mapId) return;
    const { data, error } = await supabase.from(annTable).insert({
      map_id: mapId, kind: src.kind, x: src.x + 30, y: src.y + 30,
      width: clampAnnotationLayout(src).width, height: clampAnnotationLayout(src).height, text: src.text, style: toJson(src.style || {}), z_index: src.z_index,
    }).select().single();
    if (error) { toast.error("Erro"); return; }
    setAnnotations(list => [...list, { ...data, kind: parseAnnotationKind(data.kind), style: parseAnnotationStyle(data.style) }]);
  }, [annotations, mapId, setAnnotations]);

  const changeAnnotationZ = useCallback(async (annId: string, dir: "up" | "down") => {
    const src = annotations.find(a => a.id === annId); if (!src) return;
    const next = (src.z_index || 0) + (dir === "up" ? 1 : -1);
    setAnnotations(list => list.map(a => a.id === annId ? { ...a, z_index: next } : a));
    await supabase.from(annTable).update({ z_index: next }).eq("id", annId);
  }, [annotations, setAnnotations]);

  const changeArrowOrientation = useCallback(async (annId: string, orientation: "diag-down" | "diag-up" | "horizontal" | "vertical") => {
    const src = annotations.find(a => a.id === annId); if (!src) return;
    const nextStyle = { ...(src.style || {}), orientation };
    setAnnotations(list => list.map(a => a.id === annId ? { ...a, style: nextStyle } : a));
    await supabase.from(annTable).update({ style: toJson(nextStyle) }).eq("id", annId);
  }, [annotations, setAnnotations]);

  const changeAnnotationColor = useCallback(async (annId: string, color: string) => {
    const src = annotations.find(a => a.id === annId); if (!src) return;
    const field = src.kind === "note" ? "bgColor" : "borderColor";
    const nextStyle = { ...(src.style || {}), [field]: color };
    setAnnotations(list => list.map(a => a.id === annId ? { ...a, style: nextStyle } : a));
    await supabase.from(annTable).update({ style: toJson(nextStyle) }).eq("id", annId);
  }, [annotations, setAnnotations]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const currAnns = annotationsRef.current;
    const currRaws = rawNodesRef.current;
    const nearlyEq = (a?: number, b?: number) => a != null && b != null && Math.abs(a - b) < 0.5;

    // ---- Magnetic snap while dragging ----
    const SNAP_TOL = 6;
    const draggingChanges = changes.filter((c): c is NodePositionChange & { position: { x: number; y: number } } => c.type === "position" && !!c.dragging && !!c.position);
    if (draggingChanges.length) {
      // Build bounds for other nodes (not currently dragging)
      const draggingIds = new Set(draggingChanges.map((c) => c.id));
      const others: { id: string; x: number; y: number; w: number; h: number }[] = [];
      // annotations
      for (const a of currAnns) {
        const nid = `${ANN_PREFIX}${a.id}`;
        if (draggingIds.has(nid)) continue;
        others.push({ id: nid, x: a.x, y: a.y, w: a.width, h: a.height });
      }
      // raw map nodes (use width/height if set, otherwise default)
      for (const r of currRaws) {
        if (draggingIds.has(r.id)) continue;
        const w = r.width || 220, h = r.height || 100;
        others.push({ id: r.id, x: r.position?.x || 0, y: r.position?.y || 0, w, h });
      }
      const activeGuides = { v: [] as { x: number; y1: number; y2: number }[], h: [] as { y: number; x1: number; x2: number }[] };
      for (const c of draggingChanges) {
        // moving node size
        const isAnn = c.id.startsWith(ANN_PREFIX);
        const rawId = isAnn ? c.id.slice(ANN_PREFIX.length) : c.id;
        const src = isAnn
          ? currAnns.find(a => a.id === rawId)
          : currRaws.find(r => r.id === rawId);
        if (!src) continue;
        const w = isAnn ? src.width : (src.width || 220);
        const h = isAnn ? src.height : (src.height || 100);
        let x = c.position.x, y = c.position.y;
        // Candidate lines for moving
        const mCands = [
          { key: "l", v: x }, { key: "c", v: x + w / 2 }, { key: "r", v: x + w },
        ];
        const mHCands = [
          { key: "t", v: y }, { key: "m", v: y + h / 2 }, { key: "b", v: y + h },
        ];
        let bestDx: { dx: number; line: number } | null = null;
        let bestDy: { dy: number; line: number } | null = null;
        for (const o of others) {
          const oXs = [o.x, o.x + o.w / 2, o.x + o.w];
          const oYs = [o.y, o.y + o.h / 2, o.y + o.h];
          for (const mc of mCands) {
            for (const ox of oXs) {
              const d = ox - mc.v;
              if (Math.abs(d) <= SNAP_TOL && (!bestDx || Math.abs(d) < Math.abs(bestDx.dx))) bestDx = { dx: d, line: ox };
            }
          }
          for (const mh of mHCands) {
            for (const oy of oYs) {
              const d = oy - mh.v;
              if (Math.abs(d) <= SNAP_TOL && (!bestDy || Math.abs(d) < Math.abs(bestDy.dy))) bestDy = { dy: d, line: oy };
            }
          }
        }
        if (bestDx) { x += bestDx.dx; c.position.x = x; }
        if (bestDy) { y += bestDy.dy; c.position.y = y; }
        // Build guide extents (union of moving node + closest other span)
        if (bestDx) {
          const relevant = others.filter(o => [o.x, o.x + o.w / 2, o.x + o.w].some(v => Math.abs(v - bestDx!.line) < 0.5));
          const y1 = Math.min(y, ...relevant.map(o => o.y));
          const y2 = Math.max(y + h, ...relevant.map(o => o.y + o.h));
          activeGuides.v.push({ x: bestDx.line, y1, y2 });
        }
        if (bestDy) {
          const relevant = others.filter(o => [o.y, o.y + o.h / 2, o.y + o.h].some(v => Math.abs(v - bestDy!.line) < 0.5));
          const x1 = Math.min(x, ...relevant.map(o => o.x));
          const x2 = Math.max(x + w, ...relevant.map(o => o.x + o.w));
          activeGuides.h.push({ y: bestDy.line, x1, x2 });
        }
      }
      setGuides(activeGuides);
    }
    // Clear guides on drop
    if (changes.some((c) => c.type === "position" && c.dragging === false)) {
      setGuides({ v: [], h: [] });
    }



    const normalizedChanges = changes.map((c) => {
      if (c.type !== "dimensions" || !c.dimensions) return c;
      const isAnn = typeof c.id === "string" && c.id.startsWith(ANN_PREFIX);
      const rawId = isAnn ? c.id.slice(ANN_PREFIX.length) : c.id;
      const min = isAnn
        ? ANNOTATION_MIN_SIZE[currAnns.find(a => a.id === rawId)?.kind || "frame"]
        : { w: 1, h: 1 };
      return {
        ...c,
        dimensions: {
          width: clampDimension(c.dimensions.width, min.w),
          height: clampDimension(c.dimensions.height, min.h),
        },
      };
    }) as NodeChange[];

    setNodes(nds => applyNodeChanges(normalizedChanges, nds));
    const resizingAnnotationIds = new Set(
      normalizedChanges
        .filter((c) => c.type === "dimensions" && c.resizing === true && typeof c.id === "string" && c.id.startsWith(ANN_PREFIX))
        .flatMap((c) => "id" in c ? [c.id.slice(ANN_PREFIX.length)] : [])
    );
    normalizedChanges.forEach(async (c) => {
      if (!("id" in c)) return;
      const isAnn = typeof c.id === "string" && c.id.startsWith(ANN_PREFIX);
      const rawId = isAnn ? c.id.slice(ANN_PREFIX.length) : c.id;
      if (c.type === "position" && c.dragging === false && c.position) {
        if (isAnn) {
          const cur = currAnns.find(a => a.id === rawId);
          if (nearlyEq(cur?.x, c.position.x) && nearlyEq(cur?.y, c.position.y)) return;
          setAnnotations(list => list.map(a => a.id === rawId ? { ...a, x: c.position.x, y: c.position.y } : a));
          await supabase.from(annTable).update({ x: c.position.x, y: c.position.y }).eq("id", rawId);
        } else {
          const cur = currRaws.find(r => r.id === c.id);
          const pos = cur?.position;
          if (pos && nearlyEq(pos.x, c.position.x) && nearlyEq(pos.y, c.position.y)) return;
          await supabase.from("imphq_company_map_nodes").update({ position: c.position }).eq("id", c.id);
        }
      } else if (c.type === "position" && isAnn && c.position && resizingAnnotationIds.has(rawId)) {
        pendingAnnotationLayoutRef.current[rawId] = {
          ...pendingAnnotationLayoutRef.current[rawId],
          x: c.position.x,
          y: c.position.y,
        };
      }
      if (c.type === "dimensions" && c.dimensions && (c.resizing === false || c.resizing === undefined)) {
        const min = isAnn
          ? ANNOTATION_MIN_SIZE[currAnns.find(a => a.id === rawId)?.kind || "frame"]
          : { w: 1, h: 1 };
        const width = clampDimension(c.dimensions.width, min.w);
        const height = clampDimension(c.dimensions.height, min.h);
        if (width && height) {
          if (isAnn) {
            const pending = pendingAnnotationLayoutRef.current[rawId] || {};
            const cur = currAnns.find(a => a.id === rawId);
            const patch = { ...pending, width, height };
            delete pendingAnnotationLayoutRef.current[rawId];
            // Skip no-op writes (initial measurement etc.)
            const dimsSame = nearlyEq(cur?.width, width) && nearlyEq(cur?.height, height);
            const posSame = pending.x == null || (nearlyEq(cur?.x, pending.x) && nearlyEq(cur?.y, pending.y));
            if (dimsSame && posSame) return;
            setAnnotations(list => list.map(a => a.id === rawId ? { ...a, ...patch } : a));
            await supabase.from(annTable).update(patch).eq("id", rawId);
          } else {
            const cur = currRaws.find(r => r.id === c.id);
            if (nearlyEq(cur?.width, width) && nearlyEq(cur?.height, height)) return;
            setRawNodes(list => list.map(r => r.id === c.id ? { ...r, width, height } : r));
            await supabase.from("imphq_company_map_nodes").update({ width, height }).eq("id", c.id);
          }
        }
      } else if (c.type === "dimensions" && c.dimensions && c.resizing === true && isAnn) {
        pendingAnnotationLayoutRef.current[rawId] = {
          ...pendingAnnotationLayoutRef.current[rawId],
          width: c.dimensions.width,
          height: c.dimensions.height,
        };
      }
    });
  }, [setAnnotations]);

  const onSelectionChange = useCallback(({ nodes: sel }: { nodes: Node[] }) => {
    setSelectedIds(sel.map(n => n.id));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges(eds => applyEdgeChanges(changes, eds));
    changes.forEach(async (c) => {
      if (c.type === "remove") {
        await supabase.from("imphq_company_map_edges").delete().eq("id", c.id);
      }
    });
  }, []);

  const onConnect = useCallback(async (conn: Connection) => {
    if (!mapId || !conn.source || !conn.target) return;
    const srcIsAnn = conn.source.startsWith(ANN_PREFIX);
    const tgtIsAnn = conn.target.startsWith(ANN_PREFIX);
    const source_id = srcIsAnn ? conn.source.slice(ANN_PREFIX.length) : conn.source;
    const target_id = tgtIsAnn ? conn.target.slice(ANN_PREFIX.length) : conn.target;
    const { data, error } = await supabase.from("imphq_company_map_edges")
      .insert({ map_id: mapId, source_id, target_id, source_kind: srcIsAnn ? "annotation" : "node", target_kind: tgtIsAnn ? "annotation" : "node", source_handle: conn.sourceHandle || null, target_handle: conn.targetHandle || null })
      .select().single();
    if (error) { toast.error("Erro ao conectar"); return; }
    if (data) setEdges(eds => addEdge({ id: data.id, source: conn.source!, target: conn.target!, sourceHandle: conn.sourceHandle || undefined, targetHandle: conn.targetHandle || undefined, animated: true, interactionWidth: 24, style: { stroke: "#c9922a", strokeWidth: 2, cursor: "pointer" } }, eds));
  }, [mapId]);

  const deleteEdgeById = useCallback(async (edgeId: string) => {
    setEdges(eds => eds.filter(e => e.id !== edgeId));
    await supabase.from("imphq_company_map_edges").delete().eq("id", edgeId);
    toast.success("Conexão removida");
  }, []);

  const createImageNode = async (image_url: string, label: string) => {
    if (!mapId) return;
    const preset = KIND_PRESETS.imagem || KIND_PRESETS.canal;
    const { data } = await supabase.from("imphq_company_map_nodes").insert({
      map_id: mapId, kind: "imagem", color: preset.color,
      label: label || `Novo ${preset.label}`,
      image_url,
      position: nextDropPosition(),
    }).select().single();
    if (data) { await loadMap(mapId); toast.success(`${preset.label} adicionado`); }
  };

  const handleUploadImageNode = async () => {
    if (!mapId) return;
    const file = await pickImageFile();
    if (!file) return;
    const t = toast.loading("Enviando imagem...");
    const url = await uploadMapImage(mapId, file);
    toast.dismiss(t);
    if (!url) return;
    await createImageNode(url, file.name.replace(/\.[^.]+$/, ""));
  };

  const addNode = async (kind: string, customLabel?: string) => {
    if (!mapId) return;
    const preset = KIND_PRESETS[kind] || KIND_PRESETS.canal;

    // Imagem: perguntar Biblioteca vs Upload antes
    if (kind === "imagem") {
      setImageSourceOpen(true);
      return;
    }

    const { data } = await supabase.from("imphq_company_map_nodes").insert({
      map_id: mapId, kind, color: preset.color,
      label: customLabel || `Novo ${preset.label}`,
      image_url: null,
      position: nextDropPosition(),
      linked_project_id: initialProjectId || null,
    }).select().single();
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

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    // Se há multi-seleção ativa, não abrir painel (permitir mover em grupo)
    if (selectedIds.length > 1 && selectedIds.includes(node.id)) return;
    const raw = rawNodes.find(r => r.id === node.id);
    if (raw) setSelected({ ...raw, checklist: raw.checklist || [] });
  };

  // ---- Group drag: arrastar frame move tudo que está dentro ----
  type GroupChild = { id: string; isAnn: boolean; startX: number; startY: number };
  const groupDragRef = useRef<{ frameId: string; frameStart: { x: number; y: number }; children: GroupChild[] } | null>(null);

  const onNodeDragStart = useCallback((_: MouseEvent | TouchEvent, node: Node) => {
    if (!node.id.startsWith(ANN_PREFIX)) return;
    const rawId = node.id.slice(ANN_PREFIX.length);
    const frame = annotationsRef.current.find(a => a.id === rawId && a.kind === "frame");
    if (!frame) return;
    const fx = frame.x, fy = frame.y, fw = frame.width, fh = frame.height;
    const insideCenter = (cx: number, cy: number) => cx >= fx && cx <= fx + fw && cy >= fy && cy <= fy + fh;
    const children: GroupChild[] = [];
    for (const a of annotationsRef.current) {
      if (a.id === frame.id || a.kind === "frame") continue;
      const cx = a.x + a.width / 2, cy = a.y + a.height / 2;
      if (insideCenter(cx, cy)) children.push({ id: `${ANN_PREFIX}${a.id}`, isAnn: true, startX: a.x, startY: a.y });
    }
    for (const r of rawNodesRef.current) {
      const w = r.width || 220, h = r.height || 100;
      const px = r.position?.x || 0, py = r.position?.y || 0;
      const cx = px + w / 2, cy = py + h / 2;
      if (insideCenter(cx, cy)) children.push({ id: r.id, isAnn: false, startX: px, startY: py });
    }
    groupDragRef.current = { frameId: node.id, frameStart: { x: fx, y: fy }, children };
  }, []);

  const onNodeDrag = useCallback((_: MouseEvent | TouchEvent, node: Node) => {
    const g = groupDragRef.current;
    if (!g || g.frameId !== node.id) return;
    const dx = node.position.x - g.frameStart.x;
    const dy = node.position.y - g.frameStart.y;
    if (dx === 0 && dy === 0) return;
    setNodes(nds => {
      const byId = new Map(g.children.map(c => [c.id, c]));
      return nds.map(n => {
        const c = byId.get(n.id);
        if (!c) return n;
        return { ...n, position: { x: c.startX + dx, y: c.startY + dy } };
      });
    });
  }, []);

  const onNodeDragStop = useCallback(async (_: MouseEvent | TouchEvent, node: Node) => {
    const g = groupDragRef.current;
    if (!g || g.frameId !== node.id) { groupDragRef.current = null; return; }
    const dx = node.position.x - g.frameStart.x;
    const dy = node.position.y - g.frameStart.y;
    groupDragRef.current = null;
    if (dx === 0 && dy === 0) return;
    const annUpdates: { id: string; x: number; y: number }[] = [];
    const rawUpdates: { id: string; x: number; y: number }[] = [];
    for (const c of g.children) {
      const nx = c.startX + dx, ny = c.startY + dy;
      if (c.isAnn) annUpdates.push({ id: c.id.slice(ANN_PREFIX.length), x: nx, y: ny });
      else rawUpdates.push({ id: c.id, x: nx, y: ny });
    }
    if (annUpdates.length) {
      const annMap = new Map(annUpdates.map(u => [u.id, u]));
      setAnnotations(list => list.map(a => {
        const u = annMap.get(a.id);
        return u ? { ...a, x: u.x, y: u.y } : a;
      }));
    }
    if (rawUpdates.length) {
      const rawMap = new Map(rawUpdates.map(u => [u.id, u]));
      setRawNodes(list => list.map(r => {
        const u = rawMap.get(r.id);
        return u ? ({ ...r, position: { x: u.x, y: u.y } }) : r;
      }));
    }
    await Promise.all([
      ...annUpdates.map(u => supabase.from(annTable).update({ x: u.x, y: u.y }).eq("id", u.id)),
      ...rawUpdates.map(u => supabase.from("imphq_company_map_nodes").update({ position: { x: u.x, y: u.y } }).eq("id", u.id)),
    ]);
  }, [setAnnotations]);

  const persistSelected = async (node: MapNode, opts?: { silent?: boolean }) => {
    const { error } = await supabase.from("imphq_company_map_nodes").update({
      label: node.label, description: node.description, notes: node.notes,
      color: node.color, kind: node.kind, checklist: toJson(node.checklist),
      size: node.size || "M",
      url: node.url || null,
      image_url: node.image_url || null,
      show_live_kpis: !!node.show_live_kpis,
      linked_funnel_id: node.linked_funnel_id || null,
      linked_project_id: node.linked_project_id || null,
      linked_flow_id: node.linked_flow_id || null,
      linked_wa_provider_id: node.linked_wa_provider_id || null,
    }).eq("id", node.id);
    if (error) {
      if (!opts?.silent) toast.error("Erro ao salvar");
      return false;
    }
    return true;
  };

  const saveSelected = async () => {
    if (!selected) return;
    if (autoSaveTimerRef.current) { window.clearTimeout(autoSaveTimerRef.current); autoSaveTimerRef.current = null; }
    const ok = await persistSelected(selected);
    if (!ok) return;
    toast.success("Salvo");
    if (mapId) await loadMap(mapId);
    setSelected(null);
  };

  // Auto-save on change (debounced) + flush on close
  useEffect(() => {
    if (!selected) return;
    // Skip first render for a freshly opened node
    if (selectedBaselineIdRef.current !== selected.id) {
      selectedBaselineIdRef.current = selected.id;
      setAutoSaveStatus("idle");
      return;
    }
    if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    setAutoSaveStatus("saving");
    const snapshot = selected;
    autoSaveTimerRef.current = window.setTimeout(async () => {
      const ok = await persistSelected(snapshot, { silent: true });
      setAutoSaveStatus(ok ? "saved" : "error");
      // reflect on canvas
      if (ok) {
        setNodes(nds => nds.map(n => n.id === snapshot.id ? { ...n, data: { ...n.data, ...snapshot } } : n));
        setRawNodes(prev => prev.map(n => n.id === snapshot.id ? { ...n, ...snapshot } : n));
      }
    }, 700);
    return () => {
      if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    };

  }, [selected]);

  const flushAndClose = async () => {
    if (autoSaveTimerRef.current) { window.clearTimeout(autoSaveTimerRef.current); autoSaveTimerRef.current = null; }
    if (selected) {
      setAutoSaveStatus("saving");
      const ok = await persistSelected(selected, { silent: true });
      setAutoSaveStatus(ok ? "saved" : "error");
      if (ok && mapId) await loadMap(mapId);
    }
    setSelected(null);
    selectedBaselineIdRef.current = null;
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
    catch (e: unknown) { toast.error(errorMessage(e) || "Erro", { id: t }); }
  };

  const handleAutopopulateProject = async (projectId: string) => {
    if (!mapId) return;
    const proj = projects.find(p => p.id === projectId);
    if (!confirm(`Gerar mapa do projeto "${proj?.name || projectId}"? Os nós atuais serão substituídos.`)) return;
    const t = toast.loading("Gerando mapa do projeto...");
    try { await autopopulateFromProject(mapId, projectId); await loadMap(mapId); toast.success("Mapa do projeto gerado", { id: t }); }
    catch (e: unknown) { toast.error(errorMessage(e) || "Erro", { id: t }); }
  };

  const handleGenerateAiFlow = async () => {
    if (!mapId) return;
    setAiFlowGenerating(true);
    const toastId = toast.loading("Desenhando fluxo com IA...");

    try {
      const projId = effectiveProjectId || projects[0]?.id;
      const curProj = projects.find(p => p.id === projId);
      const chosenProd = aiFlowProduct || (projectProductsList[0]?.nome || projectProductsList[0]?.name) || "Produto Principal";

      if (aiFlowReplace) {
        await supabase.from("imphq_company_map_edges").delete().eq("map_id", mapId);
        await supabase.from("imphq_company_map_nodes").delete().eq("map_id", mapId);
      }

      let draftNodes: {
        key: string;
        kind: string;
        label: string;
        description?: string;
        checklist: string[];
        col: number;
        row: number;
        product_name?: string;
        executor?: string;
        skill?: string;
        prompt?: string;
      }[] = [];
      let draftEdges: { from: string; to: string; label?: string; style?: "solid" | "dashed" }[] = [];

      if (aiFlowPreset === "lancamento_whatsapp") {
        draftNodes = [
          {
            key: "ad_convite", kind: "anuncio", label: "Meta Ads · Convite Grupo VIP",
            description: "Criativos de atração com foco no evento / condição secreta",
            checklist: ["Roteiro de convite aprovado", "Gravar 3 variações de gancho", "Subir campanha de tráfego"],
            col: 0, row: 0, executor: "ai_higgsfield", skill: "skill-black-belt",
            prompt: `Gerar 3 criativos em vídeo 9:16 chamando para o grupo VIP do produto ${chosenProd}. Gancho de curiosidade, condição secreta e revelação exclusiva.`
          },
          {
            key: "optin_page", kind: "captura", label: "Página de Captura / Inscrição",
            description: "Redirecionamento automático com link do WhatsApp",
            checklist: ["Headline de curiosidade", "Botão de redirecionamento para o Grupo VIP", "Pixel de Lead ativo"],
            col: 1, row: 0, executor: "ai_copywriter", skill: "rebel-copy",
            prompt: `Escrever headline de alta conversão para página de captura com redirecionamento direto para o Grupo VIP do WhatsApp para ${chosenProd}.`
          },
          {
            key: "wa_vip", kind: "whatsapp", label: "Grupos VIP WhatsApp (D-7 a D0)",
            description: "Régua cronometrada de aquecimento e antecipação",
            checklist: ["Criar grupos 01 a 05", "Agendar mensagens de D-7 a D-1", "Áudios de bastidores do expert"],
            col: 2, row: 0, executor: "openflow", skill: "roteiros-virais-comment-to-dm",
            prompt: `Montar cronograma de aquecimento D-7 a D0 nos Grupos VIP com áudios de bastidores, avisos de horário e antecipação da oferta.`
          },
          {
            key: "live_pitch", kind: "youtube", label: "Live no YouTube · Pitch de Vendas",
            description: "Apresentação da oportunidade, ancoragem e abertura",
            checklist: ["Slides de apresentação finalizados", "Stack de bônus exclusivos", "Link da transmissão privado"],
            col: 3, row: 0, executor: "ai_copywriter", skill: "mecanismo-vsl",
            prompt: `Estruturar roteiro de pitch ao vivo (Slide a Slide) com ancoragem, mecanismo único do produto e stack de bônus exclusivos.`
          },
          {
            key: "checkout_abertura", kind: "checkout", label: `Abertura de Carrinho · ${chosenProd}`, product_name: chosenProd,
            description: "Link exclusivo liberado nos grupos com tempo limitado",
            checklist: ["Liberar link com cupom exclusivo", "Timer de encerramento em 24h", "Testar compra teste"],
            col: 4, row: 0, executor: "human_traffic", skill: "briefing-gestor-trafego",
            prompt: `Configurar checkout com cupom especial de abertura, timer regressivo e disparo de evento de compra no pixel.`
          },
          {
            key: "wa_suporte", kind: "whatsapp", label: "Plantão X1 · Dúvidas e Pix",
            description: "Recuperação no 1 a 1 para quem gerou Pix ou travou",
            checklist: ["IA ou operadores no WhatsApp", "Scripts para quebra de objeções de cartão/limite"],
            col: 4, row: 1, executor: "openflow", skill: "roteiros-virais-comment-to-dm",
            prompt: `Plantão 1 a 1 de recuperação de Pix gerado e quebra de objeções de limite de cartão no WhatsApp.`
          },
        ];
        draftEdges = [
          { from: "ad_convite", to: "optin_page", label: "Clique no Anúncio" },
          { from: "optin_page", to: "wa_vip", label: "Entrou no Grupo VIP" },
          { from: "wa_vip", to: "live_pitch", label: "Link da Live (D0)" },
          { from: "live_pitch", to: "checkout_abertura", label: "Abertura de Carrinho" },
          { from: "checkout_abertura", to: "wa_suporte", label: "Dúvida / Pix Gerado", style: "dashed" },
        ];
      } else if (aiFlowPreset === "high_ticket_x1") {
        draftNodes = [
          {
            key: "ad_direct", kind: "anuncio", label: "Meta / Reels · Direto para WhatsApp",
            description: "Anúncio focado em filtro de qualificação do cliente ideal",
            checklist: ["Criativo de filtro de faturamento/perfil", "Link wa.me com mensagem inicial pronta"],
            col: 0, row: 0, executor: "ai_higgsfield", skill: "skill-black-belt",
            prompt: `Criativo direto de filtro e qualificação para mentoria/consultoria de ${chosenProd}. Foco em empresários/profissionais prontos para avançar.`
          },
          {
            key: "wa_sdr", kind: "whatsapp", label: "WhatsApp SDR IA · Triagem & SPIN",
            description: "Qualificação consultiva automática antes da proposta",
            checklist: ["Configurar IA consultiva no OpenFlow", "Definir perguntas de qualificação", "Simular 3 testes"],
            col: 1, row: 0, executor: "openflow", skill: "roteiros-virais-comment-to-dm",
            prompt: `Configurar fluxo de qualificação SPIN Selling com IA no OpenFlow: faturamento, gargalo atual, urgência e triagem de score > 70.`
          },
          {
            key: "proposta", kind: "processo", label: "Apresentação de Proposta / Closer",
            description: "Sessão de diagnóstico ou chamada de fechamento",
            checklist: ["Script de ancoragem de valor", "Superação de objeções de garantia"],
            col: 2, row: 0, executor: "ai_copywriter", skill: "rebel-copy",
            prompt: `Deck e roteiro de apresentação de proposta irresistível com garantia de resultado e ancoragem de investimento.`
          },
          {
            key: "checkout_vip", kind: "checkout", label: `Link de Pagamento VIP · ${chosenProd}`, product_name: chosenProd,
            description: "Condição exclusiva de adesão imediata",
            checklist: ["Gerar link de pagamento único", "Termo de compromisso / onboarding"],
            col: 3, row: 0, executor: "human_traffic", skill: "briefing-gestor-trafego",
            prompt: `Gerar link de pagamento exclusivo com condição negociada no X1 e ativação imediata.`
          },
          {
            key: "onboarding", kind: "area_membros", label: "Onboarding VIP & Kick-off",
            description: "Acolhimento imediato e primeira entrega de valor",
            checklist: ["Formulário de diagnóstico inicial", "Agendamento da sessão individual"],
            col: 4, row: 0, executor: "openflow", skill: "openflow",
            prompt: `Disparo imediato de formulário de diagnóstico e boas-vindas do expert após confirmação de pagamento.`
          },
        ];
        draftEdges = [
          { from: "ad_direct", to: "wa_sdr", label: "Iniciou conversa" },
          { from: "wa_sdr", to: "proposta", label: "Qualificado (Score > 70)" },
          { from: "proposta", to: "checkout_vip", label: "Proposta Aceita" },
          { from: "checkout_vip", to: "onboarding", label: "Pagamento Confirmado" },
        ];
      } else if (aiFlowPreset === "tripwire_ascensao") {
        draftNodes = [
          {
            key: "ad_tripwire", kind: "anuncio", label: "Meta Ads · Isca / Oferta Irresistível",
            description: "Produto de entrada de R$ 19 a R$ 47 com baixo atrito",
            checklist: ["Criativo focado em solução rápida de dor", "Subir tráfego para conversão de compra"],
            col: 0, row: 0, executor: "ai_higgsfield", skill: "skill-black-belt",
            prompt: `Criativo de alta atração para produto de entrada de R$ 27 focado na solução rápida de uma dor aguda de ${chosenProd}.`
          },
          {
            key: "checkout_front", kind: "checkout", label: `Checkout Front-End (R$ 27) · ${chosenProd}`, product_name: chosenProd,
            checklist: ["Página de checkout limpa com depoimentos", "Garantia incondicional de 7 dias"],
            col: 1, row: 0, executor: "human_traffic", skill: "briefing-gestor-trafego",
            prompt: `Página de checkout de conversão com selos de segurança, garantia de 7 dias e depoimentos em carrossel.`
          },
          {
            key: "bump_acelerador", kind: "orderbump", label: "Orderbump · Acelerador / Template",
            description: "Oferta complementar de R$ 17 para elevar o ticket médio",
            checklist: ["Copy do bump", "Preço complementar R$ 17 - R$ 27"],
            col: 1, row: 1, executor: "ai_copywriter", skill: "tripwire-matador-v2",
            prompt: `Copy do Orderbump de R$ 17 a R$ 27: Acelerador ou template que complementa o produto de entrada.`
          },
          {
            key: "upsell_core", kind: "upsell", label: "1-Click Upsell · Treinamento Completo",
            description: "Oferta principal (Core Offer R$ 197 - R$ 497)",
            checklist: ["Vídeo de 90s do upsell", "Configurar 1-click automático na plataforma"],
            col: 2, row: 0, executor: "ai_copywriter", skill: "rebel-copy",
            prompt: `Vídeo de 90 segundos de 1-Click Upsell apresentando o treinamento completo ou protocolo mestre de R$ 297.`
          },
          {
            key: "downsell_core", kind: "downsell", label: "Downsell · Versão Essencial",
            description: "Parcelamento estendido ou versão sem bônus",
            checklist: ["Página alternativa de downsell"],
            col: 2, row: 1, executor: "ai_copywriter", skill: "rebel-copy",
            prompt: `Copy de downsell facilitado com parcelamento estendido ou versão essencial para recuperar a recusa do upsell.`
          },
          {
            key: "comunidade", kind: "area_membros", label: "Área de Membros & Boas-Vindas",
            description: "Entrega imediata dos acessos e nivelamento",
            checklist: ["Envio de acesso por e-mail e WhatsApp", "Vídeo de boas-vindas liberado"],
            col: 3, row: 0, executor: "openflow", skill: "openflow",
            prompt: `Régua de entrega de acessos no WhatsApp e boas-vindas na área de membros.`
          },
        ];
        draftEdges = [
          { from: "ad_tripwire", to: "checkout_front", label: "Clique" },
          { from: "checkout_front", to: "bump_acelerador", label: "Adicionou Bump" },
          { from: "checkout_front", to: "upsell_core", label: "Compra Aprovada" },
          { from: "upsell_core", to: "downsell_core", label: "Recusou Upsell", style: "dashed" },
          { from: "upsell_core", to: "comunidade", label: "Aceitou Upsell" },
          { from: "downsell_core", to: "comunidade", label: "Concluiu Compra" },
        ];
      } else {
        // vsl_perpetuo (padrão)
        draftNodes = [
          {
            key: "ad_dor", kind: "anuncio", label: "Meta Ads · Gancho de Dor Aguda",
            description: "Criativo focado no sintoma e frustração imediata",
            checklist: ["Roteiro aprovado", "Gravar criativo", "Subir no Meta Ads"],
            col: 0, row: 0, executor: "ai_higgsfield", skill: "skill-black-belt",
            prompt: `Vídeo 9:16 vertical atacando o sintoma mais doloroso e frustrante do avatar de ${chosenProd}. Seedance 2.0 / Veo 3 com legendas de retenção.`
          },
          {
            key: "ad_vilao", kind: "anuncio", label: "Meta Ads · Inimigo Oculto",
            description: "Ângulo do mecanismo único que desmascara métodos velhos",
            checklist: ["Roteiro aprovado", "Gravar criativo", "Subir no Meta Ads"],
            col: 0, row: 1, executor: "ai_higgsfield", skill: "skill-black-belt",
            prompt: `Vídeo 9:16 revelando o Inimigo Oculto e explicando por que métodos convencionais falharam antes de ${chosenProd}.`
          },
          {
            key: "ad_ugc", kind: "anuncio", label: "Meta Ads · Depoimento UGC",
            description: "Prova social de quem já obteve o resultado desejado",
            checklist: ["Separar print/vídeo real", "Subir no Meta Ads"],
            col: 0, row: 2, executor: "ai_google_flow", skill: "pipeline-video-viral",
            prompt: `Vídeo depoimento estilo UGC espontâneo com pessoa real mostrando a transformação após usar ${chosenProd}.`
          },
          {
            key: "page_vsl", kind: "vsl", label: "Página de Vendas / Advertorial VSL",
            description: "Página de alta conversão com narrativa e pitch",
            checklist: ["Hospedar vídeo VSL", "Configurar delay do botão CTA", "Validar carregamento no mobile"],
            col: 1, row: 0, executor: "ai_copywriter", skill: "mecanismo-vsl",
            prompt: `Página advertorial e roteiro de VSL com pitch irresistível, delay de botão CTA sincronizado e quebra de objeções.`
          },
          {
            key: "checkout_main", kind: "checkout", label: `Checkout · ${chosenProd}`, product_name: chosenProd,
            description: "Página de pagamento segura com garantias",
            checklist: ["Configurar pixel de conversão", "Garantia incondicional de 30 dias", "Fazer compra teste"],
            col: 2, row: 0, executor: "human_traffic", skill: "briefing-gestor-trafego",
            prompt: `Configurar produto ${chosenProd} na Kiwify/Hotmart, cadastrar pixel de compra e testar checkout no mobile.`
          },
          {
            key: "bump_extra", kind: "orderbump", label: "Orderbump · Pote Extra / Guia Rápido",
            description: "Oferta complementar de impulso (R$ 27 - R$ 47)",
            checklist: ["Headline persuasiva do bump", "Preço R$ 27 - R$ 47"],
            col: 2, row: 1, executor: "ai_copywriter", skill: "tripwire-matador-v2",
            prompt: `Copy de impulso do Orderbump: Oferta de 1 pote extra ou guia de receitas aceleradoras por R$ 27 a R$ 47.`
          },
          {
            key: "upsell_anual", kind: "upsell", label: "1-Click Upsell · Kit Completo",
            description: "Alavanca imediata de ticket médio (AOV)",
            checklist: ["Vídeo de 60s do upsell", "Configurar 1-click na plataforma de pagamento"],
            col: 3, row: 0, executor: "ai_copywriter", skill: "rebel-copy",
            prompt: `Página e roteiro de 1-Click Upsell imediato para kit anual com maior margem de lucro e ancoragem brutal.`
          },
          {
            key: "downsell_leve", kind: "downsell", label: "Downsell · Condição Facilitada",
            description: "Opção parcelada ou quantidade reduzida",
            checklist: ["Página alternativa de downsell"],
            col: 3, row: 1, executor: "ai_copywriter", skill: "rebel-copy",
            prompt: `Oferta alternativa de downsell com menor barreira de entrada para quem recusa o upsell anual.`
          },
          {
            key: "wa_recuperacao", kind: "whatsapp", label: "WhatsApp X1 · Resgate de Abandono",
            description: "Disparo automático após 15min / 2h de carrinho abandonado",
            checklist: ["Conectar instância WhatsApp", "Ativar régua no OpenFlow", "Testar mensagem de 15min"],
            col: 2, row: 2, executor: "openflow", skill: "roteiros-virais-comment-to-dm",
            prompt: `Automação no OpenFlow: Mensagem amigável de suporte 15min após abandono de carrinho e lembrete de Pix em 2h.`
          },
        ];
        draftEdges = [
          { from: "ad_dor", to: "page_vsl", label: "Clique no Anúncio" },
          { from: "ad_vilao", to: "page_vsl", label: "Clique no Anúncio" },
          { from: "ad_ugc", to: "page_vsl", label: "Clique no Anúncio" },
          { from: "page_vsl", to: "checkout_main", label: "Clique no CTA" },
          { from: "checkout_main", to: "bump_extra", label: "Adicionou Bump" },
          { from: "checkout_main", to: "upsell_anual", label: "Compra Aprovada" },
          { from: "upsell_anual", to: "downsell_leve", label: "Recusou Upsell", style: "dashed" },
          { from: "checkout_main", to: "wa_recuperacao", label: "Abandono de Carrinho / Pix", style: "dashed" },
        ];
      }

      if (aiFlowPreset === "custom" && aiFlowCustomText.trim()) {
        draftNodes[0].label = `Anúncio · ${aiFlowCustomText.slice(0, 32)}`;
        draftNodes[0].prompt = aiFlowCustomText;
      }

      const keyToId: Record<string, string> = {};
      for (const dn of draftNodes) {
        const x = dn.col * 350 + 60;
        const y = dn.row * 180 + 60;

        let notes = dn.product_name ? `[product_name:${dn.product_name}]\n` : "";
        if (dn.executor) notes += `[agent_executor:${dn.executor}]\n`;
        if (dn.skill) notes += `[agent_skill:${dn.skill}]\n`;
        if (dn.prompt) notes += `[agent_prompt_start]\n${dn.prompt}\n[agent_prompt_end]\n`;
        if (dn.description) notes += dn.description;

        const { data: createdNode, error: nodeErr } = await supabase.from("imphq_company_map_nodes").insert({
          map_id: mapId,
          label: dn.label,
          kind: dn.kind,
          color: KIND_PRESETS[dn.kind]?.color || "#c9922a",
          description: dn.description || null,
          notes: notes.trim() || null,
          position: { x, y },
          size: "M",
          checklist: (dn.checklist || []).map(t => ({ id: crypto.randomUUID(), text: t, done: false })),
          linked_project_id: projId,
          show_live_kpis: true,
        }).select("id").single();

        if (nodeErr) throw nodeErr;
        if (createdNode) {
          keyToId[dn.key] = createdNode.id;
        }
      }

      for (const de of draftEdges) {
        const srcId = keyToId[de.from];
        const tgtId = keyToId[de.to];
        if (srcId && tgtId) {
          await supabase.from("imphq_company_map_edges").insert({
            map_id: mapId,
            source_id: srcId,
            target_id: tgtId,
            label: de.label || null,
            style: de.style || "solid",
          });
        }
      }

      await loadMap(mapId);
      setAiFlowModalOpen(false);
      toast.success("Fluxo operacional desenhado com sucesso!", { id: toastId });
      setTimeout(() => fitView({ duration: 800 }), 300);

    } catch (e: any) {
      console.error("Erro ao desenhar fluxo com IA:", e);
      toast.error(errorMessage(e) || "Erro ao desenhar com IA", { id: toastId });
    } finally {
      setAiFlowGenerating(false);
    }
  };

  const handleExport = async () => {
    try { await exportMapPng(); toast.success("PNG baixado"); }
    catch (e: unknown) { toast.error(errorMessage(e) || "Erro ao exportar"); }
  };

  const handleExportJson = () => {
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        mapId,
        nodes: rawNodes,
        edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target })),
        annotations,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mapa-${mapId || "sem-id"}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success("JSON baixado");
    } catch (e: unknown) { toast.error(errorMessage(e) || "Erro ao exportar JSON"); }
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
      checklist: toJson(n.checklist || []),
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

  // ============ Alignment & distribution ============
  type SelBounds = { id: string; isAnn: boolean; x: number; y: number; w: number; h: number };
  const collectSelectedBounds = useCallback((): SelBounds[] => {
    const out: SelBounds[] = [];
    for (const id of selectedIds) {
      if (id.startsWith(ANN_PREFIX)) {
        const rid = id.slice(ANN_PREFIX.length);
        const a = annotationsRef.current.find(x => x.id === rid);
        if (a) out.push({ id, isAnn: true, x: a.x, y: a.y, w: a.width, h: a.height });
      } else {
        const r = rawNodesRef.current.find(x => x.id === id);
        if (r) out.push({ id, isAnn: false, x: r.position?.x || 0, y: r.position?.y || 0, w: r.width || 220, h: r.height || 100 });
      }
    }
    return out;
  }, [selectedIds]);

  const applyBulkPositions = useCallback(async (updates: { id: string; isAnn: boolean; x: number; y: number }[]) => {
    // Local state
    setAnnotations(list => list.map(a => {
      const u = updates.find(u => u.isAnn && u.id === `${ANN_PREFIX}${a.id}`);
      return u ? { ...a, x: u.x, y: u.y } : a;
    }));
    setRawNodes(list => list.map((r) => {
      const u = updates.find(u => !u.isAnn && u.id === r.id);
      return u ? { ...r, position: { x: u.x, y: u.y } } : r;
    }));
    setNodes(nds => nds.map(n => {
      const u = updates.find(u => u.id === n.id);
      return u ? { ...n, position: { x: u.x, y: u.y } } : n;
    }));
    // Persist
    await Promise.all(updates.map(u =>
      u.isAnn
        ? supabase.from(annTable).update({ x: u.x, y: u.y }).eq("id", u.id.slice(ANN_PREFIX.length))
        : supabase.from("imphq_company_map_nodes").update({ position: { x: u.x, y: u.y } }).eq("id", u.id)
    ));
  }, [setAnnotations]);

  const alignSelected = useCallback((mode: "left" | "cx" | "right" | "top" | "cy" | "bottom") => {
    const items = collectSelectedBounds();
    if (items.length < 2) return;
    let target: number;
    const updates = items.map(it => {
      let nx = it.x, ny = it.y;
      switch (mode) {
        case "left":   target = Math.min(...items.map(i => i.x));                     nx = target; break;
        case "cx":     target = items.reduce((s, i) => s + i.x + i.w / 2, 0) / items.length; nx = target - it.w / 2; break;
        case "right":  target = Math.max(...items.map(i => i.x + i.w));               nx = target - it.w; break;
        case "top":    target = Math.min(...items.map(i => i.y));                     ny = target; break;
        case "cy":     target = items.reduce((s, i) => s + i.y + i.h / 2, 0) / items.length; ny = target - it.h / 2; break;
        case "bottom": target = Math.max(...items.map(i => i.y + i.h));               ny = target - it.h; break;
      }
      return { id: it.id, isAnn: it.isAnn, x: Math.round(nx), y: Math.round(ny) };
    });
    applyBulkPositions(updates);
  }, [collectSelectedBounds, applyBulkPositions]);

  const distributeSelected = useCallback((axis: "h" | "v") => {
    const items = collectSelectedBounds();
    if (items.length < 3) { toast.info("Selecione 3+ para distribuir"); return; }
    const sorted = [...items].sort((a, b) => axis === "h" ? (a.x + a.w / 2) - (b.x + b.w / 2) : (a.y + a.h / 2) - (b.y + b.h / 2));
    const first = sorted[0], last = sorted[sorted.length - 1];
    const startC = axis === "h" ? first.x + first.w / 2 : first.y + first.h / 2;
    const endC   = axis === "h" ? last.x + last.w / 2 : last.y + last.h / 2;
    const step = (endC - startC) / (sorted.length - 1);
    const updates = sorted.map((it, i) => {
      const c = startC + step * i;
      return axis === "h"
        ? { id: it.id, isAnn: it.isAnn, x: Math.round(c - it.w / 2), y: it.y }
        : { id: it.id, isAnn: it.isAnn, x: it.x, y: Math.round(c - it.h / 2) };
    });
    applyBulkPositions(updates);
  }, [collectSelectedBounds, applyBulkPositions]);



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
        <Button
          size="sm"
          onClick={() => setAiFlowModalOpen(true)}
          className="h-7 px-2.5 text-xs bg-amber-500 hover:bg-amber-400 text-black font-semibold gap-1.5 shadow-sm transition-all"
        >
          <Sparkles className="h-3.5 w-3.5" /> Desenhar com IA
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={runAutoLayout}>
          <LayoutGrid className="h-3 w-3" /> Organizar
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setChecklistPanel(true)}>
          <ListChecks className="h-3 w-3" /> Checklist
          {totalItems > 0 && <Badge variant="outline" className="h-4 px-1 text-[9px] ml-1">{totalDone}/{totalItems}</Badge>}
        </Button>
        {totalItems > 0 && (
          <div
            onClick={() => setChecklistPanel(true)}
            className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono cursor-pointer transition-colors bg-secondary/70 hover:bg-secondary border border-border/40"
            title="Ver tarefas pendentes hoje para rodar tráfego"
          >
            <span className={totalDone === totalItems ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
              {totalDone === totalItems ? "🟢 Pronto para Tráfego" : `🟡 ${totalItems - totalDone} tarefas hoje`}
            </span>
          </div>
        )}
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={handleExport}>
          <Download className="h-3 w-3" /> PNG
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={handleExportJson}>
          <Download className="h-3 w-3" /> JSON
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-primary">
              <Share2 className="h-3 w-3" /> Compartilhar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[240px]">
            <DropdownMenuItem onClick={async () => {
              if (!mapId) return;
              const { data: cur } = await supabase.from("imphq_company_maps").select("share_token").eq("id", mapId).maybeSingle();
              let tok = cur?.share_token;
              if (!tok) {
                tok = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
                const { error } = await supabase.from("imphq_company_maps").update({ share_token: tok }).eq("id", mapId);
                if (error) { toast.error("Erro ao gerar link"); return; }
              }
              const url = `${window.location.origin}/mapa/${tok}`;
              try { await navigator.clipboard.writeText(url); toast.success("Link copiado! Envie para seu sócio."); }
              catch { prompt("Copie o link:", url); }
            }}>
              <Copy className="h-3 w-3 mr-2" /> Copiar link público
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-400" onClick={async () => {
              if (!mapId) return;
              if (!confirm("Revogar o link atual? Quem já tem não conseguirá mais abrir.")) return;
              const { error } = await supabase.from("imphq_company_maps").update({ share_token: null }).eq("id", mapId);
              if (error) { toast.error("Erro"); return; }
              toast.success("Link revogado");
            }}>
              <X className="h-3 w-3 mr-2" /> Revogar link
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-primary" onClick={() => {
          const c = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
          setReelDialog({ x: c.x, y: c.y });
        }}>
          <Film className="h-3 w-3" /> Reel
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-blue-400" onClick={() => {
          const c = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
          addAnnotation("schedule", c.x, c.y);
        }}>
          <CalendarClock className="h-3 w-3" /> Cronograma
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
            {/* Gerador (IA) — anotações que geram conteúdo */}
            <div className="space-y-0.5">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/70 px-1 pt-1 border-t border-border/30">Gerador (IA)</p>
              {([
                { kind: "script" as AnnotationKind, label: "Script / Roteiro", color: "#ec4899", Icon: FileText },
                { kind: "copy" as AnnotationKind, label: "Copy de anúncio", color: "#f97316", Icon: MessageSquare },
                { kind: "ad_asset" as AnnotationKind, label: "Ativo de anúncio", color: "#eab308", Icon: Megaphone },
              ]).map(({ kind, label, color, Icon }) => (
                <Button key={kind} size="sm" variant="ghost" className="h-7 w-full text-xs justify-start gap-2"
                  onClick={() => {
                    const c = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
                    addAnnotation(kind, c.x, c.y);
                  }}>
                  <div className="p-0.5 rounded" style={{ background: `${color}30`, color }}>
                    <Icon className="h-3 w-3" />
                  </div>
                  <span className="truncate">{label}</span>
                </Button>
              ))}
            </div>
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
          <div className="w-px h-5 bg-border/40" />
          {/* Alignment */}
          <div className="flex items-center gap-0.5">
            <Button size="icon" variant="ghost" className="h-7 w-7" title="Alinhar à esquerda" onClick={() => alignSelected("left")}><AlignStartVertical className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" title="Centralizar horizontal" onClick={() => alignSelected("cx")}><AlignCenterVertical className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" title="Alinhar à direita" onClick={() => alignSelected("right")}><AlignEndVertical className="h-3.5 w-3.5" /></Button>
            <div className="w-px h-4 bg-border/40 mx-0.5" />
            <Button size="icon" variant="ghost" className="h-7 w-7" title="Alinhar ao topo" onClick={() => alignSelected("top")}><AlignLeft className="h-3.5 w-3.5 rotate-90" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" title="Centralizar vertical" onClick={() => alignSelected("cy")}><AlignCenter className="h-3.5 w-3.5 rotate-90" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" title="Alinhar ao fim" onClick={() => alignSelected("bottom")}><AlignRight className="h-3.5 w-3.5 rotate-90" /></Button>
            <div className="w-px h-4 bg-border/40 mx-0.5" />
            <Button size="icon" variant="ghost" className="h-7 w-7" title="Distribuir horizontal" onClick={() => distributeSelected("h")}><AlignHorizontalDistributeCenter className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" title="Distribuir vertical" onClick={() => distributeSelected("v")}><AlignVerticalDistributeCenter className="h-3.5 w-3.5" /></Button>
          </div>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => { setSelectedIds([]); setNodes(nds => nds.map(n => n.selected ? { ...n, selected: false } : n)); }}>
            <X className="h-3 w-3" />

          </Button>
        </div>
      )}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-[10px] text-muted-foreground bg-card/80 backdrop-blur px-3 py-1 rounded-full border border-border/40 pointer-events-none">
        Arraste no vazio = selecionar em área · Ctrl/Cmd + clique = adicionar · Botão direito = anotações · Duplo-clique em card com projeto vinculado = abrir Hub
      </div>
      <ReactFlow
        nodes={nodes} edges={edges} nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        connectionRadius={40}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect} onNodeClick={onNodeClick}
        onSelectionChange={onSelectionChange}
        onPaneContextMenu={(event) => {
          const e = "touches" in event ? event.touches[0] : event;
          if (!e) return;
          event.preventDefault();
          const flow = screenToFlowPosition({ x: e.clientX, y: e.clientY });
          setCtxMenu({ screenX: e.clientX, screenY: e.clientY, flowX: flow.x, flowY: flow.y });
        }}
        onNodeContextMenu={(e, node) => {
          if (!node.id.startsWith(ANN_PREFIX)) return;
          e.preventDefault();
          const flow = screenToFlowPosition({ x: e.clientX, y: e.clientY });
          setCtxMenu({ screenX: e.clientX, screenY: e.clientY, flowX: flow.x, flowY: flow.y, annotationId: node.id.slice(ANN_PREFIX.length) });
        }}
        onEdgeContextMenu={(e, edge) => {
          e.preventDefault();
          const flow = screenToFlowPosition({ x: e.clientX, y: e.clientY });
          setCtxMenu({ screenX: e.clientX, screenY: e.clientY, flowX: flow.x, flowY: flow.y, edgeId: edge.id });
        }}
        onEdgeDoubleClick={(_, edge) => {
          if (confirm("Excluir esta conexão?")) deleteEdgeById(edge.id);
        }}
        onNodeDoubleClick={(_, node) => {
          if (node.id.startsWith(ANN_PREFIX)) { setEditingAnnotationId(node.id); return; }
          const raw = rawNodes.find(r => r.id === node.id);
          if (raw?.linked_project_id) {
            navigate(`/projetos/${raw.linked_project_id}`);
          } else {
            toast.info("Vincule um projeto no painel para abrir o Hub");
            if (raw) setSelected({ ...raw, checklist: raw.checklist || [] });
          }
        }}
        onPaneClick={() => { setCtxMenu(null); setEditingAnnotationId(null); }}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        panOnDrag={[1, 2]}
        multiSelectionKeyCode={["Meta", "Control"]}
        nodesDraggable
        selectNodesOnDrag={false}
        deleteKeyCode={editingAnnotationId ? null : ["Delete", "Backspace"]}
        snapToGrid
        snapGrid={[10, 10]}
        onNodesDelete={(nds) => {
          nds.forEach((n) => {
            if (n.id.startsWith(ANN_PREFIX)) {
              deleteAnnotation(n.id.slice(ANN_PREFIX.length));
            } else {
              deleteNodeById(n.id);
            }
          });
        }}
        fitView proOptions={{ hideAttribution: true }}
      >
        <Background color="#1f1d1e" gap={20} />
        <Controls className="!bg-card !border-border" />
        <MiniMap className="!bg-card !border-border" nodeColor={miniMapNodeColor} />
        {(guides.v.length > 0 || guides.h.length > 0) && (
          <ViewportPortal>
            <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
              {guides.v.map((g, i) => (
                <line key={`v-${i}`} x1={g.x} x2={g.x} y1={g.y1 - 40} y2={g.y2 + 40}
                  stroke="#c9922a" strokeWidth={1} strokeDasharray="4 3" opacity={0.9} />
              ))}
              {guides.h.map((g, i) => (
                <line key={`h-${i}`} x1={g.x1 - 40} x2={g.x2 + 40} y1={g.y} y2={g.y}
                  stroke="#c9922a" strokeWidth={1} strokeDasharray="4 3" opacity={0.9} />
              ))}
            </svg>
          </ViewportPortal>
        )}
      </ReactFlow>
      {mapId && <PresenceCursors mapId={mapId} />}



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
          {!ctxMenu.annotationId && !ctxMenu.edgeId && (
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
              <button className="w-full text-left px-3 py-1.5 hover:bg-secondary/60 flex items-center gap-2 border-t border-border/40 mt-1 pt-2"
                onClick={() => { setReelDialog({ x: ctxMenu.flowX, y: ctxMenu.flowY }); setCtxMenu(null); }}>
                <Film className="h-3.5 w-3.5 text-primary" /> Reel de inspiração…
              </button>

            </>
          )}
          {ctxMenu.edgeId && (
            <>
              <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Conexão</div>
              <button className="w-full text-left px-3 py-1.5 hover:bg-secondary/60 flex items-center gap-2 text-red-400"
                onClick={() => { deleteEdgeById(ctxMenu.edgeId!); setCtxMenu(null); }}>
                <Trash2 className="h-3.5 w-3.5" /> Excluir conexão
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
                {(ann.kind === "note" || ann.kind === "frame" || ann.kind === "arrow") && (() => {
                  const currentColor = (ann.kind === "note" ? ann.style?.bgColor : ann.style?.borderColor) || "#c9922a";
                  return (
                    <>
                      <div className="border-t border-border/40 my-1" />
                      <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Cor</div>
                      <div className="px-3 py-1.5 grid grid-cols-8 gap-1">
                        {COLOR_PALETTE.map(c => (
                          <button
                            key={c}
                            className={cn(
                              "w-5 h-5 rounded border transition-all hover:scale-110",
                              currentColor.toLowerCase() === c.toLowerCase() ? "border-white ring-2 ring-primary" : "border-border/40"
                            )}
                            style={{ background: c }}
                            onClick={() => { changeAnnotationColor(ann.id, c); setCtxMenu(null); }}
                            title={c}
                          />
                        ))}
                      </div>
                    </>
                  );
                })()}
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
      <Sheet open={!!selected} onOpenChange={(o) => { if (!o) flushAndClose(); }}>
        <SheetContent className="w-full sm:w-[480px] sm:max-w-[480px] overflow-y-auto bg-secondary/40">
          <SheetHeader>
            <SheetTitle className="font-serif flex items-center justify-between gap-2">
              <span>Editar nó do mapa</span>
              <span className={`text-[10px] uppercase tracking-wider font-sans ${
                autoSaveStatus === "saving" ? "text-amber-400" :
                autoSaveStatus === "saved" ? "text-emerald-400" :
                autoSaveStatus === "error" ? "text-rose-400" : "text-muted-foreground"
              }`}>
                {autoSaveStatus === "saving" ? "Salvando…" :
                 autoSaveStatus === "saved" ? "✓ Salvo" :
                 autoSaveStatus === "error" ? "Erro" : ""}
              </span>
            </SheetTitle>
          </SheetHeader>
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
              <Button size="sm" variant="outline" className="w-full gap-2" onClick={() => setCommentsTarget({ id: selected.id, label: selected.label })}>
                <MessageSquare className="h-3.5 w-3.5" /> Comentários
              </Button>

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
                  <div className="flex gap-1 mt-1">
                    <Button size="sm" variant="outline" className="flex-1 gap-1"
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
                      <Upload className="h-3 w-3" /> {selected.image_url ? "Trocar" : "Enviar"}
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 gap-1"
                      onClick={() => setLibPickerOpen(true)}>
                      <ImageIcon className="h-3 w-3" /> Biblioteca
                    </Button>
                  </div>
                  {selected.image_url && (
                    <Button size="sm" variant="outline" className="w-full gap-1 mt-1"
                      onClick={async () => {
                        if (!selected.image_url) return;
                        const t = toast.loading("Salvando na Biblioteca...");
                        const { error } = await supabase.from("imphq_referencias").insert({
                          id: crypto.randomUUID(),
                          tipo: "imagem",
                          titulo: selected.label || "Do Mapa da Empresa",
                          image_url: selected.image_url,
                          tags: ["mapa"],
                          project_id: selected.linked_project_id || null,
                        });
                        toast.dismiss(t);
                        if (error) { toast.error("Erro ao salvar"); return; }
                        toast.success("Salvo na Biblioteca", {
                          action: { label: "Abrir", onClick: () => navigate("/referencias") },
                        });
                      }}>
                      <Sparkles className="h-3 w-3" /> Salvar na Biblioteca
                    </Button>
                  )}
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
                  <div className="flex gap-1">
                    <Select value={selected.linked_project_id || "none"}
                      onValueChange={(v) => setSelected({ ...selected, linked_project_id: v === "none" ? null : v })}>
                      <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {selected.linked_project_id && (
                      <Button size="icon" variant="outline" title="Abrir Hub"
                        onClick={() => navigate(`/projetos/${selected.linked_project_id}`)}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
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
              {/* ───────── HUB OPERACIONAL DO NÓ ───────── */}
              {isWaKind && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                      <MessageCircle className="h-4 w-4" /> Hub de Conversão
                    </span>
                    <div className="inline-flex rounded-md bg-secondary p-0.5 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setWaSubMode("x1")}
                        className={`px-2 py-0.5 rounded transition-all font-medium ${
                          waSubMode === "x1" ? "bg-primary text-black font-semibold" : "text-muted-foreground hover:text-white"
                        }`}
                      >
                        🤖 X1 OpenFlow
                      </button>
                      <button
                        type="button"
                        onClick={() => setWaSubMode("grupo")}
                        className={`px-2 py-0.5 rounded transition-all font-medium ${
                          waSubMode === "grupo" ? "bg-primary text-black font-semibold" : "text-muted-foreground hover:text-white"
                        }`}
                      >
                        🚀 Lançamento & Grupos
                      </button>
                    </div>
                  </div>

                  {waSubMode === "x1" ? (
                    <div className="space-y-2.5 pt-1">
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Fluxo de Conversação (OpenFlow)</Label>
                        <Select
                          value={selected.linked_flow_id || "none"}
                          onValueChange={(v) => setSelected({ ...selected, linked_flow_id: v === "none" ? null : v })}
                        >
                          <SelectTrigger className="h-8 text-xs bg-secondary"><SelectValue placeholder="Selecione o fluxo..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum fluxo vinculado</SelectItem>
                            {flows.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-[11px] text-muted-foreground">Chip / Instância WhatsApp</Label>
                        <Select
                          value={selected.linked_wa_provider_id || "none"}
                          onValueChange={(v) => setSelected({ ...selected, linked_wa_provider_id: v === "none" ? null : v })}
                        >
                          <SelectTrigger className="h-8 text-xs bg-secondary"><SelectValue placeholder="Selecione a instância..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum chip selecionado</SelectItem>
                            {waProviders.map(w => {
                              const proj = projects.find(p => p.id === w.project_id);
                              const label = `${w.display_name || w.instance_name || w.provider}${proj ? ` · ${proj.name}` : ""}`;
                              return <SelectItem key={w.id} value={w.id}>{label}</SelectItem>;
                            })}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs h-8 gap-1.5"
                          onClick={() => navigate("/openflow")}
                        >
                          <Workflow className="h-3.5 w-3.5 text-primary" />
                          Abrir OpenFlow
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs h-8 gap-1.5"
                          onClick={() => navigate("/inbox?tab=whatsapp")}
                        >
                          <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
                          Ver no Inbox
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5 pt-1">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <Label className="text-[11px] text-muted-foreground">Campanha de Lançamento (Grupos)</Label>
                          <button
                            type="button"
                            onClick={() => setCreatingCampaign(!creatingCampaign)}
                            className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                          >
                            <Plus className="h-3 w-3" /> Nova Campanha
                          </button>
                        </div>

                        {creatingCampaign ? (
                          <div className="flex gap-1.5 mb-2">
                            <Input
                              placeholder="Nome do lançamento..."
                              value={newCampaignName}
                              onChange={e => setNewCampaignName(e.target.value)}
                              className="h-8 text-xs bg-secondary"
                            />
                            <Button size="sm" className="h-8 text-xs px-2" onClick={handleCreateCampaign}>
                              Salvar
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 text-xs px-2" onClick={() => setCreatingCampaign(false)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Select
                            value={selectedCampaignId || "none"}
                            onValueChange={handleSelectCampaign}
                          >
                            <SelectTrigger className="h-8 text-xs bg-secondary"><SelectValue placeholder="Selecione a campanha..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Nenhuma campanha vinculada</SelectItem>
                              {waCampaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      {currentCampaign && (
                        <div className="p-2.5 rounded-lg bg-black/40 border border-border/40 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground font-mono">Status:</span>
                            <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30 font-mono uppercase">
                              {currentCampaign.status || "Ativa"}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground font-mono">Grupos Vinculados:</span>
                            <span className="text-white font-mono font-semibold">{campaignGroups.length} grupo(s)</span>
                          </div>

                          <Button
                            size="sm"
                            onClick={() => setStepEditorOpen(true)}
                            className="w-full h-8 text-xs bg-gold hover:bg-gold/90 text-black font-semibold gap-1.5 shadow-md shadow-gold/10 mt-1"
                          >
                            <Calendar className="h-3.5 w-3.5" />
                            📅 Abrir Régua de Mensagens Programadas
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Se for nó de Produto / Oferta */}
              {isProductKind && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <ShoppingCart className="h-4 w-4" /> Hub do Produto & Escada
                    </span>
                    {onNavigateTab && (
                      <button
                        type="button"
                        onClick={() => onNavigateTab("ecossistema")}
                        className="text-[10px] text-emerald-400 hover:underline flex items-center gap-0.5"
                      >
                        Ver no Ecossistema ↗
                      </button>
                    )}
                  </div>

                  {projectProducts.length > 0 ? (
                    <div>
                      <Label className="text-[11px] text-muted-foreground mb-1 block">Vincular a Produto do Projeto</Label>
                      <Select
                        value={extractProductId(selected.notes) || "none"}
                        onValueChange={handleLinkProduct}
                      >
                        <SelectTrigger className="h-8 text-xs bg-secondary"><SelectValue placeholder="Selecione um produto..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Personalizado / Avulso</SelectItem>
                          {projectProducts.map((p: any) => (
                            <SelectItem key={p.nome} value={p.nome}>
                              {p.nome} {p.preco ? `· R$ ${p.preco}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground">
                      Nenhum produto cadastrado no projeto. Você pode definir os dados da oferta abaixo.
                    </p>
                  )}

                  {selected.url && (
                    <div className="p-2 rounded bg-secondary/40 border border-border/40 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono truncate text-muted-foreground">{selected.url}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          title="Copiar Link"
                          onClick={() => {
                            navigator.clipboard.writeText(selected.url!);
                            toast.success("Link copiado!");
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <a
                          href={selected.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-secondary text-muted-foreground hover:text-white"
                          title="Testar Link"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!isWaKind && !isProductKind && (
                <>
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
                </>
              )}

              {/* ───────── CENTRAL DO AGENTE & EXECUÇÃO (SOP / RUNBOOK) ───────── */}
              {(() => {
                const agent = extractAgentData(selected.notes);
                const handleUpdateAgent = (partial: Partial<AgentExecutionData>) => {
                  const newNotes = updateAgentDataInNotes(selected.notes, partial);
                  setSelected({ ...selected, notes: newNotes });
                };

                return (
                  <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-purple-400 flex items-center gap-1.5 font-mono">
                        <Bot className="h-4 w-4 text-purple-400" /> Agente & Execução (SOP)
                      </span>
                      <Select
                        value={agent.status}
                        onValueChange={(v) => handleUpdateAgent({ status: v as any })}
                      >
                        <SelectTrigger className="h-7 w-[125px] text-[10px] bg-secondary/80 font-mono">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0A0B0D] border-[#1B1E23]">
                          <SelectItem value="pending" className="text-xs">🟡 Pendente</SelectItem>
                          <SelectItem value="in_progress" className="text-xs">🔵 Em Execução</SelectItem>
                          <SelectItem value="ready_review" className="text-xs">🟣 Para Revisão</SelectItem>
                          <SelectItem value="done" className="text-xs">🟢 Concluído</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Quem Executa?</Label>
                        <Select
                          value={agent.executor}
                          onValueChange={(v) => handleUpdateAgent({ executor: v })}
                        >
                          <SelectTrigger className="h-8 text-xs bg-secondary mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0A0B0D] border-[#1B1E23]">
                            <SelectItem value="ai_higgsfield" className="text-xs">🤖 IA · Higgsfield (Vídeo 9:16)</SelectItem>
                            <SelectItem value="ai_google_flow" className="text-xs">🌐 Navegador · Google Flow</SelectItem>
                            <SelectItem value="ai_copywriter" className="text-xs">✍️ IA · Copywriter (VSL/Copy)</SelectItem>
                            <SelectItem value="openflow" className="text-xs">⚡ Automação · OpenFlow WA</SelectItem>
                            <SelectItem value="human_traffic" className="text-xs">👤 JP / Gestor de Tráfego</SelectItem>
                            <SelectItem value="human_design" className="text-xs">🎨 Designer / Editor</SelectItem>
                            <SelectItem value="human_general" className="text-xs">👥 Time Geral</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-[11px] text-muted-foreground">Skill / Ferramenta</Label>
                        <Select
                          value={agent.skill}
                          onValueChange={(v) => handleUpdateAgent({ skill: v })}
                        >
                          <SelectTrigger className="h-8 text-xs bg-secondary mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0A0B0D] border-[#1B1E23]">
                            <SelectItem value="skill-black-belt" className="text-xs">skill-black-belt (Higgsfield)</SelectItem>
                            <SelectItem value="pipeline-video-viral" className="text-xs">pipeline-video-viral (Google Flow)</SelectItem>
                            <SelectItem value="angulos-criativos" className="text-xs">angulos-criativos (Ganchos)</SelectItem>
                            <SelectItem value="rebel-copy" className="text-xs">rebel-copy (Carlton VSL)</SelectItem>
                            <SelectItem value="mecanismo-vsl" className="text-xs">mecanismo-vsl</SelectItem>
                            <SelectItem value="roteiros-virais-comment-to-dm" className="text-xs">roteiros-virais-comment-to-dm</SelectItem>
                            <SelectItem value="briefing-gestor-trafego" className="text-xs">briefing-gestor-trafego</SelectItem>
                            <SelectItem value="openflow" className="text-xs">openflow (Regras WA)</SelectItem>
                            <SelectItem value="none" className="text-xs">Nenhuma / Manual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px] text-muted-foreground">Prompt / Playbook do Nó</Label>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5 text-[10px] text-purple-300 hover:text-purple-200 gap-1"
                          onClick={() => {
                            const pName = (selected.notes || "").match(/\[product_name:([^\]]+)\]/)?.[1] || "";
                            const promptText = agent.prompt || `Ação: ${selected.label}\nDescrição: ${selected.description || ""}${pName ? `\nProduto: ${pName}` : ""}`;
                            navigator.clipboard.writeText(promptText);
                            toast.success("Prompt do Agente copiado para a área de transferência!");
                          }}
                        >
                          <Copy className="h-3 w-3" /> Copiar Prompt
                        </Button>
                      </div>
                      <Textarea
                        rows={3}
                        value={agent.prompt}
                        onChange={(e) => handleUpdateAgent({ prompt: e.target.value })}
                        placeholder="Instrução exata para a IA (ex: Gerar criativo 9:16 com gancho de dor...)"
                        className="bg-secondary/60 border-border/40 text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">URL do Entregável (Vídeo, Copy, Campanha)</Label>
                      <div className="flex gap-1.5">
                        <Input
                          value={agent.output_url}
                          onChange={(e) => handleUpdateAgent({ output_url: e.target.value })}
                          placeholder="https://... (link do MP4, drive ou doc)"
                          className="h-8 text-xs bg-secondary"
                        />
                        {agent.output_url && (
                          <a
                            href={agent.output_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-8 px-2.5 rounded bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-white shrink-0 text-xs"
                            title="Abrir"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

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

      <Dialog open={!!reelDialog} onOpenChange={(o) => { if (!o) { setReelDialog(null); setReelInput(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Film className="h-4 w-4 text-primary" /> Reels de inspiração</DialogTitle>
            <DialogDescription>
              Cole um ou mais links (Instagram, TikTok, YouTube Shorts). Um por linha — vão virar cards no mapa.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reelInput}
            onChange={(e) => setReelInput(e.target.value)}
            placeholder={"https://www.instagram.com/reel/...\nhttps://www.tiktok.com/@usuario/video/...\nhttps://youtube.com/shorts/..."}
            rows={6}
            className="font-mono text-xs"
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setReelDialog(null); setReelInput(""); }}>Cancelar</Button>
            <Button onClick={() => reelDialog && submitReels(reelDialog.x, reelDialog.y)} disabled={!reelInput.trim()}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <ReferenciasPicker
        open={libPickerOpen}
        onClose={() => { setLibPickerOpen(false); setLibPickerMode("edit"); }}
        initialTab={libPickerMode === "new-image" ? "image" : "site"}
        onSelect={(item) => {
          if (libPickerMode === "new-image") {
            const img = item.thumbnail || (item.kind === "image" ? item.url : "");
            if (!img) { toast.error("Selecione uma imagem"); return; }
            createImageNode(img, item.title);
            setLibPickerMode("edit");
            return;
          }
          if (!selected) return;
          const img = item.thumbnail || (item.kind === "image" ? item.url : "");
          setSelected({
            ...selected,
            image_url: img || selected.image_url,
            url: item.kind === "site" ? item.url : selected.url,
            label: selected.label || item.title,
          });
          toast.success(item.kind === "site" ? "Site aplicado — clique em Salvar" : "Imagem aplicada — clique em Salvar");
        }}
      />

      <Dialog open={imageSourceOpen} onOpenChange={setImageSourceOpen}>
        <DialogContent className="max-w-sm bg-secondary/40 border-border/50">
          <DialogHeader>
            <DialogTitle>Adicionar imagem</DialogTitle>
            <DialogDescription className="leading-7">De onde vem essa imagem?</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => { setImageSourceOpen(false); setLibPickerMode("new-image"); setLibPickerOpen(true); }}
            >
              Biblioteca
            </Button>
            <Button
              onClick={() => { setImageSourceOpen(false); handleUploadImageNode(); }}
            >
              Enviar do computador
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <ImageLightbox open={!!lightbox} url={lightbox?.url || ""} label={lightbox?.label} onClose={() => setLightbox(null)} />
      {mapId && (
        <MapCommentsPanel
          mapId={mapId}
          targetId={commentsTarget?.id || null}
          targetLabel={commentsTarget?.label}
          onClose={() => setCommentsTarget(null)}
        />
      )}

      {/* Dialog de Régua de Mensagens Programadas em Grupos de WhatsApp */}
      <Dialog open={stepEditorOpen} onOpenChange={setStepEditorOpen}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto bg-[#0A0B0D] border-[#1B1E23] p-6 text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-lg text-white">
              <Rocket className="h-5 w-5 text-gold" />
              Régua de Mensagens Programadas nos Grupos · {currentCampaign?.name || "Lançamento"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Programe os textos, áudios simulados, vídeos, PDFs e links que serão disparados automaticamente nos grupos do WhatsApp.
            </DialogDescription>
          </DialogHeader>
          {selectedCampaignId && (
            <CampaignStepEditor
              campaignId={selectedCampaignId}
              projectId={effectiveProjectId || ""}
              produto={currentCampaign?.produto || ""}
              groups={campaignGroups.map(g => g.jid || g.id)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Desenhar com IA */}
      <Dialog open={aiFlowModalOpen} onOpenChange={setAiFlowModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0A0B0D] border-[#1B1E23] p-6 text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-lg text-white">
              <Sparkles className="h-5 w-5 text-amber-400" />
              Desenhar Arquitetura de Funil com IA
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Escolha a estratégia do seu funil. A IA desenha os nós em colunas, conecta o fluxo visual e gera a checklist do que você e seu time precisam fazer hoje para colocar o tráfego no ar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Presets Grid */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">Escolha o Modelo de Funil:</Label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  {
                    id: "vsl_perpetuo",
                    title: "🎬 Perpétuo VSL com Bump & Upsell",
                    badge: "Recomendado",
                    desc: "Meta Ads (3 ângulos) ➔ VSL Advertorial ➔ Checkout Kiwify com Bump ➔ 1-Click Upsell ➔ WhatsApp Recuperação",
                    details: "Ideal para infoprodutos e encapsulados rodando tráfego direto frio todos os dias.",
                  },
                  {
                    id: "lancamento_whatsapp",
                    title: "🚀 Lançamento WhatsApp / Meteórico",
                    badge: "Pico de Vendas",
                    desc: "Meta Ads ➔ Captura Optin ➔ Grupos VIP WhatsApp (D-7 a D0) ➔ Live no YouTube ➔ Abertura ➔ Plantão X1",
                    details: "Ideal para eventos de lançamento, workshops e ofertas com data marcada.",
                  },
                  {
                    id: "high_ticket_x1",
                    title: "💬 Funil High Ticket / Consultoria X1",
                    badge: "Alto LTV",
                    desc: "Tráfego direto WhatsApp ➔ Qualificação SDR / IA (Score > 70) ➔ Proposta ➔ Link VIP ➔ Onboarding",
                    details: "Ideal para mentorias, serviços, consultorias e produtos acima de R$ 1.000.",
                  },
                  {
                    id: "tripwire_ascensao",
                    title: "🎁 Funil Tripwire com Ascensão",
                    badge: "Baixo CAC",
                    desc: "Isca R$ 27 ➔ Orderbump Acelerador ➔ 1-Click Upsell Core Offer R$ 297 ➔ Downsell ➔ Comunidade",
                    details: "Ideal para monetizar tráfego com produto de entrada e lucrar no backend.",
                  },
                  {
                    id: "custom",
                    title: "✍️ Estratégia Personalizada",
                    badge: "Prompt Livre",
                    desc: "Descreva seu funil ou produto em texto livre.",
                    details: "A IA adapta a estrutura e as checklists conforme sua necessidade.",
                  },
                ].map((opt) => {
                  const isSelected = aiFlowPreset === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => setAiFlowPreset(opt.id)}
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer transition-all flex flex-col gap-1 text-left",
                        isSelected
                          ? "bg-amber-500/10 border-amber-500/60 ring-1 ring-amber-500/30"
                          : "bg-[#0E1013] border-[#1B1E23] hover:border-zinc-700"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-white">{opt.title}</span>
                        <Badge variant={isSelected ? "default" : "outline"} className={cn("text-[10px] h-5", isSelected && "bg-amber-500 text-black font-bold")}>
                          {opt.badge}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{opt.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom text if custom selected */}
            {aiFlowPreset === "custom" && (
              <div className="space-y-1.5 pt-1">
                <Label className="text-xs font-semibold text-muted-foreground">Descreva a estratégia do seu funil:</Label>
                <Textarea
                  value={aiFlowCustomText}
                  onChange={(e) => setAiFlowCustomText(e.target.value)}
                  placeholder="Ex: Funil de emagrecimento com quiz interativo de 5 perguntas, advertorial com médica especialista, checkout com bump de pote extra e upsell de protocolo acelerador..."
                  className="bg-[#0E1013] border-[#1B1E23] text-xs min-h-[75px]"
                />
              </div>
            )}

            {/* Product selection */}
            <div className="space-y-1.5 pt-1">
              <Label className="text-xs font-semibold text-muted-foreground">Produto Vinculado ao Funil:</Label>
              {projectProductsList.length > 0 ? (
                <Select value={aiFlowProduct} onValueChange={setAiFlowProduct}>
                  <SelectTrigger className="bg-[#0E1013] border-[#1B1E23] text-xs h-9">
                    <SelectValue placeholder="Selecione o produto principal do projeto..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0A0B0D] border-[#1B1E23]">
                    {projectProductsList.map((prod: any, idx: number) => {
                      const name = prod.nome || prod.name || `Produto ${idx + 1}`;
                      return (
                        <SelectItem key={idx} value={name} className="text-xs">
                          {name}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={aiFlowProduct}
                  onChange={(e) => setAiFlowProduct(e.target.value)}
                  placeholder="Ex: LinfaFlow Drenagem Líquida (ou deixe vazio para usar o padrão)"
                  className="bg-[#0E1013] border-[#1B1E23] text-xs h-9"
                />
              )}
              <p className="text-[10px] text-muted-foreground">
                O produto será associado aos nós de checkout, upsell e criativos, sincronizando métricas e checklists.
              </p>
            </div>

            {/* Replace options */}
            <div className="flex items-center space-x-2 pt-2 border-t border-[#1B1E23]">
              <Checkbox
                id="aiFlowReplace"
                checked={aiFlowReplace}
                onCheckedChange={(c) => setAiFlowReplace(!!c)}
              />
              <Label htmlFor="aiFlowReplace" className="text-xs text-muted-foreground cursor-pointer font-normal">
                Substituir mapa atual (remover nós anteriores deste mapa para começar com layout limpo)
              </Label>
            </div>
          </div>

          <DialogFooter className="pt-2 gap-2 sm:gap-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAiFlowModalOpen(false)}
              disabled={aiFlowGenerating}
              className="text-xs text-muted-foreground"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleGenerateAiFlow}
              disabled={aiFlowGenerating}
              className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs gap-1.5 shadow-sm"
            >
              {aiFlowGenerating ? (
                <>
                  <Sparkles className="h-3.5 w-3.5 animate-spin" /> Desenhando fluxo...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" /> Desenhar Funil no Canvas
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}



export function CompanyMapCanvas({
  projects,
  initialProjectId,
  onNavigateTab,
}: {
  projects: Pick<Tables<"imphq_projects">, "id" | "name" | "data">[];
  initialProjectId?: string;
  onNavigateTab?: (tab: string) => void;
}) {
  return (
    <ReactFlowProvider>
      <InnerMap
        projects={projects}
        initialProjectId={initialProjectId}
        onNavigateTab={onNavigateTab}
      />
    </ReactFlowProvider>
  );
}

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { FileUpload } from "@/components/FileUpload";
import { FunilPipelineWizard } from "@/components/funis/FunilPipelineWizard";
import { Plus, Trash2, ChevronLeft, Eye, ShoppingCart, ArrowRight, Save, ExternalLink, Image, ZoomIn, ZoomOut, GripVertical, Facebook, Instagram, Video, Mail, MessageSquare, FileText, Box, Type, Megaphone, Linkedin, Music, PenLine, Search, X, Activity, Layers, Network, PanelRightOpen, PanelRightClose, Link2, Package, TrendingUp, TrendingDown, BarChart3, Sparkles, Loader2, History, Building2, Zap } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ProductHubCanvas } from "@/components/funis/ProductHubCanvas";
import { CloneFunnelDialog } from "@/components/funis/CloneFunnelDialog";
import { Link as RouterLink } from "react-router-dom";
import { Copy, Calculator } from "lucide-react";
import { CompanyMapCanvas } from "@/components/funis/CompanyMapCanvas";
import { FunnelTemplatesDialog } from "@/components/funis/FunnelTemplatesDialog";
import { FunnelSnapshotsDialog } from "@/components/funis/FunnelSnapshotsDialog";
import { AutoBuildDialog } from "@/components/funis/AutoBuildDialog";
import { OneClickModal } from "@/components/funis/OneClickModal";
import { FunnelBrainCard } from "@/components/funis/FunnelBrainCard";
import { LaunchTimelineDialog } from "@/components/funis/LaunchTimelineDialog";
import { Calendar as CalendarIcon, Brain } from "lucide-react";

interface Etapa {
  nome: string; tipo?: string; visitantes: number; conversoes: number;
  url?: string; image_url?: string; pos_x?: number; pos_y?: number;
  descricao?: string; connects_to?: number[];
  width?: number; height?: number;
}
interface Funil {
  id: string; nome: string; tipo?: string; status?: string; url?: string;
  project_id?: string; data: { etapas?: Etapa[]; pipeline_assets?: Record<string, unknown> }; criado_em?: string;
}

const DEFAULT_ETAPAS: Etapa[] = [
  { nome: "AnÃºncio", tipo: "criativo", visitantes: 0, conversoes: 0, pos_x: 80, pos_y: 80 },
  { nome: "Opt-in", tipo: "pagina", visitantes: 0, conversoes: 0, pos_x: 400, pos_y: 80 },
  { nome: "VSL/Webinar", tipo: "vsl", visitantes: 0, conversoes: 0, pos_x: 720, pos_y: 80 },
  { nome: "Checkout", tipo: "checkout", visitantes: 0, conversoes: 0, pos_x: 1040, pos_y: 80 },
  { nome: "Upsell", tipo: "upsell", visitantes: 0, conversoes: 0, pos_x: 1360, pos_y: 80 },
];

const TIPO_STYLES: Record<string, { bg: string; border: string; text: string; label: string; icon: any; hasMetrics: boolean }> = {
  criativo:  { bg: "bg-rose-500/10", border: "border-rose-500/40", text: "text-rose-400", label: "Criativo", icon: Megaphone, hasMetrics: true },
  pagina:    { bg: "bg-blue-500/10", border: "border-blue-500/40", text: "text-blue-400", label: "PÃ¡gina", icon: FileText, hasMetrics: true },
  vsl:       { bg: "bg-violet-500/10", border: "border-violet-500/40", text: "text-violet-400", label: "VSL", icon: Video, hasMetrics: true },
  checkout:  { bg: "bg-emerald-500/10", border: "border-emerald-500/40", text: "text-emerald-400", label: "Checkout", icon: ShoppingCart, hasMetrics: true },
  upsell:    { bg: "bg-amber-500/10", border: "border-amber-500/40", text: "text-amber-400", label: "Upsell", icon: ArrowRight, hasMetrics: true },
  face_ads:  { bg: "bg-indigo-500/10", border: "border-indigo-500/40", text: "text-indigo-400", label: "Facebook Ads", icon: Facebook, hasMetrics: true },
  instagram: { bg: "bg-pink-500/10", border: "border-pink-500/40", text: "text-pink-400", label: "Instagram", icon: Instagram, hasMetrics: true },
  tiktok:    { bg: "bg-cyan-500/10", border: "border-cyan-500/40", text: "text-cyan-400", label: "TikTok", icon: Music, hasMetrics: true },
  linkedin:  { bg: "bg-sky-500/10", border: "border-sky-500/40", text: "text-sky-400", label: "LinkedIn", icon: Linkedin, hasMetrics: true },
  blog:      { bg: "bg-teal-500/10", border: "border-teal-500/40", text: "text-teal-400", label: "Blog", icon: PenLine, hasMetrics: true },
  video:     { bg: "bg-purple-500/10", border: "border-purple-500/40", text: "text-purple-400", label: "VÃ­deo", icon: Video, hasMetrics: true },
  imagem:    { bg: "bg-orange-500/10", border: "border-orange-500/40", text: "text-orange-400", label: "Imagem", icon: Image, hasMetrics: false },
  email:     { bg: "bg-sky-600/10", border: "border-sky-600/40", text: "text-sky-300", label: "Email", icon: Mail, hasMetrics: true },
  whatsapp:  { bg: "bg-green-500/10", border: "border-green-500/40", text: "text-green-400", label: "WhatsApp", icon: MessageSquare, hasMetrics: true },
  caixa:     { bg: "bg-slate-500/10", border: "border-slate-500/40", text: "text-slate-400", label: "Caixa", icon: Box, hasMetrics: false },
  texto:     { bg: "bg-neutral-500/10", border: "border-neutral-500/40", text: "text-neutral-400", label: "Texto", icon: Type, hasMetrics: false },
  outro:     { bg: "bg-gray-500/10", border: "border-gray-500/40", text: "text-gray-400", label: "Outro", icon: Box, hasMetrics: true },
};

const TIPO_GROUPS = [
  { label: "PÃ¡ginas", tipos: ["pagina", "vsl", "checkout", "upsell"] },
  { label: "Canais", tipos: ["face_ads", "instagram", "tiktok", "linkedin", "blog"] },
  { label: "MÃ­dia", tipos: ["criativo", "video", "imagem"] },
  { label: "ComunicaÃ§Ã£o", tipos: ["email", "whatsapp"] },
  { label: "Outros", tipos: ["caixa", "texto", "outro"] },
];

const ALL_TIPOS = Object.keys(TIPO_STYLES);

function getConversionColor(taxa: number) {
  if (taxa >= 30) return { text: "text-emerald-400", dot: "bg-emerald-400" };
  if (taxa >= 10) return { text: "text-amber-400", dot: "bg-amber-400" };
  return { text: "text-red-400", dot: "bg-red-400" };
}

const STATUS_STYLES: Record<string, string> = {
  Ativo: "border-l-emerald-500 from-emerald-500/8 to-transparent",
  Rascunho: "border-l-amber-500 from-amber-500/8 to-transparent",
  Pausado: "border-l-muted-foreground from-muted/10 to-transparent",
};

const CARD_W = 240;
const CARD_H_METRICS = 340;
const CARD_H_SIMPLE = 200;
const CANVAS_W = 4000;
const CANVAS_H = 3000;
const MINIMAP_W = 160;
const MINIMAP_H = 120;
const CONNECT_DOT_SIZE = 12;
const IMG_DEFAULT_W = 260;
const IMG_DEFAULT_H = 180;
const IMG_MIN = 80;

export default function Funis() {
  const [funis, setFunis] = useState<Funil[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [filterProject, setFilterProject] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [showAutoBuild, setShowAutoBuild] = useState(false);
  const [showCorteExpress, setShowCorteExpress] = useState(false);
  const [hubProjectId, setHubProjectId] = useState<string | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [cloneFunil, setCloneFunil] = useState<Funil | null>(null);
  const [selectedFunil, setSelectedFunil] = useState<Funil | null>(null);
  const [form, setForm] = useState({ nome: "", tipo: "PerpÃ©tuo", status: "Rascunho", project_id: "" });
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connectingFrom, setConnectingFrom] = useState<number | null>(null);
  const [connectLine, setConnectLine] = useState<{ x: number; y: number } | null>(null);
  const [projectProducts, setProjectProducts] = useState<string[]>([]);
  const [projectProductsFull, setProjectProductsFull] = useState<any[]>([]);
  const [projectData, setProjectData] = useState<any>(null);
  const [usePixelData, setUsePixelData] = useState(false);
  const [pixelMetrics, setPixelMetrics] = useState<Record<string, { pageviews: number; conversions: number }>>({});
  const [showProjectPanel, setShowProjectPanel] = useState(false);
  const [realMetrics, setRealMetrics] = useState<{ leads: number; vendas: number; totalVendas: number; cpl: number; cpa: number }>({ leads: 0, vendas: 0, totalVendas: 0, cpl: 0, cpa: 0 });
  const [showMetricsPanel, setShowMetricsPanel] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const autoSaveTimer = useRef<NodeJS.Timeout>();
  const [viewMode, setViewMode] = useState<"funis" | "ecossistema" | "hub" | "mapa">("hub");
  const [aiOrganizing, setAiOrganizing] = useState(false);
  const [showAiGen, setShowAiGen] = useState(false);
  const [aiGenPrompt, setAiGenPrompt] = useState("");
  const [aiGenModel, setAiGenModel] = useState("google/gemini-3-flash-preview");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [showPipelineWizard, setShowPipelineWizard] = useState(false);
  const [kpisByProject, setKpisByProject] = useState<Record<string, { leads: number; vendas: number; receita: number; conv: number }>>({});
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [resizingIdx, setResizingIdx] = useState<number | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; w: number; h: number }>({ x: 0, y: 0, w: 0, h: 0 });
  const imageFileInputRef = useRef<HTMLInputElement>(null);



  const AI_MODELS = [
    { id: "google/gemini-3-flash-preview", label: "Gemini Flash" },
    { id: "google/gemini-2.5-pro", label: "Gemini Pro" },
    { id: "openai/gpt-5-mini", label: "GPT-5 Mini" },
  ];

  const handleAiGenerateFunnel = async () => {
    if (!aiGenPrompt.trim()) { toast.error("Descreva o funil que deseja gerar"); return; }
    if (!selectedFunil) { toast.error("Selecione ou crie um funil primeiro"); return; }
    setAiGenerating(true);
    try {
      const proj = selectedFunil.project_id ? projects.find(p => p.id === selectedFunil.project_id) : null;
      const briefing = proj?.briefing ? (typeof proj.briefing === "string" ? JSON.parse(proj.briefing) : proj.briefing) : {};
      const prodList = projectProductsFull.map((p: any) => ({
        nome: p.nome || p.name,
        tipo: p.tipo_oferta || p.tipo || "",
        preco: p.preco_por || p.preco || p.price || "",
        link: p.ofertas?.[0]?.link || p.link || p.url || "",
      }));

      const { data, error } = await supabase.functions.invoke("openflow-ai", {
        body: {
          action: "generate_funnel_from_prompt",
          project_id: selectedFunil.project_id || undefined,
          model: aiGenModel,
          extra: {
            prompt: aiGenPrompt,
            products: prodList.length > 0 ? prodList : undefined,
            project_name: proj?.name || "",
            nicho: briefing?.nicho || briefing?.niche || "",
            existing_etapas: (selectedFunil.data.etapas || []).length > 0 ? selectedFunil.data.etapas : undefined,
          },
        },
      });
      if (error) throw error;

      const etapas = (data?.etapas || []).map((e: any) => ({
        nome: e.nome || "Etapa",
        tipo: e.tipo || "outro",
        visitantes: 0,
        conversoes: 0,
        url: e.url || "",
        pos_x: e.pos_x ?? 80,
        pos_y: e.pos_y ?? 200,
        descricao: e.descricao || "",
        connects_to: e.connects_to || [],
      }));

      if (etapas.length > 0) {
        setSelectedFunil({ ...selectedFunil, data: { ...selectedFunil.data, etapas } });
        triggerAutoSave();
        setShowAiGen(false);
        setAiGenPrompt("");
        toast.success(`IA gerou ${etapas.length} etapas!${data?.estrategia ? `\nðŸ“‹ ${data.estrategia}` : ""}`, { duration: 6000 });
      } else {
        toast.error("A IA nÃ£o retornou etapas. Tente reformular o prompt.");
      }
    } catch (err: any) {
      if (err?.message?.includes("429")) toast.error("Rate limit excedido.");
      else if (err?.message?.includes("402")) toast.error("CrÃ©ditos insuficientes.");
      else toast.error(err.message || "Erro ao gerar funil");
    } finally { setAiGenerating(false); }
  };

  const handlePipelineApply = (etapas: unknown[], estrategia: string, assets?: Record<string, unknown>) => {
    if (!selectedFunil) return;
    const mapped = (etapas as Array<Record<string, unknown>>).map(e => ({
      nome: (e.nome as string) || "Etapa",
      tipo: (e.tipo as string) || "outro",
      visitantes: 0,
      conversoes: 0,
      url: (e.url as string) || "",
      pos_x: (e.pos_x as number) ?? 80,
      pos_y: (e.pos_y as number) ?? 400,
      descricao: (e.descricao as string) || "",
      connects_to: (e.connects_to as number[]) || [],
    }));
    const pipeline_assets = assets && Object.keys(assets).length > 0
      ? { ...assets, estrategia, generated_at: new Date().toISOString() }
      : (selectedFunil.data as any).pipeline_assets;
    const assetCount = assets
      ? Object.values(assets).filter(v => Array.isArray(v) ? v.length > 0 : !!v).length
      : 0;
    setSelectedFunil({
      ...selectedFunil,
      data: { ...selectedFunil.data, etapas: mapped, pipeline_assets },
    });
    triggerAutoSave();
    toast.success(
      `Pipeline IA gerou ${mapped.length} etapas${assetCount ? ` + ${assetCount} ativos` : ""}!${estrategia ? `\n📋 ${estrategia.slice(0, 120)}` : ""}`,
      { duration: 8000 }
    );
  };

  const aiOrganizeProducts = async (mode: "create" | "reorganize" = "create") => {
    if (!selectedFunil?.project_id || projectProductsFull.length === 0) {
      toast.error("Selecione um projeto com produtos configurados");
      return;
    }
    setAiOrganizing(true);
    try {
      const proj = projects.find(p => p.id === selectedFunil.project_id);
      const briefing = proj?.briefing ? (typeof proj.briefing === "string" ? JSON.parse(proj.briefing) : proj.briefing) : {};
      const prodList = projectProductsFull.map((p: any) => ({
        nome: p.nome || p.name,
        tipo: p.tipo_oferta || p.tipo || "",
        preco: p.preco_por || p.preco || p.price || "",
        link: p.ofertas?.[0]?.link || p.link || p.url || "",
        descricao: p.descricao || "",
      }));

      const existingEtapas = mode === "reorganize" ? (selectedFunil.data.etapas || []) : [];

      const { data, error } = await supabase.functions.invoke("openflow-ai", {
        body: {
          action: "ai_organize_funnel",
          project_id: selectedFunil.project_id,
          trigger_tipo: "organize_products",
          model: "google/gemini-3-flash-preview",
          extra: {
            products: prodList,
            project_name: proj?.name || "",
            nicho: briefing?.nicho || briefing?.niche || "",
            existing_etapas: existingEtapas,
          },
        },
      });

      if (error) throw error;

      const organized = data?.etapas || [];
      const estrategia = data?.estrategia || "";

      if (organized.length > 0) {
        const aiEtapas: Etapa[] = organized.map((e: any) => ({
          nome: e.nome || "Etapa",
          tipo: e.tipo || "outro",
          visitantes: 0,
          conversoes: 0,
          url: e.url || "",
          pos_x: e.pos_x ?? 80,
          pos_y: e.pos_y ?? 200,
          descricao: e.descricao || "",
          connects_to: e.connects_to || [],
        }));
        setSelectedFunil({ ...selectedFunil, data: { ...selectedFunil.data, etapas: aiEtapas } });
        triggerAutoSave();
        toast.success(`IA organizou ${aiEtapas.length} etapas no funil!${estrategia ? `\n\nðŸ“‹ ${estrategia}` : ""}`, { duration: 6000 });
      } else {
        // Fallback local
        const etapas: Etapa[] = [];
        const spacing = 320;
        etapas.push({ nome: "AnÃºncio", tipo: "criativo", visitantes: 0, conversoes: 0, pos_x: 80, pos_y: 80 });
        etapas.push({ nome: "PÃ¡gina de Captura", tipo: "pagina", visitantes: 0, conversoes: 0, pos_x: 80 + spacing, pos_y: 80, connects_to: [] });
        etapas[0].connects_to = [1];

        const sorted = [...prodList].sort((a, b) => {
          const order: Record<string, number> = { tripwire: 0, principal: 1, "": 1, "order bump": 2, orderbump: 2, upsell: 3 };
          return (order[(a.tipo || "").toLowerCase()] ?? 1) - (order[(b.tipo || "").toLowerCase()] ?? 1);
        });

        sorted.forEach((prod, i) => {
          const tipoLower = (prod.tipo || "").toLowerCase();
          let tipo = "checkout";
          if (tipoLower.includes("upsell")) tipo = "upsell";
          else if (tipoLower.includes("bump")) tipo = "upsell";

          const idx = etapas.length;
          etapas.push({
            nome: prod.preco ? `${prod.nome} (R$${prod.preco})` : prod.nome,
            tipo, visitantes: 0, conversoes: 0, url: prod.link,
            pos_x: 80 + (i + 2) * spacing, pos_y: 400,
            descricao: prod.descricao || prod.tipo || "",
          });
          if (idx > 0) etapas[idx - 1].connects_to = [...(etapas[idx - 1].connects_to || []), idx];
        });

        setSelectedFunil({ ...selectedFunil, data: { ...selectedFunil.data, etapas } });
        triggerAutoSave();
        toast.success(`${sorted.length} produtos organizados no funil (fallback local)`);
      }
    } catch (err: any) {
      console.error("AI organize error:", err);
      toast.error("Erro ao organizar com IA: " + (err?.message || "tente novamente"));
    } finally {
      setAiOrganizing(false);
    }
  };

  const load = async () => {
    const [fRes, pRes] = await Promise.all([
      supabase.from("imphq_funis").select("*").order("updated_at", { ascending: false }),
      supabase.from("imphq_projects").select("id, name, data").order("name"),
    ]);
    setFunis((fRes.data || []).map((f: any) => ({ ...f, data: f.data || {} })));
    const projRows = (pRes.data || []).map((p: any) => {
      const d = typeof p.data === "string" ? (() => { try { return JSON.parse(p.data); } catch { return {}; } })() : (p.data || {});
      return { ...p, briefing: d.briefing || d };
    });
    setProjects(projRows);
    loadKpis();
  };

  const loadKpis = async () => {
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const [leadsRes, vendasRes] = await Promise.all([
      supabase.from("imphq_leads").select("project_id").gte("created_at", since),
      supabase.from("imphq_vendas").select("project_id, status, valor, valor_liquido").gte("created_at", since),
    ]);
    const map: Record<string, { leads: number; vendas: number; receita: number; conv: number }> = {};
    for (const l of (leadsRes.data || []) as any[]) {
      if (!l.project_id) continue;
      if (!map[l.project_id]) map[l.project_id] = { leads: 0, vendas: 0, receita: 0, conv: 0 };
      map[l.project_id].leads++;
    }
    for (const v of (vendasRes.data || []) as any[]) {
      if (!v.project_id) continue;
      if (!map[v.project_id]) map[v.project_id] = { leads: 0, vendas: 0, receita: 0, conv: 0 };
      if ((v.status || "").toLowerCase() === "aprovado") {
        map[v.project_id].vendas++;
        map[v.project_id].receita += Number(v.valor_liquido ?? v.valor) || 0;
      }
    }
    for (const k of Object.keys(map)) {
      const m = map[k];
      m.conv = m.leads > 0 ? (m.vendas / m.leads) * 100 : 0;
    }
    setKpisByProject(map);
  };

  useEffect(() => { load(); }, []);


  // Load project products when a funnel with project_id is selected
  useEffect(() => {
    if (selectedFunil?.project_id) {
      const proj = projects.find(p => p.id === selectedFunil.project_id);
      if (proj?.briefing) {
        const b = typeof proj.briefing === "string" ? JSON.parse(proj.briefing) : proj.briefing;
        const d = typeof proj.data === "string" ? (() => { try { return JSON.parse(proj.data); } catch { return {}; } })() : (proj.data || {});
        const prods = b?.produtos || b?.products || [];
        const prodArray = Array.isArray(prods) ? prods : [];
        setProjectProducts(prodArray.map((p: any) => typeof p === "string" ? p : p.nome || p.name || ""));
        setProjectProductsFull(prodArray.map((p: any) => typeof p === "string" ? { nome: p } : p));
        setProjectData({ ...b, ...d, links: d?.links || b?.links || {}, webhooks: d?.webhooks || b?.webhooks || [] });
      } else {
        setProjectProducts([]);
        setProjectProductsFull([]);
        setProjectData(null);
      }
    } else {
      setProjectProducts([]);
      setProjectProductsFull([]);
      setProjectData(null);
    }
  }, [selectedFunil?.project_id, projects]);

  // Load pixel data + real metrics for funnel project
  useEffect(() => {
    if (!selectedFunil?.project_id || !usePixelData) { setPixelMetrics({}); setRealMetrics({ leads: 0, vendas: 0, totalVendas: 0, cpl: 0, cpa: 0 }); return; }
    const fetchData = async () => {
      const pid = selectedFunil.project_id!;
      const [evRes, leadsRes, vendasRes, adsRes] = await Promise.all([
        supabase.from("imphq_events").select("page_url, event_name").eq("project_id", pid),
        supabase.from("imphq_leads").select("id").eq("project_id", pid),
        supabase.from("imphq_vendas").select("id, valor, status").eq("project_id", pid).eq("status", "aprovado"),
        supabase.from("imphq_ads_spend" as any).select("valor").eq("project_id", pid),
      ]);
      // Pixel metrics
      const metrics: Record<string, { pageviews: number; conversions: number }> = {};
      for (const ev of (evRes.data || [])) {
        const url = (ev.page_url || "").replace(/\/$/, "").toLowerCase();
        if (!url) continue;
        if (!metrics[url]) metrics[url] = { pageviews: 0, conversions: 0 };
        if (ev.event_name === "PageView") metrics[url].pageviews++;
        else metrics[url].conversions++;
      }
      setPixelMetrics(metrics);
      // Real metrics
      const totalLeads = leadsRes.data?.length || 0;
      const totalVendasCount = vendasRes.data?.length || 0;
      const totalVendasValor = vendasRes.data?.reduce((s: number, v: any) => s + (Number(v.valor) || 0), 0) || 0;
      const totalSpend = adsRes.data?.reduce((s: number, a: any) => s + (Number(a.valor) || 0), 0) || 0;
      setRealMetrics({
        leads: totalLeads,
        vendas: totalVendasCount,
        totalVendas: totalVendasValor,
        cpl: totalLeads > 0 ? totalSpend / totalLeads : 0,
        cpa: totalVendasCount > 0 ? totalSpend / totalVendasCount : 0,
      });
    };
    fetchData();
  }, [selectedFunil?.project_id, usePixelData]);

  const filtered = funis.filter(f => {
    if (filterProject !== "all" && f.project_id !== filterProject) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const pName = projectName(f.project_id).toLowerCase();
      return f.nome.toLowerCase().includes(q) || pName.includes(q);
    }
    return true;
  });

  const createFunil = async () => {
    if (!form.nome.trim()) { toast.error("Nome obrigatÃ³rio"); return; }
    const id = crypto.randomUUID();
    const { error } = await supabase.from("imphq_funis").insert([{
      id, nome: form.nome, tipo: form.tipo, status: form.status,
      project_id: form.project_id || null,
      data: { etapas: DEFAULT_ETAPAS } as any,
    }]);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Funil criado!"); setShowNew(false);
    setForm({ nome: "", tipo: "PerpÃ©tuo", status: "Rascunho", project_id: "" }); load();
  };

  const deleteFunil = async (id: string) => {
    await supabase.from("imphq_funis").delete().eq("id", id);
    toast.success("Funil removido"); setSelectedFunil(null); load();
  };

  const updateEtapa = async (funilId: string, etapas: Etapa[]) => {
    await supabase.from("imphq_funis").update({ data: { etapas } as any }).eq("id", funilId);
    setSelectedFunil(prev => prev ? { ...prev, data: { ...prev.data, etapas } } : null);
  };

  const triggerAutoSave = useCallback(() => {
    if (!selectedFunil) return;
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      updateEtapa(selectedFunil.id, selectedFunil.data.etapas || []);
    }, 1200);
  }, [selectedFunil]);

  const addEtapaOfType = (tipo: string) => {
    if (!selectedFunil) return;
    const etapas = selectedFunil.data.etapas || [];
    const rect = canvasRef.current?.getBoundingClientRect();
    const cx = rect ? (-pan.x + rect.width / 2) / zoom : 400;
    const cy = rect ? (-pan.y + rect.height / 2) / zoom : 200;
    const style = TIPO_STYLES[tipo] || TIPO_STYLES.outro;
    const newEtapa: Etapa = {
      nome: style.label, tipo, visitantes: 0, conversoes: 0,
      pos_x: Math.round(cx - CARD_W / 2), pos_y: Math.round(cy - (style.hasMetrics ? CARD_H_METRICS : CARD_H_SIMPLE) / 2),
    };
    const updated = [...etapas, newEtapa];
    setSelectedFunil({ ...selectedFunil, data: { ...selectedFunil.data, etapas: updated } });
  };

  const uploadImageFile = async (file: File): Promise<string | null> => {
    if (!selectedFunil) return null;
    if (!file.type.startsWith("image/")) {
      toast.error(`${file.name} nÃ£o Ã© uma imagem`);
      return null;
    }
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `funis/${selectedFunil.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("project-media").upload(path, file, { upsert: false });
    if (error) {
      toast.error(`Upload falhou: ${error.message}`);
      return null;
    }
    const { data } = supabase.storage.from("project-media").getPublicUrl(path);
    return data.publicUrl;
  };

  const addImageNodesFromFiles = async (files: FileList | File[], originCanvasX?: number, originCanvasY?: number) => {
    if (!selectedFunil) return;
    const arr = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (arr.length === 0) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    const baseX = originCanvasX ?? (rect ? (-pan.x + rect.width / 2) / zoom - IMG_DEFAULT_W / 2 : 200);
    const baseY = originCanvasY ?? (rect ? (-pan.y + rect.height / 2) / zoom - IMG_DEFAULT_H / 2 : 200);

    const uploaded: { url: string; name: string }[] = [];
    for (const f of arr) {
      const url = await uploadImageFile(f);
      if (url) uploaded.push({ url, name: f.name.replace(/\.[^.]+$/, "") });
    }
    if (uploaded.length === 0) return;

    const cols = Math.ceil(Math.sqrt(uploaded.length));
    const gap = 20;
    const newEtapas: Etapa[] = uploaded.map((u, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      return {
        nome: u.name.slice(0, 60),
        tipo: "imagem",
        visitantes: 0, conversoes: 0,
        image_url: u.url,
        pos_x: Math.round(baseX + col * (IMG_DEFAULT_W + gap)),
        pos_y: Math.round(baseY + row * (IMG_DEFAULT_H + gap)),
        width: IMG_DEFAULT_W,
        height: IMG_DEFAULT_H,
      };
    });

    const updated = [...(selectedFunil.data.etapas || []), ...newEtapas];
    setSelectedFunil({ ...selectedFunil, data: { ...selectedFunil.data, etapas: updated } });
    triggerAutoSave();
    toast.success(`${uploaded.length} imagem(ns) adicionada(s)`);
  };

  const handleCanvasPaste = useCallback(async (e: ClipboardEvent) => {
    if (!selectedFunil) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const it of Array.from(items)) {
      if (it.kind === "file") {
        const f = it.getAsFile();
        if (f && f.type.startsWith("image/")) files.push(f);
      }
    }
    if (files.length === 0) return;
    e.preventDefault();
    await addImageNodesFromFiles(files);
  }, [selectedFunil, pan, zoom]);

  useEffect(() => {
    if (!selectedFunil) return;
    const handler = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      handleCanvasPaste(e);
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [selectedFunil, handleCanvasPaste]);



  const removeEtapa = (idx: number) => {
    if (!selectedFunil) return;
    const etapas = (selectedFunil.data.etapas || []).filter((_, i) => i !== idx);
    // Re-map connects_to indices after removal
    const remapped = etapas.map(e => {
      if (!e.connects_to) return e;
      const newConnects = e.connects_to
        .filter(t => t !== idx)
        .map(t => t > idx ? t - 1 : t);
      return { ...e, connects_to: newConnects.length > 0 ? newConnects : undefined };
    });
    setSelectedFunil({ ...selectedFunil, data: { ...selectedFunil.data, etapas: remapped } });
  };

  const setEtapaField = (idx: number, field: string, value: any) => {
    if (!selectedFunil) return;
    const etapas = [...(selectedFunil.data.etapas || [])];
    etapas[idx] = { ...etapas[idx], [field]: value };
    setSelectedFunil({ ...selectedFunil, data: { ...selectedFunil.data, etapas } });
  };

  const saveEtapas = () => {
    if (!selectedFunil) return;
    updateEtapa(selectedFunil.id, selectedFunil.data.etapas || []);
    toast.success("Etapas salvas!");
  };

  const addProductAsEtapa = (prod: any) => {
    if (!selectedFunil) return;
    const etapas = selectedFunil.data.etapas || [];
    const rect = canvasRef.current?.getBoundingClientRect();
    const cx = rect ? (-pan.x + rect.width / 2) / zoom : 400;
    const cy = rect ? (-pan.y + rect.height / 2) / zoom : 200;
    
    const tipoLower = (prod.tipo_oferta || prod.tipo || "").toLowerCase();
    let tipo = "checkout";
    if (tipoLower.includes("upsell")) tipo = "upsell";
    else if (tipoLower.includes("tripwire")) tipo = "checkout";
    else if (tipoLower.includes("bump")) tipo = "upsell";
    
    const url = prod.ofertas?.[0]?.link || prod.link || prod.url || "";
    const nome = prod.nome || prod.name || "Produto";
    const preco = prod.preco_por || prod.preco || prod.price || "";
    
    const newEtapa: Etapa = {
      nome: preco ? `${nome} (R$${preco})` : nome,
      tipo,
      visitantes: 0,
      conversoes: 0,
      url,
      pos_x: Math.round(cx - CARD_W / 2 + Math.random() * 100),
      pos_y: Math.round(cy - CARD_H_METRICS / 2 + Math.random() * 100),
      descricao: prod.descricao || prod.tipo_oferta || "",
    };
    const updated = [...etapas, newEtapa];
    setSelectedFunil({ ...selectedFunil, data: { ...selectedFunil.data, etapas: updated } });
    triggerAutoSave();
    toast.success(`"${nome}" adicionado como etapa!`);
  };

  const projectName = (id?: string) => projects.find(p => p.id === id)?.name || "";

  // --- Remove a specific connection ---
  const removeConnection = (fromIdx: number, toIdx: number) => {
    if (!selectedFunil) return;
    const etapas = [...(selectedFunil.data.etapas || [])];
    const e = etapas[fromIdx];
    if (e.connects_to) {
      const newConnects = e.connects_to.filter(t => t !== toIdx);
      etapas[fromIdx] = { ...e, connects_to: newConnects.length > 0 ? newConnects : undefined };
      setSelectedFunil({ ...selectedFunil, data: { ...selectedFunil.data, etapas } });
      triggerAutoSave();
      toast.success("ConexÃ£o removida");
    }
  };

  // --- Add a connection ---
  const addConnection = (fromIdx: number, toIdx: number) => {
    if (!selectedFunil || fromIdx === toIdx) return;
    const etapas = [...(selectedFunil.data.etapas || [])];
    const e = etapas[fromIdx];
    const existing = e.connects_to || [];
    if (existing.includes(toIdx)) return;
    etapas[fromIdx] = { ...e, connects_to: [...existing, toIdx] };
    setSelectedFunil({ ...selectedFunil, data: { ...selectedFunil.data, etapas } });
    triggerAutoSave();
    toast.success("ConexÃ£o criada");
  };

  // --- Drag handlers ---
  const handleCardMouseDown = useCallback((e: React.MouseEvent, idx: number) => {
    if ((e.target as HTMLElement).closest("input, select, textarea, button, [role='combobox'], .connect-dot")) return;
    e.stopPropagation();
    const etapas = selectedFunil?.data.etapas || [];
    const etapa = etapas[idx];
    setDraggingIdx(idx);
    setDragOffset({
      x: e.clientX / zoom - (etapa.pos_x ?? 0),
      y: e.clientY / zoom - (etapa.pos_y ?? 0),
    });
  }, [selectedFunil, zoom]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Resize image node
    if (resizingIdx !== null && selectedFunil) {
      const dx = (e.clientX - resizeStart.x) / zoom;
      const dy = (e.clientY - resizeStart.y) / zoom;
      const etapas = [...(selectedFunil.data.etapas || [])];
      etapas[resizingIdx] = {
        ...etapas[resizingIdx],
        width: Math.max(IMG_MIN, Math.round(resizeStart.w + dx)),
        height: Math.max(IMG_MIN, Math.round(resizeStart.h + dy)),
      };
      setSelectedFunil({ ...selectedFunil, data: { ...selectedFunil.data, etapas } });
      return;
    }

    // Connection line preview
    if (connectingFrom !== null && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setConnectLine({
        x: (e.clientX - rect.left - pan.x) / zoom,
        y: (e.clientY - rect.top - pan.y) / zoom,
      });
      return;
    }

    if (draggingIdx !== null && selectedFunil) {
      const etapas = [...(selectedFunil.data.etapas || [])];
      const newX = Math.max(0, Math.round(e.clientX / zoom - dragOffset.x));
      const newY = Math.max(0, Math.round(e.clientY / zoom - dragOffset.y));
      etapas[draggingIdx] = { ...etapas[draggingIdx], pos_x: newX, pos_y: newY };
      setSelectedFunil({ ...selectedFunil, data: { ...selectedFunil.data, etapas } });
      return;
    }
    if (isPanning) {
      setPan({
        x: pan.x + (e.clientX - panStart.x),
        y: pan.y + (e.clientY - panStart.y),
      });
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  }, [connectingFrom, draggingIdx, selectedFunil, zoom, dragOffset, isPanning, pan, panStart, resizingIdx, resizeStart]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    // Finish connection: check if mouse is over a card
    if (connectingFrom !== null && selectedFunil && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mx = (e.clientX - rect.left - pan.x) / zoom;
      const my = (e.clientY - rect.top - pan.y) / zoom;
      const etapas = selectedFunil.data.etapas || [];
      for (let i = 0; i < etapas.length; i++) {
        if (i === connectingFrom) continue;
        const ex = etapas[i].pos_x ?? 0;
        const ey = etapas[i].pos_y ?? 0;
        const ts = TIPO_STYLES[etapas[i].tipo || "outro"] || TIPO_STYLES.outro;
        const ew = etapas[i].tipo === "imagem" ? (etapas[i].width ?? IMG_DEFAULT_W) : CARD_W;
        const eh = etapas[i].tipo === "imagem"
          ? (etapas[i].height ?? IMG_DEFAULT_H)
          : (ts.hasMetrics ? CARD_H_METRICS : CARD_H_SIMPLE);
        if (mx >= ex && mx <= ex + ew && my >= ey && my <= ey + eh) {
          addConnection(connectingFrom, i);
          break;
        }
      }
      setConnectingFrom(null);
      setConnectLine(null);
      return;
    }

    if (resizingIdx !== null) {
      triggerAutoSave();
      setResizingIdx(null);
      return;
    }

    if (draggingIdx !== null) {
      triggerAutoSave();
    }
    setDraggingIdx(null);
    setIsPanning(false);
  }, [connectingFrom, draggingIdx, triggerAutoSave, selectedFunil, pan, zoom, resizingIdx]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".etapa-card")) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setZoom(z => Math.min(2, Math.max(0.25, z + delta)));
  }, []);

  // Canvas detail view
  if (selectedFunil) {
    const etapas = selectedFunil.data.etapas || [];

    // Build connector pairs - only from explicit connects_to
    const connectors: { from: Etapa; to: Etapa; fromIdx: number; toIdx: number; isExplicit: boolean }[] = [];
    for (let i = 0; i < etapas.length; i++) {
      const targets = etapas[i].connects_to;
      if (targets && targets.length > 0) {
        for (const t of targets) {
          if (t >= 0 && t < etapas.length && t !== i) {
            connectors.push({ from: etapas[i], to: etapas[t], fromIdx: i, toIdx: t, isExplicit: true });
          }
        }
      } else if (i < etapas.length - 1) {
        connectors.push({ from: etapas[i], to: etapas[i + 1], fromIdx: i, toIdx: i + 1, isExplicit: false });
      }
    }

    // Compute bounding box for minimap
    const allX = etapas.map(e => e.pos_x ?? 0);
    const allY = etapas.map(e => e.pos_y ?? 0);
    const minX = Math.min(0, ...allX);
    const maxX = Math.max(CANVAS_W, ...allX.map(x => x + CARD_W));
    const minY = Math.min(0, ...allY);
    const maxY = Math.max(CANVAS_H, ...allY.map(y => y + CARD_H_METRICS));
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedFunil(null); load(); }}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h1 className="font-display text-2xl font-bold text-primary">{selectedFunil.nome}</h1>
          <Badge variant="outline">{selectedFunil.tipo}</Badge>
          <Badge variant={selectedFunil.status === "Ativo" ? "default" : "secondary"}>{selectedFunil.status}</Badge>
          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => setShowSnapshots(true)}>
            <History className="h-3 w-3" /> VersÃµes
          </Button>
          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => setShowTimeline(true)} disabled={!selectedFunil.project_id}>
            <CalendarIcon className="h-3 w-3" /> Cronograma
          </Button>
          <Button
            size="sm"
            className="h-7 gap-1 text-xs bg-primary/90 hover:bg-primary"
            onClick={() => setShowAutoBuild(true)}
            disabled={!selectedFunil.project_id}
            title={selectedFunil.project_id ? "Monta o funil a partir de produtos, fluxos, WA, e-mails, sites e anÃºncios do projeto" : "Selecione um projeto"}
          >
            <Sparkles className="h-3 w-3" /> Montar AutomÃ¡tico
          </Button>


          {/* Project selector in editor */}
          <Select
            value={selectedFunil.project_id || "none"}
            onValueChange={async (v) => {
              const pid = v === "none" ? null : v;
              setSelectedFunil({ ...selectedFunil, project_id: pid || undefined });
              await supabase.from("imphq_funis").update({ project_id: pid }).eq("id", selectedFunil.id);
            }}
          >
            <SelectTrigger className="w-[180px] h-7 text-xs"><SelectValue placeholder="Projeto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem projeto</SelectItem>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Project products reference */}
          {projectProducts.length > 0 && (
            <div className="flex items-center gap-1 ml-2">
              <ShoppingCart className="h-3 w-3 text-muted-foreground" />
              {projectProducts.map((p, i) => (
                <Badge key={i} variant="secondary" className="text-[9px]">{p}</Badge>
              ))}
            </div>
          )}

          {selectedFunil.project_id && (
            <div className="flex items-center gap-2 ml-4 border-l border-border pl-4">
              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Dados do Pixel</span>
              <Switch checked={usePixelData} onCheckedChange={setUsePixelData} className="scale-75" />
              {usePixelData && Object.keys(pixelMetrics).length > 0 && (
                <Badge variant="outline" className="text-[9px] text-emerald-400 border-emerald-400/30">
                  {Object.keys(pixelMetrics).length} URLs rastreadas
                </Badge>
              )}
            </div>
          )}

          <div className="ml-auto flex items-center gap-1">
            {selectedFunil.project_id && projectProductsFull.length > 0 && (
              <Button size="sm" variant={showProjectPanel ? "default" : "outline"} className="h-7 text-xs gap-1 mr-2" onClick={() => setShowProjectPanel(!showProjectPanel)}>
                {showProjectPanel ? <PanelRightClose className="h-3 w-3" /> : <PanelRightOpen className="h-3 w-3" />}
                Dados do Projeto
              </Button>
            )}
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(z => Math.max(0.25, z - 0.1))}><ZoomOut className="h-3.5 w-3.5" /></Button>
            <span className="text-xs text-muted-foreground font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(z => Math.min(2, z + 0.1))}><ZoomIn className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="ghost" onClick={() => { setPan({ x: 0, y: 0 }); setZoom(0.85); }}>Reset</Button>
          </div>
        </div>

        {/* 2D Canvas */}
        <div
          ref={canvasRef}
          className={`relative rounded-xl border ${isDraggingFile ? "border-primary border-dashed ring-2 ring-primary/40" : "border-border"} bg-[radial-gradient(circle,hsl(var(--border))_1px,transparent_1px)] bg-[size:20px_20px] overflow-hidden select-none`}
          style={{ height: "75vh", cursor: connectingFrom !== null ? "crosshair" : isPanning ? "grabbing" : draggingIdx !== null ? "move" : "grab" }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { setConnectingFrom(null); setConnectLine(null); handleMouseUp({} as any); }}
          onWheel={handleWheel}
          onDragOver={(e) => {
            if (Array.from(e.dataTransfer.types || []).includes("Files")) {
              e.preventDefault();
              if (!isDraggingFile) setIsDraggingFile(true);
            }
          }}
          onDragLeave={(e) => {
            if (e.currentTarget === e.target) setIsDraggingFile(false);
          }}
          onDrop={async (e) => {
            e.preventDefault();
            setIsDraggingFile(false);
            const files = e.dataTransfer.files;
            if (!files || files.length === 0) return;
            const rect = canvasRef.current?.getBoundingClientRect();
            const cx = rect ? (e.clientX - rect.left - pan.x) / zoom : undefined;
            const cy = rect ? (e.clientY - rect.top - pan.y) / zoom : undefined;
            await addImageNodesFromFiles(files, cx, cy);
          }}
        >
          <div style={{
            width: CANVAS_W, height: CANVAS_H,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            position: "relative",
          }}>
            {/* SVG Connectors */}
            <svg className="absolute inset-0" width={CANVAS_W} height={CANVAS_H} style={{ pointerEvents: "none" }}>
              {connectors.map((c, i) => {
                const fromStyle = TIPO_STYLES[c.from.tipo || "outro"] || TIPO_STYLES.outro;
                const fromH = fromStyle.hasMetrics ? CARD_H_METRICS : CARD_H_SIMPLE;
                const toStyle = TIPO_STYLES[c.to.tipo || "outro"] || TIPO_STYLES.outro;
                const toH = toStyle.hasMetrics ? CARD_H_METRICS : CARD_H_SIMPLE;

                const fromX = (c.from.pos_x ?? 0) + CARD_W;
                const fromY = (c.from.pos_y ?? 0) + fromH / 2;
                const toX = (c.to.pos_x ?? 0);
                const toY = (c.to.pos_y ?? 0) + toH / 2;
                const midX = (fromX + toX) / 2;
                const labelX = (fromX + toX) / 2;
                const labelY = (fromY + toY) / 2;

                const convRate = c.from.visitantes > 0 && c.to.visitantes > 0
                  ? ((c.to.visitantes / c.from.visitantes) * 100).toFixed(1)
                  : null;

                return (
                  <g key={i}>
                    <defs>
                      <marker id={`arrow-canvas-${i}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                        <path d="M0,0 L8,4 L0,8" fill="hsl(var(--primary))" opacity="0.5" />
                      </marker>
                    </defs>
                    {/* Invisible wide path for click target */}
                    {c.isExplicit && (
                      <path
                        d={`M${fromX},${fromY} C${midX},${fromY} ${midX},${toY} ${toX},${toY}`}
                        stroke="transparent"
                        strokeWidth="16"
                        fill="none"
                        style={{ pointerEvents: "stroke", cursor: "pointer" }}
                        onClick={() => removeConnection(c.fromIdx, c.toIdx)}
                      >
                        <title>Clique para remover conexÃ£o #{c.fromIdx} â†’ #{c.toIdx}</title>
                      </path>
                    )}
                    <path
                      d={`M${fromX},${fromY} C${midX},${fromY} ${midX},${toY} ${toX},${toY}`}
                      stroke="hsl(var(--primary))"
                      strokeWidth="2"
                      fill="none"
                      opacity={c.isExplicit ? "0.5" : "0.2"}
                      markerEnd={`url(#arrow-canvas-${i})`}
                      strokeDasharray={c.isExplicit ? "none" : "6 4"}
                      style={{ pointerEvents: "none" }}
                    >
                      {!c.isExplicit && <animate attributeName="stroke-dashoffset" from="20" to="0" dur="2s" repeatCount="indefinite" />}
                    </path>
                    {convRate && (
                      <>
                        <rect x={labelX - 22} y={labelY - 10} width="44" height="20" rx="4"
                          fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1" />
                        <text x={labelX} y={labelY + 4} textAnchor="middle"
                          fill="hsl(var(--primary))" fontSize="10" fontFamily="monospace" fontWeight="bold">
                          {convRate}%
                        </text>
                      </>
                    )}
                  </g>
                );
              })}

              {/* Connection line preview */}
              {connectingFrom !== null && connectLine && (() => {
                const fromEtapa = etapas[connectingFrom];
                const fromStyle = TIPO_STYLES[fromEtapa?.tipo || "outro"] || TIPO_STYLES.outro;
                const fromH = fromStyle.hasMetrics ? CARD_H_METRICS : CARD_H_SIMPLE;
                const fromX = (fromEtapa?.pos_x ?? 0) + CARD_W;
                const fromY = (fromEtapa?.pos_y ?? 0) + fromH / 2;
                return (
                  <path
                    d={`M${fromX},${fromY} L${connectLine.x},${connectLine.y}`}
                    stroke="hsl(var(--primary))"
                    strokeWidth="2"
                    fill="none"
                    opacity="0.6"
                    strokeDasharray="4 4"
                    style={{ pointerEvents: "none" }}
                  />
                );
              })()}
            </svg>

            {/* Cards */}
            {etapas.map((etapa, i) => {
              // Pixel data override
              const urlKey = (etapa.url || "").replace(/\/$/, "").toLowerCase();
              const pixData = usePixelData && urlKey ? pixelMetrics[urlKey] : null;
              const effectiveVisitantes = pixData ? pixData.pageviews : etapa.visitantes;
              const effectiveConversoes = pixData ? pixData.conversions : etapa.conversoes;
              const taxa = effectiveVisitantes > 0 ? (effectiveConversoes / effectiveVisitantes) * 100 : 0;
              const convColors = getConversionColor(taxa);
              const tipoStyle = TIPO_STYLES[etapa.tipo || "outro"] || TIPO_STYLES.outro;
              const isTextType = etapa.tipo === "texto";
              const isSimple = !tipoStyle.hasMetrics;
              const x = etapa.pos_x ?? 80;
              const y = etapa.pos_y ?? 80;
              const cardH = isTextType ? CARD_H_SIMPLE : (isSimple ? CARD_H_SIMPLE : CARD_H_METRICS);
              // â”€â”€ Image node (free-form) â”€â”€
              if (etapa.tipo === "imagem" && etapa.image_url) {
                const iw = etapa.width ?? IMG_DEFAULT_W;
                const ih = etapa.height ?? IMG_DEFAULT_H;
                return (
                  <div
                    key={i}
                    className="etapa-card group absolute rounded-lg overflow-hidden border-2 border-transparent hover:border-primary/50 shadow-lg transition-colors"
                    style={{ left: x, top: y, width: iw, height: ih, zIndex: draggingIdx === i || resizingIdx === i ? 50 : 1 }}
                    onMouseDown={(e) => handleCardMouseDown(e, i)}
                  >
                    {/* Connection dots */}
                    <div
                      className="connect-dot absolute rounded-full bg-primary/60 hover:bg-primary hover:scale-150 transition-all cursor-crosshair border-2 border-background z-20"
                      style={{ right: -CONNECT_DOT_SIZE / 2, top: ih / 2 - CONNECT_DOT_SIZE / 2, width: CONNECT_DOT_SIZE, height: CONNECT_DOT_SIZE }}
                      title="Conectar"
                      onMouseDown={(e) => { e.stopPropagation(); setConnectingFrom(i); }}
                    />
                    <div
                      className="absolute rounded-full bg-muted-foreground/30 border-2 border-background z-20"
                      style={{ left: -CONNECT_DOT_SIZE / 2, top: ih / 2 - CONNECT_DOT_SIZE / 2, width: CONNECT_DOT_SIZE, height: CONNECT_DOT_SIZE }}
                    />

                    <img src={etapa.image_url} alt={etapa.nome} className="w-full h-full object-cover pointer-events-none" draggable={false} />

                    {/* Caption + delete (hover) */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <span className="text-[10px] font-mono text-white/60 shrink-0">#{i}</span>
                      <Input
                        defaultValue={etapa.nome}
                        onBlur={e => setEtapaField(i, "nome", e.target.value)}
                        className="h-6 text-[11px] bg-black/40 border-white/10 text-white p-1 flex-1"
                        placeholder="Legenda..."
                      />
                      <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0 hover:bg-destructive/20" onClick={(e) => { e.stopPropagation(); removeEtapa(i); }}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>

                    {/* Resize handle */}
                    <div
                      className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize bg-primary/60 hover:bg-primary opacity-0 group-hover:opacity-100 transition-opacity z-20"
                      style={{ clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setResizingIdx(i);
                        setResizeStart({ x: e.clientX, y: e.clientY, w: iw, h: ih });
                      }}
                      title="Redimensionar"
                    />
                  </div>
                );
              }

              const IconComp = tipoStyle.icon;

              return (
                <div
                  key={i}
                  className={`etapa-card absolute rounded-xl border-2 ${tipoStyle.border} ${tipoStyle.bg} backdrop-blur-sm p-3 space-y-2 hover:shadow-lg transition-shadow`}
                  style={{ left: x, top: y, width: CARD_W, zIndex: draggingIdx === i ? 50 : 1 }}
                  onMouseDown={(e) => handleCardMouseDown(e, i)}
                >
                  {/* Connection dot - RIGHT side (output) */}
                  <div
                    className="connect-dot absolute rounded-full bg-primary/60 hover:bg-primary hover:scale-150 transition-all cursor-crosshair border-2 border-background z-10"
                    style={{ right: -CONNECT_DOT_SIZE / 2, top: cardH / 2 - CONNECT_DOT_SIZE / 2, width: CONNECT_DOT_SIZE, height: CONNECT_DOT_SIZE }}
                    title="Arraste para conectar a outro card"
                    onMouseDown={(e) => { e.stopPropagation(); setConnectingFrom(i); }}
                  />
                  {/* Connection dot - LEFT side (input indicator) */}
                  <div
                    className="absolute rounded-full bg-muted-foreground/30 border-2 border-background"
                    style={{ left: -CONNECT_DOT_SIZE / 2, top: cardH / 2 - CONNECT_DOT_SIZE / 2, width: CONNECT_DOT_SIZE, height: CONNECT_DOT_SIZE }}
                  />

                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="cursor-grab active:cursor-grabbing p-0.5">
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
                      </div>
                      <span className="text-[10px] font-mono font-bold text-muted-foreground bg-secondary/80 rounded px-1.5 py-0.5">#{i}</span>
                    </div>
                    <Badge variant="outline" className={`text-[9px] ${tipoStyle.text} ${tipoStyle.border} flex items-center gap-1`}>
                      <IconComp className="h-2.5 w-2.5" />
                      {tipoStyle.label}
                    </Badge>
                  </div>

                  {isTextType ? (
                    <>
                      <Textarea
                        defaultValue={etapa.descricao || ""}
                        onBlur={e => setEtapaField(i, "descricao", e.target.value)}
                        className="text-xs bg-card/50 border-border min-h-[80px] resize-none"
                        placeholder="AnotaÃ§Ã£o / texto livre..."
                      />
                      <div className="flex items-center justify-between">
                        <Input defaultValue={etapa.nome} onBlur={e => setEtapaField(i, "nome", e.target.value)}
                          className="h-6 text-[10px] bg-transparent border-none p-0 focus-visible:ring-0 w-2/3" />
                        <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => removeEtapa(i)}>
                          <Trash2 className="h-2.5 w-2.5 text-destructive" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      {etapa.image_url ? (
                        <div className="h-28 rounded-lg overflow-hidden bg-card/50 border border-border">
                          <img src={etapa.image_url} alt={etapa.nome} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className={`${isSimple ? 'h-14' : 'h-20'} rounded-lg ${tipoStyle.bg} border ${tipoStyle.border} flex items-center justify-center`}>
                          <IconComp className="h-6 w-6 text-muted-foreground/20" />
                        </div>
                      )}

                      <Input defaultValue={etapa.nome} onBlur={e => setEtapaField(i, "nome", e.target.value)}
                        className="h-7 text-xs font-bold bg-transparent border-none p-0 focus-visible:ring-0" />

                      <Input defaultValue={etapa.descricao || ""} onBlur={e => setEtapaField(i, "descricao", e.target.value)}
                        className="h-6 text-[10px] bg-card/50 border-border p-1" placeholder="DescriÃ§Ã£o..." />

                      {/* Product dropdown */}
                      {projectProductsFull.length > 0 && (
                        <Select value="" onValueChange={v => {
                          const prod = projectProductsFull[parseInt(v)];
                          if (!prod) return;
                          const nome = prod.nome || prod.name || "";
                          const url = prod.ofertas?.[0]?.link || prod.link || "";
                          setEtapaField(i, "nome", nome);
                          if (url) setEtapaField(i, "url", url);
                        }}>
                          <SelectTrigger className="h-6 text-[9px] bg-primary/5 border-primary/20"><SelectValue placeholder="ðŸ“¦ Vincular Produto" /></SelectTrigger>
                          <SelectContent>
                            {projectProductsFull.map((p: any, pi: number) => (
                              <SelectItem key={pi} value={String(pi)} className="text-xs">
                                <span className="flex items-center gap-1.5">
                                  <Package className="h-3 w-3" />
                                  {p.nome || p.name || `Produto ${pi + 1}`}
                                  {(p.preco_por || p.preco) && <span className="text-[9px] font-mono text-primary ml-1">R${p.preco_por || p.preco}</span>}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      <Select value={etapa.tipo || "outro"} onValueChange={v => setEtapaField(i, "tipo", v)}>
                        <SelectTrigger className="h-6 text-[10px] bg-card/50 border-border"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ALL_TIPOS.map(t => {
                            const s = TIPO_STYLES[t]; const I = s.icon;
                            return <SelectItem key={t} value={t} className="text-xs"><span className="flex items-center gap-1.5"><I className="h-3 w-3" />{s.label}</span></SelectItem>;
                          })}
                        </SelectContent>
                      </Select>

                      <div className="flex items-center gap-1">
                        <Input defaultValue={etapa.url || ""} onBlur={e => setEtapaField(i, "url", e.target.value)}
                          className="h-6 text-[10px] bg-card/50 border-border p-1" placeholder="URL..." />
                        {etapa.url && <a href={etapa.url} target="_blank" rel="noopener" className="shrink-0"><ExternalLink className="h-3 w-3 text-primary" /></a>}
                      </div>

                      {/* Connect to - text fallback */}
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-muted-foreground shrink-0">â†’</span>
                        <Input
                          defaultValue={(etapa.connects_to || []).join(",")}
                          onBlur={e => {
                            const val = e.target.value.trim();
                            const arr = val ? val.split(",").map(Number).filter(n => !isNaN(n)) : [];
                            setEtapaField(i, "connects_to", arr.length > 0 ? arr : undefined);
                          }}
                          className="h-5 text-[9px] bg-card/50 border-border p-1 font-mono"
                          placeholder="Conecta a: 1,2"
                          title="Ãndices das etapas destino (0-based), separados por vÃ­rgula"
                        />
                      </div>

                      <FileUpload bucket="project-media" path={`funis/${selectedFunil.id}`}
                        onUpload={url => setEtapaField(i, "image_url", url)} label="Img"
                        className="[&_button]:h-6 [&_button]:text-[10px]" />

                      {tipoStyle.hasMetrics && (
                        <>
                          {pixData && (
                            <Badge variant="outline" className="text-[8px] text-emerald-400 border-emerald-400/30 w-fit">
                              ðŸ“¡ Dados reais
                            </Badge>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Eye className="h-2.5 w-2.5" /> Visitas</p>
                              {pixData ? (
                                <p className="text-xs font-mono font-bold text-emerald-400 px-1">{effectiveVisitantes.toLocaleString()}</p>
                              ) : (
                                <Input type="number" defaultValue={etapa.visitantes} onBlur={e => setEtapaField(i, "visitantes", parseInt(e.target.value) || 0)} className="h-6 text-xs font-mono bg-card/50 border-border p-1" />
                              )}
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground flex items-center gap-1"><ShoppingCart className="h-2.5 w-2.5" /> Conv.</p>
                              {pixData ? (
                                <p className="text-xs font-mono font-bold text-emerald-400 px-1">{effectiveConversoes.toLocaleString()}</p>
                              ) : (
                                <Input type="number" defaultValue={etapa.conversoes} onBlur={e => setEtapaField(i, "conversoes", parseInt(e.target.value) || 0)} className="h-6 text-xs font-mono bg-card/50 border-border p-1" />
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className={`text-sm font-mono font-bold ${convColors.text}`}>{taxa.toFixed(1)}%</span>
                            <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => removeEtapa(i)}>
                              <Trash2 className="h-2.5 w-2.5 text-destructive" />
                            </Button>
                          </div>
                          <div className="w-full h-1.5 bg-card/30 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${convColors.dot}`} style={{ width: `${Math.min(taxa, 100)}%` }} />
                          </div>
                        </>
                      )}

                      {!tipoStyle.hasMetrics && (
                        <div className="flex justify-end">
                          <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => removeEtapa(i)}>
                            <Trash2 className="h-2.5 w-2.5 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Project Data Sidebar */}
          {showProjectPanel && selectedFunil.project_id && projectProductsFull.length > 0 && (
            <div className="absolute top-3 right-[180px] w-64 max-h-[calc(100%-24px)] overflow-y-auto rounded-xl border border-border bg-card/95 backdrop-blur-sm p-3 space-y-3 z-20">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold flex items-center gap-1.5"><Package className="h-3 w-3 text-primary" /> Produtos do Projeto</h4>
                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setShowProjectPanel(false)}><X className="h-3 w-3" /></Button>
              </div>
              {projectProductsFull.map((prod: any, idx: number) => {
                const nome = prod.nome || prod.name || `Produto ${idx + 1}`;
                const preco = prod.preco_por || prod.preco || prod.price || "";
                const tipo = prod.tipo_oferta || prod.tipo || "";
                const url = prod.ofertas?.[0]?.link || prod.link || "";
                return (
                  <div key={idx} className="p-2 rounded-lg bg-secondary/50 border border-border space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium truncate flex-1">{nome}</p>
                      {preco && <span className="text-[10px] font-mono font-bold text-primary ml-1">R${preco}</span>}
                    </div>
                    {tipo && <Badge variant="secondary" className="text-[8px]">{tipo}</Badge>}
                    {url && <p className="text-[9px] text-muted-foreground truncate flex items-center gap-1"><Link2 className="h-2.5 w-2.5 shrink-0" />{url}</p>}
                    {prod.ofertas?.length > 0 && (
                      <div className="space-y-0.5">
                        {prod.ofertas.map((of: any, oi: number) => (
                          <div key={oi} className="flex items-center justify-between text-[9px] text-muted-foreground">
                            <span className="truncate">{of.nome || `Oferta ${oi + 1}`}</span>
                            {of.preco_por && <span className="font-mono text-primary">R${of.preco_por}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    <Button size="sm" variant="outline" className="h-6 text-[10px] w-full gap-1" onClick={() => addProductAsEtapa(prod)}>
                      <Plus className="h-2.5 w-2.5" /> Adicionar como etapa
                    </Button>
                  </div>
                );
              })}
              {projectData?.links && Object.keys(projectData.links).length > 0 && (
                <div className="border-t border-border pt-2 space-y-1">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Links do Projeto</p>
                  {Object.entries(projectData.links).filter(([, v]) => v).map(([k, v]) => (
                    <a key={k} href={v as string} target="_blank" rel="noopener" className="flex items-center gap-1.5 text-[10px] text-primary hover:underline">
                      <ExternalLink className="h-2.5 w-2.5" />{k}: {String(v).slice(0, 30)}...
                    </a>
                  ))}
                </div>
              )}
              {projectData?.webhooks?.length > 0 && (
                <div className="border-t border-border pt-2 space-y-1">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Webhooks</p>
                  {projectData.webhooks.map((wh: any, wi: number) => (
                    <Badge key={wi} variant="outline" className="text-[8px]">{wh.nome || wh.plataforma || `Webhook ${wi + 1}`}</Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Minimap */}
          <div className="absolute bottom-3 right-3 rounded-lg border border-border bg-card/90 backdrop-blur-sm p-1.5"
            style={{ width: MINIMAP_W, height: MINIMAP_H }}>
            <svg width="100%" height="100%" viewBox={`${minX} ${minY} ${rangeX} ${rangeY}`} className="opacity-60">
              {etapas.map((e, i) => {
                const ts = TIPO_STYLES[e.tipo || "outro"] || TIPO_STYLES.outro;
                return <rect key={i} x={e.pos_x ?? 0} y={e.pos_y ?? 0} width={CARD_W}
                  height={ts.hasMetrics ? CARD_H_METRICS : CARD_H_SIMPLE} rx="4"
                  fill="hsl(var(--primary))" opacity="0.3" stroke="hsl(var(--primary))" strokeWidth="8" />;
              })}
              {canvasRef.current && (
                <rect x={-pan.x / zoom} y={-pan.y / zoom}
                  width={canvasRef.current.clientWidth / zoom} height={canvasRef.current.clientHeight / zoom}
                  fill="none" stroke="hsl(var(--primary))" strokeWidth="12" opacity="0.6" rx="4" />
              )}
            </svg>
          </div>

          {/* Connection mode indicator */}
          {connectingFrom !== null && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 shadow-lg animate-fade-in">
              Conectando de #{connectingFrom} â€” solte sobre outro card
              <Button size="icon" variant="ghost" className="h-5 w-5 text-primary-foreground/70 hover:text-primary-foreground" onClick={() => { setConnectingFrom(null); setConnectLine(null); }}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline"><Plus className="h-3 w-3 mr-1" /> Adicionar Elemento</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              {TIPO_GROUPS.map((group, gi) => (
                <div key={gi}>
                  {gi > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">{group.label}</DropdownMenuLabel>
                  {group.tipos.map(t => {
                    const s = TIPO_STYLES[t]; const I = s.icon;
                    return <DropdownMenuItem key={t} onClick={() => addEtapaOfType(t)} className="text-xs gap-2"><I className={`h-3.5 w-3.5 ${s.text}`} />{s.label}</DropdownMenuItem>;
                  })}
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <input
            ref={imageFileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={async (e) => {
              const files = e.target.files;
              if (files && files.length > 0) await addImageNodesFromFiles(files);
              if (imageFileInputRef.current) imageFileInputRef.current.value = "";
            }}
          />
          <Button size="sm" variant="outline" className="gap-1" onClick={() => imageFileInputRef.current?.click()}>
            <Image className="h-3 w-3" /> Imagem
          </Button>

          <Button size="sm" onClick={saveEtapas}><Save className="h-3 w-3 mr-1" /> Salvar</Button>
          
          
          {selectedFunil.project_id && projectProductsFull.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" disabled={aiOrganizing} className="gap-1 border-primary/30 text-primary hover:bg-primary/10">
                  {aiOrganizing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  {aiOrganizing ? "Organizando..." : "IA: Organizar Funil"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel className="text-xs">OrganizaÃ§Ã£o com IA</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => aiOrganizeProducts("create")} className="text-xs gap-2">
                  <Sparkles className="h-3 w-3" /> Criar funil do zero
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => aiOrganizeProducts("reorganize")} disabled={(selectedFunil.data.etapas || []).length === 0} className="text-xs gap-2">
                  <Network className="h-3 w-3" /> Reorganizar etapas atuais
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Button size="sm" variant="outline" className="gap-1 border-primary/30 text-primary hover:bg-primary/10" onClick={() => setShowAiGen(true)} disabled={aiGenerating}>
            {aiGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Gerar com IA
          </Button>

          <Button size="sm" className="gap-1 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-700 text-white border-0" onClick={() => setShowPipelineWizard(true)}>
            <Zap className="h-3 w-3" />
            Funil Completo
          </Button>
          
          <Button size="sm" variant="destructive" onClick={() => deleteFunil(selectedFunil.id)}><Trash2 className="h-3 w-3 mr-1" /> Excluir</Button>
          <span className="text-[10px] text-muted-foreground ml-2">Arraste cards â€¢ Scroll=zoom â€¢ Pontos laterais conectam â€¢ Cole (Ctrl+V) ou arraste imagens direto no canvas</span>
        </div>

        {/* AI Generate Funnel Dialog */}
        <Dialog open={showAiGen} onOpenChange={setShowAiGen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Gerar Funil com IA</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Descreva o funil que deseja</Label>
                <Textarea
                  value={aiGenPrompt}
                  onChange={e => setAiGenPrompt(e.target.value)}
                  placeholder="Ex: Funil de lanÃ§amento com captura â†’ sequÃªncia de emails â†’ VSL â†’ checkout com orderbump e upsell de mentoria..."
                  className="bg-secondary min-h-[100px]"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Modelo de IA</Label>
                <Select value={aiGenModel} onValueChange={setAiGenModel}>
                  <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AI_MODELS.map(m => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {selectedFunil?.project_id && projectProductsFull.length > 0 && (
                <p className="text-[10px] text-emerald-400">âœ… Projeto vinculado com {projectProductsFull.length} produto(s) â€” a IA usarÃ¡ como contexto.</p>
              )}
              <p className="text-[10px] text-muted-foreground">A IA criarÃ¡ todas as etapas, conexÃµes e posicionamento visual automaticamente. {(selectedFunil?.data.etapas || []).length > 0 && "âš ï¸ As etapas atuais serÃ£o substituÃ­das."}</p>
            </div>
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setShowAiGen(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleAiGenerateFunnel} disabled={aiGenerating || !aiGenPrompt.trim()} className="gap-1.5">
                {aiGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {aiGenerating ? "Gerando..." : "Gerar Funil"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <FunilPipelineWizard
          open={showPipelineWizard}
          onClose={() => setShowPipelineWizard(false)}
          onApply={handlePipelineApply}
          projectId={selectedFunil?.project_id}
          products={projectProductsFull.map((p: any) => ({
            nome: p.nome || p.name || "",
            tipo: p.tipo_oferta || p.tipo || "",
            preco: p.preco_por || p.preco || p.price || "",
            link: p.ofertas?.[0]?.link || p.link || p.url || "",
          }))}
          model={aiGenModel}
        />
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-primary">ðŸ”— Funis</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-secondary rounded-md p-0.5">
            <Button size="sm" variant={viewMode === "hub" ? "default" : "ghost"} className="h-7 text-xs gap-1" onClick={() => setViewMode("hub")}>
              <Sparkles className="h-3 w-3" /> Hub
            </Button>
            <Button size="sm" variant={viewMode === "funis" ? "default" : "ghost"} className="h-7 text-xs gap-1" onClick={() => setViewMode("funis")}>
              <Layers className="h-3 w-3" /> Funis
            </Button>
            <Button size="sm" variant={viewMode === "ecossistema" ? "default" : "ghost"} className="h-7 text-xs gap-1" onClick={() => setViewMode("ecossistema")}>
              <Network className="h-3 w-3" /> Ecossistema
            </Button>
            <Button size="sm" variant={viewMode === "mapa" ? "default" : "ghost"} className="h-7 text-xs gap-1" onClick={() => setViewMode("mapa")}>
              <Building2 className="h-3 w-3" /> Mapa da Empresa
            </Button>
          </div>
          <Button size="sm" onClick={() => setShowCorteExpress(true)} className="gap-1 bg-primary hover:bg-primary/90">
            <Zap className="h-4 w-4" /> One Click
          </Button>
          {viewMode === "funis" && (
            <>
              <Button size="sm" variant="outline" asChild className="gap-1">
                <RouterLink to="/funis/simulador"><Calculator className="h-4 w-4" /> Simulador</RouterLink>
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowTemplates(true)} className="gap-1">
                <Sparkles className="h-4 w-4" /> Templates
              </Button>
              <Button size="sm" onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" /> Novo Funil</Button>
            </>
          )}
        </div>
      </div>

      {viewMode === "hub" ? (
        <ProductHubCanvas projects={projects} onProjectsReload={load} initialProjectId={hubProjectId} />
      ) : viewMode === "mapa" ? (
        <CompanyMapCanvas projects={projects} />
      ) : viewMode === "funis" ? (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar funil ou projeto..." className="pl-8 h-8 text-xs w-[220px]" />
            </div>
            <Select value={filterProject} onValueChange={setFilterProject}>
              <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue placeholder="Filtrar por projeto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Projetos</SelectItem>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="text-xs">{filtered.length} funis</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((f, idx) => {
              const etapas = f.data?.etapas || [];
              const statusStyle = STATUS_STYLES[f.status || "Rascunho"] || STATUS_STYLES.Rascunho;
              const kpi = f.project_id ? kpisByProject[f.project_id] : null;
              return (
                <Card key={f.id}
                  className={`bg-gradient-to-br ${statusStyle} border-border border-l-4 hover:scale-[1.02] cursor-pointer transition-all duration-200 animate-fade-in`}
                  style={{ animationDelay: `${idx * 60}ms`, animationFillMode: "both" }}
                  onClick={() => setSelectedFunil(f)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-sm">{f.nome}</h3>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button size="icon" variant="ghost" className="h-6 w-6" title="Clonar funil" onClick={() => setCloneFunil(f)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Badge variant={f.status === "Ativo" ? "default" : "outline"} className="text-[10px]">{f.status || "Rascunho"}</Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{f.tipo || "PerpÃ©tuo"} â€¢ {etapas.length} etapas</p>
                    {f.project_id && <p className="text-[10px] text-muted-foreground mt-1">{projectName(f.project_id)}</p>}

                    {kpi && (
                      <div className="grid grid-cols-4 gap-1 mt-3 pt-3 border-t border-border/30">
                        <div className="text-center">
                          <p className="text-[8px] uppercase tracking-wider text-muted-foreground">Leads</p>
                          <p className="text-xs font-bold text-foreground">{kpi.leads.toLocaleString("pt-BR")}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[8px] uppercase tracking-wider text-muted-foreground">Vendas</p>
                          <p className="text-xs font-bold text-emerald-400">{kpi.vendas.toLocaleString("pt-BR")}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[8px] uppercase tracking-wider text-muted-foreground">Conv.</p>
                          <p className={`text-xs font-bold ${getConversionColor(kpi.conv).text}`}>{kpi.conv.toFixed(1)}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[8px] uppercase tracking-wider text-muted-foreground">Receita</p>
                          <p className="text-xs font-bold text-primary">R$ {kpi.receita >= 1000 ? `${(kpi.receita / 1000).toFixed(1)}k` : kpi.receita.toFixed(0)}</p>
                        </div>
                      </div>
                    )}
                    {f.project_id && !kpi && (
                      <p className="text-[9px] text-muted-foreground/60 mt-3 pt-3 border-t border-border/30 text-center">Sem dados nos Ãºltimos 30d</p>
                    )}

                    {etapas.length > 0 && (
                      <div className="flex items-center gap-1 mt-2 overflow-hidden">
                        {etapas.slice(0, 5).map((e, i) => {
                          const ts = TIPO_STYLES[e.tipo || "outro"] || TIPO_STYLES.outro;
                          return (
                            <div key={i} className="flex items-center">
                              <div className={`px-1.5 py-0.5 rounded text-[8px] font-medium ${ts.bg} ${ts.text} border ${ts.border}`}>{e.nome}</div>
                              {i < Math.min(etapas.length, 5) - 1 && <ArrowRight className="h-2 w-2 text-muted-foreground/50 mx-0.5 shrink-0" />}
                            </div>
                          );
                        })}
                        {etapas.length > 5 && <span className="text-[9px] text-muted-foreground">+{etapas.length - 5}</span>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            {filtered.length === 0 && <p className="text-sm text-muted-foreground">Nenhum funil encontrado</p>}
          </div>

        </>
      ) : (
        <EcossistemaView projects={projects} />
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Funil</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Funil VSL Principal" /></div>
            <div>
              <Label>Projeto</Label>
              <Select value={form.project_id || "none"} onValueChange={v => setForm({ ...form, project_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PerpÃ©tuo">PerpÃ©tuo</SelectItem>
                    <SelectItem value="LanÃ§amento">LanÃ§amento</SelectItem>
                    <SelectItem value="Webinar">Webinar</SelectItem>
                    <SelectItem value="VSL">VSL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Rascunho">Rascunho</SelectItem>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                    <SelectItem value="Pausado">Pausado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={createFunil}>Criar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <FunnelTemplatesDialog
        open={showTemplates}
        onOpenChange={setShowTemplates}
        projects={projects}
        onCreated={load}
      />

      <CloneFunnelDialog
        open={!!cloneFunil}
        onOpenChange={(o) => !o && setCloneFunil(null)}
        funil={cloneFunil}
        projects={projects}
        onDone={load}
      />



      <FunnelSnapshotsDialog
        open={showSnapshots}
        onOpenChange={setShowSnapshots}
        funil={selectedFunil}
        onRestore={async (canvas) => {
          if (!selectedFunil) return;
          await supabase.from("imphq_funis").update({ data: canvas as any }).eq("id", selectedFunil.id);
          setSelectedFunil({ ...selectedFunil, data: canvas });
        }}
      />

      {selectedFunil?.project_id && (
        <LaunchTimelineDialog
          open={showTimeline}
          onClose={() => setShowTimeline(false)}
          projectId={selectedFunil.project_id}
          funilId={selectedFunil.id}
        />
      )}

      {selectedFunil && <FunnelBrainCard projectId={selectedFunil.project_id} />}

      {selectedFunil && (
        <AutoBuildDialog
          open={showAutoBuild}
          onOpenChange={setShowAutoBuild}
          projectId={selectedFunil.project_id}
          funilId={selectedFunil.id}
          onApplied={(etapas) => {
            setSelectedFunil({ ...selectedFunil, data: { ...selectedFunil.data, etapas } });
          }}
        />
      )}

      <OneClickModal
        open={showCorteExpress}
        onOpenChange={setShowCorteExpress}
        onComplete={(pid) => {
          setHubProjectId(pid);
          setViewMode("hub");
          load();
          setTimeout(() => setShowCorteExpress(false), 1200);
        }}
      />
    </div>
  );
}

// â”€â”€ Ecossistema View â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CLUSTER_LEVELS = [
  { key: "aquisicao", label: "AquisiÃ§Ã£o", color: "border-blue-500/50", bg: "bg-blue-500/5" },
  { key: "ascensao", label: "AscensÃ£o / Upsell", color: "border-amber-500/50", bg: "bg-amber-500/5" },
  { key: "core", label: "Core", color: "border-emerald-500/50", bg: "bg-emerald-500/5" },
  { key: "premium", label: "Premium", color: "border-rose-500/50", bg: "bg-rose-500/5" },
];

const PLATFORM_BADGES: Record<string, string> = {
  hotmart: "ðŸŸ§ Hotmart", kiwify: "ðŸŸª Kiwify", eduzz: "ðŸ”µ Eduzz",
  hubla: "ðŸŸ¢ Hubla", ticto: "ðŸŸ© Ticto", braip: "ðŸŸ¡ Braip",
};

interface ProductCard {
  projectId: string; projectName: string; nome: string; preco?: string;
  plataforma?: string; tipo?: string; descricao?: string; cluster: string; ofertas?: any[];
}

function EcossistemaView({ projects }: { projects: any[] }) {
  const allProducts: ProductCard[] = [];

  for (const proj of projects) {
    const b = typeof proj.briefing === "string" ? (() => { try { return JSON.parse(proj.briefing); } catch { return {}; } })() : (proj.briefing || {});
    const data = typeof proj.data === "string" ? (() => { try { return JSON.parse(proj.data); } catch { return {}; } })() : (proj.data || {});
    const produtos = b?.produtos || data?.produtos || [];
    const webhooks = data?.webhooks || b?.webhooks || [];
    const plataforma = webhooks[0]?.nome?.toLowerCase() || "";

    if (Array.isArray(produtos) && produtos.length > 0) {
      for (const p of produtos) {
        const nome = typeof p === "string" ? p : (p.nome || p.name || "");
        const preco = typeof p === "object" ? (p.preco || p.price || p.preco_por || "") : "";
        const tipo = typeof p === "object" ? (p.tipo_oferta || p.tipo || "") : "";
        const descricao = typeof p === "object" ? (p.descricao || "") : "";
        const ofertas = typeof p === "object" ? (p.ofertas || []) : [];

        let cluster = "core";
        const tipoLower = (tipo || "").toLowerCase();
        const nomeLower = nome.toLowerCase();
        if (tipoLower.includes("tripwire") || tipoLower.includes("isca") || nomeLower.includes("grÃ¡tis")) cluster = "aquisicao";
        else if (tipoLower.includes("upsell") || tipoLower.includes("bump")) cluster = "ascensao";
        else if (tipoLower.includes("premium") || tipoLower.includes("mentoria") || tipoLower.includes("high ticket")) cluster = "premium";

        if (nome) allProducts.push({ projectId: proj.id, projectName: proj.name || "", nome, preco: String(preco), plataforma, tipo, descricao, cluster, ofertas });
      }
    } else {
      allProducts.push({ projectId: proj.id, projectName: proj.name || "", nome: proj.name || "Sem nome", preco: "", plataforma, tipo: "", descricao: proj.description || "", cluster: "core", ofertas: [] });
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">VisÃ£o macro de todos os produtos organizados por nÃ­vel na escada de valor. Dados do briefing de cada projeto.</p>
      {CLUSTER_LEVELS.map((cluster) => {
        const items = allProducts.filter(p => p.cluster === cluster.key);
        return (
          <div key={cluster.key} className={`rounded-xl border-2 ${cluster.color} ${cluster.bg} p-4 space-y-3`}>
            <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              {cluster.label}
              <Badge variant="outline" className="text-[9px]">{items.length}</Badge>
            </h3>
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhum produto neste nÃ­vel</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {items.map((prod, idx) => {
                  const platLabel = PLATFORM_BADGES[prod.plataforma || ""] || "";
                  return (
                    <Card key={`${prod.projectId}-${idx}`} className="bg-card border-border hover:border-primary/30 transition-colors">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold truncate flex-1">{prod.nome}</h4>
                          {prod.preco && prod.preco !== "0" && prod.preco !== "" && <span className="text-sm font-mono font-bold text-primary ml-2">R${prod.preco}</span>}
                        </div>
                        <p className="text-[10px] text-muted-foreground">{prod.projectName}</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {platLabel && <Badge variant="outline" className="text-[9px]">{platLabel}</Badge>}
                          {prod.tipo && <Badge variant="secondary" className="text-[9px]">{prod.tipo}</Badge>}
                        </div>
                        {prod.descricao && <p className="text-[10px] text-muted-foreground line-clamp-2">{prod.descricao}</p>}
                        {prod.ofertas && prod.ofertas.length > 0 && (
                          <div className="border-t border-border pt-1.5 space-y-1">
                            <p className="text-[9px] font-medium text-muted-foreground uppercase">Ofertas</p>
                            {prod.ofertas.map((of: any, oi: number) => (
                              <div key={oi} className="flex items-center justify-between text-[10px]">
                                <span className="truncate flex-1">{of.nome || `Oferta ${oi + 1}`}</span>
                                {of.preco_por && <span className="font-mono text-primary">R${of.preco_por}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {allProducts.length === 0 && (
        <div className="text-center py-12">
          <Network className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum produto encontrado. Adicione produtos no Briefing dos projetos.</p>
        </div>
      )}
    </div>
  );
}

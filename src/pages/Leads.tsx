import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { SectionInfo } from "@/components/SectionInfo";
import { sectionHelpTexts } from "@/data/sectionHelpTexts";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Calendar } from "@/components/ui/calendar";
import { EditableTagList } from "@/components/projeto/EditableTagList";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, LineChart, Line, AreaChart, Area, CartesianGrid, Cell } from "recharts";
import { Search, MessageCircle, Plus, Trash2, Users, UserCheck, Crown, DollarSign, RefreshCw, Radio, Eye, ShoppingCart, MousePointerClick, Globe, Zap, FileUp, AlertCircle, Package, X, BarChart3, Mail, Send, Play, CalendarIcon, TrendingUp, Clock, Target, Megaphone, Copy, Sparkles, Flame, ListChecks, FileText, Brain, Tag, Download, PanelLeftClose, PanelLeftOpen, Activity } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { format, isToday, parseISO, isValid, subDays, startOfMonth, endOfMonth, subMonths, differenceInHours, differenceInDays, isWithinInterval, startOfDay, endOfDay, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LeadImportDialog } from "@/components/leads/LeadImportDialog";
import { FormBuilder } from "@/components/leads/FormBuilder";
import { FormInsights } from "@/components/leads/FormInsights";
import { MembrosWebhookGuide } from "@/components/leads/MembrosWebhookGuide";
import { AIGenerateButton } from "@/components/projeto/AIGenerateButton";
import LeadsTable, { getLeadStage, STAGE_LABELS, type Lead, type LeadVenda } from "@/components/leads/LeadsTable";
import LeadsSidebar from "@/components/leads/LeadsSidebar";
import QuickTagRuleDialog from "@/components/leads/QuickTagRuleDialog";
import { useLeadTags } from "@/hooks/useLeadTags";


import LeadWhatsAppDialog from "@/components/leads/LeadWhatsAppDialog";
import LeadJourneyDrawer from "@/components/leads/LeadJourneyDrawer";
import LeadPredictivePanel from "@/components/leads/LeadPredictivePanel";
import { LeadNurtureTimeline } from "@/components/nurture/LeadNurtureTimeline";
import LeadUtmsPanel from "@/components/leads/LeadUtmsPanel";
import AttributionSummary from "@/components/leads/AttributionSummary";
import HotLeadsInbox from "@/components/leads/HotLeadsInbox";
import { useLeadTimeline } from "@/hooks/useLeadTimeline";
import LeadCostPanel from "@/components/leads/LeadCostPanel";

const STATUS_COLORS: Record<string, string> = {
  lead: "bg-primary/20 text-primary",
  cliente: "bg-emerald-500/20 text-emerald-400",
  vip: "bg-accent/20 text-accent-foreground",
  inativo: "bg-muted text-muted-foreground",
};
const STATUSES = ["lead", "cliente", "vip", "inativo"];
const PLATFORMS = ["Meta", "Google", "TikTok", "Hotmart", "Kiwify", "Ticto", "Orgânico", "Indicação"];
const STAGES = Object.keys(STAGE_LABELS);




function getLeadActivityDate(lead: Lead): string | null {
  const data = (lead.data as any) || {};
  const interacoes = Array.isArray(data.interacoes) ? data.interacoes : [];
  const lastInteraction = interacoes.length > 0 ? interacoes[interacoes.length - 1]?.data : null;
  return data.ultimo_evento_em || lastInteraction || lead.updated_at || lead.criado_em || null;
}

const EVENT_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  PageView: { icon: <Globe className="h-3 w-3" />, color: "bg-blue-500", label: "Página Vista" },
  LeadCapture: { icon: <Users className="h-3 w-3" />, color: "bg-emerald-500", label: "Lead Capturado" },
  ViewContent: { icon: <Eye className="h-3 w-3" />, color: "bg-violet-500", label: "Conteúdo Visto" },
  AddToCart: { icon: <ShoppingCart className="h-3 w-3" />, color: "bg-amber-500", label: "Add ao Carrinho" },
  Purchase: { icon: <DollarSign className="h-3 w-3" />, color: "bg-primary", label: "Compra" },
  click: { icon: <MousePointerClick className="h-3 w-3" />, color: "bg-cyan-500", label: "Click UTM" },
  ButtonClick: { icon: <Zap className="h-3 w-3" />, color: "bg-orange-500", label: "Click" },
  CSVImport: { icon: <FileUp className="h-3 w-3" />, color: "bg-indigo-500", label: "Importado CSV" },
  PixGerado: { icon: <DollarSign className="h-3 w-3" />, color: "bg-yellow-500", label: "Pix Gerado" },
  CarrinhoAbandonado: { icon: <ShoppingCart className="h-3 w-3" />, color: "bg-amber-600", label: "Carrinho Abandonado" },
  CompraAprovada: { icon: <DollarSign className="h-3 w-3" />, color: "bg-emerald-600", label: "Compra Aprovada" },
  Reembolso: { icon: <RefreshCw className="h-3 w-3" />, color: "bg-red-500", label: "Reembolso" },
  LeadNovo: { icon: <Users className="h-3 w-3" />, color: "bg-blue-400", label: "Lead Novo" },
  FormResponse: { icon: <Radio className="h-3 w-3" />, color: "bg-purple-500", label: "Resposta Formulário" },
  Recovery: { icon: <Zap className="h-3 w-3" />, color: "bg-amber-500", label: "Disparo de Recuperação" },
};

const FUNNEL_COLORS = ["hsl(var(--primary))", "#f59e0b", "#ef4444", "#10b981"];

type PeriodKey = "today" | "yesterday" | "7d" | "30d" | "90d" | "this_month" | "last_month" | "custom";
const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Hoje" }, { key: "yesterday", label: "Ontem" }, { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" }, { key: "90d", label: "90 dias" }, { key: "this_month", label: "Este mês" },
  { key: "last_month", label: "Mês passado" }, { key: "custom", label: "Personalizado" },
];

function getPeriodRange(key: PeriodKey, customFrom?: Date, customTo?: Date): { from: Date; to: Date } {
  const now = new Date();
  switch (key) {
    case "today": return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": { const y = subDays(now, 1); return { from: startOfDay(y), to: endOfDay(y) }; }
    case "7d": return { from: startOfDay(subDays(now, 7)), to: endOfDay(now) };
    case "30d": return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
    case "90d": return { from: startOfDay(subDays(now, 90)), to: endOfDay(now) };
    case "this_month": return { from: startOfMonth(now), to: endOfDay(now) };
    case "last_month": { const lm = subMonths(now, 1); return { from: startOfMonth(lm), to: endOfMonth(lm) }; }
    case "custom": return { from: customFrom || startOfDay(subDays(now, 30)), to: customTo || endOfDay(now) };
    default: return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
  }
}

function formatConversionTime(hours: number): string {
  if (hours < 1) return "< 1h";
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  const remaining = Math.round(hours % 24);
  return remaining > 0 ? `${days}d ${remaining}h` : `${days}d`;
}

function getConversionBucket(hours: number): string {
  if (hours < 24) return "0-1d";
  if (hours < 72) return "1-3d";
  if (hours < 168) return "3-7d";
  if (hours < 336) return "7-14d";
  if (hours < 720) return "14-30d";
  return "30d+";
}

const PAGE_SIZE = 50;
const FILTERS_KEY = "imphq:leads:filters:v1";

// Cache de dados de referência da página Leads (5min TTL) - evita refetch ao mudar filtros/páginas
let leadsRefCache: {
  at: number;
  projects: any[];
  automations: any[];
  waProviders: any[];
  waTemplates: any[];
  captureForms: { id: string; name: string }[];
  projectCounts: { totalAll: number; byProject: Record<string, number>; noProject: number };
} | null = null;
type PersistedFilters = {
  statusFilter: string; platformFilter: string; projectFilter: string;
  stageFilter: string; productFilter: string; formFilter: string; hotOnly: boolean;
  tagFilter: string;
};
function loadPersistedFilters(): Partial<PersistedFilters> {
  try { const raw = localStorage.getItem(FILTERS_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

export default function Leads() {
  const persisted = loadPersistedFilters();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [projectCounts, setProjectCounts] = useState<{ totalAll: number; byProject: Record<string, number>; noProject: number }>({ totalAll: 0, byProject: {}, noProject: 0 });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(persisted.statusFilter ?? "all");
  const [platformFilter, setPlatformFilter] = useState(persisted.platformFilter ?? "all");
  const [projectFilter, setProjectFilter] = useState(persisted.projectFilter ?? "all");
  const [showNew, setShowNew] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [form, setForm] = useState({ nome: "", email: "", phone: "", plataforma: "", status: "lead", tags: [] as string[] });
  const [realtimeActive, setRealtimeActive] = useState(false);
  const [stageFilter, setStageFilter] = useState(persisted.stageFilter ?? "all");
  const [hotOnly, setHotOnly] = useState<boolean>(persisted.hotOnly ?? false);
  const [tagFilter, setTagFilter] = useState<string>(persisted.tagFilter ?? "all");
  const [showImport, setShowImport] = useState(false);
  const [productFilter, setProductFilter] = useState(persisted.productFilter ?? "all");
  const [products, setProducts] = useState<string[]>([]);
  const [productLeadIds, setProductLeadIds] = useState<Set<string> | null>(null);
  const [formFilter, setFormFilter] = useState(persisted.formFilter ?? "all");
  const [captureForms, setCaptureForms] = useState<{id: string; name: string}[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkTagInput, setBulkTagInput] = useState("");
  const [quickRuleTag, setQuickRuleTag] = useState<string | null>(null);


  const [mainTab, setMainTab] = useState("leads");
  const [automations, setAutomations] = useState<any[]>([]);
  
  const [allVendasRaw, setAllVendasRaw] = useState<any[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [adsSpend, setAdsSpend] = useState<any[]>([]);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<PeriodKey>("30d");
  const [customFrom, setCustomFrom] = useState<Date>();
  const [customTo, setCustomTo] = useState<Date>();
  const [waProviders, setWaProviders] = useState<any[]>([]);
  const [waTemplates, setWaTemplates] = useState<any[]>([]);
  const [showWaDialog, setShowWaDialog] = useState(false);
  const [journeyLead, setJourneyLead] = useState<Lead | null>(null);
  const [waTarget, setWaTarget] = useState<Lead | null>(null);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<"recent" | "updated" | "score">("recent");
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("leads.sidebar.collapsed") === "1"; } catch { return false; }
  });
  const toggleSidebar = () => setSidebarCollapsed((v) => {
    const nv = !v; try { localStorage.setItem("leads.sidebar.collapsed", nv ? "1" : "0"); } catch {} return nv;
  });
  const projectFilterRef = useRef(projectFilter);
  projectFilterRef.current = projectFilter;

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => { setDebouncedSearch(val); setPage(0); }, 400);
  }, []);

  const calcScore = (l: Lead, vendasList: LeadVenda[]) => {
    let s = 0;
    if (l.email) s += 10;
    if (vendasList.length > 0) s += 30;
    if (vendasList.length > 1) s += 20;
    const utms = (l.data as any)?.utms;
    if (utms && Object.values(utms).some(Boolean)) s += 5;
    if (l.phone) s += 5;
    return Math.min(s, 100);
  };

  const load = async () => {
    setLoading(true);
    let leadsQuery = supabase.from("imphq_leads").select("*", { count: "exact" });
    if (debouncedSearch) leadsQuery = leadsQuery.or(`nome.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%`);
    if (statusFilter !== "all") leadsQuery = leadsQuery.eq("status", statusFilter);
    if (platformFilter !== "all") leadsQuery = leadsQuery.eq("plataforma", platformFilter);
    if (projectFilter !== "all" && projectFilter !== "none") leadsQuery = leadsQuery.eq("project_id", projectFilter);
    else if (projectFilter === "none") leadsQuery = leadsQuery.is("project_id", null);
    if (tagFilter !== "all") leadsQuery = leadsQuery.contains("tags", [tagFilter]);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    if (sortBy === "score") {
      leadsQuery = leadsQuery.order("score", { ascending: false, nullsFirst: false }).order("criado_em", { ascending: false, nullsFirst: false }).range(from, to);
    } else if (sortBy === "updated") {
      leadsQuery = leadsQuery.order("updated_at", { ascending: false, nullsFirst: false }).order("criado_em", { ascending: false, nullsFirst: false }).range(from, to);
    } else {
      // "recent" = mais novos por data de criação (dia atual no topo)
      leadsQuery = leadsQuery.order("criado_em", { ascending: false, nullsFirst: false }).range(from, to);
    }

    let vendasQuery = supabase.from("imphq_vendas").select("id, lead_id, produto_nome, valor, plataforma, status, data, created_at").order("created_at", { ascending: false }).limit(1000);
    if (projectFilter !== "all" && projectFilter !== "none") {
      vendasQuery = vendasQuery.eq("project_id", projectFilter);
    }

    const [leadsRes, vendasRes, adsRes] = await Promise.all([
      leadsQuery,
      vendasQuery,
      supabase.from("imphq_ads_spend").select("id, data_ref, valor, plataforma, campanha, project_id").order("data_ref", { ascending: false }).limit(500),
    ]);

    setTotalCount(leadsRes.count ?? 0);
    const allVendas = (vendasRes.data || []) as any[];
    setAllVendasRaw(allVendas);
    setAdsSpend(adsRes.data || []);
    const vendasByLead = new Map<string, LeadVenda[]>();
    allVendas.forEach((v: any) => { if (!v.lead_id) return; if (!vendasByLead.has(v.lead_id)) vendasByLead.set(v.lead_id, []); vendasByLead.get(v.lead_id)!.push({ id: v.id, produto_nome: v.produto_nome, valor: parseFloat(v.valor) || 0, plataforma: v.plataforma, status: v.status, data: v.data, created_at: v.created_at }); });
    const enrichedLeads = (leadsRes.data || []).map((l: any) => { const lv = vendasByLead.get(l.id) || []; return { ...l, _vendas: lv, _score: calcScore(l, lv) }; }) as Lead[];
    setLeads(enrichedLeads);
    setProducts([...new Set(allVendas.map((v: any) => v.produto_nome).filter(Boolean))] as string[]);
    if (productFilter !== "all") { setProductLeadIds(new Set(allVendas.filter((v: any) => v.produto_nome === productFilter).map((v: any) => v.lead_id))); } else { setProductLeadIds(null); }
    setSelectedIds(new Set());
    setLoading(false);
  };

  // Dados de referência (projetos, automações, providers WA, templates, forms, contagens) mudam raramente.
  // Carregam 1x na montagem + cache de 5min para evitar refetch ao trocar filtros/páginas.
  const loadReference = async () => {
    const now = Date.now();
    const TTL = 5 * 60_000;
    if (leadsRefCache && now - leadsRefCache.at < TTL) {
      setProjects(leadsRefCache.projects);
      setAutomations(leadsRefCache.automations);
      setWaProviders(leadsRefCache.waProviders);
      setWaTemplates(leadsRefCache.waTemplates);
      setCaptureForms(leadsRefCache.captureForms);
      setProjectCounts(leadsRefCache.projectCounts);
      return;
    }
    const [projRes, autoRes, waProvRes, waTplRes, hubSessionsRes, formsRes, countsRes] = await Promise.all([
      supabase.from("imphq_projects").select("id, name, icon"),
      supabase.from("imphq_automacoes").select("*").order("created_at", { ascending: false }),
      supabase.from("imphq_wa_providers").select("*").eq("is_active", true),
      supabase.from("imphq_wa_templates").select("id, name, content, category, project_id").order("name"),
      supabase.from("wa_hub_iso_sessions").select("id, session_key, tenant_id, status").eq("status", "connected"),
      supabase.from("imphq_capture_forms").select("id, name").order("name"),
      supabase.rpc("count_leads_by_project" as any),
    ]);
    const countRows = ((countsRes as any)?.data || []) as Array<{ project_id: string; total: number | string }>;
    const byProject: Record<string, number> = {};
    let noProject = 0;
    let totalAll = 0;
    countRows.forEach((r) => {
      const n = Number(r.total) || 0;
      totalAll += n;
      if (r.project_id === "__none__") noProject = n;
      else byProject[r.project_id] = n;
    });
    const projectCounts = { totalAll, byProject, noProject };
    const hubProviders = (hubSessionsRes.data || []).map((s: any) => ({ id: `hub_${s.id}`, provider: "hub_local", instance_name: s.session_key, twilio_from: null, project_id: s.tenant_id || null, is_active: true }));
    const projects = projRes.data || [];
    const automations = autoRes.data || [];
    const waProviders = [...(waProvRes.data || []), ...hubProviders];
    const waTemplates = waTplRes.data || [];
    const captureForms = (formsRes.data || []).map((f: any) => ({ id: f.id, name: f.name }));
    leadsRefCache = { at: Date.now(), projects, automations, waProviders, waTemplates, captureForms, projectCounts };
    setProjects(projects);
    setAutomations(automations);
    setWaProviders(waProviders);
    setWaTemplates(waTemplates);
    setCaptureForms(captureForms);
    setProjectCounts(projectCounts);
  };

  useEffect(() => { loadReference(); }, []);
  useEffect(() => { load(); }, [page, debouncedSearch, statusFilter, platformFilter, projectFilter, productFilter, tagFilter, sortBy]);

  // Persist filters
  useEffect(() => {
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify({
        statusFilter, platformFilter, projectFilter, stageFilter, productFilter, formFilter, hotOnly, tagFilter,
      } satisfies PersistedFilters));
    } catch {}
  }, [statusFilter, platformFilter, projectFilter, stageFilter, productFilter, formFilter, hotOnly, tagFilter]);

  useEffect(() => {
    const channel = supabase.channel("leads-realtime").on("postgres_changes", { event: "INSERT", schema: "public", table: "imphq_leads" }, (payload) => {
      const newLead = payload.new as Lead;
      setLeads((prev) => [{ ...newLead, _isNew: true }, ...prev]);
      const pf = projectFilterRef.current;
      const matchesFilter = pf === "all" || newLead.project_id === pf || (!newLead.project_id && pf === "none");
      if (matchesFilter) toast.success(`Novo lead: ${newLead.nome || newLead.email || "Desconhecido"}`, { description: newLead.plataforma ? `Via ${newLead.plataforma}` : undefined });
      setTimeout(() => { setLeads((prev) => prev.map((l) => l.id === newLead.id ? { ...l, _isNew: false } : l)); }, 3000);
    }).subscribe((status) => { setRealtimeActive(status === "SUBSCRIBED"); });
    return () => { supabase.removeChannel(channel); };
  }, []);

  const { timeline, loading: timelineLoading, leadAutomationLogs, scoreLog, formResponses, recoveryLogs } = useLeadTimeline(editLead, automations);

  const HOT_STAGES = new Set(["pix_gerado", "aguardando_pagamento", "carrinho_abandonado"]);
  const filtered = leads.filter((l) => {
    const matchStage = stageFilter === "all" || getLeadStage(l) === stageFilter;
    const matchProduct = productFilter === "all" || (productLeadIds && productLeadIds.has(l.id));
    const matchForm = formFilter === "all" || (l.data as any)?.form_id === formFilter || (l.data as any)?.interacoes?.some((i: any) => i.form_id === formFilter);
    const matchTag = tagFilter === "all" || (Array.isArray(l.tags) && l.tags.includes(tagFilter));
    let matchHot = true;
    if (hotOnly) {
      const stg = getLeadStage(l);
      if (!HOT_STAGES.has(stg)) matchHot = false;
      else {
        const ref = getLeadActivityDate(l);
        if (!ref) matchHot = false;
        else {
          try { matchHot = differenceInHours(new Date(), parseISO(ref)) <= 2; } catch { matchHot = false; }
        }
      }
    }
    return matchStage && matchProduct && matchForm && matchHot && matchTag;
  });


  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const allFilteredSelected = filtered.length > 0 && filtered.every(l => selectedIds.has(l.id));
  const someSelected = selectedIds.size > 0;
  const toggleSelectAll = () => { if (allFilteredSelected) setSelectedIds(new Set()); else setSelectedIds(new Set(filtered.map(l => l.id))); };
  const toggleSelect = (id: string) => { setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };

  const deleteSelected = async () => { const ids = Array.from(selectedIds); for (let i = 0; i < ids.length; i += 50) { const chunk = ids.slice(i, i + 50); await supabase.from("imphq_vendas").delete().in("lead_id", chunk); await supabase.from("imphq_leads").delete().in("id", chunk); } toast.success(`${ids.length} leads removidos`); setBulkDeleteConfirm(false); setSelectedIds(new Set()); load(); };

  const addTagToSelected = async (tag: string) => {
    const clean = tag.trim();
    if (!clean) return;
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const targets = leads.filter(l => selectedIds.has(l.id));
    let updated = 0;
    for (const l of targets) {
      const current = Array.isArray(l.tags) ? l.tags : [];
      if (current.includes(clean)) continue;
      const next = [...current, clean];
      const { error } = await supabase.from("imphq_leads").update({ tags: next }).eq("id", l.id);
      if (!error) {
        updated++;
        supabase.functions.invoke("openflow-executor", {
          body: {
            trigger_tipo: "tag_adicionada",
            project_id: l.project_id || "manual",
            lead_data: {
              lead_id: l.id,
              nome: l.nome || "",
              email: l.email || "",
              phone: l.phone || "",
              telefone: l.phone || "",
              tags: next,
            },
          },
        }).then(res => console.log("Flow trigger tag_adicionada bulk result", res.data))
          .catch(err => console.warn("Flow trigger tag_adicionada bulk err", err));
      }
    }
    toast.success(`Tag "${clean}" aplicada em ${updated} lead(s)`);
    setBulkTagInput("");
    setSelectedIds(new Set());
    load();
  };


  const moveSelectedToProject = async (projId: string | null) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      const { error } = await supabase.from("imphq_leads").update({ project_id: projId }).in("id", chunk);
      if (error) { toast.error(error.message); return; }
    }
    toast.success(`${ids.length} leads movidos`);
    setSelectedIds(new Set());
    load();
  };

  const changeStatusForSelected = async (newStatus: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      const { error } = await supabase.from("imphq_leads").update({ status: newStatus }).in("id", chunk);
      if (error) { toast.error(error.message); return; }
    }
    toast.success(`${ids.length} lead(s) → ${newStatus}`);
    setSelectedIds(new Set());
    load();
  };



  const createLead = async () => {
    if (!form.nome.trim()) { toast.error("Nome obrigatório"); return; }
    const id = crypto.randomUUID();
    const { error } = await supabase.from("imphq_leads").insert({ id, nome: form.nome, email: form.email || null, phone: form.phone || null, plataforma: form.plataforma || null, status: form.status, tags: form.tags, project_id: projectFilter !== "all" && projectFilter !== "none" ? projectFilter : null });
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Lead criado!"); setShowNew(false); setForm({ nome: "", email: "", phone: "", plataforma: "", status: "lead", tags: [] }); load();
  };

  const saveEdit = async () => {
    if (!editLead) return;
    const { error } = await supabase.from("imphq_leads").update({ nome: editLead.nome, email: editLead.email, phone: editLead.phone, plataforma: editLead.plataforma, status: editLead.status, tags: editLead.tags, data: editLead.data || {} }).eq("id", editLead.id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Lead atualizado!");

    // Check if new tags were added to trigger automations
    const originalLead = leads.find(l => l.id === editLead.id);
    const prevTags = originalLead && Array.isArray(originalLead.tags) ? originalLead.tags : [];
    const newTags = (editLead.tags || []).filter((t: string) => !prevTags.includes(t));
    if (newTags.length > 0) {
      supabase.functions.invoke("openflow-executor", {
        body: {
          trigger_tipo: "tag_adicionada",
          project_id: editLead.project_id || "manual",
          lead_data: {
            lead_id: editLead.id,
            nome: editLead.nome || "",
            email: editLead.email || "",
            phone: editLead.phone || "",
            telefone: editLead.phone || "",
            tags: editLead.tags,
          },
        },
      }).then(res => console.log("Flow trigger tag_adicionada edit result", res.data))
        .catch(err => console.warn("Flow trigger tag_adicionada edit err", err));
    }

    setEditLead(null); load();
  };

  const deleteLead = async (id: string) => { await supabase.from("imphq_vendas").delete().eq("lead_id", id); await supabase.from("imphq_leads").delete().eq("id", id); toast.success("Lead e vendas associadas removidos"); setEditLead(null); setDeleteConfirm(null); load(); };

  const triggerAutomation = async (lead: Lead, auto: any) => {
    try {
      const { data, error } = await supabase.functions.invoke("openflow-executor", {
        body: {
          trigger_tipo: auto.trigger_tipo,
          project_id: lead.project_id || auto.project_id || "manual",
          automacao_id: auto.id,
          lead_data: {
            lead_id: lead.id,
            nome: lead.nome || "",
            email: lead.email || "",
            phone: lead.phone || "",
            telefone: lead.phone || "",
            produto: (lead.data as any)?.ultimo_produto || "",
          },
        },
      });
      if (error) throw error;
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.from("imphq_activity_log").insert({ action: "automacao_executada", entity_type: "lead", entity_id: lead.id, lead_id: lead.id, user_id: user.id, details: { automacao_nome: auto.nome, automacao_id: auto.id, result: data } });
      if (data?.ok) {
        const msgs = data.results?.reduce((s: number, r: any) => s + (r.messages_sent || 0), 0) || 0;
        toast.success(`Automação "${auto.nome}" executada! ${msgs} msg enviada(s)`);
      } else {
        toast.error(`Automação falhou: ${data?.error || "erro desconhecido"}`);
      }
    } catch (err: any) { toast.error("Erro ao executar automação: " + err.message); }
  };

  const sendQuickEmail = async (lead: Lead) => {
    if (!lead.email || !lead.project_id) { toast.error("Lead precisa ter email e projeto"); return; }
    const { data: proj } = await supabase.from("imphq_projects").select("data").eq("id", lead.project_id).single();
    const templates = (proj?.data as any)?.email_config?.templates || [];
    if (templates.length === 0) { toast.error("Nenhum template de email configurado neste projeto"); return; }
    const { error } = await supabase.functions.invoke("send-project-email", { body: { project_id: lead.project_id, template_id: templates[0].id, to_email: lead.email } });
    if (error) { toast.error("Erro: " + error.message); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from("imphq_activity_log").insert({ action: "email_enviado", entity_type: "lead", entity_id: lead.id, lead_id: lead.id, user_id: user.id, details: { template: templates[0].name, to: lead.email } });
    toast.success(`Email enviado para ${lead.email}`);
  };

  const sendQuickWhatsApp = (lead: Lead) => { if (!lead.phone) { toast.error("Lead sem telefone"); return; } setWaTarget(lead); setShowWaDialog(true); };

  const toggleProject = (pid: string) => { setExpandedProjects(prev => { const next = new Set(prev); if (next.has(pid)) next.delete(pid); else next.add(pid); return next; }); };

  const getConversionHours = (lead: Lead): number | null => {
    if (!lead.criado_em || !lead._vendas || lead._vendas.length === 0) return null;
    const approvedSale = lead._vendas.find(v => v.status === "Aprovada" || v.status === "aprovada" || v.status === "approved");
    const firstSale = approvedSale || lead._vendas[0];
    if (!firstSale.created_at) return null;
    try { const leadDate = parseISO(lead.criado_em); const saleDate = parseISO(firstSale.created_at); if (!isValid(leadDate) || !isValid(saleDate)) return null; return differenceInHours(saleDate, leadDate); } catch { return null; }
  };

  // Analytics
  const periodRange = useMemo(() => getPeriodRange(analyticsPeriod, customFrom, customTo), [analyticsPeriod, customFrom, customTo]);
  const periodLeads = useMemo(() => leads.filter(l => { if (!l.criado_em) return false; try { const d = parseISO(l.criado_em); return isValid(d) && isWithinInterval(d, { start: periodRange.from, end: periodRange.to }); } catch { return false; } }), [leads, periodRange]);
  const periodVendas = useMemo(() => allVendasRaw.filter(v => { if (!v.created_at) return false; try { const d = parseISO(v.created_at); return isValid(d) && isWithinInterval(d, { start: periodRange.from, end: periodRange.to }); } catch { return false; } }), [allVendasRaw, periodRange]);
  const periodAds = useMemo(() => adsSpend.filter(a => { if (!a.data_ref) return false; try { const d = parseISO(a.data_ref); return isValid(d) && isWithinInterval(d, { start: periodRange.from, end: periodRange.to }); } catch { return false; } }), [adsSpend, periodRange]);

  const periodKPIs = useMemo(() => {
    const newLeads = periodLeads.length;
    const isApproved = (s: string) => ["Aprovada", "aprovada", "approved", "aprovado", "Aprovado"].includes(s);
    const conversions = periodVendas.filter(v => isApproved(v.status)).length;
    const revenue = periodVendas.filter(v => isApproved(v.status)).reduce((s, v) => s + (parseFloat(v.valor) || 0), 0);
    const avgTicket = conversions > 0 ? revenue / conversions : 0;
    const convRate = newLeads > 0 ? (conversions / newLeads * 100) : 0;
    const convTimes: number[] = []; periodLeads.forEach(l => { const h = getConversionHours(l); if (h !== null && h >= 0) convTimes.push(h); });
    const avgConvTime = convTimes.length > 0 ? convTimes.reduce((a, b) => a + b, 0) / convTimes.length : null;
    const totalAds = periodAds.reduce((s, a) => s + (parseFloat(a.valor) || 0), 0);
    const roas = totalAds > 0 ? revenue / totalAds : null;
    return { newLeads, conversions, revenue, avgTicket, convRate, avgConvTime, totalAds, roas };
  }, [periodLeads, periodVendas, periodAds]);

  const leadsByProduct = useMemo(() => { const isApproved = (s: string) => ["Aprovada", "aprovada", "approved", "aprovado", "Aprovado"].includes(s); const map = new Map<string, number>(); periodVendas.filter(v => isApproved(v.status)).forEach(v => { if (!v.produto_nome) return; map.set(v.produto_nome, (map.get(v.produto_nome) || 0) + 1); }); return Array.from(map.entries()).map(([name, count]) => ({ name: name.substring(0, 25), count })).sort((a, b) => b.count - a.count).slice(0, 10); }, [periodVendas]);
  const revenueByProduct = useMemo(() => { const map = new Map<string, number>(); periodVendas.filter(v => ["Aprovada", "aprovada", "approved", "aprovado", "Aprovado"].includes(v.status)).forEach(v => { if (!v.produto_nome) return; map.set(v.produto_nome, (map.get(v.produto_nome) || 0) + (parseFloat(v.valor) || 0)); }); return Array.from(map.entries()).map(([name, revenue]) => ({ name: name.substring(0, 25), revenue: Math.round(revenue) })).sort((a, b) => b.revenue - a.revenue).slice(0, 10); }, [periodVendas]);
  const conversionTimeDist = useMemo(() => { const buckets: Record<string, number> = { "0-1d": 0, "1-3d": 0, "3-7d": 0, "7-14d": 0, "14-30d": 0, "30d+": 0 }; periodLeads.forEach(l => { const h = getConversionHours(l); if (h !== null && h >= 0) buckets[getConversionBucket(h)]++; }); return Object.entries(buckets).map(([name, count]) => ({ name, count })); }, [periodLeads]);
  const leadsVsAds = useMemo(() => {
    const dayMap = new Map<string, { leads: number; ads: number; revenue: number }>();
    // Preenche todos os dias do período com zero (evita buracos no eixo X)
    try {
      const days = eachDayOfInterval({ start: startOfDay(periodRange.from), end: endOfDay(periodRange.to) });
      days.forEach(d => { dayMap.set(format(d, "yyyy-MM-dd"), { leads: 0, ads: 0, revenue: 0 }); });
    } catch {}
    const bump = (iso: string | null | undefined, patch: Partial<{ leads: number; ads: number; revenue: number }>) => {
      if (!iso) return;
      try {
        const key = format(parseISO(iso), "yyyy-MM-dd");
        const entry = dayMap.get(key) || { leads: 0, ads: 0, revenue: 0 };
        if (patch.leads) entry.leads += patch.leads;
        if (patch.ads) entry.ads += patch.ads;
        if (patch.revenue) entry.revenue += patch.revenue;
        dayMap.set(key, entry);
      } catch {}
    };
    periodLeads.forEach(l => bump(l.criado_em, { leads: 1 }));
    periodAds.forEach(a => bump(a.data_ref, { ads: parseFloat(a.valor) || 0 }));
    const APROVADOS = ["Aprovada", "aprovada", "approved", "aprovado", "Aprovado"];
    periodVendas.filter(v => APROVADOS.includes(v.status)).forEach(v => bump(v.created_at, { revenue: parseFloat(v.valor) || 0 }));
    return Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, d]) => ({ day: format(parseISO(key), "dd/MM"), leads: d.leads, ads: d.ads, revenue: d.revenue }));
  }, [periodLeads, periodAds, periodVendas, periodRange]);
  const funnelData = useMemo(() => { const stages = { lead_capturado: 0, carrinho_abandonado: 0, pix_gerado: 0, compra_aprovada: 0 }; periodLeads.forEach(l => { const stage = getLeadStage(l); if (stage in stages) (stages as any)[stage]++; }); return [ { stage: "Leads", value: stages.lead_capturado, fill: "hsl(var(--primary))" }, { stage: "Carrinho", value: stages.carrinho_abandonado, fill: "#f59e0b" }, { stage: "Pix", value: stages.pix_gerado, fill: "#ef4444" }, { stage: "Clientes", value: stages.compra_aprovada, fill: "#10b981" } ]; }, [periodLeads]);
  const leadsByMonth = useMemo(() => { const map = new Map<string, number>(); leads.forEach(l => { if (!l.criado_em) return; try { const d = parseISO(l.criado_em); if (!isValid(d)) return; const key = format(d, "MMM/yy", { locale: ptBR }); map.set(key, (map.get(key) || 0) + 1); } catch {} }); return Array.from(map.entries()).map(([month, count]) => ({ month, count })).reverse().slice(-12); }, [leads]);
  const pixHoje = useMemo(() => leads.filter(l => { const stage = getLeadStage(l); if (!["pix_gerado", "aguardando_pagamento"].includes(stage)) return false; const refDate = getLeadActivityDate(l); if (!refDate) return true; try { return isToday(parseISO(refDate)); } catch { return false; } }), [leads]);
  const { counts: topTags } = useLeadTags(projectFilter === "all" || projectFilter === "none" ? null : projectFilter);



  const chartConfig = { count: { label: "Leads", color: "hsl(var(--primary))" }, revenue: { label: "Receita", color: "#10b981" }, value: { label: "Qtd", color: "hsl(var(--primary))" }, leads: { label: "Leads", color: "hsl(var(--primary))" }, ads: { label: "Ads R$", color: "#ef4444" } };

  return (
    <div className="flex gap-3 md:gap-6">
      {!sidebarCollapsed && (
        <div className="hidden md:block">
          <LeadsSidebar projects={projects} leads={leads} allVendasRaw={allVendasRaw} projectFilter={projectFilter} productFilter={productFilter} expandedProjects={expandedProjects} onProjectFilter={(v) => { setProjectFilter(v); setPage(0); }} onProductFilter={(v) => { setProductFilter(v); setPage(0); }} onToggleProject={toggleProject} realtimeActive={realtimeActive} projectCounts={projectCounts} topTags={topTags} onCreateRuleForTag={(t) => setQuickRuleTag(t)} tagFilter={tagFilter} onTagFilter={(t) => { setTagFilter(t); setPage(0); }} />
        </div>
      )}
      <QuickTagRuleDialog open={!!quickRuleTag} onOpenChange={(v) => !v && setQuickRuleTag(null)} tag={quickRuleTag || ""} projects={projects} />


      <div className="flex-1 space-y-4 min-w-0">
        <Tabs value={mainTab} onValueChange={setMainTab}>
          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
            <button
              onClick={toggleSidebar}
              title={sidebarCollapsed ? "Mostrar sidebar (S)" : "Esconder sidebar (S)"}
              className="hidden md:inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground transition"
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
            <div className="w-full md:w-auto overflow-x-auto"><TabsList className="w-max">
              <TabsTrigger value="quentes" className="text-[10px] uppercase tracking-wider relative gap-1.5">
                <Flame className="h-3 w-3" /> Quentes
                {pixHoje.length > 0 && <span className="ml-1 bg-orange-500 text-white text-[9px] font-bold rounded-full px-1.5 animate-pulse">{pixHoje.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="leads" className="text-[10px] uppercase tracking-wider gap-1.5"><ListChecks className="h-3 w-3" /> Leads</TabsTrigger>
              <TabsTrigger value="analytics" className="text-[10px] uppercase tracking-wider gap-1.5"><BarChart3 className="h-3 w-3" /> Analytics</TabsTrigger>
              <TabsTrigger value="formularios" className="text-[10px] uppercase tracking-wider gap-1.5"><FileText className="h-3 w-3" /> Formulários</TabsTrigger>
              <TabsTrigger value="predicoes" className="text-[10px] uppercase tracking-wider gap-1.5"><Brain className="h-3 w-3" /> Predições</TabsTrigger>
              <TabsTrigger value="custo" className="text-[10px] uppercase tracking-wider gap-1.5"><DollarSign className="h-3 w-3" /> Custo</TabsTrigger>
              {pixHoje.length > 0 && (<TabsTrigger value="pix_hoje" className="text-[10px] uppercase tracking-wider gap-1.5"><DollarSign className="h-3 w-3" /> Pix Hoje<span className="ml-1 bg-orange-500 text-white text-[9px] font-bold rounded-full px-1.5">{pixHoje.length}</span></TabsTrigger>)}
            </TabsList></div>
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              {periodKPIs.totalAds > 0 && periodKPIs.newLeads > 0 && (
                <div className="hidden md:flex items-center gap-2 text-[11px] px-2.5 py-1 rounded-md bg-secondary/60 border border-border" title="CPL = gasto em ads ÷ leads no período">
                  <span className="text-muted-foreground">CPL</span>
                  <span className="font-bold text-primary tabular-nums">R$ {(periodKPIs.totalAds / periodKPIs.newLeads).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span className="text-muted-foreground">· {periodKPIs.newLeads} leads · R$ {Math.round(periodKPIs.totalAds).toLocaleString("pt-BR")}</span>
                </div>
              )}
              <Button size="sm" variant="outline" onClick={() => {
                const headers = ["Nome","Email","Telefone","Status","Estágio","Plataforma","Projeto","Produto","Score","Receita","Criado em"];
                const rows = filtered.map(l => { const vendas = l._vendas || []; const produto = vendas.map(v => v.produto_nome).filter(Boolean).join(", ") || (l.data as any)?.ultimo_produto || ""; return [l.nome || "", l.email || "", l.phone || "", l.status || "", getLeadStage(l), l.plataforma || "", projects.find(p => p.id === l.project_id)?.name || "", produto, String(l._score || 0), String(l.total_gasto || 0), getLeadActivityDate(l)?.split("T")[0] || ""]; });
                const csv = [headers, ...rows].map(r => r.map(c => `"${(c||"").replace(/"/g,'""')}"`).join(",")).join("\n");
                const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `leads_${format(periodRange.from, "yyyy-MM-dd")}.csv`; a.click(); URL.revokeObjectURL(url);
                toast.success(`${filtered.length} leads exportados`);
              }}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
              <Button size="sm" variant="outline" onClick={() => setShowImport(true)}><FileUp className="h-4 w-4 mr-1" /> Importar</Button>
              <Button size="sm" variant="outline" onClick={async () => {
                const toAnalyze = filtered.filter(l => l.project_id);
                if (toAnalyze.length === 0) { toast.error("Nenhum lead com projeto para analisar"); return; }
                if (toAnalyze.length > 50) { toast.error("Selecione no máximo 50 leads (use filtros)"); return; }
                toast.info(`Analisando ${toAnalyze.length} leads com IA...`);
                let success = 0;
                for (const lead of toAnalyze) {
                  try {
                    const { data: responses } = await supabase.from("imphq_lead_responses").select("question, answer").eq("lead_id", lead.id);
                    const { data: scores } = await supabase.from("imphq_lead_scores_log").select("acao, pontos").eq("lead_id", lead.id);
                    const { data, error } = await supabase.functions.invoke("openflow-ai", { body: { project_id: lead.project_id, action: "analyze_lead", lead: { nome: lead.nome, email: lead.email, phone: lead.phone, plataforma: lead.plataforma, score: lead._score ?? 0, total_gasto: lead.total_gasto, tags: lead.tags, data: lead.data }, form_responses: (responses || []).map((r: any) => ({ question: r.question, answer: r.answer })), score_log: (scores || []).map((s: any) => ({ acao: s.acao, pontos: s.pontos })) } });
                    if (!error && data?.qualificacao) { const newData = { ...(lead.data || {}), qualificacao: { ...(lead.data?.qualificacao || {}), ...data.qualificacao } }; await supabase.from("imphq_leads").update({ data: newData }).eq("id", lead.id); success++; }
                  } catch { /* skip */ }
                }
                toast.success(`${success}/${toAnalyze.length} leads analisados`); load();
              }} className="gap-1"><Zap className="h-4 w-4" /> Analisar com IA</Button>
              <Button size="sm" onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" /> Novo Lead</Button>
            </div>
          </div>

          {/* TAB: LEADS */}
          <TabsContent value="leads" className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative max-w-xs flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(e) => handleSearchChange(e.target.value)} placeholder="Buscar nome, email..." className="pl-9 bg-secondary h-9" /></div>
              <Select value={platformFilter} onValueChange={(v) => { setPlatformFilter(v); setPage(0); }}><SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Plataforma" /></SelectTrigger><SelectContent><SelectItem value="all">Plataforma</SelectItem>{PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}><SelectTrigger className="w-[120px] h-9"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">Status</SelectItem>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent></Select>
              <Select value={sortBy} onValueChange={(v) => { setSortBy(v as "recent" | "updated" | "score"); setPage(0); }}><SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Ordenar" /></SelectTrigger><SelectContent><SelectItem value="recent">Mais recentes (data)</SelectItem><SelectItem value="updated">Atualizados há pouco</SelectItem><SelectItem value="score">Score (ML)</SelectItem></SelectContent></Select>
              <Select value={stageFilter} onValueChange={setStageFilter}><SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Estágio" /></SelectTrigger><SelectContent><SelectItem value="all">Estágio</SelectItem>{STAGES.map(s => <SelectItem key={s} value={s}>{STAGE_LABELS[s].label}</SelectItem>)}</SelectContent></Select>
              {products.length > 0 && (<Select value={productFilter} onValueChange={(v) => { setProductFilter(v); setPage(0); }}><SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Produto" /></SelectTrigger><SelectContent className="max-h-[300px]"><SelectItem value="all">Produto (todos)</SelectItem>{products.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>)}
              {captureForms.length > 0 && (<Select value={formFilter} onValueChange={setFormFilter}><SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Formulário" /></SelectTrigger><SelectContent><SelectItem value="all">Formulário</SelectItem>{captureForms.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent></Select>)}
              {topTags.length > 0 && (<Select value={tagFilter} onValueChange={(v) => { setTagFilter(v); setPage(0); }}><SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Tag" /></SelectTrigger><SelectContent className="max-h-[300px]"><SelectItem value="all">Tag (todas)</SelectItem>{topTags.map(({ tag, count }) => <SelectItem key={tag} value={tag}>{tag} <span className="text-muted-foreground ml-1">({count})</span></SelectItem>)}</SelectContent></Select>)}
              {tagFilter !== "all" && (<button onClick={() => setTagFilter("all")} className="h-9 px-2.5 rounded-md bg-gold/10 border border-gold/40 text-gold text-xs flex items-center gap-1.5 hover:bg-gold/20" title="Limpar filtro de tag"><Tag className="h-3 w-3" /> {tagFilter} <span className="text-base leading-none">×</span></button>)}
              <Button
                size="sm"
                variant={hotOnly ? "default" : "outline"}
                onClick={() => setHotOnly(v => !v)}
                className={cn("h-9 gap-1", hotOnly && "bg-orange-500 hover:bg-orange-600 text-white")}
                title="Apenas leads com Pix/Carrinho/Boleto nas últimas 2h"
              >
                <Flame className="h-4 w-4" /> Hot {hotOnly ? "ON" : ""}
              </Button>
              {someSelected && (
                <>
                  <Select onValueChange={(v) => moveSelectedToProject(v === "__none__" ? null : v)}>
                    <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder={`Mover ${selectedIds.size} para...`} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">📂 Sem projeto</SelectItem>
                      {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.icon || "📁"} {p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1">
                    <Input
                      value={bulkTagInput}
                      onChange={e => setBulkTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && bulkTagInput.trim()) addTagToSelected(bulkTagInput); }}
                      placeholder="🏷️ Tag em massa"
                      className="h-9 w-[150px] text-xs bg-secondary"
                    />
                    <Button size="sm" variant="outline" disabled={!bulkTagInput.trim()} onClick={() => addTagToSelected(bulkTagInput)}>
                      Aplicar
                    </Button>
                  </div>
                  <Select onValueChange={changeStatusForSelected}>
                    <SelectTrigger className="w-[170px] h-9"><SelectValue placeholder={`Status p/ ${selectedIds.size}...`} /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="destructive" onClick={() => setBulkDeleteConfirm(true)}><Trash2 className="h-3 w-3 mr-1" />{selectedIds.size} selecionados</Button>

                </>
              )}


            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="bg-card border-border"><CardContent className="p-3"><p className="text-lg font-bold">{totalCount}</p><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Leads Total</p></CardContent></Card>
              <Card className="bg-card border-border"><CardContent className="p-3"><p className="text-lg font-bold text-emerald-400">{leads.filter(l => l.status === "cliente").length}</p><p className="text-[10px] text-muted-foreground flex items-center gap-1"><UserCheck className="h-3 w-3" /> Clientes</p></CardContent></Card>
              <Card className="bg-card border-border"><CardContent className="p-3"><p className="text-lg font-bold text-amber-400">{leads.filter(l => l.status === "vip").length}</p><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Crown className="h-3 w-3" /> VIPs</p></CardContent></Card>
              <Card className="bg-card border-border"><CardContent className="p-3"><p className="text-lg font-bold font-mono text-primary">R$ {leads.reduce((s, l) => s + (parseFloat(String(l.total_gasto)) || 0), 0).toFixed(0)}</p><p className="text-[10px] text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> Receita</p></CardContent></Card>
            </div>

            <LeadsTable leads={filtered} projects={projects} captureForms={captureForms} selectedIds={selectedIds} onToggleSelect={toggleSelect} onToggleSelectAll={toggleSelectAll} allFilteredSelected={allFilteredSelected} onEditLead={setEditLead} page={page} totalPages={totalPages} totalCount={totalCount} pageSize={PAGE_SIZE} loading={loading} onPageChange={setPage} automations={automations} />
          </TabsContent>

          {/* TAB: ANALYTICS */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="flex items-center gap-2 flex-wrap">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              {PERIOD_OPTIONS.map(opt => (<Button key={opt.key} size="sm" variant={analyticsPeriod === opt.key ? "default" : "outline"} className="text-xs h-7" onClick={() => setAnalyticsPeriod(opt.key)}>{opt.label}</Button>))}
              {analyticsPeriod === "custom" && (<div className="flex items-center gap-2"><Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className="text-xs h-7">{customFrom ? format(customFrom, "dd/MM/yy") : "De"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} className="p-3 pointer-events-auto" /></PopoverContent></Popover><span className="text-xs text-muted-foreground">→</span><Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className="text-xs h-7">{customTo ? format(customTo, "dd/MM/yy") : "Até"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={customTo} onSelect={setCustomTo} className="p-3 pointer-events-auto" /></PopoverContent></Popover></div>)}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              <Card className="bg-card border-border"><CardContent className="p-3"><p className="text-lg font-bold">{periodKPIs.newLeads}</p><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Novos Leads</p></CardContent></Card>
              <Card className="bg-card border-border"><CardContent className="p-3"><p className="text-lg font-bold text-emerald-400">{periodKPIs.conversions}</p><p className="text-[10px] text-muted-foreground flex items-center gap-1"><UserCheck className="h-3 w-3" /> Conversões</p></CardContent></Card>
              <Card className="bg-card border-border"><CardContent className="p-3"><p className="text-lg font-bold text-primary">{periodKPIs.convRate.toFixed(1)}%</p><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Target className="h-3 w-3" /> Taxa Conv.</p></CardContent></Card>
              <Card className="bg-card border-border"><CardContent className="p-3"><p className="text-lg font-bold font-mono text-primary">R$ {periodKPIs.revenue.toFixed(0)}</p><p className="text-[10px] text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> Receita</p></CardContent></Card>
              <Card className="bg-card border-border"><CardContent className="p-3"><p className="text-lg font-bold font-mono">R$ {periodKPIs.avgTicket.toFixed(0)}</p><p className="text-[10px] text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Ticket Médio</p></CardContent></Card>
              <Card className="bg-card border-border"><CardContent className="p-3"><p className="text-lg font-bold">{periodKPIs.avgConvTime !== null ? formatConversionTime(periodKPIs.avgConvTime) : "—"}</p><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Tempo Conv.</p></CardContent></Card>
              <Card className="bg-card border-border"><CardContent className="p-3"><p className="text-lg font-bold font-mono text-destructive">R$ {periodKPIs.totalAds.toFixed(0)}</p><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Megaphone className="h-3 w-3" /> Investido Ads</p></CardContent></Card>
              <Card className="bg-card border-border"><CardContent className="p-3"><p className="text-lg font-bold font-mono">{periodKPIs.roas !== null ? `${periodKPIs.roas.toFixed(1)}x` : "—"}</p><p className="text-[10px] text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> ROAS</p></CardContent></Card>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-card border-border md:col-span-2"><CardHeader className="pb-2"><CardTitle className="text-sm">📈 Leads vs Ads vs Receita (diário)</CardTitle></CardHeader><CardContent>{leadsVsAds.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Sem dados no período</p> : (<ChartContainer config={chartConfig} className="h-[280px] w-full"><AreaChart data={leadsVsAds} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" className="stroke-border/30" /><XAxis dataKey="day" className="text-[10px]" /><YAxis className="text-[10px]" /><ChartTooltip content={<ChartTooltipContent />} /><Area type="monotone" dataKey="revenue" fill="#10b981" fillOpacity={0.15} stroke="#10b981" strokeWidth={2} name="Receita R$" /><Area type="monotone" dataKey="ads" fill="#ef4444" fillOpacity={0.1} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 4" name="Ads R$" /><Line type="monotone" dataKey="leads" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2 }} name="Leads" /></AreaChart></ChartContainer>)}</CardContent></Card>
              <Card className="bg-card border-border"><CardHeader className="pb-2"><CardTitle className="text-sm">📦 Leads por Produto</CardTitle></CardHeader><CardContent>{leadsByProduct.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p> : (<ChartContainer config={chartConfig} className="h-[250px] w-full"><BarChart data={leadsByProduct} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" className="stroke-border/30" /><XAxis type="number" className="text-[10px]" /><YAxis dataKey="name" type="category" width={120} className="text-[10px]" tick={{ fontSize: 9 }} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} /></BarChart></ChartContainer>)}</CardContent></Card>
              <Card className="bg-card border-border"><CardHeader className="pb-2"><CardTitle className="text-sm">💰 Receita por Produto</CardTitle></CardHeader><CardContent>{revenueByProduct.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Sem receita</p> : (<ChartContainer config={chartConfig} className="h-[250px] w-full"><BarChart data={revenueByProduct} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" className="stroke-border/30" /><XAxis type="number" className="text-[10px]" tickFormatter={(v) => `R$${v}`} /><YAxis dataKey="name" type="category" width={120} className="text-[10px]" tick={{ fontSize: 9 }} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="revenue" fill="#10b981" radius={[0, 4, 4, 0]} /></BarChart></ChartContainer>)}</CardContent></Card>
              <Card className="bg-card border-border"><CardHeader className="pb-2"><CardTitle className="text-sm">⏱️ Tempo de Conversão</CardTitle></CardHeader><CardContent>{conversionTimeDist.every(d => d.count === 0) ? <p className="text-sm text-muted-foreground text-center py-8">Sem conversões no período</p> : (<ChartContainer config={chartConfig} className="h-[250px] w-full"><BarChart data={conversionTimeDist} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" className="stroke-border/30" /><XAxis dataKey="name" className="text-[10px]" /><YAxis className="text-[10px]" /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} /></BarChart></ChartContainer>)}</CardContent></Card>
              <Card className="bg-card border-border"><CardHeader className="pb-2"><CardTitle className="text-sm">🔻 Funil de Conversão</CardTitle></CardHeader><CardContent><ChartContainer config={chartConfig} className="h-[250px] w-full"><BarChart data={funnelData} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" className="stroke-border/30" /><XAxis dataKey="stage" className="text-[10px]" /><YAxis className="text-[10px]" /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="value" radius={[4, 4, 0, 0]}>{funnelData.map((entry, i) => <Cell key={i} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />)}</Bar></BarChart></ChartContainer></CardContent></Card>
              <Card className="bg-card border-border md:col-span-2"><CardHeader className="pb-2"><CardTitle className="text-sm">📈 Leads por Mês (histórico)</CardTitle></CardHeader><CardContent>{leadsByMonth.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p> : (<ChartContainer config={chartConfig} className="h-[220px] w-full"><LineChart data={leadsByMonth} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" className="stroke-border/30" /><XAxis dataKey="month" className="text-[10px]" /><YAxis className="text-[10px]" /><ChartTooltip content={<ChartTooltipContent />} /><Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: "hsl(var(--primary))" }} /></LineChart></ChartContainer>)}</CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="formularios" className="space-y-6">
            <MembrosWebhookGuide projectId={projectFilter !== "all" ? projectFilter : undefined} />
            <FormBuilder projects={projects} />
            <div className="pt-4 border-t border-border">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">💡 Insights de formulários</h3>
              <FormInsights projects={projects} />
            </div>
          </TabsContent>
          <TabsContent value="predicoes" className="space-y-4"><LeadPredictivePanel leadIds={filtered.map(l => l.id)} projectFilter={projectFilter} /></TabsContent>
          <TabsContent value="custo" className="space-y-4"><LeadCostPanel periodLeads={periodLeads} periodAds={periodAds} periodRange={periodRange} /></TabsContent>

          {/* TAB: LEADS QUENTES */}
          <TabsContent value="quentes" className="space-y-4">
            <HotLeadsInbox
              leads={leads}
              projects={projects}
              onOpenLead={(id) => { const l = leads.find(x => x.id === id); if (l) setEditLead({ ...l }); }}
            />
          </TabsContent>

          {/* TAB: PIX HOJE */}
          <TabsContent value="pix_hoje" className="space-y-4">
            <div className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-orange-400 animate-pulse" /><h3 className="font-bold text-sm">Leads com Pix pendente hoje — {pixHoje.length} lead{pixHoje.length !== 1 ? "s" : ""}</h3></div>
            {pixHoje.length === 0 ? (<Card className="bg-card border-border"><CardContent className="p-8 text-center"><p className="text-sm text-muted-foreground">🎉 Nenhum pix pendente hoje!</p></CardContent></Card>) : (
                <div className="space-y-3">{pixHoje.map(l => { const vendas = l._vendas || []; const produto = vendas[0]?.produto_nome || (l.data as any)?.ultimo_produto || "—"; const valor = vendas.reduce((s, v) => s + v.valor, 0) || Number((l.data as any)?.ultimo_valor || 0); return (
                <Card key={l.id} className="bg-card border-border hover:ring-1 hover:ring-orange-500/30 transition-all"><CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0"><Avatar className="h-10 w-10 bg-secondary shrink-0"><AvatarFallback className="font-bold bg-secondary text-foreground">{(l.nome || "?")[0].toUpperCase()}</AvatarFallback></Avatar><div className="min-w-0"><p className="font-medium text-sm truncate">{l.nome}</p><p className="text-[10px] text-muted-foreground truncate">{l.email || "—"} • {l.phone || "sem tel."}</p><div className="flex items-center gap-2 mt-0.5"><Badge variant="outline" className="text-[9px]">{produto}</Badge>{valor > 0 && <span className="text-xs font-mono text-primary">R$ {valor.toFixed(2)}</span>}</div></div></div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => sendQuickEmail(l)} disabled={!l.email || !l.project_id}><Mail className="h-3 w-3 mr-1" /> Email</Button>
                    <Button size="sm" variant="outline" onClick={() => sendQuickWhatsApp(l)} disabled={!l.phone}><MessageCircle className="h-3 w-3 mr-1" /> WhatsApp</Button>
                    {automations.length > 0 && (<Select onValueChange={(autoId) => { const auto = automations.find(a => a.id === autoId); if (auto) triggerAutomation(l, auto); }}><SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="⚡ Automação" /></SelectTrigger><SelectContent>{automations.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}</SelectContent></Select>)}
                    <Button size="sm" variant="ghost" onClick={() => setEditLead({ ...l })}><Eye className="h-3 w-3" /></Button>
                  </div>
                </CardContent></Card>); })}</div>
            )}
          </TabsContent>
        </Tabs>

        {/* New Lead Dialog */}
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Lead</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3"><div><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div><div><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div></div>
              <div className="grid grid-cols-2 gap-3"><div><Label>Plataforma</Label><Select value={form.plataforma} onValueChange={v => setForm({ ...form, plataforma: v })}><SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger><SelectContent>{PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div><div><Label>Status</Label><Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent></Select></div></div>
              <div><Label>Tags</Label><EditableTagList tags={form.tags} onChange={tags => setForm({ ...form, tags })} /></div>
            </div>
            <DialogFooter><Button onClick={createLead}>Criar</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Lead Dialog - kept inline as it's deeply coupled with state */}
        <Dialog open={!!editLead} onOpenChange={() => setEditLead(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-slate-950 border-slate-800 text-slate-100 shadow-2xl backdrop-blur-xl">
            <DialogHeader>
              <div className="flex items-center justify-between gap-2">
                <DialogTitle className="text-slate-100 font-bold tracking-tight text-xl">Ficha Detalhada do Lead</DialogTitle>
                {editLead && (
                  <Button size="sm" variant="outline" className="h-8 gap-1.5 border-pink-700/50 text-pink-300 hover:bg-pink-900/30" onClick={() => setJourneyLead(editLead)}>
                    <Activity className="h-3.5 w-3.5" /> Replay Jornada
                  </Button>
                )}
              </div>
            </DialogHeader>
            {editLead && (
              <div className="space-y-4">
                {/* 1. Header Card - Glassmorphism, Redundancy Fix & Stats */}
                <div className="relative p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md overflow-hidden">
                  {/* Subtle golden background glow */}
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
                  
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Left: Avatar & Info */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <Avatar className="h-12 w-12 border-2 border-slate-700 bg-slate-800 ring-2 ring-primary/20 ring-offset-2 ring-offset-slate-950 shrink-0 shadow-lg">
                        <AvatarFallback className="font-bold text-sm bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950">
                          {(() => {
                            const isEmail = editLead.nome?.includes("@");
                            const rawName = editLead.nome || "?";
                            return isEmail 
                              ? rawName.split("@")[0].substring(0, 2).toUpperCase()
                              : rawName.split(" ").map(n => n[0]).filter(Boolean).join("").substring(0, 2).toUpperCase() || "?";
                          })()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 space-y-0.5">
                        <h3 className="font-bold text-lg text-slate-100 tracking-tight leading-none truncate">
                          {(() => {
                            const isEmail = editLead.nome?.includes("@");
                            const rawName = editLead.nome || "";
                            if (isEmail && editLead.nome === editLead.email) {
                              return rawName.split("@")[0]
                                .replace(/[\._\-+]/g, " ")
                                .split(" ")
                                .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                                .join(" ");
                            }
                            return rawName;
                          })()}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="truncate">{editLead.email || "Sem email"}</span>
                          {editLead.phone && (
                            <>
                              <span className="text-slate-600">•</span>
                              <span className="font-mono text-[11px] text-slate-400">{editLead.phone}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Key Stats / Quick Badges */}
                    <div className="flex flex-wrap items-center gap-2 md:self-center shrink-0">
                      {/* Status Badge */}
                      <Badge className={cn("px-2.5 py-0.5 rounded-full font-medium text-[10px] uppercase tracking-wider border shrink-0", 
                        editLead.status === "cliente" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                        editLead.status === "vip" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                        editLead.status === "inativo" ? "bg-slate-800 text-slate-400 border-slate-700" :
                        "bg-blue-500/10 text-blue-400 border-blue-500/20"
                      )}>
                        {editLead.status || "lead"}
                      </Badge>

                      {/* Lead Score Badge */}
                      <Badge variant="outline" className="px-2.5 py-0.5 rounded-full border-amber-500/30 text-amber-400 bg-amber-500/5 font-mono text-[10px] shrink-0 gap-1 flex items-center">
                        <Crown className="h-3 w-3 text-amber-400 shrink-0" />
                        <span>Score: {editLead.score ?? editLead._score ?? 0}</span>
                      </Badge>

                      {/* Total Spent (Total Gasto) */}
                      {(() => {
                        const totalSpent = editLead._vendas?.reduce((sum, v) => sum + (v.valor || 0), 0) || Number(editLead.total_gasto || 0);
                        if (totalSpent > 0) {
                          return (
                            <Badge variant="outline" className="px-2.5 py-0.5 rounded-full border-emerald-500/30 text-emerald-400 bg-emerald-500/5 font-mono text-[10px] shrink-0 gap-0.5 flex items-center">
                              <DollarSign className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                              <span>R$ {totalSpent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                            </Badge>
                          );
                        }
                        return null;
                      })()}

                      {/* Eugene Schwartz Primary Desire Badge */}
                      {(() => {
                        const schwartzDesire = editLead.data?.desejo_schwartz || (() => {
                          const desireTag = editLead.tags?.find(t => t.startsWith("Desejo: "));
                          if (desireTag) {
                            const type = desireTag.split(": ")[1]?.toLowerCase();
                            if (type === "tempo" || type === "dinheiro" || type === "estresse" || type === "status") return type;
                          }
                          return null;
                        })();

                        if (!schwartzDesire) return null;

                        const desireMeta: Record<string, { label: string; icon: string; color: string }> = {
                          tempo: { label: "Liberdade de Tempo", icon: "⏳", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" },
                          dinheiro: { label: "Alavancagem Financeira", icon: "💰", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
                          estresse: { label: "Alívio de Estresse / Paz", icon: "🧘", color: "bg-violet-500/10 text-violet-400 border-violet-500/30" },
                          status: { label: "Prestígio & Autoridade", icon: "👑", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" }
                        };
                        const meta = desireMeta[schwartzDesire];
                        if (!meta) return null;

                        return (
                          <Badge variant="outline" className={cn("px-2.5 py-0.5 rounded-full font-mono text-[10px] shrink-0 gap-1 flex items-center shadow-lg shadow-black/20", meta.color)}>
                            <span>{meta.icon}</span>
                            <span>Desejo: {meta.label}</span>
                          </Badge>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Funnel conversion alert inside header */}
                  {(() => {
                    const hours = getConversionHours(editLead);
                    if (hours !== null && hours >= 0) {
                      return (
                        <div className="mt-3 flex items-center gap-2 px-2.5 py-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-[11px] text-emerald-400 font-medium">
                          <Clock className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                          <span>Tempo até compra: {formatConversionTime(hours)}</span>
                        </div>
                      );
                    }
                    if (editLead.criado_em && (!editLead._vendas || editLead._vendas.length === 0)) {
                      try {
                        const d = parseISO(editLead.criado_em);
                        if (isValid(d)) {
                          const daysSince = differenceInDays(new Date(), d);
                          return (
                            <div className="mt-3 flex items-center gap-2 px-2.5 py-1.5 bg-amber-500/5 rounded-lg border border-amber-500/10 text-[11px] text-amber-400">
                              <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                              <span>Aguardando conversão — {daysSince} dias desde a primeira captura</span>
                            </div>
                          );
                        }
                      } catch {}
                    }
                    return null;
                  })()}

                  {/* Recovery dispatch badge */}
                  {recoveryLogs && recoveryLogs.length > 0 && (() => {
                    const last = recoveryLogs[0];
                    const statusColor =
                      last.status === "sent" || last.status === "success" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
                      last.status === "failed" || last.status === "error" ? "bg-red-500/10 text-red-400 border-red-500/30" :
                      "bg-amber-500/10 text-amber-400 border-amber-500/30";
                    let when = "";
                    try { const d = parseISO(last.created_at); if (isValid(d)) when = `há ${Math.max(1, differenceInDays(new Date(), d))}d`; } catch {}
                    return (
                      <div className={cn("mt-2 flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium", statusColor)}>
                        <Zap className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">
                          🔄 Recuperação <strong className="font-semibold">{last.bucket}</strong> · {last.canal || "?"} · {last.status}
                          {when && <span className="opacity-70"> · {when}</span>}
                          {recoveryLogs.length > 1 && <span className="opacity-70"> · +{recoveryLogs.length - 1}</span>}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                {/* 2. Main Dialog Tabs */}
                <Tabs defaultValue="dados" className="space-y-3">
                  <TabsList className="w-full grid grid-cols-6 h-9 bg-slate-900 border border-slate-800 p-0.5 rounded-lg">
                    <TabsTrigger value="dados" className="text-[11px] data-[state=active]:bg-slate-800 data-[state=active]:text-amber-400">Dados</TabsTrigger>
                    <TabsTrigger value="qualificacao" className="text-[11px] data-[state=active]:bg-slate-800 data-[state=active]:text-amber-400">Qualificar</TabsTrigger>
                    <TabsTrigger value="jornada" className="text-[11px] data-[state=active]:bg-slate-800 data-[state=active]:text-amber-400">Jornada ({timeline.length})</TabsTrigger>
                    <TabsTrigger value="predicoes" className="text-[11px] data-[state=active]:bg-slate-800 data-[state=active]:text-amber-400">Predições</TabsTrigger>
                    <TabsTrigger value="automacoes" className="text-[11px] data-[state=active]:bg-slate-800 data-[state=active]:text-amber-400">Fluxos</TabsTrigger>
                    <TabsTrigger value="nutricao" className="text-[11px] data-[state=active]:bg-slate-800 data-[state=active]:text-amber-400">Nutrição</TabsTrigger>
                  </TabsList>

                  {/* 3. DADOS TAB CONTENT */}
                  <TabsContent value="dados" className="space-y-4 focus:outline-none">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Name Card */}
                      <div className="md:col-span-2 space-y-1">
                        <Label className="text-xs font-semibold text-slate-300">Nome do Lead</Label>
                        <Input 
                          value={editLead.nome || ""} 
                          onChange={e => setEditLead({ ...editLead, nome: e.target.value })} 
                          className="bg-slate-900 border-slate-800 focus:border-amber-500/50 focus:ring-amber-500/20 text-slate-100"
                        />
                      </div>

                      {/* Email & Phone */}
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-slate-300">E-mail</Label>
                        <Input 
                          value={editLead.email || ""} 
                          onChange={e => setEditLead({ ...editLead, email: e.target.value })} 
                          className="bg-slate-900 border-slate-800 focus:border-amber-500/50 focus:ring-amber-500/20 text-slate-100"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-slate-300">Telefone</Label>
                        <Input 
                          value={editLead.phone || ""} 
                          onChange={e => setEditLead({ ...editLead, phone: e.target.value })} 
                          className="bg-slate-900 border-slate-800 focus:border-amber-500/50 focus:ring-amber-500/20 text-slate-100"
                        />
                      </div>

                      {/* Plataforma Select with Fallback Support */}
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-slate-300">Plataforma</Label>
                        <Select 
                          value={editLead.plataforma || ""} 
                          onValueChange={v => setEditLead({ ...editLead, plataforma: v })}
                        >
                          <SelectTrigger className="bg-slate-900 border-slate-800 focus:border-amber-500/50 text-slate-100">
                            <SelectValue placeholder="Selecionar..." />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                            {(() => {
                              const dynamicPlatforms = editLead.plataforma && !PLATFORMS.includes(editLead.plataforma)
                                ? [...PLATFORMS, editLead.plataforma]
                                : PLATFORMS;
                              return dynamicPlatforms.map(p => (
                                <SelectItem key={p} value={p}>
                                  {p}
                                </SelectItem>
                              ));
                            })()}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Status Select */}
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-slate-300">Status do Lead</Label>
                        <Select 
                          value={editLead.status || "lead"} 
                          onValueChange={v => setEditLead({ ...editLead, status: v })}
                        >
                          <SelectTrigger className="bg-slate-900 border-slate-800 focus:border-amber-500/50 text-slate-100">
                            <SelectValue placeholder="Selecionar status" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                            {STATUSES.map(s => (
                              <SelectItem key={s} value={s} className="capitalize">
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-300">Tags do Lead</Label>
                      <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/40">
                        <EditableTagList tags={editLead.tags || []} onChange={tags => setEditLead({ ...editLead, tags })} />
                      </div>
                    </div>

                    {/* Internal Notes */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-300">📝 Anotações Internas</Label>
                      <Textarea 
                        value={editLead.data?.notas || ""} 
                        onChange={e => setEditLead({ ...editLead, data: { ...editLead.data, notas: e.target.value } })} 
                        placeholder="Anotações internas sobre este lead..." 
                        className="bg-slate-900 border-slate-800 text-slate-100 min-h-[70px] focus:border-amber-500/50 focus:ring-amber-500/20" 
                      />
                    </div>

                    {/* Origem Detail Panel (Glassmorphic) */}
                    <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/30 space-y-2">
                      <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1">
                        <Target className="h-3 w-3" /> Origem da Conversão
                      </p>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-400 text-[10px]">Projeto Principal</span>
                          <span className="font-medium text-slate-200">
                            {(() => {
                              const proj = projects.find(p => p.id === editLead.project_id);
                              return proj ? `${proj.icon || "📁"} ${proj.name}` : "—";
                            })()}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-400 text-[10px]">Formulário Captura</span>
                          <span className="font-medium text-slate-200">
                            {(() => {
                              const firstForm = formResponses.find(r => r.form_name);
                              return firstForm?.form_name || "—";
                            })()}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-400 text-[10px]">Plataforma Referência</span>
                          <span className="font-medium text-slate-200">
                            {editLead.plataforma || editLead.data?.captura_origem || "—"}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-400 text-[10px]">Data de Captura</span>
                          <span className="font-medium text-slate-200 font-mono">
                            {editLead.criado_em ? (() => {
                              try {
                                const d = parseISO(editLead.criado_em!);
                                return isValid(d) ? format(d, "dd/MM/yyyy HH:mm") : "—";
                              } catch { return "—"; }
                            })() : "—"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Purchases & Checkout Tracking Panel */}
                    {editLead._vendas && editLead._vendas.length > 0 && (
                      <div className="space-y-2.5">
                        <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                          <DollarSign className="h-3.5 w-3.5" /> Histórico de Transações ({editLead._vendas.length})
                        </p>
                        <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                          {editLead._vendas.map((v, i) => {
                            const ownUtms = (v.data?.utms || v.data?.tracking || v.data?.checkout || {}) as any;
                            const flat: any = v.data || {};
                            const utm_campaign = ownUtms.utm_campaign || flat.utm_campaign || (editLead.data as any)?.utms?.utm_campaign || (editLead.data as any)?.utm_campaign;
                            const utm_content = ownUtms.utm_content || flat.utm_content || (editLead.data as any)?.utms?.utm_content || (editLead.data as any)?.utm_content;
                            const inheritedFromLead = !((ownUtms.utm_campaign || flat.utm_campaign) || (ownUtms.utm_content || flat.utm_content)) && !!(utm_campaign || utm_content);
                            
                            const renderUtm = (val?: string | null) => {
                              if (!val) return null;
                              const parts = String(val).includes("|") ? String(val).split("|").map(s => s.trim()).filter(Boolean) : [String(val)];
                              return (
                                <div className="flex flex-wrap gap-1">
                                  {parts.map((p, idx) => (
                                    <span key={idx} className="font-mono text-[9px] bg-slate-950 border border-slate-800/80 px-1.5 py-0.5 rounded text-slate-300 break-all">
                                      {p}
                                    </span>
                                  ))}
                                </div>
                              );
                            };

                            return (
                              <div key={v.id || i} className="p-3 rounded-lg border border-slate-800 bg-slate-900/20 hover:bg-slate-900/40 transition-colors space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-slate-100">{v.produto_nome || "Produto"}</span>
                                    {v.data?.metodo_pagamento && (
                                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-slate-900 border-slate-800 text-slate-300">
                                        💳 {v.data.metodo_pagamento}
                                      </Badge>
                                    )}
                                    {v.status && (
                                      <Badge className={cn("text-[9px] px-1.5 py-0 h-4 uppercase font-bold shrink-0", 
                                        ["aprovada", "Aprovada", "approved", "aprovado", "Aprovado"].includes(v.status) ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-slate-800 text-slate-400 border border-slate-700"
                                      )}>
                                        {v.status}
                                      </Badge>
                                    )}
                                  </div>
                                  <span className="text-xs font-bold font-mono text-emerald-400">R$ {v.valor.toFixed(2)}</span>
                                </div>

                                {/* UTM Attribution details */}
                                {(utm_campaign || utm_content) && (
                                  <div className="space-y-1.5 pt-1.5 border-t border-slate-800/40">
                                    <div className="flex items-center gap-1">
                                      <span className="text-[8px] font-bold text-amber-500 uppercase tracking-wider">Atribuição</span>
                                      {inheritedFromLead && <span className="text-[8px] bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded px-1">Herdada do Lead</span>}
                                    </div>
                                    <div className="grid grid-cols-1 gap-1 text-[10px]">
                                      {utm_campaign && (
                                        <div className="flex items-start gap-1.5">
                                          <span className="text-slate-400 font-medium min-w-[55px]">Campanha:</span>
                                          {renderUtm(utm_campaign)}
                                        </div>
                                      )}
                                      {utm_content && (
                                        <div className="flex items-start gap-1.5">
                                          <span className="text-slate-400 font-medium min-w-[55px]">Conteúdo:</span>
                                          {renderUtm(utm_content)}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <LeadUtmsPanel lead={editLead} />
                  </TabsContent>

                  <TabsContent value="qualificacao" className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    <div className="flex justify-end"><AIGenerateButton projectId={editLead.project_id || ""} action="analyze_lead" label="Analisar Lead com IA" size="sm" variant="outline" showMenteSelector contextSources={["Respostas do formulário", "Histórico de interações", "Score", "Dados do lead"]} fieldsToFill={["Dor Principal", "Nível de Consciência", "Objeções", "Notas"]} extraBody={{ lead: { nome: editLead.nome, email: editLead.email, phone: editLead.phone, plataforma: editLead.plataforma, score: editLead.score ?? editLead._score ?? 0, total_gasto: editLead.total_gasto, tags: editLead.tags, data: editLead.data }, form_responses: formResponses, score_log: scoreLog }} onResult={(data: any) => { if (data?.qualificacao) { setEditLead((prev: any) => ({ ...prev, data: { ...prev.data, qualificacao: { ...(prev.data?.qualificacao || {}), ...data.qualificacao } } })); toast.success("Análise IA preenchida nos campos de qualificação"); } }} /></div>
                    <div className="space-y-2"><p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">🎯 Score ({editLead.score ?? editLead._score ?? 0}/100)</p><Progress value={editLead.score ?? editLead._score ?? 0} className="h-2" />{scoreLog.length > 0 && (<div className="space-y-1">{scoreLog.map((s, i) => (<div key={i} className="flex items-center justify-between text-[11px]"><span className="text-muted-foreground">{s.acao}</span><div className="flex items-center gap-2"><Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 text-primary">+{s.pontos}</Badge><span className="text-[9px] text-muted-foreground">{(() => { try { const d = new Date(s.created_at); return isValid(d) ? format(d, "dd/MM HH:mm") : ""; } catch { return ""; } })()}</span></div></div>))}</div>)}</div>
                    <div className="space-y-3 border-t border-border pt-3"><p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">📋 Respostas de Formulários</p>{formResponses.length === 0 ? (<p className="text-[11px] text-muted-foreground italic">Nenhuma resposta de formulário registrada.</p>) : (() => { const humanize = (q: string) => { if (!q || !q.includes("_") || q.includes(" ")) return q; return q.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }; const grouped: Record<string, typeof formResponses> = {}; formResponses.forEach(r => { const key = r.form_id || "_sem_form"; if (!grouped[key]) grouped[key] = []; grouped[key].push(r); }); return Object.entries(grouped).map(([formId, responses]) => { const formName = responses[0]?.form_name || "Formulário"; return (<div key={formId} className="space-y-1.5"><div className="flex items-center gap-1.5"><Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/20">📋 {formName}</Badge></div>{responses.map((r, i) => (<div key={i} className="flex items-start gap-2 text-[11px] pl-2"><span className="font-medium text-muted-foreground min-w-[80px]">{humanize(r.question)}</span><span className="text-foreground">{r.answer}</span></div>))}</div>); }); })()}</div>
                    <div className="border-t border-border pt-3 space-y-3"><p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">✏️ Qualificação Manual</p><div><Label>Dor Principal</Label><Textarea value={editLead.data?.qualificacao?.dor_principal || ""} onChange={e => setEditLead({ ...editLead, data: { ...editLead.data, qualificacao: { ...(editLead.data?.qualificacao || {}), dor_principal: e.target.value } } })} placeholder="Qual a maior dor/frustração deste lead?" className="bg-secondary min-h-[60px]" /></div><div className="grid grid-cols-2 gap-3"><div><Label>Nível de Consciência</Label><Select value={editLead.data?.qualificacao?.nivel_consciencia || ""} onValueChange={v => setEditLead({ ...editLead, data: { ...editLead.data, qualificacao: { ...(editLead.data?.qualificacao || {}), nivel_consciencia: v } } })}><SelectTrigger className="bg-secondary"><SelectValue placeholder="Selecionar..." /></SelectTrigger><SelectContent><SelectItem value="inconsciente">Inconsciente</SelectItem><SelectItem value="problema">Consciente do Problema</SelectItem><SelectItem value="solucao">Consciente da Solução</SelectItem><SelectItem value="produto">Consciente do Produto</SelectItem><SelectItem value="totalmente">Totalmente Consciente</SelectItem></SelectContent></Select></div><div><Label>Renda Estimada</Label><Select value={editLead.data?.qualificacao?.renda || ""} onValueChange={v => setEditLead({ ...editLead, data: { ...editLead.data, qualificacao: { ...(editLead.data?.qualificacao || {}), renda: v } } })}><SelectTrigger className="bg-secondary"><SelectValue placeholder="Selecionar..." /></SelectTrigger><SelectContent><SelectItem value="ate3k">Até R$3k</SelectItem><SelectItem value="3k-8k">R$3k — R$8k</SelectItem><SelectItem value="8k-15k">R$8k — R$15k</SelectItem><SelectItem value="15k-30k">R$15k — R$30k</SelectItem><SelectItem value="30k+">R$30k+</SelectItem></SelectContent></Select></div></div><div><Label>Objeções</Label><EditableTagList tags={editLead.data?.qualificacao?.objecoes || []} onChange={tags => setEditLead({ ...editLead, data: { ...editLead.data, qualificacao: { ...(editLead.data?.qualificacao || {}), objecoes: tags } } })} /></div><div><Label>Notas do Vendedor</Label><Textarea value={editLead.data?.qualificacao?.notas_vendedor || ""} onChange={e => setEditLead({ ...editLead, data: { ...editLead.data, qualificacao: { ...(editLead.data?.qualificacao || {}), notas_vendedor: e.target.value } } })} placeholder="Observações internas sobre este lead..." className="bg-secondary min-h-[60px]" /></div>

                      {/* E3 Persuasion Copilot Card */}
                      {(() => {
                        const schwartzDesire = editLead.data?.desejo_schwartz || (() => {
                          const desireTag = editLead.tags?.find(t => t.startsWith("Desejo: "));
                          if (desireTag) {
                            const type = desireTag.split(": ")[1]?.toLowerCase();
                            if (type === "tempo" || type === "dinheiro" || type === "estresse" || type === "status") return type;
                          }
                          return null;
                        })();

                        if (!schwartzDesire) return null;

                        const copilotData: Record<string, { title: string; hook: string; objection: string; action: string; color: string }> = {
                          tempo: {
                            title: "Abordagem E3 (Foco em Liberdade de Tempo)",
                            hook: "Oi {{nome}}, como o JP sempre fala: automatizar te tira da operação para você escalar. Quantas horas do seu dia hoje você perde com processos manuais e repetitivos?",
                            objection: "Destaque que o ImperioHQ é o único que roda 24/7 de forma 100% autônoma, economizando mais de 20h semanais do time.",
                            action: "Focar no valor da automatização e liberdade de tempo.",
                            color: "border-cyan-500/30 bg-cyan-500/5 text-cyan-400"
                          },
                          dinheiro: {
                            title: "Abordagem E3 (Foco em Escala e ROI)",
                            hook: "Oi {{nome}}, a grande verdade é que lead sem resposta rápida é dinheiro queimado. Se você puder botar um atendente digital que responde e qualifica em 2 segundos sem cansar, quanto isso adiciona no seu ROI?",
                            objection: "Mostre o caso prático de recuperação automática de carrinho abandonado com IA que gera ROI de até 12x no primeiro mês.",
                            action: "Focar em recuperação de vendas, conversão acelerada e lucro.",
                            color: "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
                          },
                          estresse: {
                            title: "Abordagem E3 (Foco em Simplicidade e Paz)",
                            hook: "Oi {{nome}}, gerenciar suporte e equipe de vendas é uma dor de cabeça constante. Nosso sistema de IA faz a triagem limpa e entrega tudo mastigado. Que tal tirar o peso operacional das suas costas?",
                            objection: "Explique que a IA faz a classificação automática de sentimentos e objeções, acionando o suporte humano apenas nos casos cirúrgicos.",
                            action: "Focar em facilidade, redução de atrito e estabilidade operacional.",
                            color: "border-violet-500/30 bg-violet-500/5 text-violet-400"
                          },
                          status: {
                            title: "Abordagem E3 (Foco em Autoridade e Prestígio)",
                            hook: "Oi {{nome}}, os maiores players do mercado digital hoje usam IA para atendimento personalizado de ponta. Ficar no manual passa uma imagem amadora. Quer subir o nível de autoridade da sua marca?",
                            objection: "Demonstre como a IA usa avatares de voz clonados de alta definição para closer, gerando um atendimento VIP insuperável.",
                            action: "Focar em posicionamento premium, tecnologia de ponta e branding de autoridade.",
                            color: "border-amber-500/30 bg-amber-500/5 text-amber-400"
                          }
                        };

                        const currentCopilot = copilotData[schwartzDesire];
                        if (!currentCopilot) return null;

                        return (
                          <div className={cn("p-3.5 rounded-xl border space-y-2 mt-4 shadow-inner relative overflow-hidden", currentCopilot.color.split(" text-")[0])}>
                            <div className="absolute -top-12 -right-12 w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none" />
                            <div className="flex items-center justify-between">
                              <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                                <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
                                {currentCopilot.title}
                              </p>
                              <span className="text-[9px] bg-slate-900 border border-slate-800 rounded px-1.5 font-bold uppercase py-0.5">Copilot E3</span>
                            </div>
                            <div className="space-y-1.5 text-xs text-slate-300">
                              <div>
                                <span className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold block">Gancho de Abordagem Sugerido:</span>
                                <p className="bg-slate-950/60 p-2 rounded border border-slate-800 text-slate-200 leading-relaxed font-sans italic relative pr-8">
                                  "{currentCopilot.hook.replace("{{nome}}", editLead.nome || "amigo")}"
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 absolute right-1.5 top-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                                    onClick={() => {
                                      navigator.clipboard.writeText(currentCopilot.hook.replace("{{nome}}", editLead.nome || "amigo"));
                                      toast.success("Gancho copiado!");
                                    }}
                                    title="Copiar script"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </p>
                              </div>
                              <div>
                                <span className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold block">Foco de Persuasão:</span>
                                <p className="text-slate-300 leading-relaxed pl-2 border-l border-amber-500/50 text-[11px]">
                                  {currentCopilot.objection}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </TabsContent>

                  <TabsContent value="jornada">
                    {timelineLoading ? (<p className="text-sm text-muted-foreground text-center py-8">Carregando jornada...</p>) : timeline.length === 0 ? (<div className="text-center py-8 space-y-2"><Globe className="h-8 w-8 text-muted-foreground/30 mx-auto" /><p className="text-sm text-muted-foreground">Nenhum evento registrado</p></div>) : (
                      <>
                        <AttributionSummary timeline={timeline} hasSale={!!(editLead?._vendas && editLead._vendas.length > 0)} />
                        <div className="relative max-h-[400px] overflow-y-auto pr-2"><div className="absolute left-[15px] top-0 bottom-0 w-px bg-border" /><div className="space-y-3">{timeline.map((ev) => { const config = EVENT_CONFIG[ev.type] || { icon: <Zap className="h-3 w-3" />, color: "bg-muted-foreground", label: ev.type }; return (<div key={ev.id} className="flex gap-3 relative"><div className={`h-[30px] w-[30px] rounded-full ${config.color} flex items-center justify-center text-white shrink-0 z-10`}>{config.icon}</div><div className="flex-1 min-w-0 pb-1"><div className="flex items-center gap-2"><span className="text-xs font-medium">{config.label}</span><span className="text-[10px] text-muted-foreground">{(() => { try { const d = new Date(ev.timestamp); return isValid(d) ? format(d, "dd/MM HH:mm") : ""; } catch { return ""; } })()}</span></div>{ev.subtitle && <p className="text-[11px] text-muted-foreground truncate">{ev.subtitle}</p>}{ev.details && Object.keys(ev.details).filter(k => ev.details![k]).length > 0 && (<div className="flex flex-wrap gap-1 mt-1">{Object.entries(ev.details).filter(([, v]) => v).slice(0, 4).map(([k, v]) => <Badge key={k} variant="outline" className="text-[9px] px-1.5 py-0 h-4">{k}: {String(v).substring(0, 30)}</Badge>)}</div>)}</div></div>); })}</div></div>
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="predicoes" className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {editLead?.id && <LeadPredictivePanel leadIds={[editLead.id]} projectFilter={editLead.project_id || "all"} />}
                  </TabsContent>

                  <TabsContent value="automacoes" className="space-y-4">
                    {(() => {
                      const matching = automations.filter(a => {
                        if (!a.ativo) return false;
                        if (a.project_id && editLead?.project_id && a.project_id !== editLead.project_id) return false;
                        if (a.campanha_id) {
                          if (!(editLead as any)?.campanha_id) return false;
                          if (a.campanha_id !== (editLead as any).campanha_id) return false;
                        }
                        return true;
                      });
                      return (
                        <div className="space-y-2 p-3 rounded-lg bg-violet-500/5 border border-violet-500/20">
                          <p className="text-xs font-bold text-violet-300 uppercase tracking-wider">🎯 Fluxos que atendem este lead ({matching.length})</p>
                          {(editLead as any)?.campanha_id && <Badge variant="outline" className="text-[9px] bg-violet-500/10 text-violet-400 border-violet-500/30">📣 Campanha vinculada</Badge>}
                          {matching.length === 0 ? (
                            <p className="text-[11px] text-muted-foreground italic">Nenhum fluxo ativo com escopo compatível.</p>
                          ) : (
                            <div className="space-y-1">{matching.map(a => (
                              <div key={a.id} className="flex items-center justify-between text-[11px] p-1.5 bg-secondary/40 rounded">
                                <span className="truncate">⚡ {a.nome}</span>
                                <Badge variant="outline" className="text-[9px]">{a.trigger_tipo}</Badge>
                              </div>
                            ))}</div>
                          )}
                        </div>
                      );
                    })()}
                    <div className="space-y-2"><p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">⚡ Disparar Automação</p>{(() => { const filteredAutos = editLead?.project_id ? automations.filter(a => !a.project_id || a.project_id === editLead.project_id) : automations; return filteredAutos.length === 0 ? (<p className="text-xs text-muted-foreground">Nenhuma automação cadastrada. Crie em OpenFlow.</p>) : (<div className="grid grid-cols-2 gap-2">{filteredAutos.map(a => (<Button key={a.id} size="sm" variant="outline" className="text-xs justify-start" onClick={() => editLead && triggerAutomation(editLead, a)}><Play className="h-3 w-3 mr-1" /> {a.nome}</Button>))}</div>); })()}</div>
                    <div className="space-y-2 border-t border-border pt-3"><p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">📋 Histórico de Ações</p>{leadAutomationLogs.length === 0 ? (<p className="text-xs text-muted-foreground text-center py-4">Nenhuma ação registrada</p>) : (<div className="space-y-2 max-h-[250px] overflow-y-auto">{leadAutomationLogs.map(log => (<div key={log.id} className="p-2 bg-secondary/50 rounded-lg"><div className="flex items-center justify-between"><span className="text-xs font-medium">{log.action}</span><span className="text-[10px] text-muted-foreground">{log.created_at ? (() => { try { const d = new Date(log.created_at); return isValid(d) ? format(d, "dd/MM HH:mm") : ""; } catch { return ""; } })() : ""}</span></div>{log.details && (<div className="flex flex-wrap gap-1 mt-1">{Object.entries(log.details as Record<string, any>).filter(([, v]) => v).map(([k, v]) => (<Badge key={k} variant="outline" className="text-[9px] px-1.5 py-0 h-4">{k}: {String(v).substring(0, 25)}</Badge>))}</div>)}</div>))}</div>)}</div>
                  </TabsContent>

                  <TabsContent value="nutricao" className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {editLead?.id && <LeadNurtureTimeline leadId={editLead.id} />}
                  </TabsContent>
                </Tabs>
              </div>
            )}
            <DialogFooter className="flex justify-between border-t border-slate-800/60 pt-3">
              <Button variant="destructive" size="sm" onClick={() => editLead && setDeleteConfirm(editLead.id)} className="bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"><Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir Lead</Button>
              <Button onClick={saveEdit} className="bg-amber-500 text-slate-950 font-bold hover:bg-amber-600">Salvar Alterações</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteConfirm} onOpenChange={(v) => !v && setDeleteConfirm(null)}>
          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir Lead?</AlertDialogTitle><AlertDialogDescription>Isso irá remover o lead e todas as vendas associadas permanentemente.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteConfirm && deleteLead(deleteConfirm)}>Excluir permanentemente</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir {selectedIds.size} leads?</AlertDialogTitle><AlertDialogDescription>Isso irá remover {selectedIds.size} lead{selectedIds.size > 1 ? "s" : ""} e todas as vendas associadas permanentemente.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={deleteSelected}>Excluir {selectedIds.size} leads</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
        </AlertDialog>

        <LeadImportDialog open={showImport} onOpenChange={setShowImport} projects={projects} defaultProjectId={projectFilter !== "all" && projectFilter !== "none" ? projectFilter : undefined} onComplete={load} />
        <LeadWhatsAppDialog open={showWaDialog} onOpenChange={setShowWaDialog} target={waTarget} waProviders={waProviders} waTemplates={waTemplates} projects={projects} />
        <LeadJourneyDrawer open={!!journeyLead} onClose={() => setJourneyLead(null)} lead={journeyLead} automations={automations} />
      </div>
    </div>
  );
}

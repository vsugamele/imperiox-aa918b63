import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { EditableTagList } from "@/components/projeto/EditableTagList";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, LineChart, Line, AreaChart, Area, CartesianGrid, Cell } from "recharts";
import { Search, MessageCircle, Plus, Trash2, Users, UserCheck, Crown, DollarSign, RefreshCw, Radio, Eye, ShoppingCart, MousePointerClick, Globe, Zap, FileUp, AlertCircle, Package, X, BarChart3, Mail, Send, Play, ChevronDown, ChevronRight, CalendarIcon, TrendingUp, Clock, Target, Megaphone } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { format, isToday, parseISO, isValid, subDays, startOfMonth, endOfMonth, subMonths, differenceInHours, differenceInDays, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LeadImportDialog } from "@/components/leads/LeadImportDialog";
import { FormBuilder } from "@/components/leads/FormBuilder";
import { FormInsights } from "@/components/leads/FormInsights";

const STATUS_COLORS: Record<string, string> = {
  lead: "bg-primary/20 text-primary",
  cliente: "bg-emerald-500/20 text-emerald-400",
  vip: "bg-accent/20 text-accent-foreground",
  inativo: "bg-muted text-muted-foreground",
};
const STATUSES = ["lead", "cliente", "vip", "inativo"];
const PLATFORMS = ["Meta", "Google", "TikTok", "Hotmart", "Kiwify", "Ticto", "Orgânico", "Indicação"];

const STAGE_LABELS: Record<string, { label: string; color: string }> = {
  lead_capturado: { label: "Lead", color: "bg-blue-500/20 text-blue-400" },
  carrinho_abandonado: { label: "Carrinho", color: "bg-amber-500/20 text-amber-400" },
  pix_gerado: { label: "Pix Gerado", color: "bg-yellow-500/20 text-yellow-400" },
  aguardando_pagamento: { label: "Aguardando", color: "bg-orange-500/20 text-orange-400" },
  compra_aprovada: { label: "Compra ✓", color: "bg-emerald-500/20 text-emerald-400" },
  reembolso: { label: "Reembolso", color: "bg-destructive/20 text-destructive" },
};
const STAGES = Object.keys(STAGE_LABELS);

function getLeadStage(lead: Lead): string {
  if (lead.status === "cliente") return "compra_aprovada";
  return (lead.data as any)?.ultimo_evento || "lead_capturado";
}

interface LeadVenda {
  id: string; produto_nome?: string; valor: number; plataforma?: string; status?: string; data?: any; created_at?: string;
}

interface Lead {
  id: string; nome?: string; phone?: string; email?: string; project_id?: string;
  funil_id?: string; plataforma?: string; status?: string; score?: number;
  tags?: string[]; total_gasto?: number; data?: any; criado_em?: string;
  _isNew?: boolean;
  _vendas?: LeadVenda[];
  _score?: number;
}

interface TimelineEvent {
  id: string;
  type: "PageView" | "LeadCapture" | "ViewContent" | "AddToCart" | "Purchase" | "click" | "CSVImport" | "FormResponse" | string;
  timestamp: string;
  title: string;
  subtitle?: string;
  details?: Record<string, any>;
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
};

const FUNNEL_COLORS = ["hsl(var(--primary))", "#f59e0b", "#ef4444", "#10b981"];

type PeriodKey = "today" | "yesterday" | "7d" | "30d" | "90d" | "this_month" | "last_month" | "custom";
const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "yesterday", label: "Ontem" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "90d", label: "90 dias" },
  { key: "this_month", label: "Este mês" },
  { key: "last_month", label: "Mês passado" },
  { key: "custom", label: "Personalizado" },
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

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [form, setForm] = useState({ nome: "", email: "", phone: "", plataforma: "", status: "lead", tags: [] as string[] });
  const [realtimeActive, setRealtimeActive] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [stageFilter, setStageFilter] = useState("all");
  const [showImport, setShowImport] = useState(false);
  const [productFilter, setProductFilter] = useState("all");
  const [products, setProducts] = useState<string[]>([]);
  const [productLeadIds, setProductLeadIds] = useState<Set<string> | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [mainTab, setMainTab] = useState("leads");
  const [automations, setAutomations] = useState<any[]>([]);
  const [leadAutomationLogs, setLeadAutomationLogs] = useState<any[]>([]);
  const [scoreLog, setScoreLog] = useState<{acao: string; pontos: number; created_at: string}[]>([]);
  const [formResponses, setFormResponses] = useState<{form_id: string; form_name?: string; question: string; answer: string; created_at: string}[]>([]);
  const [allVendasRaw, setAllVendasRaw] = useState<any[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [adsSpend, setAdsSpend] = useState<any[]>([]);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<PeriodKey>("30d");
  const [customFrom, setCustomFrom] = useState<Date>();
  const [customTo, setCustomTo] = useState<Date>();
  const projectFilterRef = useRef(projectFilter);
  projectFilterRef.current = projectFilter;

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
    const [leadsRes, projRes, vendasRes, autoRes, adsRes] = await Promise.all([
      supabase.from("imphq_leads").select("*").order("criado_em", { ascending: false }),
      supabase.from("imphq_projects").select("id, name, icon"),
      supabase.from("imphq_vendas").select("id, lead_id, produto_nome, valor, plataforma, status, data, created_at").order("created_at", { ascending: false }),
      supabase.from("imphq_automacoes").select("*").order("created_at", { ascending: false }),
      supabase.from("imphq_ads_spend").select("*").order("data_ref", { ascending: false }).limit(500),
    ]);
    const allVendas = (vendasRes.data || []) as any[];
    setAllVendasRaw(allVendas);
    setAdsSpend(adsRes.data || []);
    const vendasByLead = new Map<string, LeadVenda[]>();
    allVendas.forEach((v: any) => {
      if (!v.lead_id) return;
      if (!vendasByLead.has(v.lead_id)) vendasByLead.set(v.lead_id, []);
      vendasByLead.get(v.lead_id)!.push({ id: v.id, produto_nome: v.produto_nome, valor: parseFloat(v.valor) || 0, plataforma: v.plataforma, status: v.status, data: v.data, created_at: v.created_at });
    });
    
    const enrichedLeads = (leadsRes.data || []).map((l: any) => {
      const lv = vendasByLead.get(l.id) || [];
      return { ...l, _vendas: lv, _score: calcScore(l, lv) };
    }) as Lead[];
    setLeads(enrichedLeads);
    setProjects(projRes.data || []);
    setAutomations(autoRes.data || []);
    
    const uniqueProducts = [...new Set(allVendas.map((v: any) => v.produto_nome).filter(Boolean))] as string[];
    setProducts(uniqueProducts);
    
    if (productFilter !== "all") {
      const ids = new Set(allVendas.filter((v: any) => v.produto_nome === productFilter).map((v: any) => v.lead_id));
      setProductLeadIds(ids);
    } else {
      setProductLeadIds(null);
    }
    setSelectedIds(new Set());
  };

  useEffect(() => { load(); }, [productFilter]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("leads-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "imphq_leads" }, (payload) => {
        const newLead = payload.new as Lead;
        setLeads((prev) => [{ ...newLead, _isNew: true }, ...prev]);
        const pf = projectFilterRef.current;
        const matchesFilter = pf === "all" || newLead.project_id === pf || (!newLead.project_id && pf === "none");
        if (matchesFilter) {
          toast.success(`Novo lead: ${newLead.nome || newLead.email || "Desconhecido"}`, {
            description: newLead.plataforma ? `Via ${newLead.plataforma}` : undefined,
          });
        }
        setTimeout(() => {
          setLeads((prev) => prev.map((l) => l.id === newLead.id ? { ...l, _isNew: false } : l));
        }, 3000);
      })
      .subscribe((status) => { setRealtimeActive(status === "SUBSCRIBED"); });
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Load timeline when editLead changes
  const loadTimeline = async (lead: Lead) => {
    setTimelineLoading(true);
    setTimeline([]);
    setLeadAutomationLogs([]);
    setScoreLog([]);
    setFormResponses([]);
    const events: TimelineEvent[] = [];
    const visitorId = lead.data?.visitor_id;
    const promises: Promise<any>[] = [];

    // Fetch events by visitor_id
    if (visitorId) {
      promises.push(
        Promise.resolve(supabase.from("imphq_events").select("*").eq("visitor_id", visitorId).order("created_at", { ascending: false }).limit(100))
          .then(({ data }) => {
            (data || []).forEach((e: any) => {
              events.push({ id: e.id, type: e.event_name || "PageView", timestamp: e.created_at, title: e.event_name || "Evento", subtitle: e.page_url ? new URL(e.page_url).pathname : undefined, details: { ...e.event_data, utm_source: e.utm_source, utm_medium: e.utm_medium, utm_campaign: e.utm_campaign } });
            });
          })
      );
    }

    // Also fetch events by lead.id as visitor_id (webhook events use lead id)
    if (!visitorId || visitorId !== lead.id) {
      promises.push(
        Promise.resolve(supabase.from("imphq_events").select("*").eq("visitor_id", lead.id).order("created_at", { ascending: false }).limit(100))
          .then(({ data }) => {
            (data || []).forEach((e: any) => {
              if (!events.find(ev => ev.id === e.id)) {
                events.push({ id: e.id, type: e.event_name || "PageView", timestamp: e.created_at, title: e.event_name || "Evento", subtitle: e.page_url ? new URL(e.page_url).pathname : undefined, details: { ...e.event_data, utm_source: e.utm_source, utm_medium: e.utm_medium, utm_campaign: e.utm_campaign } });
              }
            });
          })
      );
    }

    // Fetch LeadCapture events by email (for leads without imptrack.js / visitor_id)
    if (lead.email) {
      promises.push(
        Promise.resolve(supabase.from("imphq_events").select("*").eq("event_name", "LeadCapture").order("created_at", { ascending: false }).limit(50))
          .then(({ data }) => {
            (data || []).forEach((e: any) => {
              const eventEmail = e.event_data?.email;
              if (eventEmail && eventEmail.toLowerCase() === lead.email.toLowerCase() && !events.find(ev => ev.id === e.id)) {
                events.push({ id: e.id, type: "LeadCapture", timestamp: e.created_at, title: "📥 Lead Capturado", subtitle: e.page_url ? new URL(e.page_url).pathname : (e.event_data?.source || "formulário"), details: { ...e.event_data, utm_source: e.utm_source, utm_medium: e.utm_medium, utm_campaign: e.utm_campaign } });
              }
            });
          })
      );
    }

    if (lead.email) {
      promises.push(
        Promise.resolve(supabase.from("imphq_events").select("*").eq("event_name", "CSVImport").eq("utm_source", lead.email.toLowerCase()).order("created_at", { ascending: false }).limit(50))
          .then(({ data }) => {
            (data || []).forEach((e: any) => {
              const evData = e.event_data || {};
              events.push({ id: e.id, type: "CSVImport", timestamp: e.created_at, title: `Importado via ${evData.plataforma || "CSV"}`, subtitle: evData.produto ? `Produto: ${evData.produto}` : undefined, details: { status: evData.status_evento, pagamento: evData.metodo_pagamento, valor: evData.valor ? `R$ ${evData.valor}` : undefined, data_pedido: evData.data_pedido } });
            });
          })
      );
    }

    promises.push(
      Promise.resolve(supabase.from("imphq_vendas").select("*").eq("lead_id", lead.id).order("created_at", { ascending: false }))
        .then(({ data }) => {
          (data || []).forEach((v: any) => {
            const isRefund = v.status === "reembolsado";
            events.push({
              id: v.id,
              type: isRefund ? "Reembolso" : "Purchase",
              timestamp: v.created_at,
              title: isRefund ? `Reembolso: ${v.produto_nome || "—"}` : `Compra: ${v.produto_nome || "—"}`,
              subtitle: `R$ ${parseFloat(v.valor || 0).toFixed(2)} via ${v.plataforma || "—"}`,
              details: { status: v.status },
            });
          });
        })
    );

    if (lead.email) {
      promises.push(
        Promise.resolve(supabase.from("imphq_clicks").select("*").order("created_at", { ascending: false }).limit(50))
          .then(({ data }) => {
            const leadUtmSource = lead.data?.utms?.utm_source;
            (data || []).forEach((c: any) => {
              if (leadUtmSource && c.utm_source === leadUtmSource) {
                events.push({ id: c.id, type: "click", timestamp: c.created_at, title: "Click UTM", subtitle: c.page_url ? new URL(c.page_url).pathname : c.utm_campaign, details: { utm_source: c.utm_source, utm_medium: c.utm_medium, utm_campaign: c.utm_campaign } });
              }
            });
          })
      );
    }

    promises.push(
      Promise.resolve(supabase.from("imphq_activity_log").select("*").eq("lead_id", lead.id).order("created_at", { ascending: false }).limit(50))
        .then(({ data }) => { setLeadAutomationLogs(data || []); })
    );

    // Fetch form responses
    promises.push(
      Promise.resolve(supabase.from("imphq_lead_responses").select("*, imphq_capture_forms(nome)").eq("lead_id", lead.id).order("created_at", { ascending: false }))
        .then(({ data }) => {
          // Store raw form responses for Qualificação tab
          const rawResponses = (data || []).map((r: any) => ({
            form_id: r.form_id || "",
            form_name: r.imphq_capture_forms?.nome || "",
            question: r.question || r.field_key || "—",
            answer: r.answer || "—",
            created_at: r.created_at || "",
          }));
          setFormResponses(rawResponses);

          // Group responses by form_id + created_at (same submission)
          const grouped: Record<string, { formName: string; entries: Array<{q: string; a: string}>; timestamp: string; id: string }> = {};
          (data || []).forEach((r: any) => {
            const formName = r.imphq_capture_forms?.nome || "Formulário";
            const key = `${r.form_id}_${r.created_at?.substring(0, 16)}`;
            if (!grouped[key]) {
              grouped[key] = { formName, entries: [], timestamp: r.created_at, id: r.id };
            }
            grouped[key].entries.push({ q: r.question || r.field_key || "—", a: r.answer || "—" });
          });
          Object.values(grouped).forEach((g) => {
            const subtitle = g.entries.slice(0, 3).map(e => `${e.q}: ${e.a}`).join(" • ");
            const details: Record<string, string> = {};
            g.entries.forEach(e => { details[e.q] = e.a; });
            events.push({
              id: g.id,
              type: "FormResponse",
              timestamp: g.timestamp,
              title: `📋 ${g.formName}`,
              subtitle: subtitle || "Sem respostas",
              details,
            });
          });
        })
    );

    // Fetch score log
    promises.push(
      Promise.resolve(supabase.from("imphq_lead_scores_log").select("*").eq("lead_id", lead.id).order("created_at", { ascending: false }))
        .then(({ data }) => {
          setScoreLog((data || []).map((s: any) => ({ acao: s.acao, pontos: s.pontos, created_at: s.created_at })));
        })
    );

    await Promise.all(promises);
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setTimeline(events);
    setTimelineLoading(false);
  };

  useEffect(() => {
    if (editLead) loadTimeline(editLead);
  }, [editLead?.id]);

  const filtered = leads.filter((l) => {
    const matchSearch = !search || l.nome?.toLowerCase().includes(search.toLowerCase()) || l.email?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    const matchPlatform = platformFilter === "all" || l.plataforma === platformFilter;
    const matchProject = projectFilter === "all" || l.project_id === projectFilter || (!l.project_id && projectFilter === "none");
    const matchStage = stageFilter === "all" || getLeadStage(l) === stageFilter;
    const matchProduct = productFilter === "all" || (productLeadIds && productLeadIds.has(l.id));
    return matchSearch && matchStatus && matchPlatform && matchProject && matchStage && matchProduct;
  });

  const totalLeads = leads.length;
  const clientes = leads.filter(l => l.status === "cliente").length;
  const vips = leads.filter(l => l.status === "vip").length;
  const totalReceita = leads.reduce((s, l) => s + (parseFloat(String(l.total_gasto)) || 0), 0);

  const allFilteredSelected = filtered.length > 0 && filtered.every(l => selectedIds.has(l.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allFilteredSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(l => l.id)));
  };
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const deleteSelected = async () => {
    const ids = Array.from(selectedIds);
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      await supabase.from("imphq_vendas").delete().in("lead_id", chunk);
      await supabase.from("imphq_leads").delete().in("id", chunk);
    }
    toast.success(`${ids.length} leads removidos`);
    setBulkDeleteConfirm(false);
    setSelectedIds(new Set());
    load();
  };

  const createLead = async () => {
    if (!form.nome.trim()) { toast.error("Nome obrigatório"); return; }
    const id = crypto.randomUUID();
    const { error } = await supabase.from("imphq_leads").insert({
      id, nome: form.nome, email: form.email || null, phone: form.phone || null,
      plataforma: form.plataforma || null, status: form.status, tags: form.tags,
      project_id: projectFilter !== "all" && projectFilter !== "none" ? projectFilter : null,
    });
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Lead criado!");
    setShowNew(false); setForm({ nome: "", email: "", phone: "", plataforma: "", status: "lead", tags: [] });
    load();
  };

  const saveEdit = async () => {
    if (!editLead) return;
    const existingData = editLead.data || {};
    const { error } = await supabase.from("imphq_leads").update({
      nome: editLead.nome, email: editLead.email, phone: editLead.phone,
      plataforma: editLead.plataforma, status: editLead.status, tags: editLead.tags,
      data: existingData,
    }).eq("id", editLead.id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Lead atualizado!"); setEditLead(null); load();
  };

  const deleteLead = async (id: string) => {
    await supabase.from("imphq_vendas").delete().eq("lead_id", id);
    await supabase.from("imphq_leads").delete().eq("id", id);
    toast.success("Lead e vendas associadas removidos");
    setEditLead(null); setDeleteConfirm(null); load();
  };

  const getProjectName = (pid?: string) => {
    if (!pid) return null;
    const p = projects.find(pr => pr.id === pid);
    return p ? `${p.icon || "📁"} ${p.name}` : null;
  };

  const triggerAutomation = async (lead: Lead, auto: any) => {
    try {
      const actions = auto.data?.actions || [];
      for (const action of actions) {
        if (action.type === "email" && lead.email) {
          const projectId = lead.project_id || auto.project_id;
          if (projectId) {
            await supabase.functions.invoke("send-project-email", {
              body: { project_id: projectId, template_id: action.template_id || "default", to_email: lead.email },
            });
          }
        } else if (action.type === "whatsapp" && lead.phone) {
          await supabase.functions.invoke("whatsapp-api", {
            body: { action: "send_message", phone: lead.phone, message: action.message || `Olá ${lead.nome || ""}!` },
          });
        }
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("imphq_activity_log").insert({
          action: "automacao_executada", entity_type: "lead", entity_id: lead.id,
          lead_id: lead.id, user_id: user.id,
          details: { automacao_nome: auto.nome, automacao_id: auto.id },
        });
      }
      toast.success(`Automação "${auto.nome}" executada para ${lead.nome || lead.email}`);
    } catch (err: any) {
      toast.error("Erro ao executar automação: " + err.message);
    }
  };

  const sendQuickEmail = async (lead: Lead) => {
    if (!lead.email || !lead.project_id) { toast.error("Lead precisa ter email e projeto"); return; }
    const { data: proj } = await supabase.from("imphq_projects").select("data").eq("id", lead.project_id).single();
    const templates = (proj?.data as any)?.email_config?.templates || [];
    if (templates.length === 0) { toast.error("Nenhum template de email configurado neste projeto"); return; }
    const { error } = await supabase.functions.invoke("send-project-email", {
      body: { project_id: lead.project_id, template_id: templates[0].id, to_email: lead.email },
    });
    if (error) { toast.error("Erro: " + error.message); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("imphq_activity_log").insert({
        action: "email_enviado", entity_type: "lead", entity_id: lead.id, lead_id: lead.id,
        user_id: user.id, details: { template: templates[0].name, to: lead.email },
      });
    }
    toast.success(`Email enviado para ${lead.email}`);
  };

  const sendQuickWhatsApp = async (lead: Lead) => {
    if (!lead.phone) { toast.error("Lead sem telefone"); return; }
    window.open(`https://wa.me/${lead.phone.replace(/\D/g, "")}`, "_blank");
  };

  // ── Sidebar: products grouped by project ──
  const projectProductMap = useMemo(() => {
    const map = new Map<string, { products: Map<string, number>; totalLeads: number }>();
    // Build product → lead mapping
    const productLeadMap = new Map<string, Set<string>>();
    allVendasRaw.forEach(v => {
      if (!v.produto_nome || !v.lead_id) return;
      if (!productLeadMap.has(v.produto_nome)) productLeadMap.set(v.produto_nome, new Set());
      productLeadMap.get(v.produto_nome)!.add(v.lead_id);
    });

    projects.forEach(p => {
      const projectLeads = leads.filter(l => l.project_id === p.id);
      const projectLeadIdsSet = new Set(projectLeads.map(l => l.id));
      const prodMap = new Map<string, number>();
      productLeadMap.forEach((leadIds, prodName) => {
        const count = [...leadIds].filter(id => projectLeadIdsSet.has(id)).length;
        if (count > 0) prodMap.set(prodName, count);
      });
      if (projectLeads.length > 0) {
        map.set(p.id, { products: prodMap, totalLeads: projectLeads.length });
      }
    });
    return map;
  }, [projects, leads, allVendasRaw]);

  const toggleProject = (pid: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid); else next.add(pid);
      return next;
    });
  };

  // ── Conversion time calculation ──
  const getConversionHours = (lead: Lead): number | null => {
    if (!lead.criado_em || !lead._vendas || lead._vendas.length === 0) return null;
    const approvedSale = lead._vendas.find(v => v.status === "Aprovada" || v.status === "aprovada" || v.status === "approved");
    const firstSale = approvedSale || lead._vendas[0];
    if (!firstSale.created_at) return null;
    try {
      const leadDate = parseISO(lead.criado_em);
      const saleDate = parseISO(firstSale.created_at);
      if (!isValid(leadDate) || !isValid(saleDate)) return null;
      return differenceInHours(saleDate, leadDate);
    } catch { return null; }
  };

  // ── Analytics with period filter ──
  const periodRange = useMemo(() => getPeriodRange(analyticsPeriod, customFrom, customTo), [analyticsPeriod, customFrom, customTo]);

  const periodLeads = useMemo(() => {
    return leads.filter(l => {
      if (!l.criado_em) return false;
      try {
        const d = parseISO(l.criado_em);
        return isValid(d) && isWithinInterval(d, { start: periodRange.from, end: periodRange.to });
      } catch { return false; }
    });
  }, [leads, periodRange]);

  const periodVendas = useMemo(() => {
    return allVendasRaw.filter(v => {
      if (!v.created_at) return false;
      try {
        const d = parseISO(v.created_at);
        return isValid(d) && isWithinInterval(d, { start: periodRange.from, end: periodRange.to });
      } catch { return false; }
    });
  }, [allVendasRaw, periodRange]);

  const periodAds = useMemo(() => {
    return adsSpend.filter(a => {
      if (!a.data_ref) return false;
      try {
        const d = parseISO(a.data_ref);
        return isValid(d) && isWithinInterval(d, { start: periodRange.from, end: periodRange.to });
      } catch { return false; }
    });
  }, [adsSpend, periodRange]);

  // KPIs for period
  const periodKPIs = useMemo(() => {
    const newLeads = periodLeads.length;
    const isApproved = (s: string) => ["Aprovada", "aprovada", "approved", "aprovado", "Aprovado"].includes(s);
    const conversions = periodVendas.filter(v => isApproved(v.status)).length;
    const revenue = periodVendas.filter(v => isApproved(v.status))
      .reduce((s, v) => s + (parseFloat(v.valor) || 0), 0);
    const avgTicket = conversions > 0 ? revenue / conversions : 0;
    const convRate = newLeads > 0 ? (conversions / newLeads * 100) : 0;

    // Avg conversion time
    const convTimes: number[] = [];
    periodLeads.forEach(l => {
      const h = getConversionHours(l);
      if (h !== null && h >= 0) convTimes.push(h);
    });
    const avgConvTime = convTimes.length > 0 ? convTimes.reduce((a, b) => a + b, 0) / convTimes.length : null;

    const totalAds = periodAds.reduce((s, a) => s + (parseFloat(a.valor) || 0), 0);
    const roas = totalAds > 0 ? revenue / totalAds : null;

    return { newLeads, conversions, revenue, avgTicket, convRate, avgConvTime, totalAds, roas };
  }, [periodLeads, periodVendas, periodAds]);

  // Leads by Product (period)
  const leadsByProduct = useMemo(() => {
    const isApproved = (s: string) => ["Aprovada", "aprovada", "approved", "aprovado", "Aprovado"].includes(s);
    const map = new Map<string, number>();
    periodVendas.filter(v => isApproved(v.status)).forEach(v => {
      if (!v.produto_nome) return;
      map.set(v.produto_nome, (map.get(v.produto_nome) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name: name.substring(0, 25), count })).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [periodVendas]);

  // Revenue by Product (period)
  const revenueByProduct = useMemo(() => {
    const map = new Map<string, number>();
    periodVendas.filter(v => ["Aprovada", "aprovada", "approved", "aprovado", "Aprovado"].includes(v.status)).forEach(v => {
      if (!v.produto_nome) return;
      map.set(v.produto_nome, (map.get(v.produto_nome) || 0) + (parseFloat(v.valor) || 0));
    });
    return Array.from(map.entries()).map(([name, revenue]) => ({ name: name.substring(0, 25), revenue: Math.round(revenue) })).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [periodVendas]);

  // Conversion time distribution
  const conversionTimeDist = useMemo(() => {
    const buckets: Record<string, number> = { "0-1d": 0, "1-3d": 0, "3-7d": 0, "7-14d": 0, "14-30d": 0, "30d+": 0 };
    periodLeads.forEach(l => {
      const h = getConversionHours(l);
      if (h !== null && h >= 0) {
        const bucket = getConversionBucket(h);
        buckets[bucket]++;
      }
    });
    return Object.entries(buckets).map(([name, count]) => ({ name, count }));
  }, [periodLeads]);

  // Leads vs Ads timeline
  const leadsVsAds = useMemo(() => {
    const dayMap = new Map<string, { leads: number; ads: number; revenue: number }>();
    periodLeads.forEach(l => {
      if (!l.criado_em) return;
      try {
        const key = format(parseISO(l.criado_em), "dd/MM");
        const entry = dayMap.get(key) || { leads: 0, ads: 0, revenue: 0 };
        entry.leads++;
        dayMap.set(key, entry);
      } catch {}
    });
    periodAds.forEach(a => {
      if (!a.data_ref) return;
      try {
        const key = format(parseISO(a.data_ref), "dd/MM");
        const entry = dayMap.get(key) || { leads: 0, ads: 0, revenue: 0 };
        entry.ads += parseFloat(a.valor) || 0;
        dayMap.set(key, entry);
      } catch {}
    });
    periodVendas.filter(v => v.status === "Aprovada" || v.status === "aprovada" || v.status === "approved").forEach(v => {
      if (!v.created_at) return;
      try {
        const key = format(parseISO(v.created_at), "dd/MM");
        const entry = dayMap.get(key) || { leads: 0, ads: 0, revenue: 0 };
        entry.revenue += parseFloat(v.valor) || 0;
        dayMap.set(key, entry);
      } catch {}
    });
    return Array.from(dayMap.entries()).map(([day, d]) => ({ day, ...d })).sort((a, b) => a.day.localeCompare(b.day));
  }, [periodLeads, periodAds, periodVendas]);

  // Funnel (period)
  const funnelData = useMemo(() => {
    const stages = { lead_capturado: 0, carrinho_abandonado: 0, pix_gerado: 0, compra_aprovada: 0 };
    periodLeads.forEach(l => {
      const stage = getLeadStage(l);
      if (stage in stages) (stages as any)[stage]++;
    });
    return [
      { stage: "Leads", value: stages.lead_capturado, fill: "hsl(var(--primary))" },
      { stage: "Carrinho", value: stages.carrinho_abandonado, fill: "#f59e0b" },
      { stage: "Pix", value: stages.pix_gerado, fill: "#ef4444" },
      { stage: "Clientes", value: stages.compra_aprovada, fill: "#10b981" },
    ];
  }, [periodLeads]);

  // Leads by Month (all time for sidebar)
  const leadsByMonth = useMemo(() => {
    const map = new Map<string, number>();
    leads.forEach(l => {
      if (!l.criado_em) return;
      try {
        const d = parseISO(l.criado_em);
        if (!isValid(d)) return;
        const key = format(d, "MMM/yy", { locale: ptBR });
        map.set(key, (map.get(key) || 0) + 1);
      } catch {}
    });
    return Array.from(map.entries()).map(([month, count]) => ({ month, count })).reverse().slice(-12);
  }, [leads]);

  // ── Pix Hoje ──
  const pixHoje = useMemo(() => {
    return leads.filter(l => {
      const stage = getLeadStage(l);
      if (!["pix_gerado", "aguardando_pagamento"].includes(stage)) return false;
      if (!l.criado_em) return true;
      try { return isToday(parseISO(l.criado_em)); } catch { return false; }
    });
  }, [leads]);

  const chartConfig = {
    count: { label: "Leads", color: "hsl(var(--primary))" },
    revenue: { label: "Receita", color: "#10b981" },
    value: { label: "Qtd", color: "hsl(var(--primary))" },
    leads: { label: "Leads", color: "hsl(var(--primary))" },
    ads: { label: "Ads R$", color: "#ef4444" },
  };

  const noLeadsInProject = leads.filter(l => !l.project_id).length;

  return (
    <div className="flex gap-6">
      {/* ═══ SIDEBAR COLAPSÁVEL ═══ */}
      <div className="w-52 shrink-0 hidden lg:block">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="font-display text-sm font-bold text-primary">Leads</h2>
          {realtimeActive && <Radio className="h-3 w-3 text-emerald-400 animate-pulse" />}
        </div>
        <p className="text-[10px] text-muted-foreground mb-3">{leads.length} total</p>
        <div className="space-y-0.5 max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
          {/* All leads */}
          <button className={cn("w-full text-left text-xs px-2 py-1.5 rounded transition-colors flex items-center justify-between", projectFilter === "all" && productFilter === "all" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground")} onClick={() => { setProjectFilter("all"); setProductFilter("all"); }}>
            <span>🌐 Todos os leads</span>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 ml-1">{leads.length}</Badge>
          </button>
          {/* No project */}
          {noLeadsInProject > 0 && (
            <button className={cn("w-full text-left text-xs px-2 py-1.5 rounded transition-colors flex items-center justify-between", projectFilter === "none" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground")} onClick={() => { setProjectFilter("none"); setProductFilter("all"); }}>
              <span>📂 Sem projeto</span>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 ml-1">{noLeadsInProject}</Badge>
            </button>
          )}

          {/* Projects with collapsible products */}
          {projects.map(p => {
            const info = projectProductMap.get(p.id);
            if (!info || info.totalLeads === 0) return null;
            const isExpanded = expandedProjects.has(p.id);
            const isSelected = projectFilter === p.id && productFilter === "all";
            return (
              <div key={p.id}>
                <div className="flex items-center">
                  <button
                    className="p-1 text-muted-foreground hover:text-foreground"
                    onClick={(e) => { e.stopPropagation(); toggleProject(p.id); }}
                  >
                    {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </button>
                  <button
                    className={cn("flex-1 text-left text-xs px-1 py-1.5 rounded transition-colors truncate flex items-center justify-between", isSelected ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground")}
                    onClick={() => { setProjectFilter(p.id); setProductFilter("all"); }}
                  >
                    <span className="truncate">{p.icon || "📁"} {p.name}</span>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 ml-1 shrink-0">{info.totalLeads}</Badge>
                  </button>
                </div>
                {isExpanded && info.products.size > 0 && (
                  <div className="ml-5 space-y-0.5 mt-0.5">
                    {Array.from(info.products.entries()).sort((a, b) => b[1] - a[1]).map(([prodName, count]) => (
                      <button
                        key={prodName}
                        className={cn("w-full text-left text-[11px] px-2 py-1 rounded transition-colors truncate flex items-center justify-between", productFilter === prodName && projectFilter === p.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}
                        onClick={() => { setProjectFilter(p.id); setProductFilter(prodName); }}
                        title={prodName}
                      >
                        <span className="truncate">🏷️ {prodName}</span>
                        <span className="text-[9px] text-muted-foreground/70 ml-1 shrink-0">{count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 space-y-4 min-w-0">
        <Tabs value={mainTab} onValueChange={setMainTab}>
          <div className="flex items-center gap-3 flex-wrap">
            <TabsList>
              <TabsTrigger value="leads" className="text-xs">📋 Leads</TabsTrigger>
              <TabsTrigger value="analytics" className="text-xs">📊 Analytics</TabsTrigger>
              <TabsTrigger value="formularios" className="text-xs">📝 Formulários</TabsTrigger>
              <TabsTrigger value="insights" className="text-xs">💡 Insights</TabsTrigger>
              {pixHoje.length > 0 && (
                <TabsTrigger value="pix_hoje" className="text-xs relative">
                  💰 Pix Hoje
                  <span className="ml-1 bg-orange-500 text-white text-[9px] font-bold rounded-full px-1.5 animate-pulse">{pixHoje.length}</span>
                </TabsTrigger>
              )}
            </TabsList>
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => {
                const headers = ["Nome","Email","Telefone","Status","Estágio","Plataforma","Projeto","Score","Receita","Criado em"];
                const rows = filtered.map(l => [
                  l.nome || "", l.email || "", l.phone || "", l.status || "", getLeadStage(l),
                  l.plataforma || "", projects.find(p => p.id === l.project_id)?.name || "",
                  String(l._score || 0), String(l.total_gasto || 0), l.criado_em?.split("T")[0] || ""
                ]);
                const csv = [headers, ...rows].map(r => r.map(c => `"${(c||"").replace(/"/g,'""')}"`).join(",")).join("\n");
                const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = `leads_${new Date().toISOString().split("T")[0]}.csv`; a.click();
                URL.revokeObjectURL(url);
                toast.success(`${filtered.length} leads exportados`);
              }}>📥 Export CSV</Button>
              <Button size="sm" variant="outline" onClick={() => setShowImport(true)}><FileUp className="h-4 w-4 mr-1" /> Importar</Button>
              <Button size="sm" onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" /> Novo Lead</Button>
            </div>
          </div>

          {/* ═══ TAB: LEADS ═══ */}
          <TabsContent value="leads" className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative max-w-xs flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nome, email..." className="pl-9 bg-secondary h-9" />
              </div>
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Plataforma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Plataforma</SelectItem>
                  {PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[120px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Status</SelectItem>
                  {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Estágio" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Estágio</SelectItem>
                  {STAGES.map(s => <SelectItem key={s} value={s}>{STAGE_LABELS[s].label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="w-[140px] h-9 lg:hidden"><SelectValue placeholder="Projeto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Projetos</SelectItem>
                  <SelectItem value="none">Sem projeto</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.icon || "📁"} {p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="icon" variant="ghost" className="h-9 w-9" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
            </div>

            {someSelected && (
              <div className="flex items-center gap-3 bg-secondary border border-border rounded-lg px-4 py-2 animate-in slide-in-from-bottom-2">
                <span className="text-sm font-medium">{selectedIds.size} selecionado{selectedIds.size > 1 ? "s" : ""}</span>
                <Button size="sm" variant="destructive" onClick={() => setBulkDeleteConfirm(true)}><Trash2 className="h-3 w-3 mr-1" /> Excluir</Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}><X className="h-3 w-3 mr-1" /> Limpar</Button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">
                {productFilter !== "all"
                  ? `🏷️ Produto: ${productFilter}`
                  : projectFilter === "all" ? "Todos os Leads" : projectFilter === "none" ? "Sem Projeto" : getProjectName(projectFilter) || "Leads"}
              </p>
              <Badge variant="outline" className="text-[10px]">{filtered.length} de {leads.length}</Badge>
            </div>

            {/* Period Filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground mr-1">Período:</span>
              {PERIOD_OPTIONS.map(p => (
                <Button key={p.key} size="sm" variant={analyticsPeriod === p.key ? "default" : "outline"} className="h-7 text-[11px] px-2.5" onClick={() => setAnalyticsPeriod(p.key)}>{p.label}</Button>
              ))}
            </div>

            {/* KPI Cards */}
            {(() => {
              const pLeads = leads.filter(l => {
                if (!l.criado_em) return false;
                try { const d = parseISO(l.criado_em); return isValid(d) && isWithinInterval(d, { start: periodRange.from, end: periodRange.to }); } catch { return false; }
              });
              const pTotal = pLeads.length;
              const pNovosHoje = leads.filter(l => { try { return l.criado_em && isToday(parseISO(l.criado_em)); } catch { return false; } }).length;
              const pClientes = pLeads.filter(l => l.status === "cliente").length;
              const pCarrinho = pLeads.filter(l => getLeadStage(l) === "carrinho_abandonado").length;
              const pPixAberto = pLeads.filter(l => ["pix_gerado", "aguardando_pagamento"].includes(getLeadStage(l))).length;
              const pTxConv = pTotal > 0 ? ((pClientes / pTotal) * 100).toFixed(1) : "0";
              const pRecuperacao = pLeads.filter(l => {
                const stage = getLeadStage(l);
                if (!["pix_gerado", "aguardando_pagamento", "carrinho_abandonado"].includes(stage)) return false;
                if (!l.criado_em) return true;
                try { return differenceInHours(new Date(), parseISO(l.criado_em)) > 24; } catch { return false; }
              }).length;
              const pReceita = pLeads.reduce((s, l) => s + (parseFloat(String(l.total_gasto)) || 0), 0);

              return (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
                  <Card className={cn("bg-card border-border cursor-pointer transition-all hover:ring-1 hover:ring-primary/40", stageFilter === "all" && statusFilter === "all" && "ring-1 ring-primary/30")} onClick={() => { setStageFilter("all"); setStatusFilter("all"); }}>
                    <CardContent className="p-2.5 flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground shrink-0" /><div><p className="text-lg font-bold leading-none">{pTotal}</p><p className="text-[9px] text-muted-foreground mt-0.5">Total Leads</p></div></CardContent>
                  </Card>
                  <Card className="bg-card border-border cursor-pointer transition-all hover:ring-1 hover:ring-blue-500/40" onClick={() => { setStageFilter("all"); setStatusFilter("all"); }}>
                    <CardContent className="p-2.5 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-blue-400 shrink-0" /><div><p className="text-lg font-bold leading-none">{pNovosHoje}</p><p className="text-[9px] text-muted-foreground mt-0.5">Novos Hoje</p></div></CardContent>
                  </Card>
                  <Card className={cn("bg-card border-border cursor-pointer transition-all hover:ring-1 hover:ring-emerald-500/40", statusFilter === "cliente" && "ring-1 ring-emerald-500/50")} onClick={() => { setStatusFilter("cliente"); setStageFilter("all"); }}>
                    <CardContent className="p-2.5 flex items-center gap-2"><UserCheck className="h-4 w-4 text-emerald-400 shrink-0" /><div><p className="text-lg font-bold leading-none">{pClientes}</p><p className="text-[9px] text-muted-foreground mt-0.5">Clientes</p></div></CardContent>
                  </Card>
                  <Card className={cn("bg-card border-border cursor-pointer transition-all hover:ring-1 hover:ring-amber-500/40", stageFilter === "carrinho_abandonado" && "ring-1 ring-amber-500/50")} onClick={() => { setStageFilter("carrinho_abandonado"); setStatusFilter("all"); }}>
                    <CardContent className="p-2.5 flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-amber-400 shrink-0" /><div><p className="text-lg font-bold leading-none">{pCarrinho}</p><p className="text-[9px] text-muted-foreground mt-0.5">Carrinho</p></div></CardContent>
                  </Card>
                  <Card className={cn("bg-card border-border cursor-pointer transition-all hover:ring-1 hover:ring-orange-500/40", stageFilter === "pix_gerado" && "ring-1 ring-orange-500/50")} onClick={() => { setStageFilter("pix_gerado"); setStatusFilter("all"); }}>
                    <CardContent className="p-2.5 flex items-center gap-2"><AlertCircle className="h-4 w-4 text-orange-400 shrink-0" /><div><p className="text-lg font-bold leading-none">{pPixAberto}</p><p className="text-[9px] text-muted-foreground mt-0.5">Pix Aberto</p></div></CardContent>
                  </Card>
                  <Card className="bg-card border-border cursor-pointer transition-all hover:ring-1 hover:ring-primary/40" onClick={() => { setStatusFilter("all"); setStageFilter("all"); }}>
                    <CardContent className="p-2.5 flex items-center gap-2"><Target className="h-4 w-4 text-primary shrink-0" /><div><p className="text-lg font-bold leading-none">{pTxConv}%</p><p className="text-[9px] text-muted-foreground mt-0.5">Conversão</p></div></CardContent>
                  </Card>
                  <Card className="bg-card border-border cursor-pointer transition-all hover:ring-1 hover:ring-red-500/40" onClick={() => { setStageFilter("pix_gerado"); setStatusFilter("all"); }}>
                    <CardContent className="p-2.5 flex items-center gap-2"><Clock className="h-4 w-4 text-red-400 shrink-0" /><div><p className="text-lg font-bold leading-none">{pRecuperacao}</p><p className="text-[9px] text-muted-foreground mt-0.5">Recuperar</p></div></CardContent>
                  </Card>
                  <Card className="bg-card border-border">
                    <CardContent className="p-2.5 flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary shrink-0" /><div><p className="text-lg font-bold font-mono text-primary leading-none">R$ {pReceita.toFixed(0)}</p><p className="text-[9px] text-muted-foreground mt-0.5">Receita</p></div></CardContent>
                  </Card>
                </div>
              );
            })()}

            {/* Table */}
            <div className="rounded-lg border border-border overflow-auto">
              <Table>
                 <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"><Checkbox checked={allFilteredSelected} onCheckedChange={toggleSelectAll} /></TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Projeto</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Estágio</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Receita</TableHead>
                    <TableHead>Desde</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((l) => (
                    <TableRow key={l.id} className={cn("cursor-pointer hover:bg-secondary/50 transition-all", l._isNew && "animate-pulse bg-emerald-500/10 ring-1 ring-emerald-500/30", selectedIds.has(l.id) && "bg-primary/5")} onClick={() => setEditLead({ ...l })}>
                      <TableCell onClick={e => e.stopPropagation()}><Checkbox checked={selectedIds.has(l.id)} onCheckedChange={() => toggleSelect(l.id)} /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 bg-secondary"><AvatarFallback className="text-xs font-bold bg-secondary text-foreground">{(l.nome || "?")[0].toUpperCase()}</AvatarFallback></Avatar>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium text-sm">{l.nome}</p>
                              {l._isNew && <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">NOVO</span>}
                            </div>
                            <div className="flex items-center gap-1">
                              <p className="text-[10px] text-muted-foreground">{l.email || "—"}</p>
                              {l.tags && l.tags.slice(0, 2).map(t => <Badge key={t} variant="outline" className="text-[8px] px-1 py-0 h-3.5 leading-none">{t}</Badge>)}
                              {l.tags && l.tags.length > 2 && <span className="text-[8px] text-muted-foreground">+{l.tags.length - 2}</span>}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{(() => { const proj = projects.find(p => p.id === l.project_id); return proj ? <span className="text-xs text-muted-foreground truncate max-w-[100px] block">{proj.icon || "📁"} {proj.name}</span> : <span className="text-xs text-muted-foreground">—</span>; })()}</TableCell>
                      <TableCell>{(() => { const vendas = (l._vendas || []) as any[]; if (vendas.length === 0) return <span className="text-xs text-muted-foreground">—</span>; const tipoMap: Record<string, string> = { orderbump: "OB", upsell: "UP", downsell: "DS" }; const tipoCls: Record<string, string> = { orderbump: "bg-amber-500/20 text-amber-400 border-amber-500/30", upsell: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", downsell: "bg-rose-500/20 text-rose-400 border-rose-500/30" }; return <div className="flex flex-col gap-0.5 max-w-[140px]">{vendas.slice(0, 3).map((v: any, i: number) => { const badge = tipoMap[v.tipo_venda]; return <div key={i} className="flex items-center gap-1"><span className="text-xs text-primary truncate" title={v.produto_nome}>{v.produto_nome || "—"}</span>{badge && <Badge variant="outline" className={cn("text-[8px] px-1 py-0 h-3.5 leading-none border", tipoCls[v.tipo_venda])}>{badge}</Badge>}</div>; })}{vendas.length > 3 && <span className="text-[10px] text-muted-foreground">+{vendas.length - 3} mais</span>}</div>; })()}</TableCell>
                      <TableCell>{(() => { const vendas = l._vendas || []; const pgto = vendas.find(v => v.data?.metodo_pagamento)?.data?.metodo_pagamento; return pgto ? <span className="text-[10px] text-muted-foreground">{pgto}</span> : <span className="text-xs text-muted-foreground">—</span>; })()}</TableCell>
                      <TableCell>{(() => { const stage = getLeadStage(l); const cfg = STAGE_LABELS[stage] || STAGE_LABELS.lead_capturado; const isPending = ["carrinho_abandonado", "pix_gerado", "aguardando_pagamento"].includes(stage); return (<div className="flex items-center gap-1"><Badge className={cn("text-[10px]", cfg.color, isPending && "animate-pulse ring-1 ring-amber-500/40")}>{cfg.label}</Badge>{isPending && <AlertCircle className="h-3 w-3 text-amber-400" />}</div>); })()}</TableCell>
                      <TableCell><div className="flex items-center gap-1.5"><div className="w-12 h-1.5 bg-secondary rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${l._score || 0}%` }} /></div><span className="text-[10px] font-mono text-muted-foreground">{l._score || 0}</span></div></TableCell>
                      <TableCell className="font-mono text-sm text-primary">{l.total_gasto ? `R$ ${parseFloat(String(l.total_gasto)).toFixed(0)}` : "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{l.criado_em ? (() => { try { const d = parseISO(l.criado_em!); return isValid(d) ? format(d, "dd/MM/yy HH:mm") : "—"; } catch { return "—"; } })() : "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          {l.phone && <Button size="icon" variant="ghost" asChild className="h-7 w-7"><a href={`https://wa.me/${l.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener"><MessageCircle className="h-4 w-4 text-emerald-400" /></a></Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ═══ TAB: ANALYTICS ═══ */}
          <TabsContent value="analytics" className="space-y-6">
            {/* Period Filter Bar */}
            <div className="flex items-center gap-2 flex-wrap">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              {PERIOD_OPTIONS.map(opt => (
                <Button
                  key={opt.key}
                  size="sm"
                  variant={analyticsPeriod === opt.key ? "default" : "outline"}
                  className="text-xs h-7"
                  onClick={() => setAnalyticsPeriod(opt.key)}
                >
                  {opt.label}
                </Button>
              ))}
              {analyticsPeriod === "custom" && (
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="text-xs h-7">
                        {customFrom ? format(customFrom, "dd/MM/yy") : "De"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                  <span className="text-xs text-muted-foreground">→</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="text-xs h-7">
                        {customTo ? format(customTo, "dd/MM/yy") : "Até"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={customTo} onSelect={setCustomTo} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              <Card className="bg-card border-border">
                <CardContent className="p-3"><p className="text-lg font-bold">{periodKPIs.newLeads}</p><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Novos Leads</p></CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-3"><p className="text-lg font-bold text-emerald-400">{periodKPIs.conversions}</p><p className="text-[10px] text-muted-foreground flex items-center gap-1"><UserCheck className="h-3 w-3" /> Conversões</p></CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-3"><p className="text-lg font-bold text-primary">{periodKPIs.convRate.toFixed(1)}%</p><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Target className="h-3 w-3" /> Taxa Conv.</p></CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-3"><p className="text-lg font-bold font-mono text-primary">R$ {periodKPIs.revenue.toFixed(0)}</p><p className="text-[10px] text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> Receita</p></CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-3"><p className="text-lg font-bold font-mono">R$ {periodKPIs.avgTicket.toFixed(0)}</p><p className="text-[10px] text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Ticket Médio</p></CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-3"><p className="text-lg font-bold">{periodKPIs.avgConvTime !== null ? formatConversionTime(periodKPIs.avgConvTime) : "—"}</p><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Tempo Conv.</p></CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-3"><p className="text-lg font-bold font-mono text-destructive">R$ {periodKPIs.totalAds.toFixed(0)}</p><p className="text-[10px] text-muted-foreground flex items-center gap-1"><Megaphone className="h-3 w-3" /> Investido Ads</p></CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-3"><p className="text-lg font-bold font-mono">{periodKPIs.roas !== null ? `${periodKPIs.roas.toFixed(1)}x` : "—"}</p><p className="text-[10px] text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> ROAS</p></CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Leads vs Ads vs Receita Timeline */}
              <Card className="bg-card border-border md:col-span-2">
                <CardHeader className="pb-2"><CardTitle className="text-sm">📈 Leads vs Ads vs Receita (diário)</CardTitle></CardHeader>
                <CardContent>
                  {leadsVsAds.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Sem dados no período</p> : (
                    <ChartContainer config={chartConfig} className="h-[280px] w-full">
                      <AreaChart data={leadsVsAds} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                        <XAxis dataKey="day" className="text-[10px]" />
                        <YAxis className="text-[10px]" />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Area type="monotone" dataKey="revenue" fill="#10b981" fillOpacity={0.15} stroke="#10b981" strokeWidth={2} name="Receita R$" />
                        <Area type="monotone" dataKey="ads" fill="#ef4444" fillOpacity={0.1} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 4" name="Ads R$" />
                        <Line type="monotone" dataKey="leads" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2 }} name="Leads" />
                      </AreaChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              {/* Leads by Product */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-2"><CardTitle className="text-sm">📦 Leads por Produto</CardTitle></CardHeader>
                <CardContent>
                  {leadsByProduct.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p> : (
                    <ChartContainer config={chartConfig} className="h-[250px] w-full">
                      <BarChart data={leadsByProduct} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                        <XAxis type="number" className="text-[10px]" />
                        <YAxis dataKey="name" type="category" width={120} className="text-[10px]" tick={{ fontSize: 9 }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              {/* Revenue by Product */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-2"><CardTitle className="text-sm">💰 Receita por Produto</CardTitle></CardHeader>
                <CardContent>
                  {revenueByProduct.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Sem receita</p> : (
                    <ChartContainer config={chartConfig} className="h-[250px] w-full">
                      <BarChart data={revenueByProduct} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                        <XAxis type="number" className="text-[10px]" tickFormatter={(v) => `R$${v}`} />
                        <YAxis dataKey="name" type="category" width={120} className="text-[10px]" tick={{ fontSize: 9 }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="revenue" fill="#10b981" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              {/* Conversion Time Distribution */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-2"><CardTitle className="text-sm">⏱️ Tempo de Conversão</CardTitle></CardHeader>
                <CardContent>
                  {conversionTimeDist.every(d => d.count === 0) ? <p className="text-sm text-muted-foreground text-center py-8">Sem conversões no período</p> : (
                    <ChartContainer config={chartConfig} className="h-[250px] w-full">
                      <BarChart data={conversionTimeDist} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                        <XAxis dataKey="name" className="text-[10px]" />
                        <YAxis className="text-[10px]" />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              {/* Funnel */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-2"><CardTitle className="text-sm">🔻 Funil de Conversão</CardTitle></CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <BarChart data={funnelData} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                      <XAxis dataKey="stage" className="text-[10px]" />
                      <YAxis className="text-[10px]" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {funnelData.map((entry, i) => <Cell key={i} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Leads by Month */}
              <Card className="bg-card border-border md:col-span-2">
                <CardHeader className="pb-2"><CardTitle className="text-sm">📈 Leads por Mês (histórico)</CardTitle></CardHeader>
                <CardContent>
                  {leadsByMonth.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p> : (
                    <ChartContainer config={chartConfig} className="h-[220px] w-full">
                      <LineChart data={leadsByMonth} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                        <XAxis dataKey="month" className="text-[10px]" />
                        <YAxis className="text-[10px]" />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: "hsl(var(--primary))" }} />
                      </LineChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ═══ TAB: FORMULÁRIOS ═══ */}
          <TabsContent value="formularios" className="space-y-4">
            <FormBuilder projects={projects} />
          </TabsContent>

          {/* ═══ TAB: INSIGHTS ═══ */}
          <TabsContent value="insights" className="space-y-4">
            <FormInsights projects={projects} />
          </TabsContent>

          {/* ═══ TAB: PIX HOJE ═══ */}
          <TabsContent value="pix_hoje" className="space-y-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-400 animate-pulse" />
              <h3 className="font-bold text-sm">Leads com Pix pendente hoje — {pixHoje.length} lead{pixHoje.length !== 1 ? "s" : ""}</h3>
            </div>
            {pixHoje.length === 0 ? (
              <Card className="bg-card border-border"><CardContent className="p-8 text-center"><p className="text-sm text-muted-foreground">🎉 Nenhum pix pendente hoje!</p></CardContent></Card>
            ) : (
              <div className="space-y-3">
                {pixHoje.map(l => {
                  const vendas = l._vendas || [];
                  const produto = vendas[0]?.produto_nome || "—";
                  const valor = vendas.reduce((s, v) => s + v.valor, 0);
                  return (
                    <Card key={l.id} className="bg-card border-border hover:ring-1 hover:ring-orange-500/30 transition-all">
                      <CardContent className="p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-10 w-10 bg-secondary shrink-0"><AvatarFallback className="font-bold bg-secondary text-foreground">{(l.nome || "?")[0].toUpperCase()}</AvatarFallback></Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{l.nome}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{l.email || "—"} • {l.phone || "sem tel."}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className="text-[9px]">{produto}</Badge>
                              {valor > 0 && <span className="text-xs font-mono text-primary">R$ {valor.toFixed(2)}</span>}
                              {l.criado_em && (() => { try { const d = parseISO(l.criado_em!); return isValid(d) ? <span className="text-[9px] text-muted-foreground">{format(d, "HH:mm")}</span> : null; } catch { return null; } })()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button size="sm" variant="outline" onClick={() => sendQuickEmail(l)} disabled={!l.email || !l.project_id}>
                            <Mail className="h-3 w-3 mr-1" /> Email
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => sendQuickWhatsApp(l)} disabled={!l.phone}>
                            <MessageCircle className="h-3 w-3 mr-1" /> WhatsApp
                          </Button>
                          {automations.length > 0 && (
                            <Select onValueChange={(autoId) => {
                              const auto = automations.find(a => a.id === autoId);
                              if (auto) triggerAutomation(l, auto);
                            }}>
                              <SelectTrigger className="h-8 w-[150px] text-xs">
                                <SelectValue placeholder="⚡ Automação" />
                              </SelectTrigger>
                              <SelectContent>
                                {automations.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => setEditLead({ ...l })}>
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* New Lead Dialog */}
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Lead</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Plataforma</Label><Select value={form.plataforma} onValueChange={v => setForm({ ...form, plataforma: v })}><SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger><SelectContent>{PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Status</Label><Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <div><Label>Tags</Label><EditableTagList tags={form.tags} onChange={tags => setForm({ ...form, tags })} /></div>
            </div>
            <DialogFooter><Button onClick={createLead}>Criar</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Lead Dialog with Tabs */}
        <Dialog open={!!editLead} onOpenChange={() => setEditLead(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Editar Lead</DialogTitle></DialogHeader>
            {editLead && (
              <Tabs defaultValue="dados" className="space-y-3">
                <TabsList className="w-full">
                  <TabsTrigger value="dados" className="flex-1 text-xs">📝 Dados</TabsTrigger>
                  <TabsTrigger value="qualificacao" className="flex-1 text-xs">🎯 Qualificação</TabsTrigger>
                  <TabsTrigger value="jornada" className="flex-1 text-xs">🗺️ Jornada ({timeline.length})</TabsTrigger>
                  <TabsTrigger value="automacoes" className="flex-1 text-xs">⚡ Automações</TabsTrigger>
                </TabsList>

                <TabsContent value="dados" className="space-y-3">
                  <div className="flex items-center gap-3 pb-2">
                    <Avatar className="h-10 w-10 bg-secondary"><AvatarFallback className="font-bold bg-secondary text-foreground">{(editLead.nome || "?")[0].toUpperCase()}</AvatarFallback></Avatar>
                    <div>
                      <p className="font-medium">{editLead.nome}</p>
                      <p className="text-xs text-muted-foreground">{editLead.email}</p>
                    </div>
                  </div>

                  {/* Conversion time */}
                  {(() => {
                    const hours = getConversionHours(editLead);
                    if (hours !== null && hours >= 0) {
                      return (
                        <div className="flex items-center gap-2 p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                          <Clock className="h-4 w-4 text-emerald-400" />
                          <span className="text-xs font-medium text-emerald-400">Tempo até compra: {formatConversionTime(hours)}</span>
                        </div>
                      );
                    }
                    if (editLead.criado_em && (!editLead._vendas || editLead._vendas.length === 0)) {
                      try {
                        const d = parseISO(editLead.criado_em);
                        if (isValid(d)) {
                          const daysSince = differenceInDays(new Date(), d);
                          return (
                            <div className="flex items-center gap-2 p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                              <Clock className="h-4 w-4 text-amber-400" />
                              <span className="text-xs text-amber-400">Aguardando conversão — {daysSince} dias desde captura</span>
                            </div>
                          );
                        }
                      } catch {}
                    }
                    return null;
                  })()}

                  <div><Label>Nome</Label><Input value={editLead.nome || ""} onChange={e => setEditLead({ ...editLead, nome: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Email</Label><Input value={editLead.email || ""} onChange={e => setEditLead({ ...editLead, email: e.target.value })} /></div>
                    <div><Label>Telefone</Label><Input value={editLead.phone || ""} onChange={e => setEditLead({ ...editLead, phone: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Plataforma</Label><Select value={editLead.plataforma || ""} onValueChange={v => setEditLead({ ...editLead, plataforma: v })}><SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger><SelectContent>{PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Status</Label><Select value={editLead.status || "lead"} onValueChange={v => setEditLead({ ...editLead, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                  <div><Label>Tags</Label><EditableTagList tags={editLead.tags || []} onChange={tags => setEditLead({ ...editLead, tags })} /></div>
                  <div><Label>📝 Notas</Label><Textarea value={editLead.data?.notas || ""} onChange={e => setEditLead({ ...editLead, data: { ...editLead.data, notas: e.target.value } })} placeholder="Anotações internas sobre este lead..." className="bg-secondary min-h-[60px]" /></div>

                  {/* Origem do Lead */}
                  <div className="space-y-2 border-t border-border pt-3">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">📍 Origem</p>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div><span className="text-muted-foreground">Projeto:</span> <span className="font-medium">{(() => { const proj = projects.find(p => p.id === editLead.project_id); return proj ? `${proj.icon || "📁"} ${proj.name}` : "—"; })()}</span></div>
                      <div><span className="text-muted-foreground">Formulário:</span> <span className="font-medium">{(() => { const firstForm = formResponses.find(r => r.form_name); return firstForm?.form_name || (editLead.data?.interacoes?.[0]?.form_id ? "Formulário" : "—"); })()}</span></div>
                      <div><span className="text-muted-foreground">Plataforma:</span> <span className="font-medium">{editLead.plataforma || editLead.data?.captura_origem || "—"}</span></div>
                      <div><span className="text-muted-foreground">Captura:</span> <span className="font-medium">{editLead.data?.capturado_em ? (() => { try { const d = parseISO(editLead.data.capturado_em); return isValid(d) ? format(d, "dd/MM/yy HH:mm") : "—"; } catch { return "—"; } })() : (editLead.criado_em ? (() => { try { const d = parseISO(editLead.criado_em!); return isValid(d) ? format(d, "dd/MM/yy HH:mm") : "—"; } catch { return "—"; } })() : "—")}</span></div>
                    </div>
                  </div>

                  {editLead._vendas && editLead._vendas.length > 0 && (
                    <div className="space-y-2 border-t border-border pt-3">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">💰 Dados de Compra</p>
                      {editLead._vendas.map((v, i) => (
                        <div key={v.id || i} className="p-2 bg-secondary/50 rounded-lg space-y-1">
                         <div className="flex items-center justify-between"><span className="text-xs font-medium">{v.produto_nome || "Produto"}</span><span className="text-xs font-mono text-primary">R$ {v.valor.toFixed(2)}</span></div>
                          <div className="flex flex-wrap gap-1">
                            {v.data?.tipo_venda && v.data.tipo_venda !== "principal" && <Badge className="text-[9px] px-1.5 py-0 h-4 bg-violet-500/20 text-violet-400 border-0">{v.data.tipo_venda === "orderbump" ? "Order Bump" : v.data.tipo_venda === "upsell" ? "Upsell" : v.data.tipo_venda === "downsell" ? "Downsell" : v.data.tipo_venda}</Badge>}
                            {v.data?.metodo_pagamento && <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">💳 {v.data.metodo_pagamento}</Badge>}
                            {v.data?.parcelas && v.data.parcelas > 1 && <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">{v.data.parcelas}x</Badge>}
                            {v.data?.bandeira_cartao && <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">{v.data.bandeira_cartao}</Badge>}
                            {v.data?.codigo_pedido && <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">#{v.data.codigo_pedido}</Badge>}
                            {v.data?.valor_liquidado && <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 text-blue-400">Líq: R$ {v.data.valor_liquidado}</Badge>}
                            {v.data?.oferta && <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">{v.data.oferta}</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {(() => { const doc = editLead._vendas?.find(v => v.data?.documento)?.data?.documento || editLead.data?.documento; return doc ? (<div className="space-y-1 border-t border-border pt-3"><p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">🪪 Documento</p><p className="text-sm font-mono">{doc}</p></div>) : null; })()}

                  {editLead.data?.utms && Object.values(editLead.data.utms).some(Boolean) && (
                    <div className="space-y-1 border-t border-border pt-3">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">🔗 UTMs</p>
                      <div className="flex flex-wrap gap-1">{Object.entries(editLead.data.utms).filter(([, v]) => v).map(([k, v]) => <Badge key={k} variant="outline" className="text-[9px] px-1.5 py-0 h-4">{k}: {String(v).substring(0, 30)}</Badge>)}</div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="qualificacao" className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {/* Origem da Captura */}
                  {(editLead.data?.form_name || editLead.data?.form_id || editLead.data?.capturado_em) && (
                    <div className="space-y-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">📍 Origem da Captura</p>
                      <div className="flex flex-wrap gap-2">
                        {editLead.data?.form_name && (
                          <Badge className="text-[10px] bg-primary/20 text-primary border-0">📋 {editLead.data.form_name}</Badge>
                        )}
                        {editLead.data?.captura_form_step && (
                          <Badge variant="outline" className="text-[10px]">Step: {editLead.data.captura_form_step}</Badge>
                        )}
                        {editLead.data?.captura_origem && (
                          <Badge variant="outline" className="text-[10px]">🌐 {editLead.data.captura_origem}</Badge>
                        )}
                        {editLead.data?.capturado_em && (() => {
                          try {
                            const d = new Date(editLead.data.capturado_em);
                            return isValid(d) ? <Badge variant="outline" className="text-[10px]">📅 {format(d, "dd/MM/yyyy HH:mm")}</Badge> : null;
                          } catch { return null; }
                        })()}
                      </div>
                      {/* Tempo até compra */}
                      {editLead.data?.capturado_em && editLead.total_gasto > 0 && editLead._vendas && editLead._vendas.length > 0 && (() => {
                        try {
                          const capturedAt = new Date(editLead.data.capturado_em);
                          const firstSale = editLead._vendas!.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
                          const saleAt = new Date(firstSale.created_at!);
                          if (!isValid(capturedAt) || !isValid(saleAt)) return null;
                          const hours = differenceInHours(saleAt, capturedAt);
                          const days = differenceInDays(saleAt, capturedAt);
                          const label = days > 0 ? `${days}d ${hours % 24}h` : `${hours}h`;
                          return (
                            <div className="flex items-center gap-1.5 mt-1">
                              <Clock className="h-3 w-3 text-primary" />
                              <span className="text-[11px] text-muted-foreground">Tempo até compra:</span>
                              <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400 border-0">{label}</Badge>
                            </div>
                          );
                        } catch { return null; }
                      })()}
                    </div>
                  )}

                  {/* Botão Analisar com IA */}
                  <div className="flex justify-end">
                    <AIGenerateButton
                      projectId={editLead.project_id || ""}
                      action="analyze_lead"
                      label="Analisar Lead com IA"
                      size="sm"
                      variant="outline"
                      showMenteSelector
                      contextSources={["Respostas do formulário", "Histórico de interações", "Score", "Dados do lead"]}
                      fieldsToFill={["Dor Principal", "Nível de Consciência", "Objeções", "Notas"]}
                      extraBody={{
                        lead: {
                          nome: editLead.nome,
                          email: editLead.email,
                          phone: editLead.phone,
                          plataforma: editLead.plataforma,
                          score: editLead.score ?? editLead._score ?? 0,
                          total_gasto: editLead.total_gasto,
                          tags: editLead.tags,
                          data: editLead.data,
                        },
                        form_responses: formResponses,
                        score_log: scoreLog,
                      }}
                      onResult={(data: any) => {
                        if (data?.qualificacao) {
                          setEditLead((prev: any) => ({
                            ...prev,
                            data: {
                              ...prev.data,
                              qualificacao: {
                                ...(prev.data?.qualificacao || {}),
                                ...data.qualificacao,
                              },
                            },
                          }));
                          toast.success("Análise IA preenchida nos campos de qualificação");
                        }
                      }}
                    />
                  </div>

                  {/* Score Detalhado */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">🎯 Score ({editLead.score ?? editLead._score ?? 0}/100)</p>
                    <Progress value={editLead.score ?? editLead._score ?? 0} className="h-2" />
                    {scoreLog.length > 0 && (
                      <div className="space-y-1">
                        {scoreLog.map((s, i) => (
                          <div key={i} className="flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground">{s.acao}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 text-primary">+{s.pontos}</Badge>
                              <span className="text-[9px] text-muted-foreground">{(() => { try { const d = new Date(s.created_at); return isValid(d) ? format(d, "dd/MM HH:mm") : ""; } catch { return ""; } })()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Respostas de Formulários — agrupadas por form */}
                  {formResponses.length > 0 && (
                    <div className="space-y-3 border-t border-border pt-3">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">📋 Respostas de Formulários</p>
                      {(() => {
                        const grouped: Record<string, typeof formResponses> = {};
                        formResponses.forEach(r => {
                          const key = r.form_id || "_sem_form";
                          if (!grouped[key]) grouped[key] = [];
                          grouped[key].push(r);
                        });
                        return Object.entries(grouped).map(([formId, responses]) => {
                          const formName = responses[0]?.form_name || (formId === "_sem_form" ? "Formulário" : `Form ${formId.slice(0, 8)}`);
                          return (
                            <div key={formId} className="space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/20">📋 {formName}</Badge>
                                <span className="text-[9px] text-muted-foreground">{responses.length} respostas</span>
                              </div>
                              {responses.map((r, i) => (
                                <div key={i} className="flex items-start gap-2 text-[11px] pl-2">
                                  <span className="font-medium text-muted-foreground min-w-[80px]">{r.question}</span>
                                  <span className="text-foreground">{r.answer}</span>
                                </div>
                              ))}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}

                  {/* Histórico de Interações */}
                  {editLead.data?.interacoes && editLead.data.interacoes.length > 0 && (
                    <div className="space-y-2 border-t border-border pt-3">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">📊 Histórico de Interações</p>
                      <div className="space-y-1.5">
                        {(editLead.data.interacoes as any[]).map((int: any, i: number) => (
                          <div key={i} className="p-2 bg-secondary/50 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-medium">{int.evento}</span>
                                {int.tipo_venda && int.tipo_venda !== "principal" && (
                                  <Badge className="text-[9px] px-1.5 py-0 h-4 bg-violet-500/20 text-violet-400 border-0">
                                    {int.tipo_venda === "orderbump" ? "Order Bump" : int.tipo_venda === "upsell" ? "Upsell" : int.tipo_venda}
                                  </Badge>
                                )}
                              </div>
                              <span className="text-[9px] text-muted-foreground">{(() => { try { const d = new Date(int.data); return isValid(d) ? format(d, "dd/MM HH:mm") : ""; } catch { return ""; } })()}</span>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {int.produto && <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">{int.produto}</Badge>}
                              {int.valor && <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 text-primary">R$ {int.valor}</Badge>}
                              {int.plataforma && <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">{int.plataforma}</Badge>}
                              {int.utms?.utm_source && <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">src: {int.utms.utm_source}</Badge>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Campos Manuais */}
                  <div className="border-t border-border pt-3 space-y-3">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">✏️ Qualificação Manual</p>
                    <div><Label>Dor Principal</Label><Textarea value={editLead.data?.qualificacao?.dor_principal || ""} onChange={e => setEditLead({ ...editLead, data: { ...editLead.data, qualificacao: { ...(editLead.data?.qualificacao || {}), dor_principal: e.target.value } } })} placeholder="Qual a maior dor/frustração deste lead?" className="bg-secondary min-h-[60px]" /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Nível de Consciência</Label><Select value={editLead.data?.qualificacao?.nivel_consciencia || ""} onValueChange={v => setEditLead({ ...editLead, data: { ...editLead.data, qualificacao: { ...(editLead.data?.qualificacao || {}), nivel_consciencia: v } } })}><SelectTrigger className="bg-secondary"><SelectValue placeholder="Selecionar..." /></SelectTrigger><SelectContent><SelectItem value="inconsciente">Inconsciente</SelectItem><SelectItem value="problema">Consciente do Problema</SelectItem><SelectItem value="solucao">Consciente da Solução</SelectItem><SelectItem value="produto">Consciente do Produto</SelectItem><SelectItem value="totalmente">Totalmente Consciente</SelectItem></SelectContent></Select></div>
                      <div><Label>Renda Estimada</Label><Select value={editLead.data?.qualificacao?.renda || ""} onValueChange={v => setEditLead({ ...editLead, data: { ...editLead.data, qualificacao: { ...(editLead.data?.qualificacao || {}), renda: v } } })}><SelectTrigger className="bg-secondary"><SelectValue placeholder="Selecionar..." /></SelectTrigger><SelectContent><SelectItem value="ate3k">Até R$3k</SelectItem><SelectItem value="3k-8k">R$3k — R$8k</SelectItem><SelectItem value="8k-15k">R$8k — R$15k</SelectItem><SelectItem value="15k-30k">R$15k — R$30k</SelectItem><SelectItem value="30k+">R$30k+</SelectItem></SelectContent></Select></div>
                    </div>
                    <div><Label>Canal Principal</Label><Select value={editLead.data?.qualificacao?.canal || ""} onValueChange={v => setEditLead({ ...editLead, data: { ...editLead.data, qualificacao: { ...(editLead.data?.qualificacao || {}), canal: v } } })}><SelectTrigger className="bg-secondary"><SelectValue placeholder="Selecionar..." /></SelectTrigger><SelectContent><SelectItem value="instagram">Instagram</SelectItem><SelectItem value="youtube">YouTube</SelectItem><SelectItem value="tiktok">TikTok</SelectItem><SelectItem value="google">Google</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="indicacao">Indicação</SelectItem></SelectContent></Select></div>
                    <div><Label>Objeções</Label><EditableTagList tags={editLead.data?.qualificacao?.objecoes || []} onChange={tags => setEditLead({ ...editLead, data: { ...editLead.data, qualificacao: { ...(editLead.data?.qualificacao || {}), objecoes: tags } } })} /></div>
                    <div><Label>Notas do Vendedor</Label><Textarea value={editLead.data?.qualificacao?.notas_vendedor || ""} onChange={e => setEditLead({ ...editLead, data: { ...editLead.data, qualificacao: { ...(editLead.data?.qualificacao || {}), notas_vendedor: e.target.value } } })} placeholder="Observações internas sobre este lead..." className="bg-secondary min-h-[60px]" /></div>
                  </div>
                </TabsContent>

                <TabsContent value="jornada">
                  {timelineLoading ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Carregando jornada...</p>
                  ) : timeline.length === 0 ? (
                    <div className="text-center py-8 space-y-2"><Globe className="h-8 w-8 text-muted-foreground/30 mx-auto" /><p className="text-sm text-muted-foreground">Nenhum evento registrado</p><p className="text-[10px] text-muted-foreground">Instale o script imptrack.js para rastrear a jornada</p></div>
                  ) : (
                    <div className="relative max-h-[400px] overflow-y-auto pr-2">
                      <div className="absolute left-[15px] top-0 bottom-0 w-px bg-border" />
                      <div className="space-y-3">
                        {timeline.map((ev) => {
                          const config = EVENT_CONFIG[ev.type] || { icon: <Zap className="h-3 w-3" />, color: "bg-muted-foreground", label: ev.type };
                          return (
                            <div key={ev.id} className="flex gap-3 relative">
                              <div className={`h-[30px] w-[30px] rounded-full ${config.color} flex items-center justify-center text-white shrink-0 z-10`}>{config.icon}</div>
                              <div className="flex-1 min-w-0 pb-1">
                                <div className="flex items-center gap-2"><span className="text-xs font-medium">{config.label}</span><span className="text-[10px] text-muted-foreground">{(() => { try { const d = new Date(ev.timestamp); return isValid(d) ? format(d, "dd/MM HH:mm") : ""; } catch { return ""; } })()}</span></div>
                                {ev.subtitle && <p className="text-[11px] text-muted-foreground truncate">{ev.subtitle}</p>}
                                {ev.details && Object.keys(ev.details).filter(k => ev.details![k]).length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">{Object.entries(ev.details).filter(([, v]) => v).slice(0, 4).map(([k, v]) => <Badge key={k} variant="outline" className="text-[9px] px-1.5 py-0 h-4">{k}: {String(v).substring(0, 30)}</Badge>)}</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="automacoes" className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">⚡ Disparar Automação</p>
                    {(() => {
                      const filteredAutos = editLead?.project_id
                        ? automations.filter(a => !a.project_id || a.project_id === editLead.project_id)
                        : automations;
                      return filteredAutos.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          {editLead?.project_id ? "Nenhuma automação para este projeto. Crie em OpenFlow." : "Nenhuma automação cadastrada. Crie em OpenFlow."}
                        </p>
                      ) : (
                        <>
                          {!editLead?.project_id && <p className="text-[10px] text-amber-400">⚠️ Lead sem projeto — mostrando todas as automações</p>}
                          <div className="grid grid-cols-2 gap-2">
                            {filteredAutos.map(a => (
                              <Button key={a.id} size="sm" variant="outline" className="text-xs justify-start" onClick={() => editLead && triggerAutomation(editLead, a)}>
                                <Play className="h-3 w-3 mr-1" /> {a.nome}
                              </Button>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <div className="space-y-2 border-t border-border pt-3">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">📋 Histórico de Ações</p>
                    {leadAutomationLogs.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">Nenhuma ação registrada para este lead</p>
                    ) : (
                      <div className="space-y-2 max-h-[250px] overflow-y-auto">
                        {leadAutomationLogs.map(log => (
                          <div key={log.id} className="p-2 bg-secondary/50 rounded-lg">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium">{log.action}</span>
                              <span className="text-[10px] text-muted-foreground">{log.created_at ? (() => { try { const d = new Date(log.created_at); return isValid(d) ? format(d, "dd/MM HH:mm") : ""; } catch { return ""; } })() : ""}</span>
                            </div>
                            {log.details && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {Object.entries(log.details as Record<string, any>).filter(([, v]) => v).map(([k, v]) => (
                                  <Badge key={k} variant="outline" className="text-[9px] px-1.5 py-0 h-4">{k}: {String(v).substring(0, 25)}</Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            )}
            <DialogFooter className="flex justify-between">
              <Button variant="destructive" size="sm" onClick={() => editLead && setDeleteConfirm(editLead.id)}><Trash2 className="h-3 w-3 mr-1" /> Excluir</Button>
              <Button onClick={saveEdit}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteConfirm} onOpenChange={(v) => !v && setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Excluir Lead?</AlertDialogTitle><AlertDialogDescription>Isso irá remover o lead e todas as vendas associadas permanentemente.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteConfirm && deleteLead(deleteConfirm)}>Excluir permanentemente</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Delete */}
        <AlertDialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Excluir {selectedIds.size} leads?</AlertDialogTitle><AlertDialogDescription>Isso irá remover {selectedIds.size} lead{selectedIds.size > 1 ? "s" : ""} e todas as vendas associadas permanentemente.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={deleteSelected}>Excluir {selectedIds.size} leads</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <LeadImportDialog open={showImport} onOpenChange={setShowImport} projects={projects} defaultProjectId={projectFilter !== "all" && projectFilter !== "none" ? projectFilter : undefined} onComplete={load} />
      </div>
    </div>
  );
}

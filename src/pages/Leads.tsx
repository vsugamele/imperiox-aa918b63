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
import { EditableTagList } from "@/components/projeto/EditableTagList";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, LineChart, Line, ResponsiveContainer, CartesianGrid, Tooltip, Cell } from "recharts";
import { Search, MessageCircle, Plus, Trash2, Users, UserCheck, Crown, DollarSign, RefreshCw, Radio, Eye, ShoppingCart, MousePointerClick, Globe, Zap, FileUp, AlertCircle, Package, X, BarChart3, Mail, Send, Play } from "lucide-react";
import { toast } from "sonner";
import { format, isToday, startOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LeadImportDialog } from "@/components/leads/LeadImportDialog";

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
  id: string; produto_nome?: string; valor: number; plataforma?: string; status?: string; data?: any;
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
  type: "PageView" | "LeadCapture" | "ViewContent" | "AddToCart" | "Purchase" | "click" | "CSVImport" | string;
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
};

const FUNNEL_COLORS = ["hsl(var(--primary))", "#f59e0b", "#ef4444", "#10b981"];

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
  const [allVendasRaw, setAllVendasRaw] = useState<any[]>([]);
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
    const [leadsRes, projRes, vendasRes, autoRes] = await Promise.all([
      supabase.from("imphq_leads").select("*").order("criado_em", { ascending: false }),
      supabase.from("imphq_projects").select("id, name, icon"),
      supabase.from("imphq_vendas").select("id, lead_id, produto_nome, valor, plataforma, status, data").order("created_at", { ascending: false }),
      supabase.from("imphq_automacoes").select("*").order("created_at", { ascending: false }),
    ]);
    const allVendas = (vendasRes.data || []) as any[];
    setAllVendasRaw(allVendas);
    const vendasByLead = new Map<string, LeadVenda[]>();
    allVendas.forEach((v: any) => {
      if (!v.lead_id) return;
      if (!vendasByLead.has(v.lead_id)) vendasByLead.set(v.lead_id, []);
      vendasByLead.get(v.lead_id)!.push({ id: v.id, produto_nome: v.produto_nome, valor: parseFloat(v.valor) || 0, plataforma: v.plataforma, status: v.status, data: v.data });
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
    const events: TimelineEvent[] = [];
    const visitorId = lead.data?.visitor_id;
    const promises: Promise<any>[] = [];

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
            events.push({ id: v.id, type: "Purchase", timestamp: v.created_at, title: `Compra: ${v.produto || "—"}`, subtitle: `R$ ${parseFloat(v.valor || 0).toFixed(2)} via ${v.plataforma || "—"}`, details: { status: v.status } });
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

    // Load automation logs for this lead
    promises.push(
      Promise.resolve(supabase.from("imphq_activity_log").select("*").eq("lead_id", lead.id).order("created_at", { ascending: false }).limit(50))
        .then(({ data }) => { setLeadAutomationLogs(data || []); })
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

  // Quick action: trigger automation for lead
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
      // Log the action
      await supabase.from("imphq_activity_log").insert({
        id: crypto.randomUUID(),
        action: "automacao_executada",
        entity_type: "lead",
        entity_id: lead.id,
        lead_id: lead.id,
        details: { automacao_nome: auto.nome, automacao_id: auto.id },
      });
      toast.success(`Automação "${auto.nome}" executada para ${lead.nome || lead.email}`);
    } catch (err: any) {
      toast.error("Erro ao executar automação: " + err.message);
    }
  };

  // Quick action: send email
  const sendQuickEmail = async (lead: Lead) => {
    if (!lead.email || !lead.project_id) { toast.error("Lead precisa ter email e projeto"); return; }
    const { data: proj } = await supabase.from("imphq_projects").select("data").eq("id", lead.project_id).single();
    const templates = (proj?.data as any)?.email_config?.templates || [];
    if (templates.length === 0) { toast.error("Nenhum template de email configurado neste projeto"); return; }
    const { error } = await supabase.functions.invoke("send-project-email", {
      body: { project_id: lead.project_id, template_id: templates[0].id, to_email: lead.email },
    });
    if (error) { toast.error("Erro: " + error.message); return; }
    await supabase.from("imphq_activity_log").insert({
      id: crypto.randomUUID(), action: "email_enviado", entity_type: "lead", entity_id: lead.id, lead_id: lead.id,
      details: { template: templates[0].name, to: lead.email },
    });
    toast.success(`Email enviado para ${lead.email}`);
  };

  const sendQuickWhatsApp = async (lead: Lead) => {
    if (!lead.phone) { toast.error("Lead sem telefone"); return; }
    window.open(`https://wa.me/${lead.phone.replace(/\D/g, "")}`, "_blank");
  };

  // ── Analytics data ──
  const leadsByProject = useMemo(() => {
    const map = new Map<string, number>();
    leads.forEach(l => {
      const name = getProjectName(l.project_id) || "Sem Projeto";
      map.set(name, (map.get(name) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name: name.substring(0, 20), count })).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [leads, projects]);

  const leadsByMonth = useMemo(() => {
    const map = new Map<string, number>();
    leads.forEach(l => {
      if (!l.criado_em) return;
      try {
        const d = parseISO(l.criado_em);
        const key = format(d, "MMM/yy", { locale: ptBR });
        map.set(key, (map.get(key) || 0) + 1);
      } catch {}
    });
    return Array.from(map.entries()).map(([month, count]) => ({ month, count })).reverse().slice(-12);
  }, [leads]);

  const funnelData = useMemo(() => {
    const stages = { lead_capturado: 0, carrinho_abandonado: 0, pix_gerado: 0, compra_aprovada: 0 };
    leads.forEach(l => {
      const stage = getLeadStage(l);
      if (stage in stages) (stages as any)[stage]++;
    });
    return [
      { stage: "Leads", value: stages.lead_capturado, fill: "hsl(var(--primary))" },
      { stage: "Carrinho", value: stages.carrinho_abandonado, fill: "#f59e0b" },
      { stage: "Pix", value: stages.pix_gerado, fill: "#ef4444" },
      { stage: "Clientes", value: stages.compra_aprovada, fill: "#10b981" },
    ];
  }, [leads]);

  const revenueByProject = useMemo(() => {
    const map = new Map<string, number>();
    leads.forEach(l => {
      if (!l.total_gasto || l.total_gasto <= 0) return;
      const name = getProjectName(l.project_id) || "Sem Projeto";
      map.set(name, (map.get(name) || 0) + parseFloat(String(l.total_gasto)));
    });
    return Array.from(map.entries()).map(([name, revenue]) => ({ name: name.substring(0, 20), revenue: Math.round(revenue) })).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [leads, projects]);

  // ── Pix Hoje ──
  const pixHoje = useMemo(() => {
    return leads.filter(l => {
      const stage = getLeadStage(l);
      if (!["pix_gerado", "aguardando_pagamento"].includes(stage)) return false;
      if (!l.criado_em) return true; // show anyway
      try { return isToday(parseISO(l.criado_em)); } catch { return false; }
    });
  }, [leads]);

  // Products filtered by selected project
  const filteredProducts = useMemo(() => {
    if (projectFilter === "all" || projectFilter === "none") return products;
    const projectLeadIdsSet = new Set(leads.filter(l => l.project_id === projectFilter).map(l => l.id));
    const projectProducts = [...new Set(
      allVendasRaw.filter(v => v.lead_id && projectLeadIdsSet.has(v.lead_id) && v.produto_nome).map(v => v.produto_nome)
    )];
    return projectProducts as string[];
  }, [projectFilter, leads, allVendasRaw, products]);

  const chartConfig = {
    count: { label: "Leads", color: "hsl(var(--primary))" },
    revenue: { label: "Receita", color: "hsl(var(--primary))" },
    value: { label: "Qtd", color: "hsl(var(--primary))" },
  };

  return (
    <div className="flex gap-6">
      {/* Project Sidebar */}
      <div className="w-48 shrink-0 hidden lg:block">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="font-display text-sm font-bold text-primary">Leads</h2>
          {realtimeActive && <Radio className="h-3 w-3 text-emerald-400 animate-pulse" />}
        </div>
        <p className="text-[10px] text-muted-foreground mb-3">{leads.length} total</p>
        <div className="space-y-0.5">
          <button className={cn("w-full text-left text-xs px-2 py-1.5 rounded transition-colors", projectFilter === "all" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground")} onClick={() => setProjectFilter("all")}>🌐 Todos os leads</button>
          <button className={cn("w-full text-left text-xs px-2 py-1.5 rounded transition-colors", projectFilter === "none" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground")} onClick={() => setProjectFilter("none")}>📂 Sem projeto</button>
          {projects.map(p => {
            const count = leads.filter(l => l.project_id === p.id).length;
            if (count === 0) return null;
            return (
              <button key={p.id} className={cn("w-full text-left text-xs px-2 py-1.5 rounded transition-colors truncate", projectFilter === p.id ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground")} onClick={() => setProjectFilter(p.id)}>
                {p.icon || "📁"} {p.name} <span className="text-muted-foreground">({count})</span>
              </button>
            );
          })}
        </div>

        {filteredProducts.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1"><Package className="h-3 w-3" /> Produtos</p>
            <div className="space-y-0.5">
              <button className={cn("w-full text-left text-xs px-2 py-1.5 rounded transition-colors", productFilter === "all" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground")} onClick={() => setProductFilter("all")}>📦 Todos</button>
              {filteredProducts.map(prod => (
                <button key={prod} className={cn("w-full text-left text-xs px-2 py-1.5 rounded transition-colors truncate", productFilter === prod ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground")} onClick={() => setProductFilter(prod)} title={prod}>🏷️ {prod}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 space-y-4 min-w-0">
        {/* Main Tabs: Leads / Analytics */}
        <Tabs value={mainTab} onValueChange={setMainTab}>
          <div className="flex items-center gap-3 flex-wrap">
            <TabsList>
              <TabsTrigger value="leads" className="text-xs">📋 Leads</TabsTrigger>
              <TabsTrigger value="analytics" className="text-xs">📊 Analytics</TabsTrigger>
              {pixHoje.length > 0 && (
                <TabsTrigger value="pix_hoje" className="text-xs relative">
                  💰 Pix Hoje
                  <span className="ml-1 bg-orange-500 text-white text-[9px] font-bold rounded-full px-1.5 animate-pulse">{pixHoje.length}</span>
                </TabsTrigger>
              )}
            </TabsList>
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowImport(true)}><FileUp className="h-4 w-4 mr-1" /> Importar</Button>
              <Button size="sm" onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" /> Novo Lead</Button>
            </div>
          </div>

          {/* ═══ TAB: LEADS ═══ */}
          <TabsContent value="leads" className="space-y-4">
            {/* Filters */}
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
              <p className="text-sm font-medium">{projectFilter === "all" ? "Todos os Leads" : projectFilter === "none" ? "Sem Projeto" : getProjectName(projectFilter) || "Leads"}</p>
              <p className="text-xs text-muted-foreground">{filtered.length} de {leads.length} leads</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <Card className={cn("bg-card border-border cursor-pointer transition-all hover:ring-1 hover:ring-primary/40", stageFilter === "all" && statusFilter === "all" && "ring-1 ring-primary/30")} onClick={() => { setStageFilter("all"); setStatusFilter("all"); }}>
                <CardContent className="p-3 flex items-center gap-3"><Users className="h-4 w-4 text-muted-foreground" /><div><p className="text-xl font-bold">{totalLeads}</p><p className="text-[10px] text-muted-foreground">Total Leads</p></div></CardContent>
              </Card>
              <Card className={cn("bg-card border-border cursor-pointer transition-all hover:ring-1 hover:ring-emerald-500/40", statusFilter === "cliente" && "ring-1 ring-emerald-500/50")} onClick={() => { setStatusFilter("cliente"); setStageFilter("all"); }}>
                <CardContent className="p-3 flex items-center gap-3"><UserCheck className="h-4 w-4 text-emerald-400" /><div><p className="text-xl font-bold">{clientes}</p><p className="text-[10px] text-muted-foreground">Clientes</p></div></CardContent>
              </Card>
              <Card className={cn("bg-card border-border cursor-pointer transition-all hover:ring-1 hover:ring-amber-500/40", stageFilter === "carrinho_abandonado" && "ring-1 ring-amber-500/50")} onClick={() => { setStageFilter("carrinho_abandonado"); setStatusFilter("all"); }}>
                <CardContent className="p-3 flex items-center gap-3"><ShoppingCart className="h-4 w-4 text-amber-400" /><div><p className="text-xl font-bold">{leads.filter(l => getLeadStage(l) === "carrinho_abandonado").length}</p><p className="text-[10px] text-muted-foreground">Carrinho</p></div></CardContent>
              </Card>
              <Card className={cn("bg-card border-border cursor-pointer transition-all hover:ring-1 hover:ring-orange-500/40", stageFilter === "pix_gerado" && "ring-1 ring-orange-500/50")} onClick={() => { setStageFilter("pix_gerado"); setStatusFilter("all"); }}>
                <CardContent className="p-3 flex items-center gap-3"><AlertCircle className="h-4 w-4 text-orange-400" /><div><p className="text-xl font-bold">{leads.filter(l => ["aguardando_pagamento", "pix_gerado"].includes(getLeadStage(l))).length}</p><p className="text-[10px] text-muted-foreground">Pix Pendente</p></div></CardContent>
              </Card>
              <Card className={cn("bg-card border-border cursor-pointer transition-all hover:ring-1 hover:ring-accent/40", statusFilter === "vip" && "ring-1 ring-accent/50")} onClick={() => { setStatusFilter("vip"); setStageFilter("all"); }}>
                <CardContent className="p-3 flex items-center gap-3"><Crown className="h-4 w-4 text-accent" /><div><p className="text-xl font-bold">{vips}</p><p className="text-[10px] text-muted-foreground">VIP</p></div></CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-3 flex items-center gap-3"><DollarSign className="h-4 w-4 text-primary" /><div><p className="text-xl font-bold font-mono text-primary">R$ {totalReceita.toFixed(0)}</p><p className="text-[10px] text-muted-foreground">Receita</p></div></CardContent>
              </Card>
            </div>

            {/* Table */}
            <div className="rounded-lg border border-border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"><Checkbox checked={allFilteredSelected} onCheckedChange={toggleSelectAll} /></TableHead>
                    <TableHead>Lead</TableHead>
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
                      <TableCell>{(() => { const vendas = l._vendas || []; const prods = [...new Set(vendas.map(v => v.produto_nome).filter(Boolean))]; if (prods.length === 0) return <span className="text-xs text-muted-foreground">—</span>; return <span className="text-xs text-primary truncate max-w-[100px] block" title={prods.join(", ")}>{prods[0]}{prods.length > 1 ? ` +${prods.length - 1}` : ""}</span>; })()}</TableCell>
                      <TableCell>{(() => { const vendas = l._vendas || []; const pgto = vendas.find(v => v.data?.metodo_pagamento)?.data?.metodo_pagamento; return pgto ? <span className="text-[10px] text-muted-foreground">{pgto}</span> : <span className="text-xs text-muted-foreground">—</span>; })()}</TableCell>
                      <TableCell>{(() => { const stage = getLeadStage(l); const cfg = STAGE_LABELS[stage] || STAGE_LABELS.lead_capturado; const isPending = ["carrinho_abandonado", "pix_gerado", "aguardando_pagamento"].includes(stage); return (<div className="flex items-center gap-1"><Badge className={cn("text-[10px]", cfg.color, isPending && "animate-pulse ring-1 ring-amber-500/40")}>{cfg.label}</Badge>{isPending && <AlertCircle className="h-3 w-3 text-amber-400" />}</div>); })()}</TableCell>
                      <TableCell><div className="flex items-center gap-1.5"><div className="w-12 h-1.5 bg-secondary rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${l._score || 0}%` }} /></div><span className="text-[10px] font-mono text-muted-foreground">{l._score || 0}</span></div></TableCell>
                      <TableCell className="font-mono text-sm text-primary">{l.total_gasto ? `R$ ${parseFloat(String(l.total_gasto)).toFixed(0)}` : "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{l.criado_em ? format(new Date(l.criado_em), "dd/MM/yy") : "—"}</TableCell>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Leads por Projeto */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-2"><CardTitle className="text-sm">📊 Leads por Projeto</CardTitle></CardHeader>
                <CardContent>
                  {leadsByProject.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p> : (
                    <ChartContainer config={chartConfig} className="h-[250px] w-full">
                      <BarChart data={leadsByProject} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                        <XAxis type="number" className="text-[10px]" />
                        <YAxis dataKey="name" type="category" width={100} className="text-[10px]" tick={{ fontSize: 10 }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              {/* Leads por Mês */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-2"><CardTitle className="text-sm">📈 Leads por Mês</CardTitle></CardHeader>
                <CardContent>
                  {leadsByMonth.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p> : (
                    <ChartContainer config={chartConfig} className="h-[250px] w-full">
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

              {/* Funil de Conversão */}
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

              {/* Receita por Projeto */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-2"><CardTitle className="text-sm">💰 Receita por Projeto</CardTitle></CardHeader>
                <CardContent>
                  {revenueByProject.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Sem receita registrada</p> : (
                    <ChartContainer config={chartConfig} className="h-[250px] w-full">
                      <BarChart data={revenueByProject} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                        <XAxis type="number" className="text-[10px]" tickFormatter={(v) => `R$${v}`} />
                        <YAxis dataKey="name" type="category" width={100} className="text-[10px]" tick={{ fontSize: 10 }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="revenue" fill="#10b981" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>
            </div>
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
                  const produto = vendas.find(v => v.produto_nome)?.produto_nome || "—";
                  const valor = vendas.reduce((s, v) => s + v.valor, 0);
                  return (
                    <Card key={l.id} className="bg-card border-border border-l-4 border-l-orange-500">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar className="h-10 w-10 bg-secondary shrink-0"><AvatarFallback className="font-bold bg-secondary text-foreground">{(l.nome || "?")[0].toUpperCase()}</AvatarFallback></Avatar>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{l.nome}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{l.email || "—"} • {l.phone || "sem tel."}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge variant="outline" className="text-[9px]">{produto}</Badge>
                                {valor > 0 && <span className="text-xs font-mono text-primary">R$ {valor.toFixed(2)}</span>}
                                {l.criado_em && <span className="text-[9px] text-muted-foreground">{format(new Date(l.criado_em), "HH:mm")}</span>}
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
                    <div><p className="font-medium">{editLead.nome}</p><p className="text-xs text-muted-foreground">{editLead.email}</p></div>
                  </div>
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

                  {editLead._vendas && editLead._vendas.length > 0 && (
                    <div className="space-y-2 border-t border-border pt-3">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">💰 Dados de Compra</p>
                      {editLead._vendas.map((v, i) => (
                        <div key={v.id || i} className="p-2 bg-secondary/50 rounded-lg space-y-1">
                          <div className="flex items-center justify-between"><span className="text-xs font-medium">{v.produto_nome || "Produto"}</span><span className="text-xs font-mono text-primary">R$ {v.valor.toFixed(2)}</span></div>
                          <div className="flex flex-wrap gap-1">
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

                <TabsContent value="qualificacao" className="space-y-3">
                  <div><Label>Dor Principal</Label><Textarea value={editLead.data?.qualificacao?.dor_principal || ""} onChange={e => setEditLead({ ...editLead, data: { ...editLead.data, qualificacao: { ...(editLead.data?.qualificacao || {}), dor_principal: e.target.value } } })} placeholder="Qual a maior dor/frustração deste lead?" className="bg-secondary min-h-[60px]" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Nível de Consciência</Label><Select value={editLead.data?.qualificacao?.nivel_consciencia || ""} onValueChange={v => setEditLead({ ...editLead, data: { ...editLead.data, qualificacao: { ...(editLead.data?.qualificacao || {}), nivel_consciencia: v } } })}><SelectTrigger className="bg-secondary"><SelectValue placeholder="Selecionar..." /></SelectTrigger><SelectContent><SelectItem value="inconsciente">Inconsciente</SelectItem><SelectItem value="problema">Consciente do Problema</SelectItem><SelectItem value="solucao">Consciente da Solução</SelectItem><SelectItem value="produto">Consciente do Produto</SelectItem><SelectItem value="totalmente">Totalmente Consciente</SelectItem></SelectContent></Select></div>
                    <div><Label>Renda Estimada</Label><Select value={editLead.data?.qualificacao?.renda || ""} onValueChange={v => setEditLead({ ...editLead, data: { ...editLead.data, qualificacao: { ...(editLead.data?.qualificacao || {}), renda: v } } })}><SelectTrigger className="bg-secondary"><SelectValue placeholder="Selecionar..." /></SelectTrigger><SelectContent><SelectItem value="ate3k">Até R$3k</SelectItem><SelectItem value="3k-8k">R$3k — R$8k</SelectItem><SelectItem value="8k-15k">R$8k — R$15k</SelectItem><SelectItem value="15k-30k">R$15k — R$30k</SelectItem><SelectItem value="30k+">R$30k+</SelectItem></SelectContent></Select></div>
                  </div>
                  <div><Label>Canal Principal</Label><Select value={editLead.data?.qualificacao?.canal || ""} onValueChange={v => setEditLead({ ...editLead, data: { ...editLead.data, qualificacao: { ...(editLead.data?.qualificacao || {}), canal: v } } })}><SelectTrigger className="bg-secondary"><SelectValue placeholder="Selecionar..." /></SelectTrigger><SelectContent><SelectItem value="instagram">Instagram</SelectItem><SelectItem value="youtube">YouTube</SelectItem><SelectItem value="tiktok">TikTok</SelectItem><SelectItem value="google">Google</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="indicacao">Indicação</SelectItem></SelectContent></Select></div>
                  <div><Label>Objeções</Label><EditableTagList tags={editLead.data?.qualificacao?.objecoes || []} onChange={tags => setEditLead({ ...editLead, data: { ...editLead.data, qualificacao: { ...(editLead.data?.qualificacao || {}), objecoes: tags } } })} /></div>
                  <div><Label>Notas do Vendedor</Label><Textarea value={editLead.data?.qualificacao?.notas_vendedor || ""} onChange={e => setEditLead({ ...editLead, data: { ...editLead.data, qualificacao: { ...(editLead.data?.qualificacao || {}), notas_vendedor: e.target.value } } })} placeholder="Observações internas sobre este lead..." className="bg-secondary min-h-[60px]" /></div>
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
                                <div className="flex items-center gap-2"><span className="text-xs font-medium">{config.label}</span><span className="text-[10px] text-muted-foreground">{format(new Date(ev.timestamp), "dd/MM HH:mm")}</span></div>
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

                {/* ═══ TAB: AUTOMAÇÕES do Lead ═══ */}
                <TabsContent value="automacoes" className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">⚡ Disparar Automação</p>
                    {automations.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhuma automação cadastrada. Crie em OpenFlow.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {automations.map(a => (
                          <Button key={a.id} size="sm" variant="outline" className="text-xs justify-start" onClick={() => editLead && triggerAutomation(editLead, a)}>
                            <Play className="h-3 w-3 mr-1" /> {a.nome}
                          </Button>
                        ))}
                      </div>
                    )}
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
                              <span className="text-[10px] text-muted-foreground">{log.created_at ? format(new Date(log.created_at), "dd/MM HH:mm") : ""}</span>
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

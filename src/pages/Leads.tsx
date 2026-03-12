import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EditableTagList } from "@/components/projeto/EditableTagList";
import { Search, MessageCircle, Plus, Trash2, Pencil, Users, UserCheck, Crown, DollarSign, RefreshCw, Webhook, Radio, Eye, ShoppingCart, MousePointerClick, Globe, Zap } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  lead: "bg-primary/20 text-primary",
  cliente: "bg-emerald-500/20 text-emerald-400",
  vip: "bg-accent/20 text-accent-foreground",
  inativo: "bg-muted text-muted-foreground",
};
const STATUSES = ["lead", "cliente", "vip", "inativo"];
const PLATFORMS = ["Meta", "Google", "TikTok", "Hotmart", "Kiwify", "Ticto", "Orgânico", "Indicação"];

interface Lead {
  id: string; nome?: string; phone?: string; email?: string; project_id?: string;
  funil_id?: string; plataforma?: string; status?: string; score?: number;
  tags?: string[]; total_gasto?: number; data?: any; criado_em?: string;
  _isNew?: boolean;
}

interface TimelineEvent {
  id: string;
  type: "PageView" | "LeadCapture" | "ViewContent" | "AddToCart" | "Purchase" | "click" | string;
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
};

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
  const projectFilterRef = useRef(projectFilter);
  projectFilterRef.current = projectFilter;

  const load = async () => {
    const [leadsRes, projRes] = await Promise.all([
      supabase.from("imphq_leads").select("*").order("criado_em", { ascending: false }),
      supabase.from("imphq_projects").select("id, name, icon"),
    ]);
    setLeads((leadsRes.data || []) as Lead[]);
    setProjects(projRes.data || []);
  };

  useEffect(() => { load(); }, []);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("leads-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "imphq_leads" },
        (payload) => {
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
        }
      )
      .subscribe((status) => {
        setRealtimeActive(status === "SUBSCRIBED");
      });
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Load timeline when editLead changes
  const loadTimeline = async (lead: Lead) => {
    setTimelineLoading(true);
    setTimeline([]);
    const events: TimelineEvent[] = [];
    const visitorId = lead.data?.visitor_id;

    const promises: Promise<any>[] = [];

    // Events from imphq_events (by visitor_id or email)
    if (visitorId) {
      promises.push(
        supabase.from("imphq_events").select("*").eq("visitor_id", visitorId).order("created_at", { ascending: false }).limit(100)
          .then(({ data }) => {
            (data || []).forEach((e: any) => {
              events.push({
                id: e.id,
                type: e.event_name || "PageView",
                timestamp: e.created_at,
                title: e.event_name || "Evento",
                subtitle: e.page_url ? new URL(e.page_url).pathname : undefined,
                details: { ...e.event_data, utm_source: e.utm_source, utm_medium: e.utm_medium, utm_campaign: e.utm_campaign },
              });
            });
          })
      );
    }

    // Sales from imphq_vendas
    promises.push(
      supabase.from("imphq_vendas").select("*").eq("lead_id", lead.id).order("created_at", { ascending: false })
        .then(({ data }) => {
          (data || []).forEach((v: any) => {
            events.push({
              id: v.id,
              type: "Purchase",
              timestamp: v.created_at,
              title: `Compra: ${v.produto || "—"}`,
              subtitle: `R$ ${parseFloat(v.valor || 0).toFixed(2)} via ${v.plataforma || "—"}`,
              details: { status: v.status },
            });
          });
        })
    );

    // Clicks from imphq_clicks (by email match in lead data utms)
    if (lead.email) {
      promises.push(
        supabase.from("imphq_clicks").select("*").order("created_at", { ascending: false }).limit(50)
          .then(({ data }) => {
            // Only include clicks that match visitor_id in the page_url or user_agent
            // Since clicks don't have visitor_id, we include recent ones if UTMs match
            const leadUtmSource = lead.data?.utms?.utm_source;
            (data || []).forEach((c: any) => {
              if (leadUtmSource && c.utm_source === leadUtmSource) {
                events.push({
                  id: c.id,
                  type: "click",
                  timestamp: c.created_at,
                  title: "Click UTM",
                  subtitle: c.page_url ? new URL(c.page_url).pathname : c.utm_campaign,
                  details: { utm_source: c.utm_source, utm_medium: c.utm_medium, utm_campaign: c.utm_campaign },
                });
              }
            });
          })
      );
    }

    await Promise.all(promises);

    // Sort by timestamp desc
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
    return matchSearch && matchStatus && matchPlatform && matchProject;
  });

  const totalLeads = leads.length;
  const clientes = leads.filter(l => l.status === "cliente").length;
  const vips = leads.filter(l => l.status === "vip").length;
  const totalReceita = leads.reduce((s, l) => s + (parseFloat(String(l.total_gasto)) || 0), 0);

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
    const { error } = await supabase.from("imphq_leads").update({
      nome: editLead.nome, email: editLead.email, phone: editLead.phone,
      plataforma: editLead.plataforma, status: editLead.status, tags: editLead.tags,
    }).eq("id", editLead.id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Lead atualizado!"); setEditLead(null); load();
  };

  const deleteLead = async (id: string) => {
    await supabase.from("imphq_leads").delete().eq("id", id);
    toast.success("Lead removido"); setEditLead(null); load();
  };

  const getProjectName = (pid?: string) => {
    if (!pid) return null;
    const p = projects.find(pr => pr.id === pid);
    return p ? `${p.icon || "📁"} ${p.name}` : null;
  };

  return (
    <div className="flex gap-6">
      {/* Project Sidebar */}
      <div className="w-48 shrink-0 hidden lg:block">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="font-display text-sm font-bold text-primary">Leads</h2>
          {realtimeActive && (
            <div className="flex items-center gap-1" title="Realtime ativo">
              <Radio className="h-3 w-3 text-emerald-400 animate-pulse" />
            </div>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mb-3">{leads.length} total</p>
        <div className="space-y-0.5">
          <button
            className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors ${projectFilter === "all" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setProjectFilter("all")}
          >
            🌐 Todos os leads
          </button>
          <button
            className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors ${projectFilter === "none" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setProjectFilter("none")}
          >
            📂 Sem projeto
          </button>
          {projects.map(p => {
            const count = leads.filter(l => l.project_id === p.id).length;
            if (count === 0) return null;
            return (
              <button
                key={p.id}
                className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors truncate ${projectFilter === p.id ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                onClick={() => setProjectFilter(p.id)}
              >
                {p.icon || "📁"} {p.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 space-y-4 min-w-0">
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
          <Button size="icon" variant="ghost" className="h-9 w-9" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          <div className="ml-auto">
            <Button size="sm" onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" /> Novo Lead</Button>
          </div>
        </div>

        {/* Header info */}
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">
            {projectFilter === "all" ? "Todos os Leads" : projectFilter === "none" ? "Sem Projeto" : getProjectName(projectFilter) || "Leads"}
          </p>
          <p className="text-xs text-muted-foreground">{filtered.length} de {leads.length} leads</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-card border-border">
            <CardContent className="p-3 flex items-center gap-3">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xl font-bold">{totalLeads}</p>
                <p className="text-[10px] text-muted-foreground">Total Leads</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-3 flex items-center gap-3">
              <UserCheck className="h-4 w-4 text-emerald-400" />
              <div>
                <p className="text-xl font-bold">{clientes}</p>
                <p className="text-[10px] text-muted-foreground">Clientes</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-3 flex items-center gap-3">
              <Crown className="h-4 w-4 text-accent" />
              <div>
                <p className="text-xl font-bold">{vips}</p>
                <p className="text-[10px] text-muted-foreground">VIP</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-3 flex items-center gap-3">
              <DollarSign className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xl font-bold font-mono text-primary">R$ {totalReceita.toFixed(0)}</p>
                <p className="text-[10px] text-muted-foreground">Receita Total</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Leads Table */}
        <div className="rounded-lg border border-border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Receita</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((l) => (
                <TableRow
                  key={l.id}
                  className={`cursor-pointer hover:bg-secondary/50 transition-all ${l._isNew ? "animate-pulse bg-emerald-500/10 ring-1 ring-emerald-500/30" : ""}`}
                  onClick={() => setEditLead({ ...l })}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 bg-secondary">
                        <AvatarFallback className="text-xs font-bold bg-secondary text-foreground">
                          {(l.nome || "?")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-sm">{l.nome}</p>
                          {l._isNew && <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">NOVO</span>}
                        </div>
                        <p className="text-[10px] text-muted-foreground">{l.email || "—"}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {l.plataforma ? (
                      <span className="text-xs text-primary">{l.plataforma}</span>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] ${STATUS_COLORS[l.status || "lead"]}`}>
                      {l.status || "lead"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min(100, (l.score || 0))}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-muted-foreground">{l.score ?? "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-primary">
                    {l.total_gasto ? `R$ ${parseFloat(String(l.total_gasto)).toFixed(0)}` : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {l.criado_em ? format(new Date(l.criado_em), "dd/MM/yy") : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      {l.phone && (
                        <Button size="icon" variant="ghost" asChild className="h-7 w-7">
                          <a href={`https://wa.me/${l.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener">
                            <MessageCircle className="h-4 w-4 text-emerald-400" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

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
                <div>
                  <Label>Plataforma</Label>
                  <Select value={form.plataforma} onValueChange={v => setForm({ ...form, plataforma: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>{PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
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
                  <TabsTrigger value="dados" className="flex-1">📝 Dados</TabsTrigger>
                  <TabsTrigger value="jornada" className="flex-1">🗺️ Jornada ({timeline.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="dados" className="space-y-3">
                  <div className="flex items-center gap-3 pb-2">
                    <Avatar className="h-10 w-10 bg-secondary">
                      <AvatarFallback className="font-bold bg-secondary text-foreground">{(editLead.nome || "?")[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{editLead.nome}</p>
                      <p className="text-xs text-muted-foreground">{editLead.email}</p>
                    </div>
                  </div>
                  <div><Label>Nome</Label><Input value={editLead.nome || ""} onChange={e => setEditLead({ ...editLead, nome: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Email</Label><Input value={editLead.email || ""} onChange={e => setEditLead({ ...editLead, email: e.target.value })} /></div>
                    <div><Label>Telefone</Label><Input value={editLead.phone || ""} onChange={e => setEditLead({ ...editLead, phone: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Plataforma</Label>
                      <Select value={editLead.plataforma || ""} onValueChange={v => setEditLead({ ...editLead, plataforma: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                        <SelectContent>{PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Select value={editLead.status || "lead"} onValueChange={v => setEditLead({ ...editLead, status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div><Label>Tags</Label><EditableTagList tags={editLead.tags || []} onChange={tags => setEditLead({ ...editLead, tags })} /></div>
                </TabsContent>

                <TabsContent value="jornada">
                  {timelineLoading ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Carregando jornada...</p>
                  ) : timeline.length === 0 ? (
                    <div className="text-center py-8 space-y-2">
                      <Globe className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                      <p className="text-sm text-muted-foreground">Nenhum evento registrado</p>
                      <p className="text-[10px] text-muted-foreground">Instale o script imptrack.js para rastrear a jornada</p>
                    </div>
                  ) : (
                    <div className="relative max-h-[400px] overflow-y-auto pr-2">
                      {/* Timeline line */}
                      <div className="absolute left-[15px] top-0 bottom-0 w-px bg-border" />
                      <div className="space-y-3">
                        {timeline.map((ev) => {
                          const config = EVENT_CONFIG[ev.type] || { icon: <Zap className="h-3 w-3" />, color: "bg-muted-foreground", label: ev.type };
                          return (
                            <div key={ev.id} className="flex gap-3 relative">
                              <div className={`h-[30px] w-[30px] rounded-full ${config.color} flex items-center justify-center text-white shrink-0 z-10`}>
                                {config.icon}
                              </div>
                              <div className="flex-1 min-w-0 pb-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium">{config.label}</span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {format(new Date(ev.timestamp), "dd/MM HH:mm")}
                                  </span>
                                </div>
                                {ev.subtitle && (
                                  <p className="text-[11px] text-muted-foreground truncate">{ev.subtitle}</p>
                                )}
                                {ev.details && Object.keys(ev.details).filter(k => ev.details![k]).length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {Object.entries(ev.details).filter(([, v]) => v).slice(0, 4).map(([k, v]) => (
                                      <Badge key={k} variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                                        {k}: {String(v).substring(0, 30)}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
            <DialogFooter className="flex justify-between">
              <Button variant="destructive" size="sm" onClick={() => editLead && deleteLead(editLead.id)}>
                <Trash2 className="h-3 w-3 mr-1" /> Excluir
              </Button>
              <Button onClick={saveEdit}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

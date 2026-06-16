import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Smartphone, MessageSquare, Flame, RefreshCw, ExternalLink, UserCheck,
  Loader2, Inbox as InboxIcon, Users, MoreHorizontal, Play, Square,
  Search, ChevronRight, DollarSign, Wallet, ListTodo, LayoutDashboard, Filter
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Conversation {
  id: string;
  project_id: string;
  contact_name: string;
  phone: string;
  last_message: string | null;
  last_message_at: string | null;
  ai_paused_until: string | null;
  buy_intent_detected: boolean | null;
  temperature: string | null;
  status: string | null;
  unread_count?: number | null;
}

interface Lead {
  id: string;
  nome: string | null;
  phone: string | null;
  email: string | null;
  score: number | null;
  status: string | null;
  created_at: string | null;
}

type Tab = "cockpit" | "inbox" | "leads" | "mais";
type InboxFilter = "all" | "unread" | "hot" | "paused";

const TAB_KEY = "mc.activeTab";

export default function MobileCockpit() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    () => localStorage.getItem("mc.selectedProject") || ""
  );
  const [tab, setTab] = useState<Tab>(
    () => (localStorage.getItem(TAB_KEY) as Tab) || "cockpit"
  );

  // Cockpit data
  const [salesStats, setSalesStats] = useState({ today: 0, yesterday: 0, sevenDays: 0 });
  const [loadingStats, setLoadingStats] = useState(false);

  // Conversations (shared cockpit + inbox)
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [inboxSearch, setInboxSearch] = useState("");
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>("all");

  // Leads
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");
  const [leadStatus, setLeadStatus] = useState<string>("all");

  const setActiveTab = (t: Tab) => {
    setTab(t);
    localStorage.setItem(TAB_KEY, t);
  };

  const loadProjects = async () => {
    const { data } = await supabase.from("imphq_projects").select("id, name");
    setProjects(data || []);
    if (data && data.length > 0 && !selectedProjectId) {
      setSelectedProjectId(data[0].id);
      localStorage.setItem("mc.selectedProject", data[0].id);
    }
  };

  const loadStats = useCallback(async () => {
    if (!selectedProjectId) return;
    setLoadingStats(true);
    try {
      const { data: sales } = await supabase
        .from("imphq_vendas")
        .select("valor, data, status")
        .eq("project_id", selectedProjectId)
        .in("status", ["aprovado", "approved", "paid", "completed", "Aprovada", "aprovada", "Aprovado"]);

      const todayStr = new Date().toISOString().split("T")[0];
      const y = new Date(); y.setDate(y.getDate() - 1);
      const yesterdayStr = y.toISOString().split("T")[0];
      const seven = new Date(); seven.setDate(seven.getDate() - 7);

      let today = 0, yesterday = 0, sevenDays = 0;
      (sales || []).forEach((s: any) => {
        const d = String(s.data || ""); const v = Number(s.valor) || 0;
        if (d.startsWith(todayStr)) today += v;
        if (d.startsWith(yesterdayStr)) yesterday += v;
        if (d && new Date(d) >= seven) sevenDays += v;
      });
      setSalesStats({ today, yesterday, sevenDays });
    } finally {
      setLoadingStats(false);
    }
  }, [selectedProjectId]);

  const loadConversations = useCallback(async () => {
    if (!selectedProjectId) return;
    setLoadingConvs(true);
    try {
      const { data, error } = await supabase
        .from("imphq_wa_conversations")
        .select("*")
        .eq("project_id", selectedProjectId)
        .order("last_message_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setConversations((data || []) as unknown as Conversation[]);
    } catch (err: any) {
      toast.error("Erro ao carregar conversas.");
    } finally {
      setLoadingConvs(false);
    }
  }, [selectedProjectId]);

  const loadLeads = useCallback(async () => {
    if (!selectedProjectId) return;
    setLoadingLeads(true);
    try {
      const { data, error } = await supabase
        .from("imphq_leads")
        .select("id, nome, phone, email, score, status, created_at")
        .eq("project_id", selectedProjectId)
        .order("created_at", { ascending: false })
        .limit(150);
      if (error) throw error;
      setLeads((data || []) as Lead[]);
    } catch (err: any) {
      toast.error("Erro ao carregar leads.");
    } finally {
      setLoadingLeads(false);
    }
  }, [selectedProjectId]);

  useEffect(() => { loadProjects(); }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    loadStats();
    loadConversations();
    loadLeads();
  }, [selectedProjectId, loadStats, loadConversations, loadLeads]);

  const handleProjectChange = (id: string) => {
    setSelectedProjectId(id);
    localStorage.setItem("mc.selectedProject", id);
  };

  const handleToggleAiPause = async (conv: Conversation) => {
    const isPaused = conv.ai_paused_until && new Date(conv.ai_paused_until) > new Date();
    const newPausedUntil = isPaused ? null : new Date(Date.now() + 30 * 60 * 1000).toISOString();
    try {
      const { error } = await supabase
        .from("imphq_wa_conversations")
        .update({ ai_paused_until: newPausedUntil } as any)
        .eq("id", conv.id);
      if (error) throw error;
      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, ai_paused_until: newPausedUntil } : c));
      toast.success(isPaused ? "IA retomada." : "IA pausada por 30min.");
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
  };

  const handleToggleCloserMode = async (conv: Conversation) => {
    const next = !conv.buy_intent_detected;
    try {
      const { error } = await supabase
        .from("imphq_wa_conversations")
        .update({ buy_intent_detected: next, temperature: next ? "hot" : conv.temperature } as any)
        .eq("id", conv.id);
      if (error) throw error;
      setConversations(prev => prev.map(c => c.id === conv.id
        ? { ...c, buy_intent_detected: next, temperature: next ? "hot" : c.temperature } : c));
      toast.success(next ? "Closer Mode ativado." : "Closer Mode desativado.");
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
  };

  const handleOpenWaDirect = (phone: string) => {
    const clean = phone.replace(/\D/g, "");
    window.open(`https://api.whatsapp.com/send?phone=${clean}`, "_blank");
  };

  const goDesktop = () => {
    localStorage.setItem("imphq_force_desktop", "1");
    window.location.href = "/dashboard";
  };

  // Filtered inbox
  const filteredInbox = useMemo(() => {
    const q = inboxSearch.trim().toLowerCase();
    return conversations.filter(c => {
      if (q) {
        const hay = `${c.contact_name || ""} ${c.phone || ""} ${c.last_message || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const isPaused = c.ai_paused_until && new Date(c.ai_paused_until) > new Date();
      const isHot = c.temperature === "hot" || c.buy_intent_detected;
      if (inboxFilter === "unread") return (c.unread_count || 0) > 0;
      if (inboxFilter === "hot") return !!isHot;
      if (inboxFilter === "paused") return !!isPaused;
      return true;
    });
  }, [conversations, inboxSearch, inboxFilter]);

  const leadStatuses = useMemo(() => {
    const set = new Set<string>();
    leads.forEach(l => { if (l.status) set.add(l.status); });
    return Array.from(set);
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const q = leadSearch.trim().toLowerCase();
    return leads.filter(l => {
      if (leadStatus !== "all" && l.status !== leadStatus) return false;
      if (q) {
        const hay = `${l.nome || ""} ${l.phone || ""} ${l.email || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [leads, leadSearch, leadStatus]);

  const hotConversations = useMemo(
    () => conversations.filter(c => c.temperature === "hot" || c.buy_intent_detected).slice(0, 20),
    [conversations]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur border-b border-border/40">
        <div className="px-4 py-3 flex items-center justify-between gap-3 max-w-xl mx-auto">
          <div className="flex items-center gap-2 min-w-0">
            <Smartphone className="h-5 w-5 text-amber-500 shrink-0" />
            <h2 className="font-display font-bold text-base tracking-tight text-white truncate">
              {tab === "cockpit" && "Cockpit"}
              {tab === "inbox" && "Inbox WhatsApp"}
              {tab === "leads" && "Leads"}
              {tab === "mais" && "Mais"}
            </h2>
          </div>
          <select
            value={selectedProjectId}
            onChange={(e) => handleProjectChange(e.target.value)}
            className="h-9 px-2.5 rounded-md bg-secondary/60 border border-border/60 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 text-white max-w-[55%] truncate"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="px-4 py-4 max-w-xl mx-auto space-y-4">
        {tab === "cockpit" && (
          <CockpitTab
            salesStats={salesStats}
            loadingStats={loadingStats}
            hotConversations={hotConversations}
            loading={loadingConvs}
            onRefresh={() => { loadStats(); loadConversations(); }}
            onOpenWa={handleOpenWaDirect}
            onTogglePause={handleToggleAiPause}
            onToggleCloser={handleToggleCloserMode}
          />
        )}

        {tab === "inbox" && (
          <InboxTab
            conversations={filteredInbox}
            total={conversations.length}
            loading={loadingConvs}
            search={inboxSearch}
            setSearch={setInboxSearch}
            filter={inboxFilter}
            setFilter={setInboxFilter}
            onRefresh={loadConversations}
            onOpenWa={handleOpenWaDirect}
            onTogglePause={handleToggleAiPause}
          />
        )}

        {tab === "leads" && (
          <LeadsTab
            leads={filteredLeads}
            total={leads.length}
            loading={loadingLeads}
            search={leadSearch}
            setSearch={setLeadSearch}
            status={leadStatus}
            setStatus={setLeadStatus}
            statuses={leadStatuses}
            onRefresh={loadLeads}
            onOpen={(id) => navigate(`/lead/${id}`)}
            onWhats={handleOpenWaDirect}
          />
        )}

        {tab === "mais" && <MaisTab onDesktop={goDesktop} navigate={navigate} />}
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-slate-950/95 backdrop-blur border-t border-border/50 h-16 flex items-stretch">
        {[
          { id: "cockpit" as Tab, label: "Cockpit", icon: Flame },
          { id: "inbox" as Tab, label: "Inbox", icon: InboxIcon },
          { id: "leads" as Tab, label: "Leads", icon: Users },
          { id: "mais" as Tab, label: "Mais", icon: MoreHorizontal },
        ].map(item => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors min-h-11",
                active ? "text-amber-400" : "text-muted-foreground hover:text-white"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "fill-amber-400/10")} />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/* ───────────── Cockpit Tab ───────────── */
function CockpitTab({
  salesStats, loadingStats, hotConversations, loading, onRefresh,
  onOpenWa, onTogglePause, onToggleCloser
}: any) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: "Hoje", val: salesStats.today, color: "text-emerald-400" },
          { label: "Ontem", val: salesStats.yesterday, color: "text-amber-400" },
          { label: "7 Dias", val: salesStats.sevenDays, color: "text-primary" },
        ].map(s => (
          <Card key={s.label} className="bg-slate-900 border-border/50 text-center shadow-md">
            <CardContent className="p-3 space-y-1.5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{s.label}</p>
              <p className={cn("text-xl font-bold font-mono", s.color)}>
                {loadingStats ? <RefreshCw className="h-4 w-4 animate-spin mx-auto" /> : `R$ ${s.val.toFixed(0)}`}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Flame className="h-4 w-4 text-orange-500 fill-orange-500" />
          Conversas Quentes
        </h3>
        <Button variant="ghost" size="icon" className="h-9 w-9 min-h-11 min-w-11" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <Loader text="Carregando..." />
      ) : hotConversations.length === 0 ? (
        <Empty icon={MessageSquare} text="Nenhuma conversa quente agora." />
      ) : (
        <div className="space-y-3">
          {hotConversations.map((conv: Conversation) => (
            <ConvCard
              key={conv.id}
              conv={conv}
              onOpenWa={onOpenWa}
              onTogglePause={onTogglePause}
              onToggleCloser={onToggleCloser}
              full
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────── Inbox Tab ───────────── */
function InboxTab({
  conversations, total, loading, search, setSearch, filter, setFilter,
  onRefresh, onOpenWa, onTogglePause
}: any) {
  const filters: { id: InboxFilter; label: string }[] = [
    { id: "all", label: "Todas" },
    { id: "unread", label: "Não lidas" },
    { id: "hot", label: "Quentes" },
    { id: "paused", label: "Pausadas" },
  ];
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar nome, telefone, mensagem..."
          className="pl-9 h-11 bg-slate-900 border-border/60"
        />
      </div>
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "px-3.5 h-10 rounded-full text-sm font-semibold whitespace-nowrap border transition-colors",
              filter === f.id
                ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                : "bg-slate-900 border-border/50 text-muted-foreground hover:text-white"
            )}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto flex items-center">
          <Button variant="ghost" size="icon" className="h-9 w-9 min-h-11 min-w-11" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        {conversations.length} de {total} conversa{total === 1 ? "" : "s"}
      </p>

      {loading ? (
        <Loader text="Carregando inbox..." />
      ) : conversations.length === 0 ? (
        <Empty icon={InboxIcon} text="Nenhuma conversa encontrada." />
      ) : (
        <div className="space-y-2.5">
          {conversations.map((conv: Conversation) => (
            <ConvCard
              key={conv.id}
              conv={conv}
              onOpenWa={onOpenWa}
              onTogglePause={onTogglePause}
              compact
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────── Leads Tab ───────────── */
function LeadsTab({
  leads, total, loading, search, setSearch, status, setStatus, statuses,
  onRefresh, onOpen, onWhats
}: any) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar nome, telefone, produto..."
          className="pl-9 h-11 bg-slate-900 border-border/60"
        />
      </div>
      <div className="flex gap-2 items-center">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="flex-1 h-10 px-2 rounded-md bg-slate-900 border border-border/60 text-sm text-white"
        >
          <option value="all">Todos os status</option>
          {statuses.map((s: string) => <option key={s} value={s}>{s}</option>)}
        </select>
        <Button variant="ghost" size="icon" className="h-10 w-10 min-h-11 min-w-11" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {leads.length} de {total} lead{total === 1 ? "" : "s"} — ordenado por mais recente
      </p>

      {loading ? (
        <Loader text="Carregando leads..." />
      ) : leads.length === 0 ? (
        <Empty icon={Users} text="Nenhum lead encontrado." />
      ) : (
        <div className="space-y-2.5">
          {leads.map((lead: Lead) => (
            <Card
              key={lead.id}
              onClick={() => onOpen(lead.id)}
              className="bg-slate-900 border-border/40 shadow-md active:scale-[0.99] cursor-pointer"
            >
              <CardContent className="p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-white truncate">{lead.nome || "Sem nome"}</h4>
                    <p className="text-xs text-muted-foreground font-mono truncate">{lead.phone || lead.email || "—"}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {typeof lead.score === "number" && lead.score > 0 && (
                      <Badge className={cn(
                        "text-[10px] font-bold px-1.5 py-0",
                        lead.score >= 70 ? "bg-orange-500/15 text-orange-400 border-orange-500/30"
                        : lead.score >= 40 ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                        : "bg-slate-700/40 text-slate-300 border-slate-600/40"
                      )}>
                        {lead.score}
                      </Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="truncate max-w-[60%]">
                    {lead.status || "Lead"}
                  </span>
                  <span className="shrink-0">
                    {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
                {lead.phone && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => { e.stopPropagation(); onWhats(lead.phone!); }}
                    className="w-full text-xs h-9 gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> WhatsApp
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────── Mais Tab ───────────── */
function MaisTab({ onDesktop, navigate }: any) {
  const items = [
    { label: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
    { label: "Finanças", icon: DollarSign, to: "/financas" },
    { label: "Recuperação", icon: Wallet, to: "/recuperacao" },
    { label: "Tarefas", icon: ListTodo, to: "/openflow" },
  ];
  return (
    <div className="space-y-2">
      {items.map(i => {
        const Icon = i.icon;
        return (
          <button
            key={i.to}
            onClick={() => navigate(i.to)}
            className="w-full flex items-center justify-between p-4 rounded-lg bg-slate-900 border border-border/40 active:scale-[0.99] min-h-11"
          >
            <span className="flex items-center gap-3">
              <Icon className="h-5 w-5 text-amber-400" />
              <span className="text-sm font-semibold text-white">{i.label}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        );
      })}
      <button
        onClick={onDesktop}
        className="w-full mt-4 p-4 rounded-lg border border-dashed border-border/50 text-sm text-muted-foreground hover:text-amber-400 hover:border-amber-500/40 transition min-h-11"
      >
        Ver versão desktop →
      </button>
    </div>
  );
}

/* ───────────── Conv Card ───────────── */
function ConvCard({ conv, onOpenWa, onTogglePause, onToggleCloser, full = false, compact = false }: any) {
  const isPaused = conv.ai_paused_until && new Date(conv.ai_paused_until) > new Date();
  const isHot = conv.temperature === "hot" || conv.buy_intent_detected;
  const remaining = conv.ai_paused_until
    ? Math.max(0, Math.ceil((new Date(conv.ai_paused_until).getTime() - Date.now()) / 60000)) : 0;

  return (
    <Card className={cn(
      "bg-slate-900 border-border/40 transition-all shadow-md active:scale-[0.99]",
      isHot && "border-orange-500/30 bg-gradient-to-br from-slate-900 to-orange-500/5",
      isPaused && "border-blue-500/20 bg-gradient-to-br from-slate-900 to-blue-500/5"
    )}>
      <CardContent className={cn("space-y-3", compact ? "p-3" : "p-3.5")}>
        <div className="flex justify-between items-start gap-2">
          <div className="space-y-0.5 min-w-0 flex-1">
            <h4 className="text-sm font-bold text-white truncate">{conv.contact_name || "Sem Nome"}</h4>
            <p className="text-xs text-muted-foreground font-mono truncate">{conv.phone}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isHot && <Badge className="bg-orange-500/15 text-orange-400 border-orange-500/30 text-[10px] font-bold px-1.5 py-0">QUENTE</Badge>}
            {isPaused && <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-[10px] font-bold px-1.5 py-0">IA OFF</Badge>}
          </div>
        </div>

        {conv.last_message && (
          <div className={cn(
            "bg-slate-950/40 p-2.5 rounded-lg border border-border/20 text-sm italic text-slate-300 leading-relaxed",
            compact ? "line-clamp-2" : "line-clamp-3"
          )}>
            "{conv.last_message}"
          </div>
        )}

        <div className="flex justify-between items-center text-xs text-muted-foreground">
          <span>Status: <strong className="capitalize">{conv.status || "Lead"}</strong></span>
          {conv.last_message_at && (
            <span>{formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true, locale: ptBR })}</span>
          )}
        </div>

        <div className={cn("grid gap-2", full ? "grid-cols-3" : "grid-cols-2")}>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenWa(conv.phone)}
            className="text-xs min-h-11 gap-1 font-semibold border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Chat
          </Button>
          {full && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onToggleCloser(conv)}
              className={cn(
                "text-xs min-h-11 gap-1 font-semibold",
                conv.buy_intent_detected
                  ? "border-orange-500 bg-orange-500/20 text-orange-300"
                  : "border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
              )}
            >
              <UserCheck className="h-3.5 w-3.5" /> Closer
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => onTogglePause(conv)}
            className={cn(
              "text-xs min-h-11 gap-1 font-semibold",
              isPaused
                ? "border-blue-500 bg-blue-500/20 text-blue-300"
                : "border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
            )}
          >
            {isPaused ? <Play className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
            {isPaused ? "Retomar" : "Pausar IA"}
          </Button>
        </div>
        {isPaused && (
          <p className="text-[11px] text-blue-400 text-center font-semibold">
            Pausado por mais {remaining} min.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Loader({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
      <Loader2 className="h-7 w-7 animate-spin" />
      <p className="text-xs">{text}</p>
    </div>
  );
}

function Empty({ icon: Icon, text }: any) {
  return (
    <Card className="bg-slate-900 border-border/40 text-center">
      <CardContent className="p-10 space-y-2 text-muted-foreground">
        <Icon className="h-8 w-8 mx-auto opacity-40" />
        <p className="text-sm">{text}</p>
      </CardContent>
    </Card>
  );
}

import { errorMessage } from "@/lib/error-message";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Search, Plus, Mail, SlidersHorizontal, CheckCircle2, Bot } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatMessageTime } from "@/lib/formatCompactTime";
import MergeDuplicatesButton from "./MergeDuplicatesButton";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger } from "@/components/ui/context-menu";
import { CONV_COLOR_PRESETS, resolveConvColor, type ConvForColor } from "@/lib/conversationStatusColor";
import { toast } from "sonner";

interface WaSession {
  id: string; phone: string; contact_name: string | null;
  session: string; project_id: string; status: string;
  message_count: number; metadata: unknown; created_at: string;
  provider_id: string | null;
  last_message?: string | null;
  updated_at?: string;
  last_message_at?: string | null;
  last_read_at?: string | null;
  avatar_url?: string | null;
  unread_count?: number;
  last_message_direction?: string | null;
  jid_suffix?: string | null;
  snoozed_until?: string | null;
  assigned_to?: string | null;
  handoff_at?: string | null;
  color_override?: string | null;
  ai_last_reply_at?: string | null;
  ai_lock_until?: string | null;
  ai_paused_until?: string | null;
}

function isUnreadSession(s: WaSession): boolean {
  if ((s.unread_count || 0) > 0) return true;
  const dir = s.last_message_direction;
  if (dir !== "in" && dir !== "incoming") return false;
  const lastMsg = s.last_message_at ? new Date(s.last_message_at).getTime() : 0;
  if (!lastMsg) return false;
  const lastRead = s.last_read_at ? new Date(s.last_read_at).getTime() : 0;
  return lastRead < lastMsg;
}

// SLA: tempo desde a última mensagem do lead aguardando resposta
function waitingMinutes(s: WaSession): number | null {
  const dir = s.last_message_direction;
  if (dir !== "in" && dir !== "incoming") return null;
  if (!s.last_message_at) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(s.last_message_at).getTime()) / 60000));
}

function formatWaiting(min: number): string {
  if (min < 1) return "agora";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h${min % 60 ? ` ${min % 60}min` : ""}`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function slaColor(min: number): string {
  if (min < 5) return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  if (min < 30) return "bg-amber-500/20 text-amber-300 border-amber-500/40";
  if (min < 120) return "bg-orange-500/20 text-orange-300 border-orange-500/40";
  return "bg-red-500/25 text-red-300 border-red-500/50 animate-pulse";
}



interface Provider {
  id: string;
  instance_name?: string;
  display_name?: string | null;
  twilio_from?: string;
  provider: string;
  project_id: string;
}

interface Props {
  sessions: WaSession[];
  projects: { id: string; name: string }[];
  providers?: Provider[];
  selectedId: string | null;
  loading: boolean;
  onSelect: (session: WaSession) => void;
  onNewSession: () => void;
  filterProject: string;
  onFilterProject: (v: string) => void;
  filterProvider?: string;
  onFilterProvider?: (v: string) => void;
  onMarkUnread?: (id: string) => void;
}



function getInitials(name: string | null, phone: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  return phone.slice(-2);
}

// Telefone "real" (não Linked ID / id técnico). LIDs têm 15+ dígitos ou sufixo @lid.
function realPhone(phone: string | null | undefined, jidSuffix?: string | null): string | null {
  if (!phone) return null;
  if (jidSuffix === "lid" || phone.includes("@")) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 13) return null;
  return digits;
}

function formatPhone(digits: string): string {
  const m = digits.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : `+${digits}`;
}

function contactDisplayName(name: string | null | undefined, phone: string | null | undefined, jidSuffix?: string | null): string {
  if (name && name.trim() && !/^\d{8,}(@\w+(\.\w+)*)?$/.test(name.trim())) return name.trim();
  const p = realPhone(phone, jidSuffix);
  return p ? formatPhone(p) : "Contato sem nome";
}

// Cor estável por provider_id (hash simples → HSL)
function providerColor(id: string | null | undefined): string {
  if (!id) return "hsl(0, 0%, 50%)";
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 65%, 55%)`;
}

function providerLabel(prov: Provider | undefined): string | null {
  if (!prov) return null;
  if (prov.display_name) return prov.display_name;
  if (prov.provider === "evolution") return prov.instance_name || "Evolution";
  return prov.twilio_from ? `Twilio ...${prov.twilio_from.slice(-4)}` : "Twilio";
}

// Chip de canal fixo por tipo de provider
function channelChip(prov: Provider | undefined): { label: string; icon: string; cls: string } | null {
  if (!prov) return null;
  const p = (prov.provider || "").toLowerCase();
  if (p.includes("instagram") || p === "ig" || p === "meta_ig") {
    return { label: "Instagram", icon: "📷", cls: "bg-pink-500/15 border-pink-500/50 text-pink-300" };
  }
  // evolution, twilio, wppconnect, etc → WhatsApp
  return { label: "WhatsApp", icon: "💬", cls: "bg-emerald-500/15 border-emerald-500/50 text-emerald-300" };
}

export default function ConversationList({
  sessions, projects, providers, selectedId, loading, onSelect, onNewSession,
  filterProject, onFilterProject, filterProvider = "all", onFilterProvider,
  onMarkUnread,
}: Props) {
  const [search, setSearch] = useState("");
  const [viewTab, setViewTab] = useState<"responder" | "todas" | "ia">("responder");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [snoozeMode, setSnoozeMode] = useState<"hide" | "show" | "only">(
    () => { const value = typeof window !== "undefined" ? localStorage.getItem("wa-snooze-mode") : null; return value === "show" || value === "only" ? value : "hide"; }
  );
  const [assignFilter, setAssignFilter] = useState<"all" | "mine" | "unassigned">(
    () => { const value = typeof window !== "undefined" ? localStorage.getItem("wa-assign-filter") : null; return value === "mine" || value === "unassigned" ? value : "all"; }
  );
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [colorFilter, setColorFilter] = useState<string>(
    () => (typeof window !== "undefined" ? localStorage.getItem("wa-color-filter") || "all" : "all")
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMyUserId(data.user?.id || null));
  }, []);

  const setColor = async (id: string, color: string | null) => {
    try {
      await supabase.from("imphq_wa_conversations").update({ color_override: color }).eq("id", id);
      toast.success(color ? "Cor aplicada" : "Cor removida");
    } catch (e: unknown) {
      toast.error("Falha ao salvar cor: " + errorMessage(e));
    }
  };

  const projectName = (id: string) => projects.find(p => p.id === id)?.name || "";
  const findProvider = (providerId: string | null) =>
    providerId && providers ? providers.find(p => p.id === providerId) : undefined;

  const isSnoozed = (s: WaSession) => !!s.snoozed_until && new Date(s.snoozed_until).getTime() > Date.now();
  const isHandoff = (s: WaSession) => !!s.handoff_at;

  const isAiHandling = (s: WaSession) => {
    if (isHandoff(s)) return false;
    if (s.ai_paused_until && new Date(s.ai_paused_until).getTime() > Date.now()) return false;
    const hasAiLock = !!s.ai_lock_until && new Date(s.ai_lock_until).getTime() > Date.now();
    if (hasAiLock) return true;
    if (!s.ai_last_reply_at) return false;
    const aiTime = new Date(s.ai_last_reply_at).getTime();
    const lastMsgTime = s.last_message_at ? new Date(s.last_message_at).getTime() : 0;
    return aiTime >= lastMsgTime - 120000;
  };

  const isAwaitingReply = (s: WaSession) => {
    if (isSnoozed(s)) return false;
    if (isHandoff(s)) return true;
    const lastMsgTime = s.last_message_at ? new Date(s.last_message_at).getTime() : 0;
    if (!lastMsgTime) return false;
    // Foco em leads ativos nos últimos 7 dias (elimina o ruído de chats mortos)
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    if (lastMsgTime < sevenDaysAgo) return false;

    const isInbound = s.last_message_direction === "in" || s.last_message_direction === "incoming";
    const unread = isUnreadSession(s);
    return (isInbound || unread) && !isAiHandling(s);
  };

  // Contadores para o projeto/provider atual
  const projectSessions = sessions.filter(s => {
    const matchProject = filterProject === "all" || s.project_id === filterProject;
    const matchProvider = filterProvider === "all" || s.provider_id === filterProvider;
    return matchProject && matchProvider;
  });

  const waitingCount = projectSessions.filter(isAwaitingReply).length;
  const aiCount = projectSessions.filter(isAiHandling).length;
  const snoozedCount = sessions.filter(isSnoozed).length;

  const activeFiltersCount =
    (assignFilter !== "all" ? 1 : 0) +
    (snoozeMode !== "hide" ? 1 : 0) +
    (colorFilter !== "all" ? 1 : 0) +
    (onlyUnread ? 1 : 0);

  const filtered = sessions.filter(s => {
    const matchProject = filterProject === "all" || s.project_id === filterProject;
    const matchProvider = filterProvider === "all" || s.provider_id === filterProvider;
    const matchSearch = !search ||
      (s.contact_name || "").toLowerCase().includes(search.toLowerCase()) ||
      s.phone.includes(search);
    
    // Filtro da aba principal
    if (viewTab === "responder" && !isAwaitingReply(s)) return false;
    if (viewTab === "ia" && !isAiHandling(s)) return false;

    // Filtros secundários
    const matchUnread = !onlyUnread || isUnreadSession(s);
    const snoozed = isSnoozed(s);
    const matchSnooze = snoozeMode === "show" ? true : snoozeMode === "only" ? snoozed : !snoozed;
    const matchAssign =
      assignFilter === "all" ? true :
      assignFilter === "mine" ? s.assigned_to === myUserId :
      !s.assigned_to;
    const matchColor = colorFilter === "all" || resolveConvColor(s as ConvForColor).key === colorFilter;

    return matchProject && matchProvider && matchSearch && matchUnread && matchSnooze && matchAssign && matchColor;
  }).sort((a, b) => {
    // Na visualização de responder agora, prioriza maior tempo de espera (SLA urgente)
    if (viewTab === "responder") {
      const wa = waitingMinutes(a) || 0;
      const wb = waitingMinutes(b) || 0;
      if (wa !== wb) return wb - wa;
    }
    const ua = isUnreadSession(a) ? 1 : 0;
    const ub = isUnreadSession(b) ? 1 : 0;
    if (ua !== ub) return ub - ua;
    const ta = new Date(a.last_message_at || a.updated_at || a.created_at || 0).getTime();
    const tb = new Date(b.last_message_at || b.updated_at || b.created_at || 0).getTime();
    return tb - ta;
  });

  return (
    <div className="flex flex-col h-full border-r border-border bg-card">
      {/* Header */}
      <div className="p-3 space-y-2 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm text-foreground flex items-center gap-2">
            Conversas
          </h2>
          <div className="flex items-center gap-1.5">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className={`h-7 px-2 text-xs gap-1.5 transition-colors ${
                    activeFiltersCount > 0
                      ? "border-primary/50 bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Filtros avançados (atribuição, status, silenciadas)"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>Filtros</span>
                  {activeFiltersCount > 0 && (
                    <span className="text-[10px] font-bold bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center">
                      {activeFiltersCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="end" className="w-80 p-3 bg-secondary/95 backdrop-blur-xl border-border space-y-3 z-50">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-primary" /> Filtros Avançados
                  </span>
                  {activeFiltersCount > 0 && (
                    <button
                      onClick={() => {
                        setAssignFilter("all");
                        setSnoozeMode("hide");
                        setColorFilter("all");
                        setOnlyUnread(false);
                        try {
                          localStorage.removeItem("wa-assign-filter");
                          localStorage.removeItem("wa-snooze-mode");
                          localStorage.removeItem("wa-color-filter");
                        } catch { /* storage fallback */ }
                      }}
                      className="text-[11px] text-muted-foreground hover:text-primary transition-colors"
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>

                {/* Atribuição */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">Atendente</label>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { k: "all", label: "👥 Todas" },
                      { k: "mine", label: "👤 Minhas" },
                      { k: "unassigned", label: "❓ Sem dono" },
                    ].map(item => (
                      <button
                        key={item.k}
                        onClick={() => {
                          const val = item.k as "all" | "mine" | "unassigned";
                          setAssignFilter(val);
                          try { localStorage.setItem("wa-assign-filter", val); } catch {}
                        }}
                        className={`text-[11px] py-1 px-2 rounded border transition-colors ${
                          assignFilter === item.k
                            ? "bg-primary/15 border-primary/50 text-primary font-medium"
                            : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/60"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Silenciadas */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium text-muted-foreground">Silenciadas</label>
                    {snoozedCount > 0 && (
                      <span className="text-[10px] text-muted-foreground">({snoozedCount} ativas)</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { k: "hide", label: "🔕 Ocultar" },
                      { k: "show", label: "🔔 Todas" },
                      { k: "only", label: "🔕 Apenas" },
                    ].map(item => (
                      <button
                        key={item.k}
                        onClick={() => {
                          const val = item.k as "hide" | "show" | "only";
                          setSnoozeMode(val);
                          try { localStorage.setItem("wa-snooze-mode", val); } catch {}
                        }}
                        className={`text-[11px] py-1 px-2 rounded border transition-colors ${
                          snoozeMode === item.k
                            ? "bg-purple-500/20 border-purple-500/50 text-purple-300 font-medium"
                            : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/60"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status / Cor */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium text-muted-foreground">Classificação do Lead</label>
                  </div>
                  <div className="grid grid-cols-2 gap-1 max-h-36 overflow-y-auto scrollbar-thin">
                    {[
                      { k: "all", hex: "transparent", label: "Todas as cores" },
                      { k: "interested", hex: CONV_COLOR_PRESETS.blue.hex, label: "Interessado" },
                      { k: "new", hex: CONV_COLOR_PRESETS.green.hex, label: "Nova" },
                      { k: "waiting", hex: CONV_COLOR_PRESETS.amber.hex, label: "Aguardando" },
                      { k: "urgent", hex: CONV_COLOR_PRESETS.red.hex, label: "SLA Crítico" },
                      { k: "handoff", hex: CONV_COLOR_PRESETS.violet.hex, label: "Handoff IA" },
                      { k: "cold", hex: CONV_COLOR_PRESETS.slate.hex, label: "Frio" },
                    ].map(c => (
                      <button
                        key={c.k}
                        onClick={() => {
                          setColorFilter(c.k);
                          try { localStorage.setItem("wa-color-filter", c.k); } catch {}
                        }}
                        className={`text-[11px] py-1 px-2 rounded border transition-colors flex items-center gap-1.5 text-left ${
                          colorFilter === c.k
                            ? "bg-muted border-primary/50 text-foreground font-medium"
                            : "bg-muted/20 border-border text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        {c.hex !== "transparent" && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.hex }} />}
                        <span className="truncate">{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Não lidas toggle */}
                <div className="pt-2 border-t border-border flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Apenas não lidas</span>
                  <button
                    onClick={() => setOnlyUnread(v => !v)}
                    className={`text-[10px] h-6 px-2 rounded border transition-colors ${
                      onlyUnread
                        ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-400 font-medium"
                        : "bg-muted/30 border-border text-muted-foreground"
                    }`}
                  >
                    {onlyUnread ? "Ativo" : "Inativo"}
                  </button>
                </div>

                {/* Mesclar duplicados */}
                <div className="pt-2 border-t border-border">
                  <MergeDuplicatesButton projectId={filterProject} />
                </div>
              </PopoverContent>
            </Popover>

            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onNewSession} title="Nova conversa">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 3 Segmented Pill Tabs */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-muted/40 rounded-lg text-xs font-medium">
          <button
            onClick={() => setViewTab("responder")}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md transition-all ${
              viewTab === "responder"
                ? "bg-background text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
            title="Leads aguardando resposta humana nos últimos 7 dias"
          >
            <span>🔥 Responder</span>
            {waitingCount > 0 && (
              <span className="text-[10px] font-bold bg-amber-500/25 text-amber-400 border border-amber-500/40 rounded-full px-1.5 py-0.2 leading-tight">
                {waitingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setViewTab("todas")}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md transition-all ${
              viewTab === "todas"
                ? "bg-background text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
            title="Todas as conversas"
          >
            <span>💬 Todas</span>
          </button>
          <button
            onClick={() => setViewTab("ia")}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md transition-all ${
              viewTab === "ia"
                ? "bg-background text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
            title="Conversas sob controle da IA autônoma"
          >
            <span>🤖 IA</span>
            {aiCount > 0 && (
              <span className="text-[10px] font-semibold bg-primary/20 text-primary rounded-full px-1.5 py-0.2 leading-tight">
                {aiCount}
              </span>
            )}
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar contato ou telefone..."
            className="h-8 pl-8 text-xs"
          />
        </div>

        {/* Project Selector */}
        <Select value={filterProject} onValueChange={onFilterProject}>
          <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="Filtrar projeto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Projetos</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Provider chips if multi-instance */}
        {onFilterProvider && providers && providers.length > 1 && (() => {
          const visibleProvs = filterProject === "all"
            ? providers
            : providers.filter(p => p.project_id === filterProject);
          if (visibleProvs.length < 2) return null;
          const countFor = (provId: string | "all") => sessions.filter(s => {
            const matchProject = filterProject === "all" || s.project_id === filterProject;
            return matchProject && (provId === "all" || s.provider_id === provId);
          }).length;
          const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
          const hasRecent = (provId: string) => sessions.some(s => {
            if (s.provider_id !== provId) return false;
            const t = s.last_message_at ? new Date(s.last_message_at).getTime() : 0;
            return t >= dayAgo;
          });

          return (
            <div className="flex gap-1 overflow-x-auto pb-0.5 -mx-0.5 px-0.5 scrollbar-thin">
              <button
                onClick={() => onFilterProvider("all")}
                className={`shrink-0 text-[10px] px-2 h-6 rounded-md border transition-colors ${filterProvider === "all" ? "bg-primary/15 border-primary/40 text-primary font-medium" : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/60"}`}
              >
                Todos <span className="opacity-60">({countFor("all")})</span>
              </button>
              {visibleProvs.map(p => {
                const active = filterProvider === p.id;
                const color = providerColor(p.id);
                const recent = !active && hasRecent(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => onFilterProvider(p.id)}
                    className={`relative shrink-0 text-[10px] px-2 h-6 rounded-md border transition-colors flex items-center gap-1.5 ${active ? "text-foreground font-medium" : "text-muted-foreground hover:bg-muted/60"}`}
                    style={active ? { background: `${color.replace("hsl", "hsla").replace(")", ", 0.18)")}`, borderColor: `${color.replace("hsl", "hsla").replace(")", ", 0.55)")}` } : { background: "hsl(var(--muted) / 0.3)", borderColor: "hsl(var(--border))" }}
                    title={(providerLabel(p) || p.id) + (recent ? " — novas mensagens nas últimas 24h" : "")}
                  >
                    <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                    {providerLabel(p) || "Chip"} <span className="opacity-60">({countFor(p.id)})</span>
                    {recent && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                    )}
                  </button>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-3 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            {search ? (
              <>
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Search className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">Nenhum resultado</p>
                <p className="text-xs text-muted-foreground mb-3">Tente outro termo de busca</p>
                <Button size="sm" variant="ghost" onClick={() => setSearch("")}>
                  Limpar busca
                </Button>
              </>
            ) : viewTab === "responder" ? (
              <>
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">Tudo em dia!</p>
                <p className="text-xs text-muted-foreground mb-3 max-w-[220px]">
                  Nenhum lead aguardando resposta humana no momento.
                </p>
                <Button size="sm" variant="outline" onClick={() => setViewTab("todas")}>
                  Ver todas as conversas
                </Button>
              </>
            ) : viewTab === "ia" ? (
              <>
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <Bot className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">Nenhuma conversa na IA</p>
                <p className="text-xs text-muted-foreground mb-3 max-w-[220px]">
                  As conversas tocadas pela IA autônoma aparecerão aqui.
                </p>
                <Button size="sm" variant="outline" onClick={() => setViewTab("todas")}>
                  Ver todas as conversas
                </Button>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <MessageSquare className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">Nenhuma conversa</p>
                <p className="text-xs text-muted-foreground mb-3">Crie sua primeira sessão para começar</p>
                <Button size="sm" variant="outline" onClick={onNewSession}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Nova Sessão
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="py-1">
            {filtered.map(s => {
              const isSelected = s.id === selectedId;
              const prov = findProvider(s.provider_id);
              const provLabel = providerLabel(prov);
              const color = providerColor(s.provider_id);
              const unread = s.unread_count || 0;
              const hasUnread = isUnreadSession(s);
              const channel = channelChip(prov);
              const displayCount = unread > 0 ? unread : (hasUnread ? 1 : 0);
              const convColor = resolveConvColor(s as ConvForColor);
              const useAccent = !isSelected && convColor.key !== "default";
              const displayName = contactDisplayName(s.contact_name, s.phone, s.jid_suffix);
              const phoneDigits = realPhone(s.phone, s.jid_suffix);
              return (
                <ContextMenu key={s.id}>
                  <ContextMenuTrigger asChild>
                <button
                  onClick={() => onSelect(s)}
                  className={`group w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/50 border-l-[3px] ${
                    isSelected
                      ? "bg-secondary/80 border-l-primary"
                      : hasUnread && convColor.key === "new"
                        ? "border-l-emerald-400 bg-emerald-500/10"
                        : "border-l-transparent"
                  }`}
                  style={useAccent ? { borderLeftColor: convColor.hex, background: `${convColor.hex}10` } : undefined}
                  title={[provLabel ? `Instância: ${provLabel}` : "", convColor.label ? `Status: ${convColor.label}` : ""].filter(Boolean).join(" · ") || undefined}
                >
                  <div className="relative shrink-0">
                    <Avatar className={`h-10 w-10 ${hasUnread && !isSelected ? "ring-2 ring-emerald-400/70" : ""}`}>
                      {s.avatar_url && (
                        <AvatarImage 
                          src={s.avatar_url} 
                          alt={s.contact_name || s.phone} 
                          onError={async () => {
                            // Se der 403 (URL expirada do CDN do WhatsApp), limpa no banco.
                            // O hook no WhatsAppPage detecta e puxa um link assinado novo e funcional!
                            await supabase
                              .from("imphq_wa_conversations")
                              .update({ avatar_url: null })
                              .eq("id", s.id);
                          }}
                        />
                      )}
                      <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                        {displayName === "Contato sem nome" ? "?" : getInitials(displayName, s.phone)}
                      </AvatarFallback>
                    </Avatar>
                    {hasUnread && !isSelected && (
                      <span className="absolute -top-0.5 -left-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-card animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                    )}
                    {provLabel && (
                      <span
                        className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card"
                        style={{ background: color }}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`text-sm truncate ${hasUnread ? "font-bold text-white" : "font-medium text-foreground"} ${displayName === "Contato sem nome" ? "italic text-muted-foreground" : ""}`}>
                          {displayName}
                        </span>
                        {channel && channel.label !== "WhatsApp" && (
                          <Badge
                            variant="outline"
                            className={`text-[9px] h-4 px-1.5 shrink-0 font-medium ${channel.cls}`}
                            title={channel.label}
                          >
                            {channel.icon} {channel.label}
                          </Badge>
                        )}
                        {s.jid_suffix === "lid" && (
                          <span
                            className="text-[10px] shrink-0 text-amber-500/80"
                            title="Contato com privacidade ativa (Linked ID). Resposta funciona normalmente."
                          >
                            🔒
                          </span>
                        )}

                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {(() => {
                          const w = waitingMinutes(s);
                          if (w === null) return null;
                          return (
                            <span
                              className={`text-[9px] font-semibold px-1.5 py-0 rounded border ${slaColor(w)} leading-tight`}
                              title={`Aguardando resposta há ${formatWaiting(w)}`}
                            >
                              ⏱ {formatWaiting(w)}
                            </span>
                          );
                        })()}
                        <span className={`text-[10px] ${hasUnread ? "text-emerald-300 font-semibold" : "text-muted-foreground"}`}>
                          {formatMessageTime(s.last_message_at || s.updated_at || s.created_at)}
                        </span>
                      </div>
                    </div>
                    {phoneDigits && displayName !== formatPhone(phoneDigits) && (
                      <p className="text-[10px] text-muted-foreground/70 font-mono truncate">{formatPhone(phoneDigits)}</p>
                    )}
                    <div className="flex items-center justify-between mt-0.5 gap-2">
                      <p className={`text-xs truncate pr-2 flex items-center gap-1 ${hasUnread ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                        {s.last_message_direction === "out" && !hasUnread && (
                          <span className="text-[10px] text-muted-foreground/70 shrink-0">↩</span>
                        )}
                        <span className="truncate">{s.last_message || ""}</span>
                      </p>
                      {hasUnread ? (
                        <span className="text-[10px] font-bold bg-emerald-500 text-white rounded-full min-w-[20px] h-[20px] px-1.5 flex items-center justify-center shrink-0 leading-none shadow-[0_0_8px_rgba(16,185,129,0.5)]">
                          {displayCount > 99 ? "99+" : displayCount}
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5 shrink-0">
                          {s.message_count > 0 && (
                            <Badge variant="secondary" className="text-[9px] h-4 px-1.5 group-hover:hidden">
                              {s.message_count}
                            </Badge>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onMarkUnread?.(s.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-emerald-400 hover:bg-secondary transition-all"
                            title="Marcar como não lida"
                          >
                            <Mail className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">
                      {projectName(s.project_id)}
                    </p>
                  </div>
                </button>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-56">
                    <ContextMenuSub>
                      <ContextMenuSubTrigger>
                        <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: convColor.hex === "transparent" ? "#64748b" : convColor.hex }} />
                        Cor da conversa
                      </ContextMenuSubTrigger>
                      <ContextMenuSubContent className="w-56">
                        {Object.entries(CONV_COLOR_PRESETS).map(([key, p]) => (
                          <ContextMenuItem key={key} onSelect={() => setColor(s.id, key)}>
                            <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ background: p.hex }} />
                            <span className="flex-1">{p.label}</span>
                            {s.color_override === key && <span className="text-primary">✓</span>}
                          </ContextMenuItem>
                        ))}
                        <ContextMenuSeparator />
                        <ContextMenuItem onSelect={() => setColor(s.id, null)}>
                          Usar cor automática
                        </ContextMenuItem>
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                    <ContextMenuSeparator />
                    <ContextMenuItem onSelect={() => onMarkUnread?.(s.id)}>
                      Marcar como não lida
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Footer count */}
      <div className="p-2 border-t border-border shrink-0 flex items-center justify-between px-3">
        <p className="text-[10px] text-muted-foreground">{filtered.length} conversa(s)</p>
        {activeFiltersCount > 0 && (
          <button
            onClick={() => {
              setAssignFilter("all");
              setSnoozeMode("hide");
              setColorFilter("all");
              setOnlyUnread(false);
              try {
                localStorage.removeItem("wa-assign-filter");
                localStorage.removeItem("wa-snooze-mode");
                localStorage.removeItem("wa-color-filter");
              } catch {}
            }}
            className="text-[10px] text-primary hover:underline font-medium"
          >
            Limpar filtros ({activeFiltersCount})
          </button>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Search, Plus, Mail } from "lucide-react";
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
  message_count: number; metadata: any; created_at: string;
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
  status?: string | null;
  handoff_at?: string | null;
  color_override?: string | null;
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
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [snoozeMode, setSnoozeMode] = useState<"hide" | "show" | "only">(
    () => (typeof window !== "undefined" ? (localStorage.getItem("wa-snooze-mode") as any) : null) || "hide"
  );
  const [assignFilter, setAssignFilter] = useState<"all" | "mine" | "unassigned">(
    () => (typeof window !== "undefined" ? (localStorage.getItem("wa-assign-filter") as any) : null) || "all"
  );
  const [myUserId, setMyUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMyUserId(data.user?.id || null));
  }, []);

  const cycleSnoozeMode = () => {
    const next = snoozeMode === "hide" ? "show" : snoozeMode === "show" ? "only" : "hide";
    setSnoozeMode(next);
    try { localStorage.setItem("wa-snooze-mode", next); } catch {}
  };
  const cycleAssignFilter = () => {
    const next = assignFilter === "all" ? "mine" : assignFilter === "mine" ? "unassigned" : "all";
    setAssignFilter(next);
    try { localStorage.setItem("wa-assign-filter", next); } catch {}
  };

  const projectName = (id: string) => projects.find(p => p.id === id)?.name || "";
  const findProvider = (providerId: string | null) =>
    providerId && providers ? providers.find(p => p.id === providerId) : undefined;

  const isSnoozed = (s: WaSession) => !!s.snoozed_until && new Date(s.snoozed_until).getTime() > Date.now();

  const filtered = sessions.filter(s => {
    const matchProject = filterProject === "all" || s.project_id === filterProject;
    const matchProvider = filterProvider === "all" || s.provider_id === filterProvider;
    const matchSearch = !search ||
      (s.contact_name || "").toLowerCase().includes(search.toLowerCase()) ||
      s.phone.includes(search);
    const matchUnread = !onlyUnread || isUnreadSession(s);
    const snoozed = isSnoozed(s);
    const matchSnooze = snoozeMode === "show" ? true : snoozeMode === "only" ? snoozed : !snoozed;
    const matchAssign =
      assignFilter === "all" ? true :
      assignFilter === "mine" ? s.assigned_to === myUserId :
      !s.assigned_to;
    return matchProject && matchProvider && matchSearch && matchUnread && matchSnooze && matchAssign;
  }).sort((a, b) => {
    const ua = isUnreadSession(a) ? 1 : 0;
    const ub = isUnreadSession(b) ? 1 : 0;
    if (ua !== ub) return ub - ua;
    const ta = new Date(a.last_message_at || a.updated_at || a.created_at || 0).getTime();
    const tb = new Date(b.last_message_at || b.updated_at || b.created_at || 0).getTime();
    return tb - ta;
  });

  const snoozedCount = sessions.filter(isSnoozed).length;

  const totalUnread = sessions.reduce(
    (acc, s) => acc + (isUnreadSession(s) ? Math.max(s.unread_count || 0, 1) : 0),
    0,
  );

  return (
    <div className="flex flex-col h-full border-r border-border bg-card">
      {/* Header */}
      <div className="p-3 space-y-2 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm text-foreground flex items-center gap-2">
            Conversas
            {totalUnread > 0 && (
              <span className="text-[10px] font-bold bg-emerald-500 text-white rounded-full px-1.5 py-0.5 leading-none">
                {totalUnread} nova{totalUnread > 1 ? "s" : ""}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={cycleAssignFilter}
              className={`text-[10px] h-7 px-2 rounded-md border transition-colors ${
                assignFilter === "mine" ? "bg-blue-500/15 border-blue-500/50 text-blue-300"
                : assignFilter === "unassigned" ? "bg-amber-500/15 border-amber-500/50 text-amber-300"
                : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/60"
              }`}
              title="Filtro de atribuição: clique para alternar"
            >
              {assignFilter === "all" ? "👥 Todas" : assignFilter === "mine" ? "👤 Minhas" : "❓ Sem dono"}
            </button>
            <button
              onClick={() => setOnlyUnread(v => !v)}
              className={`text-[10px] h-7 px-2 rounded-md border transition-colors ${onlyUnread ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-400" : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/60"}`}
              title="Mostrar apenas não lidas"
            >
              Não lidas
            </button>
            <button
              onClick={cycleSnoozeMode}
              className={`text-[10px] h-7 px-2 rounded-md border transition-colors ${
                snoozeMode === "only" ? "bg-purple-500/20 border-purple-500/50 text-purple-300"
                : snoozeMode === "show" ? "bg-muted/30 border-border text-muted-foreground hover:bg-muted/60"
                : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/60"
              }`}
              title="Silenciadas: clique para alternar (ocultar / mostrar / só silenciadas)"
            >
              {snoozeMode === "hide" ? "🔕 Ocultar" : snoozeMode === "show" ? "🔔 Todas" : "🔕 Só silenciadas"}
              {snoozedCount > 0 && snoozeMode !== "only" && <span className="ml-1 opacity-70">({snoozedCount})</span>}
            </button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onNewSession} title="Nova sessão">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar contato ou telefone..."
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Select value={filterProject} onValueChange={onFilterProject}>
          <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="Filtrar projeto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Projetos</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {onFilterProvider && providers && providers.length > 1 && (() => {
          // Filter chip-tabs to chips of the active project (or all if "all")
          const visibleProvs = filterProject === "all"
            ? providers
            : providers.filter(p => p.project_id === filterProject);
          if (visibleProvs.length < 2) return null;
          // Unread/count per chip respecting current project filter
          const countFor = (provId: string | "all") => sessions.filter(s => {
            const matchProject = filterProject === "all" || s.project_id === filterProject;
            return matchProject && (provId === "all" || s.provider_id === provId);
          }).length;
          // Activity in last 24h per provider (for cross-instance "novo" hint)
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
                className={`shrink-0 text-[10px] px-2 h-6 rounded-md border transition-colors ${filterProvider === "all" ? "bg-primary/15 border-primary/40 text-primary" : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/60"}`}
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
                    className={`relative shrink-0 text-[10px] px-2 h-6 rounded-md border transition-colors flex items-center gap-1.5 ${active ? "text-foreground" : "text-muted-foreground hover:bg-muted/60"}`}
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
        <MergeDuplicatesButton projectId={filterProject} />
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
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <MessageSquare className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              {search ? "Nenhum resultado" : "Nenhuma conversa"}
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              {search ? "Tente outro termo de busca" : "Crie sua primeira sessão para começar"}
            </p>
            {!search && (
              <Button size="sm" variant="outline" onClick={onNewSession}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Nova Sessão
              </Button>
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
              return (
                <button
                  key={s.id}
                  onClick={() => onSelect(s)}
                  className={`group w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/50 border-l-[3px] ${
                    isSelected
                      ? "bg-accent border-l-primary"
                      : hasUnread
                        ? "border-l-emerald-400 bg-emerald-500/10"
                        : "border-l-transparent"
                  }`}
                  title={provLabel ? `Instância: ${provLabel}` : undefined}
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
                              .update({ avatar_url: null } as any)
                              .eq("id", s.id);
                          }}
                        />
                      )}
                      <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                        {getInitials(s.contact_name, s.phone)}
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
                        <span className={`text-sm truncate ${hasUnread ? "font-bold text-white" : "font-medium text-foreground"}`}>
                          {s.contact_name || s.phone}
                        </span>
                        {channel && (
                          <Badge
                            variant="outline"
                            className={`text-[9px] h-4 px-1.5 shrink-0 font-medium ${channel.cls}`}
                            title={channel.label}
                          >
                            {channel.icon} {channel.label}
                          </Badge>
                        )}
                        {provLabel && (
                          <Badge
                            variant="outline"
                            className="text-[9px] h-4 px-1.5 shrink-0 font-medium"
                            style={{
                              background: `${color.replace("hsl", "hsla").replace(")", ", 0.15)")}`,
                              borderColor: `${color.replace("hsl", "hsla").replace(")", ", 0.5)")}`,
                              color,
                            }}
                          >
                            {provLabel}
                          </Badge>
                        )}
                        {s.jid_suffix === "lid" && (
                          <Badge
                            variant="outline"
                            className="text-[9px] h-4 px-1.5 shrink-0 font-medium bg-amber-500/15 border-amber-500/50 text-amber-500"
                            title="Contato com privacidade ativa (Linked ID). Resposta funciona normalmente."
                          >
                            🔒 LID
                          </Badge>
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
                    {s.contact_name && (
                      <p className="text-[10px] text-muted-foreground/80 font-mono truncate">📞 {s.phone}</p>
                    )}
                    <div className="flex items-center justify-between mt-0.5 gap-2">
                      <p className={`text-xs truncate pr-2 flex items-center gap-1 ${hasUnread ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                        {s.last_message_direction === "out" && !hasUnread && (
                          <span className="text-[10px] text-muted-foreground/70 shrink-0">↩</span>
                        )}
                        <span className="truncate">{s.last_message || (s.contact_name ? "" : s.phone)}</span>
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
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Footer count */}
      <div className="p-2 border-t border-border shrink-0">
        <p className="text-[10px] text-muted-foreground text-center">{filtered.length} conversa(s)</p>
      </div>
    </div>
  );
}

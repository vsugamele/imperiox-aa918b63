import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WaSession {
  id: string; phone: string; contact_name: string | null;
  session: string; project_id: string; status: string;
  message_count: number; metadata: any; created_at: string;
  provider_id: string | null;
  last_message?: string | null;
  updated_at?: string;
  last_message_at?: string | null;
  avatar_url?: string | null;
  unread_count?: number;
  last_message_direction?: string | null;
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
}

function timeAgo(dateStr: string | undefined) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
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

export default function ConversationList({
  sessions, projects, providers, selectedId, loading, onSelect, onNewSession,
  filterProject, onFilterProject, filterProvider = "all", onFilterProvider,
}: Props) {
  const [search, setSearch] = useState("");
  const [onlyUnread, setOnlyUnread] = useState(false);

  const projectName = (id: string) => projects.find(p => p.id === id)?.name || "";
  const findProvider = (providerId: string | null) =>
    providerId && providers ? providers.find(p => p.id === providerId) : undefined;

  const filtered = sessions.filter(s => {
    const matchProject = filterProject === "all" || s.project_id === filterProject;
    const matchProvider = filterProvider === "all" || s.provider_id === filterProvider;
    const matchSearch = !search ||
      (s.contact_name || "").toLowerCase().includes(search.toLowerCase()) ||
      s.phone.includes(search);
    const matchUnread = !onlyUnread || (s.unread_count || 0) > 0;
    return matchProject && matchProvider && matchSearch && matchUnread;
  }).sort((a, b) => {
    const ta = new Date(a.last_message_at || a.updated_at || a.created_at || 0).getTime();
    const tb = new Date(b.last_message_at || b.updated_at || b.created_at || 0).getTime();
    return tb - ta;
  });

  const totalUnread = sessions.reduce((acc, s) => acc + (s.unread_count || 0), 0);

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
              onClick={() => setOnlyUnread(v => !v)}
              className={`text-[10px] h-7 px-2 rounded-md border transition-colors ${onlyUnread ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-400" : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/60"}`}
              title="Mostrar apenas não lidas"
            >
              Não lidas
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
                return (
                  <button
                    key={p.id}
                    onClick={() => onFilterProvider(p.id)}
                    className={`shrink-0 text-[10px] px-2 h-6 rounded-md border transition-colors flex items-center gap-1.5 ${active ? "text-foreground" : "text-muted-foreground hover:bg-muted/60"}`}
                    style={active ? { background: `${color.replace("hsl", "hsla").replace(")", ", 0.18)")}`, borderColor: `${color.replace("hsl", "hsla").replace(")", ", 0.55)")}` } : { background: "hsl(var(--muted) / 0.3)", borderColor: "hsl(var(--border))" }}
                    title={providerLabel(p) || p.id}
                  >
                    <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                    {providerLabel(p) || "Chip"} <span className="opacity-60">({countFor(p.id)})</span>
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
              return (
                <button
                  key={s.id}
                  onClick={() => onSelect(s)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/50 ${
                    isSelected ? "bg-accent" : ""
                  }`}
                  title={provLabel ? `Instância: ${provLabel}` : undefined}
                >
                  <div className="relative shrink-0">
                    <Avatar className="h-10 w-10">
                      {s.avatar_url && <AvatarImage src={s.avatar_url} alt={s.contact_name || s.phone} />}
                      <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                        {getInitials(s.contact_name, s.phone)}
                      </AvatarFallback>
                    </Avatar>
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
                        <span className="text-sm font-medium truncate">
                          {s.contact_name || s.phone}
                        </span>
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
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {timeAgo(s.updated_at || s.created_at)}
                      </span>
                    </div>
                    {s.contact_name && (
                      <p className="text-[10px] text-muted-foreground/80 font-mono truncate">📞 {s.phone}</p>
                    )}
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-muted-foreground truncate pr-2">
                        {s.last_message || (s.contact_name ? "" : s.phone)}
                      </p>
                      {s.message_count > 0 && (
                        <Badge variant="secondary" className="text-[9px] h-4 px-1.5 shrink-0">
                          {s.message_count}
                        </Badge>
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

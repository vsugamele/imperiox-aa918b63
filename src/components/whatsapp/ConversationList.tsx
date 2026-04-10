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
  avatar_url?: string | null;
}

interface Props {
  sessions: WaSession[];
  projects: { id: string; name: string }[];
  providers?: { id: string; instance_name?: string; twilio_from?: string; provider: string; project_id: string }[];
  selectedId: string | null;
  loading: boolean;
  onSelect: (session: WaSession) => void;
  onNewSession: () => void;
  filterProject: string;
  onFilterProject: (v: string) => void;
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

export default function ConversationList({
  sessions, projects, providers, selectedId, loading, onSelect, onNewSession, filterProject, onFilterProject,
}: Props) {
  const [search, setSearch] = useState("");

  const projectName = (id: string) => projects.find(p => p.id === id)?.name || "";
  const getProviderLabel = (providerId: string | null) => {
    if (!providerId || !providers) return null;
    const prov = providers.find(p => p.id === providerId);
    if (!prov) return null;
    if (prov.provider === "evolution") return prov.instance_name || "Evolution";
    return prov.twilio_from ? `Twilio ...${prov.twilio_from.slice(-4)}` : "Twilio";
  };

  const filtered = sessions.filter(s => {
    const matchProject = filterProject === "all" || s.project_id === filterProject;
    const matchSearch = !search || 
      (s.contact_name || "").toLowerCase().includes(search.toLowerCase()) ||
      s.phone.includes(search);
    return matchProject && matchSearch;
  });

  return (
    <div className="flex flex-col h-full border-r border-border bg-card">
      {/* Header */}
      <div className="p-3 space-y-2 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm text-foreground">Conversas</h2>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onNewSession} title="Nova sessão">
            <Plus className="h-4 w-4" />
          </Button>
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
              const provLabel = getProviderLabel(s.provider_id);
              return (
                <button
                  key={s.id}
                  onClick={() => onSelect(s)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/50 ${
                    isSelected ? "bg-accent" : ""
                  }`}
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    {s.avatar_url && <AvatarImage src={s.avatar_url} alt={s.contact_name || s.phone} />}
                    <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                      {getInitials(s.contact_name, s.phone)}
                    </AvatarFallback>
                  </Avatar>
                    <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">
                        {s.contact_name || s.phone}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
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
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-[10px] text-muted-foreground/70 truncate">
                        {projectName(s.project_id)}
                      </p>
                      {provLabel && (
                        <Badge variant="outline" className="text-[8px] h-3.5 px-1 shrink-0 font-normal">
                          {provLabel}
                        </Badge>
                      )}
                    </div>
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

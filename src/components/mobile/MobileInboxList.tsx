import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MobileChat } from "./MobileChat";
import { Loader2, Search, Flame, PauseCircle, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Conv {
  id: string;
  project_id: string;
  contact_name: string | null;
  phone: string;
  provider_id: string | null;
  last_message: string | null;
  last_message_at: string | null;
  last_message_direction: string | null;
  unread_count: number | null;
  ai_paused_until: string | null;
  buy_intent_detected: boolean | null;
  temperature: string | null;
  avatar_url: string | null;
  lead_id?: string | null;
  status?: string | null;
}

type Filter = "all" | "unread" | "hot" | "paused";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "unread", label: "Não lidas" },
  { key: "hot", label: "🔥 Quentes" },
  { key: "paused", label: "IA pausada" },
];

export function MobileInboxList() {
  const [convs, setConvs] = useState<Conv[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Conv | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("imphq_wa_conversations")
      .select("id, project_id, contact_name, phone, provider_id, last_message, last_message_at, last_message_direction, unread_count, ai_paused_until, buy_intent_detected, temperature, avatar_url, lead_id, status")
      .neq("status", "closed")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(200);
    setConvs((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("mob-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "imphq_wa_conversations" }, (p: any) => {
        setConvs(prev => {
          const c = p.new as Conv;
          if (!c?.id) return prev;
          const rest = prev.filter(x => x.id !== c.id);
          return [c, ...rest].sort((a, b) =>
            new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()
          );
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => {
    const now = Date.now();
    const term = q.trim().toLowerCase();
    return convs.filter(c => {
      if (filter === "unread" && !(c.unread_count && c.unread_count > 0)) return false;
      if (filter === "hot" && !(c.temperature === "hot" || c.buy_intent_detected)) return false;
      if (filter === "paused" && !(c.ai_paused_until && new Date(c.ai_paused_until).getTime() > now)) return false;
      if (term) {
        const hay = `${c.contact_name || ""} ${c.phone || ""} ${c.last_message || ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [convs, filter, q]);

  const togglePause = async (c: Conv) => {
    const isPaused = !!(c.ai_paused_until && new Date(c.ai_paused_until) > new Date());
    const next = isPaused ? null : new Date(Date.now() + 30 * 60_000).toISOString();
    await supabase.from("imphq_wa_conversations").update({ ai_paused_until: next } as any).eq("id", c.id);
    toast.success(isPaused ? "IA retomada" : "IA pausada por 30min");
    setConvs(prev => prev.map(x => x.id === c.id ? { ...x, ai_paused_until: next } : x));
  };

  const toggleCloser = async (c: Conv) => {
    const next = !c.buy_intent_detected;
    await supabase.from("imphq_wa_conversations").update({ buy_intent_detected: next } as any).eq("id", c.id);
    toast.success(next ? "Closer mode ON" : "Closer mode OFF");
    setConvs(prev => prev.map(x => x.id === c.id ? { ...x, buy_intent_detected: next } : x));
  };

  const markRead = async (id: string) => {
    setConvs(prev => prev.map(x => x.id === id ? { ...x, unread_count: 0 } : x));
    await supabase.from("imphq_wa_conversations")
      .update({ unread_count: 0, last_read_at: new Date().toISOString() } as any)
      .eq("id", id);
  };

  return (
    <>
      <div className="flex flex-col h-full -m-3 md:-m-6">
        {/* Search + filter chips */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-xl border-b border-border/50 px-3 pt-3 pb-2 space-y-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar conversa..."
              className="pl-9 h-11 text-base bg-secondary/40 border-border/50"
              style={{ fontSize: "16px" }}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "shrink-0 px-3 h-8 rounded-full text-xs font-semibold border whitespace-nowrap transition-colors",
                  filter === f.key
                    ? "bg-gold/15 border-gold/50 text-gold"
                    : "bg-secondary/40 border-border/50 text-muted-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-60 gap-3 px-6 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground/30" />
              <p className="font-serif italic text-lg text-gold">Sem conversas por aqui</p>
              <p className="text-xs text-muted-foreground">Ajuste os filtros ou aguarde novas mensagens.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {filtered.map(c => (
                <ConvRow
                  key={c.id}
                  c={c}
                  onOpen={() => { setSelected(c); markRead(c.id); }}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {selected && (
        <MobileChat
          conversation={{
            id: selected.id,
            project_id: selected.project_id,
            contact_name: selected.contact_name || "",
            phone: selected.phone,
            provider_id: selected.provider_id,
            ai_paused_until: selected.ai_paused_until,
            buy_intent_detected: selected.buy_intent_detected,
            temperature: selected.temperature,
            lead_id: selected.lead_id,
          }}
          onClose={() => setSelected(null)}
          onTogglePause={togglePause}
          onToggleCloser={toggleCloser}
        />
      )}
    </>
  );
}

function ConvRow({ c, onOpen }: { c: Conv; onOpen: () => void }) {
  const isHot = c.temperature === "hot" || c.buy_intent_detected;
  const isPaused = c.ai_paused_until && new Date(c.ai_paused_until) > new Date();
  const unread = (c.unread_count || 0) > 0;
  const initials = (c.contact_name || c.phone || "?")
    .split(" ").slice(0, 2).map(s => s[0]).join("").toUpperCase();

  return (
    <li>
      <button
        onClick={onOpen}
        className="w-full flex items-center gap-3 px-3 py-3 hover:bg-secondary/30 active:bg-secondary/50 text-left"
      >
        <div className={cn(
          "h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ring-2 overflow-hidden",
          isHot ? "bg-orange-500/20 text-orange-300 ring-orange-500/50" : "bg-gold/15 text-gold ring-gold/30"
        )}>
          {c.avatar_url ? (
            <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={cn("truncate text-sm", unread ? "font-bold text-foreground" : "font-medium text-foreground/90")}>
              {c.contact_name || c.phone}
            </span>
            {isHot && <Flame className="h-3.5 w-3.5 text-orange-400 fill-orange-400 shrink-0" />}
            {isPaused && <PauseCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          </div>
          <p className={cn("text-xs truncate mt-0.5", unread ? "text-foreground/80" : "text-muted-foreground")}>
            {c.last_message_direction === "outgoing" && <span className="text-muted-foreground/70">Você: </span>}
            {c.last_message || "—"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[10px] text-muted-foreground">
            {c.last_message_at ? formatDistanceToNow(new Date(c.last_message_at), { locale: ptBR, addSuffix: false }) : ""}
          </span>
          {unread && (
            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-gold text-background text-[10px] font-bold flex items-center justify-center">
              {c.unread_count! > 99 ? "99+" : c.unread_count}
            </span>
          )}
        </div>
      </button>
    </li>
  );
}

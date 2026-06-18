import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ArrowLeft, Send, Loader2, PauseCircle, PlayCircle, Flame, ExternalLink,
  UserCheck, RefreshCw, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface Message {
  id: string;
  conversation_id: string;
  direction: "incoming" | "outgoing" | string;
  content: string | null;
  message_type?: string | null;
  created_at: string;
  status?: string | null;
  sent_by?: string | null;
  media_url?: string | null;
  _optimistic?: boolean;
}

interface ConversationLite {
  id: string;
  project_id: string;
  contact_name: string;
  phone: string;
  ai_paused_until: string | null;
  buy_intent_detected: boolean | null;
  temperature: string | null;
  provider_id: string | null;
  lead_id?: string | null;
}

interface Props {
  conversation: ConversationLite;
  onClose: () => void;
  onTogglePause: (c: any) => void;
  onToggleCloser: (c: any) => void;
}

const PAGE = 40;

export function MobileChat({ conversation, onClose, onTogglePause, onToggleCloser }: Props) {
  const navigate = useNavigate();
  const [conv, setConv] = useState(conversation);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const newestRef = useRef<string | null>(null);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("imphq_wa_messages")
      .select("*")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: false })
      .limit(PAGE);
    const sorted = ((data as any[]) || []).reverse();
    setMessages(sorted);
    if (sorted.length) newestRef.current = sorted[sorted.length - 1].created_at;
    setHasMore((data?.length || 0) >= PAGE);
    setLoading(false);
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
  }, [conv.id]);

  const loadMore = async () => {
    if (!hasMore || loadingMore || messages.length === 0) return;
    setLoadingMore(true);
    const oldest = messages[0].created_at;
    const prevH = scrollRef.current?.scrollHeight || 0;
    const { data } = await supabase
      .from("imphq_wa_messages")
      .select("*")
      .eq("conversation_id", conv.id)
      .lt("created_at", oldest)
      .order("created_at", { ascending: false })
      .limit(PAGE);
    const older = ((data as any[]) || []).reverse();
    setMessages(prev => [...older, ...prev]);
    setHasMore((data?.length || 0) >= PAGE);
    setLoadingMore(false);
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight - prevH;
    });
  };

  useEffect(() => { loadInitial(); }, [loadInitial]);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel(`mc-${conv.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "imphq_wa_messages", filter: `conversation_id=eq.${conv.id}` },
        (payload) => {
          const m = payload.new as any;
          setMessages(prev => {
            if (prev.some(x => x.id === m.id)) return prev;
            const cleaned = prev.filter(x => !x._optimistic);
            newestRef.current = m.created_at;
            return [...cleaned, m];
          });
          setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 80);
        })
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "imphq_wa_messages", filter: `conversation_id=eq.${conv.id}` },
        (payload) => {
          const m = payload.new as any;
          setMessages(prev => prev.map(x => x.id === m.id ? { ...x, ...m } : x));
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conv.id]);

  const handleSend = async () => {
    const body = text.trim();
    if (!body || sending) return;
    if (!conv.provider_id) {
      toast.error("Nenhum provider WhatsApp configurado para este projeto.");
      return;
    }
    setSending(true);
    const optimistic: Message = {
      id: `opt-${Date.now()}`,
      conversation_id: conv.id,
      direction: "outgoing",
      content: body,
      message_type: "text",
      created_at: new Date().toISOString(),
      status: "sending",
      sent_by: "human",
      _optimistic: true,
    };
    setMessages(prev => [...prev, optimistic]);
    setText("");
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 30);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-api?action=send_message", {
        body: {
          provider_id: conv.provider_id,
          phone: conv.phone,
          content: body,
          conversation_id: conv.id,
          project_id: conv.project_id,
          sent_by: "human",
        },
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error || "Falha ao enviar");
      try { (navigator as any).vibrate?.(15); } catch {}
    } catch (err: any) {
      toast.error("Erro: " + err.message);
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setText(body);
    } finally {
      setSending(false);
    }
  };

  const isPaused = useMemo(
    () => !!(conv.ai_paused_until && new Date(conv.ai_paused_until) > new Date()),
    [conv.ai_paused_until]
  );
  const isHot = conv.temperature === "hot" || conv.buy_intent_detected;

  const togglePause = async () => {
    await onTogglePause(conv);
    setConv(c => ({
      ...c,
      ai_paused_until: isPaused ? null : new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    }));
  };
  const toggleCloser = async () => {
    await onToggleCloser(conv);
    setConv(c => ({ ...c, buy_intent_detected: !c.buy_intent_detected }));
  };

  const initials = (conv.contact_name || conv.phone || "?")
    .split(" ").slice(0, 2).map(s => s[0]).join("").toUpperCase();

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="shrink-0 border-b border-border/50 bg-background/95 backdrop-blur"
           style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="flex items-center gap-2 px-2 py-2.5">
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={onClose}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className={cn(
            "h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ring-2",
            isHot ? "bg-orange-500/20 text-orange-300 ring-orange-500/50" : "bg-gold/15 text-gold ring-gold/30"
          )}>
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm truncate text-foreground flex items-center gap-1.5">
              {conv.contact_name || conv.phone}
              {isHot && <Flame className="h-3.5 w-3.5 text-orange-400 fill-orange-400 shrink-0" />}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              {conv.phone}{isPaused && " · IA pausada"}
            </div>
          </div>
          {conv.lead_id && (
            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0"
                    onClick={() => navigate(`/lead/${conv.lead_id}`)}>
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={loadInitial}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
        {/* Quick actions */}
        <div className="flex gap-2 px-3 pb-2 overflow-x-auto">
          <QuickAction
            active={isPaused}
            icon={isPaused ? PlayCircle : PauseCircle}
            label={isPaused ? "Retomar IA" : "Pausar IA 30min"}
            onClick={togglePause}
          />
          <QuickAction
            active={!!conv.buy_intent_detected}
            icon={Flame}
            label="Closer Mode"
            onClick={toggleCloser}
          />
          <QuickAction
            icon={UserCheck}
            label="WA externo"
            onClick={() => window.open(`https://api.whatsapp.com/send?phone=${conv.phone.replace(/\D/g, "")}`, "_blank")}
          />
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-secondary/10">
        {hasMore && (
          <button onClick={loadMore}
                  className="mx-auto block text-xs text-muted-foreground hover:text-gold px-3 py-1.5 rounded-full bg-secondary/60 border border-border/40 flex items-center gap-1">
            {loadingMore ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronUp className="h-3 w-3" />}
            Carregar mais
          </button>
        )}
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando conversa…
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Sem mensagens ainda. Mande a primeira.
          </div>
        ) : (
          messages.map((m, i) => <Bubble key={m.id} msg={m} prev={messages[i - 1]} />)
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-border/50 bg-background/95 backdrop-blur px-2 py-2"
           style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}>
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.metaKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder="Mensagem..."
            rows={1}
            className="flex-1 resize-none rounded-2xl bg-secondary/60 border border-border/60 px-4 py-2.5 text-sm leading-5 focus:outline-none focus:ring-1 focus:ring-gold max-h-32 min-h-[42px]"
            style={{ fontSize: "16px" }} // evita zoom no iOS
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!text.trim() || sending}
            className="h-11 w-11 rounded-full bg-gold hover:bg-gold/90 text-background shrink-0"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick, active }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 flex items-center gap-1.5 px-3 h-9 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap",
        active
          ? "bg-gold/15 border-gold/50 text-gold"
          : "bg-secondary/50 border-border/50 text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function Bubble({ msg, prev }: { msg: Message; prev?: Message }) {
  const isOut = msg.direction === "outgoing";
  const sameAuthorAsPrev = prev && prev.direction === msg.direction;
  const showTimeGap = !prev || (new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() > 1000 * 60 * 30);
  const isAi = msg.sent_by === "ai" || msg.sent_by === "bot";
  const isImage = msg.message_type === "image" && msg.media_url;
  const isAudio = msg.message_type === "audio" && msg.media_url;

  return (
    <>
      {showTimeGap && (
        <div className="text-center text-[10px] uppercase tracking-wider text-muted-foreground/70 py-2">
          {format(new Date(msg.created_at), "dd MMM HH:mm", { locale: ptBR })}
        </div>
      )}
      <div className={cn("flex", isOut ? "justify-end" : "justify-start", sameAuthorAsPrev ? "mt-0.5" : "mt-1.5")}>
        <div className={cn(
          "max-w-[82%] rounded-2xl px-3 py-2 text-sm break-words shadow-sm",
          isOut
            ? isAi
              ? "bg-gold/10 border border-gold/30 text-foreground rounded-br-sm"
              : "bg-gold text-background rounded-br-sm"
            : "bg-secondary/80 border border-border/40 text-foreground rounded-bl-sm"
        )}>
          {isOut && isAi && (
            <div className="text-[10px] uppercase tracking-wider font-bold text-gold/80 mb-0.5">IA</div>
          )}
          {isImage ? (
            <img src={msg.media_url!} alt="" className="rounded-lg max-h-64 mb-1" loading="lazy" />
          ) : isAudio ? (
            <audio controls src={msg.media_url!} className="max-w-full" />
          ) : null}
          {msg.content && <div className="whitespace-pre-wrap leading-snug">{msg.content}</div>}
          <div className={cn(
            "text-[9px] mt-1 flex items-center gap-1 justify-end",
            isOut && !isAi ? "text-background/70" : "text-muted-foreground"
          )}>
            {format(new Date(msg.created_at), "HH:mm")}
            {msg.status === "sending" && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
            {msg.status === "failed" && <span className="text-destructive">!</span>}
          </div>
        </div>
      </div>
    </>
  );
}

import React, { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, FileText, ChevronUp, Check, CheckCheck, Image, Paperclip, Smile, Download } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

const PAGE_SIZE = 50;

interface Message {
  id: string;
  direction: string;
  content: string;
  phone: string;
  created_at: string;
  status: string;
  message_type?: string;
  media_url?: string;
  _optimistic?: boolean;
}

interface WaTemplate {
  id: string; name: string; content: string; category: string; project_id: string | null;
}

interface Props {
  conversationId: string;
  phone: string;
  projectId: string;
  providerId: string | null;
}

const EMOJI_LIST = ["😀", "😂", "❤️", "👍", "🙏", "🔥", "✅", "⭐", "💪", "🎉", "😍", "🤝", "💰", "📦", "🚀", "💡"];

// Status indicators
function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "sending":
      return <Loader2 className="h-2.5 w-2.5 animate-spin" />;
    case "sent":
    case "pending":
      return <Check className="h-2.5 w-2.5" />;
    case "delivered":
      return <CheckCheck className="h-2.5 w-2.5" />;
    case "read":
    case "played":
      return <CheckCheck className="h-2.5 w-2.5 text-sky-400" />;
    case "error":
      return <span className="text-destructive text-[9px]">!</span>;
    default:
      return <Check className="h-2.5 w-2.5" />;
  }
}

// Media renderers
function MediaContent({ message }: { message: Message }) {
  const { message_type, media_url, content } = message;

  if (!media_url && message_type === "text") return null;

  if (message_type === "image" && media_url) {
    return (
      <div className="mb-1">
        <img
          src={media_url}
          alt="Imagem"
          className="rounded-lg max-w-full max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => window.open(media_url, "_blank")}
          loading="lazy"
        />
      </div>
    );
  }

  if (message_type === "audio" && media_url) {
    return (
      <div className="mb-1">
        <audio controls className="max-w-full h-8" preload="none">
          <source src={media_url} />
        </audio>
      </div>
    );
  }

  if (message_type === "video" && media_url) {
    return (
      <div className="mb-1">
        <video controls className="rounded-lg max-w-full max-h-56" preload="none">
          <source src={media_url} />
        </video>
      </div>
    );
  }

  if (message_type === "document" && media_url) {
    return (
      <a
        href={media_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 bg-background/30 rounded-lg px-3 py-2 mb-1 hover:bg-background/50 transition-colors"
      >
        <FileText className="h-5 w-5 shrink-0" />
        <span className="text-xs truncate flex-1">{content}</span>
        <Download className="h-3.5 w-3.5 shrink-0 opacity-60" />
      </a>
    );
  }

  return null;
}

const ChatView = React.forwardRef<HTMLDivElement, Props>(
  ({ conversationId, phone, projectId, providerId }, ref) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [text, setText] = useState("");
    const [sending, setSending] = useState(false);
    const [templates, setTemplates] = useState<WaTemplate[]>([]);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [showEmoji, setShowEmoji] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const initialLoadDone = useRef(false);
    const newestTimestampRef = useRef<string | null>(null);

    useEffect(() => {
      supabase.from("imphq_wa_templates").select("*").order("name").then(({ data }) => setTemplates((data as any[]) || []));
    }, []);

    // Keep newestTimestampRef in sync
    useEffect(() => {
      if (messages.length > 0) {
        const real = messages.filter(m => !m._optimistic);
        if (real.length > 0) newestTimestampRef.current = real[real.length - 1].created_at;
      }
    }, [messages]);

    const loadInitial = useCallback(async () => {
      const { data } = await supabase
        .from("imphq_wa_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      const sorted = ((data as any[]) || []).reverse();
      setMessages(sorted);
      setHasMore((data?.length || 0) >= PAGE_SIZE);
      initialLoadDone.current = true;
    }, [conversationId]);

    const loadMore = async () => {
      if (!hasMore || loadingMore || messages.length === 0) return;
      setLoadingMore(true);
      const oldest = messages[0]?.created_at;
      const { data } = await supabase
        .from("imphq_wa_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .lt("created_at", oldest)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      const older = ((data as any[]) || []).reverse();
      setMessages(prev => [...older, ...prev]);
      setHasMore((data?.length || 0) >= PAGE_SIZE);
      setLoadingMore(false);
    };

    const pollNew = useCallback(async () => {
      if (!initialLoadDone.current || !newestTimestampRef.current) return;
      const { data } = await supabase
        .from("imphq_wa_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .gt("created_at", newestTimestampRef.current)
        .order("created_at", { ascending: true });
      if (data && data.length > 0) {
        setMessages(prev => {
          const withoutOptimistic = prev.filter(m => !m._optimistic);
          return [...withoutOptimistic, ...(data as any[])];
        });
      }
    }, [conversationId]);

    useEffect(() => {
      initialLoadDone.current = false;
      newestTimestampRef.current = null;
      loadInitial();
    }, [conversationId, loadInitial]);

    useEffect(() => {
      const interval = setInterval(pollNew, 8000);
      return () => clearInterval(interval);
    }, [pollNew]);

    useEffect(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Auto-resize textarea
    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      const el = e.target;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 120) + "px";
    };

    const send = async () => {
      if (!text.trim()) return;
      if (!providerId) { toast.error("Nenhum provider configurado para este projeto"); return; }

      const msgText = text;
      setText("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";

      const optimisticMsg: Message = {
        id: `opt-${Date.now()}`,
        direction: "outgoing",
        content: msgText,
        phone,
        created_at: new Date().toISOString(),
        status: "sending",
        message_type: "text",
        _optimistic: true,
      };
      setMessages(prev => [...prev, optimisticMsg]);

      setSending(true);
      try {
        const { data, error } = await supabase.functions.invoke("whatsapp-api?action=send_message", {
          body: { provider_id: providerId, phone, content: msgText, conversation_id: conversationId, project_id: projectId },
        });
        if (error) throw error;
        if (data && data.success === false) {
          toast.error(data.error || "Erro ao enviar mensagem");
          setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
          setText(msgText);
          setSending(false);
          return;
        }
        setTimeout(() => pollNew(), 500);
      } catch (err: any) {
        toast.error("Erro ao enviar: " + err.message);
        setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
        setText(msgText);
      } finally {
        setSending(false);
      }
    };

    // Group messages by date
    const getDateLabel = (dateStr: string) => {
      const d = new Date(dateStr);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      
      if (d.toDateString() === today.toDateString()) return "Hoje";
      if (d.toDateString() === yesterday.toDateString()) return "Ontem";
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    let lastDateLabel = "";

    return (
      <div ref={ref} className="flex flex-col h-full">
        {/* Chat area with WhatsApp-like pattern background */}
        <div className="flex-1 overflow-y-auto" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}>
          <div className="p-4 space-y-1 max-w-3xl mx-auto">
            {hasMore && (
              <div className="flex justify-center mb-2">
                <Button size="sm" variant="ghost" className="text-xs gap-1 bg-background/80 backdrop-blur-sm rounded-full shadow-sm" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronUp className="h-3 w-3" />}
                  Carregar anteriores
                </Button>
              </div>
            )}
            {messages.map((m) => {
              const dateLabel = getDateLabel(m.created_at);
              const showDate = dateLabel !== lastDateLabel;
              lastDateLabel = dateLabel;
              const isOutgoing = m.direction === "outgoing";

              return (
                <React.Fragment key={m.id}>
                  {showDate && (
                    <div className="flex justify-center py-2">
                      <span className="text-[10px] bg-background/90 backdrop-blur-sm text-muted-foreground px-3 py-1 rounded-full shadow-sm font-medium">
                        {dateLabel}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${isOutgoing ? "justify-end" : "justify-start"} group`}>
                    <div className={`relative max-w-[75%] rounded-xl px-3 py-1.5 text-sm shadow-sm
                      ${isOutgoing
                        ? "bg-emerald-600/90 text-white rounded-br-sm"
                        : "bg-card text-card-foreground rounded-bl-sm border border-border/50"
                      }
                      ${m._optimistic ? "opacity-60" : ""}
                    `}>
                      <MediaContent message={m} />
                      {/* Don't show text if it's a media-only placeholder and we have media_url */}
                      {!(m.media_url && m.message_type === "image" && !m.content?.includes(" ")) && (
                        <p className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
                      )}
                      <div className={`flex items-center gap-1 justify-end mt-0.5 -mb-0.5
                        ${isOutgoing ? "text-white/60" : "text-muted-foreground"}
                      `}>
                        <span className="text-[10px]">
                          {m._optimistic
                            ? "Enviando..."
                            : new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                          }
                        </span>
                        {isOutgoing && <StatusIcon status={m._optimistic ? "sending" : m.status} />}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                  <Send className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground mb-1">Nenhuma mensagem ainda</p>
                <p className="text-xs text-muted-foreground">Envie a primeira mensagem abaixo 👇</p>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input area */}
        <div className="border-t border-border bg-card p-3 shrink-0">
          <div className="flex items-end gap-2 max-w-3xl mx-auto">
            {/* Emoji picker */}
            <Popover open={showEmoji} onOpenChange={setShowEmoji}>
              <PopoverTrigger asChild>
                <Button size="icon" variant="ghost" className="shrink-0 h-9 w-9 rounded-full" title="Emojis">
                  <Smile className="h-5 w-5 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-2" align="start" side="top">
                <div className="grid grid-cols-8 gap-0.5">
                  {EMOJI_LIST.map(e => (
                    <button key={e} className="text-lg hover:bg-muted rounded p-0.5 transition-colors"
                      onClick={() => { setText(prev => prev + e); setShowEmoji(false); textareaRef.current?.focus(); }}>
                      {e}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Templates */}
            {templates.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="icon" variant="ghost" className="shrink-0 h-9 w-9 rounded-full" title="Templates">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-1" align="start" side="top">
                  <p className="text-[10px] text-muted-foreground px-2 py-1 font-semibold">Templates</p>
                  {templates.map(t => (
                    <button key={t.id} className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded transition-colors truncate"
                      onClick={() => { setText(t.content); textareaRef.current?.focus(); }}>
                      {t.name}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            )}

            {/* Message input */}
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              placeholder="Digite sua mensagem..."
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              disabled={sending}
              className="min-h-[36px] max-h-[120px] resize-none py-2 rounded-2xl bg-background border-border/50 text-sm"
              rows={1}
            />

            {/* Send button */}
            <Button
              size="icon"
              onClick={send}
              disabled={sending || !text.trim()}
              className="shrink-0 h-9 w-9 rounded-full bg-emerald-600 hover:bg-emerald-700"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    );
  }
);

ChatView.displayName = "ChatView";

export default ChatView;

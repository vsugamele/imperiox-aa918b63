import React, { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, FileText, ChevronUp } from "lucide-react";
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

const ChatView = React.forwardRef<HTMLDivElement, Props>(
  ({ conversationId, phone, projectId, providerId }, ref) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [text, setText] = useState("");
    const [sending, setSending] = useState(false);
    const [templates, setTemplates] = useState<WaTemplate[]>([]);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
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
          // Remove optimistic messages that now have real counterparts
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
      const interval = setInterval(pollNew, 5000);
      return () => clearInterval(interval);
    }, [pollNew]);

    useEffect(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const send = async () => {
      if (!text.trim()) return;
      if (!providerId) { toast.error("Nenhum provider configurado para este projeto"); return; }

      const msgText = text;
      setText("");

      // Optimistic insert
      const optimisticMsg: Message = {
        id: `opt-${Date.now()}`,
        direction: "outgoing",
        content: msgText,
        phone,
        created_at: new Date().toISOString(),
        status: "sending",
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
          // Remove optimistic on failure
          setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
          setText(msgText); // restore text
          setSending(false);
          return;
        }
        setTimeout(() => pollNew(), 500);
        toast.success("Mensagem enviada!");
      } catch (err: any) {
        toast.error("Erro ao enviar: " + err.message);
        setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
        setText(msgText);
      } finally {
        setSending(false);
      }
    };

    return (
      <div ref={ref} className="flex flex-col h-full">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-3">
            {hasMore && (
              <div className="flex justify-center">
                <Button size="sm" variant="ghost" className="text-xs gap-1" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronUp className="h-3 w-3" />}
                  Carregar anteriores
                </Button>
              </div>
            )}
            {messages.map(m => (
              <div key={m.id} className={`flex ${m.direction === "outgoing" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                  m.direction === "outgoing"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                } ${m._optimistic ? "opacity-60" : ""}`}>
                  <p>{m.content}</p>
                  <p className={`text-[10px] mt-1 flex items-center gap-1 ${m.direction === "outgoing" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {m._optimistic ? (
                      <><Loader2 className="h-2.5 w-2.5 animate-spin" /> Enviando...</>
                    ) : (
                      new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                    )}
                  </p>
                </div>
              </div>
            ))}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-sm text-muted-foreground mb-1">Nenhuma mensagem ainda</p>
                <p className="text-xs text-muted-foreground">Envie a primeira mensagem abaixo 👇</p>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
        <div className="border-t border-border p-3 flex gap-2 shrink-0">
          {templates.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button size="icon" variant="ghost" className="shrink-0" title="Usar template">
                  <FileText className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-1" align="start">
                <p className="text-[10px] text-muted-foreground px-2 py-1 font-semibold">Templates</p>
                {templates.map(t => (
                  <button key={t.id} className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded transition-colors truncate"
                    onClick={() => setText(t.content)}>
                    {t.name}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          )}
          <Input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Digite sua mensagem..."
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            disabled={sending}
          />
          <Button size="icon" onClick={send} disabled={sending || !text.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    );
  }
);

ChatView.displayName = "ChatView";

export default ChatView;

import { useEffect, useState, useRef, useCallback } from "react";
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

export default function ChatView({ conversationId, phone, projectId, providerId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    supabase.from("imphq_wa_templates").select("*").order("name").then(({ data }) => setTemplates((data as any[]) || []));
  }, []);

  // Initial load: last PAGE_SIZE messages by conversation_id only
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

  // Load older messages
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

  // Poll for new messages only
  const pollNew = useCallback(async () => {
    if (!initialLoadDone.current) return;
    const newest = messages[messages.length - 1]?.created_at;
    if (!newest) return;
    const { data } = await supabase
      .from("imphq_wa_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .gt("created_at", newest)
      .order("created_at", { ascending: true });
    if (data && data.length > 0) {
      setMessages(prev => [...prev, ...(data as any[])]);
    }
  }, [conversationId, messages]);

  useEffect(() => {
    initialLoadDone.current = false;
    loadInitial();
  }, [conversationId, loadInitial]);

  useEffect(() => {
    const interval = setInterval(pollNew, 30000);
    return () => clearInterval(interval);
  }, [pollNew]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!text.trim()) return;
    if (!providerId) { toast.error("Nenhum provider configurado para este projeto"); return; }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-api?action=send_message", {
        body: { provider_id: providerId, phone, content: text, conversation_id: conversationId, project_id: projectId },
      });
      if (error) throw error;
      setText("");
      // Reload messages after send
      setTimeout(() => pollNew(), 500);
      toast.success("Mensagem enviada!");
    } catch (err: any) {
      toast.error("Erro ao enviar: " + err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[500px]">
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
              }`}>
                <p>{m.content}</p>
                <p className={`text-[10px] mt-1 ${m.direction === "outgoing" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                  {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
          {messages.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhuma mensagem ainda</p>}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      <div className="border-t border-border p-3 flex gap-2">
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

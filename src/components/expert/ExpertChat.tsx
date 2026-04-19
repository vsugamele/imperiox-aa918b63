import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, MessageSquare, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface ChatMessage {
  id?: string;
  from: "expert" | "manager";
  content: string;
  content_id?: string | null;
  created_at: string;
}

interface ExpertChatProps {
  messages: ChatMessage[];
  onSend: (content: string, contentId?: string) => Promise<void>;
  contextLabel?: string;
  contentId?: string;
  compact?: boolean;
}

export function ExpertChat({ messages, onSend, contextLabel, contentId, compact }: ExpertChatProps) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter messages if a specific content is selected
  const visible = contentId
    ? messages.filter(m => m.content_id === contentId)
    : messages;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [visible.length]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    try {
      await onSend(text, contentId);
      setDraft("");
    } catch (e: any) {
      toast.error("Erro ao enviar: " + (e?.message || ""));
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardContent className={compact ? "p-3" : "p-4"}>
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">
            {contextLabel || "Chat com a gestão"}
          </p>
        </div>

        <ScrollArea className={compact ? "h-48" : "h-72"}>
          <div ref={scrollRef} className="space-y-2 pr-2">
            {visible.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                Nenhuma mensagem ainda. Comece a conversa abaixo 👇
              </p>
            ) : visible.map((m, i) => (
              <div
                key={m.id || i}
                className={`flex ${m.from === "expert" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    m.from === "expert"
                      ? "bg-primary/20 border border-primary/30 text-foreground"
                      : "bg-secondary border border-border text-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                  <p className="text-[9px] text-muted-foreground mt-1">
                    {m.from === "expert" ? "Você" : "Gestão"} • {format(new Date(m.created_at), "dd/MM HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex gap-2 mt-3">
          <Textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Escreva uma mensagem..."
            className="min-h-[60px] text-sm resize-none"
            onKeyDown={e => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button onClick={handleSend} disabled={sending || !draft.trim()} size="sm" className="self-end">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-[9px] text-muted-foreground mt-1">⌘/Ctrl + Enter para enviar</p>
      </CardContent>
    </Card>
  );
}

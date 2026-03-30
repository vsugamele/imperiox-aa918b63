import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, FileText } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

interface Message {
  id: string;
  direction: string;
  content: string;
  phone: string;
  created_at: string;
  status: string;
}

interface WaTemplate {
  id: string; nome: string; conteudo: string; categoria: string; project_id: string | null;
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
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("imphq_wa_templates").select("*").order("nome").then(({ data }) => setTemplates((data as any[]) || []));
  }, []);

  const loadMessages = async () => {
    const { data } = await supabase
      .from("imphq_wa_messages")
      .select("*")
      .or(`conversation_id.eq.${conversationId},conversation_id.eq.${phone}`)
      .order("created_at", { ascending: true });
    setMessages((data as any[]) || []);
  };

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 8000);
    return () => clearInterval(interval);
  }, [conversationId, phone]);

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
      await loadMessages();
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

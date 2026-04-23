import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Crown, Send, Loader2, Sparkles, Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CopilotMessage } from "./CopilotMessage";
import { useParams } from "react-router-dom";

interface Msg {
  role: "user" | "assistant";
  content: string;
  ts?: string;
}

interface ThreadRow {
  id: string;
  title: string;
  messages: Msg[];
  updated_at: string;
  project_id: string | null;
}

const SUGGESTIONS = [
  "Qual canal tá com pior CPA esta semana?",
  "Quais leads quentes esfriaram nos últimos 7 dias?",
  "Onde tá vazando dinheiro agora?",
  "Qual produto tem maior LTV/CAC?",
  "Que campanha eu deveria pausar?",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CopilotPanel({ open, onOpenChange }: Props) {
  const { id: routeProjectId } = useParams<{ id: string }>();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [history, setHistory] = useState<ThreadRow[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) loadHistory();
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const loadHistory = async () => {
    const { data } = await supabase
      .from("imphq_copilot_threads")
      .select("id, title, messages, updated_at, project_id")
      .order("updated_at", { ascending: false })
      .limit(20);
    setHistory((data || []) as any);
  };

  const newConversation = () => {
    setThreadId(null);
    setMessages([]);
    setInput("");
  };

  const openThread = (t: ThreadRow) => {
    setThreadId(t.id);
    setMessages(t.messages || []);
  };

  const deleteThread = async (id: string) => {
    await supabase.from("imphq_copilot_threads").delete().eq("id", id);
    if (id === threadId) newConversation();
    loadHistory();
  };

  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text, ts: new Date().toISOString() }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("copilot-imperius", {
        body: { messages: next, projectId: routeProjectId || null, threadId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMessages([...next, { role: "assistant", content: data.reply, ts: new Date().toISOString() }]);
      if (data.threadId) setThreadId(data.threadId);
      loadHistory();
    } catch (err: any) {
      toast.error(err.message || "Falha ao consultar Imperius");
      setMessages(next);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <Crown className="h-5 w-5 text-primary" />
            Imperius
            <span className="text-xs font-normal text-muted-foreground ml-2">Copiloto estratégico</span>
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar histórico */}
          <aside className="w-48 border-r border-border bg-muted/20 flex flex-col">
            <Button variant="ghost" size="sm" className="m-2 justify-start" onClick={newConversation}>
              <Plus className="h-3 w-3 mr-2" /> Nova conversa
            </Button>
            <ScrollArea className="flex-1">
              <div className="px-2 pb-2 space-y-1">
                {history.map((t) => (
                  <div
                    key={t.id}
                    className={cn(
                      "group flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted/40 text-xs",
                      threadId === t.id && "bg-primary/10 text-primary"
                    )}
                    onClick={() => openThread(t)}
                  >
                    <span className="truncate flex-1">{t.title}</span>
                    <button
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); deleteThread(t.id); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {history.length === 0 && (
                  <p className="text-[10px] text-muted-foreground px-2 py-2">Sem histórico ainda.</p>
                )}
              </div>
            </ScrollArea>
          </aside>

          {/* Chat */}
          <div className="flex-1 flex flex-col min-w-0">
            <ScrollArea className="flex-1" ref={scrollRef as any}>
              <div className="px-6 py-4 space-y-4">
                {messages.length === 0 && (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <p>Pergunta o que tá te incomodando. Eu cruzo dados de vendas, leads, ads e recuperação pra dar resposta com ação.</p>
                    </div>
                    <div className="grid gap-2">
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          onClick={() => send(s)}
                          className="text-left text-xs border border-border rounded-md px-3 py-2 hover:bg-muted/40 hover:border-primary/40 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((m, i) => (
                  <CopilotMessage key={i} role={m.role} content={m.content} />
                ))}
                {loading && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Imperius está analisando…
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="border-t border-border p-3 bg-background">
              <div className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Pergunta ao Imperius… (Enter envia, Shift+Enter quebra linha)"
                  className="min-h-[60px] resize-none text-sm"
                  disabled={loading}
                />
                <Button onClick={() => send()} disabled={loading || !input.trim()} size="icon" className="self-end">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

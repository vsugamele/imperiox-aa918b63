import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Crown, Send, Loader2, Sparkles, Trash2, Plus, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CopilotMessage, type ToolActivity } from "./CopilotMessage";
import { AudioRecorder } from "./AudioRecorder";
import { useParams } from "react-router-dom";

interface Msg {
  role: "user" | "assistant";
  content: string;
  ts?: string;
  tools?: ToolActivity[];
}

interface ThreadRow {
  id: string;
  title: string;
  messages: Msg[];
  updated_at: string;
  project_id: string | null;
}

const SUGGESTIONS = [
  "Quem comprou hoje? Quantidade, produto e nome",
  "Quais leads estão travados no WhatsApp há mais de 2h?",
  "Qual canal tá com pior CPA esta semana?",
  "Cria 3 tarefas no projeto X: 1) revisar copy, 2) testar criativo, 3) atualizar avatar",
  "Quem mandou mensagem nas últimas horas?",
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
  const abortRef = useRef<AbortController | null>(null);
  const threadIdRef = useRef<string | null>(null);
  const savedCancelRef = useRef(false);

  useEffect(() => { threadIdRef.current = threadId; }, [threadId]);

  useEffect(() => {
    if (open) loadHistory();
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // Aborta stream em andamento ao desmontar/fechar
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);
  useEffect(() => {
    if (!open) abortRef.current?.abort();
  }, [open]);

  const loadHistory = async () => {
    const { data } = await supabase
      .from("imphq_copilot_threads")
      .select("id, title, messages, updated_at, project_id")
      .order("updated_at", { ascending: false })
      .limit(20);
    setHistory((data || []) as any);
  };

  const newConversation = () => {
    abortRef.current?.abort();
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

  // Persiste mensagem parcial quando o usuário cancela (Worker é morto antes do onFinish do servidor)
  const persistCanceled = async (allMessages: Msg[]) => {
    if (savedCancelRef.current) return;
    savedCancelRef.current = true;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const tId = threadIdRef.current;
      const title = allMessages[0]?.content?.slice(0, 60) || "Nova conversa";
      if (tId) {
        await supabase.from("imphq_copilot_threads")
          .update({ messages: allMessages as any, updated_at: new Date().toISOString() })
          .eq("id", tId).eq("user_id", user.id);
      } else {
        const { data: inserted } = await supabase.from("imphq_copilot_threads").insert({
          user_id: user.id,
          project_id: routeProjectId || null,
          title,
          messages: allMessages as any,
        }).select("id").single();
        if (inserted?.id) setThreadId(inserted.id);
      }
    } catch (e) {
      console.error("[copilot] persist canceled failed", e);
    }
  };

  const stop = () => {
    abortRef.current?.abort();
  };

  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text, ts: new Date().toISOString() }];
    setMessages(next);
    setInput("");
    setLoading(true);
    savedCancelRef.current = false;

    // Otimista: adiciona placeholder do assistant para receber tokens
    setMessages([...next, { role: "assistant", content: "", ts: new Date().toISOString() }]);

    const controller = new AbortController();
    abortRef.current = controller;
    let accText = "";

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Sessão expirada");

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/copilot-imperius`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ messages: next, projectId: routeProjectId || null, threadId, stream: true }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        let errMsg = "Falha ao consultar Imperius";
        try { errMsg = JSON.parse(errText).error || errMsg; } catch {}
        throw new Error(errMsg);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const json = JSON.parse(payload);
            if (json.type === "meta") {
              if (json.threadId) setThreadId(json.threadId);
              continue;
            }
            if (json.type === "tools") {
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last?.role === "assistant") {
                  copy[copy.length - 1] = { ...last, tools: json.tools };
                }
                return copy;
              });
              continue;
            }
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              accText += delta;
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last?.role === "assistant") {
                  copy[copy.length - 1] = { ...last, content: accText };
                }
                return copy;
              });
            }
          } catch { /* chunk parcial */ }
        }
      }

      if (!accText) {
        setMessages((prev) => prev.slice(0, -1));
        toast.error("Imperius não respondeu — tenta de novo");
      }
      loadHistory();
    } catch (err: any) {
      const aborted = err?.name === "AbortError" || controller.signal.aborted;
      if (aborted) {
        // Marca como parado e persiste do lado do cliente
        const stoppedText = (accText || "") + (accText ? "\n\n" : "") + "_Parado._";
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.role === "assistant") {
            copy[copy.length - 1] = { ...last, content: stoppedText };
          }
          return copy;
        });
        const finalMsgs: Msg[] = [
          ...next,
          { role: "assistant", content: stoppedText, ts: new Date().toISOString() },
        ];
        await persistCanceled(finalMsgs);
        loadHistory();
      } else {
        toast.error(err.message || "Falha ao consultar Imperius");
        setMessages(next);
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
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
                  <CopilotMessage key={i} role={m.role} content={m.content} tools={m.tools} />
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
                      if (loading) { stop(); } else { send(); }
                    }
                  }}
                  placeholder="Pergunta ao Imperius… (Enter envia, Shift+Enter, 🎤 áudio)"
                  className="min-h-[60px] resize-none text-sm"
                  disabled={loading}
                />
                {!loading && (
                  <AudioRecorder
                    disabled={loading}
                    onTranscript={(t) => setInput((cur) => (cur ? cur + " " + t : t))}
                  />
                )}
                {loading ? (
                  <Button
                    onClick={stop}
                    size="icon"
                    variant="destructive"
                    className="self-end"
                    title="Parar resposta"
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button onClick={() => send()} disabled={!input.trim()} size="icon" className="self-end">
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

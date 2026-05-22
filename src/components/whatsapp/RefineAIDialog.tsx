import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Send, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };
type Saved = { tipo: string; titulo?: string; objecao?: string; instrucao?: string };

export function RefineAIDialog({
  open, onOpenChange, projectId,
}: { open: boolean; onOpenChange: (o: boolean) => void; projectId: string }) {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Pronto pra refinar 👌 O que você quer ajustar? Pode ser uma objeção que tem aparecido, um tom errado, uma regra de negócio, ou um exemplo de resposta boa que eu deveria seguir." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [savedToday, setSavedToday] = useState<Saved[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: 999999, behavior: "smooth" }); }, [messages, loading]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    const nextMsgs = [...messages, userMsg];
    setMessages(nextMsgs);
    setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("wa-ai-refine", {
        body: { messages: nextMsgs, projeto_id: projectId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMessages(m => [...m, { role: "assistant", content: data.reply || "Anotado ✓" }]);
      if (data?.saved?.length) {
        setSavedToday(s => [...data.saved, ...s]);
        toast.success(`${data.saved.length} lição(ões) gravadas na IA`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao refinar");
      setMessages(m => [...m, { role: "assistant", content: "Deu erro aqui. Tenta de novo?" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-secondary/40 backdrop-blur">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-primary">
            <Sparkles className="h-5 w-5" /> Refinar IA
          </DialogTitle>
          <DialogDescription className="leading-7">
            Converse comigo como um coach. Tudo que você ensinar vira regra, objeção ou ajuste de tom — e passa a influenciar as respostas automáticas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <ScrollArea className="h-[340px] rounded-lg border border-border/40 bg-background/30 p-3" ref={scrollRef as any}>
            <div className="space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm leading-6 ${
                    m.role === "user" ? "bg-primary/15 text-foreground" : "bg-secondary/60 text-foreground"
                  }`}>{m.content}</div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-secondary/60 rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> pensando…
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="flex gap-2">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") send(); }}
              placeholder="Ex: quando o lead diz que tá caro, fala que o ROI paga em 2 meses…"
              disabled={loading}
              className="bg-background/50"
            />
            <Button onClick={send} disabled={loading || !input.trim()} className="bg-primary text-primary-foreground">
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {savedToday.length > 0 && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <p className="text-xs font-medium text-primary flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Gravado nesta sessão ({savedToday.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {savedToday.map((s, i) => (
                  <Badge key={i} variant="outline" className="text-[10px]">
                    {s.tipo === "objecao" ? `🛡️ ${s.objecao?.slice(0, 40)}` :
                     s.tipo === "tom" ? `🎯 ${s.instrucao?.slice(0, 40)}` :
                     `💡 ${s.titulo?.slice(0, 40)}`}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

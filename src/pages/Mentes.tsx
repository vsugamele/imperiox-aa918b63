import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Brain, Send } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function Mentes() {
  const [chats, setChats] = useState<any[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      supabase.from("imphq_ai_chats").select("*").order("updated_at", { ascending: false }).limit(20)
        .then(({ data }) => setChats(data || []));
    }
  }, [user]);

  const handleSend = () => {
    if (!input.trim()) return;
    const newMsg: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, newMsg, { role: "assistant", content: "⏳ Integração IA pendente — conecte uma edge function para respostas reais." }]);
    setInput("");
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold text-primary">Mentes IA</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Conversas Recentes</h3>
          {chats.map((c) => (
            <Card key={c.id} className="bg-card border-border hover:border-primary/20 cursor-pointer">
              <CardContent className="p-3">
                <p className="text-sm truncate">{c.title || "Sem título"}</p>
                <p className="text-[10px] text-muted-foreground">{c.model || "—"}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="lg:col-span-3 flex flex-col">
          <Card className="bg-card border-border flex-1 flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" /> Chat
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="flex-1 overflow-auto space-y-3 mb-4 min-h-[300px]">
                {messages.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center mt-8">Inicie uma conversa com a IA</p>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  className="bg-secondary resize-none"
                  rows={2}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                />
                <Button onClick={handleSend} size="icon" className="shrink-0 self-end">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

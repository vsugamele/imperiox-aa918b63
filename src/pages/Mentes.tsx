import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { Brain, Send, Copy, Settings2, ChevronDown, ChevronUp } from "lucide-react";
import { KB_SECTIONS } from "@/data/kbTemplates";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export default function Mentes() {
  const [chats, setChats] = useState<any[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState("none");
  const [kbEntries, setKbEntries] = useState<Record<string, any>>({});
  const [selectedKBSections, setSelectedKBSections] = useState<string[]>([]);
  const [showContextPanel, setShowContextPanel] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("imphq_ai_chats").select("*").order("updated_at", { ascending: false }).limit(20),
      supabase.from("imphq_projects").select("*").order("name"),
      supabase.from("imphq_kb").select("*").order("order_idx"),
    ]).then(([chatRes, projRes, kbRes]) => {
      setChats(chatRes.data || []);
      setProjects(projRes.data || []);
      const map: Record<string, any> = {};
      (kbRes.data || []).forEach((k: any) => { map[k.section_key] = k; });
      setKbEntries(map);
    });
  }, [user]);

  const buildContext = () => {
    let ctx = "[CONTEXTO DO SISTEMA — IMPÉRIO DIGITAL]\n\n";
    ctx += "PAPEL DO AGENTE: Você é um agente operacional generalista do Império Digital.\n\n";
    ctx += "REGRAS:\n- Responda sempre em Português do Brasil\n- Use o tom de voz e branding do projeto\n- Consulte o avatar antes de criar copy\n- Documente outputs importantes\n\n";

    // Project briefing + avatar
    if (selectedProject !== "none") {
      const proj = projects.find(p => p.id === selectedProject);
      if (proj) {
        ctx += `${"═".repeat(60)}\n\n## BRIEFING DO PROJETO\n\n${"═".repeat(60)}\n\n`;
        ctx += `Nome: ${proj.name}\nProduto: ${proj.produto || "—"}\nPreço: ${proj.preco || "A definir"}\n`;
        ctx += `Categoria: ${proj.categoria || "—"}\nStatus: ${proj.status || "—"}\n`;
        ctx += `Objetivo: ${proj.objetivo || "—"}\nContexto: ${proj.contexto || "—"}\n\n`;

        const av = proj.avatar as any;
        if (av && typeof av === "object") {
          ctx += `${"═".repeat(60)}\n\n## AVATAR DO PROJETO\n\n${"═".repeat(60)}\n\n`;
          if (av.desejo_externo) ctx += `Desejo Externo: ${av.desejo_externo}\n`;
          if (av.desejo_interno) ctx += `Desejo Interno: ${av.desejo_interno}\n`;
          if (av.dores_superficiais?.length) ctx += `\nDores Superficiais:\n${av.dores_superficiais.map((d: string) => `- ${d}`).join("\n")}\n`;
          if (av.dores_profundas?.length) ctx += `\nDores Profundas:\n${av.dores_profundas.map((d: string) => `- ${d}`).join("\n")}\n`;
          if (av.medos?.length) ctx += `\nMedos:\n${av.medos.map((m: string) => `- ${m}`).join("\n")}\n`;
          if (av.objecoes?.length) ctx += `\nObjeções:\n${av.objecoes.map((o: string) => `- ${o}`).join("\n")}\n`;
          if (av.inimigo) ctx += `\nInimigo Externo: ${av.inimigo}\n`;
          if (av.resultado_sonhado) ctx += `Resultado Sonhado: ${av.resultado_sonhado}\n`;
          if (av.trigger_event) ctx += `Trigger Event: ${av.trigger_event}\n`;
          if (av.fase_consciencia) ctx += `Fase de Consciência: ${av.fase_consciencia}\n`;
          if (av.sub_avatares?.length) {
            ctx += `\nSub-Avatares:\n`;
            av.sub_avatares.forEach((s: any) => {
              ctx += `- ${s.nome || "—"}: ${s.descricao || "—"}\n`;
            });
          }
          if (av.storyboard) ctx += `\nStoryboard:\n${av.storyboard}\n`;
          ctx += "\n";
        }
      }
    }

    // KB Sections
    if (selectedKBSections.length > 0) {
      ctx += `${"═".repeat(60)}\n\n## KNOWLEDGE BASE (SELECIONADO)\n\n${"═".repeat(60)}\n\n`;
      for (const key of selectedKBSections) {
        const section = KB_SECTIONS.find(s => s.key === key);
        const entry = kbEntries[key];
        const body = entry?.body || entry?.content || section?.defaultContent || "";
        ctx += `${body}\n\n`;
      }
    }

    ctx += `${"═".repeat(60)}\n\n[FIM DO CONTEXTO — Aguardando instrução]\n`;
    return ctx;
  };

  const loadContext = () => {
    const ctx = buildContext();
    setSystemPrompt(ctx);
    toast.success("Contexto carregado! Será enviado como system prompt.");
  };

  const copyContext = async () => {
    const ctx = buildContext();
    await navigator.clipboard.writeText(ctx);
    toast.success("Contexto copiado para a área de transferência!");
  };

  const toggleKBSection = (key: string) => {
    setSelectedKBSections(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const newMessages: Message[] = [...messages];

    // Inject system prompt if set and not yet injected
    if (systemPrompt && !messages.some(m => m.role === "system")) {
      newMessages.push({ role: "system", content: systemPrompt });
    }

    newMessages.push(
      { role: "user", content: input },
      { role: "assistant", content: "⏳ Integração IA pendente — conecte uma edge function para respostas reais." }
    );
    setMessages(newMessages);
    setInput("");
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-primary">🧠 Mentes IA</h1>
        <Button size="sm" variant="outline" onClick={() => setShowContextPanel(!showContextPanel)}>
          <Settings2 className="h-4 w-4 mr-1" />
          Contexto {showContextPanel ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
        </Button>
      </div>

      {/* Context Builder Panel */}
      {showContextPanel && (
        <Card className="bg-card border-border animate-fade-in">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">
              Gerador de Contexto IA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium">Projeto</Label>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Selecione um projeto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum projeto</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-1">Inclui briefing + avatar completo</p>
              </div>

              <div>
                <Label className="text-xs font-medium">Seções da KB</Label>
                <div className="mt-1 max-h-40 overflow-y-auto space-y-1 border border-border rounded-md p-2">
                  {KB_SECTIONS.map(section => (
                    <label key={section.key} className="flex items-center gap-2 cursor-pointer hover:bg-secondary/50 px-1 py-0.5 rounded text-xs">
                      <Checkbox
                        checked={selectedKBSections.includes(section.key)}
                        onCheckedChange={() => toggleKBSection(section.key)}
                      />
                      <span>{section.icon} {section.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" onClick={loadContext}>
                <Brain className="h-3 w-3 mr-1" /> Carregar Contexto
              </Button>
              <Button size="sm" variant="outline" onClick={copyContext}>
                <Copy className="h-3 w-3 mr-1" /> Copiar Contexto
              </Button>
              <Button size="sm" variant="outline" onClick={() => {
                setSelectedKBSections(KB_SECTIONS.map(s => s.key));
              }}>
                Selecionar Todas
              </Button>
              {systemPrompt && (
                <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400">
                  ✓ Contexto ativo ({systemPrompt.length} chars)
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Recent Chats */}
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

        {/* Chat */}
        <div className="lg:col-span-3 flex flex-col">
          <Card className="bg-card border-border flex-1 flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" /> Chat
                {systemPrompt && <Badge variant="outline" className="text-[9px] ml-2">Com Contexto</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="flex-1 overflow-auto space-y-3 mb-4 min-h-[300px]">
                {messages.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center mt-8">
                    {systemPrompt
                      ? "Contexto carregado. Inicie uma conversa!"
                      : "Configure o contexto acima e inicie uma conversa com a IA"}
                  </p>
                )}
                {messages.filter(m => m.role !== "system").map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                      m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary"
                    }`}>
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

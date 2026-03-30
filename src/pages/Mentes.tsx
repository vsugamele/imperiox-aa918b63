import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { MENTES_DATA, MenteDNA } from "@/data/mentesData";
import {
  Brain, Send, X, ChevronRight, Zap, Target, BarChart3,
  MessageSquare, Dna, Lightbulb, BookOpen, ArrowLeft
} from "lucide-react";
import { toast } from "sonner";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ────── Sub-component: Skill Bar ──────
function SkillBar({ nome, valor }: { nome: string; valor: number }) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <span className="text-xs text-muted-foreground w-40 truncate">{nome}</span>
      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${valor * 10}%`,
            background: "linear-gradient(90deg, #00ffc8, #00a88a)"
          }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-4 text-right">{valor}</span>
    </div>
  );
}

// ────── Sub-component: Mind Card ──────
function MindCard({ mente, onClick }: { mente: MenteDNA; onClick: () => void }) {
  const top3 = mente.proficiencias.slice(0, 3);
  return (
    <div
      onClick={onClick}
      className="group relative cursor-pointer rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5"
    >
      {/* Tier badge */}
      <div className="absolute top-3 right-3">
        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
          style={{ background: "rgba(0,255,200,.08)", borderColor: "rgba(0,255,200,.2)", color: "#00ffc8" }}>
          Tier {mente.tier}
        </span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-xl bg-secondary border border-border flex items-center justify-center text-2xl">
          {mente.icon}
        </div>
        <div>
          <div className="text-sm font-bold">{mente.nome}</div>
          <div className="text-[10px] font-semibold" style={{ color: "#d4a843" }}>{mente.spec}</div>
        </div>
      </div>

      {/* Model badge */}
      <div className="mb-3">
        <span className="text-[9px] font-semibold px-2 py-0.5 rounded border bg-secondary/50"
          style={{ color: mente.modeloCor, borderColor: `${mente.modeloCor}33` }}>
          {mente.modelo}
        </span>
      </div>

      {/* Top 3 proficiencies */}
      <div className="mb-3">
        {top3.map(p => <SkillBar key={p.nome} nome={p.nome} valor={p.valor} />)}
      </div>

      {/* Description */}
      <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
        {mente.sobre}
      </p>

      {/* CTA */}
      <div className="mt-3 flex items-center gap-1 text-[11px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">
        <span>Consultar esta mente</span>
        <ChevronRight className="h-3 w-3" />
      </div>
    </div>
  );
}

// ────── Sub-component: Raio-X Modal Tab ──────
type RayXTab = "perfil" | "dna" | "chat";

function RayXModal({ mente, onClose }: { mente: MenteDNA; onClose: () => void }) {
  const [tab, setTab] = useState<RayXTab>("perfil");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState("none");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  const [competitors, setCompetitors] = useState<any[]>([]);
  const [kbSections, setKbSections] = useState<any[]>([]);
  const [contextChars, setContextChars] = useState(0);

  useEffect(() => {
    supabase.from("imphq_projects").select("id,name,produto,categoria,objetivo,avatar,contexto,data")
      .order("name").then(({ data }) => setProjects(data || []));
  }, []);

  // Load competitors & KB when project changes
  useEffect(() => {
    if (selectedProject === "none") { setCompetitors([]); setKbSections([]); return; }
    Promise.all([
      supabase.from("imphq_competitors").select("nome,ponto_forte,escala_score").eq("project_id", selectedProject).limit(5),
      supabase.from("imphq_kb").select("title,content").or(`project_id.eq.${selectedProject},project_id.is.null`).limit(10),
    ]).then(([cRes, kRes]) => {
      setCompetitors(cRes.data || []);
      setKbSections(kRes.data || []);
    });
  }, [selectedProject]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const buildSystemPrompt = () => {
    let sys = mente.prompt + "\n\n";
    if (selectedProject !== "none") {
      const proj = projects.find(p => p.id === selectedProject);
      if (proj) {
        sys += `\n\n═══════════════════════════════\nCONTEXTO DO PROJETO\n═══════════════════════════════\n`;
        sys += `Projeto: ${proj.name}\nProduto: ${proj.produto || "—"}\nCategoria: ${proj.categoria || "—"}\n`;
        sys += `Objetivo: ${proj.objetivo || "—"}\nContexto: ${proj.contexto || "—"}\n`;
        const av = proj.avatar as any;
        if (av?.desejo_externo) sys += `\nDesejo do Avatar: ${av.desejo_externo}`;
        if (av?.dores_superficiais?.length) {
          sys += `\nDores: ${(av.dores_superficiais as string[]).slice(0, 3).join(", ")}`;
        }
      }
    }
    sys += `\n\nResponda sempre em Português do Brasil com o exato tom e metodologia de ${mente.nome}.`;
    return sys;
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const userMsg = input.trim();
    setInput("");
    setSending(true);

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);

    try {
      const systemPrompt = buildSystemPrompt();
      const payload = {
        messages: [
          { role: "system", content: systemPrompt },
          ...newMessages.map(m => ({ role: m.role, content: m.content }))
        ],
        model: "openai/gpt-4o-mini",
      };

      const { data, error } = await supabase.functions.invoke("chat-with-ai", { body: payload });

      if (error) throw error;
      const reply = data?.choices?.[0]?.message?.content || data?.content || "Sem resposta.";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);

      // Save to chat history
      if (user) {
        await supabase.from("imphq_ai_chats").insert({
          user_id: user.id,
          title: `${mente.nome} — ${userMsg.slice(0, 60)}`,
          model: mente.modelo,
          messages: [...newMessages, { role: "assistant", content: reply }],
        });
      }
    } catch (err: any) {
      toast.error("Erro ao chamar a IA: " + (err.message || "verifique a edge function."));
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "⚠️ Não foi possível conectar à IA. Verifique se a edge function `chat-with-ai` está ativa."
      }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="flex flex-col w-full max-w-5xl mx-auto border-x border-border">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-card shrink-0">
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center text-xl">
            {mente.icon}
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold">{mente.nome}</div>
            <div className="text-[10px]" style={{ color: "#d4a843" }}>{mente.role}</div>
          </div>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border"
            style={{ background: "rgba(0,255,200,.08)", borderColor: "rgba(0,255,200,.2)", color: "#00ffc8" }}>
            Tier {mente.tier}
          </span>
          <span className="text-[9px] font-semibold px-2 py-0.5 rounded border ml-1"
            style={{ color: mente.modeloCor, borderColor: `${mente.modeloCor}33` }}>
            {mente.modelo}
          </span>
          <button onClick={onClose} className="ml-2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border bg-card shrink-0">
          {([
            { id: "perfil", icon: BarChart3, label: "Raio-X Cognitivo" },
            { id: "dna", icon: Dna, label: "DNA & Heurísticas" },
            { id: "chat", icon: MessageSquare, label: "Consultar" },
          ] as { id: RayXTab; icon: any; label: string }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold border-b-2 transition-colors ${
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* ── PERFIL TAB ── */}
          {tab === "perfil" && (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* About */}
              <div className="md:col-span-2">
                <p className="text-sm leading-relaxed text-foreground/80">{mente.sobre}</p>
              </div>

              {/* Proficiências */}
              <div>
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5" /> Proficiências
                </h3>
                {mente.proficiencias.map(p => <SkillBar key={p.nome} nome={p.nome} valor={p.valor} />)}
              </div>

              {/* Valores */}
              <div>
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" /> Valores Centrais
                </h3>
                {mente.valores.map(v => <SkillBar key={v.nome} nome={v.nome} valor={v.valor} />)}
              </div>

              {/* Ton Tags */}
              <div>
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Tom de Comunicação</h3>
                <p className="text-sm mb-2">{mente.tom}</p>
                <div className="flex flex-wrap gap-1.5">
                  {mente.tonTags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-[9px]">#{tag}</Badge>
                  ))}
                </div>
              </div>

              {/* Padrões */}
              <div>
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" /> Padrões de Copy
                </h3>
                <ul className="space-y-1">
                  {mente.padroes.split("\n").filter(Boolean).map((p, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <span className="text-primary shrink-0 mt-0.5">▸</span>
                      {p.replace(/^-\s*/, "")}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* ── DNA TAB ── */}
          {tab === "dna" && (
            <div className="p-6 space-y-6">
              {/* DNA */}
              <div>
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Dna className="h-3.5 w-3.5" /> DNA Operacional
                </h3>
                <div className="rounded-lg border border-border bg-secondary/30 p-4">
                  <p className="text-sm leading-relaxed">{mente.dna}</p>
                </div>
              </div>

              {/* Heuristics */}
              <div>
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5" /> Heurísticas de Decisão
                </h3>
                <div className="space-y-2">
                  {mente.heuristics.split("\n").filter(Boolean).map((h, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg border border-border/50 bg-secondary/20 px-4 py-3">
                      <span className="text-primary font-bold text-xs shrink-0 mt-0.5">{i + 1}</span>
                      <p className="text-xs leading-relaxed">{h.replace(/^\d+\.\s*/, "")}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* System Prompt */}
              <div>
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Brain className="h-3.5 w-3.5" /> System Prompt
                </h3>
                <pre className="text-[11px] leading-relaxed bg-secondary/30 border border-border rounded-lg p-4 whitespace-pre-wrap font-mono overflow-x-auto">
                  {mente.prompt}
                </pre>
              </div>
            </div>
          )}

          {/* ── CHAT TAB ── */}
          {tab === "chat" && (
            <div className="flex flex-col h-full" style={{ height: "calc(100vh - 140px)" }}>
              {/* Project selector */}
              <div className="px-4 py-2 border-b border-border bg-secondary/20 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Projeto:</span>
                  <select
                    value={selectedProject}
                    onChange={e => setSelectedProject(e.target.value)}
                    className="text-xs bg-secondary border border-border rounded px-2 py-1 text-foreground flex-1 max-w-xs"
                  >
                    <option value="none">Nenhum (apenas {mente.nome})</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  {selectedProject !== "none" && (
                    <Badge variant="outline" className="text-[9px] text-green-400 border-green-400/30">
                      Contexto ativo
                    </Badge>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-3">{mente.icon}</div>
                    <p className="text-sm text-muted-foreground">
                      Pronto para consultar <strong>{mente.nome}</strong>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{mente.spec}</p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    {m.role === "assistant" && (
                      <div className="w-7 h-7 rounded-lg bg-secondary shrink-0 flex items-center justify-center text-base mr-2 mt-0.5">
                        {mente.icon}
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-secondary rounded-bl-sm"
                    }`}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex justify-start">
                    <div className="w-7 h-7 rounded-lg bg-secondary shrink-0 flex items-center justify-center text-base mr-2">
                      {mente.icon}
                    </div>
                    <div className="bg-secondary rounded-xl rounded-bl-sm px-4 py-3">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-border bg-card shrink-0">
                <div className="flex gap-2">
                  <Textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder={`Pergunte para ${mente.nome}...`}
                    className="resize-none bg-secondary min-h-[44px] max-h-[120px]"
                    rows={1}
                  />
                  <Button onClick={handleSend} size="icon" disabled={sending || !input.trim()} className="shrink-0 self-end">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Enter para enviar · Shift+Enter para nova linha
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ────── Main Page ──────
export default function Mentes() {
  const [selectedMente, setSelectedMente] = useState<MenteDNA | null>(null);
  const [search, setSearch] = useState("");

  const filtered = MENTES_DATA.filter(m =>
    search === "" ||
    m.nome.toLowerCase().includes(search.toLowerCase()) ||
    m.spec.toLowerCase().includes(search.toLowerCase()) ||
    m.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary flex items-center gap-2">
            🧬 Mentes Sintéticas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Copywriters e estrategistas de IA — consulte a mente certa para cada decisão
          </p>
        </div>
        <Badge
          variant="outline"
          className="text-xs border-primary/30 text-primary"
        >
          {MENTES_DATA.length} mentes ativas
        </Badge>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Buscar mente por nome, especialidade..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full max-w-sm bg-secondary border border-border rounded-lg px-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      />

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(m => (
          <MindCard key={m.id} mente={m} onClick={() => setSelectedMente(m)} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Brain className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>Nenhuma mente encontrada para "{search}"</p>
        </div>
      )}

      {/* Modal */}
      {selectedMente && (
        <RayXModal mente={selectedMente} onClose={() => setSelectedMente(null)} />
      )}
    </div>
  );
}

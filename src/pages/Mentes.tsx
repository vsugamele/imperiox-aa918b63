import { useEffect, useState, useRef } from "react";
import { SectionInfo } from "@/components/SectionInfo";
import { sectionHelpTexts } from "@/data/sectionHelpTexts";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { MENTES_DATA, MenteDNA } from "@/data/mentesData";
import { SKILLS_DATA, SkillData } from "@/data/skillsData";
import {
  Brain, Send, X, ChevronRight, Zap, Target, BarChart3,
  MessageSquare, Dna, Lightbulb, BookOpen, ArrowLeft, Wrench,
  Users, FileText, Download, Copy, ChevronDown, Sparkles, AlertCircle, RefreshCw, Layers
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import RagInspector from "@/components/dashboard/RagInspector";

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
  const [activeSkills, setActiveSkills] = useState<Set<string>>(new Set());
  const [customSkills, setCustomSkills] = useState<any[]>([]);

  // Load custom skills from Supabase
  useEffect(() => {
    supabase.from("imphq_skills").select("id,nome,categoria,system_prompt,descricao")
      .then(({ data }) => setCustomSkills(data || []));
  }, []);

  useEffect(() => {
    supabase.from("imphq_projects").select("id,name,category,avatar,data")
      .order("name").then(({ data }) => {
        const rows = (data || []).map((p: any) => {
          const d = typeof p.data === "string" ? (() => { try { return JSON.parse(p.data); } catch { return {}; } })() : (p.data || {});
          return { ...p, produto: d.produto, categoria: p.category, objetivo: d.objetivo, contexto: d.contexto };
        });
        setProjects(rows);
      });
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

        // Avatar completo
        const av = proj.avatar as any;
        if (av) {
          sys += `\n── AVATAR ──\n`;
          if (av.desejo_externo) sys += `Desejo externo: ${av.desejo_externo}\n`;
          if (av.desejo_interno) sys += `Desejo interno: ${av.desejo_interno}\n`;
          if (av.dores_superficiais?.length) sys += `Dores superficiais: ${av.dores_superficiais.join(", ")}\n`;
          if (av.dores_profundas?.length) sys += `Dores profundas: ${av.dores_profundas.join(", ")}\n`;
          if (av.problemas?.length) sys += `Problemas: ${av.problemas.join(", ")}\n`;
          if (av.gatilhos?.length) sys += `Gatilhos: ${av.gatilhos.join(", ")}\n`;
          if (av.voyerismos?.length) sys += `Voyerismos: ${av.voyerismos.join(", ")}\n`;
          if (av.perfil) sys += `Perfil: ${JSON.stringify(av.perfil)}\n`;
        }

        // Briefing / Branding / Copy Arsenal / KPIs from data JSONB
        const d = proj.data as any;
        if (d) {
          if (d.branding) {
            sys += `\n── BRANDING ──\n`;
            if (d.branding.tom_de_voz) sys += `Tom de voz: ${d.branding.tom_de_voz}\n`;
            if (d.branding.arquetipo) sys += `Arquétipo: ${d.branding.arquetipo}\n`;
            if (d.branding.paleta) sys += `Paleta: ${JSON.stringify(d.branding.paleta)}\n`;
            if (d.branding.posicionamento) sys += `Posicionamento: ${d.branding.posicionamento}\n`;
            if (d.branding.manifesto) sys += `Manifesto: ${d.branding.manifesto}\n`;
          }
          if (d.copy_arsenal) {
            sys += `\n── COPY ARSENAL ──\n`;
            const blocks = ["promessa", "inimigo_comum", "efeito_colateral", "oportunidade", "metodo", "hora_do_show"];
            for (const b of blocks) {
              if (d.copy_arsenal[b]?.length) sys += `${b}: ${d.copy_arsenal[b].join(" | ")}\n`;
            }
          }
          if (d.kpis) {
            sys += `\n── KPIs ──\n${JSON.stringify(d.kpis)}\n`;
          }
        }

        // Concorrentes
        if (competitors.length > 0) {
          sys += `\n── CONCORRENTES ──\n`;
          for (const c of competitors) {
            sys += `- ${c.nome} (escala: ${c.escala_score || "?"}) — ${c.ponto_forte || ""}\n`;
          }
        }

        // KB
        if (kbSections.length > 0) {
          sys += `\n── KNOWLEDGE BASE ──\n`;
          for (const kb of kbSections.slice(0, 5)) {
            sys += `[${kb.title}]: ${(kb.content || "").slice(0, 500)}\n`;
          }
        }
      }
    }

    // ── SKILLS INJECTION ──
    const allSkills: { id: string; nome: string; categoria: string; descricao: string; system_prompt: string }[] = [
      ...SKILLS_DATA.map(s => ({ id: s.id, nome: s.nome, categoria: s.categoria, descricao: s.descricao, system_prompt: s.system_prompt })),
      ...customSkills.filter(s => s.system_prompt),
    ];

    const activatedSkills = allSkills.filter(s => activeSkills.has(s.id));
    if (activatedSkills.length > 0) {
      sys += `\n\n═══════════════════════════════\nSKILLS ATIVADAS\n═══════════════════════════════\n`;
      sys += `Você possui as seguintes habilidades especializadas ativadas. USE-AS quando a tarefa exigir:\n\n`;
      for (const skill of activatedSkills) {
        sys += `\n────── SKILL: ${skill.nome} (${skill.categoria}) ──────\n`;
        sys += skill.system_prompt + "\n";
      }
    } else {
      // Show available skills as summary
      const relevantSkills = allSkills.slice(0, 8);
      if (relevantSkills.length > 0) {
        sys += `\n\n── SKILLS DISPONÍVEIS (não ativadas) ──\n`;
        sys += `O usuário pode ativar as seguintes skills no painel lateral:\n`;
        for (const s of relevantSkills) {
          sys += `- ${s.nome} (${s.categoria}): ${s.descricao.slice(0, 120)}...\n`;
        }
      }
    }

    sys += `\n\nResponda sempre em Português do Brasil com o exato tom e metodologia de ${mente.nome}.`;
    setContextChars(sys.length);
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
              {/* Project selector + Skills panel */}
              <div className="px-4 py-2 border-b border-border bg-secondary/20 shrink-0 space-y-2">
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
                  {contextChars > 0 && (
                    <Badge variant="outline" className="text-[9px] text-amber-400 border-amber-400/30">
                      {(contextChars / 1000).toFixed(1)}K chars
                    </Badge>
                  )}
                  {activeSkills.size > 0 && (
                    <Badge variant="outline" className="text-[9px] text-purple-400 border-purple-400/30">
                      <Wrench className="h-2.5 w-2.5 mr-1" />{activeSkills.size} skills
                    </Badge>
                  )}
                </div>

                {/* Skills checklist - collapsible */}
                <details className="group">
                  <summary className="flex items-center gap-1.5 cursor-pointer text-[10px] text-muted-foreground font-semibold uppercase tracking-wider hover:text-foreground transition-colors">
                    <Wrench className="h-3 w-3" /> Skills ({SKILLS_DATA.length + customSkills.length} disponíveis · {activeSkills.size} ativas)
                  </summary>
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-32 overflow-y-auto pr-1">
                    {[...SKILLS_DATA, ...customSkills.filter(s => s.system_prompt)].map((skill: any) => (
                      <label
                        key={skill.id}
                        className={`flex items-center gap-1.5 rounded-md border px-2 py-1 cursor-pointer text-[10px] transition-colors ${
                          activeSkills.has(skill.id)
                            ? "border-purple-500/40 bg-purple-500/10 text-purple-300"
                            : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Checkbox
                          checked={activeSkills.has(skill.id)}
                          onCheckedChange={(checked) => {
                            setActiveSkills(prev => {
                              const next = new Set(prev);
                              if (checked) next.add(skill.id);
                              else next.delete(skill.id);
                              return next;
                            });
                          }}
                          className="h-3 w-3"
                        />
                        <span className="mr-0.5">{skill.icone || "⚙️"}</span>
                        <span className="truncate">{skill.nome}</span>
                      </label>
                    ))}
                  </div>
                </details>
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

interface DebateMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderIcon: string;
  senderColor?: string;
  role: "user" | "assistant" | "synthesis";
  content: string;
  timestamp: string;
}

const CHALLENGE_TEMPLATES = [
  {
    title: "📉 Queda de Vendas",
    text: "Nossas vendas caíram 30% essa semana no checkout de forma repentina. Qual o plano de ação imediato para reverter isso?",
    category: "Vendas"
  },
  {
    title: "💸 CPL muito Alto",
    text: "O CPL (Custo por Lead) no Facebook Ads dobrou nos últimos 7 dias. Como otimizamos as campanhas e criativos para baixar esse custo?",
    category: "Tráfego"
  },
  {
    title: "🚀 Lançamento de Produto",
    text: "Estamos estruturando o lançamento de um novo produto high-ticket do zero. Qual o melhor ângulo de vendas e estratégia de oferta?",
    category: "Estratégia"
  },
  {
    title: "🔥 Retenção da VSL Baixa",
    text: "A taxa de retenção da nossa página de vendas (VSL) está abaixo de 10% no primeiro minuto. Como reescrever a abertura para segurar a audiência?",
    category: "Copywriting"
  }
];

function BoardroomModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<"setup" | "active">("setup");
  const [selectedMinds, setSelectedMinds] = useState<MenteDNA[]>([]);
  const [challenge, setChallenge] = useState("");
  const [selectedProject, setSelectedProject] = useState("none");
  const [projects, setProjects] = useState<any[]>([]);
  const [customSkills, setCustomSkills] = useState<any[]>([]);
  const [activeSkills, setActiveSkills] = useState<Set<string>>(new Set());
  const [isSkillsExpanded, setIsSkillsExpanded] = useState(false);

  // Debate-specific state
  const [debateMessages, setDebateMessages] = useState<DebateMessage[]>([]);
  const [isDebating, setIsDebating] = useState(false);
  const [currentSpeakerIndex, setCurrentSpeakerIndex] = useState(-1);
  const [speakerState, setSpeakerState] = useState<"thinking" | "talking" | "idle">("idle");
  const [synthesisReport, setSynthesisReport] = useState("");
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [followUpInput, setFollowUpInput] = useState("");
  const { user } = useAuth();
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load custom skills and projects
  useEffect(() => {
    supabase.from("imphq_skills").select("id,nome,categoria,system_prompt,descricao")
      .then(({ data }) => setCustomSkills(data || []));
  }, []);

  useEffect(() => {
    supabase.from("imphq_projects").select("id,name,category,avatar,data")
      .order("name").then(({ data }) => {
        const rows = (data || []).map((p: any) => {
          const d = typeof p.data === "string" ? (() => { try { return JSON.parse(p.data); } catch { return {}; } })() : (p.data || {});
          return { ...p, produto: d.produto, categoria: p.category, objetivo: d.objetivo, contexto: d.contexto };
        });
        setProjects(rows);
      });
  }, []);

  // Pre-select three minds by default on mount
  useEffect(() => {
    const defaultMinds = MENTES_DATA.filter(m => 
      m.id === 'dan_kennedy' || m.id === 'eugene_schwartz' || m.id === 'thiago_finch'
    );
    setSelectedMinds(defaultMinds);
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [debateMessages, isSynthesizing, speakerState]);

  const activeMindsCurrent = () => {
    if (currentSpeakerIndex !== -1 && currentSpeakerIndex < selectedMinds.length) {
      return selectedMinds[currentSpeakerIndex];
    }
    return null;
  };

  const buildBoardroomSystemPrompt = (
    mind: MenteDNA, 
    allSelectedMinds: MenteDNA[], 
    userChallenge: string, 
    currentHistory: DebateMessage[]
  ) => {
    let sys = mind.prompt + "\n\n";
    
    // Injetar contexto do projeto (se houver)
    if (selectedProject !== "none") {
      const proj = projects.find(p => p.id === selectedProject);
      if (proj) {
        sys += `\n\n═══════════════════════════════\nCONTEXTO DO PROJETO\n═══════════════════════════════\n`;
        sys += `Projeto: ${proj.name}\nProduto: ${proj.produto || "—"}\nCategoria: ${proj.categoria || "—"}\n`;
        sys += `Objetivo: ${proj.objetivo || "—"}\nContexto: ${proj.contexto || "—"}\n`;

        const av = proj.avatar as any;
        if (av) {
          sys += `\n── AVATAR ──\n`;
          if (av.desejo_externo) sys += `Desejo externo: ${av.desejo_externo}\n`;
          if (av.desejo_interno) sys += `Desejo interno: ${av.desejo_interno}\n`;
          if (av.dores_superficiais?.length) sys += `Dores superficiais: ${av.dores_superficiais.join(", ")}\n`;
          if (av.dores_profundas?.length) sys += `Dores profundas: ${av.dores_profundas.join(", ")}\n`;
        }

        const d = proj.data as any;
        if (d && d.branding) {
          sys += `\n── BRANDING ──\n`;
          if (d.branding.tom_de_voz) sys += `Tom de voz: ${d.branding.tom_de_voz}\n`;
          if (d.branding.posicionamento) sys += `Posicionamento: ${d.branding.posicionamento}\n`;
        }
      }
    }

    // Injetar Skills Ativadas
    const allSkills = [
      ...SKILLS_DATA.map(s => ({ id: s.id, nome: s.nome, categoria: s.categoria, system_prompt: s.system_prompt })),
      ...customSkills.filter(s => s.system_prompt)
    ];
    const activated = allSkills.filter(s => activeSkills.has(s.id));
    if (activated.length > 0) {
      sys += `\n\n═══════════════════════════════\nHABILIDADES E CRITÉRIOS ATIVOS\n═══════════════════════════════\n`;
      for (const s of activated) {
        sys += `\n- Habilidade: ${s.nome} (${s.categoria})\n${s.system_prompt}\n`;
      }
    }

    // Mesa Redonda Context
    sys += `\n\n═══════════════════════════════\nCONTEXTO DA REUNIÃO DE DIRETORIA\n═══════════════════════════════\n`;
    sys += `Você está em uma Reunião de Diretoria de Elite (Mesa Redonda das Mentes) no ImperioHQ.\n`;
    sys += `O CEO/Usuário convocou o conselho para debater o seguinte desafio crítico: "${userChallenge}"\n\n`;
    sys += `Diretores presentes nesta mesa:\n`;
    for (const m of allSelectedMinds) {
      sys += `- ${m.nome} (${m.role} - Especialidade: ${m.spec})\n`;
    }
    
    sys += `\nINSTRUÇÕES ADICIONAIS DE POSTURA NO DEBATE:\n`;
    sys += `1. Analise o desafio e o histórico de discussão sob o filtro metodológico específico de ${mind.nome}.\n`;
    sys += `2. Leia atentamente as contribuições anteriores dos outros diretores na transcrição abaixo. Você DEVE citá-los, construir sobre o raciocínio deles, discordar pontualmente com embasamento técnico ou acrescentar novos insights práticos.\n`;
    sys += `3. Seja pragmático, evite discursos longos e floreados. Suas falas devem ter no máximo 3 parágrafos curtos e concisos, focando em soluções concretas para o seu setor.\n`;
    sys += `4. Fale na primeira pessoa como ${mind.nome}, mantendo integralmente sua personalidade, gírias e tom característico.\n`;

    sys += `\nResponda sempre em Português do Brasil.`;
    return sys;
  };

  const runBoardroomDebate = async (challengeText: string, currentMessages: DebateMessage[]) => {
    setIsDebating(true);
    setSynthesisReport("");
    let tempMessages = [...currentMessages];
    
    // Turn-based debate loops
    for (let i = 0; i < selectedMinds.length; i++) {
      const mind = selectedMinds[i];
      setCurrentSpeakerIndex(i);
      setSpeakerState("thinking");
      
      // Delay for "thinking" effect
      await new Promise(resolve => setTimeout(resolve, 2000));
      setSpeakerState("talking");
      
      try {
        const sysPrompt = buildBoardroomSystemPrompt(mind, selectedMinds, challengeText, tempMessages);
        
        // Pass current transcript formatted cleanly for LLM
        const payload = {
          messages: [
            { role: "system", content: sysPrompt },
            ...tempMessages.map(m => ({
              role: m.role === "user" ? "user" : "assistant",
              content: m.role === "user" ? m.content : `[${m.senderName} (${m.senderId})]: ${m.content}`
            }))
          ],
          model: "openai/gpt-4o-mini"
        };
        
        const { data, error } = await supabase.functions.invoke("chat-with-ai", { body: payload });
        if (error) throw error;
        
        const reply = data?.choices?.[0]?.message?.content || data?.content || "Sem conselho estratégico.";
        
        // Append response message
        const newMsg: DebateMessage = {
          id: `${mind.id}-${Date.now()}`,
          senderId: mind.id,
          senderName: mind.nome,
          senderIcon: mind.icon,
          senderColor: mind.modeloCor,
          role: "assistant",
          content: reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        
        tempMessages = [...tempMessages, newMsg];
        setDebateMessages(tempMessages);
      } catch (err: any) {
        console.error("Boardroom debate turn error", err);
        const errorMsg: DebateMessage = {
          id: `error-${mind.id}-${Date.now()}`,
          senderId: mind.id,
          senderName: mind.nome,
          senderIcon: mind.icon,
          senderColor: mind.modeloCor,
          role: "assistant",
          content: `⚠️ Peço desculpas ao conselho, mas tive uma falha ao conectar minhas conexões sinápticas. Dan, por favor, prossiga com as ideias para o CEO.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        tempMessages = [...tempMessages, errorMsg];
        setDebateMessages(tempMessages);
      }
    }
    
    // Finished all selected mind speeches. Now generate consolidated Mastermind report!
    setCurrentSpeakerIndex(-1);
    setSpeakerState("idle");
    setIsSynthesizing(true);
    
    try {
      const names = selectedMinds.map(m => m.nome).join(", ");
      const transcriptStr = tempMessages
        .filter(m => m.role === "assistant")
        .map(m => `### ${m.senderName} (Diretor de IA):\n${m.content}`)
        .join("\n\n");
        
      const synthPrompt = `Você é o Diretor-Geral Conselheiro do comitê executivo de inteligência do ImperioHQ.
Sua missão é consolidar os conselhos da Reunião de Diretoria de elite em um Plano de Ação Estratégico Executivo premium.

O comitê foi composto por: ${names}.
O problema central discutido foi: "${challengeText}".

Abaixo está a ata detalhada contendo a contribuição de cada diretor na reunião:
${transcriptStr}

Gere um Relatório de Diretoria oficial formatado em Markdown premium. Organize rigorosamente com:
1. **Diagnóstico do Desafio** (Visão sintetizada de todas as mentes sobre o problema real)
2. **Plano de Ação por Setor** (Ações de alta conversão propostas por cada especialista)
   - Exemplo: 🎯 *Posicionamento & Oferta (Dan Kennedy)*: ...
   - Exemplo: 📊 *Growth & Tráfego (Thiago Finch)*: ...
3. **Cronograma de Execução Imediato** (Priorização de impacto vs. esforço, passos 1, 2 e 3)
4. **Resumo das Assinaturas Digitais** (Uma seção elegante de encerramento mostrando as rubricas criptográficas das mentes)

Use emojis adequados, divisores de seção (---) e tabelas ou citações de destaque para tornar o relatório espetacular e profissional. Responda em Português do Brasil com tom executivo impecável.`;

      const synthPayload = {
        messages: [
          { role: "system", content: synthPrompt },
          { role: "user", content: "Por favor, consolide nossa reunião de diretoria no relatório oficial." }
        ],
        model: "openai/gpt-4o-mini"
      };
      
      const { data, error } = await supabase.functions.invoke("chat-with-ai", { body: synthPayload });
      if (error) throw error;
      
      const report = data?.choices?.[0]?.message?.content || data?.content || "Erro ao compilar ata.";
      setSynthesisReport(report);
      
      // Save full meeting to chat history in Supabase
      if (user) {
        await supabase.from("imphq_ai_chats").insert({
          user_id: user.id,
          title: `Boardroom: ${challengeText.slice(0, 50)}...`,
          model: "Mastermind Boardroom",
          messages: [
            ...tempMessages.map(m => ({ role: m.role === "user" ? "user" : "assistant", content: `[${m.senderName}]: ${m.content}` })),
            { role: "assistant", content: `[Relatório Consolidado]:\n${report}` }
          ]
        });
      }
      
    } catch (err: any) {
      console.error("Boardroom synthesis error", err);
      setSynthesisReport("⚠️ Não foi possível consolidar a ata automaticamente devido a um erro de conexão. No entanto, os discursos individuais dos diretores estão salvos acima.");
    } finally {
      setIsSynthesizing(false);
      setIsDebating(false);
    }
  };

  const handleStartDebate = () => {
    if (selectedMinds.length < 2 || !challenge.trim()) return;
    setStep("active");
    setDebateMessages([
      {
        id: "user-challenge",
        senderId: "user",
        senderName: "CEO (Você)",
        senderIcon: "👤",
        role: "user",
        content: challenge,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    
    // Trigger debate sequence in the background after setting the message
    setTimeout(() => {
      runBoardroomDebate(challenge, [
        {
          id: "user-challenge",
          senderId: "user",
          senderName: "CEO (Você)",
          senderIcon: "👤",
          role: "user",
          content: challenge,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }, 500);
  };

  const renderSetup = () => {
    const handleToggleMind = (mind: MenteDNA) => {
      if (selectedMinds.find(m => m.id === mind.id)) {
        setSelectedMinds(selectedMinds.filter(m => m.id !== mind.id));
      } else {
        if (selectedMinds.length >= 4) {
          toast.warning("Selecione no máximo 4 mentes para manter o foco do debate!");
          return;
        }
        setSelectedMinds([...selectedMinds, mind]);
      }
    };

    const handleSelectTemplate = (text: string) => {
      setChallenge(text);
    };

    const isStartDisabled = selectedMinds.length < 2 || !challenge.trim();

    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full items-stretch">
        
        {/* Left Side: Challenge Definition (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Card: O Desafio */}
          <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm p-5 space-y-4">
            <h3 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
              <Target className="h-4 w-4" />
              1. Defina o Desafio Estratégico
            </h3>
            
            <Textarea
              value={challenge}
              onChange={(e) => setChallenge(e.target.value)}
              placeholder="Descreva o problema real do seu negócio... Ex: Nossa taxa de rejeição no checkout subiu e as vendas caíram 30%. O tráfego vem do Facebook Ads. Qual o plano de ação?"
              className="min-h-[140px] bg-secondary border border-border resize-none text-sm placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary shadow-inner"
            />
            
            {/* Quick Templates */}
            <div>
              <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mb-2">Desafios Rápidos (Templates para testes)</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {CHALLENGE_TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectTemplate(tmpl.text)}
                    className="text-left p-3 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 hover:border-primary/20 transition-all duration-200"
                  >
                    <div className="text-xs font-bold flex items-center justify-between">
                      <span>{tmpl.title}</span>
                      <span className="text-[9px] text-muted-foreground px-1.5 py-0.5 rounded bg-secondary/80">{tmpl.category}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground line-clamp-2 mt-1 leading-snug">{tmpl.text}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Card: Contexto e Habilidades */}
          <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm p-5 space-y-4">
            <h3 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
              <Layers className="h-4 w-4" />
              2. Contexto do Negócio & Habilidades
            </h3>

            {/* Project dropdown */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Integrar Dados de Projeto</label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
              >
                <option value="none">Nenhum projeto (Debate Conceitual)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    💼 {p.name} ({p.produto || "Sem produto"})
                  </option>
                ))}
              </select>
              {selectedProject !== "none" && (
                <p className="text-[10px] text-emerald-400 font-medium">
                  ✓ Avatar, Branding, KPIs e Concorrentes do projeto serão injetados na mesa de diretoria!
                </p>
              )}
            </div>

            {/* Skills Accordion */}
            <div className="border border-border rounded-lg overflow-hidden bg-secondary/20">
              <button
                onClick={() => setIsSkillsExpanded(!isSkillsExpanded)}
                className="w-full flex items-center justify-between p-3 text-xs font-semibold hover:bg-secondary/40 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                  Habilidades Adicionais ({activeSkills.size} ativas)
                </span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isSkillsExpanded ? 'rotate-180' : ''}`} />
              </button>
              
              {isSkillsExpanded && (
                <div className="p-3 border-t border-border bg-card/30 space-y-2 max-h-[160px] overflow-y-auto">
                  {[
                    ...SKILLS_DATA.map(s => ({ id: s.id, nome: s.nome, categoria: s.categoria })),
                    ...customSkills.map(s => ({ id: s.id, nome: s.nome, categoria: s.categoria }))
                  ].map((skill) => (
                    <div key={skill.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`skill-${skill.id}`}
                        checked={activeSkills.has(skill.id)}
                        onCheckedChange={(checked) => {
                          const next = new Set(activeSkills);
                          if (checked) next.add(skill.id);
                          else next.delete(skill.id);
                          setActiveSkills(next);
                        }}
                      />
                      <label htmlFor={`skill-${skill.id}`} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer select-none">
                        <strong>{skill.nome}</strong> <span className="text-[9px] px-1.5 py-0.2 rounded bg-secondary ml-1">{skill.categoria}</span>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Mind Boardroom Selection (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm p-5 flex flex-col h-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                <Users className="h-4 w-4" />
                3. Convoque a Diretoria
              </h3>
              <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
                {selectedMinds.length}/4 Mentes
              </Badge>
            </div>

            <p className="text-[10px] text-muted-foreground mb-4">
              Selecione de 2 a 4 mentes sintéticas para debater seu desafio de negócios. A combinação padrão é ideal para tráfego, funil e copy.
            </p>

            {/* Mind Selection List */}
            <div className="flex-1 overflow-y-auto space-y-2 max-h-[380px] pr-1">
              {MENTES_DATA.map((mind) => {
                const isSelected = selectedMinds.some(m => m.id === mind.id);
                return (
                  <div
                    key={mind.id}
                    onClick={() => handleToggleMind(mind)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-inner"
                        : "border-border bg-secondary/20 hover:border-muted-foreground/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-secondary border border-border flex items-center justify-center text-xl shrink-0">
                        {mind.icon}
                      </div>
                      <div>
                        <div className="text-xs font-bold flex items-center gap-1.5">
                          {mind.nome}
                          <span className="text-[8px] px-1 py-0.1 border border-border rounded bg-secondary text-muted-foreground">Tier {mind.tier}</span>
                        </div>
                        <div className="text-[9px] text-amber-500 font-semibold">{mind.spec}</div>
                        <p className="text-[9px] text-muted-foreground mt-0.5 leading-snug line-clamp-1 max-w-[200px]">{mind.sobre}</p>
                      </div>
                    </div>
                    
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                      isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border"
                    }`}>
                      {isSelected && <span className="text-[10px]">✓</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Call Action Button */}
            <Button
              disabled={isStartDisabled}
              onClick={handleStartDebate}
              className="w-full mt-6 bg-gradient-to-r from-primary via-indigo-600 to-purple-600 hover:from-primary hover:to-purple-700 text-primary-foreground font-bold py-6 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:-translate-y-0 disabled:shadow-none"
            >
              <Sparkles className="h-5 w-5 animate-pulse" />
              <span>Convoque a Reunião de Diretoria 🔮</span>
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderActive = () => {
    const activeMind = currentSpeakerIndex !== -1 ? selectedMinds[currentSpeakerIndex] : null;

    const handleCopyReport = () => {
      navigator.clipboard.writeText(synthesisReport);
      toast.success("Relatório estratégico copiado com sucesso!");
    };

    const handleDownloadReport = () => {
      const element = document.createElement("a");
      const file = new Blob([synthesisReport], { type: 'text/markdown' });
      element.href = URL.createObjectURL(file);
      element.download = `Ata_Diretoria_${selectedProject !== "none" ? "Projeto" : "Geral"}.md`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      toast.success("Ata baixada com sucesso!");
    };

    const handleSendFollowUp = async () => {
      if (!followUpInput.trim() || isDebating) return;
      const text = followUpInput.trim();
      setFollowUpInput("");

      const userMsg: DebateMessage = {
        id: `user-followup-${Date.now()}`,
        senderId: "user",
        senderName: "CEO (Você)",
        senderIcon: "👤",
        role: "user",
        content: text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      const newMessages = [...debateMessages, userMsg];
      setDebateMessages(newMessages);

      setTimeout(() => {
        runBoardroomDebate(text, newMessages);
      }, 500);
    };

    return (
      <div className="flex flex-col gap-6 h-full items-stretch">
        
        {/* UPPER PANEL: THE VIRTUAL BOARD TABLE */}
        <div className="relative rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-6 shadow-lg shadow-black/10 overflow-hidden shrink-0 animate-fade-in">
          {/* Pulsing visual circles */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full border border-primary/10 bg-primary/5 blur-xl pointer-events-none animate-pulse" />
          
          <div className="relative z-10 flex flex-col items-center">
            
            {/* The Table Ring Graphic */}
            <div className="w-full max-w-2xl bg-secondary/40 border border-border/80 h-16 rounded-full flex items-center justify-center shadow-inner relative mt-6 mb-8">
              
              {/* Central pulsing mastermind core */}
              <div className="absolute w-28 h-8 rounded-full bg-gradient-to-r from-primary/10 to-indigo-600/10 border border-primary/20 flex items-center justify-center gap-1.5 shadow-md">
                <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                <span className="text-[9px] font-bold tracking-widest text-primary uppercase">INTELECTO</span>
              </div>

              {/* Arranging selected minds visually on/around the table desk */}
              <div className="absolute inset-x-4 -top-8 flex justify-around">
                {selectedMinds.map((mind, idx) => {
                  const isCurrent = currentSpeakerIndex === idx;
                  const isThinking = isCurrent && speakerState === "thinking";
                  const isTalking = isCurrent && speakerState === "talking";
                  
                  return (
                    <div 
                      key={mind.id} 
                      className={`flex flex-col items-center transition-all duration-300 ${
                        isCurrent ? "scale-110 -translate-y-1" : "scale-90 opacity-70"
                      }`}
                    >
                      <div 
                        className={`w-14 h-14 rounded-full bg-secondary border flex items-center justify-center text-3xl relative shadow-md transition-all duration-500 ${
                          isThinking ? "border-sky-400 ring-4 ring-sky-400/20 bg-card" :
                          isTalking ? "border-emerald-400 ring-4 ring-emerald-400/20 bg-card animate-pulse" :
                          "border-border bg-card"
                        }`}
                      >
                        {mind.icon}
                        
                        {/* Glow halo badge */}
                        {isCurrent && (
                          <span className={`absolute -bottom-1 px-2 py-0.5 rounded-full text-[8px] font-bold text-white shadow border ${
                            isThinking ? "bg-sky-500 border-sky-400 animate-pulse animate-none" : "bg-emerald-500 border-emerald-400"
                          }`}>
                            {isThinking ? "PENSANDO" : "FALANDO"}
                          </span>
                        )}
                      </div>
                      
                      <span className="text-[10px] font-bold mt-2 text-foreground">{mind.nome}</span>
                      <span className="text-[8px] text-muted-foreground font-semibold">{mind.spec}</span>
                    </div>
                  );
                })}
              </div>

            </div>

            {/* Speaking Status Caption */}
            {isDebating ? (
              <div className="text-center mt-2">
                {speakerState === "thinking" && activeMind && (
                  <p className="text-xs text-sky-400 font-medium animate-pulse">
                    🔮 {activeMind.nome} está analisando o histórico e estruturando seus argumentos de {activeMind.spec}...
                  </p>
                )}
                {speakerState === "talking" && activeMind && (
                  <p className="text-xs text-emerald-400 font-medium">
                    🗣️ {activeMind.nome} está discursando na mesa redonda de negócios...
                  </p>
                )}
              </div>
            ) : isSynthesizing ? (
              <div className="text-center mt-2 flex flex-col items-center">
                <p className="text-xs text-primary font-medium animate-pulse flex items-center gap-1.5">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Sintetizando todas as ideias e redigindo a Ata Oficial da Reunião de Diretoria...
                </p>
                <div className="w-48 h-1.5 bg-secondary rounded-full overflow-hidden mt-2 border border-border">
                  <div className="h-full bg-primary rounded-full animate-pulse bg-gradient-to-r from-primary to-indigo-500" style={{ width: '80%' }} />
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Reunião de diretoria concluída. Ata final consolidada e aberta para tréplicas abaixo.
              </p>
            )}

          </div>
        </div>

        {/* BOTTOM PANEL: TRANSCRIPT & SYNTHESIS REPORT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0 overflow-hidden">
          
          {/* Left Column: Live Transcript (5 cols) */}
          <div className="lg:col-span-5 flex flex-col border border-border rounded-2xl bg-card/40 backdrop-blur-sm overflow-hidden h-[450px] lg:h-auto">
            <div className="px-4 py-3 border-b border-border bg-card/60 flex justify-between items-center shrink-0">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                Ata de Discussão
              </span>
              <Badge variant="outline" className="text-[9px] border-border text-muted-foreground">
                {debateMessages.length} intervenções
              </Badge>
            </div>

            {/* Scrollable chat area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {debateMessages.map((msg, index) => {
                const isUser = msg.role === "user";
                return (
                  <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                    
                    {/* Speaker icon for assistant */}
                    {!isUser && (
                      <div className="w-8 h-8 rounded-xl bg-secondary border border-border shrink-0 flex items-center justify-center text-xl mr-2.5 mt-0.5 shadow-sm">
                        {msg.senderIcon}
                      </div>
                    )}
                    
                    <div className={`max-w-[85%] rounded-xl px-4 py-3 text-xs leading-relaxed shadow-sm border ${
                      isUser
                        ? "bg-primary border-primary/20 text-primary-foreground rounded-br-sm"
                        : "bg-secondary/60 border-border/80 rounded-bl-sm"
                    }`}>
                      
                      {/* Speaker header */}
                      {!isUser && (
                        <div className="flex items-center gap-2 mb-1.5 shrink-0 border-b border-border/30 pb-1">
                          <span className="font-bold text-foreground">{msg.senderName}</span>
                          <span className="text-[8px] px-1.5 py-0.2 rounded border bg-card/50" style={{ color: msg.senderColor, borderColor: `${msg.senderColor}44` }}>
                            {msg.senderId === 'dan_kennedy' ? "Direct Response" : 
                             msg.senderId === 'eugene_schwartz' ? "Nível de Consciência" : 
                             msg.senderId === 'thiago_finch' ? "Growth & Tráfego" : "IA Expert"}
                          </span>
                          <span className="text-[8px] text-muted-foreground/60 ml-auto font-medium">{msg.timestamp}</span>
                        </div>
                      )}

                      {isUser && (
                        <div className="flex items-center gap-2 mb-1 shrink-0 pb-1 text-primary-foreground/90 font-bold">
                          <span>{msg.senderName}</span>
                          <span className="text-[8px] text-primary-foreground/60 ml-auto">{msg.timestamp}</span>
                        </div>
                      )}

                      <div className="whitespace-pre-line text-foreground/90 leading-relaxed font-sans mt-1">
                        {msg.content}
                      </div>

                    </div>
                  </div>
                );
              })}

              {/* Speaker Thinking typing placeholder */}
              {isDebating && speakerState === "thinking" && activeMindsCurrent() && (
                <div className="flex justify-start">
                  <div className="w-8 h-8 rounded-xl bg-secondary border border-border shrink-0 flex items-center justify-center text-xl mr-2.5 mt-0.5">
                    {activeMindsCurrent()?.icon}
                  </div>
                  <div className="bg-secondary/40 border border-border/50 rounded-xl rounded-bl-sm px-4 py-3 shadow-inner">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">
                        {activeMindsCurrent()?.nome} está raciocinando...
                      </span>
                      <div className="flex gap-1 py-1">
                        <span className="w-2.5 h-2.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2.5 h-2.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2.5 h-2.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Synthesis compiling placeholder */}
              {isSynthesizing && (
                <div className="flex justify-start">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 shrink-0 flex items-center justify-center text-xl mr-2.5 mt-0.5 animate-pulse">
                    🧠
                  </div>
                  <div className="bg-primary/5 border border-primary/10 rounded-xl rounded-bl-sm px-4 py-3">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[9px] text-primary font-semibold uppercase tracking-wider">
                        Consolidador Mastermind está redigindo o relatório...
                      </span>
                      <div className="flex gap-1 py-1">
                        <span className="w-2.5 h-2.5 bg-indigo-500/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2.5 h-2.5 bg-indigo-500/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2.5 h-2.5 bg-indigo-500/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input follow-up bottom entry */}
            <div className="p-3 border-t border-border bg-card/60 shrink-0">
              <div className="flex gap-2">
                <Textarea
                  value={followUpInput}
                  onChange={e => setFollowUpInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendFollowUp(); } }}
                  placeholder={isDebating || isSynthesizing ? "Aguarde o encerramento do debate..." : "Fazer tréplica / Perguntar ao comitê..."}
                  className="resize-none bg-secondary/80 text-xs min-h-[38px] max-h-[100px] border border-border shadow-inner"
                  rows={1}
                  disabled={isDebating || isSynthesizing}
                />
                <Button 
                  onClick={handleSendFollowUp} 
                  size="icon" 
                  disabled={isDebating || isSynthesizing || !followUpInput.trim()} 
                  className="shrink-0 self-end bg-primary shadow shadow-primary/20"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

          </div>

          {/* Right Column: Exec Synthesis Report */}
          <div className="lg:col-span-7 flex flex-col border border-border rounded-2xl bg-card/40 backdrop-blur-sm overflow-hidden h-[450px] lg:h-auto">
            <div className="px-4 py-3 border-b border-border bg-card/60 flex justify-between items-center shrink-0">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Relatório Estratégico Consolidado
              </span>
              
              {synthesisReport && (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={handleCopyReport} className="h-7 text-[10px] gap-1 hover:bg-secondary">
                    <Copy className="h-3 w-3" />
                    Copiar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleDownloadReport} className="h-7 text-[10px] gap-1 hover:bg-secondary">
                    <Download className="h-3 w-3" />
                    Baixar (.md)
                  </Button>
                </div>
              )}
            </div>

            {/* Document Content View */}
            <div className="flex-1 overflow-y-auto p-6 bg-card/10 select-text">
              {synthesisReport ? (
                <div className="prose prose-sm prose-invert max-w-none text-xs text-foreground/80 leading-relaxed font-serif">
                  <ReactMarkdown>{synthesisReport}</ReactMarkdown>
                </div>
              ) : isSynthesizing || isDebating ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3">
                  <div className="w-12 h-12 rounded-full border border-primary/20 bg-primary/5 flex items-center justify-center animate-spin-slow">
                    🧠
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Relatório Executivo em Elaboração</h4>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                      O comitê está ativamente debatendo as ideias. Assim que todos discursarem, a ata consolidada será gerada e rubricada eletronicamente.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-xs">Nenhum debate foi iniciado ainda nesta seção.</p>
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch bg-background/98 backdrop-blur-md animate-fade-in text-foreground">
      <div className="flex flex-col w-full max-w-6xl mx-auto border-x border-border bg-gradient-to-b from-background to-secondary/30">
        
        {/* HEADER */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-card shrink-0 shadow-sm">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose} 
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-2xl animate-pulse">
            🔮
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold flex items-center gap-2">
              <span>Mesa Redonda de IAs</span>
              <Badge className="bg-primary/20 text-primary border-primary/30 text-[9px] h-4">Mastermind Boardroom</Badge>
            </div>
            <div className="text-[10px] text-muted-foreground">Reunião de Diretores de IA para decisões estratégicas integradas</div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === "setup" ? renderSetup() : renderActive()}
        </div>
      </div>
    </div>
  );
}

// ────── Main Page ──────
export default function Mentes() {
  const [selectedMente, setSelectedMente] = useState<MenteDNA | null>(null);
  const [isBoardroomMode, setIsBoardroomMode] = useState(false);
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
            🧬 Mentes Sintéticas <SectionInfo {...sectionHelpTexts.mentes} />
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

      {/* Boardroom Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-purple-500/5 to-card p-6 shadow-xl shadow-primary/5 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Decorative lights */}
        <div className="absolute -left-10 -top-10 w-40 h-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center text-3xl shadow-lg shadow-primary/10 shrink-0">
            🔮
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              Mesa Redonda das Mentes <Badge className="bg-primary/20 text-primary hover:bg-primary/30 border-primary/30">Mastermind</Badge>
            </h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">
              Reúna múltiplos clones cognitivos em um comitê executivo. Defina um desafio de negócios e assista as mentes debaterem estratégias de tráfego, copy e oferta, compilando um relatório estratégico unificado.
            </p>
          </div>
        </div>

        <Button 
          onClick={() => setIsBoardroomMode(true)}
          className="relative z-10 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold px-6 py-5 rounded-xl flex items-center gap-2 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 shrink-0 group animate-pulse"
        >
          <Brain className="h-4 w-4 animate-pulse" />
          <span>Convocar Diretoria</span>
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Button>
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

      {/* RAG Inspector — Central de Conhecimento */}
      <div className="pt-6 mt-6 border-t border-border/40">
        <div className="mb-3">
          <h2 className="font-display text-xl font-bold text-primary">Central de Conhecimento & RAG Inspector</h2>
          <p className="text-xs text-muted-foreground mt-1">Inspecione e gerencie a memória e os documentos que alimentam as mentes.</p>
        </div>
        <RagInspector projectFilter="all" />
      </div>

      {/* Modal */}
      {selectedMente && (
        <RayXModal mente={selectedMente} onClose={() => setSelectedMente(null)} />
      )}

      {/* Boardroom Modal */}
      {isBoardroomMode && (
        <BoardroomModal onClose={() => setIsBoardroomMode(false)} />
      )}
    </div>
  );
}

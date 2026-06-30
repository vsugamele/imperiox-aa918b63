import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Zap, CheckCircle2, AlertCircle, Sparkles, Search } from "lucide-react";

type Step = "avatar"|"vsl"|"lp"|"angulos"|"reels"|"imagens"|"whatsapp_x1"|"fluxos_pos_venda";
type InvStatus = "ok" | "fraco" | "faltando";

const STEP_LABELS: Record<Step, string> = {
  avatar: "🧠 Avatar (4 camadas)",
  vsl: "🎬 VSL Filemon E3",
  lp: "📄 LP Persuasiva",
  angulos: "🎯 5 Ângulos de criativo",
  reels: "📱 5 Roteiros Reels",
  imagens: "🖼️ Imagens (5 mockups)",
  whatsapp_x1: "💬 Sequência WhatsApp X1",
  fluxos_pos_venda: "⚙️ Fluxos pós-venda (3 OpenFlow)",
};
const STEP_HUB: Record<string, string> = { hub: "🗺️ Montar funil no Hub" };

const ALL_STEPS: Step[] = ["avatar","vsl","lp","angulos","reels","imagens","whatsapp_x1","fluxos_pos_venda"];
const DISPLAY_STEPS = [...ALL_STEPS, "hub"] as const;

const PRESETS: Record<string, { label: string; steps: Step[]; hint: string; modo?: "organizar" }> = {
  completo: { label: "🏛️ Completo", steps: ALL_STEPS, hint: "Tudo: avatar + VSL + LP + ads + reels + imagens + WhatsApp + fluxos" },
  vsl_launch: { label: "🎬 VSL Launch", steps: ["avatar","vsl","lp","angulos","reels","imagens"], hint: "Foco em VSL + LP + ads (sem WhatsApp/fluxos)" },
  x1_only: { label: "💬 X1 Express", steps: ["avatar","whatsapp_x1","imagens","fluxos_pos_venda"], hint: "Só venda 1:1 no WhatsApp + 1 mockup + pós-venda" },
  organizar: { label: "🔍 Organizar Existente", steps: ALL_STEPS, hint: "Analisa o que já existe, marca gaps e gera só o que falta (precisa de projeto+produto existentes)", modo: "organizar" },
};

const STATUS_ICON: Record<InvStatus, string> = { ok: "✅", fraco: "⚠️", faltando: "❌" };
const STATUS_LABEL: Record<InvStatus, string> = { ok: "OK", fraco: "Fraco/Antigo", faltando: "Faltando" };

type Estrategia = "lancamento" | "perpetuo" | "webinar" | "x1";
const ESTRATEGIAS: Record<Estrategia, { label: string; emoji: string; hint: string }> = {
  lancamento: { label: "Lançamento", emoji: "🚀", hint: "CPL + carrinho aberto + recovery" },
  perpetuo: { label: "Perpétuo", emoji: "♻️", hint: "VSL evergreen + order bump + upsell" },
  webinar: { label: "Webinar", emoji: "🎤", hint: "Inscrição + lembretes + pitch ao vivo" },
  x1: { label: "X1 / DM", emoji: "💬", hint: "Venda 1:1 no WhatsApp/Instagram" },
};

type StepState = "pending" | "running" | "done" | "error";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onComplete?: (projectId: string) => void;
}

export function OneClickModal({ open, onOpenChange, onComplete }: Props) {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [swipes, setSwipes] = useState<{ id: string; title: string; formato: string }[]>([]);
  const [destino, setDestino] = useState<string>("__new__");
  const [novoNome, setNovoNome] = useState("");

  // Produtos do projeto + modo de produto
  const [produtosDoProjeto, setProdutosDoProjeto] = useState<any[]>([]);
  const [produtoSel, setProdutoSel] = useState<string>("__new_prod__"); // "__new_prod__" ou nome do produto
  const [produtoNome, setProdutoNome] = useState("");
  const [ticket, setTicket] = useState("");
  const [promessa, setPromessa] = useState("");
  const [nicho, setNicho] = useState("");
  const [swipeId, setSwipeId] = useState<string>("__none__");
  const [preset, setPreset] = useState<string>("completo");
  const [etapasSel, setEtapasSel] = useState<Set<Step>>(new Set(ALL_STEPS));

  // Inventário (modo organizar)
  const [inventario, setInventario] = useState<Record<string, InvStatus> | null>(null);
  const [estrategia, setEstrategia] = useState<Estrategia>("perpetuo");
  const [invScore, setInvScore] = useState<number | null>(null);
  const [invBlocos, setInvBlocos] = useState<Record<string, { score: number }> | null>(null);
  const [topGaps, setTopGaps] = useState<any[]>([]);
  const [ondas, setOndas] = useState<{ onda1: any[]; onda2: any[]; onda3: any[] } | null>(null);
  const [nextAction, setNextAction] = useState<string>("");
  const [loadingInv, setLoadingInv] = useState(false);

  const [rodando, setRodando] = useState(false);
  const [progresso, setProgresso] = useState<Record<string, { state: StepState; preview?: string; error?: string }>>(
    Object.fromEntries(DISPLAY_STEPS.map(s => [s, { state: "pending" }])) as any
  );
  const [audit, setAudit] = useState<any>(null);
  const [auditState, setAuditState] = useState<StepState>("pending");
  const [finalProjectId, setFinalProjectId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const modoOrganizar = preset === "organizar";

  useEffect(() => {
    if (!open) return;
    supabase.from("imphq_projects").select("id, name").order("name").then(({ data }) => {
      setProjects((data || []) as any);
    });
    supabase.from("imphq_swipes")
      .select("id, title, formato")
      .in("formato", ["vsl","lp","webinar"])
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setSwipes((data || []) as any));
  }, [open]);

  // Carrega produtos do projeto selecionado
  useEffect(() => {
    if (destino === "__new__") {
      setProdutosDoProjeto([]);
      setProdutoSel("__new_prod__");
      return;
    }
    supabase.from("imphq_projects").select("data").eq("id", destino).maybeSingle().then(({ data }) => {
      const d: any = data?.data || {};
      const lista = Array.isArray(d?.briefing?.produtos) ? d.briefing.produtos
        : Array.isArray(d?.produtos) ? d.produtos : [];
      setProdutosDoProjeto(lista);
      if (lista.length > 0) setProdutoSel(typeof lista[0] === "string" ? lista[0] : lista[0]?.nome || "__new_prod__");
    });
  }, [destino]);

  // Autofill quando seleciona produto existente
  useEffect(() => {
    if (produtoSel === "__new_prod__") return;
    const p = produtosDoProjeto.find((x: any) => (typeof x === "string" ? x : x?.nome) === produtoSel);
    if (!p || typeof p === "string") {
      setProdutoNome(produtoSel);
      return;
    }
    setProdutoNome(p.nome || produtoSel);
    if (p.preco || p.ticket) setTicket(String(p.preco || p.ticket));
    if (p.promessa) setPromessa(p.promessa);
  }, [produtoSel, produtosDoProjeto]);

  // Carregar inventário quando modo organizar + projeto + produto definidos
  async function carregarInventario() {
    if (!modoOrganizar) return;
    if (destino === "__new__") { toast.error("Modo Organizar precisa de projeto existente"); return; }
    const nome = produtoSel === "__new_prod__" ? produtoNome.trim() : produtoSel;
    if (!nome) { toast.error("Selecione ou informe o produto"); return; }
    setLoadingInv(true);
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ecosystem-inventory`;
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ projeto_id: destino, produto_nome: nome, estrategia }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Falha inventário");
      const inv = j.inventario as Record<string, InvStatus>;
      setInventario(inv);
      setInvScore(typeof j.score === "number" ? j.score : null);
      setInvBlocos(j.scores_por_bloco || null);
      setTopGaps(Array.isArray(j.top_gaps) ? j.top_gaps : []);
      setOndas(j.ondas || null);
      setNextAction(j.next_action || "");
      // pré-seleciona só os que faltam ou estão fracos
      const sel = new Set<Step>();
      ALL_STEPS.forEach(s => {
        if (inv[s] === "faltando" || inv[s] === "fraco") sel.add(s);
      });
      setEtapasSel(sel);
      toast.success(`Score ${j.score}/100 — ${(j.top_gaps || []).length} gaps detectados`);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao inventariar");
    } finally {
      setLoadingInv(false);
    }
  }

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      setRodando(false);
      setFinalProjectId(null);
      setAudit(null);
      setAuditState("pending");
      setInventario(null);
      setInvScore(null); setInvBlocos(null); setTopGaps([]); setOndas(null); setNextAction("");
      setProgresso(Object.fromEntries(DISPLAY_STEPS.map(s => [s, { state: "pending" }])) as any);
    }
  }, [open]);

  function applyPreset(key: string) {
    setPreset(key);
    const p = PRESETS[key];
    if (p) setEtapasSel(new Set(p.steps));
    if (key !== "organizar") setInventario(null);
  }

  function toggleStep(s: Step) {
    const ns = new Set(etapasSel);
    ns.has(s) ? ns.delete(s) : ns.add(s);
    setEtapasSel(ns);
  }

  async function rodar() {
    const nomeFinal = produtoSel === "__new_prod__" ? produtoNome.trim() : produtoSel;
    if (!nomeFinal) return toast.error("Informe o nome do produto");
    if (destino === "__new__" && !novoNome.trim()) return toast.error("Informe o nome do novo projeto");
    if (etapasSel.size === 0) return toast.error("Selecione pelo menos uma etapa");
    if (modoOrganizar && destino === "__new__") return toast.error("Organizar exige projeto existente");

    setRodando(true);
    setAudit(null);
    setAuditState("pending");
    setProgresso(Object.fromEntries(DISPLAY_STEPS.map(s => [s, { state: "pending" }])) as any);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setRodando(false); return toast.error("Sessão expirada"); }

    const body: any = {
      produto_nome: nomeFinal,
      ticket: ticket.trim() || undefined,
      promessa: promessa.trim() || undefined,
      nicho: nicho.trim() || undefined,
      etapas: Array.from(etapasSel),
      modo: modoOrganizar ? "complementar" : "criar",
    };
    if (destino === "__new__") body.novo_projeto_nome = novoNome.trim();
    else body.projeto_id = destino;
    if (swipeId !== "__none__") body.swipe_id = swipeId;

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ecosystem-from-name`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`);

      const reader = resp.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        const lines = buf.split("\n\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === "project_created") {
              setFinalProjectId(evt.projeto_id);
            } else if (evt.type === "step_start") {
              setProgresso(p => ({ ...p, [evt.step]: { state: "running" } }));
            } else if (evt.type === "step_done") {
              setProgresso(p => ({ ...p, [evt.step]: { state: "done", preview: evt.preview } }));
            } else if (evt.type === "step_error") {
              setProgresso(p => ({ ...p, [evt.step]: { state: "error", error: evt.error } }));
            } else if (evt.type === "audit_start") {
              setAuditState("running");
            } else if (evt.type === "audit_done") {
              setAudit(evt.audit);
              setAuditState("done");
            } else if (evt.type === "audit_error") {
              setAuditState("error");
            } else if (evt.type === "done") {
              const pid = evt.resultado?.projeto_id || finalProjectId || (destino !== "__new__" ? destino : null);
              setFinalProjectId(pid);
              toast.success("One Click concluído! Abrindo no Hub…");
              if (pid) onComplete?.(pid);
            } else if (evt.type === "fatal") {
              toast.error(evt.error);
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.error(e?.message || "Falha ao executar");
    } finally {
      setRodando(false);
    }
  }

  const score = audit?.score ?? audit?.diagnostico?.score ?? audit?.audit?.score;
  const gaps: string[] = audit?.gaps ?? audit?.diagnostico?.gaps ?? audit?.recomendacoes ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-secondary/40 max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-serif text-primary">
            <Zap className="h-5 w-5" /> One Click — Funil dentro do Hub
          </DialogTitle>
          <DialogDescription className="leading-7">
            Avatar primeiro; depois VSL, LP, ângulos, reels, imagens e WhatsApp rodam <strong>em paralelo</strong>. Funil é montado no <strong>Hub</strong> e o <strong>Auditor Imperius</strong> roda automático no final. No modo <strong>Organizar</strong>, inventaria o que já existe e gera apenas os gaps.
          </DialogDescription>
        </DialogHeader>

        {!rodando && (
          <div className="space-y-4 py-2">
            {/* Estratégia */}
            <div className="space-y-2">
              <Label className="text-sm">Estratégia do funil</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(Object.entries(ESTRATEGIAS) as [Estrategia, typeof ESTRATEGIAS[Estrategia]][]).map(([k, e]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => { setEstrategia(k); if (modoOrganizar) setInventario(null); }}
                    className={`p-2 rounded text-left text-xs border transition ${estrategia === k ? "border-primary bg-primary/10" : "border-border/40 hover:bg-background/40"}`}
                  >
                    <div className="text-sm font-medium">{e.emoji} {e.label}</div>
                    <div className="text-[10px] text-muted-foreground leading-4 mt-0.5">{e.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Presets */}
            <div className="space-y-2">
              <Label className="text-sm">Preset rápido</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(PRESETS).map(([k, p]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => applyPreset(k)}
                    className={`px-3 py-2 rounded text-sm border transition ${preset === k ? "border-primary bg-primary/10 text-primary" : "border-border/40 hover:bg-background/40"}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {PRESETS[preset] && <div className="text-xs text-muted-foreground">{PRESETS[preset].hint}</div>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Projeto destino</Label>
                <Select value={destino} onValueChange={setDestino}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__new__">➕ Criar novo projeto</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {destino === "__new__" && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Nome do novo projeto</Label>
                  <Input value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Ex: Corte Express — JP" />
                </div>
              )}

              {/* Produto: dropdown se projeto existente, input se novo */}
              {destino !== "__new__" ? (
                <div className="space-y-2 md:col-span-2">
                  <Label>Produto *</Label>
                  <Select value={produtoSel} onValueChange={setProdutoSel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__new_prod__">➕ Novo produto</SelectItem>
                      {produtosDoProjeto.map((p: any, i: number) => {
                        const nome = typeof p === "string" ? p : p?.nome;
                        if (!nome) return null;
                        return <SelectItem key={`${nome}-${i}`} value={nome}>{nome}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                  {produtoSel === "__new_prod__" && (
                    <Input value={produtoNome} onChange={e => setProdutoNome(e.target.value)} placeholder="Nome do novo produto" />
                  )}
                  {produtosDoProjeto.length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhum produto no briefing — informe um nome novo.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2 md:col-span-2">
                  <Label>Nome do produto *</Label>
                  <Input value={produtoNome} onChange={e => setProdutoNome(e.target.value)} placeholder="Ex: Corte Express" />
                </div>
              )}

              <div className="space-y-2">
                <Label>Ticket (opcional)</Label>
                <Input value={ticket} onChange={e => setTicket(e.target.value)} placeholder="R$ 497" />
              </div>
              <div className="space-y-2">
                <Label>Nicho (opcional)</Label>
                <Input value={nicho} onChange={e => setNicho(e.target.value)} placeholder="Barbeiros iniciantes" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Promessa (opcional)</Label>
                <Input value={promessa} onChange={e => setPromessa(e.target.value)} placeholder="Domine 3 cortes que pagam o mês em 7 dias" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Inspirar-se em Swipefile (opcional)</Label>
                <Select value={swipeId} onValueChange={setSwipeId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem referência</SelectItem>
                    {swipes.map(s => <SelectItem key={s.id} value={s.id}>[{s.formato}] {s.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Modo Organizar: botão de inventário + checklist */}
            {modoOrganizar && (
              <div className="space-y-3 border border-primary/30 bg-primary/5 rounded p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-primary flex items-center gap-2">
                    <Search className="h-4 w-4" /> Inventário do funil existente
                  </div>
                  <Button size="sm" variant="outline" onClick={carregarInventario} disabled={loadingInv}>
                    {loadingInv ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    {inventario ? "Reanalisar" : "Analisar"}
                  </Button>
                </div>
                {inventario && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-xs">
                    {ALL_STEPS.map(s => {
                      const st = inventario[s];
                      return (
                        <div key={s} className="flex items-center justify-between p-1.5 rounded bg-background/40">
                          <span>{STEP_LABELS[s]}</span>
                          <span className="text-muted-foreground">{STATUS_ICON[st]} {STATUS_LABEL[st]}</span>
                        </div>
                      );
                    })}
                    {inventario.hub && (
                      <div className="flex items-center justify-between p-1.5 rounded bg-background/40 md:col-span-2">
                        <span>🗺️ Hub no canvas</span>
                        <span className="text-muted-foreground">{STATUS_ICON[inventario.hub]} {STATUS_LABEL[inventario.hub]}</span>
                      </div>
                    )}
                  </div>
                )}
                {inventario && invScore !== null && (
                  <div className="space-y-3 border-t border-primary/20 pt-3">
                    {/* Score */}
                    <div className="flex items-center gap-3">
                      <div className={`text-3xl font-bold ${invScore >= 70 ? "text-green-400" : invScore >= 40 ? "text-amber-400" : "text-red-400"}`}>
                        {invScore}<span className="text-sm text-muted-foreground">/100</span>
                      </div>
                      <div className="flex-1 grid grid-cols-3 gap-1 text-[10px]">
                        {invBlocos && (Object.entries(invBlocos)).map(([b, v]) => (
                          <div key={b} className="rounded bg-background/40 p-1.5 text-center">
                            <div className="text-muted-foreground">{b}</div>
                            <div className="font-semibold">{v.score}%</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {nextAction && <div className="text-xs text-primary">🎯 {nextAction}</div>}

                    {/* Top gaps */}
                    {topGaps.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">Top gaps prioritários:</div>
                        {topGaps.slice(0, 5).map((g, i) => (
                          <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded bg-background/40">
                            <span>{g.partial ? "⚠️" : "❌"} {g.label}</span>
                            <span className="text-muted-foreground text-[10px]">{g.bloco} • esforço {g.esforco}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 3 ondas */}
                    {ondas && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                        {[
                          { key: "onda1", label: "⚡ Onda 1 — Quick wins", items: ondas.onda1 },
                          { key: "onda2", label: "🏗️ Onda 2 — Estrutura", items: ondas.onda2 },
                          { key: "onda3", label: "🎯 Onda 3 — Otimização", items: ondas.onda3 },
                        ].map((o) => (
                          <div key={o.key} className="rounded border border-border/40 bg-background/40 p-2 space-y-1">
                            <div className="font-medium">{o.label}</div>
                            {o.items.length === 0 && <div className="text-muted-foreground text-[10px]">Nada pendente</div>}
                            {o.items.map((it: any, i: number) => (
                              <div key={i} className="text-[11px] text-muted-foreground">• {it.label}</div>
                            ))}
                            {o.items.length > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full h-7 text-[11px] mt-1"
                                onClick={() => {
                                  const steps = new Set<Step>();
                                  o.items.forEach((it: any) => {
                                    if (ALL_STEPS.includes(it.etapa as Step)) steps.add(it.etapa as Step);
                                  });
                                  setEtapasSel(steps);
                                  toast.success(`${steps.size} etapas selecionadas para esta onda`);
                                }}
                              >
                                Selecionar esta onda
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {inventario && (
                  <p className="text-xs text-muted-foreground">Etapas marcadas abaixo serão geradas para preencher os gaps. Avatar existente é reaproveitado.</p>
                )}
              </div>
            )}

            <div className="space-y-2 border-t border-border/40 pt-4">
              <Label className="text-sm">Etapas (marque o que gerar)</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {ALL_STEPS.map(s => {
                  const invSt = inventario?.[s];
                  return (
                    <label key={s} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-background/40 p-2 rounded">
                      <Checkbox checked={etapasSel.has(s)} onCheckedChange={() => toggleStep(s)} />
                      <span>{STEP_LABELS[s]}</span>
                      {invSt && <span className="ml-auto text-xs text-muted-foreground">{STATUS_ICON[invSt]}</span>}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={rodar} className="gap-2">
                <Zap className="h-4 w-4" /> {modoOrganizar ? "Completar funil" : "Rodar One Click"}
              </Button>
            </div>
          </div>
        )}

        {rodando || progresso.avatar.state !== "pending" ? (
          <div className="space-y-2 py-2">
            <div className="text-sm text-muted-foreground">Progresso:</div>
            <ul className="space-y-2">
              {[...Array.from(etapasSel), "hub"].map(s => {
                const st = progresso[s];
                const label = (STEP_LABELS as any)[s] || STEP_HUB[s] || s;
                return (
                  <li key={s} className="flex items-start gap-3 p-3 rounded bg-background/40 border border-border/30">
                    <div className="mt-0.5">
                      {st.state === "pending" && <div className="h-4 w-4 rounded-full border border-muted-foreground/40" />}
                      {st.state === "running" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                      {st.state === "done" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      {st.state === "error" && <AlertCircle className="h-4 w-4 text-destructive" />}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{label}</div>
                      {st.preview && <div className="text-xs text-muted-foreground mt-1">{st.preview}</div>}
                      {st.error && <div className="text-xs text-destructive mt-1">{st.error}</div>}
                    </div>
                  </li>
                );
              })}
              {auditState !== "pending" && (
                <li className="flex items-start gap-3 p-3 rounded bg-background/40 border border-primary/30">
                  <div className="mt-0.5">
                    {auditState === "running" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                    {auditState === "done" && <Sparkles className="h-4 w-4 text-primary" />}
                    {auditState === "error" && <AlertCircle className="h-4 w-4 text-destructive" />}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">🔮 Auditor Imperius</div>
                    {auditState === "running" && <div className="text-xs text-muted-foreground mt-1">Analisando funil…</div>}
                    {auditState === "done" && (
                      <div className="text-xs text-muted-foreground mt-1 space-y-1">
                        {typeof score !== "undefined" && <div>Score: <strong className="text-primary">{score}</strong></div>}
                        {Array.isArray(gaps) && gaps.length > 0 && (
                          <ul className="list-disc ml-4 space-y-0.5">
                            {gaps.slice(0, 3).map((g: any, i: number) => (
                              <li key={i}>{typeof g === "string" ? g : (g?.titulo || g?.gap || JSON.stringify(g))}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                    {auditState === "error" && <div className="text-xs text-destructive mt-1">Falha ao auditar</div>}
                  </div>
                </li>
              )}
            </ul>

            {!rodando && finalProjectId && (
              <div className="flex justify-end gap-2 pt-4">
                <Button onClick={() => onOpenChange(false)}>Ver no Hub</Button>
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

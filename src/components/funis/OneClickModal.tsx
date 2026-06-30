import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Zap, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";

type Step = "avatar"|"vsl"|"lp"|"angulos"|"reels"|"imagens"|"whatsapp_x1"|"fluxos_pos_venda"|"hub";

const STEP_LABELS: Record<Step, string> = {
  avatar: "🧠 Avatar (4 camadas)",
  vsl: "🎬 VSL Filemon E3",
  lp: "📄 LP Persuasiva",
  angulos: "🎯 5 Ângulos de criativo",
  reels: "📱 5 Roteiros Reels",
  imagens: "🖼️ Imagens (5 mockups)",
  whatsapp_x1: "💬 Sequência WhatsApp X1",
  fluxos_pos_venda: "⚙️ Fluxos pós-venda (3 OpenFlow)",
  hub: "🗺️ Montar funil no Hub",
};

const ALL_STEPS: Step[] = ["avatar","vsl","lp","angulos","reels","imagens","whatsapp_x1","fluxos_pos_venda"];
const DISPLAY_STEPS: Step[] = [...ALL_STEPS, "hub"];

const PRESETS: Record<string, { label: string; steps: Step[]; hint: string }> = {
  completo: { label: "🏛️ Completo", steps: ALL_STEPS, hint: "Tudo: avatar + VSL + LP + ads + reels + imagens + WhatsApp + fluxos" },
  vsl_launch: { label: "🎬 VSL Launch", steps: ["avatar","vsl","lp","angulos","reels","imagens"], hint: "Foco em VSL + LP + ads (sem WhatsApp/fluxos)" },
  x1_only: { label: "💬 X1 Express", steps: ["avatar","whatsapp_x1","imagens","fluxos_pos_venda"], hint: "Só venda 1:1 no WhatsApp + 1 mockup + pós-venda" },
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
  const [produtoNome, setProdutoNome] = useState("");
  const [ticket, setTicket] = useState("");
  const [promessa, setPromessa] = useState("");
  const [nicho, setNicho] = useState("");
  const [swipeId, setSwipeId] = useState<string>("__none__");
  const [preset, setPreset] = useState<string>("completo");
  const [etapasSel, setEtapasSel] = useState<Set<Step>>(new Set(ALL_STEPS));
  const [rodando, setRodando] = useState(false);
  const [progresso, setProgresso] = useState<Record<Step, { state: StepState; preview?: string; error?: string }>>(
    Object.fromEntries(DISPLAY_STEPS.map(s => [s, { state: "pending" }])) as any
  );
  const [audit, setAudit] = useState<any>(null);
  const [auditState, setAuditState] = useState<StepState>("pending");
  const [finalProjectId, setFinalProjectId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      setRodando(false);
      setFinalProjectId(null);
      setAudit(null);
      setAuditState("pending");
      setProgresso(Object.fromEntries(DISPLAY_STEPS.map(s => [s, { state: "pending" }])) as any);
    }
  }, [open]);

  function applyPreset(key: string) {
    setPreset(key);
    const p = PRESETS[key];
    if (p) setEtapasSel(new Set(p.steps));
  }

  function toggleStep(s: Step) {
    const ns = new Set(etapasSel);
    ns.has(s) ? ns.delete(s) : ns.add(s);
    setEtapasSel(ns);
    setPreset("custom");
  }

  async function rodar() {
    if (!produtoNome.trim()) return toast.error("Informe o nome do produto");
    if (destino === "__new__" && !novoNome.trim()) return toast.error("Informe o nome do novo projeto");
    if (etapasSel.size === 0) return toast.error("Selecione pelo menos uma etapa");

    setRodando(true);
    setAudit(null);
    setAuditState("pending");
    setProgresso(Object.fromEntries(DISPLAY_STEPS.map(s => [s, { state: "pending" }])) as any);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setRodando(false); return toast.error("Sessão expirada"); }

    const body: any = {
      produto_nome: produtoNome.trim(),
      ticket: ticket.trim() || undefined,
      promessa: promessa.trim() || undefined,
      nicho: nicho.trim() || undefined,
      etapas: Array.from(etapasSel),
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
              const pid = evt.resultado?.projeto_id || finalProjectId;
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
            Avatar primeiro; depois VSL, LP, ângulos, reels, imagens e WhatsApp rodam <strong>em paralelo</strong> (3x mais rápido). Funil é montado no <strong>Hub</strong> e o <strong>Auditor Imperius</strong> roda automático no final.
          </DialogDescription>
        </DialogHeader>

        {!rodando && (
          <div className="space-y-4 py-2">
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
                {preset === "custom" && (
                  <span className="px-3 py-2 rounded text-sm border border-border/40 text-muted-foreground">✏️ Personalizado</span>
                )}
              </div>
              {PRESETS[preset] && <div className="text-xs text-muted-foreground">{PRESETS[preset].hint}</div>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Nome do produto *</Label>
                <Input value={produtoNome} onChange={e => setProdutoNome(e.target.value)} placeholder="Ex: Corte Express" />
              </div>
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
              <div className="space-y-2 md:col-span-2">
                <Label>Inspirar-se em Swipefile (opcional)</Label>
                <Select value={swipeId} onValueChange={setSwipeId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem referência</SelectItem>
                    {swipes.map(s => <SelectItem key={s.id} value={s.id}>[{s.formato}] {s.title}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Injeta estrutura/ritmo do swipe nas instruções de VSL e LP.</p>
              </div>
            </div>

            <div className="space-y-2 border-t border-border/40 pt-4">
              <Label className="text-sm">Etapas (desmarque para pular)</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {ALL_STEPS.map(s => (
                  <label key={s} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-background/40 p-2 rounded">
                    <Checkbox checked={etapasSel.has(s)} onCheckedChange={() => toggleStep(s)} />
                    {STEP_LABELS[s]}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={rodar} className="gap-2">
                <Zap className="h-4 w-4" /> Rodar One Click
              </Button>
            </div>
          </div>
        )}

        {rodando || progresso.avatar.state !== "pending" ? (
          <div className="space-y-2 py-2">
            <div className="text-sm text-muted-foreground">Progresso:</div>
            <ul className="space-y-2">
              {[...Array.from(etapasSel), "hub" as Step].map(s => {
                const st = progresso[s];
                return (
                  <li key={s} className="flex items-start gap-3 p-3 rounded bg-background/40 border border-border/30">
                    <div className="mt-0.5">
                      {st.state === "pending" && <div className="h-4 w-4 rounded-full border border-muted-foreground/40" />}
                      {st.state === "running" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                      {st.state === "done" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      {st.state === "error" && <AlertCircle className="h-4 w-4 text-destructive" />}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{STEP_LABELS[s]}</div>
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

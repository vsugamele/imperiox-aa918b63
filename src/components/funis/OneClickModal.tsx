import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Zap, CheckCircle2, AlertCircle } from "lucide-react";

type Step = "avatar"|"vsl"|"lp"|"angulos"|"reels"|"imagens"|"whatsapp_x1"|"fluxos_pos_venda";

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

const ALL_STEPS: Step[] = ["avatar","vsl","lp","angulos","reels","imagens","whatsapp_x1","fluxos_pos_venda"];

type StepState = "pending" | "running" | "done" | "error";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onComplete?: (projectId: string) => void;
}

export function OneClickModal({ open, onOpenChange, onComplete }: Props) {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [destino, setDestino] = useState<string>("__new__");
  const [novoNome, setNovoNome] = useState("");
  const [produtoNome, setProdutoNome] = useState("");
  const [ticket, setTicket] = useState("");
  const [promessa, setPromessa] = useState("");
  const [nicho, setNicho] = useState("");
  const [etapasSel, setEtapasSel] = useState<Set<Step>>(new Set(ALL_STEPS));
  const [rodando, setRodando] = useState(false);
  const [progresso, setProgresso] = useState<Record<Step, { state: StepState; preview?: string; error?: string }>>(
    Object.fromEntries(ALL_STEPS.map(s => [s, { state: "pending" }])) as any
  );
  const [finalProjectId, setFinalProjectId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;
    supabase.from("imphq_projects").select("id, name").order("name").then(({ data }) => {
      setProjects((data || []) as any);
    });
  }, [open]);

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      setRodando(false);
      setFinalProjectId(null);
      setProgresso(Object.fromEntries(ALL_STEPS.map(s => [s, { state: "pending" }])) as any);
    }
  }, [open]);

  function toggleStep(s: Step) {
    const ns = new Set(etapasSel);
    ns.has(s) ? ns.delete(s) : ns.add(s);
    setEtapasSel(ns);
  }

  async function rodar() {
    if (!produtoNome.trim()) return toast.error("Informe o nome do produto");
    if (destino === "__new__" && !novoNome.trim()) return toast.error("Informe o nome do novo projeto");
    if (etapasSel.size === 0) return toast.error("Selecione pelo menos uma etapa");

    setRodando(true);
    setProgresso(Object.fromEntries(ALL_STEPS.map(s => [s, { state: "pending" }])) as any);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-secondary/40 max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-serif text-primary">
            <Zap className="h-5 w-5" /> One Click — Funil dentro do Hub
          </DialogTitle>
          <DialogDescription className="leading-7">
            Digite o nome do produto e a IA encadeia as skills reais (Avatar Architect, VSL Filemon E3, LP Persuasiva, Ads Copy Multiplier, Roteiros Reels, Sugamele) + Gemini Image + OpenFlow. O funil gerado aparece direto no Hub do projeto.
          </DialogDescription>
        </DialogHeader>

        {!rodando && (
          <div className="space-y-4 py-2">
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
              {Array.from(etapasSel).map(s => {
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
            </ul>

            {!rodando && finalProjectId && (
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
                <Button asChild>
                  <a href={`/projeto/${finalProjectId}`}>Abrir projeto</a>
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

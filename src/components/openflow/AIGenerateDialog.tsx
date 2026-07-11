import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EditableTagList } from "@/components/projeto/EditableTagList";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, Loader2, Brain, FlaskConical, ArrowRight, Plus, Replace } from "lucide-react";
import type { Acao } from "./FlowEditor";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId?: string | null;
  triggerTipo: string;
  produto?: string | null;
  existingAcoes: Acao[];
  onApply: (mode: "replace" | "append", acoes: Acao[]) => void;
}

type Objetivo = "aquisicao" | "qualificacao" | "conversao" | "recuperacao" | "retencao" | "ltv";
type Temperatura = "frio" | "morno" | "quente";
type Tamanho = "enxuto" | "padrao" | "longo";

const ATIVOS = ["Áudio IA", "Vídeo", "Prova social", "Case", "Bônus", "Desconto"];
const TONS = ["consultivo", "urgente", "educativo", "provocador", "empático"];

export function AIGenerateDialog({ open, onOpenChange, projectId, triggerTipo, produto, existingAcoes, onApply }: Props) {
  const [phase, setPhase] = useState<"briefing" | "loading" | "result">("briefing");
  const [objetivo, setObjetivo] = useState<Objetivo>("conversao");
  const [temperatura, setTemperatura] = useState<Temperatura>("morno");
  const [tamanho, setTamanho] = useState<Tamanho>("padrao");
  const [ativos, setAtivos] = useState<string[]>(["Áudio IA", "Prova social"]);
  const [objecoes, setObjecoes] = useState<string[]>(["preço", "tempo", "ceticismo"]);
  const [tom, setTom] = useState<string[]>(["consultivo"]);
  const [observacoes, setObservacoes] = useState("");

  const [diagnostico, setDiagnostico] = useState("");
  const [acoesGeradas, setAcoesGeradas] = useState<Acao[]>([]);
  const [abSuggestions, setAbSuggestions] = useState<Array<{ etapa_index: number; hipotese: string; variante?: string }>>([]);

  const toggle = (arr: string[], set: (v: string[]) => void, val: string) => {
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  };

  const gerar = async () => {
    setPhase("loading");
    try {
      const { data, error } = await supabase.functions.invoke("openflow-ai", {
        body: {
          project_id: projectId,
          trigger_tipo: triggerTipo,
          produto: produto || undefined,
          briefing: { objetivo, temperatura, tamanho, ativos, objecoes, tom, observacoes },
        },
      });
      if (error) throw error;
      const acoes: Acao[] = (data?.acoes || []).map((a: any) => ({
        id: crypto.randomUUID(),
        tipo: a.tipo || "whatsapp",
        template: a.template || "",
        delay_min: typeof a.delay_min === "number" ? a.delay_min : 60,
        ...(a.ia_vision !== undefined ? { ia_vision: !!a.ia_vision } : {}),
        ...(a.ia_voice_response !== undefined ? { ia_voice_response: !!a.ia_voice_response } : {}),
        ...(a.questioning_strategy ? { questioning_strategy: a.questioning_strategy } : {}),
        ...(a.timeout_min !== undefined ? { timeout_min: a.timeout_min } : {}),
        ...(a.tag ? { tag: a.tag } : {}),
        ...(a.stop_event_type ? { stop_event_type: a.stop_event_type } : {}),
        ...(a.proposito ? { proposito: a.proposito } : {}),
      }));
      setAcoesGeradas(acoes);
      setDiagnostico(data?.diagnostico || "");
      setAbSuggestions(data?.ab_suggestions || []);
      setPhase("result");
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar");
      setPhase("briefing");
    }
  };

  const aplicar = (mode: "replace" | "append") => {
    onApply(mode, acoesGeradas);
    toast.success(`${acoesGeradas.length} etapas ${mode === "replace" ? "substituíram o fluxo" : "adicionadas ao final"}`);
    onOpenChange(false);
    setPhase("briefing");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-secondary/40 backdrop-blur leading-7 max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {phase === "result" ? "Diagnóstico & Fluxo" : "Gerar Fluxo com IA"}
          </DialogTitle>
          <DialogDescription>
            {phase === "briefing" && "Responda o briefing rápido — a IA vai analisar seu projeto, avatar e KPIs antes de gerar."}
            {phase === "loading" && "Imperius analisando contexto do projeto…"}
            {phase === "result" && "Revise o diagnóstico e escolha como aplicar as ações."}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 pr-1 space-y-4">
          {phase === "briefing" && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Objetivo</Label>
                  <Select value={objetivo} onValueChange={(v: any) => setObjetivo(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aquisicao">🎯 Aquisição</SelectItem>
                      <SelectItem value="qualificacao">🔍 Qualificação</SelectItem>
                      <SelectItem value="conversao">💰 Conversão</SelectItem>
                      <SelectItem value="recuperacao">♻️ Recuperação</SelectItem>
                      <SelectItem value="retencao">🔒 Retenção</SelectItem>
                      <SelectItem value="ltv">📈 LTV / Upsell</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Temperatura do lead</Label>
                  <Select value={temperatura} onValueChange={(v: any) => setTemperatura(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="frio">🧊 Frio</SelectItem>
                      <SelectItem value="morno">🌤️ Morno</SelectItem>
                      <SelectItem value="quente">🔥 Quente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tamanho do funil</Label>
                  <Select value={tamanho} onValueChange={(v: any) => setTamanho(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="enxuto">Enxuto (3-5)</SelectItem>
                      <SelectItem value="padrao">Padrão (6-9)</SelectItem>
                      <SelectItem value="longo">Longo / Nutrição (10-15)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Ativos disponíveis</Label>
                <div className="flex flex-wrap gap-1.5">
                  {ATIVOS.map(a => (
                    <Badge
                      key={a}
                      variant={ativos.includes(a) ? "default" : "outline"}
                      className="cursor-pointer select-none"
                      onClick={() => toggle(ativos, setAtivos, a)}
                    >{a}</Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Objeções principais a derrubar</Label>
                <EditableTagList tags={objecoes} onChange={setObjecoes} placeholder="preço, tempo, ceticismo…" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Tom de voz</Label>
                <div className="flex flex-wrap gap-1.5">
                  {TONS.map(t => (
                    <Badge
                      key={t}
                      variant={tom.includes(t) ? "default" : "outline"}
                      className="cursor-pointer select-none capitalize"
                      onClick={() => toggle(tom, setTom, t)}
                    >{t}</Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Observações (opcional)</Label>
                <Textarea rows={2} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="ex: preciso mencionar bônus X, prazo termina sexta…" />
              </div>
            </>
          )}

          {phase === "loading" && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Lendo briefing, avatar, KPIs e ofertas ativas…</p>
            </div>
          )}

          {phase === "result" && (
            <>
              {diagnostico && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-1.5">
                  <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                    <Brain className="h-4 w-4" /> Diagnóstico da IA
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-6">{diagnostico}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <div className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
                  Fluxo proposto ({acoesGeradas.length} etapas)
                </div>
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                  {acoesGeradas.map((a, i) => (
                    <div key={a.id} className="rounded-lg border border-white/10 bg-slate-900/40 p-3 text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px]">{i + 1}</Badge>
                        <span className="font-bold uppercase">{a.tipo}</span>
                        {a.delay_min > 0 && <span className="text-muted-foreground">⏱ {a.delay_min}min</span>}
                      </div>
                      {(a as any).proposito && (
                        <p className="text-[10px] text-primary/80 italic mb-1">🎯 {(a as any).proposito}</p>
                      )}
                      <p className="text-muted-foreground line-clamp-2">{a.template || <em>(sem template)</em>}</p>
                    </div>
                  ))}
                </div>
              </div>

              {abSuggestions.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-1.5">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                    <FlaskConical className="h-4 w-4" /> Sugestões de A/B
                  </div>
                  {abSuggestions.map((s, i) => (
                    <p key={i} className="text-xs leading-6">
                      <strong>Etapa {s.etapa_index + 1}:</strong> {s.hipotese}
                      {s.variante ? <span className="text-muted-foreground"> — {s.variante}</span> : null}
                    </p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          {phase === "briefing" && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={gerar} className="bg-primary text-primary-foreground font-bold">
                <Sparkles className="h-4 w-4 mr-1" /> Analisar e gerar
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}
          {phase === "result" && (
            <>
              <Button variant="ghost" onClick={() => setPhase("briefing")}>Regenerar com ajustes</Button>
              {existingAcoes.length > 0 && (
                <Button variant="outline" onClick={() => aplicar("append")}>
                  <Plus className="h-4 w-4 mr-1" /> Anexar ao final
                </Button>
              )}
              <Button onClick={() => aplicar("replace")} className="bg-primary text-primary-foreground font-bold">
                <Replace className="h-4 w-4 mr-1" /> Substituir fluxo
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

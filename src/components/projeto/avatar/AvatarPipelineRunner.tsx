import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Database, Brain, Gauge, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  projectId: string;
  avatar: any;
  onApply: (newAvatar: any) => void;
}

type Step = "idle" | "extract" | "enrich" | "score" | "done" | "error";

const STEPS: { id: Step; label: string; icon: any; desc: string }[] = [
  { id: "extract", label: "Extração de evidências", icon: Database, desc: "Lê briefing, pesquisa, dores, desejos, voyerismos, concorrentes e respostas de leads." },
  { id: "enrich", label: "Síntese guiada", icon: Brain, desc: "IA preenche cada campo CITANDO as evidências reais — não inventa." },
  { id: "score", label: "Score de confiança", icon: Gauge, desc: "Cada campo recebe um score 0-100 baseado em quantidade/qualidade das evidências." },
];

export function AvatarPipelineRunner({ projectId, avatar, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<Step>("idle");
  const [evidenceCount, setEvidenceCount] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [overwriteFilled, setOverwriteFilled] = useState(false);

  const run = async () => {
    setCurrent("extract");
    setResult(null);
    try {
      // Stage 1: extract
      const ext = await supabase.functions.invoke("avatar-pipeline", {
        body: { project_id: projectId, stage: "extract" },
      });
      if (ext.error) throw ext.error;
      setEvidenceCount(ext.data?.count || 0);

      if (!ext.data?.count) {
        setCurrent("error");
        toast.error("Nenhuma evidência encontrada. Preencha briefing/pesquisa/dores antes.");
        return;
      }

      // Stage 2+3: enrich + score
      setCurrent("enrich");
      const full = await supabase.functions.invoke("avatar-pipeline", {
        body: { project_id: projectId, stage: "all" },
      });
      if (full.error) throw full.error;

      setCurrent("score");
      await new Promise(r => setTimeout(r, 400));
      setResult(full.data?.avatar_pipeline);
      setCurrent("done");
    } catch (err: any) {
      console.error(err);
      setCurrent("error");
      toast.error(err.message || "Erro no pipeline");
    }
  };

  const apply = () => {
    if (!result) return;
    const next = { ...avatar };
    const meta = result._meta || {};
    const conf = meta.confidence_by_field || {};

    // perfil_psicologico
    const perfil = { ...(avatar.perfil_psicologico || {}) };
    for (const [k, v] of Object.entries(result.perfil_psicologico || {})) {
      if (v && (overwriteFilled || !perfil[k])) perfil[k] = v;
    }
    next.perfil_psicologico = perfil;

    // camadas_psique
    const cam = { ...(avatar.camadas_psique || {}) };
    for (const [k, v] of Object.entries(result.camadas_psique || {})) {
      if (v && (overwriteFilled || !cam[k])) cam[k] = v;
    }
    next.camadas_psique = cam;

    // root fields
    for (const k of ["desejo_externo", "desejo_interno", "inimigo", "resultado_sonhado", "trigger_event", "fase_consciencia", "crenca_bloqueadora", "crenca_necessaria", "epifania_central"]) {
      const v = (result as any)[k];
      if (v && (overwriteFilled || !avatar[k])) (next as any)[k] = v;
    }

    next._avatar_meta = {
      ...(avatar._avatar_meta || {}),
      confidence: conf,
      evidences: meta.evidences_by_field,
      generated_at: meta.generated_at,
    };

    onApply(next);
    toast.success("Avatar 3.0 aplicado com evidências e score de confiança.");
    setOpen(false);
    setCurrent("idle");
  };

  const stepIdx = STEPS.findIndex(s => s.id === current);
  const isRunning = ["extract", "enrich", "score"].includes(current);

  return (
    <>
      <Button variant="default" size="sm" onClick={() => setOpen(true)} className="gap-2">
        <Sparkles className="h-3 w-3" /> Avatar 3.0 (Pipeline)
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!isRunning) setOpen(o); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Avatar 3.0 — Pipeline com Evidências
            </DialogTitle>
            <DialogDescription>
              Em vez de "uma chamada de IA gera tudo do zero", o pipeline divide o trabalho em 3 etapas e cita as fontes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const active = i === stepIdx;
              const done = i < stepIdx || current === "done";
              return (
                <div key={s.id} className={`flex gap-3 p-3 rounded-lg border ${active ? "border-primary bg-primary/5" : done ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-card"}`}>
                  <div className="shrink-0">
                    {active && isRunning ? <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      : done ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      : <Icon className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{s.label}</div>
                    <div className="text-xs text-muted-foreground">{s.desc}</div>
                    {s.id === "extract" && (done || active) && evidenceCount > 0 && (
                      <Badge variant="secondary" className="mt-1 text-xs">{evidenceCount} evidências capturadas</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {current === "error" && (
            <div className="flex items-center gap-2 text-sm text-destructive p-3 border border-destructive/30 rounded">
              <AlertTriangle className="h-4 w-4" /> Falha. Verifique se há briefing/pesquisa/dores cadastradas.
            </div>
          )}

          {result && current === "done" && (
            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2">
              <div className="text-xs text-muted-foreground">
                {result._meta?.evidence_used_count || 0} de {result._meta?.evidence_count || 0} evidências usadas.
              </div>
              <div className="space-y-2">
                {Object.entries(result._meta?.confidence_by_field || {}).map(([k, score]) => {
                  const s = score as number;
                  const tone = s >= 70 ? "text-emerald-500" : s >= 40 ? "text-amber-500" : "text-destructive";
                  const bar = s >= 70 ? "bg-emerald-500" : s >= 40 ? "bg-amber-500" : "bg-destructive";
                  return (
                    <div key={k} className="flex items-center gap-2 text-xs">
                      <span className="w-40 truncate text-muted-foreground">{k}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className={`h-full ${bar} transition-all`} style={{ width: `${s}%` }} />
                      </div>
                      <span className={`w-8 text-right font-mono ${tone}`}>{s}</span>
                    </div>
                  );
                })}
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer pt-2 border-t">
                <input type="checkbox" checked={overwriteFilled} onChange={e => setOverwriteFilled(e.target.checked)} />
                Sobrescrever campos já preenchidos (padrão: só preenche vazios)
              </label>
            </div>
          )}

          <DialogFooter>
            {current === "idle" || current === "error" ? (
              <Button onClick={run}><Sparkles className="h-3 w-3 mr-1" /> Executar pipeline</Button>
            ) : current === "done" ? (
              <>
                <Button variant="outline" onClick={() => { setCurrent("idle"); setResult(null); }}>Rodar de novo</Button>
                <Button onClick={apply}><CheckCircle2 className="h-3 w-3 mr-1" /> Aplicar ao avatar</Button>
              </>
            ) : (
              <Button disabled><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Processando…</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

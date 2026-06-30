import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  product: any;
}

const CONSCIENCIA = [
  "inconsciente",
  "consciente do problema",
  "consciente da solução",
  "consciente do produto",
  "mais consciente",
];
const TEMPERATURA = ["frio", "morno", "quente"];

export function FunnelByAvatarDialog({ open, onClose, projectId, product }: Props) {
  const [consciencia, setConsciencia] = useState("consciente do problema");
  const [temperatura, setTemperatura] = useState("morno");
  const [personaExtra, setPersonaExtra] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("funnel-by-avatar", {
        body: { project_id: projectId, product, consciencia, temperatura, persona_extra: personaExtra },
      });
      if (error) throw error;
      setResult((data as any)?.result || {});
      toast.success("Funil adaptado");
    } catch (e: any) {
      toast.error(e?.message || "Erro");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl bg-secondary/40 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Users className="h-4 w-4 text-violet-400" />
            Funil por Avatar — adaptar à consciência & temperatura
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">Nível de consciência</label>
              <Select value={consciencia} onValueChange={setConsciencia}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{CONSCIENCIA.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">Temperatura</label>
              <Select value={temperatura} onValueChange={setTemperatura}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{TEMPERATURA.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">Persona extra (opcional)</label>
              <Input value={personaExtra} onChange={(e) => setPersonaExtra(e.target.value)} placeholder="ex: mãe 35+, classe C" className="h-9 text-xs" />
            </div>
          </div>

          <Button onClick={run} disabled={loading} className="w-full bg-violet-600 hover:bg-violet-500">
            {loading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Users className="h-3.5 w-3.5 mr-1.5" />}
            {result ? "Recalcular funil" : "Desenhar funil para este avatar"}
          </Button>

          {result && (
            <div className="space-y-3 pt-2 border-t border-border/40">
              {result.diagnostico && (
                <div className="rounded-xl border border-violet-500/40 bg-violet-500/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-violet-300 font-semibold mb-1">Diagnóstico</p>
                  <p className="text-xs text-foreground/90 leading-6">{result.diagnostico}</p>
                </div>
              )}
              {result.estrategia_central && (
                <p className="text-base font-cormorant text-foreground leading-7">"{result.estrategia_central}"</p>
              )}

              {Array.isArray(result.jornada_recomendada) && result.jornada_recomendada.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-foreground font-semibold">Jornada recomendada</p>
                  {result.jornada_recomendada.map((j: any, i: number) => (
                    <div key={i} className="rounded-lg border border-border/40 bg-secondary/20 p-2.5">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 text-[9px] uppercase font-bold">{j.etapa}</span>
                        <span className="font-semibold text-foreground">{j.ativo}</span>
                      </div>
                      {j.porque && <p className="text-[11px] text-muted-foreground mt-1 leading-5">{j.porque}</p>}
                      {j.copy_chave && <p className="text-[11px] text-amber-300/90 mt-1 leading-5 italic">"{j.copy_chave}"</p>}
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {Array.isArray(result.ativos_essenciais) && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5">
                    <p className="text-[10px] uppercase text-emerald-300 font-semibold mb-1">Essenciais</p>
                    <ul className="text-[11px] text-foreground/90 leading-5 list-disc pl-4">
                      {result.ativos_essenciais.map((a: string, i: number) => <li key={i}>{a}</li>)}
                    </ul>
                  </div>
                )}
                {Array.isArray(result.ativos_evitar) && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-2.5">
                    <p className="text-[10px] uppercase text-red-300 font-semibold mb-1">Evitar</p>
                    <ul className="text-[11px] text-foreground/90 leading-5 list-disc pl-4">
                      {result.ativos_evitar.map((a: string, i: number) => <li key={i}>{a}</li>)}
                    </ul>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px]">
                {Array.isArray(result.gatilhos_principais) && (
                  <Card label="Gatilhos">{result.gatilhos_principais.join(" · ")}</Card>
                )}
                {result.tom_voz && <Card label="Tom de voz">{result.tom_voz}</Card>}
                {Array.isArray(result.objecoes_chave) && (
                  <Card label="Objeções-chave">{result.objecoes_chave.join(" · ")}</Card>
                )}
              </div>

              {result.metricas_alvo && (
                <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-2.5 text-xs flex gap-4">
                  <span><span className="text-muted-foreground">CTR:</span> <b>{result.metricas_alvo.ctr_estimado || "—"}</b></span>
                  <span><span className="text-muted-foreground">Conversão:</span> <b>{result.metricas_alvo.conversao_estimada || "—"}</b></span>
                  <span><span className="text-muted-foreground">Ticket:</span> <b>{result.metricas_alvo.ticket_recomendado || "—"}</b></span>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded bg-secondary/30 p-2">
      <p className="text-[9px] uppercase text-muted-foreground">{label}</p>
      <p className="text-foreground/90 leading-5">{children}</p>
    </div>
  );
}

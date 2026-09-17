import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Shield, PlayCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  automacaoId: string | null;
  onClose: () => void;
}

interface Guard {
  quiet_start: number | null;
  quiet_end: number | null;
  rate_limit_per_lead_24h: number | null;
  circuit_breaker_error_pct: number | null;
  circuit_breaker_window_min: number | null;
  circuit_breaker_paused_at: string | null;
  circuit_breaker_reason: string | null;
}

export function GuardrailsPanel({ automacaoId, onClose }: Props) {
  const [g, setG] = useState<Guard | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!automacaoId) return;
    (async () => {
      const { data } = await supabase
        .from("imphq_automacoes")
        .select("quiet_start,quiet_end,rate_limit_per_lead_24h,circuit_breaker_error_pct,circuit_breaker_window_min,circuit_breaker_paused_at,circuit_breaker_reason")
        .eq("id", automacaoId)
        .maybeSingle();
      setG((data as Guard) || null);
    })();
  }, [automacaoId]);

  const save = async () => {
    if (!automacaoId || !g) return;
    setSaving(true);
    const { error } = await supabase.from("imphq_automacoes").update({
      quiet_start: g.quiet_start,
      quiet_end: g.quiet_end,
      rate_limit_per_lead_24h: g.rate_limit_per_lead_24h,
      circuit_breaker_error_pct: g.circuit_breaker_error_pct,
      circuit_breaker_window_min: g.circuit_breaker_window_min,
    }).eq("id", automacaoId);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Guardrails salvos");
  };

  const reset = async () => {
    if (!automacaoId) return;
    const { error } = await supabase.from("imphq_automacoes")
      .update({ circuit_breaker_paused_at: null, circuit_breaker_reason: null, ativo: true })
      .eq("id", automacaoId);
    if (error) toast.error(error.message);
    else { toast.success("Circuit breaker resetado"); setG(g && { ...g, circuit_breaker_paused_at: null, circuit_breaker_reason: null }); }
  };

  if (!automacaoId) return null;

  return (
    <Dialog open={!!automacaoId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg bg-secondary/40 leading-7">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Shield className="h-4 w-4" /> Guardrails</DialogTitle>
        </DialogHeader>

        {g?.circuit_breaker_paused_at && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200 space-y-2">
            <div className="flex items-center gap-2 font-medium"><AlertTriangle className="h-3.5 w-3.5" /> Pausada pelo circuit breaker</div>
            <p className="text-[11px] opacity-80">{g.circuit_breaker_reason}</p>
            <p className="text-[10px] opacity-60">Desde {new Date(g.circuit_breaker_paused_at).toLocaleString("pt-BR")}</p>
            <Button size="sm" variant="outline" onClick={reset} className="h-7 text-[11px] gap-1">
              <PlayCircle className="h-3 w-3" /> Resetar e reativar
            </Button>
          </div>
        )}

        {g && (
          <div className="space-y-4 text-sm">
            <div>
              <Label className="text-xs">Quiet hours (BR, 0-23)</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input type="number" min={0} max={23} placeholder="início (ex 22)" value={g.quiet_start ?? ""} onChange={(e) => setG({ ...g, quiet_start: e.target.value === "" ? null : Number(e.target.value) })} className="h-8" />
                <span className="text-xs text-muted-foreground">até</span>
                <Input type="number" min={0} max={23} placeholder="fim (ex 8)" value={g.quiet_end ?? ""} onChange={(e) => setG({ ...g, quiet_end: e.target.value === "" ? null : Number(e.target.value) })} className="h-8" />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Não envia mensagens neste intervalo.</p>
            </div>

            <div>
              <Label className="text-xs">Rate limit por lead (msgs/24h)</Label>
              <Input type="number" min={1} placeholder="ex 5" value={g.rate_limit_per_lead_24h ?? ""} onChange={(e) => setG({ ...g, rate_limit_per_lead_24h: e.target.value === "" ? null : Number(e.target.value) })} className="h-8 mt-1" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Circuit breaker</Label>
              <div className="flex items-center gap-2">
                <Input type="number" min={1} max={100} placeholder="% erro" value={g.circuit_breaker_error_pct ?? ""} onChange={(e) => setG({ ...g, circuit_breaker_error_pct: e.target.value === "" ? null : Number(e.target.value) })} className="h-8" />
                <span className="text-xs text-muted-foreground">em</span>
                <Input type="number" min={1} placeholder="min" value={g.circuit_breaker_window_min ?? ""} onChange={(e) => setG({ ...g, circuit_breaker_window_min: e.target.value === "" ? null : Number(e.target.value) })} className="h-8 w-20" />
                <Badge variant="outline" className="text-[10px]">min ≥10 logs</Badge>
              </div>
              <p className="text-[10px] text-muted-foreground">Pausa a automação se a taxa de erro ultrapassar o limite.</p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
              <Button size="sm" onClick={save} disabled={saving}>Salvar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

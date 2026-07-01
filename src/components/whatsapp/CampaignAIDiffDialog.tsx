import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DiffItem {
  id: string;
  ordem: number;
  changed: boolean;
  reason?: string;
  before: { content: string; dia: number; horario: string };
  after: { content: string; dia: number; horario: string };
}

interface Props {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  diff: DiffItem[];
  onApplied: () => void;
}

export default function CampaignAIDiffDialog({ open, onClose, campaignId, diff, onApplied }: Props) {
  const initialSelected = new Set(diff.filter((d) => d.changed).map((d) => d.id));
  const [selected, setSelected] = useState<Set<string>>(initialSelected);
  const [applying, setApplying] = useState(false);
  const [showUnchanged, setShowUnchanged] = useState(false);

  const visible = showUnchanged ? diff : diff.filter((d) => d.changed);
  const changedCount = diff.filter((d) => d.changed).length;

  const toggle = (id: string) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };

  const apply = async () => {
    if (selected.size === 0) {
      toast.error("Selecione ao menos uma mensagem para aplicar");
      return;
    }
    setApplying(true);
    try {
      const updates = diff
        .filter((d) => selected.has(d.id))
        .map((d) => ({
          id: d.id,
          content: d.after.content,
          days_offset: d.after.dia,
          send_time: d.after.horario,
        }));
      const { data, error } = await supabase.functions.invoke("wa-campaign-ai-apply-diff", {
        body: { campaign_id: campaignId, updates },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`✓ ${data?.applied || 0} mensagens atualizadas`);
      onApplied();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erro ao aplicar ajustes");
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-secondary/40 max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold" /> Revisar ajustes propostos pela IA
          </DialogTitle>
          <p className="text-xs text-muted-foreground leading-6 mt-1">
            {changedCount} de {diff.length} mensagens com alterações. Marque as que deseja aplicar.
          </p>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/30">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelected(new Set(diff.filter((d) => d.changed).map((d) => d.id)))}>
              Marcar todas alteradas
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>
              Desmarcar todas
            </Button>
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <Checkbox checked={showUnchanged} onCheckedChange={(v) => setShowUnchanged(!!v)} />
            <span className="text-muted-foreground">Mostrar inalteradas</span>
          </label>
        </div>

        <div className="space-y-3 py-2">
          {visible.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-12 leading-7">
              Nenhuma alteração proposta pela IA.
            </div>
          ) : (
            visible.map((d) => (
              <div
                key={d.id}
                className={`rounded-lg border p-3 ${d.changed ? "border-primary/30 bg-primary/5" : "border-border/30 bg-background/30 opacity-60"}`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selected.has(d.id)}
                    onCheckedChange={() => toggle(d.id)}
                    disabled={!d.changed}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-[10px]">Ordem {d.ordem}</Badge>
                      {d.changed ? (
                        <Badge className="text-[10px] bg-primary/20 text-primary border-primary/30">Alterada</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Sem alteração</Badge>
                      )}
                      {(d.before.dia !== d.after.dia || d.before.horario !== d.after.horario) && (
                        <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">
                          Dia/Horário: D{d.before.dia} {d.before.horario} → D{d.after.dia} {d.after.horario}
                        </Badge>
                      )}
                    </div>
                    {d.reason && (
                      <p className="text-[11px] text-muted-foreground italic leading-5 mb-2">↳ {d.reason}</p>
                    )}
                    {d.changed ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <div className="text-[10px] uppercase text-muted-foreground mb-1">Antes</div>
                          <pre className="text-[11px] whitespace-pre-wrap font-sans bg-background/40 rounded p-2 leading-6 max-h-40 overflow-y-auto">{d.before.content || "(vazio)"}</pre>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase text-primary mb-1">Depois</div>
                          <pre className="text-[11px] whitespace-pre-wrap font-sans bg-primary/10 rounded p-2 leading-6 max-h-40 overflow-y-auto">{d.after.content || "(vazio)"}</pre>
                        </div>
                      </div>
                    ) : (
                      <pre className="text-[11px] whitespace-pre-wrap font-sans bg-background/40 rounded p-2 leading-6 max-h-32 overflow-y-auto">{d.before.content || "(vazio)"}</pre>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter className="border-t border-border/30 pt-3">
          <Button variant="outline" onClick={onClose} disabled={applying}>Cancelar</Button>
          <Button onClick={apply} disabled={applying || selected.size === 0} className="gap-1.5">
            {applying ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Aplicando...</> : <><CheckCircle2 className="h-3.5 w-3.5" /> Aplicar {selected.size} alteraç{selected.size === 1 ? "ão" : "ões"}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

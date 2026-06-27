import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Workflow, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  currentFlowId?: string | null;
  assetLabel: string;
  onPick: (flowId: string | null, flowNome: string | null) => void;
}

interface FlowRow {
  id: string;
  nome: string;
  trigger_tipo: string;
  ativo: boolean;
}

export function LinkFlowDialog({ open, onClose, projectId, currentFlowId, assetLabel, onPick }: Props) {
  const [flows, setFlows] = useState<FlowRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !projectId) return;
    setLoading(true);
    supabase
      .from("imphq_automacoes")
      .select("id, nome, trigger_tipo, ativo")
      .or(`project_id.eq.${projectId},project_id.is.null`)
      .order("ativo", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(80)
      .then(({ data }) => {
        setFlows((data as any) || []);
        setLoading(false);
      });
  }, [open, projectId]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-secondary/40 border-border/60 max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Workflow className="h-5 w-5 text-cyan-400" />
            Vincular fluxo OpenFlow
          </DialogTitle>
          <DialogDescription className="leading-7">
            Qual fluxo do OpenFlow representa este nó <span className="text-primary font-semibold">{assetLabel}</span>?
            A IA vai usar para mostrar execuções, leads ativos e abrir o editor.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5 max-h-[360px] overflow-y-auto">
          {loading && <p className="text-xs text-muted-foreground text-center py-6">Carregando...</p>}
          {!loading && flows.map((f) => {
            const isAtual = f.id === currentFlowId;
            return (
              <button
                key={f.id}
                onClick={() => { onPick(f.id, f.nome); onClose(); }}
                className="text-left rounded-lg border border-border/40 bg-[#0a0608]/60 hover:bg-cyan-500/10 hover:border-cyan-500/40 px-3 py-2 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground/90 truncate">
                    {f.nome}
                    {isAtual && <span className="ml-2 text-[10px] text-cyan-400 uppercase tracking-wider">atual</span>}
                  </p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${f.ativo ? "bg-emerald-500/20 text-emerald-300" : "bg-muted/40 text-muted-foreground"}`}>
                    {f.ativo ? "ativo" : "pausado"}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">trigger: {f.trigger_tipo}</p>
              </button>
            );
          })}
          {!loading && flows.length === 0 && (
            <div className="text-center py-6">
              <p className="text-xs text-muted-foreground mb-2">Nenhum fluxo nesse projeto.</p>
              <Link to="/openflow" className="text-xs text-cyan-400 hover:text-cyan-300 underline inline-flex items-center gap-1">
                Criar no OpenFlow <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2 border-t border-border/40">
          {currentFlowId && (
            <Button variant="ghost" className="flex-1 h-9 text-xs text-rose-300 hover:text-rose-200" onClick={() => { onPick(null, null); onClose(); }}>
              Desvincular
            </Button>
          )}
          <Button variant="ghost" className="flex-1 h-9 text-xs" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

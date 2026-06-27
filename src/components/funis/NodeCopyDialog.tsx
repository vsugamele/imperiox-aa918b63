import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Copy as CopyIcon, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Variation {
  angulo: string;
  headline: string;
  lead: string;
  cta: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  nodeId: string;
  assetKind?: string;
  assetLabel?: string;
  product?: any;
  onApply?: (variation: Variation) => void;
}

export function NodeCopyDialog({ open, onClose, projectId, nodeId, assetKind, assetLabel, product, onApply }: Props) {
  const [loading, setLoading] = useState(false);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("imphq_funnel_node_copies")
        .select("copies, selected_idx")
        .eq("projeto_id", projectId)
        .eq("node_id", nodeId)
        .maybeSingle();
      if (data?.copies) {
        setVariations(data.copies as any);
        setSelectedIdx(data.selected_idx ?? 0);
      } else {
        setVariations([]);
        setSelectedIdx(0);
      }
    })();
  }, [open, projectId, nodeId]);

  const generate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("funnel-node-copy", {
        body: { projeto_id: projectId, node_id: nodeId, asset_kind: assetKind, asset_label: assetLabel, produto: product },
      });
      if (error) throw error;
      const arr = ((data as any)?.copies || []) as Variation[];
      setVariations(arr);
      setSelectedIdx(0);
      toast.success("3 variações geradas");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar");
    } finally {
      setLoading(false);
    }
  };

  const apply = async (idx: number) => {
    setSelectedIdx(idx);
    await supabase
      .from("imphq_funnel_node_copies")
      .update({ selected_idx: idx })
      .eq("projeto_id", projectId)
      .eq("node_id", nodeId);
    if (onApply && variations[idx]) onApply(variations[idx]);
    toast.success("Variação selecionada");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl bg-secondary/40">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Sparkles className="h-4 w-4 text-pink-400" />
            Copy IA — {assetLabel || nodeId}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Button onClick={generate} disabled={loading} className="bg-pink-600 hover:bg-pink-500">
            {loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
            {variations.length ? "Regenerar 3 variações" : "Gerar 3 variações"}
          </Button>

          {variations.map((v, i) => (
            <div
              key={i}
              className={cn(
                "rounded-xl border p-4 space-y-2 transition",
                i === selectedIdx ? "border-pink-500/60 bg-pink-500/5" : "border-border/40 bg-secondary/20",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-pink-300 font-semibold">{v.angulo}</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-7 px-2"
                    onClick={() => { navigator.clipboard.writeText(`${v.headline}\n\n${v.lead}\n\n${v.cta}`); toast.success("Copiado"); }}>
                    <CopyIcon className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant={i === selectedIdx ? "default" : "outline"} className="h-7"
                    onClick={() => apply(i)}>
                    {i === selectedIdx ? <Check className="h-3 w-3 mr-1" /> : null}
                    {i === selectedIdx ? "Selecionada" : "Usar esta"}
                  </Button>
                </div>
              </div>
              <p className="text-base font-semibold leading-7 text-foreground">{v.headline}</p>
              <p className="text-sm leading-7 text-foreground/85">{v.lead}</p>
              <p className="text-xs uppercase tracking-wider text-amber-300/90 font-bold">▶ {v.cta}</p>
            </div>
          ))}

          {!variations.length && !loading && (
            <p className="text-sm text-muted-foreground leading-7">Nenhuma variação ainda. Clique em gerar para criar 3 ângulos distintos baseados no produto, avatar e branding.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

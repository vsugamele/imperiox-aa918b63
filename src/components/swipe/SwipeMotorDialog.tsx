import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Wand2, FlaskConical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  swipeIds: string[];
  onDone: () => void;
}

export function SwipeMotorDialog({ open, onOpenChange, swipeIds, onDone }: Props) {
  const [briefing, setBriefing] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async (mode: "bulk_campaign" | "extract_template") => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("swipe-generate", {
        body: { mode, swipe_ids: swipeIds, briefing },
      });
      if (error) throw error;
      if (mode === "bulk_campaign") toast.success(`${data.count} copys novas geradas`);
      else toast.success(`Template "${data.template?.name}" criado`);
      onDone();
      onOpenChange(false);
      setBriefing("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-secondary/40 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" /> Motor de Copys
          </DialogTitle>
          <DialogDescription className="text-xs leading-7">
            {swipeIds.length} swipe(s) selecionada(s). Escolha o que a IA vai fazer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Label className="text-xs">Briefing (produto-alvo, avatar, transformação)</Label>
          <Textarea
            value={briefing}
            onChange={(e) => setBriefing(e.target.value)}
            placeholder="Ex: Adaptar pro meu produto X de cartomante. Avatar: mulheres 30-50 sofrendo de relacionamento. Mecanismo único: leitura de Tarô + Numerologia."
            className="bg-background text-sm min-h-[120px] leading-7"
          />
        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <Button variant="outline" onClick={() => run("extract_template")} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
            Extrair fórmula comum
          </Button>
          <Button onClick={() => run("bulk_campaign")} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Gerar campanha ({swipeIds.length} copys)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

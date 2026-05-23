import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  projectId?: string;
  produto?: string;
  onDone: () => void;
}

export default function CampaignAIGenerateDialog({ open, onClose, campaignId, projectId, produto, onDone }: Props) {
  const [count, setCount] = useState(7);
  const [tom, setTom] = useState("vendas");
  const [briefing, setBriefing] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("wa-campaign-ai-generate", {
        body: { campaign_id: campaignId, project_id: projectId, produto, count, tom, briefing, reference },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`✨ ${data?.inserted || 0} mensagens geradas e adicionadas`);
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar sequência");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-secondary/40 max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold" /> Gerar sequência com IA
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Quantidade de mensagens</Label>
              <Input type="number" min={1} max={60} value={count} onChange={(e) => setCount(parseInt(e.target.value) || 7)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Tom</Label>
              <Select value={tom} onValueChange={setTom}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vendas">🔥 Vendas direta</SelectItem>
                  <SelectItem value="conteudo">📚 Conteúdo / valor</SelectItem>
                  <SelectItem value="aquecimento">☀️ Aquecimento</SelectItem>
                  <SelectItem value="lancamento">🚀 Lançamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Briefing (opcional)</Label>
            <Textarea
              value={briefing}
              onChange={(e) => setBriefing(e.target.value)}
              placeholder="Ex: foco em CTA para checkout, mencione bônus X, urgência até sexta..."
              rows={4}
              className="text-xs"
            />
            <p className="text-[10px] text-muted-foreground mt-1 leading-5">
              A IA já considera o produto ({produto || "—"}) e o branding do projeto.
            </p>
          </div>
          <div>
            <Label className="text-xs">Referência de copy (opcional)</Label>
            <Textarea
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Cole 1-2 mensagens de exemplo que tenham o estilo, voz e estrutura que você quer replicar..."
              rows={4}
              className="text-xs"
            />
            <p className="text-[10px] text-muted-foreground mt-1 leading-5">
              A IA vai imitar o tom, ritmo e formato das mensagens de referência (sem copiar literalmente).
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={generate} disabled={loading}>
            {loading ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Gerando...</> : <><Sparkles className="h-3.5 w-3.5 mr-1" /> Gerar {count} mensagens</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

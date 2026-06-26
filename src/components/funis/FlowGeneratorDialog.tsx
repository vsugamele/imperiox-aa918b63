import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { typebotToBlueprint, autoLayout } from "@/lib/typebot-parser";

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  produtoNome?: string;
  onCreated: (id: string) => void;
  initialObjetivo?: string;
  initialCanal?: string;
  initialTom?: string;
  titleOverride?: string;
}

export function FlowGeneratorDialog({ open, onClose, projectId, produtoNome, onCreated, initialObjetivo, initialCanal, initialTom, titleOverride }: Props) {
  const [objetivo, setObjetivo] = useState(initialObjetivo || "quiz");
  const [tom, setTom] = useState(initialTom || "conversacional, consultivo");
  const [canal, setCanal] = useState(initialCanal || "web");
  const [loading, setLoading] = useState(false);

  // Atualiza quando o dialog abre com novos defaults
  useEffect(() => {
    if (open) {
      if (initialObjetivo) setObjetivo(initialObjetivo);
      if (initialCanal) setCanal(initialCanal);
      if (initialTom) setTom(initialTom);
    }
  }, [open, initialObjetivo, initialCanal, initialTom]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("flow-generator", {
        body: { project_id: projectId, produto_nome: produtoNome, objetivo, tom, canal },
      });
      if (error) throw error;
      if (data?.blueprint_id) {
        toast.success(`Fluxo gerado! ${data.image_jobs || 0} imagens em fila.`);
        onCreated(data.blueprint_id);
        onClose();
      } else {
        toast.error("Falha na geração");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (file: File) => {
    setLoading(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const blueprint = autoLayout(typebotToBlueprint(json));
      const { data, error } = await supabase
        .from("imphq_flow_blueprints")
        .insert({
          project_id: projectId,
          produto_nome: produtoNome || null,
          title: blueprint.title,
          source: "typebot_import",
          blueprint: blueprint as any,
        })
        .select().single();
      if (error) throw error;
      toast.success(`Importado: ${blueprint.nodes.length} nodes`);
      onCreated(data.id);
      onClose();
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-secondary/40 border-border/60 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-pink-200">{titleOverride || "Criar Fluxo (estilo Typebot)"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-dashed border-border/60 p-4 text-center">
            <Label className="text-xs text-muted-foreground mb-2 block">Importar export do Typebot (.json)</Label>
            <Input type="file" accept=".json,application/json" onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImport(f);
            }} className="text-xs" />
          </div>

          <div className="text-center text-[10px] text-muted-foreground">— ou gerar do zero com IA —</div>

          <div>
            <Label className="text-xs">Objetivo do fluxo</Label>
            <Select value={objetivo} onValueChange={setObjetivo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="quiz">Quiz interativo (qualificação)</SelectItem>
                <SelectItem value="vsl">Roteiro de VSL</SelectItem>
                <SelectItem value="chat_qualificacao">Chat de qualificação consultivo</SelectItem>
                <SelectItem value="pitch">Pitch direto de venda</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Tom</Label>
            <Input value={tom} onChange={(e) => setTom(e.target.value)} />
          </div>

          <div>
            <Label className="text-xs">Canal</Label>
            <Select value={canal} onValueChange={setCanal}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="web">Web (quiz/landing)</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="instagram">Instagram DM</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleGenerate} disabled={loading || !projectId} className="gap-1.5 bg-gradient-to-r from-pink-600 to-fuchsia-600">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Gerar com IA
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

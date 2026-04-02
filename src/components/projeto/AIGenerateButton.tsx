import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Brain, Database } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const MODELS = [
  { id: "google/gemini-3-flash-preview", label: "⚡ Gemini 3 Flash", desc: "Rápido e eficiente" },
  { id: "google/gemini-3.1-pro-preview", label: "🧠 Gemini 3.1 Pro", desc: "Raciocínio avançado (mais recente)" },
  { id: "google/gemini-2.5-pro", label: "🔬 Gemini 2.5 Pro", desc: "Contexto grande + multimodal" },
  { id: "google/gemini-2.5-flash", label: "⚡ Gemini 2.5 Flash", desc: "Bom custo-benefício" },
  { id: "openai/gpt-5.2", label: "🚀 GPT-5.2", desc: "Último e mais poderoso OpenAI" },
  { id: "openai/gpt-5", label: "💪 GPT-5", desc: "Poderoso e preciso" },
  { id: "openai/gpt-5-mini", label: "⚡ GPT-5 Mini", desc: "Rápido e econômico" },
  { id: "openai/gpt-5-nano", label: "💨 GPT-5 Nano", desc: "Ultra rápido, tarefas simples" },
  { id: "google/gemini-2.5-flash-lite", label: "💨 Gemini Flash Lite", desc: "Mais barato, tarefas simples" },
];

interface AIGenerateButtonProps {
  projectId: string;
  action: string;
  onResult: (data: any) => void;
  contextSources?: string[];
  fieldsToFill?: string[];
  label?: string;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "outline" | "default" | "secondary" | "ghost";
  className?: string;
  extraBody?: Record<string, any>;
}

export function AIGenerateButton({
  projectId,
  action,
  onResult,
  contextSources = [],
  fieldsToFill = [],
  label = "Completar com IA",
  size = "sm",
  variant = "outline",
  className = "",
  extraBody = {},
}: AIGenerateButtonProps) {
  const [open, setOpen] = useState(false);
  const [model, setModel] = useState(MODELS[0].id);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    setOpen(false);
    try {
      const { data, error } = await supabase.functions.invoke("openflow-ai", {
        body: { project_id: projectId, action, model, ...extraBody },
      });
      if (error) throw error;
      onResult(data);
    } catch (err: any) {
      if (err?.message?.includes("429") || err?.status === 429) {
        toast.error("Rate limit excedido. Tente novamente em alguns segundos.");
      } else if (err?.message?.includes("402") || err?.status === 402) {
        toast.error("Créditos insuficientes. Adicione créditos no workspace.");
      } else {
        toast.error(err.message || "Erro ao gerar com IA");
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <Button
        size={size}
        variant={variant}
        className={`gap-1.5 ${className}`}
        onClick={() => setOpen(true)}
        disabled={generating}
      >
        {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {generating ? "Gerando..." : `🤖 ${label}`}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" /> Gerar com IA
            </DialogTitle>
            <DialogDescription>Escolha o modelo e veja quais dados serão usados como contexto.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Modelo de IA</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="bg-secondary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODELS.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="font-medium">{m.label}</span>
                      <span className="text-muted-foreground ml-2 text-xs">— {m.desc}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {contextSources.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Database className="h-3 w-3" /> Dados usados como contexto
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {contextSources.map(s => (
                    <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                  ))}
                </div>
              </div>
            )}

            {fieldsToFill.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Campos que serão preenchidos</Label>
                <div className="flex flex-wrap gap-1.5">
                  {fieldsToFill.map(f => (
                    <Badge key={f} variant="outline" className="text-[10px] border-primary/30 text-primary">{f}</Badge>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[10px] text-muted-foreground">⚠️ Apenas campos vazios serão preenchidos. Dados existentes não serão sobrescritos.</p>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleGenerate} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Gerar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

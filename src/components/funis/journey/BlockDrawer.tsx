import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Sparkles, CheckCircle2 } from "lucide-react";
import { BLOCK_TYPES } from "./BlockLibrary";
import { useEffect, useState } from "react";

interface Props {
  step: any | null;
  onClose: () => void;
  onGenerate: (step: any) => void;
  onUpdate: (patch: any) => Promise<void>;
}

export function BlockDrawer({ step, onClose, onGenerate, onUpdate }: Props) {
  const [titulo, setTitulo] = useState("");
  const [notas, setNotas] = useState("");

  useEffect(() => {
    if (step) {
      setTitulo(step.titulo || "");
      setNotas(step.config?.notas || "");
    }
  }, [step?.id]);

  if (!step) return null;
  const meta = BLOCK_TYPES.find(b => b.id === step.bloco_tipo);
  const output = step.output || {};

  const save = async () => {
    await onUpdate({ titulo, config: { ...step.config, notas } });
  };

  return (
    <Sheet open={!!step} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[520px] sm:max-w-[520px] bg-secondary/40 border-l border-border overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="text-2xl">{meta?.icon}</span>
            <span>{meta?.label}</span>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4 leading-7">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Título</label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} onBlur={save} className="h-9 text-sm" />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Briefing/Instruções para a IA</label>
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              onBlur={save}
              placeholder="Ex: tom mais direto, público iniciante, foco na dor de queda de cabelo…"
              className="min-h-[80px] text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={() => onGenerate(step)} disabled={step.status === "gerando"} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> {step.status === "gerado" ? "Regenerar" : "Gerar"}
            </Button>
            {step.status === "gerado" && (
              <Button variant="outline" onClick={() => onUpdate({ status: "publicado" })} className="gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Marcar publicado
              </Button>
            )}
          </div>

          {output && Object.keys(output).length > 0 && (
            <div className="rounded-lg border border-border/60 bg-background/40 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Output</p>
              {output.texto && (
                <pre className="text-xs whitespace-pre-wrap leading-6 text-foreground/90">{output.texto}</pre>
              )}
              {!output.texto && (
                <pre className="text-[10px] whitespace-pre-wrap text-muted-foreground overflow-x-auto">{JSON.stringify(output, null, 2)}</pre>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

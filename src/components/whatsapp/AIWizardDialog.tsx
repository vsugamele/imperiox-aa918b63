import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles, ChevronLeft, ChevronRight, Wand2 } from "lucide-react";

interface Props {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied?: () => void;
}

const STEPS = [
  { key: "produto", label: "O que você vende?", placeholder: "Ex: Mentoria de barbeiro 12 semanas, R$1997, com método autoral e suporte no grupo.", hint: "Produto/serviço principal em 1-2 linhas." },
  { key: "cliente_ideal", label: "Quem é seu cliente ideal?", placeholder: "Ex: Barbeiro autônomo, 22-35 anos, fatura R$3-8k/mês, quer dobrar ticket.", hint: "Perfil em 1 frase: quem, idade, situação atual." },
  { key: "dor_principal", label: "Qual a maior dor dele?", placeholder: "Ex: Trabalha muito e ganha pouco, sem tempo pra família, sente que vai estagnar.", hint: "A dor real que faz comprar." },
  { key: "ticket_medio", label: "Qual o ticket médio?", placeholder: "Ex: R$1997 à vista ou 12x R$197", hint: "Pra IA calibrar urgência e quebra de objeção." },
  { key: "tom_marca", label: "Como sua marca fala?", placeholder: "Ex: Direto, brother, sem firula, fala de números e resultado.", hint: "1-2 frases sobre o jeito de se comunicar." },
  { key: "regras_proibidas", label: "O que a IA NÃO pode fazer?", placeholder: "Ex: Nunca dar desconto, nunca prometer renda, nunca falar de concorrente pelo nome.", hint: "Limites éticos e comerciais." },
];

export default function AIWizardDialog({ projectId, open, onOpenChange, onApplied }: Props) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const current = STEPS[step];
  const value = answers[current.key] || "";
  const canNext = value.trim().length >= 5;
  const isLast = step === STEPS.length - 1;

  const reset = () => { setStep(0); setAnswers({}); setLoading(false); };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("wa-ai-wizard-generator", {
        body: { project_id: projectId, ...answers },
      });
      if (error) throw error;
      if (!data?.success || !data.config) throw new Error(data?.error || "Falha ao gerar configuração");

      const cfg = data.config;
      const { error: upErr } = await supabase
        .from("imphq_wa_ai_config")
        .upsert({
          project_id: projectId,
          personality: cfg.personality,
          tone: cfg.tone,
          welcome_message: cfg.welcome_message,
          custom_instructions: cfg.custom_instructions,
          escalation_keywords: cfg.escalation_keywords || [],
          banned_phrases: cfg.banned_phrases || [],
          faq: cfg.faq || [],
          closer_mode_enabled: !!cfg.closer_mode_enabled,
          enabled: true,
          wizard_completed_at: new Date().toISOString(),
        }, { onConflict: "project_id" });

      if (upErr) throw upErr;

      toast.success("🪄 IA configurada com sucesso!", { description: "Revise os campos avançados se quiser ajustar." });
      reset();
      onOpenChange(false);
      onApplied?.();
    } catch (err: any) {
      console.error("[AIWizard] erro:", err);
      toast.error("Erro ao gerar configuração", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!loading) { if (!o) reset(); onOpenChange(o); } }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Wizard rápido — 6 perguntas, IA pronta
          </DialogTitle>
          <DialogDescription>
            Responda 6 perguntas e a IA gera persona, tom, instruções, FAQ e gatilhos automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Pergunta {step + 1} de {STEPS.length}</span>
            <span>{Math.round(((step + 1) / STEPS.length) * 100)}%</span>
          </div>
          <Progress value={((step + 1) / STEPS.length) * 100} className="h-1.5" />

          <div className="space-y-2 pt-2">
            <Label className="text-base font-semibold">{current.label}</Label>
            <p className="text-xs text-muted-foreground">{current.hint}</p>
            {current.key === "ticket_medio" ? (
              <Input
                value={value}
                onChange={(e) => setAnswers({ ...answers, [current.key]: e.target.value })}
                placeholder={current.placeholder}
                disabled={loading}
                autoFocus
              />
            ) : (
              <Textarea
                value={value}
                onChange={(e) => setAnswers({ ...answers, [current.key]: e.target.value })}
                placeholder={current.placeholder}
                disabled={loading}
                rows={3}
                autoFocus
              />
            )}
          </div>
        </div>

        <DialogFooter className="flex !justify-between gap-2">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || loading}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>

          {isLast ? (
            <Button onClick={handleGenerate} disabled={!canNext || loading}>
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando...</> : <><Sparkles className="h-4 w-4 mr-2" /> Gerar IA</>}
            </Button>
          ) : (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext || loading}>
              Avançar <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

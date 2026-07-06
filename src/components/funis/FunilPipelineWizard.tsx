import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, CheckCircle2, Circle, ChevronRight, Zap, FileText, Mail, Target, Layers, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PipelineBriefing {
  produto: string;
  transformacao: string;
  preco: string;
  nicho: string;
  publico: string;
  nao_publico: string;
  palavras_proibidas: string[];
  objection: string;
  modelo: "vsl" | "webinar" | "isca" | "tripwire" | "lancamento";
}


interface PipelinePhase {
  id: string;
  label: string;
  icon: React.ReactNode;
  status: "pending" | "running" | "done" | "error";
  result?: string;
}

interface FunilPipelineWizardProps {
  open: boolean;
  onClose: () => void;
  onApply: (etapas: unknown[], estrategia: string, assets: Record<string, unknown>) => void;
  projectId?: string;
  products?: Array<{ nome: string; tipo: string; preco: string; link: string }>;
  model: string;
}

const MODELOS = [
  { id: "vsl", label: "VSL (Vídeo de Vendas)" },
  { id: "webinar", label: "Webinar / Aula Online" },
  { id: "isca", label: "Isca Digital + Sequência" },
  { id: "tripwire", label: "Tripwire (Produto de Entrada)" },
  { id: "lancamento", label: "Lançamento PLF" },
] as const;

export function FunilPipelineWizard({ open, onClose, onApply, projectId, products = [], model }: FunilPipelineWizardProps) {
  const [step, setStep] = useState<"briefing" | "generating" | "result">("briefing");
  const [briefing, setBriefing] = useState<PipelineBriefing>({
    produto: "",
    transformacao: "",
    preco: "",
    nicho: "",
    publico: "",
    nao_publico: "",
    palavras_proibidas: [],
    objection: "",
    modelo: "vsl",
  });
  const [proibidaInput, setProibidaInput] = useState("");

  const [phases, setPhases] = useState<PipelinePhase[]>([]);
  const [result, setResult] = useState<{ etapas: unknown[]; estrategia: string; assets: Record<string, unknown> } | null>(null);
  const [overallProgress, setOverallProgress] = useState(0);

  // Auto-fill do briefing com dados do avatar do projeto e público-alvo dos produtos
  useEffect(() => {
    if (!open || !projectId) return;
    (async () => {
      try {
        const sb: any = supabase;
        const [{ data: proj }, { data: prods }] = await Promise.all([
          sb.from("imphq_projetos").select("avatar, nicho, publico_alvo").eq("id", projectId).maybeSingle(),
          sb.from("imphq_produtos").select("publico_alvo").eq("projeto_id", projectId).limit(3),
        ]);

        const avatar = (proj?.avatar as any) || {};
        const perfil = avatar?.perfil_psicologico || {};
        const publicoFromAvatar = [
          perfil?.retrato,
          avatar?.linguagem,
          proj?.publico_alvo,
          (prods || []).map((p: any) => p.publico_alvo).filter(Boolean).join(" | "),
        ].filter(Boolean).join(" — ").slice(0, 400);

        setBriefing(b => ({
          ...b,
          nicho: b.nicho || proj?.nicho || "",
          publico: b.publico || publicoFromAvatar,
        }));
      } catch (e) {
        console.warn("auto-fill avatar failed", e);
      }
    })();
  }, [open, projectId]);


  const updatePhase = (id: string, update: Partial<PipelinePhase>) => {
    setPhases(prev => prev.map(p => p.id === id ? { ...p, ...update } : p));
  };

  const addProibida = () => {
    const t = proibidaInput.trim().toLowerCase();
    if (!t) return;
    if (briefing.palavras_proibidas.includes(t)) { setProibidaInput(""); return; }
    setBriefing(b => ({ ...b, palavras_proibidas: [...b.palavras_proibidas, t] }));
    setProibidaInput("");
  };
  const removeProibida = (t: string) => {
    setBriefing(b => ({ ...b, palavras_proibidas: b.palavras_proibidas.filter(x => x !== t) }));
  };


  const runPipeline = async () => {
    if (!briefing.produto.trim() || !briefing.transformacao.trim() || !briefing.nicho.trim()) {
      toast.error("Preencha produto, transformação e nicho");
      return;
    }

    const initialPhases: PipelinePhase[] = [
      { id: "intel", label: "Intel: Avatar + Mercado + Mecanismo", icon: <Target className="h-4 w-4" />, status: "pending" },
      { id: "angles", label: "Ângulos Criativos (4 ângulos únicos)", icon: <Zap className="h-4 w-4" />, status: "pending" },
      { id: "funnel", label: "Estrutura de Etapas do Funil", icon: <Layers className="h-4 w-4" />, status: "pending" },
      { id: "vsl", label: "Roteiro VSL / Apresentação", icon: <FileText className="h-4 w-4" />, status: "pending" },
      { id: "emails", label: "Sequência de Emails (7 emails)", icon: <Mail className="h-4 w-4" />, status: "pending" },
    ];
    setPhases(initialPhases);
    setStep("generating");
    setOverallProgress(0);

    try {
      const { data, error } = await supabase.functions.invoke("openflow-ai", {
        body: {
          action: "generate_funnel_pipeline",
          project_id: projectId,
          model,
          extra: {
            briefing,
            products: products.length > 0 ? products : undefined,
          },
        },
      });

      if (error) throw error;

      // Animate phases based on returned data (respeita status real: done|failed)
      const phaseOrder = ["intel", "angles", "funnel", "vsl", "emails"];
      for (let i = 0; i < phaseOrder.length; i++) {
        const id = phaseOrder[i];
        updatePhase(id, { status: "running" });
        await new Promise(r => setTimeout(r, 200));
        const phaseStatus = data?.phases?.[id];
        if (phaseStatus === "failed") {
          const msg = data?.phase_errors?.[id] || "falhou";
          updatePhase(id, { status: "error", result: `⚠️ ${msg}` });
        } else {
          updatePhase(id, { status: "done", result: phaseStatus ? "✓ Concluído" : "✓" });
        }
        setOverallProgress(Math.round(((i + 1) / phaseOrder.length) * 100));
        await new Promise(r => setTimeout(r, 100));
      }

      // Aviso de resultado parcial
      const failed = Object.entries(data?.phases || {}).filter(([, v]) => v === "failed").map(([k]) => k);
      if (failed.length) {
        toast.warning(`Pipeline parcial: ${failed.join(", ")} falhou. Você pode reprocessar depois.`);
      }

      setResult({
        etapas: data?.etapas || [],
        estrategia: data?.estrategia || "",
        assets: data?.assets || {},
      });
      setStep("result");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setPhases(prev => prev.map(p => p.status === "running" ? { ...p, status: "error" } : p));
      toast.error(`Erro no pipeline: ${msg}`);
      setStep("briefing");
    }
  };

  const handleApply = () => {
    if (!result) return;
    onApply(result.etapas, result.estrategia, result.assets);
    handleClose();
  };

  const handleClose = () => {
    setStep("briefing");
    setPhases([]);
    setResult(null);
    setOverallProgress(0);
    onClose();
  };

  const canProceed = briefing.produto.trim() && briefing.transformacao.trim() && briefing.nicho.trim();

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Gerar Funil Completo
            <Badge variant="secondary" className="text-[10px] ml-1">Pipeline IA</Badge>
          </DialogTitle>
        </DialogHeader>

        {step === "briefing" && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Preencha o briefing e a IA irá gerar: estrutura de etapas + ângulos criativos + roteiro VSL + sequência de emails — tudo de uma vez.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground mb-1 block">Produto / Oferta *</Label>
                <Input
                  value={briefing.produto}
                  onChange={e => setBriefing(b => ({ ...b, produto: e.target.value }))}
                  placeholder="Ex: Curso de Tráfego Pago para Negócios Locais"
                  className="bg-secondary text-sm"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground mb-1 block">Transformação prometida *</Label>
                <Input
                  value={briefing.transformacao}
                  onChange={e => setBriefing(b => ({ ...b, transformacao: e.target.value }))}
                  placeholder="Ex: Sair do zero para R$10k/mês com anúncios em 90 dias"
                  className="bg-secondary text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Nicho / Avatar *</Label>
                <Input
                  value={briefing.nicho}
                  onChange={e => setBriefing(b => ({ ...b, nicho: e.target.value }))}
                  placeholder="Ex: Donos de clínica odontológica"
                  className="bg-secondary text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Preço / Modelo</Label>
                <Input
                  value={briefing.preco}
                  onChange={e => setBriefing(b => ({ ...b, preco: e.target.value }))}
                  placeholder="Ex: R$997 à vista ou 12x"
                  className="bg-secondary text-sm"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground mb-1 block">Objeção principal do avatar</Label>
                <Input
                  value={briefing.objection}
                  onChange={e => setBriefing(b => ({ ...b, objection: e.target.value }))}
                  placeholder="Ex: Não tenho tempo / Já tentei e não funcionou / É muito caro"
                  className="bg-secondary text-sm"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground mb-1 block">Modelo de funil</Label>
                <Select value={briefing.modelo} onValueChange={v => setBriefing(b => ({ ...b, modelo: v as PipelineBriefing["modelo"] }))}>
                  <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODELOS.map(m => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <p className="text-[11px] text-primary font-medium mb-1">O pipeline vai gerar:</p>
              <ul className="text-[11px] text-muted-foreground space-y-0.5">
                <li>• Intel de avatar + posicionamento de mercado</li>
                <li>• 4 ângulos criativos prontos para anúncio</li>
                <li>• Estrutura visual completa do funil ({briefing.modelo.toUpperCase()})</li>
                <li>• Roteiro de VSL / apresentação estruturado</li>
                <li>• Sequência de 7 emails de nurturing</li>
              </ul>
            </div>
          </div>
        )}

        {step === "generating" && (
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Gerando com IA...</span>
                <span>{overallProgress}%</span>
              </div>
              <Progress value={overallProgress} className="h-1.5" />
            </div>

            <div className="space-y-2">
              {phases.map(phase => (
                <div key={phase.id} className="flex items-center gap-3 rounded-lg border border-border/50 bg-secondary/50 p-3">
                  <div className={`flex-shrink-0 ${phase.status === "done" ? "text-emerald-400" : phase.status === "running" ? "text-primary" : phase.status === "error" ? "text-red-400" : "text-muted-foreground/30"}`}>
                    {phase.status === "done" ? <CheckCircle2 className="h-4 w-4" /> : phase.status === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Circle className="h-4 w-4" />}
                  </div>
                  <div className={`flex-shrink-0 ${phase.status === "pending" ? "text-muted-foreground/30" : "text-muted-foreground"}`}>
                    {phase.icon}
                  </div>
                  <span className={`text-xs flex-1 ${phase.status === "pending" ? "text-muted-foreground/40" : phase.status === "done" ? "text-foreground" : "text-muted-foreground"}`}>
                    {phase.label}
                  </span>
                  {phase.status === "done" && <span className="text-[10px] text-emerald-400">✓</span>}
                  {phase.status === "running" && <span className="text-[10px] text-primary animate-pulse">processando...</span>}
                </div>
              ))}
            </div>

            <p className="text-[10px] text-muted-foreground text-center">
              Este processo pode levar 20–40 segundos. A IA está orquestrando múltiplos especialistas em paralelo.
            </p>
          </div>
        )}

        {step === "result" && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-medium">Pipeline concluído!</span>
            </div>

            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2">
              <p className="text-[11px] font-medium text-emerald-400">Estratégia gerada:</p>
              <p className="text-xs text-muted-foreground">{result.estrategia}</p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded border border-border/50 bg-secondary/50 p-2">
                <p className="text-lg font-bold text-primary">{(result.etapas as unknown[]).length}</p>
                <p className="text-[10px] text-muted-foreground">Etapas</p>
              </div>
              <div className="rounded border border-border/50 bg-secondary/50 p-2">
                <p className="text-lg font-bold text-primary">{(result.assets as Record<string, unknown>).angles ? "4" : "0"}</p>
                <p className="text-[10px] text-muted-foreground">Ângulos</p>
              </div>
              <div className="rounded border border-border/50 bg-secondary/50 p-2">
                <p className="text-lg font-bold text-primary">{(result.assets as Record<string, unknown>).emails ? "7" : "0"}</p>
                <p className="text-[10px] text-muted-foreground">Emails</p>
              </div>
            </div>

            {(result.assets as Record<string, unknown>).angles && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Ângulos criativos</p>
                <div className="space-y-1">
                  {((result.assets as Record<string, unknown>).angles as string[]).map((angle: string, i: number) => (
                    <div key={i} className="flex gap-2 text-xs text-muted-foreground">
                      <span className="text-primary font-bold flex-shrink-0">#{i + 1}</span>
                      <span>{angle}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(result.assets as Record<string, unknown>).vsl_outline && (
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">VSL — Estrutura</p>
                <Textarea
                  readOnly
                  value={(result.assets as Record<string, unknown>).vsl_outline as string}
                  className="bg-secondary text-xs min-h-[100px] resize-none"
                />
              </div>
            )}

            <p className="text-[10px] text-muted-foreground">
              Clique em "Aplicar ao Funil" para montar as etapas no canvas. Os ângulos, VSL e emails ficam salvos nos metadados do funil.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            {step === "result" ? "Fechar" : "Cancelar"}
          </Button>
          {step === "briefing" && (
            <Button size="sm" onClick={runPipeline} disabled={!canProceed} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Gerar Funil Completo
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          )}
          {step === "result" && (
            <Button size="sm" onClick={handleApply} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Aplicar ao Funil
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

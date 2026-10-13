import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calculator,
  TrendingUp,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Copy,
  Flame,
  Zap,
  RotateCcw,
  Sliders,
  DollarSign,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { FunnelLive } from "@shared/funnel-live";
import { REFERENCIA } from "@shared/funnel-live";
import {
  simulateFunnelImpact,
  type SimulatableStage,
  type FunnelDiagnosticItem,
} from "@shared/funnel-diagnostics";

interface FunnelWhatIfSimulatorProps {
  funnel: FunnelLive;
  primaryBottleneck?: FunnelDiagnosticItem | null;
  projectName?: string;
}

const brl = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function FunnelWhatIfSimulator({
  funnel,
  primaryBottleneck,
  projectName,
}: FunnelWhatIfSimulatorProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Inicializa o estágio com base no gargalo ativo identificado
  const defaultStage = useMemo<SimulatableStage>(() => {
    if (!primaryBottleneck) return "chegada";
    const pair = primaryBottleneck.stagePair;
    if (pair.includes("anuncio") && pair.includes("pagina")) return "chegada";
    if (pair.includes("pagina") && pair.includes("checkout")) return "inicio_checkout";
    if (pair.includes("checkout") && pair.includes("venda")) return "aprovacao";
    if (pair.includes("venda") && pair.includes("extra")) return "extra";
    if (pair.includes("recuperacao")) return "recuperacao";
    return "chegada";
  }, [primaryBottleneck]);

  const [selectedStage, setSelectedStage] = useState<SimulatableStage>(defaultStage);

  // Pega a taxa atual de cada etapa para definir o valor inicial do slider
  const stageMap = useMemo(() => new Map(funnel.etapas.map((e) => [e.id, e])), [funnel]);
  const currentChegada = stageMap.get("pagina")?.conversao?.value ?? 0;
  const currentInicio = stageMap.get("checkout")?.conversao?.value ?? 0;
  const currentAprovacao = stageMap.get("venda")?.conversao?.value ?? 0;
  const currentExtra = stageMap.get("extra")?.conversao?.value ?? 0;
  const currentRecup = stageMap.get("recuperacao")?.conversao?.value ?? 0;

  // Valor do Slider para cada etapa
  const [simRates, setSimRates] = useState<Record<SimulatableStage, number>>({
    chegada: currentChegada > 0 ? Math.min(85, Math.max(currentChegada + 15, REFERENCIA.chegada)) : REFERENCIA.chegada,
    inicio_checkout: currentInicio > 0 ? Math.min(20, Math.max(currentInicio + 4, REFERENCIA.inicio_checkout)) : REFERENCIA.inicio_checkout,
    aprovacao: currentAprovacao > 0 ? Math.min(75, Math.max(currentAprovacao + 15, REFERENCIA.aprovacao)) : REFERENCIA.aprovacao,
    extra: currentExtra > 0 ? Math.min(35, Math.max(currentExtra + 8, REFERENCIA.extra)) : REFERENCIA.extra,
    recuperacao: currentRecup > 0 ? Math.min(40, Math.max(currentRecup + 10, REFERENCIA.recuperacao)) : REFERENCIA.recuperacao,
    composto: 15, // +15% composto em cada etapa
  });

  const activeSimRate = simRates[selectedStage];

  const handleRateChange = (newVal: number[]) => {
    setSimRates((prev) => ({
      ...prev,
      [selectedStage]: newVal[0],
    }));
  };

  const simulation = useMemo(() => {
    return simulateFunnelImpact(funnel, selectedStage, activeSimRate, activeSimRate);
  }, [funnel, selectedStage, activeSimRate]);

  // Limites do slider dependendo da etapa
  const sliderConfig = useMemo(() => {
    switch (selectedStage) {
      case "chegada":
        return { min: 20, max: 95, step: 1, unit: "%", ref: REFERENCIA.chegada };
      case "inicio_checkout":
        return { min: 1, max: 25, step: 0.5, unit: "%", ref: REFERENCIA.inicio_checkout };
      case "aprovacao":
        return { min: 15, max: 85, step: 1, unit: "%", ref: REFERENCIA.aprovacao };
      case "extra":
        return { min: 2, max: 50, step: 1, unit: "%", ref: REFERENCIA.extra };
      case "recuperacao":
        return { min: 2, max: 50, step: 1, unit: "%", ref: REFERENCIA.recuperacao };
      case "composto":
        return { min: 5, max: 40, step: 1, unit: "%", ref: 15 };
    }
  }, [selectedStage]);

  const handlePreset = (type: "ref" | "boost" | "reset") => {
    let target = sliderConfig.ref;
    if (type === "reset") {
      target = simulation.currentRate > 0 ? simulation.currentRate : sliderConfig.ref;
    } else if (type === "boost") {
      target = Math.min(sliderConfig.max, Math.round(simulation.currentRate * 1.5 || sliderConfig.ref * 1.3));
    }
    setSimRates((prev) => ({ ...prev, [selectedStage]: target }));
  };

  const handleCopyPlan = () => {
    const text = [
      `# 🎯 Plano de Alavancagem Financeira: ${simulation.stageLabel}`,
      `Projeto: ${projectName || "Geral"}`,
      `Taxa Atual: ${simulation.currentRate}% ➔ Meta Simulada: ${simulation.simulatedRate}%`,
      "",
      `### 💰 Impacto Financeiro Projetado (com o mesmo gasto em anúncios):`,
      `- Faturamento Adicional: +${brl(simulation.deltaRevenue)}`,
      `- Lucro Líquido Estimado: +${brl(simulation.deltaLiquidRevenue)}`,
      `- Novas Vendas: +${simulation.deltaSales} clientes (Total: ${simulation.simulatedSales})`,
      simulation.simulatedRoas ? `- Novo ROAS: ${simulation.simulatedRoas.toLocaleString("pt-BR")}x (vs ${simulation.currentRoas?.toLocaleString("pt-BR") ?? "—"}x)` : "",
      simulation.simulatedCpa ? `- Novo CPA: ${brl(simulation.simulatedCpa)} (vs ${simulation.currentCpa ? brl(simulation.currentCpa) : "—"})` : "",
      "",
      `### 🛠️ Plano de Ação em 3 Passos:`,
      ...simulation.actionPlan.map((step, i) => `${i + 1}. ${step}`),
    ].filter(Boolean).join("\n");

    navigator.clipboard.writeText(text);
    toast.success("Plano de alavancagem copiado para a área de transferência!");
  };

  return (
    <section
      className="rounded-xl border border-primary/30 bg-gradient-to-br from-card via-card/90 to-primary/5 p-4 sm:p-5 shadow-md"
      aria-label="Simulador de Alavancagem Financeira"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary shadow-xs">
            <Calculator className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <span>Simulador de Alavancagem Financeira (What-If)</span>
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-400">
                PROJEÇÃO REAL
              </span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Arraste as alavancas e veja quanto faturamento extra entra no caixa ao corrigir gargalos com o mesmo investimento.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title={isOpen ? "Recolher simulador" : "Expandir simulador"}
        >
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 pt-4 mt-2 border-t border-border/60"
          >
            {/* Stage Selector Pills */}
            <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Alavancas do Funil">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mr-1">
                Alavanca:
              </span>
              {[
                { id: "chegada", label: "Chegada (PageSpeed)", icon: Sliders },
                { id: "inicio_checkout", label: "Início Checkout (VSL)", icon: Sliders },
                { id: "aprovacao", label: "Aprovação (Checkout/PIX)", icon: Sliders },
                { id: "extra", label: "Bump & Upsell (LTV)", icon: Sliders },
                { id: "recuperacao", label: "WhatsApp Recovery", icon: Sliders },
                { id: "composto", label: "⭐ Efeito Composto", icon: Sparkles },
              ].map((s) => {
                const isSelected = selectedStage === s.id;
                const isBottleneck =
                  (s.id === "chegada" && primaryBottleneck?.id.includes("speed")) ||
                  (s.id === "inicio_checkout" && primaryBottleneck?.id.includes("vsl")) ||
                  (s.id === "aprovacao" && primaryBottleneck?.id.includes("friction")) ||
                  (s.id === "extra" && primaryBottleneck?.id.includes("bump")) ||
                  (s.id === "recuperacao" && primaryBottleneck?.id.includes("recovery"));

                return (
                  <button
                    key={s.id}
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setSelectedStage(s.id as SimulatableStage)}
                    className={cn(
                      "relative inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "border-border/80 bg-secondary/30 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    <span>{s.label}</span>
                    {isBottleneck && (
                      <span className="flex h-2 w-2 rounded-full bg-destructive animate-pulse" title="Gargalo Ativo!" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Slider de Controle da Taxa */}
            <div className="rounded-xl border border-border/80 bg-background/50 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    {simulation.stageLabel}
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    Taxa atual: <strong className="font-mono text-foreground">{simulation.currentRate}%</strong>
                    {selectedStage !== "composto" && (
                      <> · Referência de mercado: <strong className="font-mono text-foreground">{sliderConfig.ref}%</strong></>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1 font-mono text-base font-bold text-primary">
                    <span>{activeSimRate}</span>
                    <span className="text-xs font-normal opacity-80">{sliderConfig.unit}</span>
                  </div>

                  {/* Preset Buttons */}
                  <button
                    onClick={() => handlePreset("ref")}
                    className="rounded-md border border-border bg-secondary/40 px-2 py-1 text-[11px] font-medium text-foreground hover:border-primary/40 hover:text-primary transition-colors"
                    title="Definir para a referência de mercado"
                  >
                    Meta Ref.
                  </button>
                  <button
                    onClick={() => handlePreset("boost")}
                    className="rounded-md border border-border bg-secondary/40 px-2 py-1 text-[11px] font-medium text-foreground hover:border-primary/40 hover:text-primary transition-colors"
                    title="Projeção ousada (+50%)"
                  >
                    +50%
                  </button>
                  <button
                    onClick={() => handlePreset("reset")}
                    className="rounded-md border border-border p-1 text-muted-foreground hover:text-foreground transition-colors"
                    title="Resetar"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Slider Radix */}
              <div className="pt-2">
                <Slider
                  value={[activeSimRate]}
                  onValueChange={handleRateChange}
                  min={sliderConfig.min}
                  max={sliderConfig.max}
                  step={sliderConfig.step}
                  className="cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground pt-1.5 font-mono">
                  <span>{sliderConfig.min}{sliderConfig.unit}</span>
                  <span className="text-primary font-semibold">Alvo: {activeSimRate}{sliderConfig.unit}</span>
                  <span>{sliderConfig.max}{sliderConfig.unit}</span>
                </div>
              </div>
            </div>

            {/* Resultado do Impacto Financeiro (Cards de Projeção) */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {/* Faturamento Extra */}
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 shadow-[0_0_20px_hsl(var(--success)/0.08)]">
                <div className="flex items-center justify-between text-[11px] font-medium text-emerald-400">
                  <span>FATURAMENTO EXTRA</span>
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div className="mt-1 font-mono text-xl font-bold text-emerald-400 sm:text-2xl">
                  +{brl(simulation.deltaRevenue)}
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  Projeção no período com o mesmo tráfego
                </div>
              </div>

              {/* Novas Vendas */}
              <div className="rounded-xl border border-border/80 bg-card p-3.5">
                <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                  <span>NOVOS CLIENTES</span>
                  <DollarSign className="h-4 w-4 text-primary" />
                </div>
                <div className="mt-1 font-mono text-xl font-bold text-foreground sm:text-2xl">
                  +{simulation.deltaSales}
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    ({simulation.simulatedSales} tot.)
                  </span>
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {simulation.currentSales} vendas atuais
                </div>
              </div>

              {/* Novo ROAS */}
              <div className="rounded-xl border border-border/80 bg-card p-3.5">
                <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                  <span>NOVO ROAS PROJETADO</span>
                  <Sparkles className="h-4 w-4 text-amber-400" />
                </div>
                <div className="mt-1 font-mono text-xl font-bold text-foreground sm:text-2xl">
                  {simulation.simulatedRoas ? `${simulation.simulatedRoas.toLocaleString("pt-BR")}x` : "—"}
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  Atual: {simulation.currentRoas ? `${simulation.currentRoas.toLocaleString("pt-BR")}x` : "—"}
                </div>
              </div>

              {/* Novo CPA */}
              <div className="rounded-xl border border-border/80 bg-card p-3.5">
                <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                  <span>NOVO CPA (CUSTO POR VENDA)</span>
                  <Flame className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="mt-1 font-mono text-xl font-bold text-emerald-400 sm:text-2xl">
                  {simulation.simulatedCpa ? brl(simulation.simulatedCpa) : "—"}
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  Atual: {simulation.currentCpa ? brl(simulation.currentCpa) : "—"}
                </div>
              </div>
            </div>

            {/* Plano de Ação Recomendado */}
            <div className="rounded-xl border border-border/80 bg-background/50 p-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold text-foreground">
                    Como alcançar esta meta de {activeSimRate}{sliderConfig.unit} (Plano em 3 Passos):
                  </span>
                </div>
                <button
                  onClick={handleCopyPlan}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-2.5 py-1 text-xs font-medium text-foreground hover:border-primary/40 hover:text-primary transition-all"
                  title="Copiar plano executivo"
                >
                  <Copy className="h-3 w-3" />
                  <span>Copiar Plano Executivo</span>
                </button>
              </div>

              <ul className="mt-2.5 space-y-1.5 text-xs text-muted-foreground">
                {simulation.actionPlan.map((action, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

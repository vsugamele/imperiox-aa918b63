import { useState, useEffect, useMemo, useRef } from "react";
import { 
  Target, 
  Zap, 
  Smartphone, 
  Globe, 
  Play, 
  Pause, 
  RotateCcw, 
  Sparkles, 
  Activity, 
  CheckCircle2, 
  ArrowRight,
  Eye,
  SlidersHorizontal,
  Flame,
  Wrench,
  Bot
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

export type TacticalLens = "all" | "jp" | "bifi" | "geelark" | "infra";

export interface JourneyStep {
  nodeMatch: string[]; // labels or IDs of target nodes
  title: string;
  desc: string;
  executor: string;
  channel: string;
  color: string;
}

export interface JourneyScenario {
  id: string;
  name: string;
  desc: string;
  icon: string;
  steps: JourneyStep[];
}

export const JOURNEY_SCENARIOS: JourneyScenario[] = [
  {
    id: "jp_organico",
    name: "💈 JP Freitas: Reel Orgânico ➔ Venda Formação",
    desc: "Fluxo completo do vídeo postado no GeeLark até a aprovação de compra na Kiwify",
    icon: "💈",
    steps: [
      {
        nodeMatch: ["@Jpfreitas_cortes", "Phone 04", "Reels Orgânicos"],
        title: "1. Postagem de Reel Viral",
        desc: "Vídeo distribuído via GeeLark Phone 04 com chamada 'Comente CORTES'",
        executor: "Máquina Orgânica GeeLark",
        channel: "Instagram @jpfreitas_cortes",
        color: "#E1306C",
      },
      {
        nodeMatch: ["Zernio Automator", "Zernio", "Webhook Lead"],
        title: "2. Captura Instantânea do Comentário",
        desc: "Zernio monitora o post e engatilha Direct em menos de 2 segundos",
        executor: "Zernio API",
        channel: "Instagram Direct",
        color: "#8B5CF6",
      },
      {
        nodeMatch: ["Evolution API (Instância JP)", "WhatsApp SDR", "Evolution"],
        title: "3. Qualificação SDR / IA",
        desc: "Evolution API inicia conversa consultiva no WhatsApp da barbearia",
        executor: "OpenFlow + Evolution API",
        channel: "WhatsApp",
        color: "#25D366",
      },
      {
        nodeMatch: ["Kiwify / Ticto Gateway", "Checkout", "Formação Barbeiro 10k"],
        title: "4. Checkout & Venda Aprovada",
        desc: "Lead fecha compra de R$ 1.997 na Kiwify e webhook aciona entrega",
        executor: "Kiwify Webhook",
        channel: "Gateway Pagamento",
        color: "#D6FF4B",
      }
    ]
  },
  {
    id: "bifi_dtc",
    name: "💊 DTC Bifi: Tráfego Pago ➔ Advertorial ➔ Conversão",
    desc: "Esteira de escala de tráfego direto para LinfaFlow com recuperação de Pix",
    icon: "💊",
    steps: [
      {
        nodeMatch: ["Meta Ads (Campanhas)", "Meta Ads", "Anúncio"],
        title: "1. Criativo de Alto Impacto (P1-P4)",
        desc: "Anúncio Meta Ads focado em dor de retenção de líquido e inchaço",
        executor: "Gestor de Tráfego / IA",
        channel: "Meta Ads (Instagram/FB)",
        color: "#F59E0B",
      },
      {
        nodeMatch: ["LinfaFlow (Drenagem Linfática)", "PDP / Advertorial", "VSL LinfaFlow"],
        title: "2. Advertorial & Mecanismo Único",
        desc: "Lead lê tese da drenagem natural e desbloqueia oferta com kit 3 potes",
        executor: "Landing Page Persuasiva",
        channel: "Web PDP",
        color: "#10B981",
      },
      {
        nodeMatch: ["Kiwify / Ticto Gateway", "Checkout Ticto", "Checkout"],
        title: "3. Checkout com Orderbump",
        desc: "Lead preenche dados e gera Pix com e-book complementar adicionado",
        executor: "Ticto Checkout",
        channel: "Checkout Seguro",
        color: "#D6FF4B",
      },
      {
        nodeMatch: ["Evolution API (Instância JP)", "Recuperação", "WhatsApp"],
        title: "4. Recuperação Automática em 15 Min",
        desc: "Se o Pix não for pago, webhook dispara áudio humanizado no WhatsApp",
        executor: "Payment Recovery Cron",
        channel: "WhatsApp Recovery",
        color: "#06B6D4",
      }
    ]
  },
  {
    id: "geelark_farm",
    name: "📱 Máquina GeeLark: Aquecimento & Postagem",
    desc: "Rotina automatizada de cloud phones e postagem multicanal sem bloqueio",
    icon: "📱",
    steps: [
      {
        nodeMatch: ["Phone 04 (GeeLark)", "Phone 05 (GeeLark)", "Phone 04", "Phone 05"],
        title: "1. Autenticação Residencial",
        desc: "Cloud phone conecta via proxy IP 4G em São Paulo simulando iPhone real",
        executor: "GeeLark Cloud Engine",
        channel: "Cloud Device",
        color: "#06B6D4",
      },
      {
        nodeMatch: ["@Jpfreitas_cortes", "@tudo.sobre.intestino", "Perfis"],
        title: "2. Aquecimento do Algoritmo",
        desc: "Simulação de rolagem, likes e comentários para elevar score de confiança",
        executor: "Higgsfield + GeeLark",
        channel: "Feed Explorer",
        color: "#EC4899",
      },
      {
        nodeMatch: ["Zernio Automator", "Zernio", "N8N"],
        title: "3. Disparo Simultâneo",
        desc: "Vídeo publicado e webhooks prontos para capturar leads que comentarem",
        executor: "Zernio Engine",
        channel: "Instagram / TikTok",
        color: "#8B5CF6",
      }
    ]
  }
];

interface Props {
  activeLens: TacticalLens;
  onLensChange: (lens: TacticalLens) => void;
  // Simulator
  isSimulating: boolean;
  activeScenario: JourneyScenario | null;
  currentStepIndex: number;
  onStartSimulation: (scenario: JourneyScenario) => void;
  onStopSimulation: () => void;
  onNextStep: () => void;
  onPrevStep: () => void;
  // Copilot Trigger
  onOpenGrowthCopilot: () => void;
  onOpenInfraTools: () => void;
  // Counts / Stats
  nodeCount: number;
  activeProjectName?: string;
}

export function CompanyMapTacticalBar({
  activeLens,
  onLensChange,
  isSimulating,
  activeScenario,
  currentStepIndex,
  onStartSimulation,
  onStopSimulation,
  onNextStep,
  onPrevStep,
  onOpenGrowthCopilot,
  onOpenInfraTools,
  nodeCount,
}: Props) {
  const [isPlayingAuto, setIsPlayingAuto] = useState(false);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Autoplay da simulação
  useEffect(() => {
    if (isSimulating && isPlayingAuto) {
      autoPlayTimerRef.current = setTimeout(() => {
        if (!activeScenario) return;
        if (currentStepIndex < activeScenario.steps.length - 1) {
          onNextStep();
        } else {
          setIsPlayingAuto(false);
        }
      }, 4000);
    } else {
      if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);
    }
    return () => {
      if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);
    };
  }, [isSimulating, isPlayingAuto, currentStepIndex, activeScenario, onNextStep]);

  const currentStep = activeScenario?.steps[currentStepIndex];

  return (
    <div className="absolute top-16 left-3 right-3 z-20 flex flex-col gap-2 pointer-events-none">
      {/* Barra Principal de Telemetria e Lentes Táticas */}
      <div className="pointer-events-auto flex items-center justify-between gap-3 bg-[#0A0B0D]/90 backdrop-blur-md border border-[#1B1E23] rounded-xl px-3 py-2 shadow-2xl overflow-x-auto">
        {/* Esquerda: Seletor de Lentes Táticas */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono uppercase tracking-wider text-muted-foreground mr-1">
            <SlidersHorizontal className="h-3 w-3 text-lime-400" />
            <span className="hidden sm:inline">Lente:</span>
          </div>

          <button
            onClick={() => onLensChange("all")}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
              activeLens === "all"
                ? "bg-lime-400 text-black font-semibold shadow-[0_0_12px_rgba(214,255,75,0.4)]"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            )}
          >
            <Globe className="h-3.5 w-3.5" />
            <span>Master 360°</span>
            <span className="text-[10px] opacity-70">({nodeCount})</span>
          </button>

          <button
            onClick={() => onLensChange("jp")}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
              activeLens === "jp"
                ? "bg-[#D6FF4B] text-black font-semibold shadow-[0_0_12px_rgba(214,255,75,0.4)]"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            )}
          >
            <span className="text-sm">💈</span>
            <span>JP Freitas</span>
          </button>

          <button
            onClick={() => onLensChange("bifi")}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
              activeLens === "bifi"
                ? "bg-emerald-400 text-black font-semibold shadow-[0_0_12px_rgba(52,211,153,0.4)]"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            )}
          >
            <span className="text-sm">💊</span>
            <span>DTC Bifi</span>
          </button>

          <button
            onClick={() => onLensChange("geelark")}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
              activeLens === "geelark"
                ? "bg-cyan-400 text-black font-semibold shadow-[0_0_12px_rgba(6,182,212,0.4)]"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            )}
          >
            <Smartphone className="h-3.5 w-3.5 text-cyan-500" />
            <span>GeeLark Farm</span>
          </button>

          <button
            onClick={() => onLensChange("infra")}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
              activeLens === "infra"
                ? "bg-purple-400 text-black font-semibold shadow-[0_0_12px_rgba(192,132,252,0.4)]"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            )}
          >
            <Wrench className="h-3.5 w-3.5 text-purple-400" />
            <span>Ferramentas & APIs</span>
          </button>
        </div>

        {/* Centro / Direita: Status Operacional e Ações de Guerra */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Telemetria Ao Vivo */}
          <div className="hidden lg:flex items-center gap-2 border-l border-r border-[#1B1E23] px-3">
            <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Evolution Online</span>
            </div>
            <span className="text-zinc-600">·</span>
            <div className="flex items-center gap-1 text-[11px] font-mono text-cyan-400">
              <Smartphone className="h-3 w-3" />
              <span>8 Phones Prontos</span>
            </div>
          </div>

          {/* Botão Simulador de Jornada */}
          {!isSimulating ? (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onStartSimulation(JOURNEY_SCENARIOS[0])}
                className="h-7 text-xs bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20 font-semibold gap-1.5 shadow-sm"
                title="Assistir à jornada completa do lead percorrendo o mapa"
              >
                <Play className="h-3 w-3 fill-amber-300" />
                <span className="hidden sm:inline">Simular Jornada do Lead</span>
                <span className="sm:hidden">Simular</span>
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="destructive"
              onClick={onStopSimulation}
              className="h-7 text-xs font-semibold gap-1"
            >
              Fechar Simulação
            </Button>
          )}

          {/* Botão Growth Copilot R$ */}
          <Button
            size="sm"
            onClick={onOpenGrowthCopilot}
            className="h-7 text-xs bg-[#D6FF4B] hover:bg-[#c2eb3d] text-[#0A0B0D] font-bold gap-1.5 shadow-[0_0_15px_rgba(214,255,75,0.3)] transition-all"
            title="Calcular alocação de verba e acionar agentes para esse funil"
          >
            <Zap className="h-3 w-3 fill-[#0A0B0D]" />
            <span>Alocar Verba (R$)</span>
          </Button>
        </div>
      </div>

      {/* Caixa Flutuante do Simulador Interativo ("Play Flow") */}
      {isSimulating && activeScenario && currentStep && (
        <div className="pointer-events-auto bg-[#0E1013]/95 backdrop-blur-md border-2 border-amber-500/50 rounded-xl p-3 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-3 duration-200">
          {/* Header & Descrição da Etapa Atual */}
          <div className="flex items-start gap-3">
            <div 
              className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 text-lg shadow-inner"
              style={{ background: `${currentStep.color}25`, border: `1px solid ${currentStep.color}60` }}
            >
              {activeScenario.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-amber-500 text-black font-mono text-[10px] font-bold">
                  PASSO {currentStepIndex + 1} DE {activeScenario.steps.length}
                </Badge>
                <h4 className="text-sm font-semibold text-white">{currentStep.title}</h4>
              </div>
              <p className="text-xs text-zinc-300 mt-0.5">{currentStep.desc}</p>
              <div className="flex items-center gap-2 mt-1.5 text-[10px] font-mono text-zinc-400">
                <span className="flex items-center gap-1 text-purple-300">
                  <Bot className="h-3 w-3 text-purple-400" />
                  {currentStep.executor}
                </span>
                <span>·</span>
                <span className="text-zinc-300 font-semibold">{currentStep.channel}</span>
              </div>
            </div>
          </div>

          {/* Controles do Simulador */}
          <div className="flex items-center gap-2 self-end md:self-center shrink-0">
            {/* Seletor de Cenário */}
            <div className="flex items-center gap-1 mr-2 border-r border-zinc-800 pr-2">
              {JOURNEY_SCENARIOS.map((sc, idx) => (
                <button
                  key={sc.id}
                  onClick={() => onStartSimulation(sc)}
                  className={cn(
                    "px-2 py-1 rounded text-[11px] font-medium transition-colors",
                    activeScenario.id === sc.id
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "text-zinc-500 hover:text-zinc-300"
                  )}
                  title={sc.name}
                >
                  {sc.icon} {idx + 1}
                </button>
              ))}
            </div>

            <Button
              size="sm"
              variant="outline"
              disabled={currentStepIndex === 0}
              onClick={onPrevStep}
              className="h-7 px-2 text-xs"
            >
              Anterior
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsPlayingAuto(!isPlayingAuto)}
              className={cn(
                "h-7 px-2.5 text-xs font-semibold gap-1",
                isPlayingAuto ? "bg-amber-500 text-black border-amber-500" : "text-amber-400 border-amber-500/30"
              )}
            >
              {isPlayingAuto ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              {isPlayingAuto ? "Pausar" : "Auto"}
            </Button>

            <Button
              size="sm"
              disabled={currentStepIndex >= activeScenario.steps.length - 1}
              onClick={onNextStep}
              className="h-7 px-2.5 text-xs bg-lime-400 hover:bg-lime-500 text-black font-semibold gap-1"
            >
              <span>Próximo</span>
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

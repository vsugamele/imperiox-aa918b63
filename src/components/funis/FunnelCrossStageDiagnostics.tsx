import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  Flame,
  Gauge,
  HelpCircle,
  Lightbulb,
  MousePointerClick,
  Sparkles,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { FunnelLive, StageId } from "@shared/funnel-live";
import {
  runFunnelDiagnostics,
  type FunnelDiagnosticItem,
  type DiagnosticSeverity,
  type ActionType,
} from "@shared/funnel-diagnostics";

const SEVERITY_CONFIG: Record<
  DiagnosticSeverity,
  { label: string; badgeCls: string; borderCls: string; icon: typeof AlertTriangle }
> = {
  critico: {
    label: "Gargalo Crítico",
    badgeCls: "bg-destructive/15 text-destructive border-destructive/30",
    borderCls: "border-destructive/50 bg-destructive/5 shadow-[0_0_20px_hsl(var(--destructive)/0.1)]",
    icon: AlertTriangle,
  },
  alerta: {
    label: "Atenção",
    badgeCls: "bg-warning/15 text-warning border-warning/30",
    borderCls: "border-warning/40 bg-warning/5",
    icon: AlertCircle,
  },
  oportunidade: {
    label: "Oportunidade",
    badgeCls: "bg-primary/15 text-primary border-primary/30",
    borderCls: "border-primary/40 bg-primary/5",
    icon: Sparkles,
  },
  saudavel: {
    label: "Equilibrado",
    badgeCls: "bg-success/15 text-success border-success/30",
    borderCls: "border-success/40 bg-success/5",
    icon: CheckCircle2,
  },
};

const STAGE_NAMES: Record<StageId, string> = {
  anuncio: "Anúncio",
  pagina: "Página",
  checkout: "Checkout",
  venda: "Venda",
  extra: "Bump/Upsell",
  recuperacao: "WhatsApp",
};

export function FunnelCrossStageDiagnostics({ funnel, projectId }: { funnel: FunnelLive; projectId?: string | null }) {
  const report = runFunnelDiagnostics(funnel);
  const [filter, setFilter] = useState<"todos" | "criticos" | "oportunidades">("todos");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredItems = report.diagnostics.filter((d) => {
    if (filter === "criticos") return d.severity === "critico" || d.severity === "alerta";
    if (filter === "oportunidades") return d.severity === "oportunidade";
    return true;
  });

  const handleCopyReport = () => {
    const lines = [
      `# 📊 Diagnóstico Inteligente do Funil - Score: ${report.score}/100 (${report.scoreLabel})`,
      `Projeto: ${projectId || "Geral"} | Etapas Saudáveis: ${report.healthyStagesCount}/${report.totalStagesCount}`,
      "",
      ...report.diagnostics.map((d, i) => [
        `### ${i + 1}. [${d.badge}] ${d.title}`,
        `- **Gravidade**: ${SEVERITY_CONFIG[d.severity].label}`,
        `- **Transição**: ${d.stagePair.map((s) => STAGE_NAMES[s]).join(" ➔ ")}`,
        `- **Métricas**: ${d.metricComparison}`,
        `- **Causa Raiz**: ${d.rootCause}`,
        `- **Ação Recomendada**: ${d.recommendation}`,
        d.estimatedLeak ? `- **Vazamento Estimado**: ${d.estimatedLeak}` : "",
        "",
      ].filter(Boolean).join("\n")),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Dossiê de diagnóstico copiado para a área de transferência!");
  };

  const handleAction = (item: FunnelDiagnosticItem) => {
    switch (item.action.type) {
      case "pagespeed":
        // Abre PageSpeed Insights em nova aba ou copia recomendação técnica
        window.open("https://pagespeed.web.dev/", "_blank");
        toast.info("Abrindo Google PageSpeed Insights. Verifique o LCP e peso dos assets da sua LP!");
        break;
      case "copy_vsl":
        navigator.clipboard.writeText(
          `[AUDITORIA VSL]: ${item.title}\nCausa: ${item.rootCause}\nRecomendação: ${item.recommendation}`
        );
        toast.success("Diretriz de revisão de VSL copiada para colar na IA!");
        break;
      case "checkout_friction":
        navigator.clipboard.writeText(
          `[CHECKOUT CRO]: ${item.title}\nAções:\n1. Deixar apenas Nome, Email, Telefone e CPF.\n2. Colocar PIX como aba padrão.\n3. Testar gateway reserva.`
        );
        toast.success("Checklist de otimização de checkout copiado!");
        break;
      case "recovery_wa":
        navigator.clipboard.writeText(
          `[RÉGUA WHATSAPP]: Enviar mensagem após 5-10 min do abandono:\n"Oi [Nome], vi que deu uma instabilidade no seu PIX, quer que eu te mande a chave direta?"`
        );
        toast.success("Script humanizado de recuperação copiado!");
        break;
      default:
        navigator.clipboard.writeText(`${item.title}\n${item.recommendation}`);
        toast.success("Recomendação copiada!");
        break;
    }
  };

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card/70 p-4 sm:p-5 shadow-sm" aria-label="Diagnóstico Cruzado do Funil">
      {/* Cabeçalho do Score e Sinergia */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Activity className="h-4 w-4" />
            </span>
            <h3 className="text-base font-semibold text-foreground">
              Diagnóstico Cruzado do Funil & Gargalos de Marketing
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Correlação entre etapas adjacentes: detecta vazamentos de tráfego, lentidão de carregamento, atrito de pagamento e retenção de VSL.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Badge de Score de Fluidez */}
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-xs font-semibold",
              report.score >= 80
                ? "border-success/30 bg-success/10 text-success"
                : report.score >= 60
                ? "border-warning/30 bg-warning/10 text-warning"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            )}
            title="Score baseado na fluidez das transições e ausência de gargalos críticos"
          >
            <Gauge className="h-4 w-4" />
            <span>Score de Fluidez: {report.score}/100</span>
            <span className="font-sans font-normal opacity-80">({report.scoreLabel})</span>
          </div>

          <button
            onClick={handleCopyReport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-xs font-medium text-foreground transition-all hover:border-primary/50 hover:bg-primary/10"
            title="Copiar relatório completo formatado em Markdown"
          >
            <Copy className="h-3.5 w-3.5" />
            <span>Copiar Relatório</span>
          </button>
        </div>
      </div>

      {/* Filtros rápidos se houver mais de 1 item */}
      {report.diagnostics.length > 1 && (
        <div className="flex items-center gap-1 text-xs">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mr-1">Filtrar:</span>
          <button
            onClick={() => setFilter("todos")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              filter === "todos" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-muted"
            )}
          >
            Todos ({report.diagnostics.length})
          </button>
          <button
            onClick={() => setFilter("criticos")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              filter === "criticos" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-muted"
            )}
          >
            Gargalos & Alertas ({report.diagnostics.filter((d) => d.severity === "critico" || d.severity === "alerta").length})
          </button>
          <button
            onClick={() => setFilter("oportunidades")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              filter === "oportunidades" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-muted"
            )}
          >
            Oportunidades ({report.diagnostics.filter((d) => d.severity === "oportunidade").length})
          </button>
        </div>
      )}

      {/* Grid de Diagnósticos Cruzados */}
      <div className="space-y-3">
        <AnimatePresence>
          {filteredItems.map((item, index) => {
            const config = SEVERITY_CONFIG[item.severity];
            const SeverityIcon = config.icon;
            const isExpanded = expandedId === item.id;

            return (
              <motion.article
                key={item.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "relative rounded-xl border p-4 transition-all duration-200",
                  config.borderCls
                )}
              >
                {/* Linha superior: Severidade, Categoria e Transição */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", config.badgeCls)}>
                      <SeverityIcon className="h-3 w-3" />
                      {config.label}
                    </span>
                    <span className="rounded-md bg-secondary/60 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                      {item.badge}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 rounded-full border border-border/80 bg-background/60 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {item.stagePair.map((st, i) => (
                      <span key={st} className="flex items-center gap-1">
                        {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground/60" />}
                        <span className="font-semibold text-foreground">{STAGE_NAMES[st]}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Título Principal & Métrica Cruzada */}
                <div className="mt-2.5 space-y-1">
                  <h4 className="text-sm font-semibold text-foreground sm:text-[15px] leading-snug">
                    {item.title}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono font-medium text-foreground bg-secondary/50 px-2 py-0.5 rounded">
                      📊 {item.metricComparison}
                    </span>
                    {item.estimatedLeak && (
                      <span className="font-semibold text-destructive inline-flex items-center gap-1 text-[11px]">
                        <Flame className="h-3 w-3" /> {item.estimatedLeak}
                      </span>
                    )}
                  </div>
                </div>

                {/* Explicação da Causa Raiz */}
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  <strong className="text-foreground font-medium">Diagnóstico de Mercado: </strong>
                  {item.rootCause}
                </p>

                {/* Caixa de Ação Recomendada */}
                <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-border/80 bg-background/50 p-2.5">
                  <div className="flex items-start gap-2 text-xs">
                    <Lightbulb className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                    <div>
                      <span className="font-semibold text-foreground">Ação Prescritiva: </span>
                      <span className="text-muted-foreground">{item.recommendation}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleAction(item)}
                    className="nodrag inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-all hover:bg-primary hover:text-primary-foreground shadow-xs"
                    title={item.action.hint}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    <span>{item.action.label}</span>
                  </button>
                </div>
              </motion.article>
            );
          })}
        </AnimatePresence>
      </div>
    </section>
  );
}

import { useState } from "react";
import {
  HeartHandshake,
  CreditCard,
  RotateCcw,
  QrCode,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  KanbanSquare,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/error-message";
import type { FunnelLive } from "@shared/funnel-live";

interface FunnelCxRadarProps {
  funnel: FunnelLive;
  projectId?: string | null;
  projectName?: string;
  className?: string;
}

function fmtBRL(val: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(val);
}

export function FunnelCxRadar({
  funnel,
  projectId,
  projectName = "Projeto",
  className,
}: FunnelCxRadarProps) {
  const cx = funnel.cx;
  const [expanded, setExpanded] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [dispatched, setDispatched] = useState(false);

  if (!cx) return null;

  const copyScript = (text: string, key: string, msg = "Script copiado!") => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(msg);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleDispatchCxTask = async () => {
    setDispatching(true);
    try {
      let firstColId: string | null = null;
      const { data: cols } = await supabase
        .from("imphq_kanban_columns")
        .select("id")
        .in("board", ["operacional", "geral"])
        .order("position", { ascending: true })
        .limit(1);
      if (cols && cols.length > 0) firstColId = cols[0].id;

      const { error } = await supabase.from("imphq_kanban_cards").insert({
        title: `[CX & PAGAMENTO] Blindar pós-checkout e reverter recusas (${projectName})`,
        description: [
          `🎯 **Projeto:** ${projectName}`,
          `💎 **CX Score:** ${cx.cxScore}/100 (${cx.cxStatus})`,
          `💳 **Valor Travado em Recusas/Pendentes:** ${fmtBRL(cx.valorRecusadoRecuperavel)} (${cx.recusadasCartaoCount} recusas de cartão · ${cx.pendentesCount} PIX pendentes)`,
          `↩️ **Taxa de Reembolso/Estorno:** ${cx.taxaReembolsoPct}% (${fmtBRL(cx.valorReembolsado)})`,
          "",
          "### Checklist CX & Reversão:",
          "[ ] Ativar disparo automático em 2 min para Cartão Recusado oferecendo PIX com R$ 10 de desconto",
          "[ ] Configurar mensagem de Boas-Vindas + Acesso Imediato no WhatsApp pós-aprovação (blindagem anti-reembolso 48h)",
          "[ ] Revisar descritor da fatura e suporte rápido no primeiro acesso",
        ].join("\n"),
        priority: cx.cxStatus === "critico" ? "urgent" : "high",
        project_id: projectId ?? null,
        board: "operacional",
        column_id: firstColId,
        ai_generated: true,
        tags: [projectId || "geral", "cx-pos-checkout", "anti-reembolso"],
      });

      if (error) throw error;
      setDispatched(true);
      toast.success("Tarefa de Blindagem CX enviada para o Kanban!");
    } catch (err) {
      toast.error("Erro ao criar card no Kanban: " + errorMessage(err));
    } finally {
      setDispatching(false);
    }
  };

  const statusTone =
    cx.cxStatus === "excelente"
      ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
      : cx.cxStatus === "atencao"
      ? "border-amber-500/30 text-amber-400 bg-amber-500/10"
      : "border-rose-500/40 text-rose-400 bg-rose-500/15";

  const pixFallbackScript = `Oi [Nome]! Vi aqui que a operadora do seu cartão bloqueou a tentativa por segurança automática no acesso ao ${projectName}. Pra você não perder o lote promocional, gerei um PIX direto com R$ 10 de desconto imediato e liberação no mesmo segundo: [LINK_PIX]`;
  const onboarding48hScript = `Parabéns pela decisão, [Nome]! Seu acesso ao ${projectName} já foi liberado no seu e-mail. Separei aqui o Passo #1 de 3 minutos para você já aplicar hoje e ter seu primeiro resultado ainda nas próximas 24h: [LINK_AULA_1]`;

  return (
    <Card className={cn("border border-border/70 bg-card/70 shadow-xs", className)}>
      <CardHeader className="p-3.5 pb-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-primary">
              <HeartHandshake className="h-3.5 w-3.5" />
            </span>
            <CardTitle className="text-xs sm:text-sm font-semibold text-foreground">
              Radar de CX · Jornada de Pagamento & Pós-Compra
            </CardTitle>
            <Badge variant="outline" className={cn("text-[10px] font-mono px-2 py-0", statusTone)}>
              CX Score: {cx.cxScore}/100
            </Badge>
            {cx.valorRecusadoRecuperavel > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] font-mono border-amber-500/40 bg-amber-500/10 text-amber-300"
              >
                💰 {fmtBRL(cx.valorRecusadoRecuperavel)} recuperável em Cartão ➔ PIX
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11px] text-muted-foreground hover:text-foreground px-2"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? (
                <>
                  Recolher CX <ChevronUp className="h-3.5 w-3.5 ml-1" />
                </>
              ) : (
                <>
                  Scripts Cartão ➔ PIX & Anti-Reembolso <ChevronDown className="h-3.5 w-3.5 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-3.5 pb-3.5 pt-0 space-y-3 text-xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-md border border-border/60 bg-background/50 p-2.5">
            <span className="text-[10px] font-mono uppercase text-muted-foreground flex items-center gap-1">
              <CreditCard className="h-3 w-3 text-amber-400" /> Fricção Checkout
            </span>
            <div className="font-mono font-bold text-sm text-foreground mt-0.5">
              {cx.taxaFriccaoPagamentoPct}%
            </div>
            <span className="text-[10px] text-muted-foreground">
              {cx.recusadasCartaoCount} recusas · {cx.pendentesCount} pendentes
            </span>
          </div>

          <div className="rounded-md border border-border/60 bg-background/50 p-2.5">
            <span className="text-[10px] font-mono uppercase text-muted-foreground flex items-center gap-1">
              <QrCode className="h-3 w-3 text-emerald-400" /> Resgate Cartão ➔ PIX
            </span>
            <div className="font-mono font-bold text-sm text-emerald-400 mt-0.5">
              {fmtBRL(cx.valorRecusadoRecuperavel)}
            </div>
            <span className="text-[10px] text-muted-foreground">
              Potencial bruto na mesa
            </span>
          </div>

          <div className="rounded-md border border-border/60 bg-background/50 p-2.5">
            <span className="text-[10px] font-mono uppercase text-muted-foreground flex items-center gap-1">
              <RotateCcw className="h-3 w-3 text-rose-400" /> Taxa Reembolso
            </span>
            <div
              className={cn(
                "font-mono font-bold text-sm mt-0.5",
                cx.taxaReembolsoPct > 5 ? "text-rose-400" : "text-foreground"
              )}
            >
              {cx.taxaReembolsoPct}%
            </div>
            <span className="text-[10px] text-muted-foreground">
              {cx.reembolsadasCount} estorno(s) ({fmtBRL(cx.valorReembolsado)})
            </span>
          </div>

          <div className="rounded-md border border-border/60 bg-background/50 p-2.5">
            <span className="text-[10px] font-mono uppercase text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-primary" /> Diagnóstico CX
            </span>
            <div className="text-[11px] text-foreground/90 font-medium mt-0.5 line-clamp-2" title={cx.recomendacaoCx}>
              {cx.recomendacaoCx}
            </div>
          </div>
        </div>

        {expanded && (
          <div className="pt-2 border-t border-border/50 space-y-2.5">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-background/60 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground text-[11px]">
                    ⚡ 1. Reversão Instantânea: Cartão Recusado ➔ PIX (2 min)
                  </span>
                  <button
                    type="button"
                    onClick={() => copyScript(pixFallbackScript, "cx-pix", "Script Cartão ➔ PIX copiado!")}
                    className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    {copiedKey === "cx-pix" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    Copiar
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground italic">{pixFallbackScript}</p>
              </div>

              <div className="rounded-lg border border-border bg-background/60 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground text-[11px]">
                    🛡️ 2. Blindagem Anti-Reembolso (Primeiras 48h)
                  </span>
                  <button
                    type="button"
                    onClick={() => copyScript(onboarding48hScript, "cx-48h", "Script Anti-Reembolso copiado!")}
                    className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    {copiedKey === "cx-48h" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    Copiar
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground italic">{onboarding48hScript}</p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                disabled={dispatching || dispatched}
                onClick={handleDispatchCxTask}
                className="h-7 text-xs gap-1.5"
              >
                {dispatching ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : dispatched ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <KanbanSquare className="h-3 w-3" />
                )}
                {dispatched ? "Blindagem CX no Kanban ✓" : "Despachar Blindagem CX para o Kanban"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

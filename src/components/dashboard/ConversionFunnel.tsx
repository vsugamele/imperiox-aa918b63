import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPeriodRange } from "@/lib/periodUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, TrendingUp, Eye } from "lucide-react";

interface Props {
  period: string;
  projectFilter: string;
  productFilter?: string;
}

interface FunnelStep {
  label: string;
  icon: string;
  count: number;
  events: string[];
}

export default function ConversionFunnel({ period, projectFilter, productFilter }: Props) {
  const [steps, setSteps] = useState<FunnelStep[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { from: since } = getPeriodRange(period);

      let query = supabase
        .from("imphq_webhooks")
        .select("evento")
        .gte("created_at", since);

      if (projectFilter && projectFilter !== "all") {
        query = query.eq("project_id", projectFilter);
      }

      const { data: webhooks } = await query;

      // Count by evento
      const counts: Record<string, number> = {};
      (webhooks || []).forEach((w: any) => {
        const ev = w.evento || "desconhecido";
        counts[ev] = (counts[ev] || 0) + 1;
      });

      // Build funnel steps
      const funnelSteps: FunnelStep[] = [
        {
          label: "Visualizações / Leads",
          icon: "👁️",
          count: (counts["lead_capturado"] || 0) + (counts["desconhecido"] || 0),
          events: ["lead_capturado", "desconhecido"],
        },
        {
          label: "Início Checkout",
          icon: "🛒",
          count: (counts["inicio_checkout"] || 0) + (counts["initiate_checkout"] || 0) + (counts["purchase_out_of_shopping_cart"] || 0),
          events: ["inicio_checkout", "initiate_checkout", "purchase_out_of_shopping_cart"],
        },
        {
          label: "PIX / Boleto Gerado",
          icon: "📱",
          count: (counts["pix_gerado"] || 0) + (counts["pix_created"] || 0) + (counts["aguardando_pagamento"] || 0) + (counts["purchase_billet_printed"] || 0) + (counts["boleto_gerado"] || 0),
          events: ["pix_gerado", "pix_created", "aguardando_pagamento", "boleto_gerado"],
        },
        {
          label: "Pagamento Aprovado",
          icon: "✅",
          count: counts["compra_aprovada"] || 0,
          events: ["compra_aprovada"],
        },
        {
          label: "Recusado / Expirado",
          icon: "❌",
          count: (counts["refused"] || 0) + (counts["pagamento_recusado"] || 0) + (counts["pix_expired"] || 0) + (counts["purchase_expired"] || 0) + (counts["pagamento_expirado"] || 0) + (counts["purchase_canceled"] || 0) + (counts["compra_cancelada"] || 0),
          events: ["refused", "pagamento_recusado", "pix_expired", "purchase_expired", "pagamento_expirado"],
        },
      ];

      setSteps(funnelSteps);
      setLoading(false);
    }
    load();
  }, [period, projectFilter, productFilter]);

  if (loading) return null;

  const maxCount = Math.max(...steps.map(s => s.count), 1);

  const convRate = (from: number, to: number) => {
    if (from === 0) return "—";
    return `${((to / from) * 100).toFixed(1)}%`;
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Funil de Conversão
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {steps.slice(0, 4).map((step, i) => {
            const widthPct = Math.max((step.count / maxCount) * 100, 8);
            const nextStep = steps[i + 1];
            const rate = nextStep && i < 3 ? convRate(step.count, nextStep.count) : null;

            return (
              <div key={step.label}>
                <div className="flex items-center gap-3">
                  <span className="text-lg w-7 text-center shrink-0">{step.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium truncate">{step.label}</span>
                      <span className="text-sm font-bold text-foreground">{step.count}</span>
                    </div>
                    <div className="h-6 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${widthPct}%`,
                          background: i === 0 ? "hsl(var(--primary) / 0.3)" : i === 1 ? "hsl(var(--primary) / 0.5)" : i === 2 ? "hsl(var(--primary) / 0.7)" : "hsl(var(--primary))",
                        }}
                      />
                    </div>
                  </div>
                </div>
                {rate && (
                  <div className="flex items-center gap-2 ml-10 my-1">
                    <ArrowDown className="h-3 w-3 text-muted-foreground" />
                    <Badge variant="outline" className={`text-[9px] ${
                      parseFloat(rate) >= 30 ? "text-emerald-400 border-emerald-400/30" :
                      parseFloat(rate) >= 10 ? "text-amber-400 border-amber-400/30" :
                      "text-destructive border-destructive/30"
                    }`}>
                      {rate} conversão
                    </Badge>
                  </div>
                )}
              </div>
            );
          })}

          {/* Lost leads section */}
          {steps[4] && steps[4].count > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-3">
                <span className="text-lg w-7 text-center shrink-0">{steps[4].icon}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-destructive">{steps[4].label}</span>
                    <span className="text-sm font-bold text-destructive">{steps[4].count}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {steps[2]?.count > 0
                      ? `${((steps[4].count / steps[2].count) * 100).toFixed(0)}% dos pagamentos pendentes foram perdidos`
                      : "Leads que não concluíram a compra"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

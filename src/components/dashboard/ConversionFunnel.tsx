import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPeriodRange } from "@/lib/periodUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, TrendingUp, Maximize2 } from "lucide-react";
import DashboardDrillSheet, { DrillMetric, FunnelStage } from "./DashboardDrillSheet";

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
  stage: FunnelStage;
}

export default function ConversionFunnel({ period, projectFilter, productFilter }: Props) {
  const [steps, setSteps] = useState<FunnelStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillStage, setDrillStage] = useState<FunnelStage | null>(null);

  const openStage = (stage: FunnelStage) => { setDrillStage(stage); setDrillOpen(true); };

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { from: since, to } = getPeriodRange(period);

      // 1) Leads count from imphq_leads
      let leadsQ = supabase.from("imphq_leads").select("id", { count: "exact", head: true })
        .gte("criado_em", since).lte("criado_em", to);
      if (projectFilter && projectFilter !== "all") leadsQ = leadsQ.eq("project_id", projectFilter);

      // 2) Sales data from imphq_vendas (much more complete than webhooks)
      let vendasQ = supabase.from("imphq_vendas").select("status, produto_nome")
        .gte("created_at", since).lte("created_at", to);
      if (projectFilter && projectFilter !== "all") vendasQ = vendasQ.eq("project_id", projectFilter);

      const [leadsRes, vendasRes] = await Promise.all([leadsQ, vendasQ]);

      const leadCount = leadsRes.count || 0;

      // Count vendas by status, applying product filter
      const vendas = (vendasRes.data || []) as any[];
      const statusCounts: Record<string, number> = {};
      vendas.forEach((v) => {
        if (productFilter && productFilter !== "all") {
          if (v.produto_nome && v.produto_nome.toLowerCase() !== productFilter.toLowerCase()) return;
        }
        const s = (v.status || "").toLowerCase();
        statusCounts[s] = (statusCounts[s] || 0) + 1;
      });

      const icStatuses = ["inicio_checkout", "pix_gerado", "boleto_gerado", "aguardando_pagamento", "pendente"];
      const pixStatuses = ["pix_gerado", "boleto_gerado", "aguardando_pagamento", "pendente"];
      const approvedStatuses = ["aprovado"];
      const lostStatuses = ["expirado", "cancelado", "recusado", "reembolsado", "chargedback"];

      const icCount = Object.entries(statusCounts)
        .filter(([s]) => icStatuses.includes(s) || approvedStatuses.includes(s) || lostStatuses.includes(s))
        .reduce((sum, [, c]) => sum + c, 0);

      const pixCount = Object.entries(statusCounts)
        .filter(([s]) => pixStatuses.includes(s) || approvedStatuses.includes(s) || lostStatuses.some(ls => s.includes(ls)))
        .reduce((sum, [, c]) => sum + c, 0);

      const approvedCount = Object.entries(statusCounts)
        .filter(([s]) => approvedStatuses.includes(s))
        .reduce((sum, [, c]) => sum + c, 0);

      const lostCount = Object.entries(statusCounts)
        .filter(([s]) => lostStatuses.some(ls => s.includes(ls)))
        .reduce((sum, [, c]) => sum + c, 0);

      const funnelSteps: FunnelStep[] = [
        { label: "Visualizações / Leads", icon: "👁️", count: leadCount, events: [], stage: "leads" },
        { label: "Início Checkout", icon: "🛒", count: icCount, events: [], stage: "checkout" },
        { label: "PIX / Boleto Gerado", icon: "📱", count: pixCount, events: [], stage: "pix" },
        { label: "Pagamento Aprovado", icon: "✅", count: approvedCount, events: [], stage: "approved" },
        { label: "Recusado / Expirado", icon: "❌", count: lostCount, events: [], stage: "lost" },
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

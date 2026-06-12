import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarCheck, Clock, Send, XCircle, FlaskConical } from "lucide-react";
import { toLocalDateStr } from "@/lib/periodUtils";

interface KPIData {
  agendados: number;
  proximoDisparo: string;
  enviadosHoje: number;
  cancelados: number;
  variantA: number;
  variantB: number;
}

const DEFAULT: KPIData = { agendados: 0, proximoDisparo: "—", enviadosHoje: 0, cancelados: 0, variantA: 0, variantB: 0 };

export default function CampaignKPICards() {
  const { data: kpi = DEFAULT } = useQuery({
    queryKey: ["wa-campaign-kpis", toLocalDateStr()],
    staleTime: 60_000,
    queryFn: async (): Promise<KPIData> => {
      const today = toLocalDateStr();

      const [agendadosRes, offsetRes, nextStepRes, enviadosRes, canceladosRes, variantBRes] = await Promise.all([
        supabase.from("imphq_wa_campaign_steps").select("id", { count: "exact", head: true }).eq("is_active", true).gte("send_date", today),
        supabase.from("imphq_wa_campaign_steps").select("id", { count: "exact", head: true }).eq("is_active", true).is("send_date", null),
        supabase.from("imphq_wa_campaign_steps").select("send_date, send_time").eq("is_active", true).gte("send_date", today).order("send_date", { ascending: true }).order("send_time", { ascending: true }).limit(1).maybeSingle(),
        supabase.from("imphq_wa_campaign_logs").select("id", { count: "exact", head: true }).eq("status", "sent").gte("created_at", `${today}T00:00:00`),
        supabase.from("imphq_wa_campaigns").select("id", { count: "exact", head: true }).eq("status", "cancelled"),
        supabase.from("imphq_wa_campaign_logs").select("id", { count: "exact", head: true }).eq("status", "sent").eq("error", "VARIANT_B").gte("created_at", `${today}T00:00:00`),
      ]);

      let proximoDisparo = "—";
      const nextStep = nextStepRes.data;
      if (nextStep?.send_date) {
        const time = nextStep.send_time?.slice(0, 5) || "09:00";
        proximoDisparo = `${nextStep.send_date.split("-").reverse().join("/")} ${time}`;
      }

      const totalSent = enviadosRes.count || 0;
      const vb = variantBRes.count || 0;

      return {
        agendados: (agendadosRes.count || 0) + (offsetRes.count || 0),
        proximoDisparo,
        enviadosHoje: totalSent,
        cancelados: canceladosRes.count || 0,
        variantA: Math.max(0, totalSent - vb),
        variantB: vb,
      };
    },
  });

  const hasABData = kpi.variantA + kpi.variantB > 0;

  const cards = [
    { label: "Agendados", value: kpi.agendados, icon: CalendarCheck, color: "text-blue-400" },
    { label: "Próximo Disparo", value: kpi.proximoDisparo, icon: Clock, color: "text-amber-400" },
    { label: "Enviados Hoje", value: kpi.enviadosHoje, icon: Send, color: "text-emerald-400" },
    { label: "Cancelados", value: kpi.cancelados, icon: XCircle, color: "text-destructive" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map(c => (
          <Card key={c.label} className="bg-card border-border">
            <CardContent className="p-3 flex items-center gap-3">
              <c.icon className={`h-5 w-5 ${c.color} shrink-0`} />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{c.label}</p>
                <p className="text-lg font-bold truncate">{c.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {hasABData && (
        <Card className="bg-card border-border">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <FlaskConical className="h-4 w-4 text-primary" />
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Teste A/B (hoje)</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold">Variante A</span>
                  <span className="text-muted-foreground">{kpi.variantA} envios</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${kpi.enviadosHoje ? (kpi.variantA / kpi.enviadosHoje) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold">Variante B</span>
                  <span className="text-muted-foreground">{kpi.variantB} envios</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${kpi.enviadosHoje ? (kpi.variantB / kpi.enviadosHoje) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

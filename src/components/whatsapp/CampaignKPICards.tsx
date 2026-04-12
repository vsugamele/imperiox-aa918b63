import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarCheck, Clock, Send, XCircle } from "lucide-react";

interface KPIData {
  agendados: number;
  proximoDisparo: string;
  enviadosHoje: number;
  cancelados: number;
}

export default function CampaignKPICards() {
  const [kpi, setKpi] = useState<KPIData>({ agendados: 0, proximoDisparo: "—", enviadosHoje: 0, cancelados: 0 });

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().slice(0, 10);

      // Agendados: active campaigns with future steps
      const { count: agendados } = await supabase
        .from("imphq_wa_campaign_steps")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .gte("send_date", today);

      // Also count steps with offset (no send_date) from active campaigns
      const { count: offsetSteps } = await supabase
        .from("imphq_wa_campaign_steps")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .is("send_date", null);

      // Próximo Disparo: next scheduled step
      const { data: nextStep } = await supabase
        .from("imphq_wa_campaign_steps")
        .select("send_date, send_time")
        .eq("is_active", true)
        .gte("send_date", today)
        .order("send_date", { ascending: true })
        .order("send_time", { ascending: true })
        .limit(1)
        .maybeSingle();

      let proximoDisparo = "—";
      if (nextStep?.send_date) {
        const time = nextStep.send_time?.slice(0, 5) || "09:00";
        proximoDisparo = `${nextStep.send_date.split("-").reverse().join("/")} ${time}`;
      }

      // Enviados Hoje: logs with status sent today
      const { count: enviadosHoje } = await supabase
        .from("imphq_wa_campaign_logs")
        .select("id", { count: "exact", head: true })
        .eq("status", "sent")
        .gte("created_at", `${today}T00:00:00`);

      // Cancelados: campaigns cancelled or inactive steps
      const { count: cancelados } = await supabase
        .from("imphq_wa_campaigns")
        .select("id", { count: "exact", head: true })
        .eq("status", "cancelled");

      setKpi({
        agendados: (agendados || 0) + (offsetSteps || 0),
        proximoDisparo,
        enviadosHoje: enviadosHoje || 0,
        cancelados: cancelados || 0,
      });
    };
    load();
  }, []);

  const cards = [
    { label: "Agendados", value: kpi.agendados, icon: CalendarCheck, color: "text-blue-400" },
    { label: "Próximo Disparo", value: kpi.proximoDisparo, icon: Clock, color: "text-amber-400" },
    { label: "Enviados Hoje", value: kpi.enviadosHoje, icon: Send, color: "text-emerald-400" },
    { label: "Cancelados", value: kpi.cancelados, icon: XCircle, color: "text-destructive" },
  ];

  return (
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
  );
}

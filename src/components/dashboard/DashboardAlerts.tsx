import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";
import { subDays } from "date-fns";

interface Props {
  period: string;
  projectFilter: string;
  productFilter?: string;
}

export default function DashboardAlerts({ period, projectFilter }: Props) {
  const [alerts, setAlerts] = useState<string[]>([]);

  useEffect(() => {
    async function load() {
      const alertList: string[] = [];
      const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();

      const [pixTodayRes, costsRes, revsRes, vendasRes, adsRes] = await Promise.all([
        supabase.from("imphq_leads").select("id", { count: "exact", head: true }).not("data->ultimo_evento", "is", null).neq("status", "cliente").gte("updated_at", todayStr),
        supabase.from("imphq_project_costs").select("valor, moeda, created_at"),
        supabase.from("imphq_project_revenue").select("valor, created_at"),
        supabase.from("imphq_vendas").select("valor, status, created_at").eq("status", "aprovado"),
        supabase.from("imphq_ads_spend").select("valor, data, leads"),
      ]);

      if ((pixTodayRes.count || 0) > 0) alertList.push(`💳 ${pixTodayRes.count} lead(s) geraram pix hoje e não compraram`);

      // Revenue vs Cost by month
      const monthMap: Record<string, { receita: number; custo: number; ads: number }> = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthMap[key] = { receita: 0, custo: 0, ads: 0 };
      }
      (revsRes.data || []).forEach((r: any) => { const m = r.created_at?.slice(0, 7); if (m && monthMap[m]) monthMap[m].receita += parseFloat(r.valor) || 0; });
      (vendasRes.data || []).forEach((v: any) => { const m = v.created_at?.slice(0, 7); if (m && monthMap[m]) monthMap[m].receita += parseFloat(v.valor) || 0; });
      (costsRes.data || []).forEach((c: any) => { const m = c.created_at?.slice(0, 7); const val = parseFloat(c.valor) || 0; if (m && monthMap[m]) monthMap[m].custo += c.moeda === "USD" ? val * 5.2 : val; });
      (adsRes.data || []).forEach((a: any) => { const m = a.data?.slice(0, 7); if (m && monthMap[m]) monthMap[m].ads += parseFloat(a.valor) || 0; });

      const monthKeys = Object.keys(monthMap);
      if (monthKeys.length >= 2) {
        const curr = monthMap[monthKeys[monthKeys.length - 1]];
        const prev = monthMap[monthKeys[monthKeys.length - 2]];
        const currTotal = curr.custo + curr.ads;
        const prevTotal = prev.custo + prev.ads;
        const currRoas = currTotal > 0 ? curr.receita / currTotal : 0;
        const prevRoas = prevTotal > 0 ? prev.receita / prevTotal : 0;
        if (prevRoas > 1 && currRoas < prevRoas * 0.7) alertList.push(`📉 ROAS caiu de ${prevRoas.toFixed(1)}x para ${currRoas.toFixed(1)}x este mês`);
        if (currRoas > 0 && currRoas < 1) alertList.push(`🚨 ROAS abaixo de 1x (${currRoas.toFixed(2)}x) — prejuízo em Ads`);
        if (prev.receita > 0 && curr.receita < prev.receita * 0.5) alertList.push(`📊 Receita caiu ${((1 - curr.receita / prev.receita) * 100).toFixed(0)}% vs mês anterior`);
        if (prev.receita > 0 && curr.receita > prev.receita * 1.3) alertList.push(`🚀 Receita subiu ${(((curr.receita / prev.receita) - 1) * 100).toFixed(0)}% vs mês anterior`);
      }

      // CPL alert
      const totalAdsSpend = (adsRes.data || []).reduce((s: number, a: any) => s + (parseFloat(a.valor) || 0), 0);
      const totalAdsLeads = (adsRes.data || []).reduce((s: number, a: any) => s + (a.leads || 0), 0);
      if (totalAdsLeads > 0 && totalAdsSpend / totalAdsLeads > 50) alertList.push(`💰 CPL médio alto: R$ ${(totalAdsSpend / totalAdsLeads).toFixed(2)} por lead`);

      setAlerts(alertList);
    }
    load();
  }, [period, projectFilter]);

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((a, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="text-sm text-amber-300">{a}</span>
        </div>
      ))}
    </div>
  );
}

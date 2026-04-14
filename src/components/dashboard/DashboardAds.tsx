import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Megaphone, Target, ShoppingCart, MousePointerClick } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { getPeriodRange } from "@/lib/periodUtils";

interface AdsGlobal {
  gasto: number;
  cpl: number;
  compras: number;
  topCampanhas: any[];
  adsByProject: any[];
  freqAlerts: string[];
}

interface Props {
  period: string;
  projectFilter: string;
  productFilter?: string;
  allProjects: any[];
}

export default function DashboardAds({ period, projectFilter, allProjects }: Props) {
  const [adsGlobal, setAdsGlobal] = useState<AdsGlobal>({ gasto: 0, cpl: 0, compras: 0, topCampanhas: [], adsByProject: [], freqAlerts: [] });

  useEffect(() => {
    async function load() {
      const { from } = getPeriodRange(period);
      const since = from.split("T")[0];
      const { data: adsRaw } = await supabase.from("imphq_ads_spend").select("*").gte("data_ref", since);
      const projMap = new Map((allProjects || []).map((p: any) => [p.id, p]));
      let items = (adsRaw || []) as any[];
      if (projectFilter !== "all") items = items.filter((a: any) => a.project_id === projectFilter);
      const gasto = items.reduce((s: number, a: any) => s + (parseFloat(a.valor) || 0), 0);
      const leads = items.reduce((s: number, a: any) => s + (a.leads || 0), 0);
      const compras = items.reduce((s: number, a: any) => s + (a.compras || 0), 0);

      // Top campanhas
      const campMap = new Map<string, { gasto: number; ctr: number; compras: number; count: number }>();
      items.forEach((a: any) => {
        const name = a.campanha || "Sem nome";
        const prev = campMap.get(name) || { gasto: 0, ctr: 0, compras: 0, count: 0 };
        campMap.set(name, { gasto: prev.gasto + (parseFloat(a.valor) || 0), ctr: prev.ctr + (parseFloat(a.ctr) || 0), compras: prev.compras + (a.compras || 0), count: prev.count + 1 });
      });
      const topCampanhas = Array.from(campMap.entries()).map(([name, v]) => ({ name, gasto: v.gasto, ctr: v.count > 0 ? v.ctr / v.count : 0, compras: v.compras })).sort((a, b) => b.gasto - a.gasto).slice(0, 5);

      // Ads by project
      const projAds = new Map<string, number>();
      items.forEach((a: any) => { projAds.set(a.project_id, (projAds.get(a.project_id) || 0) + (parseFloat(a.valor) || 0)); });
      const adsByProject = Array.from(projAds.entries()).map(([pid, val]) => {
        const p = projMap.get(pid);
        return { name: p ? `${p.icon || "📁"} ${p.name}` : pid?.slice(0, 8) || "?", value: val };
      }).sort((a, b) => b.value - a.value).slice(0, 5);

      // Frequency alerts
      const sevenAgo = subDays(new Date(), 7).toISOString().split("T")[0];
      const recentAds = items.filter((a: any) => a.data_ref >= sevenAgo);
      const freqAlerts: string[] = [];
      const freqCamp = new Map<string, { freq: number; count: number }>();
      recentAds.forEach((a: any) => {
        if (a.frequencia > 0 && a.campanha) {
          const prev = freqCamp.get(a.campanha) || { freq: 0, count: 0 };
          freqCamp.set(a.campanha, { freq: prev.freq + parseFloat(a.frequencia), count: prev.count + 1 });
        }
      });
      freqCamp.forEach((v, name) => {
        const avg = v.freq / v.count;
        if (avg > 3) freqAlerts.push(`⚠ "${name.slice(0, 40)}" com frequência alta (${avg.toFixed(1)}) — risco de saturação`);
      });

      setAdsGlobal({ gasto, cpl: leads > 0 ? gasto / leads : 0, compras, topCampanhas, adsByProject, freqAlerts });
    }
    load();
  }, [period, projectFilter, allProjects]);

  return (
    <>
      {/* Frequency Alerts */}
      {adsGlobal.freqAlerts.length > 0 && adsGlobal.freqAlerts.map((a, i) => (
        <div key={`freq-${i}`} className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
          <Megaphone className="h-4 w-4 text-orange-400 shrink-0" />
          <span className="text-sm text-orange-300">{a}</span>
        </div>
      ))}

      {/* Ads KPI Cards */}
      {adsGlobal.gasto > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[
            { label: "Gasto em Ads", value: `R$ ${adsGlobal.gasto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: Megaphone, color: "text-blue-400", bg: "from-blue-500/15 to-blue-500/5" },
            { label: "CPL Médio", value: `R$ ${adsGlobal.cpl.toFixed(2)}`, icon: Target, color: "text-violet-400", bg: "from-violet-500/15 to-violet-500/5" },
            { label: "Compras", value: String(adsGlobal.compras), icon: ShoppingCart, color: "text-emerald-400", bg: "from-emerald-500/15 to-emerald-500/5" },
            { label: "Campanhas Top", value: String(adsGlobal.topCampanhas.length), icon: MousePointerClick, color: "text-amber-400", bg: "from-amber-500/15 to-amber-500/5" },
          ].map((k) => (
            <Card key={k.label} className={`bg-gradient-to-br ${k.bg} border-border`}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`p-3 rounded-xl bg-background/50 ${k.color}`}><k.icon className="h-5 w-5" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className={`text-xl font-mono font-bold ${k.color}`}>{k.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Ads by Project + Top Campaigns */}
      {(adsGlobal.adsByProject.length > 0 || adsGlobal.topCampanhas.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {adsGlobal.adsByProject.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-blue-400" /> Gasto Ads por Projeto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={adsGlobal.adsByProject} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={100} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                    <Bar dataKey="value" fill="hsl(217, 91%, 60%)" radius={[0, 4, 4, 0]} name="Gasto" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {adsGlobal.topCampanhas.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <Target className="h-4 w-4 text-amber-400" /> Top Campanhas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {adsGlobal.topCampanhas.map((c: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/50">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-[10px] text-muted-foreground">CTR: {c.ctr.toFixed(2)}% · {c.compras} compras</p>
                    </div>
                    <span className="text-sm font-mono font-bold text-blue-400 shrink-0 ml-2">R$ {c.gasto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </>
  );
}

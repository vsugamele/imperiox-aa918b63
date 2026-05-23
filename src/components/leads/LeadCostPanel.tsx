import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { format, parseISO, isValid, eachDayOfInterval, startOfDay, endOfDay } from "date-fns";
import { TrendingUp, Users, DollarSign, Target } from "lucide-react";
import type { Lead } from "@/components/leads/LeadsTable";

interface AdsRow {
  data_ref?: string | null;
  valor?: any;
  plataforma?: string | null;
  campanha?: string | null;
}

interface Props {
  periodLeads: Lead[];
  periodAds: AdsRow[];
  periodRange: { from: Date; to: Date };
}

const ORGANIC_LABEL = "Orgânico/Direto";

function extractUtmSource(lead: Lead): string {
  const d: any = lead.data || {};
  const cands = [d.utms, d.tracking, d.checkout, d.checkout?.utms, d.tracking?.utms, d].filter(Boolean);
  for (const c of cands) {
    if (c.utm_source) return String(c.utm_source);
  }
  return (lead.plataforma || ORGANIC_LABEL).trim() || ORGANIC_LABEL;
}

function extractUtmCampaign(lead: Lead): string | null {
  const d: any = lead.data || {};
  const cands = [d.utms, d.tracking, d.checkout, d.checkout?.utms, d.tracking?.utms, d].filter(Boolean);
  for (const c of cands) {
    if (c.utm_campaign) return String(c.utm_campaign);
  }
  return null;
}

function brl(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function normalizePlatform(s: string): string {
  const t = (s || "").toLowerCase();
  if (t.includes("face") || t.includes("meta") || t.includes("ig") || t.includes("insta") || t === "fb") return "Meta";
  if (t.includes("google") || t.includes("gads") || t.includes("adwords")) return "Google";
  if (t.includes("tiktok") || t === "tt") return "TikTok";
  if (t.includes("kwai")) return "Kwai";
  if (t.includes("youtube") || t === "yt") return "YouTube";
  if (!s) return ORGANIC_LABEL;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function LeadCostPanel({ periodLeads, periodAds, periodRange }: Props) {
  const totals = useMemo(() => {
    const leads = periodLeads.length;
    const spend = periodAds.reduce((s, a) => s + (parseFloat(a.valor) || 0), 0);
    const cpl = leads > 0 && spend > 0 ? spend / leads : null;
    return { leads, spend, cpl };
  }, [periodLeads, periodAds]);

  const byPlatform = useMemo(() => {
    const leadsMap = new Map<string, number>();
    periodLeads.forEach(l => {
      const key = normalizePlatform(extractUtmSource(l));
      leadsMap.set(key, (leadsMap.get(key) || 0) + 1);
    });
    const spendMap = new Map<string, number>();
    periodAds.forEach(a => {
      const key = normalizePlatform(a.plataforma || "");
      spendMap.set(key, (spendMap.get(key) || 0) + (parseFloat(a.valor) || 0));
    });
    const keys = new Set<string>([...leadsMap.keys(), ...spendMap.keys()]);
    return Array.from(keys).map(k => {
      const leads = leadsMap.get(k) || 0;
      const spend = spendMap.get(k) || 0;
      const cpl = leads > 0 && spend > 0 ? spend / leads : null;
      const pctSpend = totals.spend > 0 ? (spend / totals.spend) * 100 : 0;
      return { platform: k, leads, spend, cpl, pctSpend };
    }).sort((a, b) => b.spend - a.spend || b.leads - a.leads);
  }, [periodLeads, periodAds, totals.spend]);

  const byCampaign = useMemo(() => {
    const spendMap = new Map<string, { spend: number; platform: string }>();
    periodAds.forEach(a => {
      const name = (a.campanha || "").trim();
      if (!name) return;
      const cur = spendMap.get(name) || { spend: 0, platform: normalizePlatform(a.plataforma || "") };
      cur.spend += parseFloat(a.valor) || 0;
      spendMap.set(name, cur);
    });
    const leadsMap = new Map<string, number>();
    periodLeads.forEach(l => {
      const c = extractUtmCampaign(l);
      if (!c) return;
      leadsMap.set(c, (leadsMap.get(c) || 0) + 1);
    });
    return Array.from(spendMap.entries()).map(([name, v]) => {
      const leads = leadsMap.get(name) || 0;
      const cpl = leads > 0 && v.spend > 0 ? v.spend / leads : null;
      return { name, platform: v.platform, leads, spend: v.spend, cpl };
    }).sort((a, b) => b.spend - a.spend).slice(0, 10);
  }, [periodLeads, periodAds]);

  const sparkline = useMemo(() => {
    const days = eachDayOfInterval({ start: startOfDay(periodRange.from), end: endOfDay(periodRange.to) });
    const map = new Map<string, { leads: number; spend: number }>();
    days.forEach(d => map.set(format(d, "yyyy-MM-dd"), { leads: 0, spend: 0 }));
    periodLeads.forEach(l => {
      if (!l.criado_em) return;
      try {
        const d = parseISO(l.criado_em);
        if (!isValid(d)) return;
        const k = format(d, "yyyy-MM-dd");
        const e = map.get(k); if (e) e.leads += 1;
      } catch {}
    });
    periodAds.forEach(a => {
      if (!a.data_ref) return;
      try {
        const d = parseISO(a.data_ref);
        if (!isValid(d)) return;
        const k = format(d, "yyyy-MM-dd");
        const e = map.get(k); if (e) e.spend += parseFloat(a.valor) || 0;
      } catch {}
    });
    return Array.from(map.entries()).map(([key, v]) => ({
      day: format(parseISO(key), "dd/MM"),
      leads: v.leads,
      spend: Math.round(v.spend),
      cpl: v.leads > 0 && v.spend > 0 ? Math.round((v.spend / v.leads) * 100) / 100 : null,
    }));
  }, [periodLeads, periodAds, periodRange]);

  const hasAds = periodAds.length > 0;

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Users className="h-3 w-3" /> Leads no período</p>
            <p className="text-2xl font-bold tabular-nums">{totals.leads.toLocaleString("pt-BR")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><DollarSign className="h-3 w-3" /> Gasto em ads</p>
            <p className="text-2xl font-bold tabular-nums">{brl(totals.spend)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Target className="h-3 w-3" /> CPL médio</p>
            <p className="text-2xl font-bold tabular-nums text-primary">{totals.cpl !== null ? brl(totals.cpl) : "—"}</p>
            <p className="text-[10px] text-muted-foreground">gasto ÷ leads</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><TrendingUp className="h-3 w-3" /> Plataformas pagas</p>
            <p className="text-2xl font-bold tabular-nums">{byPlatform.filter(p => p.spend > 0).length}</p>
          </CardContent>
        </Card>
      </div>

      {!hasAds && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground space-y-2">
            <p>Nenhum gasto de ads importado para este período.</p>
            <p className="text-xs">Importe planilhas ou conecte uma conta em <a href="/financas" className="text-primary hover:underline">Finanças → Ads</a> para ver o CPL real.</p>
          </CardContent>
        </Card>
      )}

      {/* By platform */}
      {hasAds && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg">Por plataforma</h3>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">UTM source × ads</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="text-left py-2">Plataforma</th>
                    <th className="text-right py-2">Leads</th>
                    <th className="text-right py-2">Gasto</th>
                    <th className="text-right py-2">CPL</th>
                    <th className="text-right py-2">% gasto</th>
                  </tr>
                </thead>
                <tbody>
                  {byPlatform.map(p => (
                    <tr key={p.platform} className="border-b border-border/40 last:border-0">
                      <td className="py-2 font-medium">{p.platform}</td>
                      <td className="py-2 text-right tabular-nums">{p.leads.toLocaleString("pt-BR")}</td>
                      <td className="py-2 text-right tabular-nums">{p.spend > 0 ? brl(p.spend) : "—"}</td>
                      <td className="py-2 text-right tabular-nums font-medium text-primary">{p.cpl !== null ? brl(p.cpl) : "—"}</td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">{p.pctSpend > 0 ? `${p.pctSpend.toFixed(1)}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top campaigns */}
      {byCampaign.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg">Top campanhas por gasto</h3>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Top 10</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="text-left py-2">Campanha</th>
                    <th className="text-left py-2">Plataforma</th>
                    <th className="text-right py-2">Leads</th>
                    <th className="text-right py-2">Gasto</th>
                    <th className="text-right py-2">CPL</th>
                  </tr>
                </thead>
                <tbody>
                  {byCampaign.map(c => (
                    <tr key={c.name} className="border-b border-border/40 last:border-0">
                      <td className="py-2 font-mono text-xs max-w-[320px] truncate" title={c.name}>{c.name}</td>
                      <td className="py-2"><Badge variant="outline" className="text-[10px]">{c.platform}</Badge></td>
                      <td className="py-2 text-right tabular-nums">{c.leads.toLocaleString("pt-BR")}</td>
                      <td className="py-2 text-right tabular-nums">{brl(c.spend)}</td>
                      <td className="py-2 text-right tabular-nums font-medium text-primary">{c.cpl !== null ? brl(c.cpl) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10px] text-muted-foreground mt-2">CPL por campanha exige <code>utm_campaign</code> idêntico ao nome da campanha no ads.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sparkline */}
      {hasAds && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-display text-lg">Evolução diária</h3>
            <ChartContainer config={{ leads: { label: "Leads", color: "hsl(var(--primary))" }, spend: { label: "Gasto", color: "#ef4444" }, cpl: { label: "CPL", color: "#f59e0b" } }} className="h-[240px] w-full">
              <LineChart data={sparkline} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="day" fontSize={10} />
                <YAxis yAxisId="left" fontSize={10} />
                <YAxis yAxisId="right" orientation="right" fontSize={10} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line yAxisId="left" type="monotone" dataKey="leads" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="spend" stroke="#ef4444" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="cpl" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

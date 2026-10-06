import type { Tables } from "@/integrations/supabase/types";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { paginatedQuery } from "@/lib/paginated-query";
import { Loader2, Radio, ShoppingBag, Sparkles } from "lucide-react";

type Channel = "whatsapp" | "ads" | "organic" | "unknown";
interface Row { venda_id:string; project_id:string|null; data_venda:string|null; produto_nome:string|null; tipo_venda:string|null; valor_liquido:number|null; currency:string; canal_atribuido:Channel; utm_campaign:string|null; utm_source:string|null; wa_template:string|null; wa_source:string|null; attribution_confidence:string; attribution_method:string; }

const CHANNEL_LABEL: Record<Row["canal_atribuido"], { label: string; color: string }> = {
  whatsapp: { label: "WhatsApp", color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  ads:      { label: "Ads",      color: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  organic: { label: "Orgânico", color: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
  unknown:  { label: "Sem atribuição", color: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
};

export default function Atribuicao() {
  const [days, setDays] = useState("30");
  const [currency, setCurrency] = useState("__auto__");
  const [project, setProject] = useState<string>("__all__");

  const { data: projects = [] } = useQuery({
    queryKey: ["atrib-projects"],
    queryFn: async () => {
      const { data } = await supabase.from("imphq_projects").select("id, name").order("name");
      return data ?? [];
    },
  });

  const { data: rawData, isLoading, error: loadError } = useQuery({
    queryKey: ["attribution", days, project],
    queryFn: async () => {
      const since = new Date(Date.now() - Number(days) * 86400000).toISOString();
      const rows = await paginatedQuery("Atribuição", (from,to) => {
        let q = supabase.from("imphq_tracker_sales").select("*").gte("data_venda",since)
          .lte("data_venda",new Date().toISOString()).in("status",["aprovado","aprovada","paga","approved","paid"])
          .order("data_venda",{ascending:false}).order("id").range(from,to);
        if(project!=="__all__") q=q.eq("project_id",project);
        return q;
      });
      return rows.filter(r => r.utm_source !== "codex-validation" && !(r.data && typeof r.data === "object" && !Array.isArray(r.data) && r.data.validation === true))
        .map((r):Row => ({...r,venda_id:r.id,canal_atribuido:r.attributed_channel === "whatsapp" ? "whatsapp" : r.attributed_channel === "ads" ? "ads" : r.attributed_channel === "organic" ? "organic" : "unknown",wa_template:r.wa_template,wa_source:r.wa_source}));
    },
  });

  const currencies = [...new Set((rawData ?? []).map(r=>r.currency))].sort();
  const currencyFilter = currency === "__auto__" ? (currencies.length===1 ? currencies[0] : null) : currency;
  const selectedCurrency = currencyFilter === "UNKNOWN" ? null : currencyFilter;
  const data = (rawData ?? []).filter(r=>currencyFilter===null || r.currency===currencyFilter);
  const missingNet = data.filter(r=>r.valor_liquido===null).length;
  const totals = useMemo(() => {
    const acc = { whatsapp: 0, ads: 0, organic: 0, unknown: 0, total: 0, count: { whatsapp: 0, ads: 0, organic: 0, unknown: 0 } as Record<string, number> };
    (data ?? []).forEach((r) => {
      const v = Number(r.valor_liquido ?? 0);
      acc[r.canal_atribuido] += v;
      acc.total += v;
      acc.count[r.canal_atribuido]++;
    });
    return acc;
  }, [data]);

  const byCampaign = useMemo(() => {
    const map = new Map<string, { key: string; revenue: number; sales: number; canal: string }>();
    (data ?? []).forEach((r) => {
      const key =
        r.canal_atribuido === "whatsapp"
          ? `WA · ${r.wa_template || r.wa_source || "direto"}`
          : r.utm_campaign || r.utm_source || "(sem utm)";
      const cur = map.get(key) ?? { key, revenue: 0, sales: 0, canal: r.canal_atribuido };
      cur.revenue += Number(r.valor_liquido ?? 0);
      cur.sales++;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 15);
  }, [data]);

  // Matriz Canal × Etapa do funil (principal / orderbump / upsell / downsell)
  const byStage = useMemo(() => {
    const stages = ["principal", "orderbump", "upsell", "downsell", "outros"] as const;
    type Stage = typeof stages[number];
    const matrix: Record<Stage, { whatsapp: number; ads: number; organic: number; unknown: number; count: number }> = {
      principal: { whatsapp: 0, ads: 0, organic: 0, unknown: 0, count: 0 },
      orderbump: { whatsapp: 0, ads: 0, organic: 0, unknown: 0, count: 0 },
      upsell: { whatsapp: 0, ads: 0, organic: 0, unknown: 0, count: 0 },
      downsell: { whatsapp: 0, ads: 0, organic: 0, unknown: 0, count: 0 },
      outros: { whatsapp: 0, ads: 0, organic: 0, unknown: 0, count: 0 },
    };
    (data ?? []).forEach((r) => {
      const t = (r.tipo_venda || "").toLowerCase();
      const stage: Stage = stages.includes(t as Stage) ? (t as Stage) : "outros";
      const v = Number(r.valor_liquido ?? 0);
      matrix[stage][r.canal_atribuido] += v;
      matrix[stage].count++;
    });
    return stages.map(s => ({ stage: s, ...matrix[s], total: matrix[s].whatsapp + matrix[s].ads + matrix[s].organic + matrix[s].unknown }));
  }, [data]);

  const fmt = (n:number, rowCurrency?:string) => rowCurrency === "UNKNOWN" || !rowCurrency && (!selectedCurrency || missingNet>0) ? "Indisponível" : (rowCurrency || selectedCurrency) + " " + n.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-cormorant text-foreground">Atribuição Cross-Channel</h1>
          <p className="text-sm text-muted-foreground mt-1">
            De onde veio cada venda — WhatsApp, Ads ou Sem atribuição.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={currency} onValueChange={setCurrency}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__auto__">Moedas separadas</SelectItem>{currencies.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
          <Select value={project} onValueChange={setProject}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Projeto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os projetos</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loadError ? <p role="alert" className="text-destructive">Atribuição indisponível. Não foi possível consultar as vendas.</p> : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ChannelCard icon={<Radio className="size-4" />} label="WhatsApp" value={totals.whatsapp} count={totals.count.whatsapp} total={totals.total} currency={selectedCurrency} incomplete={missingNet>0} color="emerald" />
            <ChannelCard icon={<ShoppingBag className="size-4" />} label="Ads (pago)" value={totals.ads} count={totals.count.ads} total={totals.total} currency={selectedCurrency} incomplete={missingNet>0} color="sky" />
            <ChannelCard icon={<Sparkles className="size-4" />} label="Sem atribuição" value={totals.unknown} count={totals.count.unknown} total={totals.total} currency={selectedCurrency} incomplete={missingNet>0} color="amber" />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-lg">Por etapa do funil × canal</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Etapa</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-right text-emerald-300">WhatsApp</TableHead>
                    <TableHead className="text-right text-sky-300">Ads</TableHead>
                    <TableHead className="text-right text-violet-300">Orgânico</TableHead>
                    <TableHead className="text-right text-amber-300">Sem atribuição</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byStage.filter(s => s.count > 0).map((s) => (
                    <TableRow key={s.stage}>
                      <TableCell className="capitalize font-medium">{s.stage}</TableCell>
                      <TableCell className="text-right">{s.count}</TableCell>
                      <TableCell className="text-right">{fmt(s.whatsapp)}</TableCell>
                      <TableCell className="text-right">{fmt(s.ads)}</TableCell>
                      <TableCell className="text-right">{fmt(s.organic)}</TableCell>
                      <TableCell className="text-right">{fmt(s.unknown)}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(s.total)}</TableCell>
                    </TableRow>
                  ))}
                  {byStage.every(s => s.count === 0) && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Sem vendas no período.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Top campanhas / origens</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Origem</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byCampaign.map((c) => (
                    <TableRow key={c.key}>
                      <TableCell className="font-mono text-xs">{c.key}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={CHANNEL_LABEL[c.canal as Row["canal_atribuido"]].color}>
                          {CHANNEL_LABEL[c.canal as Row["canal_atribuido"]].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{c.sales}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(c.revenue)}</TableCell>
                    </TableRow>
                  ))}
                  {byCampaign.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Sem vendas no período.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Vendas recentes</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Confiança / método</TableHead>
                    <TableHead>Detalhe</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data ?? []).slice(0, 50).map((r) => (
                    <TableRow key={r.venda_id}>
                      <TableCell className="text-xs">{r.data_venda ? new Date(r.data_venda).toLocaleDateString("pt-BR") : "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.produto_nome || "—"}</TableCell>
                      <TableCell><Badge variant="secondary">{r.tipo_venda || "—"}</Badge></TableCell>
                      <TableCell>
                        <Badge variant="outline" className={CHANNEL_LABEL[r.canal_atribuido].color}>
                          {CHANNEL_LABEL[r.canal_atribuido].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{r.attribution_confidence === "confirmed" ? "Confirmada" : r.attribution_confidence === "inferred" ? "Inferida" : "Desconhecida"} · {r.attribution_method}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate">
                        {r.canal_atribuido === "whatsapp"
                          ? (r.wa_template || r.wa_source || "—")
                          : (r.utm_campaign || r.utm_source || "—")}
                      </TableCell>
                      <TableCell className="text-right">{r.valor_liquido === null ? "Indisponível" : fmt(Number(r.valor_liquido),r.currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function ChannelCard({ icon, label, value, count, total, color, currency, incomplete }: { icon: React.ReactNode; label: string; value: number; count: number; total: number; color: string; currency:string|null; incomplete:boolean }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          {icon}{label}
        </div>
        <div className="mt-2 text-2xl font-cormorant text-foreground">
          {!currency || incomplete ? "Indisponível" : currency + " " + value.toLocaleString("pt-BR", {minimumFractionDigits:2,maximumFractionDigits:2})}
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>{count} vendas</span>
          <span className={`text-${color}-400`}>{currency && !incomplete ? pct.toFixed(1) + "%" : "—"}</span>
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-secondary/40 overflow-hidden">
          <div className={`h-full bg-${color}-500/70`} style={{ width: `${pct}%` }} />
        </div>
      </CardContent>
    </Card>
  );
}

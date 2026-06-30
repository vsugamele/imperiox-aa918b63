import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Radio, ShoppingBag, Sparkles } from "lucide-react";

type Row = {
  venda_id: string;
  project_id: string | null;
  produto_nome: string | null;
  valor: number | null;
  valor_liquido: number | null;
  tipo_venda: string | null;
  data_venda: string | null;
  canal_atribuido: "whatsapp" | "ads" | "organic";
  wa_source: string | null;
  wa_template: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
};

const CHANNEL_LABEL: Record<Row["canal_atribuido"], { label: string; color: string }> = {
  whatsapp: { label: "WhatsApp", color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  ads:      { label: "Ads",      color: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  organic:  { label: "Orgânico", color: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
};

export default function Atribuicao() {
  const [days, setDays] = useState("30");
  const [project, setProject] = useState<string>("__all__");

  const { data: projects = [] } = useQuery({
    queryKey: ["atrib-projects"],
    queryFn: async () => {
      const { data } = await supabase.from("imphq_projects").select("id, nome").order("nome");
      return data ?? [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["attribution", days, project],
    queryFn: async () => {
      const since = new Date(Date.now() - Number(days) * 86400000).toISOString();
      let q = supabase
        .from("vw_attribution_unified" as any)
        .select("*")
        .gte("data_venda", since)
        .order("data_venda", { ascending: false })
        .limit(500);
      if (project !== "__all__") q = q.eq("project_id", project);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const totals = useMemo(() => {
    const acc = { whatsapp: 0, ads: 0, organic: 0, total: 0, count: { whatsapp: 0, ads: 0, organic: 0 } as Record<string, number> };
    (data ?? []).forEach((r) => {
      const v = Number(r.valor_liquido ?? r.valor ?? 0);
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
      cur.revenue += Number(r.valor_liquido ?? r.valor ?? 0);
      cur.sales++;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 15);
  }, [data]);

  // Matriz Canal × Etapa do funil (principal / orderbump / upsell / downsell)
  const byStage = useMemo(() => {
    const stages = ["principal", "orderbump", "upsell", "downsell", "outros"] as const;
    type Stage = typeof stages[number];
    const matrix: Record<Stage, { whatsapp: number; ads: number; organic: number; count: number }> = {
      principal: { whatsapp: 0, ads: 0, organic: 0, count: 0 },
      orderbump: { whatsapp: 0, ads: 0, organic: 0, count: 0 },
      upsell: { whatsapp: 0, ads: 0, organic: 0, count: 0 },
      downsell: { whatsapp: 0, ads: 0, organic: 0, count: 0 },
      outros: { whatsapp: 0, ads: 0, organic: 0, count: 0 },
    };
    (data ?? []).forEach((r) => {
      const t = (r.tipo_venda || "").toLowerCase();
      const stage: Stage = stages.includes(t as Stage) ? (t as Stage) : "outros";
      const v = Number(r.valor_liquido ?? r.valor ?? 0);
      matrix[stage][r.canal_atribuido] += v;
      matrix[stage].count++;
    });
    return stages.map(s => ({ stage: s, ...matrix[s], total: matrix[s].whatsapp + matrix[s].ads + matrix[s].organic }));
  }, [data]);

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-cormorant text-foreground">Atribuição Cross-Channel</h1>
          <p className="text-sm text-muted-foreground mt-1">
            De onde veio cada venda — WhatsApp, Ads ou Orgânico.
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={project} onValueChange={setProject}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Projeto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os projetos</SelectItem>
              {projects.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
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

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ChannelCard icon={<Radio className="size-4" />} label="WhatsApp" value={totals.whatsapp} count={totals.count.whatsapp} total={totals.total} color="emerald" />
            <ChannelCard icon={<ShoppingBag className="size-4" />} label="Ads (pago)" value={totals.ads} count={totals.count.ads} total={totals.total} color="sky" />
            <ChannelCard icon={<Sparkles className="size-4" />} label="Orgânico" value={totals.organic} count={totals.count.organic} total={totals.total} color="amber" />
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
                    <TableHead className="text-right text-amber-300">Orgânico</TableHead>
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
                      <TableCell className="text-right font-semibold">{fmt(s.total)}</TableCell>
                    </TableRow>
                  ))}
                  {byStage.every(s => s.count === 0) && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Sem vendas no período.</TableCell></TableRow>
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
                      <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate">
                        {r.canal_atribuido === "whatsapp"
                          ? (r.wa_template || r.wa_source || "—")
                          : (r.utm_campaign || r.utm_source || "—")}
                      </TableCell>
                      <TableCell className="text-right">{fmt(Number(r.valor_liquido ?? r.valor ?? 0))}</TableCell>
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

function ChannelCard({ icon, label, value, count, total, color }: { icon: React.ReactNode; label: string; value: number; count: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          {icon}{label}
        </div>
        <div className="mt-2 text-2xl font-cormorant text-foreground">
          {value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>{count} vendas</span>
          <span className={`text-${color}-400`}>{pct.toFixed(1)}%</span>
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-secondary/40 overflow-hidden">
          <div className={`h-full bg-${color}-500/70`} style={{ width: `${pct}%` }} />
        </div>
      </CardContent>
    </Card>
  );
}

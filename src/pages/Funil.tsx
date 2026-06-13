import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProjectList } from "@/hooks/useProjectList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, MessageSquare, MousePointerClick, CreditCard, CheckCircle2,
  TrendingDown, RefreshCw, Target, ArrowRight, Sparkles, Trophy, Link2
} from "lucide-react";
import { toast } from "sonner";

type FunnelStage = {
  label: string;
  count: number;
  icon: any;
  color: string;
  description: string;
};

type SourceBreakdown = {
  source: string;
  links_enviados: number;
  links_clicados: number;
  vendas_geradas: number;
  vendas_aprovadas: number;
};

type AttributionRow = {
  id: string;
  attribution_id: string;
  source: string;
  source_detail: string | null;
  template_name: string | null;
  produto_nome: string | null;
  phone: string | null;
  sent_at: string;
  clicked_at: string | null;
  venda_status: string | null;
  matched_at: string | null;
};

export default function Funil() {
  const { data: projects = [] } = useProjectList();
  const [projectId, setProjectId] = useState<string>("");
  const [days, setDays] = useState<number>(30);
  const [loading, setLoading] = useState(true);

  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [sourceBreakdown, setSourceBreakdown] = useState<SourceBreakdown[]>([]);
  const [recentMatches, setRecentMatches] = useState<AttributionRow[]>([]);
  const [topTemplates, setTopTemplates] = useState<{ template: string; sent: number; sales: number; rate: number }[]>([]);
  const [revenue, setRevenue] = useState<{ total: number; ticket: number; count: number }>({ total: 0, ticket: 0, count: 0 });


  useEffect(() => {
    if (!projectId && projects.length > 0) setProjectId(projects[0].id);
  }, [projects, projectId]);

  const reload = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

      // Leads totais
      const { count: leadsCount } = await supabase
        .from("imphq_leads")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId)
        .gte("created_at", since);

      // Engajados: conversas com 1+ msg incoming
      const { count: engajadosCount } = await supabase
        .from("imphq_wa_conversations")
        .select("*", { count: "exact", head: true })
        .eq("project_id", projectId)
        .gte("last_message_at", since)
        .gte("message_count", 2);

      // Atribuições: enviados / clicados / vendas / aprovados
      const { data: attrs } = await supabase
        .from("imphq_wa_attribution")
        .select("source, clicked_at, venda_id, venda_status")
        .eq("project_id", projectId)
        .gte("sent_at", since);

      const linksEnviados = (attrs || []).length;
      const linksClicados = (attrs || []).filter((a: any) => a.clicked_at).length;
      const vendasGeradas = (attrs || []).filter((a: any) => a.venda_id).length;
      const vendasAprovadas = (attrs || []).filter((a: any) => a.venda_status === "aprovado").length;

      // Receita real via venda_ids atribuídos a esse funil
      const vendaIds = Array.from(new Set((attrs || []).filter((a: any) => a.venda_id).map((a: any) => a.venda_id)));
      let totalRev = 0; let countRev = 0;
      if (vendaIds.length > 0) {
        const { data: vendas } = await supabase
          .from("imphq_vendas")
          .select("id, valor, valor_liquido, status")
          .in("id", vendaIds);
        for (const v of (vendas || []) as any[]) {
          if ((v.status || "").toLowerCase() === "aprovado") {
            totalRev += Number(v.valor_liquido ?? v.valor) || 0;
            countRev++;
          }
        }
      }
      setRevenue({ total: totalRev, ticket: countRev > 0 ? totalRev / countRev : 0, count: countRev });


      setStages([
        { label: "Leads capturados", count: leadsCount || 0, icon: Users, color: "blue", description: "Entraram no sistema" },
        { label: "Engajados", count: engajadosCount || 0, icon: MessageSquare, color: "cyan", description: "Responderam ao menos 1 vez" },
        { label: "Links enviados", count: linksEnviados, icon: ArrowRight, color: "indigo", description: "Receberam link de checkout" },
        { label: "Cliques no link", count: linksClicados, icon: MousePointerClick, color: "purple", description: "Abriram o checkout" },
        { label: "Pagamento gerado", count: vendasGeradas, icon: CreditCard, color: "amber", description: "Pix/boleto/cartão" },
        { label: "Vendas aprovadas", count: vendasAprovadas, icon: CheckCircle2, color: "emerald", description: "Pagamento confirmado" },
      ]);

      // Breakdown por source
      const { data: funnelView } = await supabase
        .from("imphq_wa_funnel_daily")
        .select("source, links_enviados, links_clicados, vendas_geradas, vendas_aprovadas")
        .eq("project_id", projectId)
        .gte("day", since);

      const agg = new Map<string, SourceBreakdown>();
      for (const r of (funnelView || []) as any[]) {
        const cur = agg.get(r.source) || { source: r.source, links_enviados: 0, links_clicados: 0, vendas_geradas: 0, vendas_aprovadas: 0 };
        cur.links_enviados += Number(r.links_enviados) || 0;
        cur.links_clicados += Number(r.links_clicados) || 0;
        cur.vendas_geradas += Number(r.vendas_geradas) || 0;
        cur.vendas_aprovadas += Number(r.vendas_aprovadas) || 0;
        agg.set(r.source, cur);
      }
      setSourceBreakdown(Array.from(agg.values()).sort((a, b) => b.vendas_aprovadas - a.vendas_aprovadas));

      // Templates mais usados
      const { data: templates } = await supabase
        .from("imphq_wa_attribution")
        .select("template_name, venda_status")
        .eq("project_id", projectId)
        .gte("sent_at", since)
        .not("template_name", "is", null);

      const tplMap = new Map<string, { sent: number; sales: number }>();
      for (const r of (templates || []) as any[]) {
        const cur = tplMap.get(r.template_name) || { sent: 0, sales: 0 };
        cur.sent++;
        if (r.venda_status === "aprovado") cur.sales++;
        tplMap.set(r.template_name, cur);
      }
      const tplList = Array.from(tplMap.entries())
        .map(([template, v]) => ({ template, sent: v.sent, sales: v.sales, rate: v.sent > 0 ? Math.round((v.sales / v.sent) * 1000) / 10 : 0 }))
        .sort((a, b) => b.rate - a.rate)
        .slice(0, 10);
      setTopTemplates(tplList);

      // Últimas vendas atribuídas
      const { data: recent } = await supabase
        .from("imphq_wa_attribution")
        .select("*")
        .eq("project_id", projectId)
        .not("matched_at", "is", null)
        .order("matched_at", { ascending: false })
        .limit(15);
      setRecentMatches((recent || []) as AttributionRow[]);
    } catch (e: any) {
      console.error("[funil] erro:", e);
      toast.error("Erro: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) reload();
  }, [projectId, days]);

  const totalLeads = stages[0]?.count || 0;
  const totalSales = stages[5]?.count || 0;
  const conversionRate = totalLeads > 0 ? ((totalSales / totalLeads) * 100).toFixed(2) : "0.00";
  const maxCount = Math.max(...stages.map(s => s.count), 1);

  const projectName = projects.find(p => p.id === projectId)?.name || projectId;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6 text-indigo-400" />
            Funil de Conversão
            <span className="text-sm font-normal text-muted-foreground ml-2">{projectName}</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            Lead → Engajado → Link enviado → Click → Pagamento → Aprovado. Atribuição por origem (qual disparador converteu).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={projectId} onChange={e => setProjectId(e.target.value)} className="text-xs bg-secondary/40 border border-border/30 rounded px-3 py-1.5">
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={days} onChange={e => setDays(Number(e.target.value))} className="text-xs bg-secondary/40 border border-border/30 rounded px-3 py-1.5">
            <option value={7}>Últimos 7 dias</option>
            <option value={14}>Últimos 14 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
          </select>
          <Button variant="ghost" size="icon" onClick={reload} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-primary" : ""}`} />
          </Button>
        </div>
      </div>

      {/* KPI principal */}
      <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent">
        <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Conversão lead → venda</p>
            <p className="text-3xl font-bold text-emerald-400">{conversionRate}%</p>
            <p className="text-[10px] text-muted-foreground mt-1">{totalSales} vendas / {totalLeads} leads</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Receita atribuída</p>
            <p className="text-3xl font-bold text-primary">
              R$ {revenue.total >= 1000 ? `${(revenue.total / 1000).toFixed(1)}k` : revenue.total.toFixed(0)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">{revenue.count} vendas aprovadas em {days}d</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ticket médio</p>
            <p className="text-3xl font-bold text-foreground">
              R$ {revenue.ticket >= 1000 ? `${(revenue.ticket / 1000).toFixed(1)}k` : revenue.ticket.toFixed(0)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">por venda aprovada</p>
          </div>
          {stages.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Maior gargalo</p>
              <p className="text-sm font-semibold text-amber-400 mt-2">
                {(() => {
                  let maxDrop = 0; let maxIdx = 0;
                  for (let i = 1; i < stages.length; i++) {
                    const prev = stages[i - 1].count;
                    const cur = stages[i].count;
                    const drop = prev > 0 ? (prev - cur) / prev : 0;
                    if (drop > maxDrop) { maxDrop = drop; maxIdx = i; }
                  }
                  if (maxIdx === 0) return "—";
                  return `${stages[maxIdx - 1].label} → ${stages[maxIdx].label}`;
                })()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>


      {/* Funil visual */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-indigo-400" /> Etapas do funil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)
          ) : (
            stages.map((stage, i) => {
              const Icon = stage.icon;
              const width = stage.count > 0 ? (stage.count / maxCount) * 100 : 0;
              const prevCount = i > 0 ? stages[i - 1].count : null;
              const dropPct = prevCount != null && prevCount > 0
                ? Math.round((1 - stage.count / prevCount) * 100)
                : null;
              return (
                <div key={stage.label} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 text-${stage.color}-400`} />
                      <span className="text-xs font-semibold">{stage.label}</span>
                      <span className="text-[10px] text-muted-foreground">{stage.description}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{stage.count.toLocaleString("pt-BR")}</span>
                      {dropPct != null && (
                        <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${dropPct > 50 ? "border-rose-500/40 text-rose-400" : dropPct > 25 ? "border-amber-500/40 text-amber-400" : "border-emerald-500/40 text-emerald-400"}`}>
                          <TrendingDown className="h-2.5 w-2.5 mr-0.5" />{dropPct}%
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="h-7 rounded bg-secondary/20 relative overflow-hidden">
                    <div
                      className={`absolute inset-y-0 left-0 bg-${stage.color}-500/40 transition-all`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Tabs: source breakdown / templates / matches recentes */}
      <Tabs defaultValue="sources" className="w-full">
        <TabsList>
          <TabsTrigger value="sources" className="gap-1.5"><Target className="h-3.5 w-3.5" /> Por origem</TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5"><Trophy className="h-3.5 w-3.5" /> Templates campeões</TabsTrigger>
          <TabsTrigger value="matches" className="gap-1.5"><Link2 className="h-3.5 w-3.5" /> Últimas vendas atribuídas</TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="mt-4 space-y-2">
          {loading ? <Skeleton className="h-32" /> : sourceBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem atribuições registradas ainda. Comece a enviar links via WhatsApp.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground border-b border-border/30">
                  <tr>
                    <th className="text-left py-2 px-2">Origem</th>
                    <th className="text-right py-2 px-2">Enviados</th>
                    <th className="text-right py-2 px-2">Cliques</th>
                    <th className="text-right py-2 px-2">CTR</th>
                    <th className="text-right py-2 px-2">Vendas geradas</th>
                    <th className="text-right py-2 px-2">Aprovadas</th>
                    <th className="text-right py-2 px-2">Conv. final</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceBreakdown.map(s => {
                    const ctr = s.links_enviados > 0 ? (s.links_clicados / s.links_enviados * 100).toFixed(1) : "0.0";
                    const conv = s.links_enviados > 0 ? (s.vendas_aprovadas / s.links_enviados * 100).toFixed(1) : "0.0";
                    return (
                      <tr key={s.source} className="border-b border-border/10 hover:bg-secondary/10">
                        <td className="py-2 px-2 font-mono">{s.source}</td>
                        <td className="text-right py-2 px-2">{s.links_enviados}</td>
                        <td className="text-right py-2 px-2">{s.links_clicados}</td>
                        <td className="text-right py-2 px-2 text-cyan-400">{ctr}%</td>
                        <td className="text-right py-2 px-2">{s.vendas_geradas}</td>
                        <td className="text-right py-2 px-2 text-emerald-400 font-semibold">{s.vendas_aprovadas}</td>
                        <td className="text-right py-2 px-2 text-emerald-400 font-bold">{conv}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="mt-4 space-y-2">
          {loading ? <Skeleton className="h-32" /> : topTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem templates rastreados ainda.</p>
          ) : (
            topTemplates.map((t, i) => (
              <div key={t.template} className="flex items-center justify-between p-3 rounded-lg border border-border/20 bg-secondary/10">
                <div className="flex items-center gap-3">
                  <Badge className="bg-indigo-500/20 text-indigo-400 border-indigo-500/30 text-[10px] h-5 px-2 font-mono">#{i + 1}</Badge>
                  <div>
                    <p className="text-xs font-semibold">{t.template}</p>
                    <p className="text-[10px] text-muted-foreground">{t.sent} envios · {t.sales} vendas</p>
                  </div>
                </div>
                <Badge className={`text-xs h-6 px-2 ${t.rate >= 5 ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : t.rate >= 2 ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : "bg-secondary text-muted-foreground"}`}>
                  {t.rate}%
                </Badge>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="matches" className="mt-4 space-y-2">
          {loading ? <Skeleton className="h-32" /> : recentMatches.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma venda atribuída ainda. Aguarde os webhooks dos próximos pagamentos.</p>
          ) : (
            recentMatches.map(m => (
              <div key={m.id} className="p-3 rounded-lg border border-border/20 bg-secondary/10 flex items-center justify-between gap-3">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-mono">{m.source}</Badge>
                    {m.template_name && <Badge variant="outline" className="text-[9px] h-4 px-1.5">{m.template_name}</Badge>}
                    {m.produto_nome && <span className="text-[10px] text-muted-foreground">{m.produto_nome}</span>}
                  </div>
                  <p className="text-xs">{m.phone}</p>
                  <p className="text-[9px] text-muted-foreground font-mono">
                    Enviado {new Date(m.sent_at).toLocaleString("pt-BR")} · Casado {m.matched_at ? new Date(m.matched_at).toLocaleString("pt-BR") : "—"}
                  </p>
                </div>
                <Badge className={m.venda_status === "aprovado" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-amber-500/20 text-amber-400 border-amber-500/30"}>
                  {m.venda_status}
                </Badge>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      <p className="text-[10px] text-muted-foreground text-center">
        ⓘ Atribuição registra cada link de checkout enviado e amarra à venda quando o lead paga (via xc/attr no checkout). Disparadores atuais: <code>chat_manual</code>, <code>ai_reply</code>, <code>payment_recovery</code>.
      </p>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Users, ShoppingCart, Clock, CheckCircle2, AlertCircle, TrendingUp, Zap, DollarSign, Package, Bell, CalendarClock } from "lucide-react";
import { format } from "date-fns";
import { KpiHeroCard } from "@/components/shared/KpiHeroCard";
import { ProductInsightDrawer } from "@/components/projeto/insights/ProductInsightDrawer";
import DashboardAlerts from "@/components/dashboard/DashboardAlerts";

interface Props {
  projectId: string;
  project: any;
}

export function ProjetoComando({ projectId, project }: Props) {
  const [cards, setCards] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [pendingVendas, setPendingVendas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [vendasHoje, setVendasHoje] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);

  // Pulso / comparativos
  const [vendasOntem, setVendasOntem] = useState<any[]>([]);
  const [leads7d, setLeads7d] = useState<any[]>([]);
  const [adsHoje, setAdsHoje] = useState<any[]>([]);
  const [adsOntem, setAdsOntem] = useState<any[]>([]);

  // Top produtos do mês
  const [vendasMes, setVendasMes] = useState<any[]>([]);
  const [drawerProduto, setDrawerProduto] = useState<string | null>(null);

  // Próximas ações: eventos próximas 48h
  const [events48h, setEvents48h] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    const now = new Date();
    const brOffset = -3 * 60;
    const brNow = new Date(now.getTime() + (brOffset + now.getTimezoneOffset()) * 60000);
    const todayStr = brNow.toISOString().split("T")[0];
    const dayStart = todayStr + "T03:00:00.000Z";
    const dayEnd = new Date(new Date(dayStart).getTime() + 86400000).toISOString();
    const yStart = new Date(new Date(dayStart).getTime() - 86400000).toISOString();
    const sevenDaysAgo = new Date(new Date(dayStart).getTime() - 7 * 86400000).toISOString();
    const monthStart = `${todayStr.slice(0, 7)}-01T03:00:00.000Z`;
    const in48h = new Date(brNow.getTime() + 2 * 86400000).toISOString().split("T")[0];

    const sb: any = supabase;
    const promises: PromiseLike<any>[] = [
      sb.from("imphq_kanban_cards").select("*, imphq_kanban_columns(title)").eq("project_id", projectId),
      sb.from("imphq_leads").select("*").eq("project_id", projectId).order("criado_em", { ascending: false }).limit(10),
      sb.from("imphq_vendas").select("lead_id, produto_nome, status, valor").eq("project_id", projectId).neq("status", "aprovado"),
      sb.from("imphq_vendas").select("id, status, created_at, produto_nome, valor, plataforma, lead_id").eq("project_id", projectId).gte("created_at", dayStart).lt("created_at", dayEnd),
      sb.from("imphq_calendar_events").select("*").eq("project_id", projectId).gte("start_date", todayStr).lte("start_date", todayStr).order("start_date", { ascending: true }),
      sb.from("imphq_vendas").select("valor, status").eq("project_id", projectId).gte("created_at", yStart).lt("created_at", dayStart),
      sb.from("imphq_leads").select("criado_em").eq("project_id", projectId).gte("criado_em", sevenDaysAgo),
      sb.from("imphq_ads_spend").select("valor").eq("project_id", projectId).eq("data", todayStr),
      sb.from("imphq_ads_spend").select("valor").eq("project_id", projectId).eq("data", todayStr.slice(0, 8) + String(Number(todayStr.slice(8, 10)) - 1).padStart(2, "0")),
      sb.from("imphq_vendas").select("produto_nome, valor, status").eq("project_id", projectId).eq("status", "aprovado").gte("created_at", monthStart),
      sb.from("imphq_calendar_events").select("*").eq("project_id", projectId).gte("start_date", todayStr).lte("start_date", in48h).order("start_date", { ascending: true }),
    ];
    const [cardsRes, leadsRes, vendasPendRes, vendasHojeRes, calEventsRes, vendasOntemRes, leads7dRes, adsHojeRes, adsOntemRes, vendasMesRes, events48hRes] = await Promise.all(promises);

    setCards(cardsRes.data || []);
    setLeads(leadsRes.data || []);
    setPendingVendas(vendasPendRes.data || []);
    setVendasHoje(vendasHojeRes.data || []);
    setCalendarEvents(calEventsRes.data || []);
    setVendasOntem(vendasOntemRes.data || []);
    setLeads7d(leads7dRes.data || []);
    setAdsHoje(adsHojeRes.data || []);
    setAdsOntem(adsOntemRes.data || []);
    setVendasMes(vendasMesRes.data || []);
    setEvents48h(events48hRes.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [projectId]);

  const totalCards = cards.length;
  const doneCards = cards.filter(c => {
    const col = (c.imphq_kanban_columns?.title || "").toLowerCase();
    return col.includes("conclu") || col.includes("done") || col.includes("finaliz");
  }).length;
  const progressPct = totalCards > 0 ? Math.round((doneCards / totalCards) * 100) : 0;

  const inProgressCards = cards.filter(c => {
    const col = (c.imphq_kanban_columns?.title || "").toLowerCase();
    return col.includes("progresso") || col.includes("fazendo") || col.includes("doing") || col.includes("progress");
  });
  const reviewCards = cards.filter(c => {
    const col = (c.imphq_kanban_columns?.title || "").toLowerCase();
    return col.includes("revis") || col.includes("review");
  });
  const doneCardsList = cards.filter(c => {
    const col = (c.imphq_kanban_columns?.title || "").toLowerCase();
    return col.includes("conclu") || col.includes("done") || col.includes("finaliz");
  });

  const productByLead = new Map<string, string>();
  pendingVendas.forEach((v) => {
    if (v.lead_id && v.produto_nome) productByLead.set(v.lead_id, v.produto_nome);
  });

  const pixProductBreakdown: Record<string, number> = {};
  pendingVendas.forEach((v) => {
    const nome = v.produto_nome || "Sem produto";
    pixProductBreakdown[nome] = (pixProductBreakdown[nome] || 0) + 1;
  });

  const getLeadProduct = (lead: any): string | null => {
    if (productByLead.has(lead.id)) return productByLead.get(lead.id)!;
    const interacoes = lead.data?.interacoes;
    if (Array.isArray(interacoes)) {
      for (let i = interacoes.length - 1; i >= 0; i--) {
        if (interacoes[i]?.produto) return interacoes[i].produto;
      }
    }
    return null;
  };

  const now = new Date();
  const brOffset = -3 * 60;
  const brNow = new Date(now.getTime() + (brOffset + now.getTimezoneOffset()) * 60000);
  const todayStr = brNow.toISOString().split("T")[0];
  const dayStartUtc = todayStr + "T03:00:00.000Z";

  const leadsToday = leads.filter(l => l.criado_em && l.criado_em >= dayStartUtc).length;
  const pixToday = vendasHoje.filter(v => {
    const s = (v.status || "").toLowerCase();
    return s.includes("pend") || s.includes("pix") || s.includes("waiting") || s.includes("carrinho");
  }).length;
  const salesToday = vendasHoje.filter(v => (v.status || "").toLowerCase() === "aprovado").length;
  const pendingTotal = pendingVendas.length;

  const briefing = typeof project.data === "object" ? project.data : {};
  const fase = briefing?.status || "Em configuração";
  const lastUpdate = project.updated_at ? format(new Date(project.updated_at), "dd/MM HH:mm") : "—";

  // Valor total vendas do dia
  const totalVendasHojeValor = vendasHoje
    .filter(v => (v.status || "").toLowerCase() === "aprovado")
    .reduce((sum, v) => sum + (Number(v.valor) || 0), 0);

  if (loading) return <div className="text-muted-foreground text-sm p-4">Carregando comando...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header strip */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{fase}</Badge>
              <span className="text-[10px] text-muted-foreground">Atualizado: {lastUpdate}</span>
            </div>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={load} className="gap-1.5">
          <RefreshCw className="h-3 w-3" /> Atualizar
        </Button>
      </div>

      {/* Progress bar */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progresso de Tarefas</span>
            <span className="text-sm font-mono font-bold text-primary">{doneCards}/{totalCards}</span>
          </div>
          <Progress value={progressPct} className="h-3" />
          <p className="text-[10px] text-muted-foreground mt-1">{progressPct}% concluído</p>
        </CardContent>
      </Card>

      {/* KPIs do dia */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Leads Hoje", value: leadsToday, icon: Users, color: "text-blue-400" },
          { label: "Pix Gerados", value: pixToday, icon: Zap, color: "text-amber-400" },
          { label: "Vendas Hoje", value: salesToday, icon: ShoppingCart, color: "text-emerald-400" },
          { label: "Pendentes", value: pendingTotal, icon: AlertCircle, color: "text-rose-400" },
        ].map((kpi) => (
          <Card key={kpi.label} className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <kpi.icon className={`h-5 w-5 mx-auto mb-1 ${kpi.color}`} />
              <p className="text-2xl font-mono font-bold">{kpi.value}</p>
              <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detalhes das Vendas do Dia */}
      {vendasHoje.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" /> Vendas do Dia ({vendasHoje.length})
              {totalVendasHojeValor > 0 && (
                <Badge variant="secondary" className="text-[10px] ml-auto">
                  R$ {totalVendasHojeValor.toFixed(2)}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">Produto</TableHead>
                  <TableHead className="text-[10px]">Valor</TableHead>
                  <TableHead className="text-[10px]">Status</TableHead>
                  <TableHead className="text-[10px]">Plataforma</TableHead>
                  <TableHead className="text-[10px]">Horário</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendasHoje.map((v) => {
                  const statusLower = (v.status || "").toLowerCase();
                  const statusColor = statusLower === "aprovado"
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-400 border-amber-500/30";
                  return (
                    <TableRow key={v.id}>
                      <TableCell className="text-xs py-2 font-medium">
                        {v.produto_nome || "—"}
                      </TableCell>
                      <TableCell className="text-xs py-2 font-mono">
                        {v.valor ? `R$ ${Number(v.valor).toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant="outline" className={`text-[9px] ${statusColor}`}>
                          {v.status || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground py-2">
                        {v.plataforma || "—"}
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground py-2">
                        {v.created_at ? format(new Date(v.created_at), "HH:mm") : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Breakdown de produtos pendentes */}
      {Object.keys(pixProductBreakdown).length > 0 && (
        <Card className="bg-card border-border">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Produtos com Pix / Pendente</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(pixProductBreakdown).map(([produto, qty]) => (
                <Badge key={produto} variant="outline" className="text-[10px] gap-1">
                  {produto} <span className="font-mono font-bold text-primary">×{qty}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Two columns: Leads + Mini Kanban */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Últimos Leads */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Últimos Leads
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {leads.length === 0 ? (
              <p className="text-xs text-muted-foreground p-4">Nenhum lead capturado ainda</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">Nome</TableHead>
                    <TableHead className="text-[10px]">Produto</TableHead>
                    <TableHead className="text-[10px]">Status</TableHead>
                    <TableHead className="text-[10px]">Horário</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.slice(0, 8).map((l) => {
                    const produto = getLeadProduct(l);
                    return (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs py-2">
                        <div>{l.nome || l.email || "—"}</div>
                        <div className="text-[10px] text-muted-foreground">{l.email || l.phone || ""}</div>
                      </TableCell>
                      <TableCell className="text-xs py-2">
                        {produto ? (
                          <Badge variant="secondary" className="text-[9px]">{produto}</Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant="outline" className="text-[9px]">{l.status || "novo"}</Badge>
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground py-2">
                        {l.criado_em ? format(new Date(l.criado_em), "dd/MM HH:mm") : "—"}
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Mini Kanban */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" /> Tarefas do Projeto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {[
                { title: "Fazendo", cards: inProgressCards, color: "border-amber-500/50" },
                { title: "Revisão", cards: reviewCards, color: "border-blue-500/50" },
                { title: "Concluído", cards: doneCardsList.slice(0, 5), color: "border-emerald-500/50" },
              ].map((col) => (
                <div key={col.title} className={`border-t-2 ${col.color} rounded bg-secondary/30 p-2 space-y-1.5`}>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                    {col.title}
                    <Badge variant="outline" className="text-[8px] h-4 px-1">{col.cards.length}</Badge>
                  </p>
                  {col.cards.length === 0 && <p className="text-[9px] text-muted-foreground italic">Vazio</p>}
                  {col.cards.map((c: any) => (
                    <div key={c.id} className="bg-card rounded p-1.5 border border-border text-[10px]">
                      <p className="font-medium truncate">{c.title}</p>
                      {c.due_date && (
                        <p className="text-[9px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-2 w-2" /> {format(new Date(c.due_date), "dd/MM")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agenda do dia */}
      {calendarEvents.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Agenda Hoje ({calendarEvents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {calendarEvents.slice(0, 20).map((ev: any) => (
                <Badge key={ev.id} variant="outline" className="text-[9px]">
                  {ev.title} {ev.start_date ? format(new Date(ev.start_date), "HH:mm") : ""}
                </Badge>
              ))}
              {calendarEvents.length > 20 && <Badge variant="secondary" className="text-[9px]">+{calendarEvents.length - 20}</Badge>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
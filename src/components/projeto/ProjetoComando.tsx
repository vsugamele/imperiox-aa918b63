import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Users, ShoppingCart, Clock, CheckCircle2, AlertCircle, TrendingUp, Zap } from "lucide-react";
import { format } from "date-fns";

interface Props {
  projectId: string;
  project: any;
}

export function ProjetoComando({ projectId, project }: Props) {
  const [cards, setCards] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [todayEvents, setTodayEvents] = useState<any[]>([]);
  const [pendingVendas, setPendingVendas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];

    const [cardsRes, leadsRes, eventsRes, vendasRes] = await Promise.all([
      supabase.from("imphq_kanban_cards").select("*, imphq_kanban_columns(title)").eq("project_id", projectId),
      supabase.from("imphq_leads").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(10),
      supabase.from("imphq_events").select("*").eq("project_id", projectId).gte("created_at", today + "T00:00:00").order("created_at", { ascending: false }),
      supabase.from("imphq_vendas").select("lead_id, produto_nome, status, valor").eq("project_id", projectId).neq("status", "aprovado"),
    ]);

    setCards(cardsRes.data || []);
    setLeads(leadsRes.data || []);
    setTodayEvents(eventsRes.data || []);
    setPendingVendas(vendasRes.data || []);
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

  // Product map from vendas pendentes
  const productByLead = new Map<string, string>();
  pendingVendas.forEach((v) => {
    if (v.lead_id && v.produto_nome) productByLead.set(v.lead_id, v.produto_nome);
  });

  // Breakdown de produtos pendentes (pix/carrinho)
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

  const leadsToday = leads.filter(l => l.created_at?.startsWith(new Date().toISOString().split("T")[0])).length;
  const pixEvents = todayEvents.filter(e => e.event_name === "pix_created" || e.event_name === "waiting_payment").length;
  const salesEvents = todayEvents.filter(e => e.event_name === "approved" || e.event_name === "purchase").length;
  const pendingLeads = leads.filter(l => {
    const s = (l.status || "").toLowerCase();
    return s.includes("pend") || s.includes("carrinho") || s.includes("pix") || s.includes("waiting");
  }).length;

  const briefing = typeof project.data === "object" ? project.data : {};
  const fase = briefing?.status || "Em configuração";
  const lastUpdate = project.updated_at ? format(new Date(project.updated_at), "dd/MM HH:mm") : "—";

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
          { label: "Pix Gerados", value: pixEvents, icon: Zap, color: "text-amber-400" },
          { label: "Vendas Hoje", value: salesEvents, icon: ShoppingCart, color: "text-emerald-400" },
          { label: "Pendentes", value: pendingLeads, icon: AlertCircle, color: "text-rose-400" },
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
                    <TableHead className="text-[10px]">Status</TableHead>
                    <TableHead className="text-[10px]">Horário</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.slice(0, 8).map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs py-2">
                        <div>{l.name || l.email || "—"}</div>
                        <div className="text-[10px] text-muted-foreground">{l.email || l.phone || ""}</div>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant="outline" className="text-[9px]">{l.status || "novo"}</Badge>
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground py-2">
                        {l.created_at ? format(new Date(l.created_at), "dd/MM HH:mm") : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
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

      {/* Events timeline */}
      {todayEvents.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Eventos Hoje ({todayEvents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {todayEvents.slice(0, 20).map((ev) => (
                <Badge key={ev.id} variant="outline" className="text-[9px]">
                  {ev.event_name} {ev.created_at ? format(new Date(ev.created_at), "HH:mm") : ""}
                </Badge>
              ))}
              {todayEvents.length > 20 && <Badge variant="secondary" className="text-[9px]">+{todayEvents.length - 20}</Badge>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

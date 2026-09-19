import { lazy, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, MessageSquare, Instagram, Flame, Phone, Mail, Sparkles, ChevronUp, Zap, Clock, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSidebarBadges } from "@/hooks/useSidebarBadges";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileInboxList } from "@/components/mobile/MobileInboxList";

const WhatsAppPage = lazy(() => import("@/pages/WhatsAppPage"));
const InstagramPage = lazy(() => import("@/pages/InstagramPage"));
const ImperiusSuggestionsTab = lazy(() => import("@/components/inbox/ImperiusSuggestionsTab"));

const TabLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh] w-full">
    <div className="flex flex-col items-center gap-2.5">
      <Loader2 className="h-7 w-7 text-primary animate-spin" />
      <span className="text-xs text-muted-foreground animate-pulse">Carregando canal...</span>
    </div>
  </div>
);

// ── Helpers ────────────────────────────────────────────────────────────────────
function elapsedMinutes(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
}

function formatElapsed(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ── Fila Unificada Tab ─────────────────────────────────────────────────────────
type WaConvRow = Pick<
  Tables<"imphq_wa_conversations">,
  | "id"
  | "contact_name"
  | "phone"
  | "lead_id"
  | "last_message"
  | "last_message_at"
  | "unread_count"
  | "status"
>;

type HotLeadRow = Pick<
  Tables<"imphq_leads">,
  "id" | "nome" | "email" | "score" | "criado_em"
>;

type Priority = "urgent" | "warning" | "opportunity";

interface FilaItem {
  key: string;
  priority: Priority;
  name: string;
  preview: string;
  elapsed: number; // minutes
  href: string;
}

function priorityLabel(p: Priority) {
  if (p === "urgent") return "Urgente";
  if (p === "warning") return "Aguardando";
  return "Oportunidade";
}

function priorityClasses(p: Priority): { pill: string; dot: string } {
  if (p === "urgent")
    return {
      pill: "bg-red-500/15 text-red-400 border-red-500/30",
      dot: "bg-red-400",
    };
  if (p === "warning")
    return {
      pill: "bg-orange-500/15 text-orange-400 border-orange-500/30",
      dot: "bg-orange-400",
    };
  return {
    pill: "bg-[#D6FF4B]/10 text-[#D6FF4B] border-[#D6FF4B]/30",
    dot: "bg-[#D6FF4B]",
  };
}

function FilaUnificadaTab() {
  const [items, setItems] = useState<FilaItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const fourHoursAgo = new Date(Date.now() - 4 * 3600_000).toISOString();
    const thirtyMinAgo = new Date(Date.now() - 30 * 60_000).toISOString();

    const [convsRes, leadsRes] = await Promise.all([
      supabase
        .from("imphq_wa_conversations")
        .select("id,contact_name,phone,lead_id,last_message,last_message_at,unread_count,status")
        .neq("status", "closed")
        .order("unread_count", { ascending: false })
        .order("last_message_at", { ascending: true })
        .limit(100),
      supabase
        .from("imphq_leads")
        .select("id,nome,email,score,criado_em")
        .gt("score", 70)
        .gte("criado_em", fourHoursAgo)
        .order("score", { ascending: false })
        .limit(50),
    ]);

    const convs: WaConvRow[] = (convsRes.data ?? []) as WaConvRow[];
    const leads: HotLeadRow[] = (leadsRes.data ?? []) as HotLeadRow[];

    // Set of lead_ids that already have an open WA conversation
    const coveredLeadIds = new Set(convs.map((c) => c.lead_id).filter(Boolean));

    const queue: FilaItem[] = [];

    for (const c of convs) {
      const elapsed = elapsedMinutes(c.last_message_at);
      let priority: Priority;
      if ((c.unread_count ?? 0) > 0) {
        priority = "urgent";
      } else if (c.last_message_at && c.last_message_at < thirtyMinAgo) {
        priority = "warning";
      } else {
        priority = "warning";
      }
      queue.push({
        key: `conv-${c.id}`,
        priority,
        name: c.contact_name ?? c.phone ?? "Desconhecido",
        preview: c.last_message
          ? c.last_message.slice(0, 60) + (c.last_message.length > 60 ? "\u2026" : "")
          : "",
        elapsed,
        href: "/inbox?tab=whatsapp",
      });
    }

    for (const l of leads) {
      if (coveredLeadIds.has(l.id)) continue;
      const elapsed = elapsedMinutes(l.criado_em);
      queue.push({
        key: `lead-${l.id}`,
        priority: "opportunity",
        name: l.nome ?? l.email ?? "Lead sem nome",
        preview: "Sem conversa \u2014 lead quente",
        elapsed,
        href: `/leads?id=${l.id}`,
      });
    }

    const priorityOrder: Record<Priority, number> = { urgent: 0, warning: 1, opportunity: 2 };
    queue.sort((a, b) => {
      const pd = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pd !== 0) return pd;
      return b.elapsed - a.elapsed;
    });

    setItems(queue);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 60_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <TabLoader />;

  const urgentCount = items.filter((i) => i.priority === "urgent").length;
  const waitingCount = items.filter((i) => i.priority === "warning").length;
  const oppCount = items.filter((i) => i.priority === "opportunity").length;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-400/60" />
        <p className="font-display text-lg text-foreground/70">
          Fila limpa \u2014 tudo respondido
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3 max-w-4xl mx-auto">
      {/* Summary kicker */}
      <div className="flex items-center gap-3 mb-3 text-[11px] font-mono tracking-wider uppercase text-muted-foreground">
        {urgentCount > 0 && (
          <span className="text-red-400 font-semibold">{urgentCount} urgentes</span>
        )}
        {urgentCount > 0 && waitingCount > 0 && <span>\u00b7</span>}
        {waitingCount > 0 && (
          <span className="text-orange-400 font-semibold">{waitingCount} aguardando</span>
        )}
        {(urgentCount > 0 || waitingCount > 0) && oppCount > 0 && <span>\u00b7</span>}
        {oppCount > 0 && (
          <span className="text-[#D6FF4B] font-semibold">{oppCount} oportunidades</span>
        )}
      </div>

      {items.map((item) => {
        const cls = priorityClasses(item.priority);
        return (
          <div
            key={item.key}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[#1B1E23] bg-[#0A0B0D]/60 hover:border-border/60 transition-colors"
          >
            {/* SLA pill */}
            <span
              className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-mono font-semibold ${cls.pill}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${cls.dot}`} />
              {priorityLabel(item.priority)}
            </span>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground truncate">
                  {item.name}
                </span>
                {item.key.startsWith("conv-") && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-400 shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    WA
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{item.preview}</p>
            </div>

            {/* Time elapsed */}
            <span className="shrink-0 text-[10px] font-mono text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {item.elapsed > 0 ? formatElapsed(item.elapsed) : "agora"}
            </span>

            {/* Action button */}
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 text-xs h-7 border-[#1B1E23] hover:border-[#D6FF4B]/40 hover:text-[#D6FF4B]"
              onClick={() => (window.location.href = item.href)}
            >
              Atender \u2192
            </Button>
          </div>
        );
      })}
    </div>
  );
}

// ── Hot Leads Tab ─────────────────────────────────────────────────────────────
type Lead = Pick<Tables<"imphq_leads">, "id" | "nome" | "email" | "score" | "criado_em" | "data"> & {
  telefone: string | null;
};

function SlaBadge({ criado_em }: { criado_em: string | null }) {
  const mins = elapsedMinutes(criado_em);
  let cls: string;
  let label: string;
  if (mins < 30) {
    cls = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    label = `${mins}min`;
  } else if (mins < 60) {
    cls = "bg-orange-500/15 text-orange-400 border-orange-500/30";
    label = `${mins}min`;
  } else {
    cls = "bg-red-500/15 text-red-400 border-red-500/30";
    label = formatElapsed(mins);
  }
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-mono font-semibold shrink-0 ${cls}`}
    >
      <Clock className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

function HotLeadsTab() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600_000).toISOString();
    supabase
      .from("imphq_leads")
      .select("id,nome,email,phone,score,criado_em,data")
      .gt("score", 80)
      .gte("criado_em", twoHoursAgo)
      .order("score", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setLeads((data || []).map(l => ({ ...l, telefone: l.phone })));
        setLoading(false);
      });
  }, []);

  if (loading) return <TabLoader />;

  if (!leads.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
        <Flame className="h-12 w-12 text-muted-foreground/30" />
        <div>
          <p className="font-display text-lg text-foreground/70">Sem leads quentes agora</p>
          <p className="text-sm text-muted-foreground mt-1">
            Leads com score &gt; 80 das últimas 2h aparecerão aqui.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.location.href = "/leads"}>
          Ver todos os leads →
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-display text-lg text-foreground flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-400" /> {leads.length} leads quentes — últimas 2h
        </h2>
        <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
          Score &gt; 80
        </Badge>
      </div>
      {leads.map((lead) => {
        const phone = lead.telefone?.replace(/\D/g, "");
        const waLink = phone ? `https://wa.me/${phone}` : null;
        return (
          <Card key={lead.id} className="bg-secondary/40 border-border card-hover-gold">
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground truncate">
                    {lead.nome || lead.email || "Lead sem nome"}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-primary/10 text-primary border-primary/20 shrink-0"
                  >
                    Score {lead.score}
                  </Badge>
                  <SlaBadge criado_em={lead.criado_em} />
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex gap-3">
                  {lead.telefone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {lead.telefone}</span>}
                  {lead.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {lead.email}</span>}
                  <span>
                    {new Date(lead.criado_em ?? 0).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {waLink && (
                  <Button size="sm" variant="outline" className="text-xs h-7 gap-1" asChild>
                    <a href={waLink} target="_blank" rel="noopener noreferrer">
                      <MessageSquare className="h-3 w-3" /> WA
                    </a>
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7"
                  onClick={() => (window.location.href = `/leads?id=${lead.id}`)}
                >
                  Ver CRM →
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── KPI Strip ─────────────────────────────────────────────────────────────────
interface InboxKpis {
  openConvs: number;
  awaiting: number;     // sem resposta > 30 min
  hotLeads2h: number;   // score > 80 últimas 2h
  msgsToday: number;
  slaPct: number;       // % conversas com 1ª resposta < 30 min hoje
  avgFirstResp: number; // minutos
}

function KpiCell({
  kicker, value, hint, accent,
}: { kicker: string; value: React.ReactNode; hint?: string; accent?: string }) {
  return (
    <div className="px-4 py-3 flex flex-col gap-0.5">
      <span className="kicker">{kicker}</span>
      <span className={`font-display text-2xl leading-none ${accent || "text-foreground"}`}>
        {value}
      </span>
      {hint && <span className="text-[10px] text-muted-foreground mt-0.5">{hint}</span>}
    </div>
  );
}

function InboxKpiStrip({ collapsed, onToggle }: { collapsed?: boolean; onToggle?: () => void }) {
  const [k, setK] = useState<InboxKpis | null>(null);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      const now = Date.now();
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const thirtyMinAgo = new Date(now - 30 * 60_000).toISOString();
      const twoHoursAgo = new Date(now - 2 * 3600_000).toISOString();

      const [openQ, awaitingQ, hotQ, msgsQ] = await Promise.all([
        supabase.from("imphq_wa_conversations")
          .select("id", { count: "exact", head: true })
          .neq("status", "closed"),
        supabase.from("imphq_wa_conversations")
          .select("id", { count: "exact", head: true })
          .neq("status", "closed")
          .lt("last_message_at", thirtyMinAgo)
          .gt("last_message_at", new Date(now - 6 * 3600_000).toISOString()),
        supabase.from("imphq_leads")
          .select("id", { count: "exact", head: true })
          .gt("score", 80)
          .gte("criado_em", twoHoursAgo),
        supabase.from("imphq_wa_messages")
          .select("id", { count: "exact", head: true })
          .gte("created_at", todayStart.toISOString()),
      ]);

      if (stop) return;
      const openConvs = openQ.count ?? 0;
      const awaiting = awaitingQ.count ?? 0;
      const slaPct = openConvs > 0 ? Math.max(0, Math.round(100 - (awaiting / openConvs) * 100)) : 100;

      setK({
        openConvs,
        awaiting,
        hotLeads2h: hotQ.count ?? 0,
        msgsToday: msgsQ.count ?? 0,
        slaPct,
        avgFirstResp: 0,
      });
    };
    load();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 60_000);
    return () => { stop = true; clearInterval(t); };
  }, []);

  if (collapsed) {
    return (
      <div className="kpi-strip collapsed !flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">{k?.openConvs ?? "—"} <span className="text-muted-foreground">abertas</span></span>
          <span className={(k?.awaiting ?? 0) > 0 ? "text-orange-400" : ""}>{k?.awaiting ?? "—"} aguardando</span>
          <span className={(k?.hotLeads2h ?? 0) > 0 ? "text-gold" : ""}>{k?.hotLeads2h ?? "—"} hot leads</span>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onToggle} title="Expandir KPIs">
          <ChevronUp className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="kpi-strip relative">
      <Button
        size="icon"
        variant="ghost"
        className="absolute right-2 top-2 h-7 w-7 text-muted-foreground hover:text-foreground"
        onClick={onToggle}
        title="Recolher KPIs"
      >
        <ChevronUp className="h-4 w-4 rotate-180" />
      </Button>
      <KpiCell kicker="Conversas abertas" value={k?.openConvs ?? "—"} />
      <KpiCell
        kicker="Aguardando > 30min"
        value={k?.awaiting ?? "—"}
        accent={(k?.awaiting ?? 0) > 0 ? "text-orange-400" : "text-foreground"}
        hint={(k?.awaiting ?? 0) > 0 ? "responder agora" : "tudo em dia"}
      />
      <KpiCell
        kicker="Hot leads · 2h"
        value={k?.hotLeads2h ?? "—"}
        accent={(k?.hotLeads2h ?? 0) > 0 ? "text-gold" : "text-foreground"}
      />
      <KpiCell kicker="Mensagens hoje" value={k?.msgsToday ?? "—"} />
      <KpiCell
        kicker="SLA verde"
        value={k ? `${k.slaPct}%` : "—"}
        accent={
          !k ? "text-foreground"
            : k.slaPct >= 80 ? "text-emerald-400"
            : k.slaPct >= 50 ? "text-orange-400"
            : "text-destructive"
        }
      />
      <KpiCell
        kicker="Canais ativos"
        value={<span className="inline-flex items-center gap-1.5"><MessageSquare className="h-4 w-4 text-emerald-400" /><Instagram className="h-4 w-4 text-pink-400" /></span>}
        hint="WhatsApp · Instagram"
      />
    </div>
  );
}

// ── Main Inbox ─────────────────────────────────────────────────────────────────
type InboxTab = "fila" | "whatsapp" | "instagram" | "hotleads" | "imperius";

const TABS: { value: InboxTab; label: string; icon: React.ElementType }[] = [
  { value: "fila",      label: "Fila",        icon: Zap },
  { value: "imperius",  label: "Sugestões IA", icon: Sparkles },
  { value: "whatsapp",  label: "WhatsApp",    icon: MessageSquare },
  { value: "instagram", label: "Instagram",   icon: Instagram },
  { value: "hotleads",  label: "Hot Leads",   icon: Flame },
];

export default function Inbox() {
  const isMobile = useIsMobile();
  const [params, setParams] = useSearchParams();
  const { data: badges } = useSidebarBadges();

  const defaultTab = ((): InboxTab => {
    const p = params.get("tab") as InboxTab | null;
    if (p && TABS.some((t) => t.value === p)) return p;
    if ((badges?.inbox ?? 0) > 0) return "whatsapp";
    if ((badges?.leads ?? 0) > 0) return "hotleads";
    return "fila";
  })();

  const [active, setActive] = useState<InboxTab>(defaultTab);
  const [showKpiStrip, setShowKpiStrip] = useState(() => localStorage.getItem("wa.showKpiStrip") !== "false");

  useEffect(() => { localStorage.setItem("wa.showKpiStrip", String(showKpiStrip)); }, [showKpiStrip]);

  if (isMobile) return <MobileInboxList />;

  const handleChange = (val: string) => {
    const tab = val as InboxTab;
    setActive(tab);
    setParams({ tab }, { replace: true });
  };

  const badgeCount: Record<InboxTab, number> = {
    fila: 0,
    imperius: 0,
    whatsapp: badges?.inbox ?? 0,
    instagram: 0,
    hotleads: badges?.leads ?? 0,
  };

  return (
    <div className="flex flex-col h-full -m-3 md:-m-6">
      {/* Editorial header + KPI strip + tabs */}
      <div className="bg-background/70 backdrop-blur-xl shrink-0 border-b border-border/60">
        <div className="px-4 md:px-6 pt-4 md:pt-5 pb-3">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <div className="kicker">Inbox · Operação</div>
              <h1 className="section-title mt-1 text-2xl md:text-3xl">Central de Conversas</h1>
            </div>
            <div className="hidden md:block text-[11px] text-muted-foreground tracking-editorial uppercase">
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
            </div>
          </div>
          <div className="hairline mt-4" />
        </div>

        <div className="hidden md:block">
          <InboxKpiStrip collapsed={!showKpiStrip} onToggle={() => setShowKpiStrip(v => !v)} />
        </div>

        <Tabs value={active} onValueChange={handleChange}>
          <div className="px-3 md:px-6 overflow-x-auto">
            <TabsList className="editorial-tabs w-max">
              {TABS.map(({ value, label, icon: Icon }) => (
                <TabsTrigger key={value} value={value} className="editorial-tab shrink-0">
                  <span className="inline-flex items-center gap-1.5 md:gap-2">
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden xs:inline sm:inline">{label}</span>
                    {badgeCount[value] > 0 && (
                      <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full border border-gold/40 text-gold text-[10px] font-mono tracking-wider">
                        {badgeCount[value] > 99 ? "99+" : badgeCount[value]}
                      </span>
                    )}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="fila" className="mt-0 pt-0 h-full">
            <FilaUnificadaTab />
          </TabsContent>
          <TabsContent value="imperius" className="mt-0 pt-0 h-full">
            <Suspense fallback={<TabLoader />}>
              <ImperiusSuggestionsTab />
            </Suspense>
          </TabsContent>
          <TabsContent value="whatsapp" className="mt-0 pt-0 h-full">
            <Suspense fallback={<TabLoader />}>
              <WhatsAppPage />
            </Suspense>
          </TabsContent>
          <TabsContent value="instagram" className="mt-0 pt-0 h-full">
            <Suspense fallback={<TabLoader />}>
              <InstagramPage />
            </Suspense>
          </TabsContent>
          <TabsContent value="hotleads" className="mt-0 pt-0 h-full">
            <HotLeadsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

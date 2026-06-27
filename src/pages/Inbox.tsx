import { lazy, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, MessageSquare, Instagram, Flame, Phone, Mail, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSidebarBadges } from "@/hooks/useSidebarBadges";

const WhatsAppPage = lazy(() => import("./WhatsAppPage"));
const InstagramPage = lazy(() => import("./InstagramPage"));
const ImperiusSuggestionsTab = lazy(() => import("@/components/inbox/ImperiusSuggestionsTab"));

const TabLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh] w-full">
    <div className="flex flex-col items-center gap-2.5">
      <Loader2 className="h-7 w-7 text-primary animate-spin" />
      <span className="text-xs text-muted-foreground animate-pulse">Carregando canal...</span>
    </div>
  </div>
);

// ── Hot Leads Tab ─────────────────────────────────────────────────────────────
interface Lead {
  id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  score: number | null;
  criado_em: string;
  data: any;
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
        setLeads(((data as any[]) || []).map(l => ({ ...l, telefone: l.phone })) as Lead[]);
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
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground truncate">
                    {lead.nome || lead.email || "Lead sem nome"}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-primary/10 text-primary border-primary/20 shrink-0"
                  >
                    Score {lead.score}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex gap-3">
                  {lead.telefone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {lead.telefone}</span>}
                  {lead.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {lead.email}</span>}
                  <span>
                    {new Date(lead.criado_em).toLocaleTimeString("pt-BR", {
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

function InboxKpiStrip() {
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

  return (
    <div className="kpi-strip">
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
type InboxTab = "whatsapp" | "instagram" | "hotleads" | "imperius";

const TABS: { value: InboxTab; label: string; icon: React.ElementType }[] = [
  { value: "imperius",  label: "Sugestões IA", icon: Sparkles },
  { value: "whatsapp",  label: "WhatsApp",  icon: MessageSquare },
  { value: "instagram", label: "Instagram", icon: Instagram },
  { value: "hotleads",  label: "Hot Leads", icon: Flame },
];

export default function Inbox() {
  const [params, setParams] = useSearchParams();
  const { data: badges } = useSidebarBadges();

  const defaultTab = ((): InboxTab => {
    const p = params.get("tab") as InboxTab | null;
    if (p && TABS.some((t) => t.value === p)) return p;
    if ((badges?.inbox ?? 0) > 0) return "whatsapp";
    if ((badges?.leads ?? 0) > 0) return "hotleads";
    return "whatsapp";
  })();

  const [active, setActive] = useState<InboxTab>(defaultTab);

  const handleChange = (val: string) => {
    const tab = val as InboxTab;
    setActive(tab);
    setParams({ tab }, { replace: true });
  };

  const badgeCount: Record<InboxTab, number> = {
    whatsapp: badges?.inbox ?? 0,
    instagram: 0,
    hotleads: badges?.leads ?? 0,
  };

  return (
    <div className="flex flex-col h-full -m-4 md:-m-6">
      {/* Editorial header + KPI strip + tabs */}
      <div className="bg-background/70 backdrop-blur-xl shrink-0 border-b border-border/60">
        <div className="px-6 pt-5 pb-3">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <div className="kicker">Inbox · Operação</div>
              <h1 className="section-title mt-1">Central de Conversas</h1>
            </div>
            <div className="text-[11px] text-muted-foreground tracking-editorial uppercase">
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
            </div>
          </div>
          <div className="hairline mt-4" />
        </div>

        <InboxKpiStrip />

        <Tabs value={active} onValueChange={handleChange}>
          <div className="px-6">
            <TabsList className="editorial-tabs">
              {TABS.map(({ value, label, icon: Icon }) => (
                <TabsTrigger key={value} value={value} className="editorial-tab">
                  <span className="inline-flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
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

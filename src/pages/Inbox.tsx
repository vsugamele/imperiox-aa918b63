import { lazy, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, MessageSquare, Instagram, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSidebarBadges } from "@/hooks/useSidebarBadges";

const WhatsAppPage = lazy(() => import("./WhatsAppPage"));
const InstagramPage = lazy(() => import("./InstagramPage"));

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
        <h2 className="font-display text-lg text-foreground">
          🔥 {leads.length} leads quentes — últimas 2h
        </h2>
        <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
          Score &gt; 80
        </Badge>
      </div>
      {leads.map((lead) => {
        const phone = lead.telefone?.replace(/\D/g, "");
        const waLink = phone ? `https://wa.me/${phone}` : null;
        return (
          <Card key={lead.id} className="bg-secondary/40 border-border hover:border-primary/30 transition">
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
                  {lead.telefone && <span>📱 {lead.telefone}</span>}
                  {lead.email && <span>✉️ {lead.email}</span>}
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

// ── Main Inbox ─────────────────────────────────────────────────────────────────
type InboxTab = "whatsapp" | "instagram" | "hotleads";

const TABS: { value: InboxTab; label: string; icon: React.ElementType }[] = [
  { value: "whatsapp",  label: "WhatsApp",      icon: MessageSquare },
  { value: "instagram", label: "Instagram",     icon: Instagram },
  { value: "hotleads",  label: "Hot Leads",     icon: Flame },
];

export default function Inbox() {
  const [params, setParams] = useSearchParams();
  const { data: badges } = useSidebarBadges();

  // Default to tab with most activity, or URL param
  const defaultTab = ((): InboxTab => {
    const p = params.get("tab") as InboxTab | null;
    if (p && TABS.some((t) => t.value === p)) return p;
    // Auto-select most active channel
    if ((badges?.inbox ?? 0) > 0) return "whatsapp";
    if ((badges?.leads ?? 0) > 0) return "hotleads";
    return "whatsapp";
  })();

  const [active, setActive] = useState<InboxTab>(defaultTab);

  // Keep URL in sync
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
      {/* Tab bar */}
      <div className="border-b border-border/60 bg-background/70 backdrop-blur-xl px-4 pt-3 shrink-0">
        <Tabs value={active} onValueChange={handleChange}>
          <TabsList className="bg-transparent border-0 h-auto gap-1 p-0">
            {TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex items-center gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-2 px-3 text-sm font-medium transition-colors"
              >
                <Icon className="h-4 w-4" />
                {label}
                {badgeCount[value] > 0 && (
                  <span className="min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
                    {badgeCount[value] > 99 ? "99+" : badgeCount[value]}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Tab content — full height, no extra padding */}
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

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MobileLeadCard } from "./MobileLeadCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Loader2, Search, Filter, Users, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Lead {
  id: string;
  nome: string | null;
  phone: string | null;
  email: string | null;
  score: number | null;
  status: string | null;
  created_at: string | null;
  tags: string[] | null;
}

type Segment = "all" | "hot" | "warm" | "no_answer" | "recent";

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "hot", label: "🔥 Quentes" },
  { key: "warm", label: "Mornos" },
  { key: "no_answer", label: "Sem resposta" },
  { key: "recent", label: "Últimas 24h" },
];

const PAGE = 50;

export function MobileLeadsList() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [seg, setSeg] = useState<Segment>("all");
  const [limit, setLimit] = useState(PAGE);
  const [kpis, setKpis] = useState({ total: 0, hot: 0, noResp: 0, avgScore: 0 });

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from("imphq_leads")
      .select("id, nome, phone, email, score, status, criado_em, tags")
      .order("criado_em", { ascending: false })
      .limit(300);

    if (seg === "hot") query = query.gt("score", 70);
    else if (seg === "warm") query = query.gte("score", 40).lte("score", 70);
    else if (seg === "recent") {
      const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
      query = query.gte("criado_em", dayAgo);
    }

    const { data } = await query;
    const mapped = ((data as any[]) || []).map(l => ({
      id: l.id, nome: l.nome, phone: l.phone, email: l.email,
      score: l.score, status: l.status, created_at: l.criado_em, tags: l.tags,
    })) as Lead[];
    setLeads(mapped);
    setLoading(false);

    // KPIs
    const twoHoursAgo = new Date(Date.now() - 2 * 3600_000).toISOString();
    const [totalQ, hotQ] = await Promise.all([
      supabase.from("imphq_leads").select("id", { count: "exact", head: true }),
      supabase.from("imphq_leads").select("id", { count: "exact", head: true }).gt("score", 70).gte("criado_em", twoHoursAgo),
    ]);
    const scores = mapped.map(l => l.score || 0).filter(s => s > 0);
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    setKpis({
      total: totalQ.count || 0,
      hot: hotQ.count || 0,
      noResp: 0,
      avgScore: avg,
    });
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [seg]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return leads;
    return leads.filter(l => {
      const hay = `${l.nome || ""} ${l.phone || ""} ${l.email || ""}`.toLowerCase();
      return hay.includes(term);
    });
  }, [leads, q]);

  const visible = filtered.slice(0, limit);

  const onWhats = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    window.open(`https://wa.me/${digits}`, "_blank");
  };

  const onArchive = async (lead: Lead) => {
    await supabase.from("imphq_leads").update({ status: "arquivado" } as any).eq("id", lead.id);
    setLeads(prev => prev.filter(l => l.id !== lead.id));
    toast.success("Lead arquivado");
  };

  return (
    <div className="flex flex-col h-full -m-3 md:-m-6">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-xl border-b border-border/50 px-3 pt-3 pb-2 space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, telefone..."
              className="pl-9 h-11 bg-secondary/40 border-border/50"
              style={{ fontSize: "16px" }}
            />
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button size="icon" variant="outline" className="h-11 w-11 shrink-0">
                <Filter className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[70vh]">
              <SheetHeader className="mb-4">
                <SheetTitle className="font-serif text-gold">Segmentos</SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-2 gap-2">
                {SEGMENTS.map(s => (
                  <button
                    key={s.key}
                    onClick={() => setSeg(s.key)}
                    className={cn(
                      "px-3 py-3 rounded-lg border text-sm text-left transition-colors",
                      seg === s.key
                        ? "bg-gold/15 border-gold/50 text-gold"
                        : "bg-secondary/40 border-border/50 text-foreground/80"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* KPI carousel */}
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
          <KpiPill icon={Users} label="Total" value={kpis.total} />
          <KpiPill icon={Flame} label="Hot 2h" value={kpis.hot} accent="orange" />
          <KpiPill label="Score médio" value={kpis.avgScore} />
        </div>

        {/* Segment chips */}
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
          {SEGMENTS.map(s => (
            <button
              key={s.key}
              onClick={() => setSeg(s.key)}
              className={cn(
                "shrink-0 px-3 h-8 rounded-full text-xs font-semibold border whitespace-nowrap transition-colors",
                seg === s.key
                  ? "bg-gold/15 border-gold/50 text-gold"
                  : "bg-secondary/40 border-border/50 text-muted-foreground"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando leads…
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 gap-3 px-6 text-center">
            <Users className="h-10 w-10 text-muted-foreground/30" />
            <p className="font-serif italic text-lg text-gold">Nenhum lead encontrado</p>
          </div>
        ) : (
          <>
            {visible.map(l => (
              <MobileLeadCard
                key={l.id}
                lead={l}
                onOpen={(id) => navigate(`/leads/${id}`)}
                onWhats={onWhats}
                onArchive={onArchive}
              />
            ))}
            {filtered.length > limit && (
              <button
                onClick={() => setLimit(l => l + PAGE)}
                className="w-full py-3 text-sm text-gold border border-gold/30 rounded-lg hover:bg-gold/10"
              >
                Carregar mais ({filtered.length - limit} restantes)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function KpiPill({ icon: Icon, label, value, accent }: { icon?: any; label: string; value: number | string; accent?: string }) {
  return (
    <div className={cn(
      "shrink-0 flex items-center gap-2 px-3 h-11 rounded-lg border bg-secondary/40 border-border/50",
      accent === "orange" && "border-orange-500/30"
    )}>
      {Icon && <Icon className={cn("h-4 w-4", accent === "orange" ? "text-orange-400" : "text-gold")} />}
      <div className="flex flex-col leading-tight">
        <span className={cn("text-sm font-bold", accent === "orange" ? "text-orange-400" : "text-foreground")}>{value}</span>
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Props {
  projectFilter: string;
}

const STEPS: { key: string; label: string; badge: string; color: string }[] = [
  { key: "quiz", label: "Quiz", badge: "QUIZ", color: "#ec4899" },
  { key: "vsl_view", label: "VSL Principal", badge: "VSL", color: "#3b82f6" },
  { key: "vsl_pitch", label: "Chegou ao Pitch", badge: "PITCH", color: "#facc15" },
  { key: "checkout", label: "Checkout", badge: "CHK", color: "#06b6d4" },
  { key: "upsell1", label: "Upsell 1", badge: "UP1", color: "#22c55e" },
  { key: "upsell2", label: "Upsell 2", badge: "UP2", color: "#10b981" },
  { key: "downsell1", label: "Downsell 1", badge: "DOWN1", color: "#f97316" },
  { key: "downsell2", label: "Downsell 2", badge: "DOWN2", color: "#ef4444" },
  { key: "obrigado", label: "Obrigado", badge: "OBG", color: "#a855f7" },
];

interface StepCount {
  step: string;
  liveCount: number; // sessões únicas nos últimos 2 min
  todayCount: number; // pageviews hoje
}

export default function LiveFunnelPanel({ projectFilter }: Props) {
  const { toast } = useToast();
  const [stats, setStats] = useState<StepCount[]>([]);
  const [totalOnline, setTotalOnline] = useState(0);
  const [lastEntry, setLastEntry] = useState<string | null>(null);
  const [hasData, setHasData] = useState<boolean | null>(null);
  const [showSnippet, setShowSnippet] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const since2min = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const sinceToday = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

      let liveQ: any = supabase
        .from("imphq_funnel_events")
        .select("step, session_id, created_at")
        .gte("created_at", since2min);
      let todayQ: any = supabase
        .from("imphq_funnel_events")
        .select("step, created_at")
        .gte("created_at", sinceToday)
        .neq("step", "heartbeat");

      if (projectFilter !== "all") {
        liveQ = liveQ.eq("project_id", projectFilter);
        todayQ = todayQ.eq("project_id", projectFilter);
      }

      const [liveRes, todayRes]: any = await Promise.all([liveQ, todayQ]);
      if (cancelled) return;

      const liveRows: any[] = liveRes.data || [];
      const todayRows: any[] = todayRes.data || [];

      setHasData(todayRows.length > 0 || liveRows.length > 0);

      // Live: sessões únicas por step (excluindo heartbeats só para contar etapa real, mas heartbeat conta para "online")
      const liveByStep: Record<string, Set<string>> = {};
      const allSessions = new Set<string>();
      let mostRecent: string | null = null;
      liveRows.forEach((r) => {
        if (!liveByStep[r.step]) liveByStep[r.step] = new Set();
        liveByStep[r.step].add(r.session_id);
        allSessions.add(r.session_id);
        if (!mostRecent || r.created_at > mostRecent) mostRecent = r.created_at;
      });

      const todayByStep: Record<string, number> = {};
      todayRows.forEach((r) => {
        todayByStep[r.step] = (todayByStep[r.step] || 0) + 1;
      });

      setStats(
        STEPS.map((s) => ({
          step: s.key,
          liveCount: (liveByStep[s.key] || new Set()).size,
          todayCount: todayByStep[s.key] || 0,
        })),
      );
      setTotalOnline(allSessions.size);
      setLastEntry(mostRecent);
    }

    load();
    const id = setInterval(() => { if (document.visibilityState === "visible") load(); }, 60_000); // safety fallback — Realtime handles instant updates; pausa em tab oculta

    // Realtime: novos eventos invalidam imediatamente
    // Onda 7: filtra por project_id no servidor quando possível
    const rtFilter: any = { event: "INSERT", schema: "public", table: "imphq_funnel_events" };
    if (projectFilter && projectFilter !== "all" && projectFilter !== "none") {
      rtFilter.filter = `project_id=eq.${projectFilter}`;
    }
    const ch = supabase
      .channel(`funnel_live_${projectFilter || "all"}`)
      .on("postgres_changes", rtFilter, load)
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(id);
      supabase.removeChannel(ch);
    };
  }, [projectFilter]);

  const totalToday = stats.reduce((s, x) => s + x.todayCount, 0);

  const snippet =
    projectFilter === "all"
      ? `<!-- Substitua PROJECT_ID pelo ID do projeto -->
<script src="https://imperiox.lovable.app/funnel.js"
        data-project="PROJECT_ID"
        data-step="vsl_view"
        data-pitch-at="1080"
        data-cta="#botao-comprar"></script>`
      : `<script src="https://imperiox.lovable.app/funnel.js"
        data-project="${projectFilter}"
        data-step="vsl_view"
        data-pitch-at="1080"
        data-cta="#botao-comprar"></script>`;

  const fmtLast = (iso: string | null) => {
    if (!iso) return "—";
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return `${diff}s atrás`;
    if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <>
      <Card className="bg-gradient-to-br from-emerald-500/5 to-secondary/20 border-border">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Activity className="h-4 w-4 text-emerald-400" />
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <h3 className="font-cormorant text-lg font-bold text-foreground">Funil Ao Vivo</h3>
              <Badge variant="outline" className="text-[10px]">tempo real</Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSnippet(true)}
              className="h-7 text-[11px]"
            >
              Como instalar
            </Button>
          </div>

          {hasData === false && (
            <div className="text-xs text-muted-foreground bg-secondary/30 rounded-lg p-3 leading-6">
              Nenhum evento de funil ainda. Cole o snippet em VSL, Quiz, Upsells e Obrigado para
              começar a ver o funil respirando aqui.
            </div>
          )}

          {hasData !== false && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                    Online agora
                  </p>
                  <p className="text-3xl font-mono font-bold text-emerald-400">{totalOnline}</p>
                  <p className="text-[9px] text-muted-foreground">últimos 2 min</p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                    Pageviews hoje
                  </p>
                  <p className="text-3xl font-mono font-bold text-blue-400">{totalToday}</p>
                  <p className="text-[9px] text-muted-foreground">{stats.filter((s) => s.todayCount > 0).length} etapas ativas</p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                    Última entrada
                  </p>
                  <p className="text-xl font-mono font-bold text-amber-400 mt-1">{fmtLast(lastEntry)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                {STEPS.map((s) => {
                  const data = stats.find((x) => x.step === s.key) || { liveCount: 0, todayCount: 0 };
                  const pct = totalToday > 0 ? Math.round((data.todayCount / totalToday) * 100) : 0;
                  return (
                    <div
                      key={s.key}
                      className="rounded-lg border border-border/50 bg-card/50 p-2.5 hover:border-border transition-colors"
                      style={{ borderLeftWidth: 3, borderLeftColor: s.color }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-foreground truncate">{s.label}</span>
                        <Badge variant="outline" className="text-[8px] h-4 px-1" style={{ color: s.color, borderColor: s.color }}>
                          {s.badge}
                        </Badge>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-lg font-mono font-bold" style={{ color: s.color }}>
                          {data.liveCount}
                        </span>
                        <span className="text-[9px] text-muted-foreground">agora</span>
                      </div>
                      <div className="mt-1 h-1 rounded bg-secondary/50 overflow-hidden">
                        <div className="h-full" style={{ width: `${pct}%`, background: s.color }} />
                      </div>
                      <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                        <span>{data.todayCount} hoje</span>
                        <span>{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showSnippet} onOpenChange={setShowSnippet}>
        <DialogContent className="max-w-2xl bg-secondary/40 backdrop-blur">
          <DialogHeader>
            <DialogTitle>Instalar o tracker de funil</DialogTitle>
            <DialogDescription className="leading-7">
              Cole este snippet antes do <code>&lt;/body&gt;</code> em cada página do seu funil
              (VSL, Quiz, Upsells, Downsells, Obrigado), trocando <code>data-step</code> para a
              etapa correta.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm leading-7">
            <pre className="bg-background/60 border border-border rounded-md p-3 text-[11px] font-mono overflow-auto whitespace-pre">
{snippet}
            </pre>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(snippet);
                setCopied(true);
                toast({ title: "Copiado", description: "Snippet copiado para a área de transferência." });
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
              Copiar snippet
            </Button>

            <div className="text-xs text-muted-foreground space-y-2 pt-2 border-t border-border/40">
              <p><strong className="text-foreground">data-step</strong>: <code>quiz</code> · <code>vsl_view</code> · <code>checkout</code> · <code>upsell1</code> · <code>upsell2</code> · <code>downsell1</code> · <code>downsell2</code> · <code>obrigado</code></p>
              <p><strong className="text-foreground">data-pitch-at</strong>: segundos do vídeo onde aparece a oferta (ex.: <code>1080</code> = 18min). Dispara <code>vsl_pitch</code>.</p>
              <p><strong className="text-foreground">data-cta</strong>: seletor CSS do botão de compra. Dispara <code>vsl_cta_click</code>.</p>
              <p>Heartbeats a cada 30s alimentam o "online agora". UTMs da URL são capturados automaticamente (incluindo <code>xcod</code> do Tracker).</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity, RefreshCw, AlertTriangle, CheckCircle2, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Props {
  projectId?: string | null;
}

interface Stats {
  last: string | null;
  total24h: number;
  failed24h: number;
  pending: number;
}

export default function ZernioHealthCard({ projectId }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState(false);
  const [pollingComments, setPollingComments] = useState(false);

  async function load() {
    setLoading(true);
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const [{ data: last }, { count: total }, { count: failed }, { count: pending }] = await Promise.all([
      supabase.from("imphq_ig_webhook_logs").select("created_at").like("event_type", "zernio_%").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("imphq_ig_webhook_logs").select("id", { count: "exact", head: true }).like("event_type", "zernio_%").gte("created_at", since),
      supabase.from("imphq_ig_webhook_logs").select("id", { count: "exact", head: true }).like("event_type", "zernio_%").not("error", "is", null).gte("created_at", since),
      supabase.from("imphq_ig_webhook_logs").select("id", { count: "exact", head: true }).like("event_type", "zernio_%").eq("processed", false).gte("created_at", since),
    ] as PromiseLike<any>[]);
    setStats({
      last: (last as any)?.created_at || null,
      total24h: total ?? 0,
      failed24h: failed ?? 0,
      pending: pending ?? 0,
    });
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleReprocess() {
    setReprocessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("ig-webhook-reprocess", {
        body: { project_id: projectId || undefined, hours: 24, limit: 100 },
      });
      if (error) throw error;
      toast({
        title: "Reprocessamento concluído",
        description: `${data?.reprocessed ?? 0} eventos reprocessados, ${data?.failed ?? 0} falharam.`,
      });
      await load();
    } catch (e: any) {
      toast({ title: "Erro ao reprocessar", description: e.message, variant: "destructive" });
    } finally {
      setReprocessing(false);
    }
  }

  const lastMin = stats?.last ? Math.floor((Date.now() - new Date(stats.last).getTime()) / 60_000) : null;
  const healthy = lastMin !== null && lastMin < 60 && (stats?.failed24h ?? 0) === 0;

  return (
    <Card className="bg-secondary/40 border-border/60">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-amber-400" />
            <h4 className="text-sm font-semibold">Saúde do Zernio</h4>
            {!loading && (
              healthy
                ? <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px]"><CheckCircle2 className="h-2.5 w-2.5 mr-1" />OK</Badge>
                : <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-[10px]"><AlertTriangle className="h-2.5 w-2.5 mr-1" />Atenção</Badge>
            )}
          </div>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2 mb-3">
              <div className="text-center bg-background/40 rounded p-2">
                <div className="text-base font-bold">{stats?.total24h ?? 0}</div>
                <div className="text-[9px] uppercase text-muted-foreground">24h</div>
              </div>
              <div className="text-center bg-background/40 rounded p-2">
                <div className={`text-base font-bold ${(stats?.pending ?? 0) > 0 ? "text-amber-400" : ""}`}>{stats?.pending ?? 0}</div>
                <div className="text-[9px] uppercase text-muted-foreground">Pendentes</div>
              </div>
              <div className="text-center bg-background/40 rounded p-2">
                <div className={`text-base font-bold ${(stats?.failed24h ?? 0) > 0 ? "text-red-400" : ""}`}>{stats?.failed24h ?? 0}</div>
                <div className="text-[9px] uppercase text-muted-foreground">Falhas</div>
              </div>
              <div className="text-center bg-background/40 rounded p-2">
                <div className="text-base font-bold">{lastMin !== null ? `${lastMin}m` : "—"}</div>
                <div className="text-[9px] uppercase text-muted-foreground">Último</div>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs h-7 gap-1.5 mb-2"
              onClick={handleReprocess}
              disabled={reprocessing || (stats?.pending ?? 0) === 0}
            >
              {reprocessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Reprocessar pendentes
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs h-7 gap-1.5"
              onClick={async () => {
                setPollingComments(true);
                try {
                  const { data, error } = await supabase.functions.invoke("ig-comments-poller", {
                    body: { project_id: projectId || undefined },
                  });
                  if (error) throw error;
                  toast({
                    title: "Comentários sincronizados",
                    description: `${data?.comments_upserted ?? 0} comentários em ${data?.posts_scanned ?? 0} posts.`,
                  });
                } catch (e: any) {
                  toast({ title: "Erro ao sincronizar", description: e.message, variant: "destructive" });
                } finally {
                  setPollingComments(false);
                }
              }}
              disabled={pollingComments}
            >
              {pollingComments ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3 w-3" />}
              Sincronizar comentários agora
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

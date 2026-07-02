import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Play, X as XIcon, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Exec = {
  comment_id: string;
  trigger_id: string;
  event_type: string;
  status: string;
  attempts: number;
  next_retry_at: string | null;
  last_error: string | null;
  author_key: string | null;
  payload: any;
  created_at: string;
  updated_at: string;
};

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  sent: { label: "Enviado", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
  retrying: { label: "Aguardando retry", color: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: Clock },
  pending: { label: "Pendente", color: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: Clock },
  dead: { label: "Falha final", color: "bg-red-500/15 text-red-400 border-red-500/30", icon: AlertTriangle },
};

export default function ZernioMonitorPanel({ projectId }: { projectId?: string }) {
  const [rows, setRows] = useState<Exec[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q: any = supabase
        .from("imphq_ig_trigger_executions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error } = await q;
      if (error) throw error;
      setRows((data || []) as Exec[]);
    } catch (e: any) {
      toast.error("Erro ao carregar execuções: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const kpis = useMemo(() => {
    const c = { sent: 0, retrying: 0, dead: 0, total: rows.length };
    rows.forEach((r) => { if (r.status in c) (c as any)[r.status]++; });
    return c;
  }, [rows]);

  const runWorker = async () => {
    setRetrying(true);
    try {
      const { data, error } = await supabase.functions.invoke("zernio-retry-worker", {});
      if (error) throw error;
      toast.success(`Worker: ${data?.recovered || 0} recuperadas, ${data?.dead || 0} mortas (${data?.processed || 0} processadas)`);
      load();
    } catch (e: any) {
      toast.error("Erro no worker: " + e.message);
    } finally {
      setRetrying(false);
    }
  };

  const retryOne = async (row: Exec) => {
    try {
      await supabase.from("imphq_ig_trigger_executions").update({
        status: "retrying",
        next_retry_at: new Date().toISOString(),
      }).eq("comment_id", row.comment_id);
      toast.success("Reagendado. Rodando worker…");
      await runWorker();
    } catch (e: any) {
      toast.error("Erro ao reagendar: " + e.message);
    }
  };

  const killOne = async (row: Exec) => {
    if (!confirm("Marcar como morta (não tenta mais)?")) return;
    await supabase.from("imphq_ig_trigger_executions").update({ status: "dead", next_retry_at: null }).eq("comment_id", row.comment_id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-semibold">🔎 Monitor Zernio · Execuções</h2>
          <p className="text-sm text-muted-foreground">Auditoria em tempo real dos disparos de comentário/DM/story.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Recarregar
          </Button>
          <Button size="sm" onClick={runWorker} disabled={retrying}>
            {retrying ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />} Rodar retry agora
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { key: "all", label: "Total", value: kpis.total, cls: "" },
          { key: "sent", label: "Enviados", value: kpis.sent, cls: "text-emerald-400" },
          { key: "retrying", label: "Retry", value: kpis.retrying, cls: "text-amber-400" },
          { key: "dead", label: "Falha final", value: kpis.dead, cls: "text-red-400" },
        ].map((k) => (
          <Card
            key={k.key}
            className={`p-4 cursor-pointer transition ${filter === k.key ? "ring-2 ring-primary" : ""}`}
            onClick={() => setFilter(k.key)}
          >
            <div className="text-xs text-muted-foreground">{k.label}</div>
            <div className={`text-2xl font-semibold ${k.cls}`}>{k.value}</div>
          </Card>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs uppercase text-muted-foreground sticky top-0">
              <tr>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Evento</th>
                <th className="text-left p-3">Autor</th>
                <th className="text-left p-3">Erro / Info</th>
                <th className="text-left p-3">Tentativas</th>
                <th className="text-left p-3">Próximo retry</th>
                <th className="text-left p-3">Quando</th>
                <th className="text-right p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr><td colSpan={8} className="text-center p-6 text-muted-foreground">Nenhuma execução encontrada.</td></tr>
              )}
              {rows.map((r) => {
                const st = STATUS_MAP[r.status] || STATUS_MAP.pending;
                const Icon = st.icon;
                return (
                  <tr key={r.comment_id} className="border-t border-border/40 hover:bg-secondary/20">
                    <td className="p-3">
                      <Badge variant="outline" className={st.color}>
                        <Icon className="h-3 w-3 mr-1" /> {st.label}
                      </Badge>
                    </td>
                    <td className="p-3">{r.event_type}</td>
                    <td className="p-3 text-xs">{r.author_key || "—"}</td>
                    <td className="p-3 text-xs text-red-300 max-w-[280px] truncate" title={r.last_error || ""}>
                      {r.last_error || "—"}
                    </td>
                    <td className="p-3 text-center">{r.attempts}</td>
                    <td className="p-3 text-xs">{r.next_retry_at ? formatDistanceToNow(new Date(r.next_retry_at), { locale: ptBR, addSuffix: true }) : "—"}</td>
                    <td className="p-3 text-xs">{formatDistanceToNow(new Date(r.created_at), { locale: ptBR, addSuffix: true })}</td>
                    <td className="p-3 text-right space-x-1">
                      {(r.status === "retrying" || r.status === "dead") && (
                        <Button size="sm" variant="ghost" onClick={() => retryOne(r)} title="Retentar agora">
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      )}
                      {r.status === "retrying" && (
                        <Button size="sm" variant="ghost" onClick={() => killOne(r)} title="Cancelar retries">
                          <XIcon className="h-3 w-3" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

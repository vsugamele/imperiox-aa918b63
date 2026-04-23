import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { buildRecoveryBuckets, formatCurrency } from "@/lib/recoveryBuckets";

interface RecoveryKpiBlockProps {
  projectId: string;
}

export function RecoveryKpiBlock({ projectId }: RecoveryKpiBlockProps) {
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const salesFrom = new Date(Date.now() - 45 * 86400000).toISOString();
      const logsFrom = new Date(Date.now() - 90 * 86400000).toISOString();

      const [salesRes, leadsRes, logsRes] = await Promise.all([
        supabase.from("imphq_vendas").select("id, project_id, lead_id, produto_nome, status, valor, created_at, data_venda, data").eq("project_id", projectId).gte("created_at", salesFrom),
        supabase.from("imphq_leads").select("id, project_id, nome, email, phone, status, criado_em, updated_at, data").eq("project_id", projectId).limit(1000),
        supabase.from("imphq_recovery_logs").select("*").eq("project_id", projectId).gte("created_at", logsFrom),
      ]);

      setSales(salesRes.data || []);
      setLeads(leadsRes.data || []);
      setLogs((logsRes.data || []).filter((log: any) => !!log.created_at));
      setLoading(false);
    })();
  }, [projectId]);

  const stats = useMemo(() => {
    const buckets = buildRecoveryBuckets({ vendas: sales, leads, logs });
    const currentRisk = buckets
      .filter((bucket) => bucket.id !== "refunds")
      .reduce((sum, bucket) => sum + bucket.totalValue, 0);

    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    const recoveredLogs = logs.filter((log: any) => new Date(log.created_at).getTime() >= monthStart && String(log.status || "").toLowerCase().includes("recuperado"));
    const recoveredValue = recoveredLogs.reduce((sum: number, log: any) => sum + (Number(log.valor) || 0), 0);

    return { currentRisk, recoveredValue, recoveredCount: recoveredLogs.length };
  }, [sales, leads, logs]);

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-primary" /> Recuperação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {loading ? (
          <p className="text-xs text-muted-foreground">Carregando recuperação...</p>
        ) : (
          <>
            <div className="rounded-md border border-border bg-muted/20 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Recuperado este mês</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{formatCurrency(stats.recoveredValue)}</p>
              <p className="text-xs text-muted-foreground">{stats.recoveredCount} ações marcadas como recuperadas</p>
            </div>

            <div className="rounded-md border border-border bg-muted/20 p-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Em risco agora</p>
              </div>
              <p className="mt-1 text-lg font-semibold text-foreground">{formatCurrency(stats.currentRisk)}</p>
            </div>

            <Button asChild variant="outline" className="w-full">
              <Link to={`/recuperacao?projeto=${projectId}`}>Ver detalhes</Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

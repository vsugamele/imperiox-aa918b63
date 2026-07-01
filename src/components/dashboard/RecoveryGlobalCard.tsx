import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, TrendingUp, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { buildRecoveryBuckets, formatCurrency } from "@/lib/recoveryBuckets";

interface Props {
  projectFilter?: string; // "all" ou um project_id
  onRiskChange?: (currentRisk: number) => void;
}

export default function RecoveryGlobalCard({ projectFilter = "all", onRiskChange }: Props) {
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const salesFrom = new Date(Date.now() - 45 * 86400000).toISOString();
      const logsFrom = new Date(Date.now() - 90 * 86400000).toISOString();

      let salesQ = supabase.from("imphq_vendas").select("id, project_id, lead_id, produto_nome, status, valor, created_at, data_venda, data").gte("created_at", salesFrom).limit(2000);
      let leadsQ = supabase.from("imphq_leads").select("id, project_id, nome, email, phone, status, criado_em, updated_at, data").limit(2000);
      let logsQ = supabase.from("imphq_recovery_logs").select("id, project_id, lead_id, venda_id, bucket, status, valor, created_at").gte("created_at", logsFrom).limit(2000);

      if (projectFilter && projectFilter !== "all") {
        salesQ = salesQ.eq("project_id", projectFilter);
        leadsQ = leadsQ.eq("project_id", projectFilter);
        logsQ = logsQ.eq("project_id", projectFilter);
      }

      const [salesRes, leadsRes, logsRes] = await Promise.all([salesQ, leadsQ, logsQ]);
      if (cancelled) return;
      setSales(salesRes.data || []);
      setLeads(leadsRes.data || []);
      setLogs((logsRes.data || []).filter((log: any) => !!log.created_at));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [projectFilter]);

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

  useEffect(() => {
    onRiskChange?.(stats.currentRisk);
  }, [stats.currentRisk, onRiskChange]);

  const recoveryHref = projectFilter && projectFilter !== "all" ? `/recuperacao?projeto=${projectFilter}` : "/recuperacao";

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-primary" /> Recuperação {projectFilter === "all" ? "(global)" : ""}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {loading ? (
          <p className="text-xs text-muted-foreground">Carregando recuperação...</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-border bg-muted/20 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Recuperado este mês</p>
                <p className="mt-1 text-lg font-semibold text-emerald-400">{formatCurrency(stats.recoveredValue)}</p>
                <p className="text-[10px] text-muted-foreground">{stats.recoveredCount} ações</p>
              </div>
              <div className="rounded-md border border-border bg-muted/20 p-3">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-amber-400" />
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Em risco agora</p>
                </div>
                <p className="mt-1 text-lg font-semibold text-amber-400">{formatCurrency(stats.currentRisk)}</p>
              </div>
            </div>
            <Button asChild variant="outline" className="w-full h-8 text-xs">
              <Link to={recoveryHref} className="flex items-center justify-center gap-1.5">
                Ver detalhes
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

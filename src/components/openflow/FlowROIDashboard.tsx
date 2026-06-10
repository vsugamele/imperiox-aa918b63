import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, DollarSign, Users, RefreshCw, Zap, BarChart3 } from "lucide-react";
import { toast } from "sonner";

interface ROIRow {
  automacao_id: string;
  automacao_nome: string;
  conversions: number;
  revenue_total: number;
  avg_ticket: number;
  leads_touched: number;
}

interface Props {
  projectId: string;
}

const PERIODS = [
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
];

export default function FlowROIDashboard({ projectId }: Props) {
  const [rows, setRows] = useState<ROIRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState(30);

  const fetchROI = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const since = new Date(Date.now() - period * 24 * 3600 * 1000).toISOString();
      const { data, error } = await supabase.rpc("flow_roi_by_automation", {
        p_project_id: projectId,
        p_since: since,
      });
      if (error) throw error;
      setRows((data as ROIRow[]) || []);
    } catch (err: any) {
      console.error("[FlowROIDashboard]", err);
      toast.error("Erro ao carregar ROI dos fluxos: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchROI(); }, [projectId, period]);

  const totalRevenue = rows.reduce((s, r) => s + Number(r.revenue_total), 0);
  const totalConversions = rows.reduce((s, r) => s + Number(r.conversions), 0);
  const totalTouched = rows.reduce((s, r) => s + Number(r.leads_touched), 0);

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  const convRate = (row: ROIRow) =>
    row.leads_touched > 0 ? ((row.conversions / row.leads_touched) * 100).toFixed(1) : "0.0";

  return (
    <Card className="bg-secondary/20 border-primary/20">
      <CardHeader className="pb-3 border-b border-border/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-serif text-primary">
              <BarChart3 className="h-4 w-4" /> ROI por Fluxo de Automação
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Receita atribuída a cada fluxo que tocou leads convertidos.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {PERIODS.map((p) => (
                <Button
                  key={p.days}
                  size="sm"
                  variant={period === p.days ? "default" : "outline"}
                  className="h-7 text-xs px-2.5"
                  onClick={() => setPeriod(p.days)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-border/60 text-xs"
              onClick={fetchROI}
              disabled={loading}
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-5">
        {/* Totais */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card/40 border border-emerald-500/20 rounded-xl p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 uppercase tracking-wider">
              <DollarSign className="h-3 w-3" /> Receita Total
            </div>
            <p className="text-xl font-bold text-emerald-400">{fmt(totalRevenue)}</p>
          </div>
          <div className="bg-card/40 border border-border/40 rounded-xl p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
              <TrendingUp className="h-3 w-3 text-primary" /> Conversões
            </div>
            <p className="text-xl font-bold text-foreground">{totalConversions}</p>
          </div>
          <div className="bg-card/40 border border-border/40 rounded-xl p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
              <Users className="h-3 w-3 text-primary" /> Leads Alcançados
            </div>
            <p className="text-xl font-bold text-foreground">{totalTouched}</p>
          </div>
        </div>

        {/* Tabela por fluxo */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 bg-muted/20 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            <Zap className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">Nenhuma conversão atribuída a fluxos neste período.</p>
            <p className="text-[10px] mt-1 opacity-60">
              Dados aparecem quando leads convertem enquanto estão em um fluxo ativo.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((row, idx) => {
              const maxRevenue = rows[0]?.revenue_total || 1;
              const barPct = Math.min(100, (Number(row.revenue_total) / Number(maxRevenue)) * 100);
              return (
                <div
                  key={row.automacao_id || idx}
                  className="bg-card/30 border border-border/40 rounded-xl p-3 space-y-2 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="text-[9px] shrink-0 text-primary bg-primary/5">
                        #{idx + 1}
                      </Badge>
                      <span className="text-xs font-medium text-foreground truncate">
                        {row.automacao_nome || row.automacao_id?.substring(0, 16) || "—"}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-emerald-400 shrink-0">
                      {fmt(Number(row.revenue_total))}
                    </span>
                  </div>

                  {/* Bar */}
                  <div className="w-full h-1.5 bg-secondary/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-700"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>

                  <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                    <span>{row.conversions} conversões</span>
                    <span>·</span>
                    <span>Ticket médio {fmt(Number(row.avg_ticket))}</span>
                    <span>·</span>
                    <span>{row.leads_touched} leads alcançados</span>
                    <span>·</span>
                    <span className={Number(convRate(row)) >= 5 ? "text-emerald-400" : ""}>
                      {convRate(row)}% conv.
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Crown, TrendingUp, TrendingDown, Flame, AlertTriangle, ArrowRight } from "lucide-react";

interface Props {
  projectFilter: string;
}

interface Summary {
  receitaMes: number;
  receitaMesPassado: number;
  metaMes: number | null;
  roasMes: number;
  roasMesPassado: number;
  hotLeads: number;
  topRisco: string | null;
}

const CACHE = new Map<string, { ts: number; data: Summary }>();
const TTL = 5 * 60 * 1000;

function monthRange(offset = 0) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  return { from: from.toISOString(), to: to.toISOString(), fromDate: from.toISOString().slice(0, 10), toDate: to.toISOString().slice(0, 10) };
}

export default function ExecutiveSummary({ projectFilter }: Props) {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const key = projectFilter || "all";
    const cached = CACHE.get(key);
    if (cached && Date.now() - cached.ts < TTL) {
      setData(cached.data);
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const hasProject = projectFilter && projectFilter !== "all";
      const cur = monthRange(0);
      const prev = monthRange(-1);
      const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();

      let vendasCurQ = supabase.from("imphq_vendas").select("valor, status, created_at, project_id").eq("status", "aprovado").gte("created_at", cur.from).lt("created_at", cur.to);
      let vendasPrevQ = supabase.from("imphq_vendas").select("valor, status, created_at, project_id").eq("status", "aprovado").gte("created_at", prev.from).lt("created_at", prev.to);
      let adsCurQ = supabase.from("imphq_ads_spend").select("valor, data_ref, project_id").gte("data_ref", cur.fromDate).lt("data_ref", cur.toDate);
      let adsPrevQ = supabase.from("imphq_ads_spend").select("valor, data_ref, project_id").gte("data_ref", prev.fromDate).lt("data_ref", prev.toDate);
      let hotQ = supabase.from("imphq_leads").select("id", { count: "exact", head: true })
        .in("data->>ultimo_evento", ["pix_gerado", "boleto_gerado", "aguardando_pagamento", "carrinho_abandonado"])
        .gte("updated_at", twoHoursAgo)
        .neq("status", "cliente");

      if (hasProject) {
        vendasCurQ = vendasCurQ.eq("project_id", projectFilter);
        vendasPrevQ = vendasPrevQ.eq("project_id", projectFilter);
        adsCurQ = adsCurQ.eq("project_id", projectFilter);
        adsPrevQ = adsPrevQ.eq("project_id", projectFilter);
        hotQ = hotQ.eq("project_id", projectFilter);
      }

      const [vCur, vPrev, aCur, aPrev, hot] = await Promise.all([vendasCurQ, vendasPrevQ, adsCurQ, adsPrevQ, hotQ]);

      const sum = (rows: any[], key: string) => (rows || []).reduce((a, r) => a + (parseFloat(r[key]) || 0), 0);
      const receitaMes = sum(vCur.data || [], "valor");
      const receitaMesPassado = sum(vPrev.data || [], "valor");
      const adsMes = sum(aCur.data || [], "valor");
      const adsMesPassado = sum(aPrev.data || [], "valor");
      const roasMes = adsMes > 0 ? receitaMes / adsMes : 0;
      const roasMesPassado = adsMesPassado > 0 ? receitaMesPassado / adsMesPassado : 0;

      let topRisco: string | null = null;
      if (roasMes > 0 && roasMes < 1) topRisco = `ROAS ${roasMes.toFixed(2)}x — prejuízo em Ads`;
      else if (roasMesPassado > 1 && roasMes < roasMesPassado * 0.7) topRisco = `ROAS caiu ${(((roasMesPassado - roasMes) / roasMesPassado) * 100).toFixed(0)}% vs mês anterior`;
      else if (receitaMesPassado > 0 && receitaMes < receitaMesPassado * 0.5) topRisco = `Receita despencou ${(((receitaMesPassado - receitaMes) / receitaMesPassado) * 100).toFixed(0)}%`;

      const summary: Summary = {
        receitaMes, receitaMesPassado, metaMes: null, roasMes, roasMesPassado,
        hotLeads: hot.count || 0, topRisco,
      };
      CACHE.set(key, { ts: Date.now(), data: summary });
      setData(summary);
      setLoading(false);
    })();
  }, [projectFilter]);

  if (loading) {
    return <Skeleton className="h-32 w-full rounded-xl" />;
  }
  if (!data) return null;

  const receitaDelta = data.receitaMesPassado > 0 ? ((data.receitaMes - data.receitaMesPassado) / data.receitaMesPassado) * 100 : 0;
  const receitaUp = receitaDelta >= 0;
  const roasUp = data.roasMes >= data.roasMesPassado;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Crown className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-semibold text-primary uppercase tracking-wider">Resumo Executivo</h2>
          <Badge variant="outline" className="text-[10px] ml-auto">Mês atual</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Receita mês */}
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Receita do mês</p>
            <p className="text-2xl font-mono font-bold text-emerald-400">R$ {data.receitaMes.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</p>
            <p className={`text-[11px] flex items-center gap-1 ${receitaUp ? "text-emerald-400" : "text-red-400"}`}>
              {receitaUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {receitaUp ? "+" : ""}{receitaDelta.toFixed(1)}% vs mês anterior
            </p>
          </div>

          {/* ROAS */}
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">ROAS atual</p>
            <p className={`text-2xl font-mono font-bold ${data.roasMes >= 2 ? "text-emerald-400" : data.roasMes >= 1 ? "text-amber-400" : "text-red-400"}`}>
              {data.roasMes > 0 ? `${data.roasMes.toFixed(2)}x` : "—"}
            </p>
            <p className={`text-[11px] flex items-center gap-1 ${roasUp ? "text-emerald-400" : "text-red-400"}`}>
              {roasUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {data.roasMesPassado > 0 ? `era ${data.roasMesPassado.toFixed(2)}x` : "sem histórico"}
            </p>
          </div>

          {/* Hot leads */}
          <Link to="/leads" className="space-y-1 group">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Leads quentes (2h)</p>
            <p className="text-2xl font-mono font-bold text-amber-400 flex items-center gap-1 group-hover:text-amber-300">
              <Flame className="h-5 w-5" /> {data.hotLeads}
            </p>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 group-hover:text-foreground">
              aguardando ação <ArrowRight className="h-3 w-3" />
            </p>
          </Link>

          {/* Risco */}
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Maior risco</p>
            {data.topRisco ? (
              <>
                <p className="text-sm font-medium text-red-400 flex items-start gap-1.5 leading-snug">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{data.topRisco}</span>
                </p>
                <Link to="/gerenciador" className="text-[11px] text-primary hover:underline">Investigar →</Link>
              </>
            ) : (
              <p className="text-sm text-emerald-400 flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4" /> Tudo nos trilhos
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

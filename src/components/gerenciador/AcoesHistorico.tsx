import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Activity, Play, Pause, Check, X, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Action {
  id: string;
  created_at: string;
  plataforma: string;
  tipo: string;
  entidade_id: string;
  entidade_nome: string | null;
  acao: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  resultado: string;
  erro_msg: string | null;
  duracao_ms: number | null;
  project_id?: string | null;
}

type Impact = {
  spendBefore: number; spendAfter: number;
  ctrBefore: number; ctrAfter: number;
  hasData: boolean;
};

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

function fmtBRL(v: number) {
  if (v >= 1000) return `R$${(v / 1000).toFixed(1)}k`;
  return `R$${v.toFixed(0)}`;
}

export function AcoesHistorico({ projectId }: { projectId?: string }) {
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [impacts, setImpacts] = useState<Record<string, Impact>>({});

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      let q = supabase.from("imphq_ads_actions").select("*").order("created_at", { ascending: false }).limit(50);
      if (projectId) q = q.eq("project_id", projectId);
      const { data } = await q;
      if (!active) return;
      const list = (data as Action[]) || [];
      setActions(list);
      setLoading(false);

      // Carregar impactos: 14 dias ao redor de cada ação
      if (list.length > 0) {
        const oldest = list[list.length - 1].created_at;
        const since = new Date(new Date(oldest).getTime() - 8 * 86400000).toISOString().slice(0, 10);
        const entityIds = Array.from(new Set(list.map(a => a.entidade_id).filter(Boolean)));
        if (entityIds.length === 0) return;

        // Query spend by any of: ad_id, adset_id, campaign_id
        const { data: spendRows } = await supabase
          .from("imphq_ads_spend")
          .select("ad_id, adset_id, campaign_id, ctr, valor, data_ref")
          .gte("data_ref", since)
          .or(`ad_id.in.(${entityIds.map(e => `"${e}"`).join(",")}),adset_id.in.(${entityIds.map(e => `"${e}"`).join(",")}),campaign_id.in.(${entityIds.map(e => `"${e}"`).join(",")})`)
          .limit(5000);

        const rows = (spendRows || []) as any[];
        const map: Record<string, Impact> = {};
        for (const a of list) {
          const t = new Date(a.created_at).getTime();
          const beforeStart = new Date(t - 7 * 86400000).toISOString().slice(0, 10);
          const beforeEnd = new Date(t - 1).toISOString().slice(0, 10);
          const afterStart = new Date(t).toISOString().slice(0, 10);
          const afterEnd = new Date(t + 7 * 86400000).toISOString().slice(0, 10);

          const entRows = rows.filter(r => r.ad_id === a.entidade_id || r.adset_id === a.entidade_id || r.campaign_id === a.entidade_id);
          const before = entRows.filter(r => r.data_ref >= beforeStart && r.data_ref <= beforeEnd);
          const after = entRows.filter(r => r.data_ref >= afterStart && r.data_ref <= afterEnd);

          const avgCtr = (arr: any[]) => arr.length ? arr.reduce((s, r) => s + Number(r.ctr ?? 0), 0) / arr.length : 0;
          const sumSpend = (arr: any[]) => arr.reduce((s, r) => s + Number(r.valor ?? 0), 0);

          map[a.id] = {
            spendBefore: sumSpend(before),
            spendAfter: sumSpend(after),
            ctrBefore: avgCtr(before),
            ctrAfter: avgCtr(after),
            hasData: before.length > 0 || after.length > 0,
          };
        }
        if (active) setImpacts(map);
      }
    })();
    return () => { active = false; };
  }, [projectId]);

  const renderImpact = (a: Action) => {
    const imp = impacts[a.id];
    if (!imp || !imp.hasData) {
      const tooRecent = (Date.now() - new Date(a.created_at).getTime()) < 48 * 3600 * 1000;
      return <span className="text-muted-foreground/60 text-[10px]">{tooRecent ? "aguardando 7d" : "—"}</span>;
    }
    const ctrDelta = imp.ctrAfter - imp.ctrBefore;
    const spendDelta = imp.spendAfter - imp.spendBefore;

    // Para pausa: queremos spend menor (bom) — vermelho seria spend subindo
    const isPause = a.acao === "pausou";
    const ctrUp = ctrDelta > 0.05;
    const ctrDown = ctrDelta < -0.05;

    return (
      <div className="flex flex-col gap-0.5 text-[10px] tabular-nums">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground/70">CTR</span>
          <span>{imp.ctrBefore.toFixed(2)}→{imp.ctrAfter.toFixed(2)}%</span>
          {ctrUp && <TrendingUp className="h-2.5 w-2.5 text-emerald-400" />}
          {ctrDown && <TrendingDown className="h-2.5 w-2.5 text-red-400" />}
          {!ctrUp && !ctrDown && <Minus className="h-2.5 w-2.5 text-muted-foreground/60" />}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground/70">Gasto</span>
          <span>{fmtBRL(imp.spendBefore)}→{fmtBRL(imp.spendAfter)}</span>
          {isPause && spendDelta < 0 && <Check className="h-2.5 w-2.5 text-emerald-400" />}
          {isPause && spendDelta > 0 && <X className="h-2.5 w-2.5 text-amber-400" />}
        </div>
      </div>
    );
  };

  const summary = useMemo(() => {
    const withData = Object.values(impacts).filter(i => i.hasData);
    if (withData.length === 0) return null;
    const ctrGains = withData.filter(i => i.ctrAfter - i.ctrBefore > 0.05).length;
    const ctrLosses = withData.filter(i => i.ctrAfter - i.ctrBefore < -0.05).length;
    return { total: withData.length, ctrGains, ctrLosses };
  }, [impacts]);

  return (
    <Card className="bg-secondary/40 border-border/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base font-light tracking-wide">
          <span className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Histórico de Ações
          </span>
          {summary && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-normal">
              Impacto: <span className="text-emerald-400">{summary.ctrGains} positivos</span> · <span className="text-red-400">{summary.ctrLosses} negativos</span> de {summary.total}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-border/30 hover:bg-transparent">
              <TableHead className="text-[10px] uppercase tracking-wider">Quando</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider">Ação</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider">Plat.</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider">Tipo</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider">Entidade</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider" title="CTR e gasto 7d antes vs 7d depois da ação">Impacto (7d antes→depois)</TableHead>
              <TableHead className="text-[10px] uppercase tracking-wider">Resultado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6 text-xs">Carregando...</TableCell></TableRow>
            )}
            {!loading && actions.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6 text-xs">Nenhuma ação registrada ainda.</TableCell></TableRow>
            )}
            {actions.map((a) => (
              <TableRow key={a.id} className="border-border/20 text-xs">
                <TableCell className="tabular-nums text-muted-foreground">{fmtTime(a.created_at)}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1">
                    {a.acao === "ativou" ? <Play className="h-3 w-3 text-emerald-400" /> : <Pause className="h-3 w-3 text-amber-400" />}
                    {a.acao.charAt(0).toUpperCase() + a.acao.slice(1)}
                  </span>
                </TableCell>
                <TableCell><Badge variant="outline" className="text-[10px] uppercase font-medium">{a.plataforma === "Facebook" ? "META" : a.plataforma}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{a.tipo}</TableCell>
                <TableCell className="max-w-[220px] truncate" title={a.entidade_nome || a.entidade_id}>{a.entidade_nome || a.entidade_id}</TableCell>
                <TableCell>{renderImpact(a)}</TableCell>
                <TableCell>
                  {a.resultado === "ok" ? (
                    <span className="inline-flex items-center gap-1 text-emerald-300"><Check className="h-3 w-3" />ok</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-red-300" title={a.erro_msg || ""}><X className="h-3 w-3" />erro</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

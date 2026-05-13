import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, TrendingUp, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  projectFilter?: string; // "all" ou project_id
}

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);

export default function AIRevenueRecoveredCard({ projectFilter = "all" }: Props) {
  const [loading, setLoading] = useState(true);
  const [actions, setActions] = useState<any[]>([]);
  const [vendas, setVendas] = useState<any[]>([]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - 30 * 86400000).toISOString();

      let aq = supabase
        .from("imphq_ai_actions")
        .select("id, kind, payload, projeto_id, executed_at, status, created_at")
        .in("kind", ["payment_recovery", "hot_lead_responder"])
        .eq("status", "executed")
        .gte("executed_at", since)
        .limit(2000);
      if (projectFilter !== "all") aq = aq.eq("projeto_id", projectFilter);

      let vq = supabase
        .from("imphq_vendas")
        .select("id, lead_id, valor, status, data_venda, created_at, project_id")
        .gte("created_at", since)
        .in("status", ["pago", "aprovado", "approved", "paid"])
        .limit(5000);
      if (projectFilter !== "all") vq = vq.eq("project_id", projectFilter);

      const [aRes, vRes] = await Promise.all([aq, vq]);
      if (cancel) return;
      setActions(aRes.data || []);
      setVendas(vRes.data || []);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [projectFilter]);

  const stats = useMemo(() => {
    // Para cada ação, ver se houve venda paga do mesmo lead em até 48h após executed_at.
    let recovered = 0;
    let recoveredCount = 0;
    let touches = actions.length;
    const seenVenda = new Set<string>();

    const vByLead = new Map<string, any[]>();
    for (const v of vendas) {
      if (!v.lead_id) continue;
      const arr = vByLead.get(v.lead_id) || [];
      arr.push(v);
      vByLead.set(v.lead_id, arr);
    }

    for (const a of actions) {
      const leadId = a.payload?.lead_id;
      if (!leadId) continue;
      const t0 = new Date(a.executed_at || a.created_at).getTime();
      const candidates = vByLead.get(leadId) || [];
      for (const v of candidates) {
        const tv = new Date(v.data_venda || v.created_at).getTime();
        if (tv >= t0 && tv - t0 <= 48 * 3600 * 1000 && !seenVenda.has(v.id)) {
          seenVenda.add(v.id);
          recovered += Number(v.valor || 0);
          recoveredCount++;
          break;
        }
      }
    }

    const byKind: Record<string, number> = {};
    for (const a of actions) byKind[a.kind] = (byKind[a.kind] || 0) + 1;

    return { recovered, recoveredCount, touches, byKind };
  }, [actions, vendas]);

  return (
    <Card className="bg-secondary/40 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-serif">
            <Bot className="h-4 w-4 text-primary" />
            Receita Recuperada pela IA
          </CardTitle>
          <Link to="/imperius" className="text-xs text-primary hover:underline flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Imperius
          </Link>
        </div>
        <p className="text-xs text-muted-foreground leading-7">
          Vendas pagas em até 48h após um toque autônomo (recovery / hot lead). Últimos 30 dias.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-20 animate-pulse bg-muted/30 rounded" />
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-2xl font-serif text-primary flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                {fmt(stats.recovered)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Recuperado</div>
            </div>
            <div>
              <div className="text-2xl font-serif">{stats.recoveredCount}</div>
              <div className="text-xs text-muted-foreground mt-1">Vendas atribuídas</div>
            </div>
            <div>
              <div className="text-2xl font-serif">{stats.touches}</div>
              <div className="text-xs text-muted-foreground mt-1">Toques IA</div>
            </div>
          </div>
        )}
        <div className="flex gap-2 mt-4 flex-wrap">
          {Object.entries(stats.byKind).map(([k, n]) => (
            <Badge key={k} variant="outline" className="text-xs">
              {k === "payment_recovery" ? "Recovery Pix" : "Hot Lead"} · {n}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

export default function Metas() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const sb: any = supabase;
      const now = new Date();
      const ano = now.getFullYear();
      const mes = now.getMonth() + 1;
      const monthStart = `${ano}-${String(mes).padStart(2, "0")}-01T03:00:00.000Z`;

      const { data: projects } = await sb.from("imphq_projects").select("id, nome").order("nome");
      const { data: goals } = await sb.from("imphq_project_goals").select("*").eq("ano", ano).eq("mes", mes);
      const { data: vendas } = await sb.from("imphq_vendas").select("project_id, valor").eq("status", "aprovado").gte("created_at", monthStart);

      const goalMap = new Map((goals || []).map((g: any) => [g.project_id, g]));
      const vendasMap = new Map<string, number>();
      (vendas || []).forEach((v: any) => {
        vendasMap.set(v.project_id, (vendasMap.get(v.project_id) || 0) + (Number(v.valor) || 0));
      });

      const result = (projects || []).map((p: any) => {
        const g: any = goalMap.get(p.id);
        const receita = vendasMap.get(p.id) || 0;
        const meta = Number(g?.meta_receita) || 0;
        const pct = meta > 0 ? Math.min(100, (receita / meta) * 100) : 0;
        const day = now.getDate();
        const lastDay = new Date(ano, mes, 0).getDate();
        const proj = day > 0 ? (receita / day) * lastDay : 0;
        let cor = "text-emerald-400";
        if (meta > 0) {
          if (proj < meta * 0.8) cor = "text-red-400";
          else if (proj < meta) cor = "text-amber-400";
        }
        return { id: p.id, nome: p.nome, meta, receita, pct, projecao: proj, cor };
      }).sort((a, b) => b.pct - a.pct);

      setRows(result);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Target className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Metas Mensais</h1>
          <p className="text-xs text-muted-foreground">Progresso de receita por projeto neste mês.</p>
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.map((r) => (
          <Link key={r.id} to={`/projetos/${r.id}`}>
            <Card className="bg-card border-border hover:border-primary/50 transition-colors h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm truncate">{r.nome}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {r.meta === 0 ? (
                  <Badge variant="outline" className="text-[10px]">Sem meta definida</Badge>
                ) : (
                  <>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Progresso</span>
                      <span className={`font-semibold ${r.cor}`}>{r.pct.toFixed(0)}%</span>
                    </div>
                    <Progress value={r.pct} className="h-2" />
                    <div className="flex justify-between text-[10px]">
                      <span className="text-foreground font-medium">R$ {r.receita.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span>
                      <span className="text-muted-foreground">/ R$ {r.meta.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] pt-1 border-t border-border">
                      <TrendingUp className={`h-3 w-3 ${r.cor}`} />
                      <span className="text-muted-foreground">Projeção:</span>
                      <span className={`font-semibold ${r.cor}`}>R$ {r.projecao.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

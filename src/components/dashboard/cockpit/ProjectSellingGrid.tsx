import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useProjectList } from "@/hooks/useProjectList";
import { Sparkline } from "./Sparkline";
import { ArrowUpRight } from "lucide-react";

const APPROVED = ["aprovado", "aprovada", "approved", "paid", "completed"];
const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

interface Row {
  id: string;
  name: string;
  icon: string;
  revToday: number;
  rev7: number;
  revPrev7: number;
  spend7: number;
  hotLeads: number;
  spark: number[];
}

export function ProjectSellingGrid() {
  const { data: projects = [] } = useProjectList();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["cockpit", "selling-grid", projects.map((p) => p.id).join(",")],
    enabled: projects.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Row[]> => {
      const now = Date.now();
      const startToday = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
      const start7 = new Date(now - 7 * 86_400_000).toISOString();
      const start14 = new Date(now - 14 * 86_400_000).toISOString();
      const start7Date = start7.split("T")[0];

      const ids = projects.map((p) => p.id);

      const [salesRes, adsRes, hotRes] = await Promise.all([
        supabase
          .from("imphq_vendas")
          .select("project_id, valor, data_venda")
          .in("status", APPROVED)
          .in("project_id", ids)
          .gte("data_venda", start14),
        supabase
          .from("imphq_ads_spend")
          .select("project_id, valor, moeda, data_ref")
          .in("project_id", ids)
          .gte("data_ref", start7Date),
        supabase
          .from("imphq_leads")
          .select("project_id, score")
          .in("project_id", ids)
          .gte("score", 80),
      ]);

      const sales = (salesRes.data || []) as any[];
      const ads = (adsRes.data || []) as any[];
      const hot = (hotRes.data || []) as any[];

      const spendByProj = new Map<string, number>();
      ads.forEach((a) => {
        const v = Number(a.valor || 0) * (a.moeda === "USD" ? 5.2 : 1);
        spendByProj.set(a.project_id, (spendByProj.get(a.project_id) || 0) + v);
      });

      const hotByProj = new Map<string, number>();
      hot.forEach((h) => {
        hotByProj.set(h.project_id, (hotByProj.get(h.project_id) || 0) + 1);
      });

      return projects
        .map((p) => {
          const pSales = sales.filter((s) => s.project_id === p.id);
          const revToday = pSales
            .filter((s) => new Date(s.data_venda) >= new Date(startToday))
            .reduce((sum, s) => sum + Number(s.valor || 0), 0);
          const rev7 = pSales
            .filter((s) => new Date(s.data_venda) >= new Date(start7))
            .reduce((sum, s) => sum + Number(s.valor || 0), 0);
          const revPrev7 = pSales
            .filter(
              (s) =>
                new Date(s.data_venda) >= new Date(start14) &&
                new Date(s.data_venda) < new Date(start7),
            )
            .reduce((sum, s) => sum + Number(s.valor || 0), 0);

          // Spark: receita por dia últimos 14d
          const byDay: number[] = new Array(14).fill(0);
          pSales.forEach((s) => {
            const days = Math.floor(
              (now - new Date(s.data_venda).getTime()) / 86_400_000,
            );
            const idx = 13 - days;
            if (idx >= 0 && idx < 14) byDay[idx] += Number(s.valor || 0);
          });

          return {
            id: p.id,
            name: p.name,
            icon: p.icon || "📁",
            revToday,
            rev7,
            revPrev7,
            spend7: spendByProj.get(p.id) || 0,
            hotLeads: hotByProj.get(p.id) || 0,
            spark: byDay,
          };
        })
        .filter((r) => r.rev7 > 0 || r.hotLeads > 0 || r.spend7 > 0)
        .sort((a, b) => b.rev7 - a.rev7)
        .slice(0, 8);
    },
  });

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-[9px] tracking-[0.32em] uppercase text-gold/70 font-medium">
            Portfólio ativo
          </div>
          <h2
            className="text-2xl italic text-foreground mt-0.5"
            style={{ fontFamily: "Cormorant Garamond, serif" }}
          >
            Vendendo agora <span className="text-muted-foreground/60 text-base not-italic ml-2">· {rows.length}</span>
          </h2>
        </div>
        <Link
          to="/projetos"
          className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-gold flex items-center gap-1"
        >
          Todos <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-px bg-border/30 border border-border/50">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-32 bg-background animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="border border-border/40 py-12 text-center text-xs text-muted-foreground">
          Nenhum projeto vendendo no período. Verifique gastos e vendas dos últimos 7 dias.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-px bg-border/30 border border-border/50">
          {rows.map((r) => {
            const roas = r.spend7 > 0 ? r.rev7 / r.spend7 : 0;
            const delta = r.revPrev7 > 0 ? ((r.rev7 - r.revPrev7) / r.revPrev7) * 100 : 0;
            const up = delta >= 0;
            const roasColor =
              roas === 0
                ? "text-muted-foreground"
                : roas >= 2
                ? "text-emerald-400/90"
                : roas >= 1
                ? "text-amber-400/90"
                : "text-rose-400/90";

            return (
              <Link
                key={r.id}
                to={`/projeto/${r.id}`}
                className="group bg-background hover:bg-secondary/20 transition-colors p-4 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2 min-w-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-base leading-none">{r.icon}</span>
                      <span className="text-sm text-foreground truncate group-hover:text-gold transition-colors">
                        {r.name}
                      </span>
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                      Hoje ·{" "}
                      <span className="text-foreground/90 tabular-nums">{brl(r.revToday)}</span>
                    </div>
                  </div>
                  <Sparkline values={r.spark} width={64} height={22} strokeClassName={up ? "stroke-emerald-400/70" : "stroke-rose-400/70"} />
                </div>

                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border/30">
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70">7d</div>
                    <div
                      className="text-base italic text-foreground tabular-nums leading-tight"
                      style={{ fontFamily: "Cormorant Garamond, serif" }}
                    >
                      {brl(r.rev7)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70">ROAS</div>
                    <div className={`text-base italic tabular-nums leading-tight ${roasColor}`} style={{ fontFamily: "Cormorant Garamond, serif" }}>
                      {roas > 0 ? `${roas.toFixed(2)}×` : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70">Hot</div>
                    <div
                      className="text-base italic text-foreground tabular-nums leading-tight"
                      style={{ fontFamily: "Cormorant Garamond, serif" }}
                    >
                      {r.hotLeads}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70">Δ 7d</div>
                    <div
                      className={`text-base italic tabular-nums leading-tight ${up ? "text-emerald-400/90" : "text-rose-400/90"}`}
                      style={{ fontFamily: "Cormorant Garamond, serif" }}
                    >
                      {r.revPrev7 > 0 ? `${up ? "▲" : "▼"}${Math.abs(delta).toFixed(0)}%` : "—"}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

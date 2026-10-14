import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sparkline } from "@/components/dashboard/cockpit/Sparkline";
import { PAID_SALE_STATUSES, USD_BRL_RATE, saleValue, useRevenueMode } from "@/lib/revenueMode";
import { RevenueModeToggle } from "@/components/shared/RevenueModeToggle";
import { useGlobalProject } from "@/hooks/useGlobalProject";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function fmtDate(d: Date) {
  return d
    .toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
    .toUpperCase();
}

export function EditorialHeader() {
  const { projectId: globalProjectId } = useGlobalProject();
  const [revenueMode] = useRevenueMode();

  const { data } = useQuery({
    queryKey: ["cockpit", "editorial-header", globalProjectId ?? "all", revenueMode],
    staleTime: 60_000,
    queryFn: async () => {
      const now = new Date();
      const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const start30 = new Date(now.getTime() - 30 * 86_400_000).toISOString();
      const start30Date = start30.split("T")[0];

      let todayQ = supabase
        .from("imphq_vendas")
        .select("valor, valor_liquido")
        .in("status", [...PAID_SALE_STATUSES])
        .gte("data_venda", startToday);
      let mtdQ = supabase
        .from("imphq_vendas")
        .select("valor, valor_liquido, data_venda")
        .in("status", [...PAID_SALE_STATUSES])
        .gte("data_venda", startMonth);
      let adsQ = supabase
        .from("imphq_ads_spend")
        .select("valor, moeda, data_ref")
        .gte("data_ref", start30Date);

      if (globalProjectId) {
        todayQ = todayQ.eq("project_id", globalProjectId);
        mtdQ = mtdQ.eq("project_id", globalProjectId);
        adsQ = adsQ.eq("project_id", globalProjectId);
      }

      const [todayRes, mtdRes, adsRes] = await Promise.all([todayQ, mtdQ, adsQ]);

      const today = (todayRes.data || []).reduce(
        (s: number, v) => s + saleValue(v, revenueMode),
        0,
      );
      const mtdRows = mtdRes.data || [];
      const mtd = mtdRows.reduce((s, v) => s + saleValue(v, revenueMode), 0);
      const mtdGross = mtdRows.reduce((s, v) => s + Number(v.valor || 0), 0);
      const mtdNet = mtdRows.reduce(
        (s, v) => s + Number(v.valor_liquido ?? v.valor ?? 0),
        0,
      );

      // Projeção linear do mês
      const dayOfMonth = now.getDate();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const projection = dayOfMonth > 0 ? (mtd / dayOfMonth) * daysInMonth : 0;

      // Sparkline: receita por dia últimos 14d
      const byDay = new Map<string, number>();
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86_400_000);
        byDay.set(d.toISOString().split("T")[0], 0);
      }
      mtdRows.forEach((v) => {
        const key = String(v.data_venda || "").split("T")[0];
        if (byDay.has(key)) byDay.set(key, (byDay.get(key) || 0) + saleValue(v, revenueMode));
      });
      const spark = Array.from(byDay.values());

      // ROAS blended 30d
      const spend30 = (adsRes.data || []).reduce((s: number, a) => {
        const v = Number(a.valor || 0);
        return s + (a.moeda === "USD" ? v * USD_BRL_RATE : v);
      }, 0);
      const rev30 = mtdRows
        .filter((v) => new Date(v.data_venda) >= new Date(start30))
        .reduce((s: number, v) => s + saleValue(v, revenueMode), 0);
      const roas = spend30 > 0 ? rev30 / spend30 : 0;
      const margin = mtdGross > 0 ? (mtdNet / mtdGross) * 100 : 0;

      return { today, mtd, projection, roas, margin, spark };
    },
  });

  const d = data || { today: 0, mtd: 0, projection: 0, roas: 0, margin: 0, spark: [] };
  const now = new Date();

  const stats = [
    { label: "MTD", value: brl(d.mtd) },
    { label: "Projeção mês", value: brl(d.projection) },
    { label: "ROAS 30d", value: d.roas > 0 ? `${d.roas.toFixed(2)}×` : "—" },
    { label: "Margem", value: d.margin > 0 ? `${d.margin.toFixed(0)}%` : "—" },
  ];

  return (
    <div className="border-y border-border/60 py-5">
      <div className="flex items-baseline justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[9px] tracking-[0.32em] uppercase text-gold/70 font-medium">
              {fmtDate(now)} · {globalProjectId ? "Visão do projeto ativo" : "Edição diária"}
            </span>
            <RevenueModeToggle />
          </div>
          <h1
            className="text-4xl md:text-5xl italic font-light text-foreground leading-none"
            style={{ fontFamily: "Cormorant Garamond, serif" }}
          >
            Cockpit do Imperador
          </h1>
        </div>
        <div className="flex items-end gap-3">
          <div className="text-right">
            <div className="text-[9px] tracking-[0.28em] uppercase text-muted-foreground/70 mb-1">
              Receita hoje ({revenueMode})
            </div>
            <div
              className="text-4xl italic text-gold tabular-nums leading-none"
              style={{ fontFamily: "Cormorant Garamond, serif" }}
            >
              {brl(d.today)}
            </div>
          </div>
          <Sparkline values={d.spark} width={90} height={30} className="mb-1" />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 md:grid-cols-4 border-t border-border/40 pt-3">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={
              "px-4 " + (i > 0 ? "md:border-l border-border/40" : "")
            }
          >
            <div className="text-[9px] tracking-[0.28em] uppercase text-muted-foreground/70 mb-1">
              {s.label}
            </div>
            <div
              className="text-xl italic text-foreground tabular-nums"
              style={{ fontFamily: "Cormorant Garamond, serif" }}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

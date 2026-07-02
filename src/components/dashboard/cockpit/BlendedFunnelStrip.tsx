import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight } from "lucide-react";

const APPROVED = ["aprovado", "aprovada", "approved", "paid", "completed"];

const fmt = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("pt-BR");
};

export function BlendedFunnelStrip() {
  const { data } = useQuery({
    queryKey: ["cockpit", "blended-funnel"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const now = Date.now();
      const since = new Date(now - 30 * 86_400_000).toISOString();
      const sinceDate = since.split("T")[0];

      const [adsRes, leadsRes, checkoutRes, salesRes] = await Promise.all([
        supabase
          .from("imphq_ads_spend")
          .select("impressoes, cliques")
          .gte("data_ref", sinceDate),
        supabase.from("imphq_leads").select("id", { count: "exact", head: true }).gte("criado_em", since),
        supabase
          .from("imphq_vendas")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since),
        supabase
          .from("imphq_vendas")
          .select("id", { count: "exact", head: true })
          .in("status", APPROVED)
          .gte("created_at", since),
      ]);

      const impressions = (adsRes.data || []).reduce(
        (s: number, a: any) => s + Number(a.impressoes || 0),
        0,
      );
      const clicks = (adsRes.data || []).reduce(
        (s: number, a: any) => s + Number(a.cliques || 0),
        0,
      );
      return {
        impressions,
        clicks,
        leads: leadsRes.count || 0,
        checkouts: checkoutRes.count || 0,
        sales: salesRes.count || 0,
      };
    },
  });

  const d = data || { impressions: 0, clicks: 0, leads: 0, checkouts: 0, sales: 0 };

  const steps = [
    { label: "Impressões", value: d.impressions },
    { label: "Cliques", value: d.clicks },
    { label: "Leads", value: d.leads },
    { label: "Checkouts", value: d.checkouts },
    { label: "Vendas", value: d.sales },
  ];

  return (
    <section className="border-y border-border/40 py-4">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-[9px] tracking-[0.32em] uppercase text-gold/70 font-medium">
            Consolidado 30 dias
          </div>
          <h3
            className="text-lg italic text-foreground"
            style={{ fontFamily: "Cormorant Garamond, serif" }}
          >
            Funil blended
          </h3>
        </div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Conv total ·{" "}
          <span className="text-gold tabular-nums">
            {d.impressions > 0 ? ((d.sales / d.impressions) * 100).toFixed(3) + "%" : "—"}
          </span>
        </div>
      </div>
      <div className="flex items-stretch gap-0 overflow-x-auto">
        {steps.map((s, i) => {
          const prev = i > 0 ? steps[i - 1].value : 0;
          const rate = prev > 0 ? (s.value / prev) * 100 : 0;
          return (
            <div key={s.label} className="flex items-center flex-1 min-w-[110px]">
              <div className="flex-1">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70">
                  {s.label}
                </div>
                <div
                  className="text-2xl italic text-foreground tabular-nums leading-tight"
                  style={{ fontFamily: "Cormorant Garamond, serif" }}
                >
                  {fmt(s.value)}
                </div>
                {i > 0 && (
                  <div className="text-[10px] text-gold/70 tabular-nums mt-0.5">
                    {rate > 0 ? `${rate.toFixed(1)}%` : "—"}
                  </div>
                )}
              </div>
              {i < steps.length - 1 && (
                <ChevronRight className="h-4 w-4 text-border shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

import { useProjectPulse } from "@/hooks/useProjectPulse";
import { TrendingUp, TrendingDown, Minus, Flame, DollarSign, Calendar, Zap, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
  onNavigate?: (tab: string) => void;
}

const fmtBRL = (n: number) => {
  if (n >= 1000) return `R$ ${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".", ",")}k`;
  return `R$ ${n.toFixed(0)}`;
};

export function MobileKpiCarousel({ projectId, onNavigate }: Props) {
  const { pulse, reload } = useProjectPulse(projectId);

  const delta = pulse.revenueYesterday > 0
    ? ((pulse.revenueToday - pulse.revenueYesterday) / pulse.revenueYesterday) * 100
    : pulse.revenueToday > 0 ? 100 : 0;
  const DeltaIcon = delta > 5 ? TrendingUp : delta < -5 ? TrendingDown : Minus;
  const deltaColor = delta > 5 ? "text-emerald-400" : delta < -5 ? "text-red-400" : "text-muted-foreground";

  const roasColor = pulse.roasToday == null
    ? "text-muted-foreground"
    : pulse.roasToday >= 2 ? "text-emerald-400"
    : pulse.roasToday >= 1 ? "text-amber-400" : "text-red-400";

  const cards = [
    {
      key: "receita-hoje",
      label: "Receita Hoje",
      icon: DollarSign,
      iconColor: "text-emerald-400",
      value: pulse.loading ? "—" : fmtBRL(pulse.revenueToday),
      sub: !pulse.loading && (pulse.revenueYesterday > 0 || pulse.revenueToday > 0) ? (
        <span className={cn("inline-flex items-center gap-1 text-xs", deltaColor)}>
          <DeltaIcon className="h-3 w-3" />
          {Math.abs(delta).toFixed(0)}% vs ontem
        </span>
      ) : <span className="text-xs text-muted-foreground">Sem dado ontem</span>,
      tab: "financas",
    },
    {
      key: "receita-mes",
      label: "Receita Mês",
      icon: Calendar,
      iconColor: "text-primary",
      value: pulse.loading ? "—" : fmtBRL(pulse.revenueMonth),
      sub: <span className="text-xs text-muted-foreground">Acumulado</span>,
      tab: "financas",
    },
    {
      key: "roas",
      label: "ROAS Hoje",
      icon: Zap,
      iconColor: "text-amber-400",
      value: pulse.loading ? "—" : pulse.roasToday != null ? `${pulse.roasToday.toFixed(2)}x` : "—",
      valueColor: roasColor,
      sub: !pulse.loading ? (
        <span className="text-xs text-muted-foreground">Gasto: {fmtBRL(pulse.adsToday)}</span>
      ) : null,
      tab: "analytics",
    },
    {
      key: "hot",
      label: "Hot Leads",
      icon: Flame,
      iconColor: "text-orange-500",
      value: pulse.loading ? "—" : String(pulse.hotLeads),
      valueColor: pulse.hotLeads > 0 ? "text-orange-400" : "text-muted-foreground",
      sub: <span className="text-xs text-muted-foreground">Pix/Boleto 2h</span>,
      tab: "recuperacao",
    },
    {
      key: "leads",
      label: "Leads Hoje",
      icon: Users,
      iconColor: "text-blue-400",
      value: pulse.loading ? "—" : String(pulse.leadsToday),
      sub: <span className="text-xs text-muted-foreground">Novos contatos</span>,
      tab: "leads",
    },
  ];

  return (
    <div className="-mx-4 px-4 overflow-x-auto snap-x snap-mandatory scrollbar-none">
      <div className="flex gap-2.5 pb-1" onDoubleClick={() => reload()}>
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              type="button"
              key={c.key}
              onClick={() => onNavigate?.(c.tab)}
              className="snap-start shrink-0 w-[44%] min-w-[160px] rounded-xl border border-border/50 bg-slate-900 active:scale-[0.98] transition-transform text-left p-3.5 shadow-md"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  {c.label}
                </span>
                <Icon className={cn("h-3.5 w-3.5", c.iconColor)} />
              </div>
              <p className={cn(
                "text-2xl font-bold font-mono tabular-nums leading-tight",
                c.valueColor || "text-white"
              )}>
                {c.value}
              </p>
              <div className="mt-1.5 min-h-4">{c.sub}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

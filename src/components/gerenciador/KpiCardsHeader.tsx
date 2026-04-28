import { DollarSign, Target, ShoppingCart, Zap } from "lucide-react";
import { DeltaBadge } from "./DeltaBadge";

interface Totals {
  valor: number;
  compras: number;
  receita: number;
}

interface Props {
  current: Totals;
  previous: Totals;
}

const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function KpiCardsHeader({ current, previous }: Props) {
  const cpaCur = current.compras ? current.valor / current.compras : 0;
  const cpaPrev = previous.compras ? previous.valor / previous.compras : 0;
  const roasCur = current.valor ? current.receita / current.valor : 0;
  const roasPrev = previous.valor ? previous.receita / previous.valor : 0;

  const cards = [
    {
      label: "Investido",
      value: brl(current.valor),
      icon: DollarSign,
      cur: current.valor,
      prev: previous.valor,
      inverse: false,
    },
    {
      label: "ROAS",
      value: `${roasCur.toFixed(2)}x`,
      icon: Zap,
      cur: roasCur,
      prev: roasPrev,
      inverse: false,
    },
    {
      label: "Compras",
      value: current.compras.toLocaleString("pt-BR"),
      icon: ShoppingCart,
      cur: current.compras,
      prev: previous.compras,
      inverse: false,
    },
    {
      label: "CPA Médio",
      value: cpaCur > 0 ? brl(cpaCur) : "—",
      icon: Target,
      cur: cpaCur,
      prev: cpaPrev,
      inverse: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label} className="rounded-lg border border-border/40 bg-secondary/20 px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.label}</span>
              <Icon className="h-3 w-3 text-primary/60" />
            </div>
            <div className="flex items-end justify-between gap-2">
              <span className="text-lg font-light tabular-nums text-foreground/90" style={{ fontFamily: "Cormorant Garamond, serif" }}>{c.value}</span>
              <DeltaBadge current={c.cur} previous={c.prev} inverse={c.inverse} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

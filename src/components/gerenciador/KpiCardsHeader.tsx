import { DollarSign, Target, ShoppingCart, Zap, TrendingUp, Wallet } from "lucide-react";
import { DeltaBadge } from "./DeltaBadge";
import { cn } from "@/lib/utils";

interface Totals {
  valor: number;
  /** Vendas reais do checkout (sem order bump). */
  compras: number;
  /** Compras que o pixel da Meta reportou (referência; costuma duplicar). */
  pixel?: number;
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
  const lucroCur = current.receita - current.valor;
  const lucroPrev = previous.receita - previous.valor;

  const cards = [
    {
      label: "Investido",
      value: brl(current.valor),
      icon: DollarSign,
      cur: current.valor,
      prev: previous.valor,
      inverse: false,
      color: "text-foreground/90",
    },
    {
      label: "Faturamento",
      value: brl(current.receita),
      icon: TrendingUp,
      cur: current.receita,
      prev: previous.receita,
      inverse: false,
      color: "text-blue-400",
    },
    {
      label: "Lucro Líquido",
      value: `${lucroCur >= 0 ? "+" : ""}${brl(lucroCur)}`,
      icon: Wallet,
      cur: lucroCur,
      prev: lucroPrev,
      inverse: false,
      color: lucroCur >= 0 ? "text-emerald-400 font-medium" : "text-destructive font-medium",
    },
    {
      label: "ROAS",
      value: `${roasCur.toFixed(2)}x`,
      icon: Zap,
      cur: roasCur,
      prev: roasPrev,
      inverse: false,
      color: roasCur >= 2 ? "text-emerald-400" : roasCur >= 1 ? "text-foreground/90" : "text-amber-400",
    },
    {
      label: "Compras",
      value: current.compras.toLocaleString("pt-BR"),
      hint: current.pixel !== undefined ? `checkout · pixel ${current.pixel.toLocaleString("pt-BR")}` : undefined,
      icon: ShoppingCart,
      cur: current.compras,
      prev: previous.compras,
      inverse: false,
      color: "text-foreground/90",
    },
    {
      label: "CPA Médio",
      value: cpaCur > 0 ? brl(cpaCur) : "—",
      icon: Target,
      cur: cpaCur,
      prev: cpaPrev,
      inverse: true,
      color: "text-foreground/90",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label} className="rounded-lg border border-border/40 bg-secondary/20 px-3.5 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.label}</span>
              <Icon className="h-3.5 w-3.5 text-primary/60" />
            </div>
            <div className="flex items-end justify-between gap-1.5">
              <span className={cn("text-base sm:text-lg font-light tabular-nums leading-tight", c.color)} style={{ fontFamily: "Cormorant Garamond, serif" }}>
                {c.value}
              </span>
              <DeltaBadge current={c.cur} previous={c.prev} inverse={c.inverse} />
            </div>
            {"hint" in c && c.hint ? <div className="mt-1 text-[10px] text-muted-foreground">{c.hint}</div> : null}
          </div>
        );
      })}
    </div>
  );
}

import { CohortMatrixData } from "@/lib/cohortAnalysis";
import { cn } from "@/lib/utils";

interface Props {
  data: CohortMatrixData;
  metric?: "rate" | "revenue" | "buyers";
  onCellClick?: (cohortMonth: string, monthOffset: number) => void;
}

const formatCohortLabel = (m: string) => {
  const [y, mo] = m.split("-");
  const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${months[Number(mo) - 1]}/${y.slice(2)}`;
};

const colorForRate = (rate: number) => {
  if (rate <= 0) return "bg-card text-muted-foreground/40";
  if (rate < 5) return "bg-primary/5 text-foreground";
  if (rate < 15) return "bg-primary/15 text-foreground";
  if (rate < 30) return "bg-primary/30 text-foreground";
  if (rate < 50) return "bg-primary/50 text-primary-foreground";
  return "bg-primary text-primary-foreground font-semibold";
};

export function CohortMatrix({ data, metric = "rate", onCellClick }: Props) {
  if (data.cohortMonths.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
        Sem dados de cohort. Capture leads e registre vendas vinculadas pra começar.
      </div>
    );
  }

  const offsets = Array.from({ length: data.maxOffset + 1 }, (_, i) => i);

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead className="bg-muted/40 sticky top-0">
          <tr>
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider">Cohort</th>
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider">Leads</th>
            {offsets.map((o) => (
              <th key={o} className="text-center px-2 py-2 font-semibold text-muted-foreground">
                M{o}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.cohortMonths.slice().reverse().map((m) => (
            <tr key={m} className="border-t border-border">
              <td className="px-3 py-2 font-mono font-semibold">{formatCohortLabel(m)}</td>
              <td className="px-3 py-2 text-muted-foreground tabular-nums">{data.totals[m]}</td>
              {offsets.map((o) => {
                const cell = data.cells[`${m}|${o}`];
                if (!cell) {
                  return <td key={o} className="px-2 py-2 text-center text-muted-foreground/30">—</td>;
                }
                const display =
                  metric === "rate"
                    ? `${cell.rate.toFixed(1)}%`
                    : metric === "revenue"
                    ? `R$${Math.round(cell.revenue).toLocaleString("pt-BR")}`
                    : String(cell.buyers);
                return (
                  <td
                    key={o}
                    className={cn(
                      "px-2 py-2 text-center tabular-nums cursor-pointer transition-all hover:ring-2 hover:ring-primary/50",
                      colorForRate(cell.rate),
                    )}
                    onClick={() => onCellClick?.(m, o)}
                    title={`${cell.buyers} compradores · R$ ${cell.revenue.toFixed(0)} · ${cell.rate.toFixed(1)}%`}
                  >
                    {display}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

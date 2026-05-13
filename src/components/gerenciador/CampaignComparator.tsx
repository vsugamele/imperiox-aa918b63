import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Sparkline } from "./Sparkline";

interface Campaign {
  id: string;
  name: string;
  valor: number;
  impressoes: number;
  cliques: number;
  ctr: number;
  cpc: number;
  compras: number;
  cpa: number;
  receita: number;
  roas: number;
  daily_budget?: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaigns: Campaign[];
  dailySpendByCamp?: Map<string, number[]>;
}

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

export function CampaignComparator({ open, onOpenChange, campaigns, dailySpendByCamp }: Props) {
  const rows: Array<{ key: string; label: string; fmt: (c: Campaign) => string; cmp?: "max" | "min" }> = [
    { key: "valor", label: "Gasto", fmt: c => brl(c.valor), cmp: "min" },
    { key: "receita", label: "Receita", fmt: c => brl(c.receita), cmp: "max" },
    { key: "roas", label: "ROAS", fmt: c => c.roas.toFixed(2) + "x", cmp: "max" },
    { key: "cpa", label: "CPA", fmt: c => c.cpa ? brl(c.cpa) : "—", cmp: "min" },
    { key: "compras", label: "Compras", fmt: c => String(c.compras), cmp: "max" },
    { key: "ctr", label: "CTR", fmt: c => pct(c.ctr || 0), cmp: "max" },
    { key: "cpc", label: "CPC", fmt: c => c.cpc ? brl(c.cpc) : "—", cmp: "min" },
    { key: "cliques", label: "Cliques", fmt: c => c.cliques.toLocaleString("pt-BR"), cmp: "max" },
    { key: "impressoes", label: "Impressões", fmt: c => c.impressoes.toLocaleString("pt-BR") },
    { key: "daily_budget", label: "Orçamento diário", fmt: c => c.daily_budget ? brl(c.daily_budget) : "—" },
  ];

  const winner = (key: string, cmp?: "max" | "min") => {
    if (!cmp) return null;
    const vals = campaigns.map(c => Number((c as any)[key]) || 0);
    const target = cmp === "max" ? Math.max(...vals) : Math.min(...vals.filter(v => v > 0));
    return target;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto bg-secondary/40">
        <SheetHeader>
          <SheetTitle>Comparativo de campanhas ({campaigns.length})</SheetTitle>
        </SheetHeader>
        {campaigns.length < 2 ? (
          <p className="mt-6 text-sm text-muted-foreground">Selecione 2 ou 3 campanhas para comparar.</p>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="overflow-x-auto rounded-lg border border-border/30">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary/60">
                    <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Métrica</th>
                    {campaigns.map(c => (
                      <th key={c.id} className="text-right px-3 py-2 text-xs font-medium max-w-[180px] truncate" title={c.name}>{c.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const win = winner(r.key, r.cmp);
                    return (
                      <tr key={r.key} className="border-t border-border/20">
                        <td className="px-3 py-2 text-muted-foreground">{r.label}</td>
                        {campaigns.map(c => {
                          const val = Number((c as any)[r.key]) || 0;
                          const isWinner = r.cmp && val === win && val > 0;
                          return (
                            <td key={c.id} className={`text-right px-3 py-2 tabular-nums ${isWinner ? "text-primary font-semibold" : ""}`}>
                              {r.fmt(c)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {dailySpendByCamp && (
              <div>
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Evolução de gasto</h4>
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${campaigns.length}, minmax(0, 1fr))` }}>
                  {campaigns.map(c => {
                    const series = dailySpendByCamp.get(c.id) || [];
                    return (
                      <div key={c.id} className="rounded-lg border border-border/30 p-3 bg-background/40">
                        <div className="text-xs text-muted-foreground truncate mb-2" title={c.name}>{c.name}</div>
                        <Sparkline values={series} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

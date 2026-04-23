import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChannelLtv, formatBRL } from "@/lib/cohortAnalysis";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  data: ChannelLtv[];
  title?: string;
}

const ratioColor = (r: number) => {
  if (r >= 3) return "text-emerald-400 border-emerald-400/40 bg-emerald-400/10";
  if (r >= 1) return "text-amber-400 border-amber-400/40 bg-amber-400/10";
  if (r > 0) return "text-red-400 border-red-400/40 bg-red-400/10";
  return "text-muted-foreground border-border";
};

export function LtvByChannelTable({ data, title = "LTV por Canal" }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Canal</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Leads</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Compradores</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Receita</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">LTV</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">CAC</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">LTV/CAC</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Payback</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-muted-foreground py-8">
                    Sem dados de canal ainda.
                  </td>
                </tr>
              )}
              {data.map((c) => (
                <tr key={c.channel} className="border-t border-border hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono font-semibold capitalize">{c.channel}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.leads}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.buyers}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatBRL(c.revenue)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatBRL(c.ltv)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {c.cac > 0 ? formatBRL(c.cac) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Badge variant="outline" className={cn("font-mono", ratioColor(c.ltvCacRatio))}>
                      {c.ltvCacRatio > 0 ? (
                        <>
                          {c.ltvCacRatio >= 1 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                          {c.ltvCacRatio.toFixed(2)}x
                        </>
                      ) : "—"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {c.paybackDays != null ? `${c.paybackDays}d` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

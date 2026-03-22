import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface ProjectSummary {
  id: string;
  name: string;
  receita: number;
  custo: number;
  lucro: number;
  roi: number;
}

interface Props {
  projectSummaries: ProjectSummary[];
}

export function FinancasOverview({ projectSummaries }: Props) {
  const chartData = projectSummaries.map(p => ({
    name: p.name.length > 15 ? p.name.slice(0, 15) + "…" : p.name,
    Receita: p.receita,
    Custo: p.custo,
  }));

  return (
    <div className="space-y-6">
      {chartData.length > 0 && (
        <Card className="border-border">
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-4">Receita vs Custo por Projeto</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                <Legend />
                <Bar dataKey="Receita" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Custo" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Projeto</TableHead>
              <TableHead className="text-right">Receita</TableHead>
              <TableHead className="text-right">Custo</TableHead>
              <TableHead className="text-right">Lucro</TableHead>
              <TableHead className="text-right">ROI%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projectSummaries.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-right font-mono text-emerald-400">R$ {p.receita.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-red-400">R$ {p.custo.toFixed(2)}</TableCell>
                <TableCell className={`text-right font-mono ${p.lucro >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  R$ {p.lucro.toFixed(2)}
                </TableCell>
                <TableCell className={`text-right font-mono font-bold ${p.roi >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {p.roi.toFixed(1)}%
                </TableCell>
              </TableRow>
            ))}
            {projectSummaries.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum projeto com dados financeiros</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

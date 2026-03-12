import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign } from "lucide-react";

const USD_BRL = 5.2;

export default function Financas() {
  const [custos, setCustos] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("imphq_custos").select("*").order("nome").then(({ data }) => setCustos(data || []));
  }, []);

  const totalBRL = custos.reduce((acc, c) => {
    const val = parseFloat(c.valor) || 0;
    return acc + (c.moeda === "USD" ? val * USD_BRL : val);
  }, 0);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold text-primary">Finanças</h1>

      <Card className="bg-card border-border">
        <CardContent className="flex items-center gap-4 p-6">
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Custo Mensal Total</p>
            <p className="text-3xl font-mono font-bold">R$ {totalBRL.toFixed(2)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ferramenta</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Moeda</TableHead>
              <TableHead>Em R$</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {custos.map((c) => {
              const val = parseFloat(c.valor) || 0;
              const brl = c.moeda === "USD" ? val * USD_BRL : val;
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.tipo || "—"}</TableCell>
                  <TableCell className="font-mono">{val.toFixed(2)}</TableCell>
                  <TableCell className="text-xs">{c.moeda || "BRL"}</TableCell>
                  <TableCell className="font-mono text-primary">R$ {brl.toFixed(2)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

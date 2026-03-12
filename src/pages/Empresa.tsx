import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function Empresa() {
  const [contas, setContas] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("imphq_empresa").select("*").order("tipo").then(({ data }) => setContas(data || []));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold text-primary">Empresa</h1>
      <p className="text-sm text-muted-foreground">Contas da operação</p>
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contas.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.nome}</TableCell>
                <TableCell><Badge variant="outline" className="text-[10px]">{c.tipo}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{c.valor || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

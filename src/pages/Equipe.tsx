import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function Equipe() {
  const [members, setMembers] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("imphq_team_members").select("*").order("created_at").then(({ data }) => setMembers(data || []));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold text-primary">Equipe</h1>
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.nome || m.name || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{m.role || "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-[10px] ${m.status === "active" ? "border-success text-success" : ""}`}>
                    {m.status || "ativo"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

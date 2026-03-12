import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const STATUS_COLORS: Record<string, string> = {
  lead: "bg-primary/20 text-primary",
  cliente: "bg-success/20 text-success",
  vip: "bg-gold/20 text-gold",
  inativo: "bg-muted text-muted-foreground",
};

export default function Leads() {
  const [leads, setLeads] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase.from("imphq_leads").select("*").order("criado_em", { ascending: false }).then(({ data }) => setLeads(data || []));
  }, []);

  const filtered = leads.filter((l) =>
    l.nome?.toLowerCase().includes(search.toLowerCase()) ||
    l.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold text-primary">Leads</h1>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar leads..." className="pl-9 bg-secondary" />
      </div>

      <div className="rounded-lg border border-border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Total Gasto</TableHead>
              <TableHead>Plataforma</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.nome}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{l.email || "—"}</TableCell>
                <TableCell>
                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${STATUS_COLORS[l.status] || STATUS_COLORS.lead}`}>
                    {l.status || "lead"}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-primary">{l.score ?? "—"}</TableCell>
                <TableCell className="font-mono text-sm">
                  {l.total_gasto ? `R$ ${parseFloat(l.total_gasto).toFixed(2)}` : "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{l.plataforma || "—"}</TableCell>
                <TableCell>
                  {l.phone && (
                    <Button size="icon" variant="ghost" asChild>
                      <a href={`https://wa.me/${l.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener">
                        <MessageCircle className="h-4 w-4 text-success" />
                      </a>
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

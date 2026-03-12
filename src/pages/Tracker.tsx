import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Link2, Copy } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function Tracker() {
  const [links, setLinks] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("imphq_tracking_links").select("*").order("created_at", { ascending: false }).then(({ data }) => setLinks(data || []));
  }, []);

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado!" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-primary">UTM Tracker</h1>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Link</Button>
      </div>
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Projeto</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {links.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.nome || l.id}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{l.url || "—"}</TableCell>
                <TableCell className="text-xs">{l.project_id || "—"}</TableCell>
                <TableCell>
                  {l.url && (
                    <Button size="icon" variant="ghost" onClick={() => copyLink(l.url)}>
                      <Copy className="h-3 w-3" />
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

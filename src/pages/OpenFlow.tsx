import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

export default function OpenFlow() {
  const [flows, setFlows] = useState<any[]>([]);
  useEffect(() => { supabase.from("imphq_flows").select("*").order("updated_at", { ascending: false }).then(({ data }) => setFlows(data || [])); }, []);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold text-primary">OpenFlow</h1>
      <p className="text-sm text-muted-foreground">Gerador de criativos e copy com IA</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {flows.map((f) => (
          <Card key={f.id} className="bg-card border-border">
            <CardContent className="p-4">
              <h3 className="font-medium text-sm">{f.nome}</h3>
              <p className="text-xs text-muted-foreground mt-1">{f.project_id || "—"}</p>
            </CardContent>
          </Card>
        ))}
        {flows.length === 0 && <p className="text-sm text-muted-foreground">Nenhum flow criado</p>}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

export default function Funis() {
  const [funis, setFunis] = useState<any[]>([]);
  useEffect(() => { supabase.from("imphq_funis").select("*").order("updated_at", { ascending: false }).then(({ data }) => setFunis(data || [])); }, []);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold text-primary">Funis</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {funis.map((f) => (
          <Card key={f.id} className="bg-card border-border hover:border-primary/20 cursor-pointer transition-colors">
            <CardContent className="p-4">
              <h3 className="font-medium text-sm">{f.nome}</h3>
              <p className="text-xs text-muted-foreground mt-1">{f.tipo || "—"} • {f.status || "ativo"}</p>
            </CardContent>
          </Card>
        ))}
        {funis.length === 0 && <p className="text-sm text-muted-foreground">Nenhum funil cadastrado</p>}
      </div>
    </div>
  );
}

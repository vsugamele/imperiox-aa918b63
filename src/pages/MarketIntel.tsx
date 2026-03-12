import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, TrendingUp } from "lucide-react";

export default function MarketIntel() {
  const [opps, setOpps] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase.from("imphq_mi_opportunities").select("*").order("score", { ascending: false }).then(({ data }) => setOpps(data || []));
  }, []);

  const filtered = opps.filter((o) =>
    o.nicho?.toLowerCase().includes(search.toLowerCase()) ||
    o.produto?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold text-primary">Market Intel</h1>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filtrar por nicho..." className="pl-9 bg-secondary" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((o) => (
          <Card key={o.id} className="bg-card border-border hover:border-primary/30 transition-colors">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-sm">{o.produto}</h3>
                  <p className="text-xs text-muted-foreground">{o.nicho} → {o.sub_nicho}</p>
                </div>
                <div className="flex items-center gap-1 text-primary">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-lg font-mono font-bold">{o.score}</span>
                </div>
              </div>
              {o.micro_nicho && <p className="text-xs text-muted-foreground">Micro: {o.micro_nicho}</p>}
              <div className="flex gap-2 flex-wrap">
                {o.ticket && <Badge variant="outline" className="text-[10px]">R$ {o.ticket}</Badge>}
                {o.plataforma && <Badge variant="outline" className="text-[10px]">{o.plataforma}</Badge>}
                {o.sem_rosto && <Badge variant="outline" className="text-[10px] border-success text-success">Sem rosto</Badge>}
              </div>
              {o.flags && Array.isArray(o.flags) && o.flags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {o.flags.map((f: string, i: number) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{f}</span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

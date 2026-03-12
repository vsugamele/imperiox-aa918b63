import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, FileText } from "lucide-react";

export default function Docs() {
  const [docs, setDocs] = useState<any[]>([]);
  const [kb, setKb] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([
      supabase.from("imphq_docs").select("*").order("created_at", { ascending: false }),
      supabase.from("imphq_kb").select("*").order("order_idx"),
    ]).then(([docRes, kbRes]) => {
      setDocs(docRes.data || []);
      setKb(kbRes.data || []);
    });
  }, []);

  const allItems = [...docs.map(d => ({ ...d, source: "doc" })), ...kb.map(k => ({ ...k, source: "kb" }))];
  const filtered = allItems.filter(i => i.title?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold text-primary">Docs & Knowledge Base</h1>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="pl-9 bg-secondary" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((d) => (
          <Card key={d.id} className="bg-card border-border hover:border-primary/20 cursor-pointer transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-medium text-sm">{d.title}</h3>
                  <p className="text-[10px] text-muted-foreground uppercase">{d.source === "kb" ? "KB" : "Doc"} {d.cat || d.section_key || ""}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

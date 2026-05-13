import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { History, Trash2 } from "lucide-react";

interface Search {
  id: string;
  mode: string;
  query: string | null;
  result_md: string | null;
  intel_data: any;
  project_id: string | null;
  created_at: string;
}

interface Props {
  onLoad: (s: Search) => void;
  refreshKey?: number;
}

const MODE_LABEL: Record<string, string> = {
  DISCOVERY: "🔍 Pesquisa",
  TREND_SCAN: "📡 Tendências",
  DEEP_DIVE: "🎯 Deep Dive",
};

export function SearchHistory({ onLoad, refreshKey }: Props) {
  const [items, setItems] = useState<Search[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("imphq_mi_searches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    setItems((data as Search[]) || []);
  };

  useEffect(() => { load(); }, [refreshKey]);

  const remove = async (id: string) => {
    await supabase.from("imphq_mi_searches").delete().eq("id", id);
    setItems(prev => prev.filter(p => p.id !== id));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <History className="h-3.5 w-3.5" /> Histórico ({items.length})
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[420px] bg-secondary/95 border-border/40 p-0 max-h-[500px] overflow-y-auto">
        <div className="p-3 border-b border-border/30">
          <p className="text-xs font-medium text-foreground/80">Pesquisas recentes</p>
          <p className="text-[10px] text-muted-foreground">Clique para recarregar a análise.</p>
        </div>
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground p-4 text-center">Nenhuma pesquisa salva ainda.</p>
        )}
        <div className="divide-y divide-border/20">
          {items.map(s => (
            <div key={s.id} className="group p-3 hover:bg-secondary/50 transition flex items-start justify-between gap-2">
              <button onClick={() => onLoad(s)} className="text-left min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] uppercase tracking-wider text-primary/70">{MODE_LABEL[s.mode] || s.mode}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {new Date(s.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-xs font-medium text-foreground/90 truncate">{s.query || "(sem termo)"}</p>
                {s.intel_data?.resumo && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{s.intel_data.resumo}</p>
                )}
              </button>
              <button onClick={() => remove(s.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0 transition">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

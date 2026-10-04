import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Coins, Zap } from "lucide-react";

type Row = {
  id: string;
  project_id: string | null;
  function_name: string;
  provider: string;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  cost_usd: number | null;
  created_at: string;
};

const usd = (n: number) => `$${n.toFixed(4)}`;
const int = (n: number) => n.toLocaleString("pt-BR");

function group(rows: Row[], key: (r: Row) => string) {
  const map = new Map<string, { label: string; cost: number; tokens: number; calls: number; unknownCost: number; unknownTokens: number }>();
  for (const r of rows) {
    const k = key(r) || "—";
    const cur = map.get(k) || { label: k, cost: 0, tokens: 0, calls: 0, unknownCost: 0, unknownTokens: 0 };
    cur.cost += Number(r.cost_usd || 0);
    cur.tokens += Number(r.total_tokens || 0);
    cur.calls += 1;
    if (r.cost_usd === null) cur.unknownCost++;
    if (r.total_tokens === null) cur.unknownTokens++;
    map.set(k, cur);
  }
  return [...map.values()].sort((a, b) => b.cost - a.cost || b.tokens - a.tokens);
}

export default function CustosIA() {
  const { data: rows = [], isLoading, isError } = useQuery({
    queryKey: ["ai-usage", "30d"],
    staleTime: 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from("imphq_ai_usage")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data || []) as Row[];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", "names"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("imphq_projects").select("id, name");
      return data || [];
    },
  });
  const projectName = (id: string) =>
    projects.find((p) => p.id === id)?.name || (id === "—" ? "Sem projeto" : id);

  const totalCost = rows.reduce((s, r) => s + Number(r.cost_usd || 0), 0);
  const totalTokens = rows.reduce((s, r) => s + Number(r.total_tokens || 0), 0);

  const byProject = group(rows, (r) => r.project_id || "—");
  const byFunction = group(rows, (r) => r.function_name);
  const byModel = group(rows, (r) => r.model || "Modelo não informado");
  const unknownCosts = rows.filter((r) => r.cost_usd === null).length;
  const unknownTokens = rows.filter((r) => r.total_tokens === null).length;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header>
        <div className="text-[9px] tracking-[0.32em] uppercase text-gold/70 font-medium">
          Últimos 30 dias
        </div>
        <h1
          className="text-3xl italic text-foreground"
          style={{ fontFamily: "Cormorant Garamond, serif" }}
        >
          Custos de IA
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Consumo registrado pelas automações instrumentadas, por projeto, função e modelo. Custos ausentes ficam a confirmar.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <Coins className="h-3.5 w-3.5 text-gold" /> Custo informado
            </div>
            <div
              className="text-3xl italic text-foreground tabular-nums mt-1"
              style={{ fontFamily: "Cormorant Garamond, serif" }}
            >
              {isLoading || isError ? "—" : rows.length && unknownCosts === rows.length ? "A confirmar" : usd(totalCost)}
            </div>
            {unknownCosts > 0 && <p className="text-xs text-muted-foreground mt-1">{unknownCosts} chamada(s) sem custo informado; total parcial.</p>}
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <Zap className="h-3.5 w-3.5 text-gold" /> Tokens
            </div>
            <div
              className="text-3xl italic text-foreground tabular-nums mt-1"
              style={{ fontFamily: "Cormorant Garamond, serif" }}
            >
              {isLoading || isError ? "—" : rows.length && unknownTokens === rows.length ? "A confirmar" : int(totalTokens)}
            </div>
            {unknownTokens > 0 && <p className="text-xs text-muted-foreground mt-1">{unknownTokens} chamada(s) sem tokens informados; total parcial.</p>}
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <Brain className="h-3.5 w-3.5 text-gold" /> Chamadas
            </div>
            <div
              className="text-3xl italic text-foreground tabular-nums mt-1"
              style={{ fontFamily: "Cormorant Garamond, serif" }}
            >
              {isLoading || isError ? "—" : int(rows.length)}
            </div>
          </CardContent>
        </Card>
      </div>

      {isError ? <p role="alert" className="text-xs text-destructive">Não foi possível carregar o consumo. Os valores estão indisponíveis.</p> : isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : rows.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center space-y-1">
            <p className="text-sm text-muted-foreground">Nenhum consumo registrado ainda.</p>
            <p className="text-xs text-muted-foreground">
              O registro depende da instrumentação de cada automação.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Panel title="Por projeto" items={byProject.map((i) => ({ ...i, label: projectName(i.label) }))} />
          <Panel title="Por função" items={byFunction} />
          <Panel title="Por modelo" items={byModel} />
        </div>
      )}
    </div>
  );
}

function Panel({
  title,
  items,
}: {
  title: string;
  items: { label: string; cost: number; tokens: number; calls: number; unknownCost: number; unknownTokens: number }[];
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 space-y-2">
        <h2 className="text-[10px] uppercase tracking-[0.2em] text-gold/80">{title}</h2>
        {items.slice(0, 15).map((i) => (
          <div key={i.label} className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate text-foreground/90">{i.label}</span>
            <div className="flex items-center gap-2 shrink-0">
              <Badge className="bg-secondary/60 text-muted-foreground text-[9px] tabular-nums">
                {i.unknownTokens === i.calls ? "tk a confirmar" : `${int(i.tokens)} tk${i.unknownTokens ? " (parcial)" : ""}`}
              </Badge>
              <span className="text-gold tabular-nums" title={i.unknownCost ? `${i.unknownCost} chamada(s) sem custo informado` : undefined}>{i.unknownCost === i.calls ? "A confirmar" : `${usd(i.cost)}${i.unknownCost ? " (parcial)" : ""}`}</span>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground">Sem dados no período.</p>
        )}
      </CardContent>
    </Card>
  );
}

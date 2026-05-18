import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Shield, Pause, TrendingUp, RefreshCw, Sparkles, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

interface Rule {
  id: string;
  rule_type: string;
  params: Record<string, any>;
  enabled: boolean;
  last_run_at: string | null;
  runs_24h: number;
}

interface Suggestion {
  name: string;
  rule_type: string;
  conditions: Record<string, any>;
  expected_delta: string;
  confidence: number;
  samples: number;
  rationale: string;
}

const META: Record<string, { label: string; desc: string; icon: any; fields: { key: string; label: string; suffix?: string }[] }> = {
  auto_pause_cpa: {
    label: "Pausar se CPA estourar",
    desc: "Pausa adsets com CPA > N× a meta após X cliques.",
    icon: Pause,
    fields: [{ key: "cpa_multiplier", label: "Multiplicador CPA", suffix: "x" }, { key: "min_clicks", label: "Cliques mín." }],
  },
  auto_pause_ctr: {
    label: "Pausar se CTR despencar",
    desc: "Pausa adsets com CTR abaixo do mínimo após X cliques.",
    icon: Pause,
    fields: [{ key: "min_ctr", label: "CTR mínimo", suffix: "%" }, { key: "min_clicks", label: "Cliques mín." }],
  },
  propose_scale_roas: {
    label: "Propor escala em vencedores",
    desc: "Sugere aumento de orçamento (%) para campanhas com ROAS ≥ N.",
    icon: TrendingUp,
    fields: [
      { key: "min_roas", label: "ROAS mín.", suffix: "x" },
      { key: "max_daily_budget", label: "Orç. máx. atual", suffix: "R$" },
      { key: "scale_pct", label: "% Escala", suffix: "%" },
    ],
  },
};

export function RulesPanel() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSugg, setLoadingSugg] = useState(false);
  const [totalSamples, setTotalSamples] = useState(0);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("imphq_ads_rules").select("*").order("rule_type");
    setRules((data as Rule[]) || []);
    setLoading(false);
  };

  const loadSuggestions = async () => {
    setLoadingSugg(true);
    try {
      const { data, error } = await supabase.functions.invoke("ads-rules-suggester", { body: {} });
      if (error) throw error;
      setSuggestions(data?.rules || []);
      setTotalSamples(data?.total_samples || 0);
    } catch (e: any) {
      toast.error(e.message || "Falha ao buscar sugestões");
    } finally {
      setLoadingSugg(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggle = async (id: string, enabled: boolean) => {
    setRules(rs => rs.map(r => r.id === id ? { ...r, enabled } : r));
    await supabase.from("imphq_ads_rules").update({ enabled }).eq("id", id);
  };

  const updateParam = async (id: string, key: string, value: number) => {
    const r = rules.find(x => x.id === id);
    if (!r) return;
    const params = { ...r.params, [key]: value };
    setRules(rs => rs.map(x => x.id === id ? { ...x, params } : x));
    await supabase.from("imphq_ads_rules").update({ params }).eq("id", id);
  };

  const runNow = async () => {
    setRunning(true);
    try {
      await supabase.functions.invoke("ads-rules-engine", { body: {} });
      toast.success("Engine executada. Veja ações na Inbox do Imperius.");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Falha ao rodar engine");
    } finally {
      setRunning(false);
    }
  };

  const adoptSuggestion = async (s: Suggestion) => {
    const { error } = await supabase.from("imphq_ads_rules").insert({
      rule_type: s.rule_type,
      params: s.conditions,
      enabled: false,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Regra criada (desativada). Revise e ative.");
    load();
  };

  const total24h = rules.reduce((s, r) => s + (r.runs_24h || 0), 0);

  return (
    <Card className="bg-secondary/40 border-border/40">
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base font-light tracking-wide">
          <Shield className="h-4 w-4 text-primary" />
          Regras Automáticas
          <Badge variant="outline" className="ml-2 text-[10px]">{total24h} ações 24h</Badge>
        </CardTitle>
        <Button variant="outline" size="sm" onClick={runNow} disabled={running} className="h-8 gap-1.5 text-xs">
          <RefreshCw className={`h-3 w-3 ${running ? "animate-spin" : ""}`} /> Rodar agora
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="ativas" className="w-full">
          <TabsList className="bg-secondary/60 grid grid-cols-2 w-full mb-3">
            <TabsTrigger value="ativas" className="text-xs">Configuradas ({rules.length})</TabsTrigger>
            <TabsTrigger value="sugestoes" className="text-xs gap-1.5">
              <Sparkles className="h-3 w-3" /> Sugestões da IA
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ativas" className="space-y-3">
            {loading && <p className="text-xs text-muted-foreground">Carregando...</p>}
            {!loading && rules.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhuma regra configurada.</p>
            )}
            {rules.map(r => {
              const m = META[r.rule_type];
              if (!m) return null;
              const Icon = m.icon;
              return (
                <div key={r.id} className="border border-border/30 rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{m.label}</p>
                        <p className="text-[11px] text-muted-foreground leading-snug">{m.desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-muted-foreground tabular-nums">{r.runs_24h}/24h</span>
                      <Switch checked={r.enabled} onCheckedChange={(v) => toggle(r.id, v)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pl-6">
                    {m.fields.map(f => (
                      <label key={f.key} className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{f.label}</span>
                        <Input
                          type="number"
                          step="0.1"
                          value={r.params[f.key] ?? 0}
                          onChange={(e) => updateParam(r.id, f.key, Number(e.target.value))}
                          className="h-7 text-xs bg-background/40"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="sugestoes" className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground leading-snug">
                Padrões detectados nos últimos 30d de ações ({totalSamples} amostras analisadas).
              </p>
              <Button size="sm" variant="outline" onClick={loadSuggestions} disabled={loadingSugg} className="h-7 gap-1.5 text-xs">
                {loadingSugg ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Analisar
              </Button>
            </div>
            {!loadingSugg && suggestions.length === 0 && (
              <p className="text-xs text-muted-foreground italic text-center py-6">
                Clique em <strong>Analisar</strong> para buscar regras sugeridas a partir do seu histórico.
              </p>
            )}
            {suggestions.map((s, i) => (
              <div key={i} className="border border-primary/30 bg-primary/5 rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{s.name}</p>
                    <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{s.rationale}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {s.confidence}% · {s.samples}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/30">
                  <div className="text-[10px] text-emerald-400 font-mono">✓ {s.expected_delta}</div>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => adoptSuggestion(s)}>
                    <Plus className="h-3 w-3" /> Criar regra
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 pl-1">
                  {Object.entries(s.conditions).map(([k, v]) => (
                    <Badge key={k} variant="secondary" className="text-[9px] uppercase tracking-wider">
                      {k}: {String(v)}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

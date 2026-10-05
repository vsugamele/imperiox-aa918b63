import { errorMessage } from "@/lib/error-message";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";
import { jsonFields, jsonNumber, jsonText } from "@/lib/json-fields";
import { z } from "zod";
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
  params: Record<string, Json>;
  enabled: boolean;
  last_run_at: string | null;
  runs_24h: number;
}

interface Suggestion {
  name: string;
  rule_type: string;
  conditions: Record<string, number>;
  expected_delta: string;
  confidence: number;
  samples: number;
  rationale: string;
}

const suggestionSchema = z.object({ name: z.string(), rule_type: z.string(), conditions: z.record(z.number()), expected_delta: z.string(), confidence: z.number(), samples: z.number(), rationale: z.string() }).passthrough();

interface HistoryItem {
  id: string;
  title: string | null;
  reason: string | null;
  status: string;
  error: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  proposed: "Aguardando aprovação",
  approved: "Aprovada",
  executed: "Executada",
  failed: "Falhou",
  rejected: "Rejeitada",
  expired: "Expirou",
  reverted: "Revertida",
};

const STATUS_TONE: Record<string, string> = {
  proposed: "text-amber-400 border-amber-500/30",
  approved: "text-sky-400 border-sky-500/30",
  executed: "text-emerald-400 border-emerald-500/30",
  failed: "text-rose-400 border-rose-500/30",
};
const META: Record<string, { label: string; desc: string; icon: LucideIcon; fields: { key: string; label: string; suffix?: string }[] }> = {
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

  // Histórico real do motor de regras
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("imphq_ads_rules").select("*").order("rule_type");
    setRules((data || []).map((row) => ({ ...row, params: jsonFields(row.params) })));
    setLoading(false);
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    const { data } = await supabase
      .from("imphq_ai_actions")
      .select("id, title, reason, status, error, created_at")
      .eq("source", "ads-rules-engine")
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory((data as HistoryItem[]) || []);
    setHistoryLoading(false);
  };

  const loadSuggestions = async () => {
    setLoadingSugg(true);
    try {
      const { data, error } = await supabase.functions.invoke<Json>("ads-rules-suggester", { body: {} });
      if (error) throw error;
      const result = jsonFields(data);
      const parsed = z.array(suggestionSchema).parse(result.rules ?? []);
      setSuggestions(parsed as Suggestion[]);
      setTotalSamples(jsonNumber(result.total_samples) || 0);
    } catch (e: unknown) {
      toast.error(errorMessage(e) || "Falha ao buscar sugestões");
    } finally {
      setLoadingSugg(false);
    }
  };

  useEffect(() => { load(); loadHistory(); }, []);

  const staleDays = history[0]
    ? Math.floor((Date.now() - new Date(history[0].created_at).getTime()) / 86_400_000)
    : null;

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
      const { error } = await supabase.functions.invoke("ads-rules-engine", { body: {} });
      if (error) throw error;
      toast.success("Engine executada. Veja ações na Inbox do Imperius.");
      await load();
    } catch (e: unknown) {
      toast.error(errorMessage(e) || "Falha ao rodar engine");
    } finally {
      setRunning(false);
    }
  };

  const adoptSuggestion = async (s: Suggestion) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Faça login para criar regras"); return; }
    const { error } = await supabase.from("imphq_ads_rules").insert({
      user_id: user.id,
      rule_type: s.rule_type,
      params: s.conditions,
      enabled: false,
    });
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
          <TabsList className="bg-secondary/60 grid grid-cols-3 w-full mb-3">
            <TabsTrigger value="ativas" className="text-xs">Configuradas ({rules.length})</TabsTrigger>
            <TabsTrigger value="sugestoes" className="text-xs gap-1.5">
              <Sparkles className="h-3 w-3" /> Sugestões da IA
            </TabsTrigger>
            <TabsTrigger value="optimizer" className="text-xs gap-1.5">
              <TrendingUp className="h-3 w-3 text-emerald-400" /> Histórico
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
                          value={jsonNumber(r.params[f.key]) ?? jsonText(r.params[f.key]) ?? 0}
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

          {/* TAB 3: Histórico real do motor de regras (imphq_ai_actions, source=ads-rules-engine) */}
          <TabsContent value="optimizer" className="space-y-3">
            <p className="text-[11px] text-muted-foreground leading-snug">
              O que o motor de regras propôs ou executou de verdade. Ele só <strong>propõe</strong> — a pausa acontece quando alguém aprova na fila.
            </p>
            {historyLoading && <p className="text-xs text-muted-foreground">Carregando...</p>}
            {!historyLoading && history.length === 0 && (
              <p className="text-xs text-muted-foreground italic text-center py-6">
                O motor ainda não registrou nenhuma ação.
              </p>
            )}
            {!historyLoading && history.length > 0 && staleDays !== null && staleDays > 2 && (
              <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-2.5 text-[11px] text-amber-300">
                ⚠️ Última ação há {staleDays} dias. Se há campanhas rodando, o motor pode estar parado ou sem dados de gasto atualizados.
              </div>
            )}
            <div className="space-y-2 max-h-[320px] overflow-y-auto">
              {history.map(h => (
                <div key={h.id} className="border border-border/30 rounded-lg p-2.5 text-[11px] space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {new Date(h.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <Badge variant="outline" className={`text-[9px] ${STATUS_TONE[h.status] || ""}`}>
                      {STATUS_LABEL[h.status] || h.status}
                    </Badge>
                  </div>
                  <p className="text-foreground/90">{h.title}</p>
                  {h.reason && <p className="text-muted-foreground">{h.reason}</p>}
                  {h.error && <p className="text-rose-400">Erro: {h.error}</p>}
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

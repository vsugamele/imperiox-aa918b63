import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Trash2, Shield, Ban, BookOpen, RefreshCw, FlaskConical, Crown, Sparkles } from "lucide-react";
import { toast } from "sonner";

type Rule = {
  id: string;
  rule_text: string;
  rule_type: "behavior" | "unavailable_product" | "qualification" | string;
  active: boolean;
  times_applied: number;
  conversion_count: number;
  ab_group_id: string | null;
  ab_status: "control" | "variant" | "winner" | "loser" | null;
  created_at: string;
};

const TYPE_META: Record<string, { label: string; icon: any; color: string }> = {
  behavior:            { label: "Regra",        icon: BookOpen, color: "text-primary" },
  qualification:       { label: "Qualificação", icon: Shield,   color: "text-blue-400" },
  unavailable_product: { label: "Indisponível", icon: Ban,      color: "text-destructive" },
};

const AB_META: Record<string, { label: string; cls: string }> = {
  control: { label: "Controle A/B", cls: "border-blue-500/40 text-blue-300" },
  variant: { label: "Variante A/B", cls: "border-amber-500/40 text-amber-300" },
  winner:  { label: "Vencedora 🏆", cls: "border-emerald-500/40 text-emerald-300" },
  loser:   { label: "Perdedora",    cls: "border-muted text-muted-foreground" },
};

export default function AILearnedRulesPanel({ projectId }: { projectId: string }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [reindexing, setReindexing] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "inactive" | "ab">("active");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("imphq_wa_project_rules")
      .select("id, rule_text, rule_type, active, times_applied, conversion_count, ab_group_id, ab_status, created_at")
      .eq("project_id", projectId)
      .order("times_applied", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar regras");
    setRules((data as Rule[]) || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (id: string, active: boolean) => {
    const { error } = await supabase
      .from("imphq_wa_project_rules")
      .update({ active, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error("Não foi possível atualizar");
    setRules(rs => rs.map(r => r.id === id ? { ...r, active } : r));
  };

  const remove = async (id: string) => {
    if (!confirm("Apagar essa regra? A IA esquece esse aprendizado.")) return;
    const { error } = await supabase.from("imphq_wa_project_rules").delete().eq("id", id);
    if (error) return toast.error("Não foi possível apagar");
    setRules(rs => rs.filter(r => r.id !== id));
    toast.success("Regra removida");
  };

  const reindex = async () => {
    setReindexing(true);
    const { data, error } = await supabase.functions.invoke("wa-rules-reindex", {
      body: { project_id: projectId, limit: 200 },
    });
    setReindexing(false);
    if (error) return toast.error("Falha ao reindexar");
    toast.success(`Reindexado: ${data?.indexed || 0} regras`);
  };

  const evaluateAB = async () => {
    setEvaluating(true);
    const { data, error } = await supabase.functions.invoke("wa-rules-evaluate-ab", {
      body: { min_sample: 30 },
    });
    setEvaluating(false);
    if (error) return toast.error("Falha ao avaliar A/B");
    toast.success(`Avaliados: ${data?.evaluated || 0} grupos`);
    load();
  };

  const forceWinner = async (rule: Rule) => {
    if (!rule.ab_group_id) return;
    if (!confirm("Forçar essa variante como vencedora? Desativa as demais do grupo.")) return;
    await supabase.from("imphq_wa_project_rules").update({
      ab_status: "winner", ab_decided_at: new Date().toISOString(),
    }).eq("id", rule.id);
    await supabase.from("imphq_wa_project_rules").update({
      ab_status: "loser", active: false, ab_decided_at: new Date().toISOString(),
    }).eq("ab_group_id", rule.ab_group_id).neq("id", rule.id);
    toast.success("Vencedora definida");
    load();
  };

  // agrupa por ab_group_id pra calcular taxas relativas
  const groupRates = new Map<string, { best: number }>();
  for (const r of rules) {
    if (!r.ab_group_id) continue;
    const rate = r.times_applied > 0 ? r.conversion_count / r.times_applied : 0;
    const g = groupRates.get(r.ab_group_id);
    if (!g || rate > g.best) groupRates.set(r.ab_group_id, { best: rate });
  }

  const filtered = rules.filter(r => {
    if (filter === "all") return true;
    if (filter === "active") return r.active;
    if (filter === "inactive") return !r.active;
    if (filter === "ab") return !!r.ab_group_id;
    return true;
  });

  const counts = {
    total: rules.length,
    active: rules.filter(r => r.active).length,
    ab: rules.filter(r => !!r.ab_group_id).length,
    unavailable: rules.filter(r => r.rule_type === "unavailable_product" && r.active).length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Aprendizado da IA</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Regras geradas das correções. Agora com <strong>RAG</strong> (top-K por contexto) e <strong>A/B</strong> automático em conflitos.
          </p>
        </div>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" onClick={reindex} disabled={reindexing} className="gap-1.5">
            {reindexing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Reindexar
          </Button>
          <Button variant="outline" size="sm" onClick={evaluateAB} disabled={evaluating} className="gap-1.5">
            {evaluating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
            Avaliar A/B
          </Button>
          <Button variant="ghost" size="sm" onClick={load} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Recarregar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="Total" value={counts.total} />
        <Stat label="Ativas" value={counts.active} highlight />
        <Stat label="Em teste A/B" value={counts.ab} />
        <Stat label="Indisponíveis" value={counts.unavailable} />
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {(["active", "ab", "inactive", "all"] as const).map(f => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
            className="text-xs h-7"
          >
            {f === "active" ? "Ativas" : f === "ab" ? "A/B" : f === "inactive" ? "Inativas" : "Todas"}
          </Button>
        ))}
      </div>

      <ScrollArea className="h-[420px] rounded-lg border border-border/40 bg-background/30">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> carregando…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center px-4">
            <BookOpen className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhuma regra para esse filtro.
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Corrija uma resposta da IA no chat e marque como "Regra do projeto" ou "Produto indisponível".
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {filtered.map(r => {
              const meta = TYPE_META[r.rule_type] || TYPE_META.behavior;
              const Icon = meta.icon;
              const ab = r.ab_status ? AB_META[r.ab_status] : null;
              const rate = r.times_applied > 0 ? (r.conversion_count / r.times_applied) : 0;
              const groupBest = r.ab_group_id ? (groupRates.get(r.ab_group_id)?.best || 0) : 0;
              const isLeading = r.ab_group_id && rate > 0 && rate >= groupBest;
              return (
                <div key={r.id} className="p-3 flex items-start gap-3 hover:bg-secondary/20 transition-colors">
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${meta.color}`} />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px] h-5">{meta.label}</Badge>
                      {ab && <Badge variant="outline" className={`text-[10px] h-5 ${ab.cls}`}>{ab.label}</Badge>}
                      {r.times_applied > 0 && (
                        <Badge variant="secondary" className="text-[10px] h-5">
                          {r.times_applied}× · {r.conversion_count} vendas · {(rate * 100).toFixed(1)}%
                        </Badge>
                      )}
                      {isLeading && r.ab_status !== "winner" && (
                        <Badge variant="outline" className="text-[10px] h-5 border-emerald-500/40 text-emerald-300">
                          liderando
                        </Badge>
                      )}
                      {!r.active && (
                        <Badge variant="outline" className="text-[10px] h-5 opacity-60">desativada</Badge>
                      )}
                    </div>
                    <p className={`text-sm leading-6 ${r.active ? "text-foreground" : "text-muted-foreground line-through"}`}>
                      {r.rule_text}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60">
                      criada {new Date(r.created_at).toLocaleDateString("pt-BR")}
                      {r.ab_group_id && <> · grupo A/B {r.ab_group_id.slice(0, 6)}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {r.ab_group_id && r.ab_status !== "winner" && (
                      <Button
                        variant="ghost" size="icon"
                        title="Forçar vencedora"
                        className="h-7 w-7 text-muted-foreground hover:text-emerald-400"
                        onClick={() => forceWinner(r)}
                      >
                        <Crown className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Switch checked={r.active} onCheckedChange={(v) => toggle(r.id, v)} />
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(r.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "border-primary/30 bg-primary/5" : "border-border/40 bg-secondary/20"}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-xl font-display ${highlight ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

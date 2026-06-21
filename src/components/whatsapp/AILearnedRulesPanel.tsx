import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Trash2, Shield, Ban, BookOpen, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type Rule = {
  id: string;
  rule_text: string;
  rule_type: "behavior" | "unavailable_product" | "qualification" | string;
  active: boolean;
  times_applied: number;
  created_at: string;
};

const TYPE_META: Record<string, { label: string; icon: any; color: string }> = {
  behavior:            { label: "Regra",        icon: BookOpen, color: "text-primary" },
  qualification:       { label: "Qualificação", icon: Shield,   color: "text-blue-400" },
  unavailable_product: { label: "Indisponível", icon: Ban,      color: "text-destructive" },
};

export default function AILearnedRulesPanel({ projectId }: { projectId: string }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("active");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("imphq_wa_project_rules")
      .select("id, rule_text, rule_type, active, times_applied, created_at")
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

  const filtered = rules.filter(r =>
    filter === "all" ? true : filter === "active" ? r.active : !r.active
  );

  const counts = {
    total: rules.length,
    active: rules.filter(r => r.active).length,
    behavior: rules.filter(r => r.rule_type === "behavior" && r.active).length,
    unavailable: rules.filter(r => r.rule_type === "unavailable_product" && r.active).length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Aprendizado da IA</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Regras geradas a partir das correções feitas no chat. Ficam SEMPRE no prompt — não dependem de similaridade.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={load} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Recarregar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="Total" value={counts.total} />
        <Stat label="Ativas" value={counts.active} highlight />
        <Stat label="Comportamento" value={counts.behavior} />
        <Stat label="Indisponíveis" value={counts.unavailable} />
      </div>

      <div className="flex gap-1.5">
        {(["active", "inactive", "all"] as const).map(f => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
            className="text-xs h-7"
          >
            {f === "active" ? "Ativas" : f === "inactive" ? "Inativas" : "Todas"}
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
              Nenhuma regra {filter === "active" ? "ativa" : filter === "inactive" ? "inativa" : ""} ainda.
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
              return (
                <div key={r.id} className="p-3 flex items-start gap-3 hover:bg-secondary/20 transition-colors">
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${meta.color}`} />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px] h-5">{meta.label}</Badge>
                      {r.times_applied > 0 && (
                        <Badge variant="secondary" className="text-[10px] h-5">
                          aplicada {r.times_applied}×
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
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
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

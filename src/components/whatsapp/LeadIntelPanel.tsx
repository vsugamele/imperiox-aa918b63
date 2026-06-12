import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, Zap, Tag, Activity, Cpu, ShoppingBag, Flame, ListPlus, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface LeadIntelPanelProps {
  leadId?: string | null;
  phone?: string | null;
  projectId?: string | null;
}


export function LeadIntelPanel({ leadId, phone, projectId }: LeadIntelPanelProps) {
  const [intel, setIntel] = useState<any>(null);
  const [activeFlow, setActiveFlow] = useState<any>(null);
  const [sales, setSales] = useState<any[]>([]);
  const [resolvedLeadIdState, setResolvedLeadIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {

    if (!leadId && !phone) return;
    const load = async () => {
      setLoading(true);
      try {
        let lead: any = null;
        let resolvedLeadId = leadId;

        // Try searching lead by leadId first, fallback to phone
        if (resolvedLeadId) {
          const { data } = await supabase
            .from("imphq_leads")
            .select("id, score, awareness_level, tags, lead_memory, name")
            .eq("id", resolvedLeadId)
            .maybeSingle();
          lead = data;
        } else if (phone) {
          const { data } = await supabase
            .from("imphq_leads")
            .select("id, score, awareness_level, tags, lead_memory, name")
            .eq("phone", phone)
            .maybeSingle();
          lead = data;
          if (lead) {
            resolvedLeadId = lead.id;
          }
        }

        setIntel(lead);

        // Load active flow execution using resolvedLeadId
        if (resolvedLeadId) {
          const { data: exec } = await supabase
            .from("imphq_flow_executions")
            .select("id, automacao_id, current_step, status, updated_at")
            .eq("lead_id", resolvedLeadId)
            .in("status", ["running", "waiting"])
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (exec?.automacao_id) {
            const { data: auto } = await supabase
              .from("imphq_automacoes")
              .select("nome, acoes")
              .eq("id", exec.automacao_id)
              .maybeSingle();
            setActiveFlow({
              ...exec,
              nome: (auto as any)?.nome,
              totalSteps: (auto as any)?.acoes?.length || 0,
            });
          } else {
            setActiveFlow(null);
          }

          // Load last triage intent
          const { data: triage } = await supabase
            .from("imphq_wa_triage")
            .select("intent, created_at")
            .eq("lead_id", resolvedLeadId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (triage) {
            setIntel((prev: any) =>
              prev ? { ...prev, lastIntent: (triage as any).intent } : prev
            );
          }

          setResolvedLeadIdState(resolvedLeadId);

          // Últimas vendas do lead
          const { data: vendas } = await supabase
            .from("imphq_vendas")
            .select("id, produto_nome, valor, status, data_venda, tipo_venda")
            .eq("lead_id", resolvedLeadId)
            .order("data_venda", { ascending: false })
            .limit(3);
          setSales((vendas as any[]) || []);
        }

      } catch (e) {
        console.error("LeadIntelPanel load error:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [leadId, phone]);

  if (!leadId && !phone) return null;
  if (loading) {
    return (
      <div className="w-64 border-l border-border bg-card/60 flex items-center justify-center p-6 flex-shrink-0 animate-pulse">
        <div className="flex flex-col items-center gap-2">
          <Brain className="h-6 w-6 text-primary animate-bounce" />
          <span className="text-xs text-muted-foreground font-medium">Carregando inteligência...</span>
        </div>
      </div>
    );
  }
  if (!intel) {
    return (
      <div className="w-64 border-l border-border bg-card/40 flex items-center justify-center p-4 text-center flex-shrink-0">
        <p className="text-xs text-muted-foreground italic">Lead não identificado no funil.</p>
      </div>
    );
  }

  const score = intel.score || 0;
  const awarenessLevel = intel.awareness_level || 0;
  const tags: string[] = intel.tags || [];
  const lastIntent = intel.lastIntent;

  const scoreColor = score >= 70 ? "text-emerald-400" : score >= 40 ? "text-amber-400" : "text-red-400";
  const scoreBarColor = score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-red-500";

  const awarenessLabels = [
    "",
    "🌑 Inconsciente",
    "🌘 Dor consciente",
    "🌗 Solução ciente",
    "🌔 Produto ciente",
    "🌕 Mais que pronto",
  ];
  const awarenessColors = [
    "",
    "bg-zinc-800 text-zinc-300 border-zinc-700",
    "bg-red-950 text-red-400 border-red-900/50",
    "bg-amber-950 text-amber-400 border-amber-900/50",
    "bg-blue-950 text-blue-400 border-blue-900/50",
    "bg-emerald-950 text-emerald-400 border-emerald-900/50",
  ];

  return (
    <div className="w-64 border-l border-border bg-card flex flex-col text-xs overflow-y-auto flex-shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-border/80 bg-secondary/15 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-primary/10">
            <Brain className="h-4 w-4 text-primary" />
          </div>
          <span className="font-bold text-[11px] uppercase tracking-wider text-foreground">Inteligência do Lead</span>
        </div>
      </div>

      <div className="flex-1 divide-y divide-border/40">
        {/* Lead Score */}
        <div className="p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-medium">Pontuação (Score)</span>
            <span className={`font-extrabold text-base font-mono ${scoreColor}`}>{score}</span>
          </div>
          <div className="w-full bg-secondary/80 rounded-full h-1.5 overflow-hidden">
            <div className={`h-1.5 rounded-full transition-all ${scoreBarColor}`} style={{ width: `${score}%` }} />
          </div>
        </div>

        {/* Nível de Consciência */}
        {awarenessLevel > 0 && (
          <div className="p-4 space-y-1.5">
            <span className="text-muted-foreground font-medium">Nível de Consciência</span>
            <div>
              <Badge variant="outline" className={`text-[10px] px-2 py-0.5 font-semibold ${awarenessColors[awarenessLevel]}`}>
                {awarenessLabels[awarenessLevel]}
              </Badge>
            </div>
          </div>
        )}

        {/* Última Intenção Detectada */}
        {lastIntent && (
          <div className="p-4 space-y-1.5">
            <span className="text-muted-foreground font-medium">Última Intenção da IA</span>
            <div className="flex items-center gap-1.5 bg-amber-500/5 border border-amber-500/10 rounded-lg p-2 text-foreground">
              <Zap className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
              <span className="font-semibold text-amber-300">{lastIntent}</span>
            </div>
          </div>
        )}

        {/* Fluxo OpenFlow Ativo */}
        {activeFlow && (
          <div className="p-4 space-y-2">
            <div className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-primary" />
              <span className="text-muted-foreground font-medium">Automação Ativa</span>
            </div>
            <div className="bg-secondary/20 border border-border/40 rounded-lg p-2.5 space-y-2">
              <p className="text-foreground font-semibold truncate" title={activeFlow.nome}>
                {activeFlow.nome}
              </p>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Etapa {(activeFlow.current_step || 0) + 1} de {activeFlow.totalSteps}</span>
                <Badge variant="outline" className="text-[8px] px-1 py-0 uppercase bg-primary/10 border-primary/20 text-primary">
                  {activeFlow.status}
                </Badge>
              </div>
              {activeFlow.totalSteps > 0 && (
                <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
                  <div
                    className="bg-primary h-1 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (((activeFlow.current_step || 0) + 1) / activeFlow.totalSteps) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="p-4 space-y-2">
            <div className="flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground font-medium">Tags do Lead</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, 8).map((tag) => (
                <Badge key={tag} variant="outline" className="text-[9px] px-1.5 py-0 bg-secondary/30 text-foreground/80 font-medium">
                  {tag}
                </Badge>
              ))}
              {tags.length > 8 && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-secondary/50 text-muted-foreground font-medium">
                  +{tags.length - 8}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Memória do Lead */}
        {intel.lead_memory && (
          <div className="p-4 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-muted-foreground font-medium">Memória Persistida IA</span>
            </div>
            <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-2.5 max-h-36 overflow-y-auto">
              <p className="text-muted-foreground text-[10px] leading-relaxed whitespace-pre-wrap">
                {intel.lead_memory}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

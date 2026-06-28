import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, Zap, Tag, Activity, Cpu, ShoppingBag, Flame, ListPlus, ExternalLink, FolderKanban, Pencil } from "lucide-react";
import { toast } from "sonner";
import { brPhoneVariants } from "@/lib/phoneVariants";
import { LeadMemoryEditor } from "./LeadMemoryEditor";


interface LeadIntelPanelProps {
  leadId?: string | null;
  phone?: string | null;
  projectId?: string | null;
}

interface ProjectPresence {
  leadId: string;
  projectId: string | null;
  projectName: string;
  score: number;
  salesCount: number;
  totalSpent: number;
}

export function LeadIntelPanel({ leadId, phone, projectId }: LeadIntelPanelProps) {
  const [intel, setIntel] = useState<any>(null);
  const [activeFlow, setActiveFlow] = useState<any>(null);
  const [sales, setSales] = useState<any[]>([]);
  const [presence, setPresence] = useState<ProjectPresence[]>([]);
  const [resolvedLeadIdState, setResolvedLeadIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!leadId && !phone) return;
    const load = async () => {
      setLoading(true);
      try {
        // 1) Resolve TODOS os leads desse contato (cross-projeto) por variantes de telefone
        let allLeads: any[] = [];
        if (phone) {
          const { variants } = brPhoneVariants(phone);
          if (variants.length) {
            const { data } = await supabase
              .from("imphq_leads")
              .select("id, score, awareness_level, tags, lead_memory, name, project_id")
              .in("phone", variants);
            allLeads = (data as any[]) || [];
          }
        }
        if (leadId && !allLeads.some((l) => l.id === leadId)) {
          const { data } = await supabase
            .from("imphq_leads")
            .select("id, score, awareness_level, tags, lead_memory, name, project_id")
            .eq("id", leadId)
            .maybeSingle();
          if (data) allLeads.push(data);
        }

        const leadIds = allLeads.map((l) => l.id);
        const projectIds = [...new Set(allLeads.map((l) => l.project_id).filter(Boolean))];

        // 2) Nomes dos projetos
        let projectMap: Record<string, string> = {};
        if (projectIds.length) {
          const { data: projs } = await supabase
            .from("imphq_projects")
            .select("id, name")
            .in("id", projectIds);
          projectMap = Object.fromEntries(((projs as any[]) || []).map((p) => [p.id, p.name]));
        }

        // 3) Vendas agregadas (todos os lead_ids)
        let allSales: any[] = [];
        if (leadIds.length) {
          const { data: vendas } = await supabase
            .from("imphq_vendas")
            .select("id, produto_nome, valor, status, data_venda, tipo_venda, project_id, lead_id")
            .in("lead_id", leadIds)
            .order("data_venda", { ascending: false })
            .limit(20);
          allSales = (vendas as any[]) || [];
        }
        setSales(allSales);

        // 4) Monta presença por projeto
        const presenceList: ProjectPresence[] = allLeads.map((l) => {
          const leadSales = allSales.filter((s) => s.lead_id === l.id);
          return {
            leadId: l.id,
            projectId: l.project_id,
            projectName: projectMap[l.project_id] || "Sem projeto",
            score: l.score || 0,
            salesCount: leadSales.length,
            totalSpent: leadSales.reduce((acc, s) => acc + Number(s.valor || 0), 0),
          };
        }).sort((a, b) => (b.salesCount - a.salesCount) || (b.score - a.score));
        setPresence(presenceList);

        // 5) Escolhe lead "principal": do projeto atual, senão o de maior presença
        const primary =
          allLeads.find((l) => l.project_id === projectId) ||
          (presenceList[0] ? allLeads.find((l) => l.id === presenceList[0].leadId) : null);

        setIntel(primary || null);
        const resolvedLeadId = primary?.id || null;
        setResolvedLeadIdState(resolvedLeadId);

        // 6) Fluxo ativo + intent do lead principal
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
        }
      } catch (e) {
        console.error("LeadIntelPanel load error:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [leadId, phone, projectId]);

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

  const projectNameById = (id: string | null) =>
    presence.find((p) => p.projectId === id)?.projectName || null;

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
        {/* Presença em Projetos (cross-funil) */}
        {presence.length > 0 && (
          <div className="p-4 space-y-2">
            <div className="flex items-center gap-1.5">
              <FolderKanban className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-muted-foreground font-medium">
                Presença em Projetos {presence.length > 1 && <span className="text-violet-400">({presence.length})</span>}
              </span>
            </div>
            <div className="space-y-1.5">
              {presence.map((p) => (
                <button
                  key={p.leadId}
                  onClick={() => window.open(`/leads/${p.leadId}`, "_blank")}
                  className={`w-full text-left rounded-lg p-2 border transition-colors ${
                    p.projectId === projectId
                      ? "bg-violet-500/10 border-violet-500/30"
                      : "bg-secondary/20 border-border/40 hover:bg-secondary/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-foreground font-semibold truncate text-[11px]" title={p.projectName}>
                      {p.projectName}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                      {p.score}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                    <span>{p.salesCount} {p.salesCount === 1 ? "compra" : "compras"}</span>
                    {p.totalSpent > 0 && (
                      <span className="text-emerald-400 font-mono">
                        R${p.totalSpent.toFixed(0)}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

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

        {/* Histórico de Compras */}
        <div className="p-4 space-y-2">
          <div className="flex items-center gap-1.5">
            <ShoppingBag className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-muted-foreground font-medium">Histórico de Compras</span>
          </div>
          {sales.length === 0 ? (
            <p className="text-[10px] text-muted-foreground/70 italic">Nenhuma compra registrada.</p>
          ) : (
            <div className="space-y-1.5">
              {sales.map((v) => (
                <div key={v.id} className="bg-emerald-500/5 border border-emerald-500/15 rounded-lg p-2 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-foreground font-semibold truncate text-[11px]" title={v.produto_nome}>
                      {v.produto_nome || "—"}
                    </span>
                    <span className="text-emerald-300 font-mono text-[11px] shrink-0">
                      R${Number(v.valor || 0).toFixed(0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1 text-[9px] text-muted-foreground">
                    <span className="truncate">
                      {v.data_venda ? new Date(v.data_venda).toLocaleDateString("pt-BR") : ""}
                      {projectNameById(v.project_id) && (
                        <span className="text-violet-300/80"> · {projectNameById(v.project_id)}</span>
                      )}
                    </span>
                    <Badge variant="outline" className="text-[8px] px-1 py-0 uppercase shrink-0">
                      {v.tipo_venda || v.status || "venda"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ações Rápidas */}
        <div className="p-4 space-y-1.5">
          <span className="text-muted-foreground font-medium text-[10px] uppercase tracking-wider">Ações Rápidas</span>
          <div className="grid grid-cols-1 gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-7 justify-start text-[11px] gap-1.5 hover:bg-orange-500/10 hover:border-orange-500/40 hover:text-orange-300"
              disabled={!resolvedLeadIdState}
              onClick={async () => {
                if (!resolvedLeadIdState) return;
                const { error } = await supabase
                  .from("imphq_leads")
                  .update({ score: 95 } as any)
                  .eq("id", resolvedLeadIdState);
                if (error) toast.error("Erro: " + error.message);
                else { toast.success("🔥 Marcado como hot lead"); setIntel((p: any) => ({ ...p, score: 95 })); }
              }}
            >
              <Flame className="h-3 w-3" /> Marcar como hot lead
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 justify-start text-[11px] gap-1.5"
              disabled={!resolvedLeadIdState}
              onClick={async () => {
                if (!resolvedLeadIdState) return;
                const titulo = window.prompt("Título da tarefa:", `Follow-up: ${intel?.name || "lead"}`);
                if (!titulo) return;
                const { error } = await supabase.from("imphq_tasks").insert({
                  title: titulo,
                  project_id: projectId,
                  priority: "alta",
                  status: "pendente",
                  description: `Lead: ${intel?.name || ""} · score ${intel?.score || 0} · origem: inbox`,
                } as any);
                if (error) toast.error("Erro: " + error.message);
                else toast.success("📋 Tarefa criada");
              }}
            >
              <ListPlus className="h-3 w-3" /> Criar tarefa
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 justify-start text-[11px] gap-1.5"
              disabled={!resolvedLeadIdState}
              onClick={() => { window.open(`/leads?id=${resolvedLeadIdState}`, "_blank"); }}
            >
              <ExternalLink className="h-3 w-3" /> Abrir no CRM
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 justify-start text-[11px] gap-1.5"
              disabled={!resolvedLeadIdState}
              onClick={() => { window.open(`/leads/${resolvedLeadIdState}`, "_blank"); }}
            >
              <Activity className="h-3 w-3" /> Lead 360°
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


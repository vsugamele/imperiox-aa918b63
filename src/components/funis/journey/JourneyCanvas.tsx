import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Sparkles, Trash2, X, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { normalizeProductLinks } from "@/lib/produto-links";
import { BlockLibrary, BLOCK_TYPES, BlockType } from "./BlockLibrary";
import { BlockDrawer } from "./BlockDrawer";

interface Project { id: string; name: string; briefing?: any; }
interface Props { projects: Project[]; initialProjectId?: string | null; }

const ETAPAS = [
  { id: "descoberta", label: "Descoberta", color: "border-blue-500/40 bg-blue-500/5" },
  { id: "interesse", label: "Interesse", color: "border-cyan-500/40 bg-cyan-500/5" },
  { id: "consideracao", label: "Consideração", color: "border-amber-500/40 bg-amber-500/5" },
  { id: "decisao", label: "Decisão", color: "border-orange-500/40 bg-orange-500/5" },
  { id: "compra", label: "Compra", color: "border-emerald-500/40 bg-emerald-500/5" },
  { id: "pos", label: "Pós-Compra", color: "border-violet-500/40 bg-violet-500/5" },
];

interface Step {
  id: string; journey_id: string; etapa: string; bloco_tipo: string;
  titulo: string | null; config: any; output: any; status: string; order_idx: number;
}

export function JourneyCanvas({ projects, initialProjectId }: Props) {
  const [projectId, setProjectId] = useState<string>(initialProjectId || projects[0]?.id || "");
  const [productIdx, setProductIdx] = useState(0);
  const [journeyId, setJourneyId] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(false);
  const [orchestrating, setOrchestrating] = useState(false);
  const [drawerStep, setDrawerStep] = useState<Step | null>(null);
  const [dragBlock, setDragBlock] = useState<BlockType | null>(null);

  const project = projects.find(p => p.id === projectId);
  const briefing = useMemo(() => {
    const b = project?.briefing;
    return typeof b === "string" ? (() => { try { return JSON.parse(b); } catch { return {}; } })() : (b || {});
  }, [project]);
  const produtos = briefing?.produtos || [];
  const produto = produtos[productIdx];

  // Load / create journey
  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    (async () => {
      const { data: existing } = await supabase
        .from("imphq_journeys")
        .select("id")
        .eq("projeto_id", projectId)
        .eq("produto_idx", productIdx)
        .maybeSingle();
      let jid = existing?.id;
      if (!jid) {
        const { data: created, error } = await supabase
          .from("imphq_journeys")
          .insert({ projeto_id: projectId, produto_idx: productIdx, produto_nome: produto?.nome || produto?.name || null })
          .select("id")
          .single();
        if (error) { toast.error("Erro ao criar jornada: " + error.message); setLoading(false); return; }
        jid = created!.id;
      }
      setJourneyId(jid);
      const { data: sList } = await supabase
        .from("imphq_journey_steps")
        .select("*")
        .eq("journey_id", jid)
        .order("etapa")
        .order("order_idx");
      setSteps((sList as any) || []);
      setLoading(false);
    })();
  }, [projectId, productIdx]);

  // Realtime
  useEffect(() => {
    if (!journeyId) return;
    const ch = supabase
      .channel(`journey-${journeyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "imphq_journey_steps", filter: `journey_id=eq.${journeyId}` }, (payload) => {
        setSteps(prev => {
          if (payload.eventType === "INSERT") return [...prev, payload.new as Step];
          if (payload.eventType === "UPDATE") return prev.map(s => s.id === (payload.new as any).id ? payload.new as Step : s);
          if (payload.eventType === "DELETE") return prev.filter(s => s.id !== (payload.old as any).id);
          return prev;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [journeyId]);

  const addBlock = async (etapa: string, bloco: BlockType) => {
    if (!journeyId) return;
    const order = steps.filter(s => s.etapa === etapa).length;
    const { data, error } = await supabase.from("imphq_journey_steps").insert({
      journey_id: journeyId, etapa, bloco_tipo: bloco.id, titulo: bloco.label,
      order_idx: order, status: "pendente", config: {}, output: {},
    }).select("*").single();
    if (error) { toast.error(error.message); return; }
    toast.success(`${bloco.label} adicionado em ${ETAPAS.find(e => e.id === etapa)?.label}`);
  };

  const removeStep = async (id: string) => {
    await supabase.from("imphq_journey_steps").delete().eq("id", id);
  };

  const generateStep = async (step: Step) => {
    if (!projectId) return;
    await supabase.from("imphq_journey_steps").update({ status: "gerando" }).eq("id", step.id);
    try {
      const { data, error } = await supabase.functions.invoke("journey-orchestrator", {
        body: { action: "generate_step", step_id: step.id, projeto_id: projectId, produto_idx: productIdx },
      });
      if (error) throw error;
      toast.success("Bloco gerado!");
    } catch (e: any) {
      toast.error("Erro ao gerar: " + (e?.message || "desconhecido"));
      await supabase.from("imphq_journey_steps").update({ status: "erro" }).eq("id", step.id);
    }
  };

  const autoJourney = async () => {
    if (!journeyId || !projectId) return;
    setOrchestrating(true);
    try {
      const { error } = await supabase.functions.invoke("journey-orchestrator", {
        body: { action: "auto_plan", journey_id: journeyId, projeto_id: projectId, produto_idx: productIdx },
      });
      if (error) throw error;
      toast.success("Imperius plantou blocos em todas as etapas");
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || "desconhecido"));
    } finally {
      setOrchestrating(false);
    }
  };

  const linksCount = normalizeProductLinks(produto).length;

  return (
    <div className="flex gap-3 h-[calc(100vh-180px)]">
      {/* Sidebar */}
      <BlockLibrary onDragStart={setDragBlock} onDragEnd={() => setDragBlock(null)} />

      {/* Main canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Select value={projectId} onValueChange={(v) => { setProjectId(v); setProductIdx(0); }}>
            <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue placeholder="Projeto" /></SelectTrigger>
            <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
          {produtos.length > 0 && (
            <Select value={String(productIdx)} onValueChange={(v) => setProductIdx(Number(v))}>
              <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {produtos.map((p: any, i: number) => (
                  <SelectItem key={i} value={String(i)}>{p.nome || p.name || `Produto ${i+1}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="text-[10px] text-muted-foreground">
            {linksCount > 0 ? `${linksCount} link(s) do produto` : "Sem links — vincule em Ativos"}
          </div>
          <div className="flex-1" />
          <Button size="sm" onClick={autoJourney} disabled={!journeyId || orchestrating} className="h-8 gap-1.5 bg-gradient-to-r from-primary to-primary/70">
            {orchestrating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            Auto-Jornada
          </Button>
        </div>

        {loading && <div className="flex-1 flex items-center justify-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>}

        {!loading && (
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            <div className="flex gap-3 h-full min-w-max pb-2">
              {ETAPAS.map(etapa => {
                const etapaSteps = steps.filter(s => s.etapa === etapa.id).sort((a, b) => a.order_idx - b.order_idx);
                return (
                  <div
                    key={etapa.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); if (dragBlock) addBlock(etapa.id, dragBlock); setDragBlock(null); }}
                    className={cn("w-[260px] shrink-0 rounded-lg border-2 flex flex-col", etapa.color, dragBlock && "ring-2 ring-primary/40")}
                  >
                    <div className="px-3 py-2 border-b border-border/40">
                      <h3 className="text-xs font-bold uppercase tracking-wider">{etapa.label}</h3>
                      <p className="text-[9px] text-muted-foreground">{etapaSteps.length} bloco{etapaSteps.length !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                      {etapaSteps.map(s => {
                        const meta = BLOCK_TYPES.find(b => b.id === s.bloco_tipo);
                        return (
                          <div
                            key={s.id}
                            onClick={() => setDrawerStep(s)}
                            className="group rounded-md border border-border/60 bg-background/60 p-2 cursor-pointer hover:border-primary/50 hover:bg-background/90 transition"
                          >
                            <div className="flex items-start justify-between gap-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-sm">{meta?.icon || "📦"}</span>
                                <span className="text-xs font-medium truncate">{s.titulo || meta?.label}</span>
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); removeStep(s.id); }}
                                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-400"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                            <div className="flex items-center justify-between mt-1.5">
                              <span className={cn(
                                "text-[9px] px-1.5 py-0.5 rounded border font-semibold uppercase",
                                s.status === "gerado" && "bg-amber-500/15 text-amber-300 border-amber-500/40",
                                s.status === "publicado" && "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
                                s.status === "gerando" && "bg-blue-500/15 text-blue-300 border-blue-500/40",
                                s.status === "erro" && "bg-rose-500/15 text-rose-300 border-rose-500/40",
                                s.status === "pendente" && "bg-muted/30 text-muted-foreground border-muted-foreground/30",
                              )}>
                                {s.status === "gerando" && <Loader2 className="inline h-2.5 w-2.5 animate-spin mr-0.5" />}
                                {s.status}
                              </span>
                              {s.status === "pendente" && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); generateStep(s); }}
                                  className="text-[9px] text-primary hover:underline flex items-center gap-0.5"
                                >
                                  <Sparkles className="h-2.5 w-2.5" /> gerar
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {etapaSteps.length === 0 && (
                        <div className="text-center text-[10px] text-muted-foreground/50 py-6 border border-dashed border-border/30 rounded">
                          Arraste blocos aqui
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <BlockDrawer
        step={drawerStep}
        onClose={() => setDrawerStep(null)}
        onGenerate={(s) => { generateStep(s); setDrawerStep(null); }}
        onUpdate={async (patch) => {
          if (!drawerStep) return;
          await supabase.from("imphq_journey_steps").update(patch).eq("id", drawerStep.id);
        }}
      />
    </div>
  );
}

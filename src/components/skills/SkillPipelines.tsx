// SkillPipelines.tsx — Pipelines pré-montadas que encadeiam skills em sequência
// passando o output de uma como input da próxima
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Play, Loader2, ArrowRight, CheckCircle2, Circle, Save,
  Zap, Target, Brain, PenTool, Globe, Copy, ChevronDown, ChevronUp,
  Flame, Package, TrendingUp, Lightbulb,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface PipelineStep {
  skill_id: string;
  skill_nome: string;
  skill_color: string;
  skill_icon: any;
  descricao: string;
  /** Se true, usa o output do passo anterior como contexto */
  usa_output_anterior?: boolean;
  extra_instructions?: string;
}

interface Pipeline {
  id: string;
  nome: string;
  descricao: string;
  emoji: string;
  color: string;
  categoria: string;
  steps: PipelineStep[];
  quando_usar: string;
}

const PIPELINES: Pipeline[] = [
  {
    id: "lancamento-zero",
    nome: "Lançamento Zero → LP",
    descricao: "Pipeline completo de lançamento: do Avatar ao Mecanismo, da LP ao Tripwire. Roda 4 skills em sequência, cada uma alimentada pelo output da anterior.",
    emoji: "🚀",
    color: "#f59e0b",
    categoria: "Lançamento",
    quando_usar: "Use quando for montar um lançamento do zero. Precisa de ~5-10 min para rodar todas as etapas.",
    steps: [
      {
        skill_id: "avatar-architect", skill_nome: "Avatar Architect", skill_color: "#f59e0b",
        skill_icon: Brain, descricao: "Mapeia desejos, dores e gatilhos do avatar ideal",
        extra_instructions: "Crie um dossiê completo do avatar com desejos, dores, crenças e gatilhos de compra.",
      },
      {
        skill_id: "mecanismo-unico", skill_nome: "Mecanismo Único", skill_color: "#8b5cf6",
        skill_icon: Zap, descricao: "Cria o diferencial exclusivo do produto", usa_output_anterior: true,
        extra_instructions: "Com base no avatar acima, crie o mecanismo único que resolve a dor principal.",
      },
      {
        skill_id: "lp-persuasiva", skill_nome: "LP Persuasiva", skill_color: "#10b981",
        skill_icon: Target, descricao: "Estrutura completa de landing page de alta conversão", usa_output_anterior: true,
        extra_instructions: "Usando o avatar e o mecanismo acima, escreva uma LP completa com headline, VSL outline, prova social, garantia e CTA.",
      },
      {
        skill_id: "tripwire-matador", skill_nome: "Tripwire Matador", skill_color: "#ef4444",
        skill_icon: Flame, descricao: "Oferta de entrada irresistível para baixar a barreira de compra", usa_output_anterior: true,
        extra_instructions: "Com base no produto principal acima, crie um tripwire irresistível de R$27-97 que prepara o lead para a oferta principal.",
      },
    ],
  },
  {
    id: "pesquisa-copy",
    nome: "Pesquisa → Copy de Alto Impacto",
    descricao: "Vai do mapeamento profundo de mercado até a copy final. Ideal para lançar um produto em mercado competitivo.",
    emoji: "⚡",
    color: "#3b82f6",
    categoria: "Copy",
    quando_usar: "Use quando precisar de copy matadora para um produto em mercado saturado. Roda 3 skills.",
    steps: [
      {
        skill_id: "mapeamento-desejos", skill_nome: "Mapeamento de Desejos", skill_color: "#3b82f6",
        skill_icon: Brain, descricao: "Mapeia os 7 desejos universais aplicados ao nicho",
        extra_instructions: "Faça um mapeamento profundo dos desejos deste nicho, conectando desejos primários e secundários.",
      },
      {
        skill_id: "devastador", skill_nome: "Devastador de Ângulos", skill_color: "#ec4899",
        skill_icon: PenTool, descricao: "Gera 10+ ângulos de ataque para a copy", usa_output_anterior: true,
        extra_instructions: "Com base nos desejos acima, crie 10 ângulos de copy devastadores para campanha de tráfego.",
      },
      {
        skill_id: "anams-copywriter", skill_nome: "Ana MS Copywriter", skill_color: "#f59e0b",
        skill_icon: PenTool, descricao: "Escreve a copy final com os melhores ângulos", usa_output_anterior: true,
        extra_instructions: "Use os 3 melhores ângulos acima para criar: 1 VSL script curto, 3 headlines e 5 hooks para reels/stories.",
      },
    ],
  },
  {
    id: "intel-posicionamento",
    nome: "Inteligência → Posicionamento",
    descricao: "Pesquisa de mercado profunda que resulta em um posicionamento único e diferenciado.",
    emoji: "🕵️",
    color: "#06b6d4",
    categoria: "Estratégia",
    quando_usar: "Use ao entrar em um novo mercado ou reposicionar um produto que parou de vender.",
    steps: [
      {
        skill_id: "market-intel", skill_nome: "Market Intel", skill_color: "#06b6d4",
        skill_icon: Globe, descricao: "Análise profunda do mercado e concorrentes",
        extra_instructions: "Faça uma análise competitiva completa: top 5 players, seus mecanismos, pontos cegos e oportunidades de diferenciação.",
      },
      {
        skill_id: "funnel-hacker", skill_nome: "Funnel Hacker", skill_color: "#8b5cf6",
        skill_icon: TrendingUp, descricao: "Descobre os funis dos líderes de mercado", usa_output_anterior: true,
        extra_instructions: "Com base na análise acima, mapeie os funis dos 3 principais players e identifique o ponto mais vulnerável.",
      },
      {
        skill_id: "reposicionamento-estrategico", skill_nome: "Reposicionamento", skill_color: "#f59e0b",
        skill_icon: Lightbulb, descricao: "Cria o posicionamento único contra o mercado", usa_output_anterior: true,
        extra_instructions: "Com os dados acima, crie um posicionamento estratégico único que vença os líderes nos pontos cegos identificados.",
      },
    ],
  },
  {
    id: "high-ticket",
    nome: "Pipeline High-Ticket",
    descricao: "Para vendas de R$3k+: constrói o dossiê do cliente ideal, o pitch de alta persuasão e o script de fechamento.",
    emoji: "💎",
    color: "#a855f7",
    categoria: "Vendas",
    quando_usar: "Use para estruturar vendas high-ticket com consultoria ou calls de fechamento.",
    steps: [
      {
        skill_id: "dossie-problemas", skill_nome: "Dossiê de Problemas", skill_color: "#a855f7",
        skill_icon: Brain, descricao: "Mapeia os problemas críticos do cliente ideal",
        extra_instructions: "Crie um dossiê profundo dos problemas que o cliente high-ticket enfrenta, hierarquizados por urgência e dor.",
      },
      {
        skill_id: "alquimia-escada-valor", skill_nome: "Alquimia de Escada de Valor", skill_color: "#f59e0b",
        skill_icon: TrendingUp, descricao: "Estrutura a escada de valor da oferta", usa_output_anterior: true,
        extra_instructions: "Com os problemas acima, construa uma escada de valor do tripwire até o high-ticket com transformações claras em cada degrau.",
      },
      {
        skill_id: "sales-closer", skill_nome: "Sales Closer", skill_color: "#10b981",
        skill_icon: Target, descricao: "Script de fechamento de alta conversão", usa_output_anterior: true,
        extra_instructions: "Com a escada de valor acima, crie um script de call de fechamento para o produto high-ticket principal.",
      },
    ],
  },
];

interface Props {
  projects: any[];
}

interface StepResult {
  skill_id: string;
  result: string;
  status: "pending" | "running" | "done" | "error";
}

export function SkillPipelines({ projects }: Props) {
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [projectId, setProjectId] = useState("");
  const [produto, setProduto] = useState("");
  const [produtos, setProdutos] = useState<string[]>([]);
  const [model, setModel] = useState("google/gemini-3-flash-preview");
  const [running, setRunning] = useState(false);
  const [stepResults, setStepResults] = useState<StepResult[]>([]);
  const [currentStep, setCurrentStep] = useState(-1);
  const [showResults, setShowResults] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [savedToDb, setSavedToDb] = useState(false);

  const onProjectChange = (pid: string) => {
    setProjectId(pid);
    setProduto("");
    const proj = projects.find((p: any) => p.id === pid);
    if (proj) {
      const d = typeof proj.data === "string" ? JSON.parse(proj.data || "{}") : (proj.data || {});
      const prods = (d.produtos || []).map((p: any) => p.nome || p.name).filter(Boolean);
      setProdutos(prods);
    } else setProdutos([]);
  };

  const runPipeline = async () => {
    if (!selectedPipeline || !projectId) {
      toast.error("Selecione um projeto para continuar");
      return;
    }
    setRunning(true);
    setShowResults(true);
    setSavedToDb(false);
    setExpandedStep(0);

    const results: StepResult[] = selectedPipeline.steps.map(s => ({
      skill_id: s.skill_id, result: "", status: "pending" as const
    }));
    setStepResults([...results]);

    let prevOutput = "";
    for (let i = 0; i < selectedPipeline.steps.length; i++) {
      const step = selectedPipeline.steps[i];
      setCurrentStep(i);
      results[i].status = "running";
      setStepResults([...results]);

      try {
        const extraCtx = step.usa_output_anterior && prevOutput
          ? `\n\n═══ CONTEXTO DO PASSO ANTERIOR ═══\n${prevOutput.slice(0, 3000)}\n═══════════════════════════════════\n\n`
          : "";

        const { data, error } = await supabase.functions.invoke("openflow-ai", {
          body: {
            action: "execute_skill",
            skill_id: step.skill_id,
            project_id: projectId,
            produto: produto || undefined,
            model,
            extra_instructions: (extraCtx + (step.extra_instructions || "")).trim(),
          },
        });
        if (error) throw error;
        const result = data?.result || "Sem resultado";
        results[i].result = result;
        results[i].status = "done";
        prevOutput = result;
        setStepResults([...results]);
        setExpandedStep(i);

        // Salva output no banco
        await supabase.from("imphq_skill_outputs").insert({
          project_id: projectId,
          skill_id: step.skill_id,
          skill_nome: step.skill_nome,
          pipeline_id: selectedPipeline.id,
          result,
          model,
          produto: produto || null,
        }).then(undefined, () => {});

      } catch (err: any) {
        results[i].status = "error";
        results[i].result = `Erro: ${err.message}`;
        setStepResults([...results]);
        toast.error(`Falha na etapa ${i + 1}: ${step.skill_nome}`);
        break;
      }

      // Pequena pausa entre steps para não saturar a API
      if (i < selectedPipeline.steps.length - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    setCurrentStep(-1);
    setRunning(false);
    setSavedToDb(true);
    toast.success(`Pipeline "${selectedPipeline.nome}" concluída! ${results.filter(r => r.status === "done").length}/${selectedPipeline.steps.length} steps.`);
  };

  const copyAllResults = () => {
    const text = stepResults
      .filter(r => r.status === "done")
      .map((r, i) => `## ${selectedPipeline?.steps[i]?.skill_nome}\n\n${r.result}`)
      .join("\n\n---\n\n");
    navigator.clipboard.writeText(text);
    toast.success("Todos os resultados copiados!");
  };

  const CATEGORIA_COLORS: Record<string, string> = {
    "Lançamento": "#f59e0b",
    "Copy": "#3b82f6",
    "Estratégia": "#06b6d4",
    "Vendas": "#a855f7",
  };

  const CATEGORIA_GROUPS = [...new Set(PIPELINES.map(p => p.categoria))];

  return (
    <div className="space-y-6 mt-4">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-purple-500/5 to-transparent border border-amber-500/20">
        <Package className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-foreground">Pipelines Encadeadas</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Sequências de skills que passam o output de uma como contexto para a próxima.
            Selecione um projeto e rode o pipeline completo com um clique.
          </p>
        </div>
      </div>

      {/* Pipeline cards grouped by category */}
      {CATEGORIA_GROUPS.map(cat => (
        <div key={cat} className="space-y-3">
          <div className="flex items-center gap-2 border-b border-border/40 pb-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORIA_COLORS[cat] || "#6366f1" }} />
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{cat}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PIPELINES.filter(p => p.categoria === cat).map(pipeline => (
              <div
                key={pipeline.id}
                className="group relative rounded-xl border border-border/60 bg-card hover:border-primary/40 hover:bg-secondary/20 transition-all cursor-pointer overflow-hidden"
                onClick={() => setSelectedPipeline(pipeline)}
              >
                {/* Color bar */}
                <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: pipeline.color }} />
                <div className="p-4 pl-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{pipeline.emoji}</span>
                      <div>
                        <p className="font-semibold text-[15px]">{pipeline.nome}</p>
                        <p className="text-[10px] text-muted-foreground">{pipeline.steps.length} steps encadeados</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0" style={{ borderColor: pipeline.color, color: pipeline.color }}>
                      {pipeline.categoria}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">{pipeline.descricao}</p>
                  {/* Steps preview */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {pipeline.steps.map((step, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <span className="text-[10px] bg-secondary/60 text-muted-foreground px-2 py-0.5 rounded-full border border-border/40">
                          {step.skill_nome}
                        </span>
                        {i < pipeline.steps.length - 1 && <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/40" />}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground/70 mt-2 italic">{pipeline.quando_usar}</p>
                </div>
                <div className="absolute bottom-3 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="sm" className="h-7 text-xs gap-1" style={{ backgroundColor: pipeline.color }}>
                    <Play className="h-3 w-3" /> Rodar Pipeline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Run pipeline dialog */}
      <Dialog open={!!selectedPipeline && !showResults} onOpenChange={open => { if (!open) setSelectedPipeline(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{selectedPipeline?.emoji}</span> {selectedPipeline?.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Steps preview */}
            <div className="p-3 rounded-lg bg-secondary/30 border border-border/40">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Sequência de execução:</p>
              <div className="space-y-1.5">
                {selectedPipeline?.steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold bg-primary/15 text-primary shrink-0">{i + 1}</span>
                    <span className="font-medium">{step.skill_nome}</span>
                    {step.usa_output_anterior && (
                      <span className="text-[9px] text-amber-400/80 bg-amber-400/10 px-1.5 rounded">↑ usa anterior</span>
                    )}
                    <span className="text-muted-foreground truncate flex-1">{step.descricao}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Projeto *</Label>
              <Select value={projectId} onValueChange={onProjectChange}>
                <SelectTrigger><SelectValue placeholder="Selecione o projeto..." /></SelectTrigger>
                <SelectContent>{projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {produtos.length > 0 && (
              <div>
                <Label>Produto (opcional)</Label>
                <Select value={produto} onValueChange={setProduto}>
                  <SelectTrigger><SelectValue placeholder="Todos os produtos" /></SelectTrigger>
                  <SelectContent>{produtos.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Modelo de IA</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="google/gemini-3-flash-preview">Gemini Flash (rápido)</SelectItem>
                  <SelectItem value="openai/gpt-4.1-mini">GPT-4.1 Mini (equilibrado)</SelectItem>
                  <SelectItem value="anthropic/claude-sonnet-4">Claude Sonnet 4 (melhor qualidade)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedPipeline(null)}>Cancelar</Button>
            <Button onClick={runPipeline} disabled={!projectId} className="gap-1.5" style={{ backgroundColor: selectedPipeline?.color }}>
              <Play className="h-4 w-4" /> Rodar Pipeline ({selectedPipeline?.steps.length} steps)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Results dialog */}
      <Dialog open={showResults} onOpenChange={v => { if (!v && !running) { setShowResults(false); setStepResults([]); setSelectedPipeline(null); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40">
            <DialogTitle className="flex items-center gap-2">
              {running && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              {selectedPipeline?.emoji} {selectedPipeline?.nome}
              {!running && savedToDb && (
                <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-400/30">
                  ✓ Salvo no projeto
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-6 space-y-4">
              {stepResults.map((r, i) => {
                const step = selectedPipeline?.steps[i];
                if (!step) return null;
                const isExpanded = expandedStep === i;
                return (
                  <div key={i} className={`rounded-xl border transition-all ${
                    r.status === "done" ? "border-emerald-500/30 bg-emerald-500/5" :
                    r.status === "running" ? "border-primary/40 bg-primary/5 animate-pulse" :
                    r.status === "error" ? "border-red-500/30 bg-red-500/5" :
                    "border-border/40 bg-secondary/20 opacity-50"
                  }`}>
                    <button
                      className="w-full flex items-center gap-3 px-4 py-3 text-left"
                      onClick={() => r.status === "done" && setExpandedStep(isExpanded ? null : i)}
                      disabled={r.status !== "done"}
                    >
                      <span className="shrink-0">
                        {r.status === "done" ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> :
                         r.status === "running" ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> :
                         r.status === "error" ? <span className="text-red-400 text-sm">✗</span> :
                         <Circle className="h-4 w-4 text-muted-foreground/40" />}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{step.skill_nome}</p>
                        <p className="text-[10px] text-muted-foreground">{step.descricao}</p>
                      </div>
                      {r.status === "done" && (
                        <>
                          <span className="text-[10px] text-muted-foreground">{r.result.split(" ").length} palavras</span>
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </>
                      )}
                    </button>
                    {isExpanded && r.status === "done" && (
                      <div className="px-4 pb-4 border-t border-border/30">
                        <div className="prose prose-invert prose-sm max-w-none mt-3">
                          <ReactMarkdown>{r.result}</ReactMarkdown>
                        </div>
                        <Button
                          size="sm" variant="ghost" className="mt-2 h-6 text-[10px] gap-1"
                          onClick={() => { navigator.clipboard.writeText(r.result); toast.success("Copiado!"); }}
                        >
                          <Copy className="h-3 w-3" /> Copiar este step
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          <DialogFooter className="px-6 py-4 border-t border-border/40 gap-2">
            {!running && stepResults.some(r => r.status === "done") && (
              <Button size="sm" variant="outline" onClick={copyAllResults} className="gap-1">
                <Copy className="h-3.5 w-3.5" /> Copiar tudo
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => { if (!running) { setShowResults(false); setStepResults([]); setSelectedPipeline(null); } }} disabled={running}>
              {running ? "Aguarde..." : "Fechar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

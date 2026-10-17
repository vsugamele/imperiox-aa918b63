import type { Tables } from "@/integrations/supabase/types";
import type { LucideIcon } from "lucide-react";
import { errorMessage } from "@/lib/error-message";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  FlaskConical,
  Sparkles,
  Loader2,
  Copy,
  FileDown,
  Target,
  ShieldAlert,
  Award,
  AlignLeft,
  PenTool,
  CheckCircle2,
  Zap,
  Layers,
  FileText,
  Wand2,
  Brain,
  AlertTriangle,
} from "lucide-react";
import { useGlobalProject } from "@/hooks/useGlobalProject";
import { loadProjectIntelligence, type ProjectIntelligenceBundle } from "@/lib/project-intelligence";
import {
  medirEscritaDerick,
  auditarLeadDerick,
  conferirCongruenciaVslDerick,
  vocabularioDoNichoDerick,
  gerarBlocoVslDerick10,
  autoCorrigirCopyDerickSugamele,
} from "@/lib/derick-engines";

type VslProject = Pick<Tables<"imphq_projects">, "id" | "name" | "icon" | "data" | "avatar">;

interface VslTool {
  id: string;
  title: string;
  skillSlug: string;
  icon: LucideIcon;
  desc: string;
  promptNum: number;
}

const VSL_TOOLS: VslTool[] = [
  {
    id: "raio_x",
    title: "1. Raio-X & VOC (Lei 55)",
    skillSlug: "pesquisar-e-consolidar-avatar + escavador-desejos",
    icon: Target,
    desc: "Mapeamento visceral do avatar, fala literal do público (VOC Lei 55) e hierarquia de desejos em 8 critérios.",
    promptNum: 1,
  },
  {
    id: "mechanism_lab",
    title: "2. Tríade MP/MF/MS + Nome Chiclete",
    skillSlug: "mecanismo + nome-chiclete",
    icon: FlaskConical,
    desc: "Mecanismo do Problema (MP), Mecanismo da Falha (MF), Mecanismo da Solução (MS) e batismo curioso.",
    promptNum: 2,
  },
  {
    id: "conceito_correlacao",
    title: "3. Conceito & Correlação",
    skillSlug: "conceito-correlacao",
    icon: Layers,
    desc: "Exploração de correlações físicas tangíveis e imagem mental central da campanha.",
    promptNum: 3,
  },
  {
    id: "briefing_vsl",
    title: "4. Briefing VSL v2.0.0",
    skillSlug: "briefing-vsl",
    icon: FileText,
    desc: "Arquitetura canônica dos 7 blocos com travas de congruência antes da redação.",
    promptNum: 4,
  },
  {
    id: "microlead_hw",
    title: "5. Microlead 7 Etapas (H&W 0–45s)",
    skillSlug: "metodo-hw + derick-lead-vsl",
    icon: Zap,
    desc: "Primeiros 45 segundos em 7 etapas rítmicas com retenção máxima e Lei 54.",
    promptNum: 5,
  },
  {
    id: "lead_creator",
    title: "6. Lead VSL 10C (U1–U7 + K23–K25)",
    skillSlug: "derick-lead-vsl",
    icon: Sparkles,
    desc: "Lead completa com Unidades U1–U7, prova ≥50 palavras (K23), 3 elementos (K24), 2 histórias (K25) e Lei 54.",
    promptNum: 6,
  },
  {
    id: "logic_points",
    title: "7. Marketing Thesis (Premissas 1 e 2)",
    skillSlug: "escrita-marketing-thesis",
    icon: AlignLeft,
    desc: "Gradualização lógica das Premissas 1 (MP/MF) e 2 (MS) até a Conclusão Inevitável.",
    promptNum: 7,
  },
  {
    id: "offer_builder",
    title: "8. Big Offer 10D (Até 1º CTA)",
    skillSlug: "derick-big-offer-vsl",
    icon: Award,
    desc: "Apresentação do veículo, funcionamento, qualificação, ancoragem de valor, preço real e 1º CTA.",
    promptNum: 8,
  },
  {
    id: "close_samurai",
    title: "9. Close Samurai 10E (R-CLOSE-01..06)",
    skillSlug: "derick-close-vsl",
    icon: PenTool,
    desc: "Garantia blindada, empilhamento de bônus, Dois Caminhos e Samurai Q&A sem preço divergente.",
    promptNum: 9,
  },
  {
    id: "auditoria_skill11",
    title: "10. Passe de Congruência Skill 11",
    skillSlug: "derick-revisao-vsl",
    icon: ShieldAlert,
    desc: "Auditoria cruzada v1.3.0: Loops, 'Lembra que', Preços/Stack, Bônus, Dores, Anáfora e Nome Chiclete/1000w.",
    promptNum: 10,
  },
];

export default function VslLab() {
  const { projectId: globalProjectId, setProjectId: setGlobalProjectId } = useGlobalProject();
  const [projects, setProjects] = useState<VslProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(globalProjectId || "");
  const [activeTool, setActiveTool] = useState<string>("raio_x");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string>("");
  const [customNotes, setCustomNotes] = useState<string>("");
  const [intel, setIntel] = useState<ProjectIntelligenceBundle | null>(null);
  const [loadingIntel, setLoadingIntel] = useState(false);

  useEffect(() => {
    supabase
      .from("imphq_projects")
      .select("id, name, icon, data, avatar")
      .order("name")
      .then(({ data }) => {
        if (data) {
          setProjects(data);
          if (!selectedProjectId && data.length > 0) {
            setSelectedProjectId(data[0].id);
          }
        }
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!selectedProjectId) {
      setIntel(null);
      return;
    }
    setLoadingIntel(true);
    loadProjectIntelligence(selectedProjectId)
      .then((bundle) => {
        if (!cancelled) {
          setIntel(bundle);
          // Preenche automaticamente o bloco inicial com o motor determinístico Derick.AI se estiver vazio
          setResult((prev) => prev || gerarBlocoVslDerick10(activeTool, bundle, ""));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingIntel(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  const handleProjectChange = (projId: string) => {
    setSelectedProjectId(projId);
    setGlobalProjectId(projId);
    setResult("");
  };

  const handleSelectTool = (toolId: string) => {
    setActiveTool(toolId);
    if (intel) {
      setResult(gerarBlocoVslDerick10(toolId, intel, customNotes));
    }
  };

  // Auditoria determinística em tempo real sobre o bloco atual
  const auditBundle = useMemo(() => {
    if (!result.trim()) return null;
    const medicao = medirEscritaDerick(result, activeTool === "raio_x" || activeTool === "briefing_vsl");
    const leadAudit = auditarLeadDerick(result, intel?.mechanismName);
    const congruencia = conferirCongruenciaVslDerick(result, {
      nomeChiclete: intel?.mechanismName,
    });
    const corpus = intel
      ? [...intel.deepPains, intel.externalDesire, intel.internalDesire, intel.enemy, intel.nuclearTrigger]
      : [];
    const voc = vocabularioDoNichoDerick(result, corpus, 10);
    return { medicao, leadAudit, congruencia, voc };
  }, [result, activeTool, intel]);

  const handleGenerateInstantDerick = () => {
    const out = gerarBlocoVslDerick10(activeTool, intel, customNotes);
    setResult(out);
    toast.success("Bloco gerado pelo Motor Determinístico Derick.AI v2.0.0 + H&W!");
  };

  const handleGenerateFullVsl10Blocks = () => {
    const allIds = [
      "raio_x",
      "mechanism_lab",
      "conceito_correlacao",
      "briefing_vsl",
      "microlead_hw",
      "lead_creator",
      "logic_points",
      "offer_builder",
      "close_samurai",
    ];
    const combined = allIds.map((id) => gerarBlocoVslDerick10(id, intel, customNotes)).join("\n\n---\n\n");
    setResult(combined);
    setActiveTool("auditoria_skill11");
    toast.success("VSL Completa (9 blocos + Passe de Congruência Skill 11) consolidada!");
  };

  const handleGenerateAI = async () => {
    setGenerating(true);
    try {
      const currentTool = VSL_TOOLS.find((t) => t.id === activeTool) || VSL_TOOLS[0];
      const baseDeterministic = gerarBlocoVslDerick10(activeTool, intel, customNotes);
      const prompt = [
        `Você é o Motor Canônico de VSL da Derick.AI (${currentTool.skillSlug}) combinado com o Método H&W, Gary Bencivenga e Escrita Vinicius Sugamele.`,
        `Expanda e refine o bloco "${currentTool.title}" para o projeto "${intel?.projectName || "Projeto"}".`,
        `Avatar: ${intel?.avatarName || ""} | Inimigo (MP): ${intel?.enemy || ""} | Mecanismo (MS): ${intel?.mechanismName || ""}`,
        `Dores Profundas (VOC Lei 55): ${(intel?.deepPains || []).join(" | ")}`,
        customNotes ? `Instruções adicionais: ${customNotes}` : "",
        `Estrutura Base Obrigatória:\n${baseDeterministic}`,
      ].join("\n\n");

      const { data, error } = await supabase.functions.invoke("copy-engine", {
        body: {
          intent: "vsl_imperador",
          input: prompt,
          context: selectedProjectId ? { project_id: selectedProjectId } : undefined,
        },
      });

      if (error || data?.error || !data?.content) {
        setResult(baseDeterministic);
        toast.success("Bloco consolidado com o Motor Determinístico Derick.AI + Inteligência do Projeto!");
      } else {
        setResult(data.content);
        toast.success("Roteiro de VSL expandido com IA + Derick.AI!");
      }
    } catch {
      const fallback = gerarBlocoVslDerick10(activeTool, intel, customNotes);
      setResult(fallback);
      toast.success("Bloco consolidado com o Motor Determinístico Derick.AI!");
    } finally {
      setGenerating(false);
    }
  };

  const handleAutoFix = () => {
    if (!result.trim()) return;
    const { textoCorrigido, ajustesAplicados } = autoCorrigirCopyDerickSugamele(result, intel?.mechanismName);
    setResult(textoCorrigido);
    toast.success(`Auto-Correção Derick.AI + Sugamele aplicada: ${ajustesAplicados[0]}`);
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(result);
    toast.success("Copiado!");
  };

  const handleSaveToDocs = async () => {
    if (!result.trim()) return toast.error("Gere um bloco primeiro.");
    const currentTool = VSL_TOOLS.find((t) => t.id === activeTool);
    await supabase.from("imphq_docs").insert({
      id: crypto.randomUUID(),
      project_id: selectedProjectId || null,
      title: `[VSL Derick.AI] ${currentTool?.title || activeTool} — ${intel?.projectName || "Projeto"}`,
      content: result,
      body: result,
      cat: "vsl-roteiro",
    });
    toast.success("Salvo em Documentos (`imphq_docs`)!");
  };

  const [savingSwipe, setSavingSwipe] = useState(false);
  const handleSaveToSwipeBank = async () => {
    if (!result.trim()) return toast.error("Gere algo primeiro");
    setSavingSwipe(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const tool = VSL_TOOLS.find((t) => t.id === activeTool);
      const proj = projects.find((p) => p.id === selectedProjectId);
      const title = `[VSL Lab Derick] ${tool?.title || activeTool} — ${proj?.name || "manual"} · ${new Date().toLocaleDateString()}`;
      const { error } = await supabase.from("imphq_swipes").insert({
        user_id: u.user?.id,
        project_id: selectedProjectId || null,
        title,
        formato: "vsl",
        plataforma: "VSL Lab Derick.AI",
        criador: proj?.name || null,
        mecanismo: intel?.mechanismName || null,
        rating: 5,
        raw_text: result,
        blocks: { narrativa: result },
        tags: ["vsl-lab", "derick-ai", tool?.id || ""].filter(Boolean),
        reverse_engineering: { origem: "vsl-lab-derick", ferramenta: tool?.id, skill: tool?.skillSlug },
      });
      if (error) throw error;
      toast.success("Salvo no Banco de VSLs! Veja em /swipe");
    } catch (e: unknown) {
      toast.error(errorMessage(e));
    } finally {
      setSavingSwipe(false);
    }
  };

  const activeToolMeta = VSL_TOOLS.find((t) => t.id === activeTool) || VSL_TOOLS[0];

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      {/* Cabeçalho Conectado */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="font-display italic text-3xl font-bold text-slate-100">
              VSL Copy <span className="text-amber-400">Lab · Derick.AI v2.0.0 + H&W</span>
            </h1>
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]">
              10 BLOCOS CANÔNICOS + SKILL 11
            </Badge>
          </div>
          <p className="text-xs text-slate-400">
            Pipeline completo: Raio-X VOC (Lei 55) → Tríade MP/MF/MS → Conceito → Briefing → Microlead H&W → Lead 10C → Thesis → Big Offer 10D → Close Samurai 10E → Congruência Skill 11.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedProjectId} onValueChange={handleProjectChange}>
            <SelectTrigger className="w-64 border-amber-500/40 bg-slate-900/80 text-xs">
              <SelectValue placeholder="Selecionar Projeto" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={handleGenerateFullVsl10Blocks}
            className="bg-amber-500 hover:bg-amber-600 text-black font-semibold gap-1.5"
          >
            <Layers className="h-3.5 w-3.5" /> Consolidar VSL Completa (10 Blocos)
          </Button>
        </div>
      </div>

      {/* Faixa de Inteligência do Projeto */}
      {loadingIntel ? (
        <Card className="border-slate-800 bg-slate-900/60 p-3 flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin text-amber-400" /> Carregando Avatar, Mecanismo, Documentos e Skills do projeto...
        </Card>
      ) : intel ? (
        <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-slate-900/80 to-slate-900/80 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]">
                <Brain className="h-3 w-3 mr-1" /> {intel.projectIcon} {intel.projectName}
              </Badge>
              <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-200">
                Avatar: {intel.avatarName}
              </Badge>
              <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-300">
                Vilão (MP): {intel.enemy}
              </Badge>
              <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-300">
                Mecanismo (MS): {intel.mechanismName}
              </Badge>
            </div>
            <div className="text-[11px] text-slate-400">
              📄 {intel.docs.length} Docs · ⚡ {intel.skills.length} Skills Conectadas
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna Esquerda: 10 Blocos Canônicos */}
        <div className="lg:col-span-4 space-y-2">
          <Card className="border-slate-800 bg-slate-900/60 p-3 space-y-1.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 px-1 pb-1">
              Pipeline 10 Blocos (Derick.AI + H&W)
            </div>
            {VSL_TOOLS.map((t) => {
              const Icon = t.icon;
              const isActive = activeTool === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => handleSelectTool(t.id)}
                  className={`w-full p-2.5 rounded-lg text-left transition-all flex items-start gap-2.5 ${
                    isActive
                      ? "bg-amber-500/15 text-amber-300 border border-amber-500/40"
                      : "text-slate-300 hover:bg-slate-800/60 border border-transparent"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{t.title}</p>
                    <p className="text-[10px] text-slate-400 truncate">⚡ {t.skillSlug}</p>
                  </div>
                </button>
              );
            })}
          </Card>
        </div>

        {/* Coluna Direita: Configuração + Auditor Determinístico + Resultado */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="border-slate-800 bg-slate-900/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-base text-slate-100 flex items-center gap-2">
                    <activeToolMeta.icon className="h-4 w-4 text-amber-400" />
                    {activeToolMeta.title}
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400 mt-0.5">
                    {activeToolMeta.desc}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-300">
                  Skill: {activeToolMeta.skillSlug}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-slate-300">
                  Direcionamento específico da rodada (opcional — o Avatar, Vilão e Mecanismo do projeto já estão injetados)
                </Label>
                <Textarea
                  rows={2}
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="Ex: Enfatizar prova clínica de Kyoto, usar garantia de 60 dias, preço 12x R$ 29,70..."
                  className="mt-1 bg-slate-950/60 border-slate-800 text-xs"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={handleGenerateInstantDerick}
                  className="bg-amber-500 hover:bg-amber-600 text-black font-semibold gap-1.5"
                >
                  <Zap className="h-3.5 w-3.5" /> Gerar Bloco Canônico (Derick.AI)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerateAI}
                  disabled={generating}
                  className="border-amber-500/40 text-amber-300 hover:bg-amber-500/15 gap-1.5"
                >
                  {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Expandir com IA (`copy-engine`)
                </Button>
                {result && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAutoFix}
                    className="border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/15 gap-1.5 ml-auto"
                  >
                    <Wand2 className="h-3.5 w-3.5" /> Auto-Corrigir (Leis 48–52 + Sugamele)
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Painel Determinístico de Auditoria (Leis 48-55 + Lead 10C + Congruência Skill 11) */}
          {auditBundle && (
            <Card className="border-slate-800 bg-slate-900/70 p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    auditBundle.medicao.aprovado
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                      : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                  }`}
                >
                  {auditBundle.medicao.aprovado ? (
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                  ) : (
                    <AlertTriangle className="h-3 w-3 mr-1" />
                  )}
                  Leis 48–52: Mediana {auditBundle.medicao.mediana_palavras}w · Micro {auditBundle.medicao.pct_micro}% ·
                  28+w: {auditBundle.medicao.longas_28mais.length}
                </Badge>

                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    auditBundle.congruencia.score_congruencia >= 85
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                      : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                  }`}
                >
                  Skill 11 Congruência: {auditBundle.congruencia.score_congruencia}/100 (Loops sem pagto:{" "}
                  {auditBundle.congruencia.loops_sem_pagamento.length})
                </Badge>

                {(activeTool === "lead_creator" || activeTool === "microlead_hw") && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      auditBundle.leadAudit.lei54_ok
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : "bg-red-500/15 text-red-300 border-red-500/30"
                    }`}
                  >
                    Lead 10C: U({auditBundle.leadAudit.unidades_encontradas.length}/7) · K23({auditBundle.leadAudit.k23_prova_palavras}w) · K24({auditBundle.leadAudit.k24_elementos_prova.length}/3) · K25({auditBundle.leadAudit.k25_historias_externas}/2) · Lei 54: {auditBundle.leadAudit.lei54_ok ? "OK" : "Vazou MS"}
                  </Badge>
                )}

                <Badge variant="outline" className="text-[10px] border-cyan-500/30 text-cyan-300">
                  VOC Lei 55: {auditBundle.voc.aderencia_pct}%
                </Badge>
              </div>

              {(auditBundle.medicao.motivos.length > 0 || auditBundle.congruencia.alertas.length > 0) && (
                <div className="text-[11px] text-amber-300/90 flex flex-wrap gap-x-3 gap-y-1">
                  {[...auditBundle.medicao.motivos, ...auditBundle.congruencia.alertas].slice(0, 4).map((al, i) => (
                    <span key={i}>• {al}</span>
                  ))}
                </div>
              )}
            </Card>
          )}

          {result && (
            <Card className="border-slate-800 bg-slate-900/60">
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap gap-2 justify-between items-center">
                  <span className="text-xs text-slate-400 font-medium">
                    Editor ao Vivo (qualquer edição atualiza os contadores determinísticos acima)
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={handleCopyToClipboard} className="gap-1 h-7 text-xs">
                      <Copy className="h-3 w-3" /> Copiar
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleSaveToDocs} className="gap-1 h-7 text-xs">
                      <FileDown className="h-3 w-3" /> Salvar em Docs
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveToSwipeBank}
                      disabled={savingSwipe}
                      className="gap-1 h-7 text-xs bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                    >
                      {savingSwipe ? <Loader2 className="h-3 w-3 animate-spin" /> : <FlaskConical className="h-3 w-3" />}
                      Salvar no Banco de VSLs
                    </Button>
                  </div>
                </div>
                <ScrollArea className="h-[54vh]">
                  <Textarea
                    value={result}
                    onChange={(e) => setResult(e.target.value)}
                    rows={22}
                    className="font-mono text-xs text-slate-200 bg-slate-950/70 border-slate-800 leading-relaxed"
                  />
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}


import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sparkles,
  Zap,
  Copy,
  Check,
  Send,
  Loader2,
  Layers,
  ArrowRight,
  BookOpen,
  Share2,
  FileText,
  ShieldAlert,
  Target,
  Flame,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/error-message";
import {
  PROJECT_ANGLE_PRESETS,
  parseMemoFlowAdBatch,
  formatBatchForMediaBuyer,
  generateAdWithHook,
  type MemoFlowParsedBatch,
  type ProjectAnglePreset,
} from "@/lib/memoflow-ads-generator";

interface MemoFlowAdGeneratorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialProjectId?: string;
  onNavigateToCopyLab?: (data: { projectId: string; prompt: string; output: string }) => void;
}

const PROJECT_LIST = [
  { id: "linfaflow", name: "🌿 LinfaFlow (Gotas Sublinguais)", tag: "DTC Nutra" },
  { id: "slimsoda", name: "🥤 SlimSoda (GLP-1 Natural)", tag: "DTC Nutra" },
  { id: "cardioflush", name: "🫀 CardioFlush (Artérias)", tag: "DTC Nutra" },
  { id: "memoflow", name: "🧠 MemoFlow (Nootrópico)", tag: "DTC Nutra" },
  { id: "jp_freitas", name: "💈 JP Freitas (Aulas & Cortes)", tag: "Lançamento" },
  { id: "global", name: "🌐 Metodologia Direta Global", tag: "Universal" },
];

export function MemoFlowAdGeneratorModal({
  open,
  onOpenChange,
  initialProjectId = "linfaflow",
  onNavigateToCopyLab,
}: MemoFlowAdGeneratorModalProps) {
  const [projectId, setProjectId] = useState<string>(
    initialProjectId === "all" ? "linfaflow" : initialProjectId
  );

  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [customAngle, setCustomAngle] = useState("");
  const [campaignType, setCampaignType] = useState<"C1" | "C2">("C1");
  const [targetCpa, setTargetCpa] = useState<string>("45");

  // RAG states
  const [ragChunks, setRagChunks] = useState<Array<{ pergunta: string; resposta: string }>>([]);
  const [isLoadingRag, setIsLoadingRag] = useState(false);

  // Generation states
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedBatch, setGeneratedBatch] = useState<MemoFlowParsedBatch | null>(null);
  const [previewHookAd, setPreviewHookAd] = useState<{ hookId: string; text: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Sync with initialProjectId
  useEffect(() => {
    if (initialProjectId && initialProjectId !== "all") {
      setProjectId(initialProjectId);
    }
  }, [initialProjectId]);

  // Carregar Chunks do RAG do Projeto
  const fetchProjectRag = useCallback(async (proj: string) => {
    setIsLoadingRag(true);
    try {
      const { data, error } = await supabase
        .from("imphq_wa_knowledge")
        .select("pergunta, resposta")
        .eq("project_id", proj)
        .order("score_uso", { ascending: false })
        .limit(5);

      if (error) throw error;
      setRagChunks(data || []);
    } catch (err) {
      console.error("[MemoFlowAdModal] Erro ao buscar chunks RAG:", err);
      setRagChunks([]);
    } finally {
      setIsLoadingRag(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchProjectRag(projectId);
      const presets = PROJECT_ANGLE_PRESETS[projectId] || PROJECT_ANGLE_PRESETS.global;
      if (presets && presets.length > 0) {
        setSelectedPresetId(presets[0].id);
      }
    }
  }, [open, projectId, fetchProjectRag]);

  const currentPresets = useMemo(() => {
    return PROJECT_ANGLE_PRESETS[projectId] || PROJECT_ANGLE_PRESETS.global || [];
  }, [projectId]);

  const activePreset = useMemo(() => {
    return currentPresets.find(p => p.id === selectedPresetId);
  }, [currentPresets, selectedPresetId]);

  // Executar Geração de Anúncios
  const handleGenerate = async () => {
    setIsGenerating(true);
    setPreviewHookAd(null);

    const chosenAngleTitle = activePreset?.title || customAngle || "Ângulo Principal de Causa Raiz";
    const chosenAvatar = activePreset?.avatar || "Público qualificado";
    const chosenMecanismo = activePreset?.mecanismo || "Mecanismo único do produto";
    const chosenVilao = activePreset?.vilao || "Vilão oculto não diagnosticado";

    // Formatar snippets RAG para contexto
    const ragText = ragChunks.length > 0
      ? ragChunks.map(c => `[Q]: ${c.pergunta}\n[A]: ${c.resposta}`).join("\n\n")
      : "Conhecimento padrão do projeto.";

    const inputPrompt = `## BRIEFING DE TRÁFEGO PARA GERADOR MEMOFLOW
- Projeto/Produto: ${projectId}
- Tipo de Campanha: ${campaignType} (${campaignType === "C1" ? "Principal / Escala" : "Risco / Teste Curiosidade"})
- CPA Alvo Estimado: R$ ${targetCpa} / $ ${targetCpa}
- Ângulo Persuasivo: ${chosenAngleTitle}
- Avatar Prioritário: ${chosenAvatar}
- Vilão Invisível: ${chosenVilao}
- Mecanismo da Solução: ${chosenMecanismo}
${activePreset?.promptHint ? `- Diretriz Específica do Ângulo: ${activePreset.promptHint}` : ""}
${customAngle ? `- Instruções Adicionais do Usuário: ${customAngle}` : ""}

Por favor, gere a Esteira Executiva Completa de Anúncios no padrão MemoFlow com:
1. Instruções Operacionais da Campanha
2. Ângulo Persuasivo & Mecanismo Único
3. Copy Mestre (Primary Text completo)
4. 3 Variações de Gancho (1ª Linha / Scroll-Stoppers)
5. 3 Headlines de Alta Conversão`;

    try {
      const { data, error } = await supabase.functions.invoke("copy-engine", {
        body: {
          intent: "lote_anuncios_memoflow",
          input: inputPrompt,
          context: {
            product_slug: projectId,
            extra: {
              project_slug: projectId,
              rag_snippets: ragText,
            },
          },
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "Erro no motor de copy");

      const rawMarkdown = data?.content || "";
      const parsed = parseMemoFlowAdBatch(rawMarkdown);
      setGeneratedBatch(parsed);
      toast.success("Lote Executivo de Anúncios gerado com sucesso no Padrão MemoFlow!");
    } catch (err: unknown) {
      console.error("[MemoFlowAdModal] Erro ao gerar anúncios:", err);
      toast.error(`Falha ao gerar lote de anúncios: ${errorMessage(err)}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = (text: string, key: string, label = "Copiado!") => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(label);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleCopyFullBrief = () => {
    if (!generatedBatch) return;
    const formatted = formatBatchForMediaBuyer(generatedBatch);
    handleCopy(formatted, "full_brief", "Briefing executivo copiado! Pronto para WhatsApp/Slack do gestor.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-background border-border">
        {/* HEADER */}
        <DialogHeader className="p-6 border-b border-border bg-card/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  Gerador de Lotes de Anúncios
                  <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs">
                    Padrão MemoFlow
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Conecte o Acervo RAG do produto à esteira de tráfego: Copy Mestre + 3 Ganchos + Headlines prontas para a Meta.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* SELETOR DE CONFIGURAÇÃO (PROJETO, ÂNGULO E RAG) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Coluna 1: Projeto e Campanha */}
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Produto / Projeto
                </Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="mt-1.5 h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_LIST.map(p => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Campanha
                  </Label>
                  <Select value={campaignType} onValueChange={v => setCampaignType(v as "C1" | "C2")}>
                    <SelectTrigger className="mt-1.5 h-9 text-xs font-mono font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="C1">C1 (Escala / Seguro)</SelectItem>
                      <SelectItem value="C2">C2 (Teste / Risco)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    CPA Alvo ($)
                  </Label>
                  <Input
                    type="number"
                    value={targetCpa}
                    onChange={e => setTargetCpa(e.target.value)}
                    className="mt-1.5 h-9 text-xs font-mono"
                    placeholder="45"
                  />
                </div>
              </div>

              {/* RAG Snippets Summary Badge */}
              <div className="p-2.5 rounded-lg bg-secondary/50 border border-border/60 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
                    <BookOpen className="h-3 w-3 text-primary" />
                    RAG do Acervo
                  </span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
                    {isLoadingRag ? "Buscando..." : `${ragChunks.length} chunks`}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Mecanismos, posologia e dores catalogadas em <code>imphq_wa_knowledge</code> inseridos no prompt.
                </p>
              </div>
            </div>

            {/* Coluna 2 e 3: Ângulo Persuasivo e Presets */}
            <div className="md:col-span-2 space-y-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>Ângulos Persuasivos do Produto</span>
                <span className="text-[10px] font-normal text-muted-foreground">Baseado em Dossiês Validados</span>
              </Label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {currentPresets.map(preset => {
                  const isSelected = selectedPresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => setSelectedPresetId(preset.id)}
                      className={`text-left p-3 rounded-lg border transition-all text-xs flex flex-col justify-between ${
                        isSelected
                          ? "bg-primary/10 border-primary shadow-sm text-foreground"
                          : "bg-card hover:bg-secondary/60 border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <div className="font-semibold line-clamp-1">{preset.title}</div>
                      <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                        {preset.promptHint}
                      </div>
                      {isSelected && (
                        <div className="mt-2 flex items-center gap-1 text-[10px] text-primary font-medium">
                          <CheckCircle2 className="h-3 w-3" /> Ângulo Ativo
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Instruções extras ou ângulo livre (opcional):</Label>
                <Input
                  placeholder="Ex: Focar na frustração com sapatos que não fecham às 16h / Tom cético e direto..."
                  value={customAngle}
                  onChange={e => setCustomAngle(e.target.value)}
                  className="mt-1 h-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* BOTÃO GERAR */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>Gera 1 Copy Mestre + 3 Ganchos + 3 Headlines + Instruções no padrão MemoFlow</span>
            </div>
            <Button onClick={handleGenerate} disabled={isGenerating} className="px-5 font-semibold text-xs">
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando Esteira MemoFlow...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Gerar Lote de Anúncios Agora
                </>
              )}
            </Button>
          </div>

          {/* ÁREA DE RESULTADOS ESTRUTURADOS */}
          {generatedBatch && (
            <div className="space-y-4 pt-4 border-t border-border">
              {/* TOP BAR DO RESULTADO */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-secondary/40 rounded-lg border border-border">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs bg-background font-bold text-foreground">
                    Campanha: {generatedBatch.campanha.tipo}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    Destino: {generatedBatch.campanha.destino}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Regra: {generatedBatch.campanha.regraCpa}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs font-semibold gap-1.5 text-primary border-primary/30 hover:bg-primary/10"
                    onClick={handleCopyFullBrief}
                  >
                    {copiedKey === "full_brief" ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
                    Copiar Pacote Completo (WhatsApp/Slack)
                  </Button>
                  {onNavigateToCopyLab && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs gap-1.5"
                      onClick={() =>
                        onNavigateToCopyLab({
                          projectId,
                          prompt: activePreset?.title || customAngle,
                          output: generatedBatch.rawOutput,
                        })
                      }
                    >
                      <ArrowRight className="h-3.5 w-3.5" /> Abrir no Copy Lab
                    </Button>
                  )}
                </div>
              </div>

              {/* TABS DE VISUALIZAÇÃO */}
              <Tabs defaultValue="copy_mestre" className="space-y-3">
                <TabsList className="bg-secondary/60 border border-border p-1 w-full grid grid-cols-4">
                  <TabsTrigger value="copy_mestre" className="text-xs flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    <span>Copy Mestre (Texto Principal)</span>
                  </TabsTrigger>
                  <TabsTrigger value="ganchos" className="text-xs flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5" />
                    <span>3 Ganchos (1ª Linha)</span>
                  </TabsTrigger>
                  <TabsTrigger value="headlines" className="text-xs flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5" />
                    <span>3 Headlines (Títulos)</span>
                  </TabsTrigger>
                  <TabsTrigger value="mecanismo" className="text-xs flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" />
                    <span>Mecanismo & Ângulo</span>
                  </TabsTrigger>
                </TabsList>

                {/* ABA 1: COPY MESTRE */}
                <TabsContent value="copy_mestre" className="space-y-3">
                  <Card className="border-border">
                    <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b border-border/50">
                      <div>
                        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                          📝 Copy Mestre (Texto Principal do Anúncio)
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Cole este texto na íntegra no campo "Texto Principal" da Meta.
                        </CardDescription>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 text-xs font-semibold gap-1.5"
                        onClick={() => handleCopy(generatedBatch.copyMestre, "copy_mestre", "Copy Mestre copiada!")}
                      >
                        {copiedKey === "copy_mestre" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        Copiar Texto Principal
                      </Button>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="p-4 rounded-lg bg-secondary/30 border border-border/60 text-xs md:text-sm leading-relaxed whitespace-pre-wrap font-sans text-foreground">
                        {previewHookAd ? (
                          <div className="space-y-3">
                            <div className="p-2 rounded bg-primary/10 border border-primary/20 text-xs font-semibold text-primary flex items-center justify-between">
                              <span>👁️ Visualizando anúncio com {previewHookAd.hookId} aplicado:</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[11px] px-2"
                                onClick={() => setPreviewHookAd(null)}
                              >
                                Voltar à Copy Original
                              </Button>
                            </div>
                            <p>{previewHookAd.text}</p>
                          </div>
                        ) : (
                          generatedBatch.copyMestre
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ABA 2: 3 GANCHOS */}
                <TabsContent value="ganchos" className="space-y-3">
                  <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 text-xs text-muted-foreground flex items-center justify-between">
                    <span>
                      💡 <strong>Regra MemoFlow:</strong> Mantenha a Copy Mestre idêntica no anúncio e substitua apenas a <strong>1ª linha</strong> por um destes ganchos para testar com cada imagem ou vídeo.
                    </span>
                  </div>

                  <div className="grid gap-3">
                    {generatedBatch.ganchos.map((g, idx) => (
                      <Card key={g.id || idx} className="border-border hover:border-primary/40 transition-all">
                        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge className="font-mono text-xs bg-primary text-primary-foreground font-bold">
                                {g.id}
                              </Badge>
                              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                {g.tipo}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-foreground italic pt-1">
                              "{g.texto}"
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs gap-1"
                              onClick={() => {
                                const newAd = generateAdWithHook(generatedBatch.copyMestre, g.texto);
                                setPreviewHookAd({ hookId: g.id, text: newAd });
                              }}
                            >
                              👁️ Testar no Texto
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-8 text-xs font-semibold gap-1"
                              onClick={() => handleCopy(g.texto, `hook_${g.id}`, `Gancho ${g.id} copiado!`)}
                            >
                              {copiedKey === `hook_${g.id}` ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                              Copiar 1ª Linha
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                {/* ABA 3: 3 HEADLINES */}
                <TabsContent value="headlines" className="space-y-3">
                  <div className="grid gap-3">
                    {generatedBatch.headlines.map((h, idx) => (
                      <Card key={h.id || idx} className="border-border">
                        <CardContent className="p-4 flex items-center justify-between gap-3">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30 font-bold">
                                {h.id}
                              </Badge>
                              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                {h.tipo}
                              </span>
                            </div>
                            <p className="text-sm font-bold text-foreground pt-1">
                              {h.texto}
                            </p>
                          </div>

                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-8 text-xs font-semibold gap-1 shrink-0"
                            onClick={() => handleCopy(h.texto, `head_${h.id}`, `Headline ${h.id} copiada!`)}
                          >
                            {copiedKey === `head_${h.id}` ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            Copiar Título
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                {/* ABA 4: MECANISMO E ÂNGULO */}
                <TabsContent value="mecanismo" className="space-y-3">
                  <Card className="border-border">
                    <CardContent className="p-4 space-y-3 text-xs leading-relaxed">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3 rounded bg-secondary/40 border border-border/50">
                          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                            🎯 Ângulo & Avatar
                          </span>
                          <p className="font-bold text-foreground">{generatedBatch.angulo.nome}</p>
                          <p className="text-muted-foreground mt-1">{generatedBatch.angulo.avatar}</p>
                        </div>

                        <div className="p-3 rounded bg-secondary/40 border border-border/50">
                          <span className="text-[11px] font-semibold text-red-400 uppercase tracking-wider block mb-1">
                            💀 Vilão Batizado
                          </span>
                          <p className="font-bold text-foreground">{generatedBatch.angulo.vilao}</p>
                        </div>
                      </div>

                      <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                        <span className="text-[11px] font-semibold uppercase tracking-wider block mb-1">
                          🌿 Mecanismo da Solução (De Dentro para Fora)
                        </span>
                        <p className="font-medium text-foreground">{generatedBatch.angulo.mecanismo}</p>
                      </div>

                      <div className="p-3 rounded bg-secondary/40 border border-border/50">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                          💡 Analogia-Mestre Explicativa
                        </span>
                        <p className="text-foreground">{generatedBatch.angulo.analogia}</p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

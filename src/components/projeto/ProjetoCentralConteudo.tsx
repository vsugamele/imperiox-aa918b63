import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MENTES_DATA } from "@/data/mentesData";
import {
  Calendar, Video, Image, FileText, Megaphone, Copy, Download, Loader2, Trash2, Save, Sparkles, Code2, Brain, UserCircle, Zap, ShoppingCart,
  Palette, LayoutGrid, Mail, Lightbulb, RefreshCw, Wand2, Expand, Search, Filter, Film
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { RoteirosViraisLibrary } from "./RoteirosViraisLibrary";

interface Props {
  projectId: string;
  project: any;
  onUpdateData: (data: any) => void;
}

type ContentType = "semanal" | "ads_imagem" | "ads_video" | "vsl" | "webinar" | "lp" | "ai_image" | "carrossel" | "stories_sequence" | "email_copy" | "headline_variations" | "ideias";

const SKILL_MAP: Record<string, { slug: string; label: string }> = {
  ads_imagem: { slug: "devastador-copy", label: "Devastador V4" },
  ads_video: { slug: "devastador-copy", label: "Devastador V4" },
  vsl: { slug: "lp-persuasiva", label: "LP Persuasiva V2" },
  webinar: { slug: "lp-persuasiva", label: "LP Persuasiva V2" },
  lp: { slug: "lp-persuasiva", label: "LP Persuasiva V2" },
  headline_variations: { slug: "devastador-copy", label: "Devastador V4" },
};

const CONTENT_TYPES: { value: ContentType; label: string; icon: any; desc: string; isNew?: boolean }[] = [
  { value: "ai_image", label: "Criativo IA", icon: Palette, desc: "Imagem gerada por IA", isNew: true },
  { value: "ideias", label: "Brainstorm", icon: Lightbulb, desc: "10 ideias de conteúdo", isNew: true },
  { value: "semanal", label: "Conteúdo Semanal", icon: Calendar, desc: "Posts e stories para a semana" },
  { value: "carrossel", label: "Carrossel", icon: LayoutGrid, desc: "5-10 slides com copy", isNew: true },
  { value: "stories_sequence", label: "Sequência Stories", icon: Image, desc: "5-7 stories com roteiro", isNew: true },
  { value: "ads_imagem", label: "Ads — Imagem", icon: Image, desc: "Copy para criativos estáticos" },
  { value: "ads_video", label: "Ads — Vídeo", icon: Video, desc: "Roteiros para vídeo ads" },
  { value: "email_copy", label: "Email Copy", icon: Mail, desc: "Email persuasivo", isNew: true },
  { value: "headline_variations", label: "Headlines A/B", icon: Megaphone, desc: "10+ variações de headline", isNew: true },
  { value: "vsl", label: "Roteiro VSL", icon: Video, desc: "Video Sales Letter completo" },
  { value: "webinar", label: "Roteiro Webinário", icon: Megaphone, desc: "Webinar persuasivo" },
  { value: "lp", label: "LP de Vendas (HTML)", icon: Code2, desc: "Landing page HTML exportável" },
];

const MODELS = [
  { id: "google/gemini-3-flash-preview", label: "⚡ Gemini 3 Flash", via: "gateway" },
  { id: "google/gemini-3.1-pro-preview", label: "🧠 Gemini 3.1 Pro", via: "gateway" },
  { id: "google/gemini-2.5-pro", label: "🔬 Gemini 2.5 Pro", via: "gateway" },
  { id: "openai/gpt-5.2", label: "🚀 GPT-5.2", via: "gateway" },
  { id: "openai/gpt-5", label: "💪 GPT-5", via: "gateway" },
  { id: "anthropic/claude-opus-4", label: "🟣 Claude Opus 4", via: "openrouter" },
  { id: "anthropic/claude-sonnet-4", label: "🟣 Claude Sonnet 4", via: "openrouter" },
  { id: "deepseek/deepseek-r1", label: "🔵 DeepSeek R1", via: "openrouter" },
];

const IMAGE_TYPES: ContentType[] = ["ai_image"];

interface SavedContent {
  id: string;
  content_type: string;
  content: string;
  product_name: string | null;
  model_used: string | null;
  custom_prompt: string | null;
  created_at: string;
}

export function ProjetoCentralConteudo({ projectId, project, onUpdateData }: Props) {
  const data = project.data || {};
  const [activeType, setActiveType] = useState<ContentType>("semanal");
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const [generatedImageUrl, setGeneratedImageUrl] = useState("");
  const [savedItems, setSavedItems] = useState<SavedContent[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [lpTopic, setLpTopic] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
  const [selectedMente, setSelectedMente] = useState("none");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [imageQuality, setImageQuality] = useState<"fast" | "high">("fast");
  const [refineDialogOpen, setRefineDialogOpen] = useState(false);
  const [refineFeedback, setRefineFeedback] = useState("");
  const [historyFilter, setHistoryFilter] = useState("all");
  const [historySearch, setHistorySearch] = useState("");

  const produtos: any[] = data.produtos || [];

  const loadSavedContents = useCallback(async () => {
    setLoadingSaved(true);
    const { data: rows } = await supabase
      .from("imphq_generated_contents")
      .select("id, content_type, content, product_name, model_used, custom_prompt, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(50);
    setSavedItems((rows as SavedContent[]) || []);
    setLoadingSaved(false);
  }, [projectId]);

  useEffect(() => { loadSavedContents(); }, [loadSavedContents]);

  const getOpenRouterKey = (): string | null => {
    try {
      const raw = localStorage.getItem("imphq_api_keys");
      if (!raw) return null;
      return JSON.parse(raw).openrouter || null;
    } catch { return null; }
  };

  const getContextSummary = () => {
    const avatar = project.avatar || {};
    const expert = data.expert || {};
    const arsenal = data.copy_arsenal || {};
    const branding = project.brand_kit || {};
    return { projeto: project.name, expert, avatar, produtos, arsenal, branding };
  };

  const handleOpenDialog = () => {
    if (produtos.length > 0 && !selectedProduct) {
      setSelectedProduct(produtos[0]?.nome || produtos[0]?.name || "");
    }
    setDialogOpen(true);
  };

  const getProductForPrompt = () => {
    if (selectedProduct) return selectedProduct;
    if (produtos.length > 0) return produtos[0]?.nome || produtos[0]?.name || "";
    return project.name;
  };

  const saveToDb = async (contentType: string, content: string, productName?: string | null) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("imphq_generated_contents").insert({
      project_id: projectId,
      user_id: user.id,
      content_type: contentType,
      content,
      product_name: productName || null,
      model_used: activeType === "ai_image" ? (imageQuality === "high" ? "gemini-3-pro-image" : "gemini-2.5-flash-image") : selectedModel,
      custom_prompt: customPrompt || null,
      metadata: { mente: selectedMente !== "none" ? selectedMente : null },
    });
    loadSavedContents();
  };

  const handleGenerate = async () => {
    const modelObj = MODELS.find(m => m.id === selectedModel);
    const isOpenRouter = modelObj?.via === "openrouter";
    if (isOpenRouter) {
      const orKey = getOpenRouterKey();
      if (!orKey) { toast.error("Chave OpenRouter não configurada. Vá em Configurações → APIs & Keys."); return; }
    }

    setDialogOpen(false);
    setGenerating(true);
    setGeneratedContent("");
    setGeneratedImageUrl("");

    try {
      const ctx = getContextSummary();
      const skill = SKILL_MAP[activeType];
      const productName = getProductForPrompt();

      // ── Image generation ──
      if (activeType === "ai_image") {
        const { data: aiData, error } = await supabase.functions.invoke("openflow-ai", {
          body: {
            project_id: projectId,
            action: "generate_image",
            prompt: customPrompt || `Criativo profissional para o produto "${productName}"`,
            quality: imageQuality,
          },
        });
        if (error) throw error;
        if (aiData?.image_url) {
          setGeneratedImageUrl(aiData.image_url);
          setGeneratedContent(aiData.text || "Imagem gerada com sucesso.");
          await saveToDb("ai_image", aiData.image_url, productName);
          toast.success("Imagem gerada!");
        } else throw new Error(aiData?.error || "Erro ao gerar imagem");
        return;
      }

      // ── Brainstorm ──
      if (activeType === "ideias") {
        const { data: aiData, error } = await supabase.functions.invoke("openflow-ai", {
          body: {
            project_id: projectId,
            action: "generate_brainstorm",
            model: selectedModel,
            content_focus: customPrompt,
            ...(isOpenRouter ? { openrouter_key: getOpenRouterKey() } : {}),
            ...(selectedMente !== "none" ? { mente_id: selectedMente } : {}),
          },
        });
        if (error) throw error;
        const ideas = aiData?.brainstorm?.ideas || [];
        const content = ideas.map((idea: any, i: number) =>
          `### ${i + 1}. ${idea.titulo}\n**Formato:** ${idea.formato} | **Dificuldade:** ${idea.nivel_dificuldade || "—"} | **Viral:** ${idea.potencial_viral || "—"}/10\n\n> ${idea.gancho}\n`
        ).join("\n---\n\n");
        setGeneratedContent(content || JSON.stringify(aiData));
        await saveToDb("ideias", content, productName);
        toast.success("Brainstorm gerado!");
        return;
      }

      // ── Text content ──
      const bodyPayload: Record<string, any> = { project_id: projectId, model: selectedModel };
      if (isOpenRouter) bodyPayload.openrouter_key = getOpenRouterKey();
      if (selectedMente !== "none") bodyPayload.mente_id = selectedMente;

      if (skill) {
        bodyPayload.action = "execute_skill";
        bodyPayload.skill_slug = skill.slug;
        const extraParts: string[] = [];
        if (activeType === "lp" && lpTopic) extraParts.push(`Foco/tema: ${lpTopic}`);
        if (activeType === "lp") extraParts.push("Retorne APENAS HTML completo com CSS inline, responsivo e persuasivo.");
        if (activeType === "ads_imagem") extraParts.push(`Gere 5 variações de copy para anúncios estáticos. Produto: "${productName}". Cada com headline (max 40 chars), body (max 125 chars), CTA.`);
        if (activeType === "ads_video") extraParts.push(`Gere 3 roteiros de vídeo ads (30-60s) para "${productName}". Formatos: Hook+Problema+Solução+CTA, UGC storytelling, Antes/depois.`);
        if (activeType === "vsl") extraParts.push(`Roteiro completo de VSL para "${productName}". Blocos: Hook, Problema, Agitação, Mecanismo, Prova social, Oferta, Garantia, CTA.`);
        if (activeType === "webinar") extraParts.push(`Estrutura completa de webinário para "${productName}".`);
        if (activeType === "headline_variations") extraParts.push(`Gere 15 variações de headlines para "${productName}". Organize em 3 categorias: Curiosidade, Dor, Resultado. Cada headline deve ter max 60 chars.`);
        if (customPrompt) extraParts.push(customPrompt);
        bodyPayload.extra_instructions = extraParts.join("\n");
      } else {
        bodyPayload.action = "generate_content";
        bodyPayload.content_type = activeType;
        const prompts: Record<string, string> = {
          semanal: `Crie um planejamento de conteúdo para 7 dias para "${ctx.projeto}". Inclua: tema, copy, CTA e formato. Dores: ${JSON.stringify((ctx.avatar.dores || []).slice(0, 5))}.`,
          carrossel: `Crie um carrossel de 8 slides para "${productName}". Cada slide: título bold (max 8 palavras), body (max 30 palavras), e CTA no último. Dores: ${JSON.stringify((ctx.avatar.dores || []).slice(0, 3))}.`,
          stories_sequence: `Crie uma sequência de 7 stories para "${productName}". Cada story: tipo (texto/enquete/quiz/CTA), copy, instrução visual. Use storytelling progressivo.`,
          email_copy: `Escreva um email persuasivo para "${productName}". Assunto magnético, preview text, body com storytelling, CTA claro. Tom: ${ctx.expert.tom_voz || "profissional"}. Dores: ${JSON.stringify((ctx.avatar.dores || []).slice(0, 3))}.`,
        };
        bodyPayload.prompt = customPrompt ? `${prompts[activeType] || ""}\n\nInstruções extras: ${customPrompt}` : prompts[activeType];
      }

      const { data: aiData, error } = await supabase.functions.invoke("openflow-ai", { body: bodyPayload });
      if (error) throw error;
      const content = aiData?.result || aiData?.text || aiData?.content || JSON.stringify(aiData);
      setGeneratedContent(content);
      await saveToDb(activeType, content, productName);
      toast.success("Conteúdo gerado e salvo!");
    } catch (err: any) {
      if (err?.message?.includes("429")) toast.error("Rate limit. Tente em alguns segundos.");
      else if (err?.message?.includes("402")) toast.error("Créditos insuficientes.");
      else toast.error(err.message || "Erro ao gerar");
    } finally {
      setGenerating(false);
    }
  };

  // ── Iteration: Variation ──
  const handleVariation = async () => {
    setGenerating(true);
    try {
      const { data: aiData, error } = await supabase.functions.invoke("openflow-ai", {
        body: {
          project_id: projectId,
          action: "generate_content",
          model: selectedModel,
          content_type: activeType,
          prompt: `Crie uma VARIAÇÃO DIFERENTE do conteúdo abaixo. Mantenha o mesmo formato e objetivo, mas mude abordagem, ângulo e tom.\n\nConteúdo original:\n${generatedContent.slice(0, 2000)}\n\n${customPrompt ? `Instruções: ${customPrompt}` : ""}`,
          ...(selectedMente !== "none" ? { mente_id: selectedMente } : {}),
        },
      });
      if (error) throw error;
      const content = aiData?.result || aiData?.text || aiData?.content || JSON.stringify(aiData);
      setGeneratedContent(content);
      await saveToDb(activeType, content, getProductForPrompt());
      toast.success("Variação gerada!");
    } catch (err: any) { toast.error(err.message || "Erro"); }
    finally { setGenerating(false); }
  };

  // ── Iteration: Refine ──
  const handleRefine = async () => {
    if (!refineFeedback.trim()) return;
    setRefineDialogOpen(false);
    setGenerating(true);
    try {
      const { data: aiData, error } = await supabase.functions.invoke("openflow-ai", {
        body: {
          project_id: projectId,
          action: "generate_content",
          model: selectedModel,
          content_type: activeType,
          prompt: `REFINE o conteúdo abaixo com base no feedback do usuário.\n\nConteúdo atual:\n${generatedContent.slice(0, 2000)}\n\nFeedback:\n${refineFeedback}`,
          ...(selectedMente !== "none" ? { mente_id: selectedMente } : {}),
        },
      });
      if (error) throw error;
      const content = aiData?.result || aiData?.text || aiData?.content || JSON.stringify(aiData);
      setGeneratedContent(content);
      setRefineFeedback("");
      await saveToDb(activeType, content, getProductForPrompt());
      toast.success("Conteúdo refinado!");
    } catch (err: any) { toast.error(err.message || "Erro"); }
    finally { setGenerating(false); }
  };

  // ── Iteration: Expand ──
  const handleExpand = async () => {
    setGenerating(true);
    try {
      const { data: aiData, error } = await supabase.functions.invoke("openflow-ai", {
        body: {
          project_id: projectId,
          action: "generate_content",
          model: selectedModel,
          content_type: activeType,
          prompt: `EXPANDA o conteúdo abaixo em uma versão mais completa e detalhada. Adicione mais profundidade, exemplos e detalhes.\n\nConteúdo resumido:\n${generatedContent.slice(0, 2000)}`,
          ...(selectedMente !== "none" ? { mente_id: selectedMente } : {}),
        },
      });
      if (error) throw error;
      const content = aiData?.result || aiData?.text || aiData?.content || JSON.stringify(aiData);
      setGeneratedContent(content);
      await saveToDb(activeType, content, getProductForPrompt());
      toast.success("Conteúdo expandido!");
    } catch (err: any) { toast.error(err.message || "Erro"); }
    finally { setGenerating(false); }
  };

  const handleDelete = async (itemId: string) => {
    await supabase.from("imphq_generated_contents").delete().eq("id", itemId);
    setSavedItems(prev => prev.filter(i => i.id !== itemId));
    toast.success("Removido!");
  };

  const handleCopy = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copiado!"); };

  const handleDownloadHTML = (content: string) => {
    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `lp_${project.name?.replace(/\s/g, "_") || "vendas"}.html`; a.click();
    URL.revokeObjectURL(url);
    toast.success("HTML baixado!");
  };

  const handleSaveToLibrary = async (imageUrl: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("imphq_content_library").insert({
      project_id: projectId,
      user_id: user.id,
      title: `Criativo IA — ${new Date().toLocaleDateString("pt-BR")}`,
      file_url: imageUrl,
      file_type: "image",
      tags: ["ia", "gerado"],
      content_category: "anuncios",
    });
    toast.success("Salvo na Biblioteca de Mídia!");
  };

  const activeSkill = SKILL_MAP[activeType];
  const isImageType = IMAGE_TYPES.includes(activeType);

  // Filter history
  const filteredHistory = savedItems.filter(item => {
    if (historyFilter !== "all" && item.content_type !== historyFilter) return false;
    if (historySearch && !item.content.toLowerCase().includes(historySearch.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Central de Conteúdo IA
          </CardTitle>
          <p className="text-xs text-muted-foreground">Geração contextual usando Avatar, Expert, Arsenal de Copy e Produto — salva automaticamente</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {CONTENT_TYPES.map((ct) => {
              const skill = SKILL_MAP[ct.value];
              return (
                <button key={ct.value} onClick={() => setActiveType(ct.value)}
                  className={`p-3 rounded-lg border text-left transition-all relative ${activeType === ct.value ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/50 hover:border-primary/40"}`}>
                  <ct.icon className="h-4 w-4 mb-1" />
                  <p className="text-xs font-medium">{ct.label}</p>
                  <p className="text-[10px] text-muted-foreground">{ct.desc}</p>
                  {ct.isNew && (
                    <Badge className="absolute top-1 right-1 text-[7px] px-1 py-0 bg-primary/80">NOVO</Badge>
                  )}
                  {skill && !ct.isNew && (
                    <Badge variant="secondary" className="absolute top-1.5 right-1.5 text-[8px] px-1 py-0 gap-0.5">
                      <Zap className="h-2 w-2" /> {skill.label}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>

          {/* Product selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                <ShoppingCart className="h-3 w-3" /> Produto
              </Label>
              {produtos.length > 0 ? (
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger className="bg-secondary text-xs"><SelectValue placeholder="Selecione o produto..." /></SelectTrigger>
                  <SelectContent>
                    {produtos.map((p: any, idx: number) => (
                      <SelectItem key={idx} value={p.nome || p.name || `produto-${idx}`}>
                        {p.nome || p.name} {p.tipo ? `(${p.tipo})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-[10px] text-muted-foreground p-2 rounded-md bg-secondary/50 border border-border">
                  Nenhum produto cadastrado. Adicione em Briefing → Produtos.
                </p>
              )}
            </div>

            {isImageType && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5">Qualidade da Imagem</Label>
                <Select value={imageQuality} onValueChange={(v: "fast" | "high") => setImageQuality(v)}>
                  <SelectTrigger className="bg-secondary text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fast">⚡ Rápido (Flash Image)</SelectItem>
                    <SelectItem value="high">🎨 Alta Qualidade (Pro Image)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {activeType === "lp" && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5">Foco / Tema da LP (opcional)</Label>
                <Input value={lpTopic} onChange={(e) => setLpTopic(e.target.value)} placeholder="Ex: Black Friday, Lançamento..." className="bg-secondary text-xs" />
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs">
              {isImageType ? "Descreva o criativo que deseja gerar" : "Instruções adicionais (opcional)"}
            </Label>
            <Textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder={isImageType ? "Ex: Banner profissional para Instagram Ads com cores vibrantes, produto em destaque..." : "Ex: Tom informal, incluir emojis..."}
              className="bg-secondary text-xs min-h-[60px]" />
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            <Button onClick={handleOpenDialog} disabled={generating} className="gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : isImageType ? <Palette className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              {generating ? "Gerando..." : isImageType ? "Gerar Imagem" : "Gerar com IA"}
            </Button>
            <Badge variant="outline" className="text-[10px]">Contexto: Avatar + Expert + Arsenal + Produtos</Badge>
            {activeSkill && (
              <Badge variant="secondary" className="text-[10px] gap-1">
                <Zap className="h-2.5 w-2.5" /> Skill: {activeSkill.label}
              </Badge>
            )}
          </div>

          {/* Generated result */}
          {(generatedContent || generatedImageUrl) && (
            <Card className="bg-secondary/50 border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Badge className="text-[10px]">{CONTENT_TYPES.find((c) => c.value === activeType)?.label}</Badge>
                    <Badge variant="outline" className="text-[9px]">✅ Salvo</Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => handleCopy(generatedContent)} className="h-7 gap-1 text-xs"><Copy className="h-3 w-3" /> Copiar</Button>
                    {activeType === "lp" && <Button size="sm" variant="ghost" onClick={() => handleDownloadHTML(generatedContent)} className="h-7 gap-1 text-xs"><Download className="h-3 w-3" /> HTML</Button>}
                    {generatedImageUrl && generatedImageUrl.startsWith("http") && (
                      <Button size="sm" variant="ghost" onClick={() => handleSaveToLibrary(generatedImageUrl)} className="h-7 gap-1 text-xs"><Save className="h-3 w-3" /> Mídia</Button>
                    )}
                  </div>
                </div>

                {/* Image preview */}
                {generatedImageUrl && (
                  <div className="rounded-lg overflow-hidden border border-border bg-background">
                    <img src={generatedImageUrl} alt="Criativo IA" className="w-full max-h-[500px] object-contain" />
                  </div>
                )}

                {/* Text/LP preview */}
                {generatedContent && !isImageType && (
                  activeType === "lp" ? (
                    <div className="space-y-2">
                      <div className="border border-border rounded-lg overflow-hidden bg-white">
                        <iframe srcDoc={generatedContent} className="w-full h-[400px]" title="Preview LP" sandbox="allow-scripts" />
                      </div>
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ver código HTML</summary>
                        <pre className="mt-2 p-3 bg-background rounded-lg overflow-auto max-h-[300px] text-[10px] font-mono">{generatedContent}</pre>
                      </details>
                    </div>
                  ) : (
                    <div className="prose prose-sm prose-invert max-w-none text-xs leading-relaxed max-h-[500px] overflow-auto">
                      <ReactMarkdown>{generatedContent}</ReactMarkdown>
                    </div>
                  )
                )}

                {/* Iteration buttons */}
                {!isImageType && generatedContent && (
                  <div className="flex gap-2 flex-wrap pt-2 border-t border-border/50">
                    <Button size="sm" variant="outline" onClick={handleVariation} disabled={generating} className="h-7 gap-1 text-xs">
                      <RefreshCw className="h-3 w-3" /> Gerar Variação
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setRefineDialogOpen(true)} disabled={generating} className="h-7 gap-1 text-xs">
                      <Wand2 className="h-3 w-3" /> Refinar
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleExpand} disabled={generating} className="h-7 gap-1 text-xs">
                      <Expand className="h-3 w-3" /> Expandir
                    </Button>
                  </div>
                )}

                {/* Image iteration */}
                {isImageType && generatedImageUrl && (
                  <div className="flex gap-2 flex-wrap pt-2 border-t border-border/50">
                    <Button size="sm" variant="outline" onClick={handleGenerate} disabled={generating} className="h-7 gap-1 text-xs">
                      <RefreshCw className="h-3 w-3" /> Gerar Variação
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => window.open(generatedImageUrl, "_blank")} className="h-7 gap-1 text-xs">
                      <Download className="h-3 w-3" /> Baixar
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Pre-generation dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" /> Gerar {CONTENT_TYPES.find(c => c.value === activeType)?.label}
            </DialogTitle>
            <DialogDescription>Configure o modelo e personalidade antes de gerar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedProduct && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-primary/10 border border-primary/20">
                <ShoppingCart className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium">Produto: {selectedProduct}</span>
              </div>
            )}

            {!isImageType && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Modelo de IA</Label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODELS.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        <span className="font-medium">{m.label}</span>
                        <Badge variant={m.via === "gateway" ? "secondary" : "outline"} className="ml-2 text-[9px] px-1 py-0">
                          {m.via === "gateway" ? "Gateway" : "OpenRouter"}
                        </Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                <UserCircle className="h-3 w-3" /> Personalidade (Mente IA)
              </Label>
              <Select value={selectedMente} onValueChange={setSelectedMente}>
                <SelectTrigger className="bg-secondary"><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">🚫 Nenhuma — tom neutro</SelectItem>
                  {MENTES_DATA.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      <span>{m.icon} {m.nome}</span>
                      <span className="text-muted-foreground ml-1 text-xs">— {m.spec}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {activeSkill && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-primary/5 border border-primary/20">
                <Zap className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs font-medium">Skill: {activeSkill.label}</p>
                  <p className="text-[10px] text-muted-foreground">O prompt profissional da skill será usado como base</p>
                </div>
              </div>
            )}

            <div className="p-2 rounded-md bg-muted/50 border border-border">
              <p className="text-[10px] text-muted-foreground">💾 O conteúdo será salvo automaticamente no histórico do projeto.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleGenerate} className="gap-1.5">
              {isImageType ? <Palette className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />} Gerar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refine dialog */}
      <Dialog open={refineDialogOpen} onOpenChange={setRefineDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Wand2 className="h-5 w-5 text-primary" /> Refinar Conteúdo</DialogTitle>
            <DialogDescription>Descreva o que quer melhorar ou mudar no resultado.</DialogDescription>
          </DialogHeader>
          <Textarea value={refineFeedback} onChange={e => setRefineFeedback(e.target.value)}
            placeholder="Ex: Deixe mais informal, adicione emojis, foque mais na dor de tempo..." className="min-h-[80px] bg-secondary text-sm" />
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setRefineDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleRefine} disabled={!refineFeedback.trim()} className="gap-1.5">
              <Wand2 className="h-3.5 w-3.5" /> Refinar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History with filters */}
      {(savedItems.length > 0 || loadingSaved) && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans flex items-center gap-2">
              <FileText className="h-4 w-4" /> Histórico de Conteúdos ({savedItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Filters */}
            <div className="flex gap-2 flex-wrap items-center">
              <div className="flex items-center gap-1">
                <Filter className="h-3 w-3 text-muted-foreground" />
                <Select value={historyFilter} onValueChange={setHistoryFilter}>
                  <SelectTrigger className="h-7 text-xs bg-secondary w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    {CONTENT_TYPES.map(ct => (
                      <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1 flex-1 min-w-[150px]">
                <Search className="h-3 w-3 text-muted-foreground" />
                <Input value={historySearch} onChange={e => setHistorySearch(e.target.value)}
                  placeholder="Buscar..." className="h-7 text-xs bg-secondary" />
              </div>
            </div>

            {loadingSaved && <p className="text-xs text-muted-foreground text-center py-4"><Loader2 className="h-4 w-4 animate-spin inline mr-1" />Carregando...</p>}
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-3">
                {filteredHistory.map((item) => {
                  const isImage = item.content_type === "ai_image" && item.content.startsWith("http");
                  return (
                    <Card key={item.id} className="bg-secondary/50 border-border">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">{CONTENT_TYPES.find((c) => c.value === item.content_type)?.label || item.content_type}</Badge>
                            {item.product_name && (
                              <Badge variant="secondary" className="text-[9px] gap-0.5">
                                <ShoppingCart className="h-2 w-2" /> {item.product_name}
                              </Badge>
                            )}
                            {item.model_used && (
                              <Badge variant="outline" className="text-[8px]">{item.model_used.split("/").pop()}</Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleDateString("pt-BR")} {new Date(item.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => handleCopy(item.content)} className="h-6 w-6 p-0"><Copy className="h-3 w-3" /></Button>
                            {item.content_type === "lp" && <Button size="sm" variant="ghost" onClick={() => handleDownloadHTML(item.content)} className="h-6 w-6 p-0"><Download className="h-3 w-3" /></Button>}
                            <Button size="sm" variant="ghost" onClick={() => handleDelete(item.id)} className="h-6 w-6 p-0 text-destructive"><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </div>
                        {isImage ? (
                          <img src={item.content} alt="Criativo IA" className="w-full max-h-[200px] object-contain rounded-md" />
                        ) : (
                          <div className="prose prose-sm prose-invert max-w-none text-[10px] leading-relaxed max-h-[150px] overflow-auto">
                            <ReactMarkdown>{item.content.slice(0, 800) + (item.content.length > 800 ? "\n\n..." : "")}</ReactMarkdown>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MENTES_DATA } from "@/data/mentesData";
import {
  Calendar, Video, Image, FileText, Megaphone, Copy, Download, Loader2, Trash2, Save, Sparkles, Code2, Brain, UserCircle, Zap, ShoppingCart
} from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Props {
  projectId: string;
  project: any;
  onUpdateData: (data: any) => void;
}

type ContentType = "semanal" | "ads_imagem" | "ads_video" | "vsl" | "webinar" | "lp";

const SKILL_MAP: Record<string, { slug: string; label: string }> = {
  ads_imagem: { slug: "devastador", label: "Devastador V4" },
  ads_video: { slug: "devastador", label: "Devastador V4" },
  vsl: { slug: "lp-persuasiva", label: "LP Persuasiva V2" },
  webinar: { slug: "webinar-roteiro", label: "Webinar Roteiro" },
  lp: { slug: "lp-persuasiva", label: "LP Persuasiva V2" },
};

const CONTENT_TYPES: { value: ContentType; label: string; icon: any; desc: string }[] = [
  { value: "semanal", label: "Conteúdo Semanal", icon: Calendar, desc: "Posts e stories para a semana" },
  { value: "ads_imagem", label: "Ads — Imagem", icon: Image, desc: "Copy para criativos estáticos" },
  { value: "ads_video", label: "Ads — Vídeo", icon: Video, desc: "Roteiros para vídeo ads" },
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

// Types that should prompt for product selection
const PRODUCT_REQUIRED_TYPES: ContentType[] = ["webinar", "vsl", "ads_imagem", "ads_video", "lp"];

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
  const [savedItems, setSavedItems] = useState<SavedContent[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [lpTopic, setLpTopic] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
  const [selectedMente, setSelectedMente] = useState("none");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [loadingSaved, setLoadingSaved] = useState(false);

  const produtos: any[] = data.produtos || [];

  // Load saved content from DB
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
    // Auto-select first product if available
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

  const handleGenerate = async () => {
    const modelObj = MODELS.find(m => m.id === selectedModel);
    const isOpenRouter = modelObj?.via === "openrouter";

    if (isOpenRouter) {
      const orKey = getOpenRouterKey();
      if (!orKey) {
        toast.error("Chave OpenRouter não configurada. Vá em Configurações → APIs & Keys.");
        return;
      }
    }

    setDialogOpen(false);
    setGenerating(true);
    setGeneratedContent("");

    try {
      const ctx = getContextSummary();
      const skill = SKILL_MAP[activeType];
      const productName = getProductForPrompt();

      const bodyPayload: Record<string, any> = {
        project_id: projectId,
        model: selectedModel,
      };

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
        if (activeType === "vsl") extraParts.push(`Roteiro completo de VSL para "${productName}". Blocos: Hook, Problema, Agitação, Mecanismo, Prova social, Oferta, Garantia, CTA. Use dados do avatar (dores, desejos, objeções) para tornar o roteiro cirúrgico.`);
        if (activeType === "webinar") extraParts.push(`Estrutura completa de webinário para "${productName}". Abertura+promessa, Credenciais do Expert, 3 blocos educacionais com conteúdo de valor real, Transição sutil para oferta, Apresentação da oferta+bônus, Garantia, FAQ com objeções reais do avatar, Escassez+CTA. Use tom de voz do expert: "${ctx.expert.tom_voz || "profissional"}". Inclua scripts de interação com a audiência (enquetes, perguntas). Dores do avatar: ${JSON.stringify((ctx.avatar.dores || []).slice(0, 5))}. Desejos: ${JSON.stringify((ctx.avatar.desejos || []).slice(0, 5))}.`);
        if (customPrompt) extraParts.push(customPrompt);

        bodyPayload.extra_instructions = extraParts.join("\n");
      } else {
        bodyPayload.action = "generate_content";
        bodyPayload.content_type = activeType;

        const prompts: Record<string, string> = {
          semanal: `Crie um planejamento de conteúdo para 7 dias (seg a dom) para "${ctx.projeto}". Inclua: tema, copy curta, CTA e formato (carrossel, reels, stories). Dores: ${JSON.stringify((ctx.avatar.dores || []).slice(0, 5))}. Desejos: ${JSON.stringify((ctx.avatar.desejos || []).slice(0, 5))}. Tom: ${ctx.expert.tom_voz || "profissional"}. Promessa: "${ctx.arsenal.promessa || ""}".`,
        };
        bodyPayload.prompt = customPrompt
          ? `${prompts[activeType]}\n\nInstruções extras: ${customPrompt}`
          : prompts[activeType];
      }

      const { data: aiData, error } = await supabase.functions.invoke("openflow-ai", { body: bodyPayload });
      if (error) throw error;
      const content = aiData?.result || aiData?.text || aiData?.content || JSON.stringify(aiData);
      setGeneratedContent(content);

      // Auto-save to DB
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: saveErr } = await supabase.from("imphq_generated_contents").insert({
          project_id: projectId,
          user_id: user.id,
          content_type: activeType,
          content,
          product_name: PRODUCT_REQUIRED_TYPES.includes(activeType) ? productName : null,
          model_used: selectedModel,
          custom_prompt: customPrompt || null,
          metadata: { mente: selectedMente !== "none" ? selectedMente : null },
        });
        if (!saveErr) {
          loadSavedContents();
          toast.success("Conteúdo gerado e salvo automaticamente!");
        } else {
          toast.success("Conteúdo gerado! (erro ao salvar no histórico)");
        }
      } else {
        toast.success("Conteúdo gerado!");
      }
    } catch (err: any) {
      if (err?.message?.includes("429") || err?.status === 429) {
        toast.error("Rate limit excedido. Tente novamente em alguns segundos.");
      } else if (err?.message?.includes("402") || err?.status === 402) {
        toast.error("Créditos insuficientes. Adicione créditos no workspace.");
      } else {
        toast.error(err.message || "Erro ao gerar");
      }
    } finally {
      setGenerating(false);
    }
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

  const activeSkill = SKILL_MAP[activeType];
  const showProductSelector = PRODUCT_REQUIRED_TYPES.includes(activeType);

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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CONTENT_TYPES.map((ct) => {
              const skill = SKILL_MAP[ct.value];
              return (
                <button key={ct.value} onClick={() => setActiveType(ct.value)}
                  className={`p-3 rounded-lg border text-left transition-all relative ${activeType === ct.value ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/50 hover:border-primary/40"}`}>
                  <ct.icon className="h-4 w-4 mb-1" />
                  <p className="text-xs font-medium">{ct.label}</p>
                  <p className="text-[10px] text-muted-foreground">{ct.desc}</p>
                  {skill && (
                    <Badge variant="secondary" className="absolute top-1.5 right-1.5 text-[8px] px-1 py-0 gap-0.5">
                      <Zap className="h-2 w-2" /> {skill.label}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>

          {/* Product selector - always visible */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                <ShoppingCart className="h-3 w-3" /> Produto
              </Label>
              {produtos.length > 0 ? (
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger className="bg-secondary text-xs">
                    <SelectValue placeholder="Selecione o produto..." />
                  </SelectTrigger>
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

            {activeType === "lp" && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5">Foco / Tema da LP (opcional)</Label>
                <Input value={lpTopic} onChange={(e) => setLpTopic(e.target.value)} placeholder="Ex: Black Friday, Lançamento..." className="bg-secondary text-xs" />
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs">Instruções adicionais (opcional)</Label>
            <Textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} placeholder="Ex: Tom informal, incluir emojis..." className="bg-secondary text-xs min-h-[60px]" />
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            <Button onClick={handleOpenDialog} disabled={generating} className="gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? "Gerando..." : "Gerar com IA"}
            </Button>
            <Badge variant="outline" className="text-[10px]">Contexto: Avatar + Expert + Arsenal + Produtos</Badge>
            {activeSkill && (
              <Badge variant="secondary" className="text-[10px] gap-1">
                <Zap className="h-2.5 w-2.5" /> Skill: {activeSkill.label}
              </Badge>
            )}
          </div>

          {generatedContent && (
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
                  </div>
                </div>
                {activeType === "lp" ? (
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

            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Modelo de IA</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="bg-secondary">
                  <SelectValue />
                </SelectTrigger>
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

            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                <UserCircle className="h-3 w-3" /> Personalidade (Mente IA)
              </Label>
              <Select value={selectedMente} onValueChange={setSelectedMente}>
                <SelectTrigger className="bg-secondary">
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
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

            {!activeSkill && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-secondary border border-border">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium">Geração direta</p>
                  <p className="text-[10px] text-muted-foreground">Sem skill dedicada — prompt contextual do projeto</p>
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
              <Sparkles className="h-3.5 w-3.5" /> Gerar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Saved contents from DB */}
      {(savedItems.length > 0 || loadingSaved) && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans flex items-center gap-2">
              <FileText className="h-4 w-4" /> Histórico de Conteúdos ({savedItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingSaved && <p className="text-xs text-muted-foreground text-center py-4"><Loader2 className="h-4 w-4 animate-spin inline mr-1" />Carregando...</p>}
            {savedItems.map((item) => (
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
                      <span className="text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleDateString("pt-BR")} {new Date(item.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleCopy(item.content)} className="h-6 w-6 p-0"><Copy className="h-3 w-3" /></Button>
                      {item.content_type === "lp" && <Button size="sm" variant="ghost" onClick={() => handleDownloadHTML(item.content)} className="h-6 w-6 p-0"><Download className="h-3 w-3" /></Button>}
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(item.id)} className="h-6 w-6 p-0 text-destructive"><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                  <div className="prose prose-sm prose-invert max-w-none text-[10px] leading-relaxed max-h-[150px] overflow-auto">
                    <ReactMarkdown>{item.content.slice(0, 800) + (item.content.length > 800 ? "\n\n..." : "")}</ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

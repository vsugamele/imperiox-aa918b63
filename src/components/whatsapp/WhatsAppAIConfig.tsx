import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bot, Save, Loader2, Brain, Clock, Shield, Zap, Sparkles, Plus, Trash2, RefreshCw, MessageSquare, Info, Sliders, Server, GraduationCap, CheckCircle, Copy } from "lucide-react";
import { RefineAIDialog } from "./RefineAIDialog";

interface FaqItem { pergunta: string; resposta: string; }

interface AIConfig {
  id?: string;
  project_id: string;
  provider_id?: string | null;
  enabled: boolean;
  personality: string;
  tone: string;
  max_tokens: number;
  escalation_keywords: string[];
  welcome_message: string;
  context_sources: string[];
  response_delay_seconds: number;
  business_hours_only: boolean;
  business_hours_start: string;
  business_hours_end: string;
  expert_persona?: string;
  custom_instructions?: string;
  product_focus?: string;
  faq?: FaqItem[];
  ignored_phones?: string[];
}

const PERSONALITIES = [
  { id: "assistente", label: "Assistente Geral", desc: "Cordial, acolhedor e informativo." },
  { id: "vendedor", label: "Closer de Vendas", desc: "Focado em conversão, conduzir para oferta e quebrar objeções." },
  { id: "suporte", label: "Suporte Técnico", desc: "Focado em resolução ágil de dúvidas e problemas." },
  { id: "consultor", label: "Consultor Expert", desc: "Autoridade técnica, oferece conselhos e recomendações." },
];

const TONES = [
  { id: "profissional", label: "Profissional" },
  { id: "casual", label: "Casual" },
  { id: "amigavel", label: "Amigável" },
  { id: "formal", label: "Formal" },
  { id: "urgente", label: "Urgente" },
];

const CONTEXT_OPTIONS = [
  { id: "briefing", label: "Briefing do Projeto", desc: "Contexto geral e metas do projeto" },
  { id: "avatar", label: "Avatar / Persona", desc: "Público-alvo, dores e desejos" },
  { id: "produtos", label: "Produtos & Preços", desc: "Valores, links e detalhes técnicos" },
  { id: "faq", label: "Perguntas Frequentes (FAQ)", desc: "Respostas literais cadastradas" },
  { id: "branding", label: "Tom de Marca", desc: "Diretrizes de comunicação" },
  { id: "copy_arsenal", label: "Arsenal de Copy", desc: "Gatilhos mentais e criativos" },
  { id: "expert", label: "Expert do Projeto", desc: "História e autoridade do especialista" },
];

interface Props {
  projectId: string;
  providerId?: string;
}

export default function WhatsAppAIConfig({ projectId, providerId }: Props) {
  const [config, setConfig] = useState<AIConfig>({
    project_id: projectId,
    enabled: false,
    personality: "assistente",
    tone: "profissional",
    max_tokens: 300,
    escalation_keywords: ["humano", "atendente", "pessoa", "falar com alguém"],
    welcome_message: "",
    context_sources: ["briefing", "avatar", "produtos", "faq"],
    response_delay_seconds: 3,
    business_hours_only: false,
    business_hours_start: "08:00",
    business_hours_end: "20:00",
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [keywordsText, setKeywordsText] = useState("");
  const [refineOpen, setRefineOpen] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const [testImageUrl, setTestImageUrl] = useState("");
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [ignoredPhonesText, setIgnoredPhonesText] = useState("");
  const [projectProducts, setProjectProducts] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [testPhone, setTestPhone] = useState<string>("");

  const isProductSelected = (productName: string) => {
    if (!config.product_focus) return false;
    return config.product_focus.toLowerCase().includes(productName.toLowerCase());
  };

  const handleToggleProduct = (product: any) => {
    if (isProductSelected(product.nome)) {
      const currentSelected = projectProducts.filter(p => p.nome !== product.nome && isProductSelected(p.nome));
      const newFocus = currentSelected.map(p => `Produto: ${p.nome}${p.preco ? ` · Preço: ${p.preco}` : ""}${p.link ? ` · Link: ${p.link}` : ""}`).join(" | ");
      setConfig(prev => ({ ...prev, product_focus: newFocus }));
    } else {
      const currentSelected = [...projectProducts.filter(p => isProductSelected(p.nome)), product];
      const newFocus = currentSelected.map(p => `Produto: ${p.nome}${p.preco ? ` · Preço: ${p.preco}` : ""}${p.link ? ` · Link: ${p.link}` : ""}`).join(" | ");
      setConfig(prev => ({ ...prev, product_focus: newFocus }));
    }
  };

  const handleSimulate = async () => {
    if (!testMessage.trim() && !testImageUrl.trim()) {
      toast.error("Digite uma mensagem ou insira uma URL de imagem para simular");
      return;
    }
    setSimulating(true);
    setSimulationResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-api", {
        body: {
          action: "simulate_ai_reply",
          project_id: projectId,
          provider_id: providerId || null,
          message: testMessage,
          history: [],
          phone: testPhone || null,
          media_url: testImageUrl || null,
          media_type: testImageUrl ? "image" : null,
        }
      });

      if (error) throw error;

      if (data?.success) {
        setSimulationResult(data);
        toast.success("Simulação concluída com sucesso!");
      } else {
        toast.error(data?.error || "Falha na simulação");
      }
    } catch (err: any) {
      toast.error("Erro ao simular: " + err.message);
    } finally {
      setSimulating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Resposta copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    loadConfig();
  }, [projectId, providerId]);

  const loadConfig = async () => {
    setLoading(true);
    const query = supabase
      .from("imphq_wa_ai_config")
      .select("*")
      .eq("project_id", projectId);
    
    if (providerId) {
      query.eq("provider_id", providerId);
    } else {
      query.is("provider_id", null);
    }

    const { data } = await query.maybeSingle();
    if (data) {
      setConfig(data as any);
      setKeywordsText((data.escalation_keywords || []).join(", "));
      setIgnoredPhonesText((data.ignored_phones || []).join(", "));
    } else {
      setConfig({
        project_id: projectId,
        provider_id: providerId || null,
        enabled: false,
        personality: "assistente",
        tone: "profissional",
        max_tokens: 300,
        escalation_keywords: ["humano", "atendente", "pessoa", "falar com alguém"],
        welcome_message: "",
        context_sources: ["briefing", "avatar", "produtos", "faq"],
        response_delay_seconds: 3,
        business_hours_only: false,
        business_hours_start: "08:00",
        business_hours_end: "20:00",
      });
      setKeywordsText("humano, atendente, pessoa, falar com alguém");
      setIgnoredPhonesText("");
    }

    // Fetch project products
    const { data: proj } = await supabase
      .from("imphq_projects")
      .select("name, data")
      .eq("id", projectId)
      .maybeSingle();

    if (proj) {
      const d: any = typeof proj.data === "string" ? JSON.parse(proj.data) : (proj.data || {});
      let list: any[] = [];
      if (Array.isArray(d.produtos)) {
        list = d.produtos.map((p: any) => ({
          nome: p.nome || p.name || "",
          preco: p.preco || p.price || "",
          link: p.link_checkout || p.link || ""
        })).filter((p: any) => p.nome);
      }
      
      const mainProductName = d.produto_principal?.nome || d.produto_principal?.name || d.produto || d.produto_principal || "";
      const mainProductPrice = d.produto_principal?.preco || d.produto_principal?.price || d.preco || "";
      const mainProductLink = d.produto_principal?.link_checkout || d.produto_principal?.link || "";

      if (mainProductName && typeof mainProductName === "string" && !list.some(p => p.nome.toLowerCase() === mainProductName.toLowerCase())) {
        list.unshift({
          nome: mainProductName,
          preco: mainProductPrice,
          link: mainProductLink
        });
      }
      setProjectProducts(list);
    } else {
      setProjectProducts([]);
    }

    // Fetch project leads for testing
    try {
      const { data: leadsData } = await supabase
        .from("imphq_leads")
        .select("id, nome, phone")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (leadsData) {
        setLeads(leadsData);
        if (leadsData.length > 0) {
          setTestPhone(leadsData[0].phone);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar leads para simulação:", err);
    }

    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const keywords = keywordsText.split(",").map(k => k.trim()).filter(Boolean);
    const ignored = ignoredPhonesText.split(",").map(n => n.trim()).filter(Boolean);
    const payload: any = { 
      ...config, 
      escalation_keywords: keywords, 
      ignored_phones: ignored,
      provider_id: providerId || null,
      updated_at: new Date().toISOString() 
    };

    const { error } = config.id
      ? await supabase.from("imphq_wa_ai_config").update(payload).eq("id", config.id)
      : await supabase.from("imphq_wa_ai_config").insert(payload);

    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Configurações da IA salvas com sucesso!");
      loadConfig();
    }
    setSaving(false);
  };

  const syncFromProject = async () => {
    const { data: proj } = await supabase
      .from("imphq_projects")
      .select("name, data, brand_kit, avatar")
      .eq("id", projectId)
      .maybeSingle();
    if (!proj) { toast.error("Projeto não encontrado"); return; }
    const d: any = typeof proj.data === "string" ? JSON.parse(proj.data) : (proj.data || {});
    const bk: any = proj.brand_kit || {};
    const expert = d.expert || d.especialista || {};
    const persona = [
      expert?.nome && `Expert: ${expert.nome}`,
      expert?.bio && `Bio: ${expert.bio}`,
      bk?.voice && `Voz da marca: ${bk.voice}`,
      bk?.tom && `Tom: ${bk.tom}`,
    ].filter(Boolean).join("\n");
    const prod = d.produto_principal || d.produtos?.[0];
    const focus = prod ? [
      prod.nome && `Produto: ${prod.nome}`,
      prod.preco && `Preço: ${prod.preco}`,
      (prod.link_checkout || prod.link) && `Link: ${prod.link_checkout || prod.link}`,
    ].filter(Boolean).join(" · ") : "";
    setConfig(p => ({
      ...p,
      expert_persona: p.expert_persona || persona,
      product_focus: p.product_focus || focus,
    }));
    toast.success("Sincronizado com os dados centrais do projeto!");
  };

  const updateFaq = (idx: number, field: "pergunta" | "resposta", value: string) => {
    setConfig(p => {
      const faq = [...(p.faq || [])];
      faq[idx] = { ...faq[idx], [field]: value };
      return { ...p, faq };
    });
  };
  const addFaq = () => setConfig(p => ({ ...p, faq: [...(p.faq || []), { pergunta: "", resposta: "" }] }));
  const removeFaq = (idx: number) => setConfig(p => ({ ...p, faq: (p.faq || []).filter((_, i) => i !== idx) }));

  const toggleContext = (id: string) => {
    setConfig(prev => ({
      ...prev,
      context_sources: prev.context_sources.includes(id)
        ? prev.context_sources.filter(s => s !== id)
        : [...prev.context_sources, id],
    }));
  };

  if (loading) return (
    <div className="flex items-center justify-center p-8 gap-2 text-sm text-muted-foreground bg-card rounded-lg border border-border/40">
      <Loader2 className="h-4 w-4 animate-spin text-primary" /> Carregando configurações da IA...
    </div>
  );

  return (
    <Card className="border-border/50 bg-card/60 backdrop-blur-md shadow-lg overflow-hidden">
      <CardHeader className="border-b border-border/30 bg-secondary/15 pb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg font-serif">
              <Bot className="h-5.5 w-5.5 text-primary" />
              WhatsApp Autônomo (Copiloto & Autoresponder)
            </CardTitle>
            <CardDescription className="text-xs">
              Configure como o cérebro artificial responderá aos seus leads no WhatsApp.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 bg-secondary/50 border border-border/40 px-3 py-1.5 rounded-full">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground mr-1">Status:</span>
            <Badge variant={config.enabled ? "default" : "secondary"} className="text-[10px] font-semibold px-2 py-0.5">
              {config.enabled ? "ATIVO (Auto)" : "INATIVO (Manual)"}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <Tabs defaultValue="behavior" className="w-full">
          {/* Custom elegant Sidebar-like Tab triggers inside the card */}
          <div className="border-b border-border/30 bg-secondary/10 px-4 py-2">
            <TabsList className="bg-background/50 p-1 border border-border/30 w-full flex flex-wrap h-auto gap-1">
              <TabsTrigger value="behavior" className="text-xs py-1.5 px-3 flex-1 flex items-center justify-center gap-1.5">
                <Sliders className="h-3.5 w-3.5" /> Comportamento
              </TabsTrigger>
              <TabsTrigger value="model" className="text-xs py-1.5 px-3 flex-1 flex items-center justify-center gap-1.5">
                <Server className="h-3.5 w-3.5" /> Conexão & Custo
              </TabsTrigger>
              <TabsTrigger value="rules" className="text-xs py-1.5 px-3 flex-1 flex items-center justify-center gap-1.5">
                <Shield className="h-3.5 w-3.5" /> Regras & Escalação
              </TabsTrigger>
              <TabsTrigger value="training" className="text-xs py-1.5 px-3 flex-1 flex items-center justify-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5" /> Cérebro & FAQ
              </TabsTrigger>
              <TabsTrigger value="playground" className="text-xs py-1.5 px-3 flex-1 flex items-center justify-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Playground de Teste
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-5 space-y-6">
            {/* ── TAB 1: COMPOSTAMENTO ── */}
            <TabsContent value="behavior" className="mt-0 space-y-4 animate-fade-in">
              {/* Toggles Strip */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className={`p-4 rounded-lg border transition-all ${config.enabled ? "bg-primary/5 border-primary/20" : "bg-secondary/20 border-border/40"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                        <Zap className={`h-4 w-4 ${config.enabled ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
                        Autoresponder Ativo
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-normal">
                        Quando ativo, a IA enviará mensagens autônomas para leads recebidos. Quando inativo, ela apenas gerará rascunhos.
                      </p>
                    </div>
                    <Switch checked={config.enabled} onCheckedChange={v => setConfig(p => ({ ...p, enabled: v }))} className="mt-1" />
                  </div>
                </div>

                <div className={`p-4 rounded-lg border transition-all ${(config as any).draft_mode === true ? "bg-amber-500/5 border-amber-500/20" : "bg-secondary/20 border-border/40"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                        <MessageSquare className="h-4 w-4 text-amber-500" />
                        Modo Rascunho (Copiloto)
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-normal">
                        A IA elabora a resposta perfeita no chat, mas **não envia**. Você revisa, edita e aprova com 1 clique antes do disparo.
                      </p>
                    </div>
                    <Switch checked={(config as any).draft_mode === true} onCheckedChange={v => setConfig(p => ({ ...p, draft_mode: v } as any))} className="mt-1" />
                  </div>
                </div>
              </div>

              {/* Personality & Tone Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <Brain className="h-3.5 w-3.5 text-primary" /> Personalidade Base
                  </Label>
                  <Select value={config.personality} onValueChange={v => setConfig(p => ({ ...p, personality: v }))}>
                    <SelectTrigger className="bg-secondary/40 border-border/30 text-xs h-9.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PERSONALITIES.map(p => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          <span className="font-semibold text-foreground">{p.label}</span>
                          <span className="block text-[10px] text-muted-foreground mt-0.5">{p.desc}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <Sliders className="h-3.5 w-3.5 text-primary" /> Tom de Voz / Linguagem
                  </Label>
                  <Select value={config.tone} onValueChange={v => setConfig(p => ({ ...p, tone: v }))}>
                    <SelectTrigger className="bg-secondary/40 border-border/30 text-xs h-9.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TONES.map(t => (
                        <SelectItem key={t.id} value={t.id} className="text-xs">{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Delay & Welcome Message */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5 sm:col-span-1">
                  <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-primary" /> Tempo de Simulação (Delay)
                  </Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min={0}
                      max={30}
                      value={config.response_delay_seconds}
                      onChange={e => setConfig(p => ({ ...p, response_delay_seconds: parseInt(e.target.value) || 3 }))}
                      className="text-xs bg-secondary/40 border-border/30 h-9.5 pr-10"
                    />
                    <span className="absolute right-3 top-3 text-[10px] text-muted-foreground">seg</span>
                  </div>
                  <p className="text-[9px] text-muted-foreground leading-normal">
                    Simula digitação humana antes de enviar a resposta.
                  </p>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-semibold text-muted-foreground">Mensagem de Boas-Vindas Inicial (opcional)</Label>
                  <Textarea
                    value={config.welcome_message}
                    onChange={e => setConfig(p => ({ ...p, welcome_message: e.target.value }))}
                    placeholder="Ex: Olá! Vi seu interesse e já vou te passar as informações. Me diz, você já conhece o projeto?"
                    className="min-h-[50px] text-xs bg-secondary/40 border-border/30 resize-none leading-relaxed"
                  />
                  <p className="text-[9px] text-muted-foreground leading-normal">
                    Se preenchido, dispara esse texto no primeiro contato antes de acionar a inteligência artificial.
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* ── TAB 2: MODEL & COST ── */}
            <TabsContent value="model" className="mt-0 space-y-4 animate-fade-in">
              <div className="bg-primary/5 rounded-lg border border-primary/10 p-4 flex gap-3 items-start">
                <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-foreground">Conecte seus modelos favoritos</h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Você pode usar nossa infraestrutura integrada (Lovable AI) sem custos adicionais, ou plugar sua chave do **OpenRouter** para usar modelos avançados como **Claude 3.5 Sonnet**, **DeepSeek V3** e **GPT-4o** pagando apenas os centavos de centavos que você consome.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Provedor de IA (Gateway)</Label>
                  <Select value={(config as any).ai_provider || "lovable"} onValueChange={v => setConfig(p => ({ ...p, ai_provider: v } as any))}>
                    <SelectTrigger className="bg-secondary/40 border-border/30 text-xs h-9.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lovable" className="text-xs">Lovable AI (Gemini, GPT-5 Integrado)</SelectItem>
                      <SelectItem value="openrouter" className="text-xs">OpenRouter (Modelos Customizados)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Modelo de Linguagem (LLM)</Label>
                  <Select value={(config as any).ai_model || ""} onValueChange={v => setConfig(p => ({ ...p, ai_model: v } as any))}>
                    <SelectTrigger className="bg-secondary/40 border-border/30 text-xs h-9.5"><SelectValue placeholder="Padrão do sistema (Flash)" /></SelectTrigger>
                    <SelectContent>
                      {((config as any).ai_provider === "openrouter" ? [
                        "anthropic/claude-3.5-sonnet",
                        "anthropic/claude-3.5-haiku",
                        "openai/gpt-4o",
                        "openai/gpt-4o-mini",
                        "google/gemini-2.5-pro",
                        "google/gemini-2.5-flash",
                        "meta-llama/llama-3.3-70b-instruct",
                        "deepseek/deepseek-chat",
                        "mistralai/mistral-large",
                      ] : [
                        "google/gemini-3-flash-preview",
                        "google/gemini-2.5-pro",
                        "google/gemini-2.5-flash",
                        "openai/gpt-5-mini",
                        "openai/gpt-5",
                      ]).map(m => <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Advanced Parameters */}
              <div className="bg-secondary/15 rounded-lg border border-border/30 p-4 space-y-4">
                <div className="flex items-center gap-2 border-b border-border/20 pb-2">
                  <Sliders className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold text-foreground">Hiperparâmetros do Modelo</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <Label className="font-semibold text-muted-foreground">Criatividade (Temp: {Number((config as any).ai_temperature ?? 0.7).toFixed(1)})</Label>
                    </div>
                    <input type="range" min={0} max={1.5} step={0.1}
                      value={(config as any).ai_temperature ?? 0.7}
                      onChange={e => setConfig(p => ({ ...p, ai_temperature: parseFloat(e.target.value) } as any))}
                      className="w-full h-1.5 bg-secondary accent-primary rounded-lg cursor-pointer" />
                    <p className="text-[9px] text-muted-foreground leading-normal">
                      Valores menores = mais estável e direto. Valores maiores = mais criativo e variado.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <Label className="font-semibold text-muted-foreground">Filtro Top P ({Number((config as any).ai_top_p ?? 1).toFixed(1)})</Label>
                    </div>
                    <input type="range" min={0.1} max={1} step={0.1}
                      value={(config as any).ai_top_p ?? 1}
                      onChange={e => setConfig(p => ({ ...p, ai_top_p: parseFloat(e.target.value) } as any))}
                      className="w-full h-1.5 bg-secondary accent-primary rounded-lg cursor-pointer" />
                    <p className="text-[9px] text-muted-foreground leading-normal">
                      Limita o vocabulário avaliado pela IA para reduzir gírias ou repetições.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">Limite de Resposta (Tokens)</Label>
                    <Input
                      type="number"
                      min={50}
                      max={1500}
                      value={config.max_tokens}
                      onChange={e => setConfig(p => ({ ...p, max_tokens: parseInt(e.target.value) || 300 }))}
                      className="text-xs bg-secondary/40 border-border/30 h-8"
                    />
                    <p className="text-[9px] text-muted-foreground leading-normal">
                      Evita respostas extremamente longas. 300 tokens equivalem a ~200 palavras.
                    </p>
                  </div>
                </div>
              </div>

              {/* Autolearning mode */}
              <div className="p-4 rounded-lg border border-border/30 bg-secondary/10 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Brain className="h-4 w-4 text-primary animate-pulse" />
                    <p className="text-xs font-bold text-foreground">Aprendizado de Máquina (Auto-Learning)</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    Indexa automaticamente respostas que sua equipe dá no chat humano. O cérebro da IA fica mais inteligente a cada conversa real!
                  </p>
                </div>
                <Switch checked={(config as any).learning_mode !== false}
                  onCheckedChange={v => setConfig(p => ({ ...p, learning_mode: v } as any))} />
              </div>
            </TabsContent>

            {/* ── TAB 3: RULES & ESCALATION ── */}
            <TabsContent value="rules" className="mt-0 space-y-5 animate-fade-in">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                  <Shield className="h-4 w-4 text-primary" /> Palavras de Parada & Escalação Humana
                </Label>
                <div className="p-3 bg-secondary/20 rounded border border-border/40 space-y-2.5">
                  <Input
                    value={keywordsText}
                    onChange={e => setKeywordsText(e.target.value)}
                    placeholder="ex: humano, falar com atendente, suporte, pessoa, help"
                    className="text-xs bg-background border-border/30 h-10"
                  />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    💡 **Como funciona:** Separe por vírgulas. Sempre que o lead digitar qualquer uma destas palavras (ou sinônimos diretos), a IA **desativa a si mesma automaticamente** na conversa, marca a conversa como pendente de suporte e emite alerta visual. Isso evita conversas repetitivas e loops irritantes para o cliente.
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-border/20">
                <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                  <Bot className="h-4 w-4 text-primary" /> Contatos Ignorados (Blacklist de Leads)
                </Label>
                <div className="p-3 bg-secondary/20 rounded border border-border/40 space-y-2.5">
                  <Input
                    value={ignoredPhonesText}
                    onChange={e => setIgnoredPhonesText(e.target.value)}
                    placeholder="ex: +5511999999999, 5511888888888"
                    className="text-xs bg-background border-border/30 h-10"
                  />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Separe por vírgulas. A IA nunca responderá automaticamente a estes números de telefone (leads). Útil para o seu próprio número, parceiros ou clientes sob suporte manual.
                  </p>
                </div>
              </div>

              <div className="bg-secondary/15 rounded-lg border border-border/30 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-primary" /> Limitar ao Horário de Atendimento
                    </span>
                    <p className="text-[10px] text-muted-foreground max-w-md leading-normal">
                      Evita respostas automáticas nos finais de semana ou fora do horário comercial, permitindo humanizar o atendimento.
                    </p>
                  </div>
                  <Switch
                    checked={config.business_hours_only}
                    onCheckedChange={v => setConfig(p => ({ ...p, business_hours_only: v }))}
                  />
                </div>

                {config.business_hours_only && (
                  <div className="flex items-center gap-2 bg-background/50 p-3 rounded border border-border/30 w-fit animate-slide-in">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Início do Turno</Label>
                      <Input
                        value={config.business_hours_start}
                        onChange={e => setConfig(p => ({ ...p, business_hours_start: e.target.value }))}
                        className="w-24 h-8 text-xs font-mono text-center bg-secondary/20 border-border/30"
                      />
                    </div>
                    <span className="text-muted-foreground font-light text-sm mt-4">até</span>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Término do Turno</Label>
                      <Input
                        value={config.business_hours_end}
                        onChange={e => setConfig(p => ({ ...p, business_hours_end: e.target.value }))}
                        className="w-24 h-8 text-xs font-mono text-center bg-secondary/20 border-border/30"
                      />
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── TAB 4: TRAINING & FAQ ── */}
            <TabsContent value="training" className="mt-0 space-y-5 animate-fade-in">
              <div className="flex items-center justify-between gap-3 border-b border-border/20 pb-3 flex-wrap">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Brain className="h-4 w-4 text-primary" /> Alavancagem de Contexto
                  </h4>
                  <p className="text-[10px] text-muted-foreground">
                    Marque quais pilares informativos do projeto esta IA deve levar em consideração ao formular respostas.
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button type="button" size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={syncFromProject}>
                    <RefreshCw className="h-3.5 w-3.5" /> Puxar dados do projeto
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-primary/20 text-primary hover:bg-primary/5" onClick={() => setRefineOpen(true)}>
                    <Sparkles className="h-3.5 w-3.5" /> Refinar cérebro
                  </Button>
                </div>
              </div>

              {/* Context checklist bubbles */}
              <div className="space-y-2">
                <Label className="text-[11px] text-muted-foreground font-semibold">Bancos de Conhecimento Ativados</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {CONTEXT_OPTIONS.map(opt => {
                    const active = config.context_sources.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => toggleContext(opt.id)}
                        className={`text-left p-2.5 rounded-lg border transition-all flex items-start gap-2.5 ${
                          active
                            ? "bg-primary/5 border-primary/30 text-primary"
                            : "bg-secondary/15 border-border/20 hover:border-border/40 text-muted-foreground"
                        }`}
                      >
                        <div className={`mt-0.5 rounded-full p-0.5 ${active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                          <CheckCircle className="h-3 w-3" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate text-foreground">{opt.label}</p>
                          <p className="text-[9px] leading-tight text-muted-foreground mt-0.5">{opt.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Advanced Persona Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                    👑 Persona do Expert
                  </Label>
                  <Textarea
                    value={config.expert_persona || ""}
                    onChange={e => setConfig(p => ({ ...p, expert_persona: e.target.value }))}
                    placeholder="Descreva a postura, autoridade e biografia que a IA assumirá ao falar no singular."
                    className="min-h-[100px] text-xs bg-secondary/40 border-border/30 resize-none leading-relaxed"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                    🚫 Instruções e Barreiras Mandatórias
                  </Label>
                  <Textarea
                    value={config.custom_instructions || ""}
                    onChange={e => setConfig(p => ({ ...p, custom_instructions: e.target.value }))}
                    placeholder="Regras inquebráveis: Ex: 'Nunca prometa desconto', 'Se perguntarem do prazo, diga 7 dias', 'Evite responder sobre outros nichos'."
                    className="min-h-[100px] text-xs bg-secondary/40 border-border/30 resize-none leading-relaxed"
                  />
                </div>
              </div>

              {/* Product and Focus details */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-muted-foreground">Produto / Oferta Principal em Foco</Label>
                  <p className="text-[10px] text-muted-foreground">Clique para selecionar um ou mais produtos do projeto. A IA focará em convertê-los na conversa.</p>
                </div>

                {projectProducts.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-1">
                    {projectProducts.map((prod, idx) => {
                      const selected = isProductSelected(prod.nome);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleToggleProduct(prod)}
                          className={`text-left p-3 rounded-lg border transition-all flex items-center justify-between ${
                            selected
                              ? "bg-primary/10 border-primary/40 text-primary"
                              : "bg-secondary/20 border-border/40 hover:border-border/60 text-muted-foreground"
                          }`}
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <p className="text-xs font-semibold truncate text-foreground">{prod.nome}</p>
                            {prod.preco && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">Preço: {prod.preco}</p>
                            )}
                            {prod.link && (
                              <p className="text-[9px] text-muted-foreground truncate mt-0.5">{prod.link}</p>
                            )}
                          </div>
                          <div className={`h-4.5 w-4.5 rounded-full border flex items-center justify-center shrink-0 ${selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"}`}>
                            {selected && <CheckCircle className="h-3.5 w-3.5" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                <Input
                  value={config.product_focus || ""}
                  onChange={e => setConfig(p => ({ ...p, product_focus: e.target.value }))}
                  placeholder="Nome do produto, preço e link do checkout para a IA fechar a venda de forma rápida."
                  className="text-xs bg-secondary/40 border-border/30 h-9.5"
                />
              </div>

              {/* FAQ Section */}
              <div className="space-y-3 pt-3 border-t border-border/20">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-foreground">FAQ - Respostas Literais para Dúvidas Comuns</Label>
                    <p className="text-[10px] text-muted-foreground">A IA utiliza esse FAQ como fonte prioritária de verdade para dúvidas repetitivas.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-[10px] gap-1 border-primary/20 text-primary hover:bg-primary/5" onClick={addFaq}>
                    <Plus className="h-3 w-3" /> Adicionar Pergunta
                  </Button>
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {(config.faq || []).length === 0 && (
                    <div className="text-center py-6 border border-dashed border-border/40 rounded-lg bg-secondary/5">
                      <p className="text-xs text-muted-foreground italic">Nenhuma pergunta cadastrada no FAQ ainda.</p>
                    </div>
                  )}
                  {(config.faq || []).map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-start p-3.5 rounded-lg bg-secondary/25 border border-border/30 shadow-sm animate-fade-in">
                      <div className="flex-1 space-y-2">
                        <div className="grid grid-cols-1 gap-2">
                          <Input
                            value={item.pergunta}
                            onChange={e => updateFaq(idx, "pergunta", e.target.value)}
                            placeholder={`Pergunta #${idx + 1} (ex: Tem garantia?)`}
                            className="text-xs h-9 bg-background border-border/30 font-medium"
                          />
                          <Textarea
                            value={item.resposta}
                            onChange={e => updateFaq(idx, "resposta", e.target.value)}
                            placeholder="Resposta exata e literal (ex: Sim! Oferecemos 7 dias de garantia incondicional...)"
                            className="min-h-[55px] text-xs bg-background border-border/30 resize-none leading-relaxed"
                          />
                        </div>
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0 mt-0.5" onClick={() => removeFaq(idx)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* ── TAB 5: PLAYGROUND DE TESTE ── */}
            <TabsContent value="playground" className="mt-0 space-y-6 animate-fade-in">
              <div className="bg-primary/5 rounded-lg border border-primary/10 p-4 flex gap-3 items-start">
                <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5 animate-pulse" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-foreground">Playground de Testes de IA</h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Escreva cenários reais ou objeções de clientes para testar como o cérebro da IA responderá. Veja em tempo real a postura emocional mapeada, objeções identificadas e a resposta do closer!
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left: Input Scenario */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                      👤 Lead de Teste (Carrega Histórico e Perfil)
                    </Label>
                    <div className="flex gap-2">
                      <Select value={testPhone} onValueChange={setTestPhone}>
                        <SelectTrigger className="bg-secondary/20 border-border/30 text-xs h-9.5 flex-1">
                          <SelectValue placeholder="Selecione um lead de teste" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[200px]">
                          {leads.map(l => (
                            <SelectItem key={l.id} value={l.phone} className="text-xs">
                              {l.nome || "Lead Sem Nome"} ({l.phone})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={testPhone}
                        onChange={e => setTestPhone(e.target.value)}
                        placeholder="Número de teste"
                        className="text-xs bg-secondary/20 border-border/30 h-9.5 w-32 font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground">Mensagem Simulada do Lead</Label>
                    <Textarea
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      placeholder="Ex: 'Seu produto tá muito caro, no concorrente eu vi por metade do preço...'"
                      className="min-h-[140px] text-xs bg-secondary/20 border-border/30 resize-none leading-relaxed p-3.5 focus:border-primary/50"
                    />
                  </div>

                  {/* Suggestion Chips */}
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground font-semibold">Mensagens de Teste Rápidas:</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: "💰 Tá muito caro", text: "Achei o seu produto muito caro, no concorrente está mais barato, não tem desconto?" },
                        { label: "⏱️ Não tenho tempo", text: "Gostei muito da proposta, mas estou sem tempo agora para focar nisso." },
                        { label: "🤝 Quero comprar!", text: "Perfeito! Gostei muito das condições, como eu faço para realizar o pagamento?" },
                        { label: "🤔 Como funciona?", text: "Pode me explicar detalhadamente como funciona o suporte e qual a garantia?" },
                        { label: "⚡ Preciso urgente", text: "Eu preciso resolver isso hoje mesmo, vocês conseguem me entregar a ferramenta rápido?" },
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            setTestMessage(item.text);
                            toast.info(`Preenchido: "${item.label}"`);
                          }}
                          className="text-[10px] bg-secondary/30 hover:bg-secondary/60 border border-border/40 hover:border-border/60 text-muted-foreground hover:text-foreground px-2 py-1.5 rounded transition-all font-medium"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Test Image URL field */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                      📷 URL da Imagem de Teste (opcional)
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={testImageUrl}
                        onChange={(e) => setTestImageUrl(e.target.value)}
                        placeholder="https://exemplo.com/comprovante-pix.jpg"
                        className="text-xs bg-secondary/20 border-border/30 h-9.5 flex-1"
                      />
                      {testImageUrl && (
                        <Button 
                          type="button"
                          variant="ghost" 
                          size="sm" 
                          className="h-9.5 text-[10px] text-destructive hover:bg-destructive/10" 
                          onClick={() => setTestImageUrl("")}
                        >
                          Limpar
                        </Button>
                      )}
                    </div>
                    {testImageUrl && (
                      <div className="mt-2 p-1.5 rounded-lg border border-border/30 bg-slate-950/40 w-fit">
                        <img 
                          src={testImageUrl} 
                          className="max-h-[80px] rounded object-contain" 
                          alt="Preview da imagem" 
                          onError={() => {
                            toast.error("URL de imagem inválida ou inacessível");
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <Button
                    type="button"
                    onClick={handleSimulate}
                    disabled={simulating}
                    className="w-full h-10 shadow gap-2 text-xs font-semibold bg-primary hover:bg-primary/95 text-primary-foreground"
                  >
                    {simulating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Simulando pensamentos da IA...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Simular Resposta de IA
                      </>
                    )}
                  </Button>
                </div>

                {/* Right: Simulation results */}
                <div className="lg:col-span-7 space-y-4">
                  {simulating ? (
                    <div className="p-6 rounded-xl border border-primary/20 bg-slate-950/80 backdrop-blur-md space-y-6 shadow-inner min-h-[380px] flex flex-col justify-center select-none">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="relative">
                          <div className="w-14 h-14 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                          <Brain className="h-6 w-6 text-primary absolute left-4 top-4 animate-pulse" />
                        </div>
                        <div className="text-center">
                          <h4 className="text-sm font-bold text-foreground">Cérebro da IA Ativo</h4>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Calculando rota ideal de conversão...</p>
                        </div>
                      </div>

                      {/* Animated Terminal Thought Cascader */}
                      <div className="border border-border/40 bg-slate-900/60 p-4 rounded-xl space-y-3.5 font-mono text-[10px]">
                        <div className="flex items-center justify-between text-muted-foreground/80">
                          <span>PROCESSADOR IMPERIUS v4.2</span>
                          <span className="animate-pulse">● CALIBRANDO</span>
                        </div>
                        <div className="space-y-2 border-t border-border/20 pt-2">
                          <div className="flex items-center gap-2 text-primary">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
                            <span>[01/04] Analisando sentimento do lead... 🔍</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground/50">
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/20" />
                            <span>[02/04] Mapeando biblioteca de objeções... ⚠️</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground/50">
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/20" />
                            <span>[03/04] Ajustando tom de voz dinâmico... 🕯️</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground/50">
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/20" />
                            <span>[04/04] Redigindo resposta final... 🧠</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : simulationResult ? (
                    <div className="space-y-4 animate-fade-in select-text">
                      {/* Top Visual Indicators for Sentiment and Objection */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3 rounded-lg border border-border/30 bg-secondary/15 flex flex-col gap-1">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground">Sentimento do Lead</span>
                          <span className="text-sm font-bold text-amber-400">{simulationResult.detectedSentiment || "Cético"}</span>
                        </div>
                        <div className="p-3 rounded-lg border border-border/30 bg-secondary/15 flex flex-col gap-1">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground">Ajuste de Tom</span>
                          <span className="text-xs text-slate-300 truncate" title={simulationResult.detectedToneExplanation}>{simulationResult.detectedToneExplanation || "Tom direto"}</span>
                        </div>
                        <div className="p-3 rounded-lg border border-border/30 bg-secondary/15 flex flex-col gap-1">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground">Objeção Detectada</span>
                          <span className={`text-xs font-bold ${simulationResult.matchedObjection ? "text-violet-400" : "text-emerald-400"}`}>
                            {simulationResult.matchedObjection ? "Sim" : "Não"}
                          </span>
                        </div>
                      </div>

                      <Tabs defaultValue="visor" className="w-full mt-2">
                        <TabsList className="bg-background/40 border border-border/30 w-full flex gap-1 mb-4 h-auto p-1">
                          <TabsTrigger value="visor" className="text-xs flex-1 py-1.5">Visualizador</TabsTrigger>
                          <TabsTrigger value="rag" className="text-xs flex-1 py-1.5">RAG / Memórias</TabsTrigger>
                          <TabsTrigger value="prompt" className="text-xs flex-1 py-1.5">Prompt do Sistema</TabsTrigger>
                          <TabsTrigger value="objection" className="text-xs flex-1 py-1.5">Objeção Mapeada</TabsTrigger>
                        </TabsList>

                        {/* ── Sub-Tab 1: Visualizador ── */}
                        <TabsContent value="visor" className="space-y-4 mt-0">
                          {/* Mockup WhatsApp Balloon */}
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground select-none">Mensagem Simulada no WhatsApp</Label>
                            <div className="p-4 rounded-xl bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat min-h-[200px] flex flex-col gap-3 justify-end items-stretch border border-border/30 shadow-inner relative select-none">
                              <div className="absolute top-2 right-2 bg-emerald-500/10 text-emerald-400 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase tracking-wider select-none animate-pulse z-10">
                                Closer Live
                              </div>
                              
                              {/* Balão do Lead (Incoming - Left) */}
                              {(testMessage || testImageUrl) && (
                                <div className="self-start bg-[#202c33] text-[#e9edef] rounded-lg p-2.5 text-xs max-w-[80%] shadow border border-[#233138] select-text">
                                  {testImageUrl && (
                                    <div className="mb-1.5 max-w-full overflow-hidden rounded bg-black/20">
                                      <img src={testImageUrl} className="max-w-full max-h-[140px] object-cover mx-auto" alt="Midia enviada" />
                                    </div>
                                  )}
                                  {testMessage && <div className="whitespace-pre-wrap">{testMessage}</div>}
                                  <div className="text-[8px] text-muted-foreground/60 text-right mt-1 font-sans">
                                    {new Date().toLocaleTimeString().slice(0, 5)}
                                  </div>
                                </div>
                              )}

                              {/* Balão do Closer AI (Outgoing - Right) */}
                              <div className="self-end bg-[#005c4b] text-[#e9edef] rounded-lg p-3 text-xs max-w-[80%] shadow-md leading-relaxed border border-[#025142] select-text">
                                <div className="whitespace-pre-wrap">{simulationResult.replyText}</div>
                                <div className="text-[9px] text-muted-foreground/60 text-right mt-1.5 font-sans leading-none flex items-center justify-end gap-1">
                                  <span>{new Date().toLocaleTimeString().slice(0, 5)}</span>
                                  <span className="text-[#53bdeb] text-[12px]">✓✓</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Utility buttons */}
                          <div className="flex justify-end gap-2 select-none">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs gap-1.5 border-border/40 hover:bg-secondary/40"
                              onClick={() => copyToClipboard(simulationResult.replyText)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Copiar Resposta
                            </Button>
                          </div>
                        </TabsContent>

                        {/* ── Sub-Tab 2: RAG / Memórias ── */}
                        <TabsContent value="rag" className="space-y-3 mt-0">
                          {simulationResult.vectorMemories && simulationResult.vectorMemories.length > 0 ? (
                            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                              {simulationResult.vectorMemories.map((m: any, idx: number) => (
                                <div key={idx} className="p-3 rounded-lg border border-border/30 bg-secondary/15 flex flex-col gap-1.5">
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-primary flex items-center gap-1">
                                      <Brain className="h-3 w-3" />
                                      {m.type === "knowledge" ? "Conhecimento Base" : "Memória do Lead"}
                                    </span>
                                    <Badge variant="secondary" className="text-[9px] font-mono px-1.5 py-0">
                                      Sim: {(m.similarity * 100).toFixed(1)}%
                                    </Badge>
                                  </div>
                                  <div className="text-xs font-semibold text-foreground">{m.title}</div>
                                  <p className="text-[11px] text-muted-foreground leading-normal whitespace-pre-wrap">{m.content}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-6 text-center border border-dashed border-border/20 rounded-lg bg-secondary/5">
                              <p className="text-xs text-muted-foreground italic">Nenhuma memória vetorial recuperada para esta mensagem.</p>
                            </div>
                          )}
                        </TabsContent>

                        {/* ── Sub-Tab 3: Prompt do Sistema ── */}
                        <TabsContent value="prompt" className="space-y-3 mt-0">
                          <div className="space-y-2">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-muted-foreground">Prompt do sistema final injetado no LLM:</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[10px] gap-1 hover:bg-secondary"
                                onClick={() => copyToClipboard(simulationResult.systemPrompt)}
                              >
                                <Copy className="h-3 w-3" /> Copiar Prompt
                              </Button>
                            </div>
                            <Textarea
                              readOnly
                              value={simulationResult.systemPrompt || ""}
                              className="h-[260px] font-mono text-[10px] bg-slate-950 text-slate-300 border-border/40 p-3 leading-relaxed focus:ring-0 resize-none"
                            />
                          </div>
                        </TabsContent>

                        {/* ── Sub-Tab 4: Objeção Mapeada ── */}
                        <TabsContent value="objection" className="space-y-3 mt-0">
                          {simulationResult.matchedObjection ? (
                            <div className="p-4 rounded-lg border border-violet-500/30 bg-violet-500/5 space-y-3">
                              <div className="flex justify-between items-center">
                                <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 font-bold text-[10px] uppercase">
                                  Objeção Detectada (Cos Sim &gt;= 0.75)
                                </Badge>
                                <Badge variant="outline" className="text-[10px] border-violet-500/40 text-violet-400 font-mono">
                                  Similaridade: {(simulationResult.matchedObjection.similarity * 100).toFixed(1)}%
                                </Badge>
                              </div>
                              <div className="space-y-1">
                                <div className="text-xs font-bold text-foreground">Objeção Cadastrada:</div>
                                <div className="p-2.5 rounded bg-slate-900 border border-border/40 text-xs italic text-slate-300">
                                  "{simulationResult.matchedObjection.objecao}"
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-xs font-bold text-emerald-400">Resposta Comercial Calibrada (Mandatória):</div>
                                <div className="p-2.5 rounded bg-slate-900 border border-emerald-500/20 text-xs text-emerald-300 leading-normal">
                                  "{simulationResult.matchedObjection.resposta_padrao}"
                                </div>
                              </div>
                              <p className="text-[10px] text-muted-foreground leading-normal italic">
                                A IA foi instruída a usar prioritariamente essa resposta calibrada para quebrar a objeção, mitigando desvios do roteiro.
                              </p>
                            </div>
                          ) : (
                            <div className="p-6 text-center border border-dashed border-border/20 rounded-lg bg-secondary/5">
                              <p className="text-xs text-muted-foreground italic">Nenhuma objeção cadastrada foi detectada acima do limiar semântico de 0.75.</p>
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>
                    </div>
                  ) : (
                    <div className="p-8 border border-dashed border-border/40 rounded-lg bg-secondary/5 flex flex-col items-center justify-center text-center space-y-4 min-h-[380px] select-none">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <Sparkles className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-foreground">Aguardando Mensagem para Simulação</h4>
                        <p className="text-[10px] text-muted-foreground max-w-xs leading-normal">
                          Selecione um lead de teste, escolha um cenário rápido ou digite um texto para rodar a auditoria em tempo real.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

          </div>
        </Tabs>

        {/* Global Save Button at bottom of card */}
        <div className="border-t border-border/30 bg-secondary/10 px-5 py-4 flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="gap-2 px-6 h-10 shadow" size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Todas as Configurações
          </Button>
        </div>
      </CardContent>

      <RefineAIDialog open={refineOpen} onOpenChange={setRefineOpen} projectId={projectId} />
    </Card>
  );
}

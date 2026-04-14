import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, Loader2, Mail, MessageCircle, Video, Megaphone, Copy, Check, RefreshCw, FileText, ShoppingCart, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";

const CONTENT_TYPES = [
  { id: "recovery_email", label: "Email de Recuperação", icon: Mail, desc: "Carrinho abandonado, PIX pendente, boleto", color: "text-blue-400" },
  { id: "ad_copy", label: "Copy de Anúncio", icon: Megaphone, desc: "Facebook/Instagram Ads com variações A/B", color: "text-orange-400" },
  { id: "video_script", label: "Roteiro de Vídeo", icon: Video, desc: "Reels, TikTok, Stories, YouTube Shorts", color: "text-pink-400" },
  { id: "whatsapp_sequence", label: "Sequência WhatsApp", icon: MessageCircle, desc: "Follow-up, recuperação, nurturing", color: "text-green-400" },
  { id: "email_sequence", label: "Sequência de Emails", icon: FileText, desc: "Onboarding, lançamento, nutrição", color: "text-purple-400" },
  { id: "sales_page_blocks", label: "Blocos de Página", icon: ShoppingCart, desc: "Headlines, CTAs, bullet points, provas", color: "text-yellow-400" },
];

const TRIGGERS = [
  { id: "carrinho_abandonado", label: "Carrinho Abandonado" },
  { id: "pix_pendente", label: "PIX Pendente" },
  { id: "boleto_pendente", label: "Boleto Pendente" },
  { id: "lead_novo", label: "Lead Novo" },
  { id: "compra_aprovada", label: "Pós-Compra" },
  { id: "reengajamento", label: "Reengajamento" },
  { id: "lancamento", label: "Lançamento" },
];

export function ContentGenerator() {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [contentType, setContentType] = useState("recovery_email");
  const [trigger, setTrigger] = useState("carrinho_abandonado");
  const [customPrompt, setCustomPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<{ type: string; content: string; timestamp: number }[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
    supabase.from("imphq_projects").select("id, name, icon").then(({ data }) => {
      if (data) setProjects(data);
      if (data?.length && !selectedProject) setSelectedProject(data[0].id);
    });
  }, []);

  const handleGenerate = async () => {
    if (!selectedProject) { toast.error("Selecione um projeto"); return; }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("openflow-ai", {
        body: {
          project_id: selectedProject,
          action: "generate_content_pack",
          content_type: contentType,
          trigger,
          custom_prompt: customPrompt,
          model: "google/gemini-3-flash-preview",
        },
      });
      if (error) throw error;
      const content = data?.result || data?.text || JSON.stringify(data);
      setResults(prev => [{ type: contentType, content, timestamp: Date.now() }, ...prev]);
      toast.success("Conteúdo gerado com sucesso!");
    } catch (err: any) {
      if (err?.message?.includes("429")) toast.error("Rate limit. Tente em alguns segundos.");
      else if (err?.message?.includes("402")) toast.error("Créditos insuficientes.");
      else toast.error(err.message || "Erro ao gerar conteúdo");
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    toast.success("Copiado!");
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const selectedType = CONTENT_TYPES.find(t => t.id === contentType);

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Zap className="h-5 w-5 text-primary" />
          Gerador de Conteúdo com IA
          <Badge variant="secondary" className="text-[10px]">Fase 2</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="generate" className="space-y-4">
          <TabsList className="grid grid-cols-2 w-full max-w-xs">
            <TabsTrigger value="generate">Gerar</TabsTrigger>
            <TabsTrigger value="history">Histórico ({results.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-4">
            {/* Project selector */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Projeto</label>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.icon || "📁"} {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Gatilho / Contexto</label>
                <Select value={trigger} onValueChange={setTrigger}>
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGERS.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Modelo</label>
                <Select defaultValue="google/gemini-3-flash-preview" disabled>
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google/gemini-3-flash-preview">⚡ Gemini 3 Flash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Content type grid */}
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Tipo de Conteúdo</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {CONTENT_TYPES.map(ct => {
                  const Icon = ct.icon;
                  const isActive = contentType === ct.id;
                  return (
                    <button
                      key={ct.id}
                      onClick={() => setContentType(ct.id)}
                      className={`flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-all ${
                        isActive
                          ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                          : "border-border/50 bg-secondary/30 hover:bg-secondary/60"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${ct.color}`} />
                        <span className="text-xs font-medium">{ct.label}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground leading-tight">{ct.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom prompt */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Instruções extras (opcional)</label>
              <Textarea
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                placeholder="Ex: Foque em urgência para quem abandonou o checkout há 2h. Tom informal e direto."
                className="min-h-[60px] bg-secondary/30 text-sm"
              />
            </div>

            {/* Generate button */}
            <Button onClick={handleGenerate} disabled={generating} className="w-full gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? "Gerando conteúdo..." : `Gerar ${selectedType?.label || "Conteúdo"}`}
            </Button>

            {/* Context info */}
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-[9px]">📋 Briefing</Badge>
              <Badge variant="outline" className="text-[9px]">👤 Avatar</Badge>
              <Badge variant="outline" className="text-[9px]">🎨 Branding</Badge>
              <Badge variant="outline" className="text-[9px]">📊 KPIs Reais</Badge>
              <Badge variant="outline" className="text-[9px]">🗡️ Copy Arsenal</Badge>
              <Badge variant="outline" className="text-[9px]">💰 Dados de Vendas</Badge>
            </div>
          </TabsContent>

          <TabsContent value="history">
            {results.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum conteúdo gerado ainda. Use a aba "Gerar" para começar.
              </p>
            ) : (
              <ScrollArea className="max-h-[500px]">
                <div className="space-y-3">
                  {results.map((r, idx) => {
                    const typeInfo = CONTENT_TYPES.find(t => t.id === r.type);
                    const Icon = typeInfo?.icon || FileText;
                    return (
                      <Card key={r.timestamp} className="border-border/30 bg-secondary/20">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Icon className={`h-3.5 w-3.5 ${typeInfo?.color || ""}`} />
                              <span className="text-xs font-medium">{typeInfo?.label}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(r.timestamp).toLocaleTimeString("pt-BR")}
                              </span>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => copyToClipboard(r.content, idx)}
                              >
                                {copiedIdx === idx ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => {
                                  setContentType(r.type);
                                  handleGenerate();
                                }}
                              >
                                <RefreshCw className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="prose prose-sm prose-invert max-w-none text-xs leading-relaxed">
                            <ReactMarkdown>{r.content}</ReactMarkdown>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Calendar, Video, Image, FileText, Megaphone, Copy, Download, Loader2, Trash2, Save, Sparkles, Code2
} from "lucide-react";

interface Props {
  projectId: string;
  project: any;
  onUpdateData: (data: any) => void;
}

type ContentType = "semanal" | "ads_imagem" | "ads_video" | "vsl" | "webinar" | "lp";

const CONTENT_TYPES: { value: ContentType; label: string; icon: any; desc: string }[] = [
  { value: "semanal", label: "Conteúdo Semanal", icon: Calendar, desc: "Posts e stories para a semana" },
  { value: "ads_imagem", label: "Ads — Imagem", icon: Image, desc: "Copy para criativos estáticos" },
  { value: "ads_video", label: "Ads — Vídeo", icon: Video, desc: "Roteiros para vídeo ads" },
  { value: "vsl", label: "Roteiro VSL", icon: Video, desc: "Video Sales Letter completo" },
  { value: "webinar", label: "Roteiro Webinário", icon: Megaphone, desc: "Webinar persuasivo" },
  { value: "lp", label: "LP de Vendas (HTML)", icon: Code2, desc: "Landing page HTML exportável" },
];

export function ProjetoCentralConteudo({ projectId, project, onUpdateData }: Props) {
  const data = project.data || {};
  const [activeType, setActiveType] = useState<ContentType>("semanal");
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const [savedItems, setSavedItems] = useState<any[]>(data.central_conteudos || []);
  const [customPrompt, setCustomPrompt] = useState("");
  const [lpTopic, setLpTopic] = useState("");

  const getContextSummary = () => {
    const avatar = project.avatar || {};
    const expert = data.expert || {};
    const produtos = data.produtos || [];
    const arsenal = data.copy_arsenal || {};
    const branding = project.brand_kit || {};
    return { projeto: project.name, expert, avatar, produtos, arsenal, branding };
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGeneratedContent("");
    try {
      const ctx = getContextSummary();
      const prompts: Record<ContentType, string> = {
        semanal: `Crie um planejamento de conteúdo para 7 dias (seg a dom) para "${ctx.projeto}". Inclua: tema, copy curta, CTA e formato (carrossel, reels, stories). Dores: ${JSON.stringify((ctx.avatar.dores || []).slice(0, 5))}. Desejos: ${JSON.stringify((ctx.avatar.desejos || []).slice(0, 5))}. Tom: ${ctx.expert.tom_voz || "profissional"}. Promessa: "${ctx.arsenal.promessa || ""}".`,
        ads_imagem: `Crie 5 variações de copy para anúncios estáticos do produto "${ctx.produtos[0]?.nome || ctx.projeto}". Cada: headline (max 40 chars), body (max 125 chars), CTA. Dores: ${JSON.stringify((ctx.avatar.dores || []).slice(0, 5))}. Gatilhos: ${JSON.stringify((ctx.avatar.gatilhos || []).slice(0, 5))}.`,
        ads_video: `Crie 3 roteiros de vídeo ads (30-60s) para "${ctx.produtos[0]?.nome || ctx.projeto}". Formatos: 1) Hook+Problema+Solução+CTA, 2) UGC storytelling, 3) Antes/depois. Dores: ${JSON.stringify((ctx.avatar.dores || []).slice(0, 3))}. Promessa: "${ctx.arsenal.promessa || ""}".`,
        vsl: `Roteiro completo de VSL para "${ctx.produtos[0]?.nome || ctx.projeto}". Blocos: Hook, Problema, Agitação, Mecanismo, Prova social, Oferta, Garantia, CTA. Avatar: ${JSON.stringify(ctx.avatar.perfil || {})}. Arsenal: ${JSON.stringify(ctx.arsenal)}. Produto: ${JSON.stringify(ctx.produtos[0] || {})}.`,
        webinar: `Estrutura completa de webinário para "${ctx.produtos[0]?.nome || ctx.projeto}". Blocos: Abertura+promessa, Credenciais, 3 blocos educacionais, Transição, Oferta+bônus, Garantia, FAQ, Escassez+CTA. Expert: ${JSON.stringify(ctx.expert)}. Arsenal: ${JSON.stringify(ctx.arsenal)}.`,
        lp: `Gere código HTML completo de LP de vendas para "${ctx.produtos[0]?.nome || ctx.projeto}". ${lpTopic ? `Foco: ${lpTopic}.` : ""} Responsiva e persuasiva. Seções: Hero, Problema, Solução, Benefícios, Prova Social, Oferta, Garantia, FAQ, CTA final. Cores: ${JSON.stringify(ctx.branding.cores || {})}. Promessa: "${ctx.arsenal.promessa || ""}". Dores: ${JSON.stringify((ctx.avatar.dores || []).slice(0, 5))}. Retorne APENAS HTML completo com CSS inline.`,
      };

      const finalPrompt = customPrompt ? `${prompts[activeType]}\n\nInstruções extras: ${customPrompt}` : prompts[activeType];

      const { data: aiData, error } = await supabase.functions.invoke("openflow-ai", {
        body: { prompt: finalPrompt, project_id: projectId, action: `generate_${activeType}` },
      });
      if (error) throw error;
      setGeneratedContent(aiData?.result || aiData?.text || aiData?.content || JSON.stringify(aiData));
      toast.success("Conteúdo gerado!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = () => {
    if (!generatedContent.trim()) return;
    const item = { id: crypto.randomUUID(), type: activeType, content: generatedContent, created_at: new Date().toISOString() };
    const updated = [...savedItems, item];
    setSavedItems(updated);
    onUpdateData({ ...data, central_conteudos: updated });
    toast.success("Salvo!");
  };

  const handleDelete = (itemId: string) => {
    const updated = savedItems.filter((i) => i.id !== itemId);
    setSavedItems(updated);
    onUpdateData({ ...data, central_conteudos: updated });
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

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Central de Conteúdo IA
          </CardTitle>
          <p className="text-xs text-muted-foreground">Geração contextual usando Avatar, Expert, Arsenal de Copy e Produto</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CONTENT_TYPES.map((ct) => (
              <button key={ct.value} onClick={() => setActiveType(ct.value)}
                className={`p-3 rounded-lg border text-left transition-all ${activeType === ct.value ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/50 hover:border-primary/40"}`}>
                <ct.icon className="h-4 w-4 mb-1" />
                <p className="text-xs font-medium">{ct.label}</p>
                <p className="text-[10px] text-muted-foreground">{ct.desc}</p>
              </button>
            ))}
          </div>

          {activeType === "lp" && (
            <div>
              <Label className="text-xs">Foco / Tema da LP (opcional)</Label>
              <Input value={lpTopic} onChange={(e) => setLpTopic(e.target.value)} placeholder="Ex: Black Friday, Lançamento..." className="bg-secondary" />
            </div>
          )}

          <div>
            <Label className="text-xs">Instruções adicionais (opcional)</Label>
            <Textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} placeholder="Ex: Tom informal, incluir emojis..." className="bg-secondary text-xs min-h-[60px]" />
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleGenerate} disabled={generating} className="gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? "Gerando..." : "Gerar com IA"}
            </Button>
            <Badge variant="outline" className="text-[10px]">Contexto: Avatar + Expert + Arsenal + Produtos</Badge>
          </div>

          {generatedContent && (
            <Card className="bg-secondary/50 border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Badge className="text-[10px]">{CONTENT_TYPES.find((c) => c.value === activeType)?.label}</Badge>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => handleCopy(generatedContent)} className="h-7 gap-1 text-xs"><Copy className="h-3 w-3" /> Copiar</Button>
                    {activeType === "lp" && <Button size="sm" variant="ghost" onClick={() => handleDownloadHTML(generatedContent)} className="h-7 gap-1 text-xs"><Download className="h-3 w-3" /> HTML</Button>}
                    <Button size="sm" variant="outline" onClick={handleSave} className="h-7 gap-1 text-xs"><Save className="h-3 w-3" /> Salvar</Button>
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
                  <pre className="whitespace-pre-wrap text-xs text-foreground font-sans leading-relaxed max-h-[500px] overflow-auto">{generatedContent}</pre>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {savedItems.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans flex items-center gap-2">
              <FileText className="h-4 w-4" /> Conteúdos Salvos ({savedItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {savedItems.map((item) => (
              <Card key={item.id} className="bg-secondary/50 border-border">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{CONTENT_TYPES.find((c) => c.value === item.type)?.label || item.type}</Badge>
                      <span className="text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleDateString("pt-BR")}</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleCopy(item.content)} className="h-6 w-6 p-0"><Copy className="h-3 w-3" /></Button>
                      {item.type === "lp" && <Button size="sm" variant="ghost" onClick={() => handleDownloadHTML(item.content)} className="h-6 w-6 p-0"><Download className="h-3 w-3" /></Button>}
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(item.id)} className="h-6 w-6 p-0 text-destructive"><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                  <pre className="whitespace-pre-wrap text-[10px] text-muted-foreground font-sans leading-relaxed max-h-[150px] overflow-auto">
                    {item.content.slice(0, 500)}{item.content.length > 500 ? "..." : ""}
                  </pre>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

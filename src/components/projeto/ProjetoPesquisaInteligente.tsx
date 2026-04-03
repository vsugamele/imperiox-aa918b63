import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, Loader2, Globe, ShoppingBag, UserCheck, Copy, Save, Trash2, ExternalLink, Brain
} from "lucide-react";

interface Props {
  projectId: string;
  project: any;
  onUpdateData: (data: any) => void;
}

interface ResearchResult {
  id: string;
  type: "concorrente" | "produto" | "expert";
  query: string;
  result: string;
  created_at: string;
  url?: string;
}

export function ProjetoPesquisaInteligente({ projectId, project, onUpdateData }: Props) {
  const data = project.data || {};
  const [tab, setTab] = useState<"concorrente" | "produto" | "expert">("concorrente");
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [savedResults, setSavedResults] = useState<ResearchResult[]>(data.pesquisa_inteligente || []);

  const getContextForPrompt = () => {
    const avatar = project.avatar || {};
    const expert = data.expert || {};
    const produtos = data.produtos || [];
    const arsenal = data.copy_arsenal || {};
    return { projeto: project.name, avatar, expert, produtos, arsenal };
  };

  const handleResearch = async () => {
    if (!query.trim() && !url.trim()) {
      toast.error("Preencha a busca ou URL");
      return;
    }
    setLoading(true);
    setResult("");

    try {
      const ctx = getContextForPrompt();
      const prompts: Record<string, string> = {
        concorrente: `Analise o concorrente "${query || url}" para o projeto "${ctx.projeto}". 
Extraia: 1) Posicionamento e promessa principal, 2) Público-alvo, 3) Pontos fortes e fracos, 4) Estrutura de oferta (preço, bônus, garantia), 5) Copy e gatilhos usados, 6) Canais de aquisição, 7) Oportunidades que podemos explorar. 
${url ? `URL para análise: ${url}` : ""}
Nosso avatar: ${JSON.stringify({ dores: (ctx.avatar.dores || []).slice(0, 3), desejos: (ctx.avatar.desejos || []).slice(0, 3) })}
Nossa promessa: "${ctx.arsenal.promessa || ""}"`,
        produto: `Pesquise sobre o produto/infoproduto "${query}". 
Extraia: 1) Tipo de produto (curso, mentoria, SaaS, etc), 2) Faixa de preço do mercado, 3) Estrutura de oferta comum (módulos, bônus, garantia), 4) Argumentos de venda mais usados, 5) Objeções comuns do público, 6) Diferenciais possíveis para nosso produto "${ctx.produtos[0]?.nome || ctx.projeto}". 
${url ? `URL: ${url}` : ""}`,
        expert: `Analise o expert/influenciador "${query || url}" do nicho. 
Extraia: 1) Nome e área de atuação, 2) Tom de voz e estilo de comunicação, 3) Frameworks e metodologias, 4) Temas recorrentes, 5) Promessas de transformação, 6) Estratégias de conteúdo, 7) Como podemos aplicar esses insights ao nosso expert "${ctx.expert.nome || ""}". 
${url ? `URL/perfil: ${url}` : ""}`,
      };

      // Try expert-research for URL-based, otherwise use openflow-ai
      if (url.trim()) {
        const { data: resData, error } = await supabase.functions.invoke("expert-research", {
          body: { url: url.trim(), project_id: projectId },
        });
        if (error) throw error;
        const extracted = resData?.extracted || resData;
        const formatted = typeof extracted === "string" ? extracted : JSON.stringify(extracted, null, 2);
        
        // Now analyze with AI
        const { data: aiData, error: aiError } = await supabase.functions.invoke("openflow-ai", {
          body: {
            prompt: `${prompts[tab]}\n\nDados extraídos da URL:\n${formatted}`,
            project_id: projectId,
            action: `research_${tab}`,
          },
        });
        if (aiError) throw aiError;
        setResult(aiData?.result || aiData?.text || aiData?.content || JSON.stringify(aiData));
      } else {
        const { data: aiData, error } = await supabase.functions.invoke("openflow-ai", {
          body: {
            prompt: prompts[tab],
            project_id: projectId,
            action: `research_${tab}`,
          },
        });
        if (error) throw error;
        setResult(aiData?.result || aiData?.text || aiData?.content || JSON.stringify(aiData));
      }
      toast.success("Pesquisa concluída!");
    } catch (err: any) {
      toast.error(err.message || "Erro na pesquisa");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!result.trim()) return;
    const item: ResearchResult = {
      id: crypto.randomUUID(),
      type: tab,
      query: query || url,
      result,
      url: url || undefined,
      created_at: new Date().toISOString(),
    };
    const updated = [...savedResults, item];
    setSavedResults(updated);
    onUpdateData({ ...data, pesquisa_inteligente: updated });
    toast.success("Pesquisa salva!");
  };

  const handleDelete = (id: string) => {
    const updated = savedResults.filter((r) => r.id !== id);
    setSavedResults(updated);
    onUpdateData({ ...data, pesquisa_inteligente: updated });
  };

  const typeConfig = {
    concorrente: { icon: Globe, color: "text-red-400", label: "Concorrentes" },
    produto: { icon: ShoppingBag, color: "text-emerald-400", label: "Produtos" },
    expert: { icon: UserCheck, color: "text-violet-400", label: "Expert / Influenciador" },
  };

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans flex items-center gap-2">
            <Brain className="h-4 w-4" /> Pesquisa Inteligente
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Pesquise concorrentes, produtos do mercado e experts para embasar suas criações com dados reais
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Type tabs */}
          <div className="grid grid-cols-3 gap-2">
            {(["concorrente", "produto", "expert"] as const).map((t) => {
              const cfg = typeConfig[t];
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    tab === t
                      ? "border-primary bg-primary/10"
                      : "border-border bg-secondary/50 hover:border-primary/40"
                  }`}
                >
                  <cfg.icon className={`h-4 w-4 mb-1 ${cfg.color}`} />
                  <p className="text-xs font-medium">{cfg.label}</p>
                </button>
              );
            })}
          </div>

          {/* Search inputs */}
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Busca / Nome</Label>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  tab === "concorrente" ? "Ex: Érico Rocha, Fórmula de Lançamento..."
                    : tab === "produto" ? "Ex: Curso de tráfego pago, mentoria de vendas..."
                    : "Ex: Pedro Sobral, Leandro Ladeira..."
                }
                className="bg-secondary"
              />
            </div>
            <div>
              <Label className="text-xs">URL para análise (opcional)</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://site-do-concorrente.com ou perfil do expert"
                className="bg-secondary"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                {tab === "concorrente" ? "Cole a URL da página de vendas, site ou perfil social" :
                 tab === "expert" ? "Cole o canal YouTube, Instagram ou site pessoal" :
                 "Cole a URL da página de vendas do produto"}
              </p>
            </div>
          </div>

          <Button onClick={handleResearch} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {loading ? "Pesquisando..." : "Pesquisar com IA"}
          </Button>

          {/* Result */}
          {result && (
            <Card className="bg-secondary/50 border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px]">{typeConfig[tab].label}</Badge>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(result); toast.success("Copiado!"); }} className="h-7 gap-1 text-xs">
                      <Copy className="h-3 w-3" /> Copiar
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleSave} className="h-7 gap-1 text-xs">
                      <Save className="h-3 w-3" /> Salvar
                    </Button>
                  </div>
                </div>
                <pre className="whitespace-pre-wrap text-xs text-foreground font-sans leading-relaxed max-h-[500px] overflow-auto">
                  {result}
                </pre>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Saved results */}
      {savedResults.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">
              📚 Pesquisas Salvas ({savedResults.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {savedResults.map((item) => {
              const cfg = typeConfig[item.type];
              return (
                <Card key={item.id} className="bg-secondary/50 border-border">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <cfg.icon className={`h-3 w-3 ${cfg.color}`} />
                        <Badge variant="outline" className="text-[10px]">{cfg.label}</Badge>
                        <span className="text-[10px] text-muted-foreground">{item.query}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {item.url && (
                          <a href={item.url} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </a>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(item.result); toast.success("Copiado!"); }} className="h-6 w-6 p-0">
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(item.id)} className="h-6 w-6 p-0 text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <pre className="whitespace-pre-wrap text-[10px] text-muted-foreground font-sans leading-relaxed max-h-[150px] overflow-auto">
                      {item.result.slice(0, 500)}{item.result.length > 500 ? "..." : ""}
                    </pre>
                  </CardContent>
                </Card>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

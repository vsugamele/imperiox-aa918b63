import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, Loader2, Zap, Filter, Library } from "lucide-react";
import { CONTENT_TYPES, TRIGGERS, FUNNEL_STAGES, type GeneratedItem, type StatusKey } from "./contentGenerator/constants";
import { ResultCard } from "./contentGenerator/ResultCard";

// Ângulos psicológicos para variações em lote — cada variação ataca por um ângulo distinto.
const ANGLES = [
  { key: "medo", label: "Medo / Perda", brief: "Foque no medo de perder algo, na consequência negativa de não agir agora." },
  { key: "curiosidade", label: "Curiosidade / Segredo", brief: "Abra um loop de curiosidade. Insinue um segredo, um método pouco conhecido." },
  { key: "prova", label: "Prova Social", brief: "Use case real, depoimento, número específico, autoridade externa." },
  { key: "autoridade", label: "Autoridade / Mecanismo", brief: "Posicione expertise, mecanismo único, explicação técnica que gera confiança." },
  { key: "urgencia", label: "Urgência / Escassez", brief: "Janela de tempo, vagas limitadas, motivo concreto para agir hoje." },
];

export function ContentGenerator() {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [contentType, setContentType] = useState("recovery_email");
  const [trigger, setTrigger] = useState("carrinho_abandonado");
  const [funnelStage, setFunnelStage] = useState("fundo");
  const [customPrompt, setCustomPrompt] = useState("");
  const [batchMode, setBatchMode] = useState(false);
  const [batchCount, setBatchCount] = useState(3);
  const [swipes, setSwipes] = useState<any[]>([]);
  const [inspirationSwipeId, setInspirationSwipeId] = useState<string>("none");
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<GeneratedItem[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [expandingClusterId, setExpandingClusterId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("imphq_projects").select("id, name, icon").then(({ data }) => {
      if (data) setProjects(data);
      if (data?.length && !selectedProject) setSelectedProject(data[0].id);
    });
    loadHistory();
    loadSwipes();
  }, []);

  const loadSwipes = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return;
    const { data } = await supabase
      .from("imphq_swipes")
      .select("id, title, criador, mecanismo, nicho, blocks, reverse_engineering")
      .eq("user_id", u.user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setSwipes(data);
  };

  const loadHistory = async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user?.user) return;
    const { data } = await supabase
      .from("imphq_generated_contents")
      .select("id, content_type, content, product_name, created_at, project_id, status, funnel_stage, variation_group, cluster_id, cluster_role")
      .eq("user_id", user.user.id)
      .order("created_at", { ascending: false })
      .limit(80);
    if (data) {
      setResults(data.map((d: any) => ({
        id: d.id,
        type: d.content_type,
        content: d.content,
        timestamp: new Date(d.created_at).getTime(),
        project_name: d.product_name || d.project_id,
        status: (d.status || "rascunho") as StatusKey,
        funnel_stage: d.funnel_stage,
        variation_group: d.variation_group,
        cluster_id: d.cluster_id,
        cluster_role: d.cluster_role,
      })));
    }
  };

  const generateOne = async (variationGroup?: string, variationLabel?: string) => {
    const { data, error } = await supabase.functions.invoke("openflow-ai", {
      body: {
        project_id: selectedProject,
        action: "generate_content_pack",
        content_type: contentType,
        trigger,
        funnel_stage: funnelStage,
        custom_prompt: variationLabel ? `${customPrompt}\n\n[Variação ${variationLabel} — use ângulo/abordagem distinta das demais]` : customPrompt,
        model: "google/gemini-3-flash-preview",
      },
    });
    if (error) throw error;
    const content = data?.result || data?.text || JSON.stringify(data);
    const { data: userData } = await supabase.auth.getUser();
    let savedId: string | undefined;
    if (userData?.user) {
      const projName = projects.find(p => p.id === selectedProject)?.name || "";
      const { data: inserted } = await supabase.from("imphq_generated_contents").insert({
        project_id: selectedProject,
        user_id: userData.user.id,
        content_type: contentType,
        content,
        product_name: projName,
        model_used: "google/gemini-3-flash-preview",
        status: "rascunho",
        funnel_stage: funnelStage,
        variation_group: variationGroup || null,
        metadata: { trigger, custom_prompt: customPrompt, variation_label: variationLabel },
      }).select("id").single();
      savedId = inserted?.id;
    }
    return { id: savedId, content };
  };

  const handleGenerate = async () => {
    if (!selectedProject) { toast.error("Selecione um projeto"); return; }
    setGenerating(true);
    try {
      if (batchMode) {
        const groupId = crypto.randomUUID();
        const newItems: GeneratedItem[] = [];
        for (let i = 0; i < batchCount; i++) {
          const label = String.fromCharCode(65 + i); // A, B, C
          const r = await generateOne(groupId, label);
          newItems.push({
            id: r.id, type: contentType, content: r.content, timestamp: Date.now() + i,
            status: "rascunho", funnel_stage: funnelStage, variation_group: groupId,
          });
        }
        setResults(prev => [...newItems, ...prev]);
        toast.success(`${batchCount} variações geradas!`);
      } else {
        const r = await generateOne();
        setResults(prev => [{
          id: r.id, type: contentType, content: r.content, timestamp: Date.now(),
          status: "rascunho", funnel_stage: funnelStage,
        }, ...prev]);
        toast.success("Conteúdo gerado!");
      }
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

  const saveToDocs = async (content: string, type: string) => {
    if (!selectedProject) return;
    const typeLabel = CONTENT_TYPES.find(t => t.id === type)?.label || type;
    const { error } = await supabase.from("imphq_docs").insert({
      id: crypto.randomUUID(),
      project_id: selectedProject,
      title: `[IA] ${typeLabel} — ${new Date().toLocaleDateString("pt-BR")}`,
      content, body: content, cat: "ia-gerado", tags: [type, "ia", trigger],
    });
    if (error) toast.error("Erro: " + error.message);
    else toast.success(`Salvo em Docs do projeto!`);
  };

  const saveToCopyArsenal = async (content: string) => {
    if (!selectedProject) return;
    const { data: project } = await supabase.from("imphq_projects").select("data").eq("id", selectedProject).single();
    const data = (project?.data as any) || {};
    const produtos = data.produtos || [];
    if (produtos.length === 0) { toast.error("Crie um produto no projeto antes."); return; }
    const prod = produtos[0];
    const ca = prod.copy_arsenal || {};
    ca.headlines = [...(ca.headlines || []), { texto: content.slice(0, 500), origem: "ia-gerado", data: new Date().toISOString() }];
    produtos[0] = { ...prod, copy_arsenal: ca };
    const { error } = await supabase.from("imphq_projects").update({ data: { ...data, produtos } }).eq("id", selectedProject);
    if (error) toast.error("Erro: " + error.message);
    else toast.success(`Adicionado ao Copy Arsenal!`);
  };

  const changeStatus = async (id: string, status: StatusKey) => {
    const update: any = { status };
    if (status === "aprovado") {
      const { data: u } = await supabase.auth.getUser();
      update.approved_at = new Date().toISOString();
      update.approved_by = u?.user?.id;
    }
    const { error } = await supabase.from("imphq_generated_contents").update(update).eq("id", id);
    if (error) { toast.error("Erro: " + error.message); return; }
    setResults(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    toast.success(`Status: ${status}`);
  };

  const expandCluster = async (item: GeneratedItem) => {
    if (!selectedProject) return;
    const key = item.id || String(item.timestamp);
    setExpandingClusterId(key);
    try {
      const { data, error } = await supabase.functions.invoke("content-cluster", {
        body: {
          project_id: selectedProject,
          source_content_id: item.id,
          source_idea: item.content.slice(0, 2000),
          funnel_stage: item.funnel_stage,
        },
      });
      if (error) throw error;
      const newItems: GeneratedItem[] = (data?.items || []).map((it: any) => ({
        id: it.id,
        type: it.content_type,
        content: it.content,
        timestamp: Date.now(),
        status: (it.status || "rascunho") as StatusKey,
        cluster_id: it.cluster_id,
        cluster_role: it.cluster_role,
        funnel_stage: item.funnel_stage,
        source_idea: item.content.slice(0, 2000),
      }));
      setResults(prev => [...newItems, ...prev]);
      const failed = data?.failed_formats || [];
      if (failed.length) {
        toast.warning(
          `Cluster gerado com ${failed.length} formato(s) com erro: ${failed.map((f: any) => f.label).join(", ")}. Use "Tentar novamente" no card.`
        );
      } else {
        toast.success(`Cluster gerado: ${newItems.length} formatos derivados!`);
      }
    } catch (err: any) {
      toast.error("Erro ao expandir cluster: " + (err.message || "desconhecido"));
    } finally {
      setExpandingClusterId(null);
    }
  };

  const retryClusterFormat = async (item: GeneratedItem) => {
    if (!selectedProject || !item.cluster_id || !item.cluster_role) return;
    const key = item.id || String(item.timestamp);
    setExpandingClusterId(key);
    try {
      // Use source_idea if available; fall back to existing content (which is the error message)
      const sourceIdea = item.source_idea || item.content;
      const { data, error } = await supabase.functions.invoke("content-cluster", {
        body: {
          project_id: selectedProject,
          source_idea: sourceIdea,
          funnel_stage: item.funnel_stage,
          cluster_id: item.cluster_id,
          only_roles: [item.cluster_role],
        },
      });
      if (error) throw error;
      const fresh = (data?.items || [])[0];
      if (fresh) {
        // Replace failed item with the new one
        setResults(prev => prev.map(r =>
          r.id === item.id
            ? {
                ...r,
                id: fresh.id,
                content: fresh.content,
                status: (fresh.status || "rascunho") as StatusKey,
                timestamp: Date.now(),
              }
            : r
        ));
        if ((data?.failed_formats || []).length) {
          toast.error("Tentativa falhou novamente. Tente em alguns segundos.");
        } else {
          toast.success(`${item.cluster_role.replace(/_/g, " ")} regenerado!`);
        }
      }
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "desconhecido"));
    } finally {
      setExpandingClusterId(null);
    }
  };

  const selectedType = CONTENT_TYPES.find(t => t.id === contentType);
  const filteredResults = filterStatus === "todos" ? results : results.filter(r => (r.status || "rascunho") === filterStatus);

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Zap className="h-5 w-5 text-primary" />
          Gerador de Conteúdo com IA
          <Badge variant="secondary" className="text-[10px]">Fase 3 — Pipeline</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="generate" className="space-y-4">
          <TabsList className="grid grid-cols-2 w-full max-w-xs">
            <TabsTrigger value="generate">Gerar</TabsTrigger>
            <TabsTrigger value="history">Histórico ({results.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Projeto</label>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {projects.map(p => (<SelectItem key={p.id} value={p.id}>{p.icon || "📁"} {p.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Estágio do Funil</label>
                <Select value={funnelStage} onValueChange={setFunnelStage}>
                  <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FUNNEL_STAGES.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex flex-col"><span>{s.label}</span><span className="text-[10px] text-muted-foreground">{s.desc}</span></div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Gatilho / Contexto</label>
                <Select value={trigger} onValueChange={setTrigger}>
                  <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRIGGERS.map(t => (<SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Tipo de Conteúdo</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {CONTENT_TYPES.map(ct => {
                  const Icon = ct.icon;
                  const isActive = contentType === ct.id;
                  return (
                    <button key={ct.id} onClick={() => setContentType(ct.id)}
                      className={`flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-all ${isActive ? "border-primary bg-primary/10 ring-1 ring-primary/30" : "border-border/50 bg-secondary/30 hover:bg-secondary/60"}`}>
                      <div className="flex items-center gap-2"><Icon className={`h-4 w-4 ${ct.color}`} /><span className="text-xs font-medium">{ct.label}</span></div>
                      <span className="text-[10px] text-muted-foreground leading-tight">{ct.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Instruções extras (opcional)</label>
              <Textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)}
                placeholder="Ex: Foque em urgência. Tom informal e direto."
                className="min-h-[60px] bg-secondary/30 text-sm" />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
              <div className="flex items-center gap-3">
                <Switch id="batch-mode" checked={batchMode} onCheckedChange={setBatchMode} />
                <Label htmlFor="batch-mode" className="text-xs cursor-pointer">
                  🔀 Geração em Lote (variações A/B)
                </Label>
              </div>
              {batchMode && (
                <Select value={String(batchCount)} onValueChange={v => setBatchCount(Number(v))}>
                  <SelectTrigger className="w-32 bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 variações</SelectItem>
                    <SelectItem value="3">3 variações</SelectItem>
                    <SelectItem value="4">4 variações</SelectItem>
                    <SelectItem value="5">5 variações</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <Button onClick={handleGenerate} disabled={generating} className="w-full gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? (batchMode ? `Gerando ${batchCount} variações...` : "Gerando conteúdo...") : (batchMode ? `Gerar ${batchCount} variações de ${selectedType?.label}` : `Gerar ${selectedType?.label || "Conteúdo"}`)}
            </Button>

            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-[9px]">📋 Briefing</Badge>
              <Badge variant="outline" className="text-[9px]">👤 Avatar</Badge>
              <Badge variant="outline" className="text-[9px]">🎨 Branding</Badge>
              <Badge variant="outline" className="text-[9px]">📊 KPIs Reais</Badge>
              <Badge variant="outline" className="text-[9px]">🗡️ Copy Arsenal</Badge>
              <Badge variant="outline" className="text-[9px]">💰 Vendas</Badge>
              <Badge variant="outline" className="text-[9px]">🎯 Estágio Funil</Badge>
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-48 bg-secondary/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="rascunho">📝 Rascunho</SelectItem>
                  <SelectItem value="revisao">⏳ Em Revisão</SelectItem>
                  <SelectItem value="aprovado">✅ Aprovado</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">{filteredResults.length} item(s)</span>
            </div>
            {filteredResults.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum conteúdo encontrado para este filtro.
              </p>
            ) : (
              <ScrollArea className="max-h-[600px]">
                <div className="space-y-3">
                  {filteredResults.map((r, idx) => (
                    <ResultCard
                      key={r.id || r.timestamp}
                      item={r}
                      idx={idx}
                      copiedIdx={copiedIdx}
                      onCopy={copyToClipboard}
                      onRegen={(type) => { setContentType(type); handleGenerate(); }}
                      onSaveDocs={saveToDocs}
                      onSaveCopyArsenal={saveToCopyArsenal}
                      onChangeStatus={changeStatus}
                      onExpandCluster={expandCluster}
                      expandingClusterId={expandingClusterId}
                      onRetryClusterFormat={retryClusterFormat}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

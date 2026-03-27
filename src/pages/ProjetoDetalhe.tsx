import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { ProjetoBriefing } from "@/components/projeto/ProjetoBriefing";
import { ProjetoExpert } from "@/components/projeto/ProjetoExpert";
import { ProjetoAvatar } from "@/components/projeto/ProjetoAvatar";
import { ProjetoBranding } from "@/components/projeto/ProjetoBranding";
import { ProjetoKPIs } from "@/components/projeto/ProjetoKPIs";
import { ProjetoPesquisa } from "@/components/projeto/ProjetoPesquisa";
import { ProjetoMidia } from "@/components/projeto/ProjetoMidia";
import { ProjetoDocs } from "@/components/projeto/ProjetoDocs";
import { ConcorrentesTab } from "@/components/projeto/concorrentes/ConcorrentesTab";

import { ProjetoCalendario } from "@/components/projeto/ProjetoCalendario";
import { ProjetoEmails } from "@/components/projeto/ProjetoEmails";
import { ProjetoFinancas } from "@/components/projeto/ProjetoFinancas";
import { useAutoSave } from "@/components/projeto/useAutoSave";
import { Pencil, Copy, Check, ChevronDown, ExternalLink, TestTube2, CheckCircle2, XCircle, Download } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const PIPELINE_KEYS = ["avatar", "funil", "copy", "prompts", "design", "trafego"];

export default function ProjetoDetalhe() {
  const { id } = useParams();
  const [project, setProject] = useState<any>(null);
  const [editingName, setEditingName] = useState(false);
  const [editingIcon, setEditingIcon] = useState(false);
  const [editingCategory, setEditingCategory] = useState(false);
  const save = useAutoSave(id);

  useEffect(() => {
    supabase.from("imphq_projects").select("*").eq("id", id).single().then(({ data }) => setProject(data));
  }, [id]);

  const updateField = useCallback((field: string, value: any) => {
    setProject((prev: any) => ({ ...prev, [field]: value }));
    save(field, value);
  }, [save]);

  const onUpdateData = useCallback((data: any) => updateField("data", data), [updateField]);
  const onUpdatePipeline = useCallback((pipeline: any) => updateField("pipeline", pipeline), [updateField]);
  const onUpdateAvatar = useCallback((avatar: any) => updateField("avatar", avatar), [updateField]);
  const onUpdateBrandKit = useCallback((bk: any) => updateField("brand_kit", bk), [updateField]);

  if (!project) return <div className="text-muted-foreground p-8">Carregando...</div>;

  const pipeline = project.pipeline || {};
  const pipelineAvg = Math.round(
    PIPELINE_KEYS.reduce((sum, k) => sum + (pipeline[k] ?? 0), 0) / PIPELINE_KEYS.length
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {/* Editable Icon */}
          {editingIcon ? (
            <Input
              value={project.icon || ""}
              onChange={(e) => setProject((p: any) => ({ ...p, icon: e.target.value }))}
              onBlur={() => { setEditingIcon(false); updateField("icon", project.icon); }}
              onKeyDown={(e) => { if (e.key === "Enter") { setEditingIcon(false); updateField("icon", project.icon); } }}
              className="w-16 h-14 text-4xl text-center bg-secondary"
              autoFocus
            />
          ) : (
            <span className="text-4xl cursor-pointer hover:opacity-70 transition-opacity" onClick={() => setEditingIcon(true)}>
              {project.icon || "📁"}
            </span>
          )}
          <div>
            {/* Editable Name */}
            {editingName ? (
              <Input
                value={project.name || ""}
                onChange={(e) => setProject((p: any) => ({ ...p, name: e.target.value }))}
                onBlur={() => { setEditingName(false); updateField("name", project.name); }}
                onKeyDown={(e) => { if (e.key === "Enter") { setEditingName(false); updateField("name", project.name); } }}
                className="text-2xl font-bold bg-secondary h-10 max-w-md"
                autoFocus
              />
            ) : (
              <h1
                className="font-display text-3xl font-bold cursor-pointer hover:opacity-70 transition-opacity inline-flex items-center gap-2 group"
                onClick={() => setEditingName(true)}
              >
                {project.name}
                <Pencil className="h-4 w-4 opacity-0 group-hover:opacity-50 transition-opacity" />
              </h1>
            )}
            <p className="text-sm text-muted-foreground mt-1">{project.description || "Sem descrição"}</p>
            <div className="flex gap-2 mt-2 items-center">
              {/* Editable Category */}
              {editingCategory ? (
                <Input
                  value={project.category || ""}
                  onChange={(e) => setProject((p: any) => ({ ...p, category: e.target.value }))}
                  onBlur={() => { setEditingCategory(false); updateField("category", project.category); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { setEditingCategory(false); updateField("category", project.category); } }}
                  className="bg-secondary h-7 text-xs max-w-[160px]"
                  placeholder="Categoria..."
                  autoFocus
                />
              ) : (
                <Badge
                  variant="secondary"
                  className="cursor-pointer hover:opacity-70 transition-opacity"
                  onClick={() => setEditingCategory(true)}
                >
                  {project.category || "Sem categoria"}
                </Badge>
              )}
              {project.data?.status && <Badge variant="outline" className="capitalize">{project.data.status}</Badge>}
            </div>
          </div>
        </div>
        <div className="text-right space-y-1">
          <span className="text-3xl font-mono font-bold text-primary">{pipelineAvg}%</span>
          <Progress value={pipelineAvg} className="h-2 w-32" />
          <p className="text-xs text-muted-foreground">Pipeline Geral</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="briefing">
        <TabsList className="bg-secondary flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="briefing">📋 Briefing</TabsTrigger>
          <TabsTrigger value="expert">👤 Expert</TabsTrigger>
          <TabsTrigger value="avatar">🎭 Avatar</TabsTrigger>
          <TabsTrigger value="branding">🎨 Branding</TabsTrigger>
          <TabsTrigger value="kpis">📊 KPIs</TabsTrigger>
          <TabsTrigger value="pesquisa">🔬 Pesquisa</TabsTrigger>
          <TabsTrigger value="midia">🖼️ Mídia & Conteúdo</TabsTrigger>
          <TabsTrigger value="docs">📄 Docs</TabsTrigger>
          <TabsTrigger value="concorrentes">🏆 Concorrentes</TabsTrigger>
          <TabsTrigger value="calendario">📅 Calendário</TabsTrigger>
          <TabsTrigger value="financas">💰 Finanças</TabsTrigger>
          <TabsTrigger value="emails">✉️ Emails</TabsTrigger>
          
          <TabsTrigger value="analytics">📈 Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="briefing" className="mt-4">
          <ProjetoBriefing project={project} onUpdateData={onUpdateData} onUpdatePipeline={onUpdatePipeline} />
        </TabsContent>
        <TabsContent value="expert" className="mt-4">
          <ProjetoExpert project={project} onUpdateData={onUpdateData} />
        </TabsContent>
        <TabsContent value="avatar" className="mt-4">
          <ProjetoAvatar project={project} onUpdateData={onUpdateData} onUpdateAvatar={onUpdateAvatar} />
        </TabsContent>
        <TabsContent value="branding" className="mt-4">
          <ProjetoBranding project={project} onUpdateBrandKit={onUpdateBrandKit} />
        </TabsContent>
        <TabsContent value="kpis" className="mt-4">
          <ProjetoKPIs project={project} onUpdateData={onUpdateData} />
        </TabsContent>
        <TabsContent value="pesquisa" className="mt-4">
          <ProjetoPesquisa project={project} onUpdateData={onUpdateData} />
        </TabsContent>
        <TabsContent value="midia" className="mt-4">
          <ProjetoMidia project={project} onUpdateData={onUpdateData} />
        </TabsContent>
        <TabsContent value="docs" className="mt-4">
          <ProjetoDocs projectId={id!} />
        </TabsContent>
        <TabsContent value="concorrentes" className="mt-4">
          <ConcorrentesTab projectId={id!} />
        </TabsContent>
        <TabsContent value="calendario" className="mt-4">
          <ProjetoCalendario projectId={id!} />
        </TabsContent>
        <TabsContent value="financas" className="mt-4">
          <ProjetoFinancas projectId={id!} project={project} />
        </TabsContent>
        <TabsContent value="emails" className="mt-4">
          <ProjetoEmails projectId={id!} project={project} onUpdateData={onUpdateData} />
        </TabsContent>
        <TabsContent value="analytics" className="mt-4 space-y-4">
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">📈 Analytics & Tracking</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Microsoft Clarity ID</Label>
                <Input
                  value={project.clarity_id || ""}
                  onChange={e => setProject((p: any) => ({ ...p, clarity_id: e.target.value }))}
                  onBlur={() => updateField("clarity_id", project.clarity_id)}
                  className="bg-secondary"
                  placeholder="Ex: abc123xyz"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Cole o ID do projeto Clarity para heatmaps e session replay</p>
                {project.clarity_id && (
                  <a href={`https://clarity.microsoft.com/projects/view/${project.clarity_id}/dashboard`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-1 inline-block">↗ Abrir Clarity Dashboard</a>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Google Analytics ID</Label>
                <Input
                  value={project.ga_id || ""}
                  onChange={e => setProject((p: any) => ({ ...p, ga_id: e.target.value }))}
                  onBlur={() => updateField("ga_id", project.ga_id)}
                  className="bg-secondary"
                  placeholder="Ex: G-XXXXXXXXXX"
                />
                <p className="text-[10px] text-muted-foreground mt-1">ID de medição do Google Analytics 4</p>
                {project.ga_id && (
                  <a href={`https://analytics.google.com/analytics/web/`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-1 inline-block">↗ Abrir Google Analytics</a>
                )}
              </div>
            </CardContent>
          </Card>
          <FacebookCAPICard project={project} setProject={setProject} updateField={updateField} />

          {/* Webhooks de Pagamento — por projeto */}
          <WebhooksPagamentoCard project={project} setProject={setProject} updateField={updateField} />

          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🔗 Integrações Ativas</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                {[
                  { label: "Facebook CAPI", ok: !!project.data?.facebook_access_token, icon: "📘" },
                  { label: "Pixel", ok: !!project.data?.facebook_pixel_id, icon: "🎯" },
                  { label: "Clarity", ok: !!project.clarity_id, icon: "🔍" },
                  { label: "Hotmart", ok: !!project.data?.hotmart_token, icon: "🟧" },
                  { label: "Kiwify", ok: !!project.data?.kiwify_token, icon: "🟪" },
                  { label: "Ticto", ok: !!project.data?.ticto_token, icon: "🟩" },
                ].map(i => (
                  <div key={i.label} className="p-3 rounded bg-secondary/50 border border-border text-center">
                    <span className="text-lg">{i.icon}</span>
                    <p className="text-[10px] font-medium mt-1">{i.label}</p>
                    <p className={`text-[10px] mt-0.5 ${i.ok ? "text-emerald-400" : "text-muted-foreground"}`}>
                      {i.ok ? "✓ Ativo" : "○ Inativo"}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Facebook CAPI Card ──────────────────────────────────────────
function FacebookCAPICard({ project, setProject, updateField }: { project: any; setProject: any; updateField: (f: string, v: any) => void }) {
  const [guideOpen, setGuideOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);

  const updateDataField = (key: string, value: string) => {
    const newData = { ...(project.data || {}), [key]: value };
    setProject((p: any) => ({ ...p, data: newData }));
    updateField("data", newData);
  };

  const testCAPI = async () => {
    if (!project.data?.facebook_pixel_id || !project.data?.facebook_access_token) {
      toast.error("Preencha Pixel ID e Access Token antes de testar");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(
        `https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/webhook-pagamento?project=${project.id}&event=Lead`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ test: true, email: "test@imperiohq.com", name: "Teste CAPI" }),
        }
      );
      setTestResult(res.ok ? "success" : "error");
      toast[res.ok ? "success" : "error"](res.ok ? "Evento de teste enviado! Verifique no Events Manager." : "Erro ao enviar evento de teste");
    } catch {
      setTestResult("error");
      toast.error("Erro de conexão ao enviar teste");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">📘 Facebook Pixel & CAPI</CardTitle>
          <div className="flex items-center gap-2">
            {testResult === "success" && <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" /> CAPI OK</Badge>}
            {testResult === "error" && <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[10px]"><XCircle className="h-3 w-3 mr-1" /> Erro</Badge>}
            <Button size="sm" variant="outline" onClick={testCAPI} disabled={testing} className="h-7 text-xs">
              <TestTube2 className="h-3 w-3 mr-1" /> {testing ? "Enviando..." : "Testar CAPI"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Pixel ID</Label>
            <Input
              value={project.data?.facebook_pixel_id || ""}
              onChange={e => {
                const newData = { ...(project.data || {}), facebook_pixel_id: e.target.value };
                setProject((p: any) => ({ ...p, data: newData }));
              }}
              onBlur={() => updateDataField("facebook_pixel_id", project.data?.facebook_pixel_id || "")}
              className="bg-secondary"
              placeholder="Ex: 123456789012345"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Encontre em Events Manager → Fontes de Dados → Pixel → ID do Pixel</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Access Token (CAPI)</Label>
            <Input
              type="password"
              value={project.data?.facebook_access_token || ""}
              onChange={e => {
                const newData = { ...(project.data || {}), facebook_access_token: e.target.value };
                setProject((p: any) => ({ ...p, data: newData }));
              }}
              onBlur={() => updateDataField("facebook_access_token", project.data?.facebook_access_token || "")}
              className="bg-secondary"
              placeholder="EAAxxxxxxx..."
            />
            <p className="text-[10px] text-muted-foreground mt-1">Gere em Events Manager → Configurações → Conversions API → Gerar Token</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Test Event Code</Label>
            <Input
              value={project.data?.facebook_test_event_code || ""}
              onChange={e => {
                const newData = { ...(project.data || {}), facebook_test_event_code: e.target.value };
                setProject((p: any) => ({ ...p, data: newData }));
              }}
              onBlur={() => updateDataField("facebook_test_event_code", project.data?.facebook_test_event_code || "")}
              className="bg-secondary"
              placeholder="TEST12345"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Opcional. Aba "Test Events" no Events Manager. Remove antes de ir para produção.</p>
          </div>
        </div>

        <a href="https://business.facebook.com/events_manager2" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
          <ExternalLink className="h-3 w-3" /> Abrir Facebook Events Manager
        </a>

        <Collapsible open={guideOpen} onOpenChange={setGuideOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-primary hover:underline w-full">
            <ChevronDown className={`h-3 w-3 transition-transform ${guideOpen ? "rotate-180" : ""}`} />
            📖 Passo-a-passo: Como gerar o Token CAPI
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            {[
              { step: 1, text: "Acesse o Facebook Events Manager e selecione seu Pixel" },
              { step: 2, text: "Clique em 'Configurações' (ícone de engrenagem)" },
              { step: 3, text: "Role até 'Conversions API' e clique em 'Gerar Token de Acesso'" },
              { step: 4, text: "Copie o token (começa com EAA...) e cole no campo 'Access Token' acima" },
              { step: 5, text: "Para testar, copie o 'Test Event Code' da aba 'Test Events' e cole acima. Depois clique em 'Testar CAPI'" },
            ].map(s => (
              <div key={s.step} className="flex items-start gap-2 p-2 rounded bg-secondary/50 border border-border">
                <Badge variant="outline" className="text-[10px] font-mono bg-primary/10 text-primary border-primary/30 shrink-0">{s.step}</Badge>
                <p className="text-[11px] text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

// ── Webhooks de Pagamento Card ──────────────────────────────────
function WebhooksPagamentoCard({ project, setProject, updateField }: { project: any; setProject: any; updateField: (f: string, v: any) => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const baseUrl = `https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/webhook-pagamento?project=${project.id}`;

  const copyUrl = (url: string, label: string) => {
    navigator.clipboard.writeText(url);
    setCopied(label);
    toast.success("URL copiada!");
    setTimeout(() => setCopied(null), 2000);
  };

  const updateDataField = (key: string, value: string) => {
    const newData = { ...(project.data || {}), [key]: value };
    setProject((p: any) => ({ ...p, data: newData }));
    updateField("data", newData);
  };

  const WEBHOOK_URLS = [
    { label: "Principal (compras)", url: baseUrl, desc: "Recebe todos os eventos" },
    { label: "Lead", url: `${baseUrl}&event=Lead`, desc: "Captura de leads" },
    { label: "Checkout", url: `${baseUrl}&event=InitiateCheckout`, desc: "Início de checkout" },
    { label: "ViewContent", url: `${baseUrl}&event=ViewContent`, desc: "Visualização de conteúdo" },
  ];

  const PLATFORMS = [
    { key: "hotmart_token", label: "Hotmart", icon: "🟧", placeholder: "Hottok de validação", help: "Cole em Ferramentas > Webhooks na Hotmart. Use o header x-hotmart-hottok." },
    { key: "kiwify_token", label: "Kiwify", icon: "🟪", placeholder: "Secret de validação", help: "Configurações > Webhooks > Secret na Kiwify." },
    { key: "ticto_token", label: "Ticto (v2)", icon: "🟩", placeholder: "Token de validação", help: "Na Ticto, vá em Integrações > Webhooks > Adicione a URL acima. O token enviado no body será validado automaticamente. Valores (paid_amount) são convertidos de centavos." },
  ];

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🔔 Webhooks de Pagamento</CardTitle>
        <p className="text-[10px] text-muted-foreground">URLs exclusivas deste projeto para receber eventos de Hotmart, Kiwify e Ticto</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Webhook URLs */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">URLs de Webhook</Label>
          {WEBHOOK_URLS.map(w => (
            <div key={w.label} className="flex items-center gap-2 p-2 rounded bg-secondary/50 border border-border">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-medium">{w.label} <span className="text-muted-foreground">— {w.desc}</span></p>
                <code className="text-[9px] text-muted-foreground break-all block mt-0.5">{w.url}</code>
              </div>
              <button
                onClick={() => copyUrl(w.url, w.label)}
                className="shrink-0 p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                {copied === w.label ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          ))}
        </div>

        {/* Platform Tokens */}
        <div className="space-y-3">
          <Label className="text-xs font-medium">Tokens de Validação por Plataforma</Label>
          {PLATFORMS.map(p => (
            <div key={p.key} className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{p.icon}</span>
                <Label className="text-xs text-muted-foreground">{p.label}</Label>
              </div>
              <Input
                type="password"
                value={project.data?.[p.key] || ""}
                onChange={e => {
                  const newData = { ...(project.data || {}), [p.key]: e.target.value };
                  setProject((prev: any) => ({ ...prev, data: newData }));
                }}
                onBlur={() => updateDataField(p.key, project.data?.[p.key] || "")}
                className="bg-secondary"
                placeholder={p.placeholder}
              />
              <p className="text-[9px] text-muted-foreground">{p.help}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

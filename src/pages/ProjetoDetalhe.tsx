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
import { ProjetoPipeline } from "@/components/projeto/ProjetoPipeline";
import { ProjetoMidia } from "@/components/projeto/ProjetoMidia";
import { ProjetoDocs } from "@/components/projeto/ProjetoDocs";
import { ConcorrentesTab } from "@/components/projeto/concorrentes/ConcorrentesTab";
import { ProjetoCalendario } from "@/components/projeto/ProjetoCalendario";
import { ProjetoConteudo } from "@/components/projeto/ProjetoConteudo";
import { ProjetoFinancas } from "@/components/projeto/ProjetoFinancas";
import { useAutoSave } from "@/components/projeto/useAutoSave";
import { Pencil } from "lucide-react";

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
          <TabsTrigger value="pipeline">⚡ Pipeline</TabsTrigger>
          <TabsTrigger value="midia">🖼️ Mídia</TabsTrigger>
          <TabsTrigger value="docs">📄 Docs</TabsTrigger>
          <TabsTrigger value="concorrentes">🏆 Concorrentes</TabsTrigger>
          <TabsTrigger value="calendario">📅 Calendário</TabsTrigger>
          <TabsTrigger value="conteudo">📦 Conteúdo</TabsTrigger>
          <TabsTrigger value="financas">💰 Finanças</TabsTrigger>
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
        <TabsContent value="pipeline" className="mt-4">
          <ProjetoPipeline project={project} onUpdatePipeline={onUpdatePipeline} onUpdateData={onUpdateData} />
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
        <TabsContent value="conteudo" className="mt-4">
          <ProjetoConteudo projectId={id!} />
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
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">📘 Facebook Pixel & CAPI</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Pixel ID</Label>
                <Input
                  value={project.data?.facebook_pixel_id || ""}
                  onChange={e => {
                    const newData = { ...(project.data || {}), facebook_pixel_id: e.target.value };
                    setProject((p: any) => ({ ...p, data: newData }));
                  }}
                  onBlur={() => updateField("data", { ...(project.data || {}), facebook_pixel_id: project.data?.facebook_pixel_id })}
                  className="bg-secondary"
                  placeholder="Ex: 123456789012345"
                />
                <p className="text-[10px] text-muted-foreground mt-1">ID do pixel do Facebook Ads</p>
                {project.data?.facebook_pixel_id && (
                  <a href={`https://business.facebook.com/events_manager2/list/pixel/${project.data.facebook_pixel_id}/overview`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-1 inline-block">↗ Abrir Events Manager</a>
                )}
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
                  onBlur={() => updateField("data", { ...(project.data || {}), facebook_access_token: project.data?.facebook_access_token })}
                  className="bg-secondary"
                  placeholder="EAAxxxxxxx..."
                />
                <p className="text-[10px] text-muted-foreground mt-1">Token de acesso para Conversions API — usado pelo webhook de pagamento</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Test Event Code</Label>
                <Input
                  value={project.data?.facebook_test_event_code || ""}
                  onChange={e => {
                    const newData = { ...(project.data || {}), facebook_test_event_code: e.target.value };
                    setProject((p: any) => ({ ...p, data: newData }));
                  }}
                  onBlur={() => updateField("data", { ...(project.data || {}), facebook_test_event_code: project.data?.facebook_test_event_code })}
                  className="bg-secondary"
                  placeholder="TEST12345"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Código de teste (opcional, para debug)</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🔗 Integrações Ativas</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="p-3 rounded bg-secondary/50 border border-border">
                  <span className="text-xs font-mono text-muted-foreground">Webhook Pagamento</span>
                  <p className={`text-xs mt-1 ${project.data?.facebook_access_token ? "text-emerald-400" : "text-muted-foreground"}`}>
                    {project.data?.facebook_access_token ? "✓ CAPI ativo — compras enviadas ao Facebook" : "○ Configure o Access Token para ativar CAPI"}
                  </p>
                </div>
                <div className="p-3 rounded bg-secondary/50 border border-border">
                  <span className="text-xs font-mono text-muted-foreground">Tracker Script</span>
                  <p className={`text-xs mt-1 ${project.data?.facebook_pixel_id ? "text-emerald-400" : "text-muted-foreground"}`}>
                    {project.data?.facebook_pixel_id ? "✓ Pixel carregado no imptrack.js" : "○ Configure o Pixel ID para tracking automático"}
                  </p>
                </div>
                <div className="p-3 rounded bg-secondary/50 border border-border">
                  <span className="text-xs font-mono text-muted-foreground">Heatmaps</span>
                  <p className={`text-xs mt-1 ${project.clarity_id ? "text-emerald-400" : "text-muted-foreground"}`}>
                    {project.clarity_id ? "✓ Clarity conectado" : "○ Configure o Clarity ID"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

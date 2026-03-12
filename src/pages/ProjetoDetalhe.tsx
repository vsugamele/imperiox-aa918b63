import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ProjetoBriefing } from "@/components/projeto/ProjetoBriefing";
import { ProjetoExpert } from "@/components/projeto/ProjetoExpert";
import { ProjetoAvatar } from "@/components/projeto/ProjetoAvatar";
import { ProjetoBranding } from "@/components/projeto/ProjetoBranding";
import { ProjetoKPIs } from "@/components/projeto/ProjetoKPIs";
import { ProjetoPipeline } from "@/components/projeto/ProjetoPipeline";
import { ProjetoMidia } from "@/components/projeto/ProjetoMidia";
import { ProjetoDocs } from "@/components/projeto/ProjetoDocs";
import { ConcorrentesTab } from "@/components/projeto/concorrentes/ConcorrentesTab";
import { useAutoSave } from "@/components/projeto/useAutoSave";

const PIPELINE_KEYS = ["avatar", "funil", "copy", "prompts", "design", "trafego"];

export default function ProjetoDetalhe() {
  const { id } = useParams();
  const [project, setProject] = useState<any>(null);
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
          <span className="text-4xl">{project.icon || "📁"}</span>
          <div>
            <h1 className="font-display text-3xl font-bold">{project.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">{project.description || "Sem descrição"}</p>
            <div className="flex gap-2 mt-2">
              {project.category && <Badge variant="secondary">{project.category}</Badge>}
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
      </Tabs>
    </div>
  );
}

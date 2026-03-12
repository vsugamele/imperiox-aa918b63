import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

const PIPELINE_KEYS = ["avatar", "funil", "copy", "prompts", "design", "trafego"];

export default function ProjetoDetalhe() {
  const { id } = useParams();
  const [project, setProject] = useState<any>(null);

  useEffect(() => {
    supabase.from("imphq_projects").select("*").eq("id", id).single().then(({ data }) => setProject(data));
  }, [id]);

  if (!project) return <div className="text-muted-foreground">Carregando...</div>;

  const pipeline = project.pipeline || {};
  const data = project.data || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-3xl">{project.icon || "📁"}</span>
        <div>
          <h1 className="font-display text-3xl font-bold">{project.name}</h1>
          <p className="text-sm text-muted-foreground">{project.category}</p>
        </div>
      </div>

      <Tabs defaultValue="pipeline">
        <TabsList className="bg-secondary">
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="briefing">Briefing</TabsTrigger>
          <TabsTrigger value="data">Dados</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-4">
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="font-display">Pipeline de Produção</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {PIPELINE_KEYS.map((key) => {
                const val = pipeline[key] ?? 0;
                return (
                  <div key={key}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm capitalize">{key}</span>
                      <span className="text-xs font-mono text-primary">{val}%</span>
                    </div>
                    <Progress value={val} className="h-2" />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="briefing" className="mt-4">
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <p className="text-sm whitespace-pre-wrap">{project.description || "Sem briefing definido."}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="mt-4">
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <pre className="text-xs font-mono text-muted-foreground overflow-auto">{JSON.stringify(data, null, 2)}</pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

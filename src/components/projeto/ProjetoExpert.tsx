import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EditableTagList } from "./EditableTagList";
import { FileUpload } from "@/components/FileUpload";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AIGenerateButton } from "./AIGenerateButton";
import { toast } from "sonner";

interface Props {
  project: any;
  onUpdateData: (data: any) => void;
}

export function ProjetoExpert({ project, onUpdateData }: Props) {
  const data = project.data || {};
  const expert = data.expert || {};

  const update = (key: string, val: any) => {
    onUpdateData({ ...data, expert: { ...expert, [key]: val } });
  };

  const handleAIResult = (result: any) => {
    if (result?.expert) {
      const e = result.expert;
      const newExpert = { ...expert };
      for (const [key, val] of Object.entries(e)) {
        if (!newExpert[key] && val) {
          newExpert[key] = val;
        }
      }
      onUpdateData({ ...data, expert: newExpert });
      toast.success("Expert preenchido com IA! Campos vazios completados.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <AIGenerateButton
          projectId={project.id}
          action="generate_expert"
          onResult={handleAIResult}
          contextSources={["Briefing", "Pesquisa", "Concorrentes", "Avatar"]}
          fieldsToFill={["Bio", "Tom de Voz", "Método", "Pilares", "Transformação", "Temas"]}
          label="Completar com IA"
        />
      </div>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">👤 Dados Pessoais</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={expert.foto || ""} />
              <AvatarFallback className="text-2xl">{(expert.nome || "E")[0]}</AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Foto do Expert</Label>
              <div className="flex gap-2 items-center">
                <Input value={expert.foto || ""} onChange={(e) => update("foto", e.target.value)} className="bg-secondary max-w-xs" placeholder="URL da foto..." />
                <FileUpload bucket="project-media" path={`${project.id}/expert`} onUpload={(url) => update("foto", url)} />
              </div>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Nome Completo</Label>
            <Input value={expert.nome || ""} onChange={(e) => update("nome", e.target.value)} className="bg-secondary" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Área de Atuação</Label>
            <Input value={expert.area || ""} onChange={(e) => update("area", e.target.value)} className="bg-secondary" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Anos de Experiência</Label>
            <Input value={expert.anos_exp || ""} onChange={(e) => update("anos_exp", e.target.value)} className="bg-secondary" type="number" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Alunos / Clientes</Label>
            <Input value={expert.alunos || ""} onChange={(e) => update("alunos", e.target.value)} className="bg-secondary" />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs text-muted-foreground">Bio Curta</Label>
            <Textarea value={expert.bio || ""} onChange={(e) => update("bio", e.target.value)} className="bg-secondary min-h-[60px]" />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs text-muted-foreground">Certificações</Label>
            <EditableTagList tags={expert.certificacoes || []} onChange={(v) => update("certificacoes", v)} placeholder="Certificação..." />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🗣️ Como Ele Fala</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Tom de Voz</Label>
            <Input value={expert.tom_voz || ""} onChange={(e) => update("tom_voz", e.target.value)} className="bg-secondary" placeholder="Ex: direto, motivacional, técnico..." />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Palavras que Usa</Label>
            <EditableTagList tags={expert.palavras_usa || []} onChange={(v) => update("palavras_usa", v)} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Palavras que Evita</Label>
            <EditableTagList tags={expert.palavras_evita || []} onChange={(v) => update("palavras_evita", v)} />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🎯 O que Ele Ensina</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Método / Framework</Label>
            <Input value={expert.metodo || ""} onChange={(e) => update("metodo", e.target.value)} className="bg-secondary" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Pilares do Ensino</Label>
            <EditableTagList tags={expert.pilares || []} onChange={(v) => update("pilares", v)} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Transformação Prometida</Label>
            <Textarea value={expert.transformacao || ""} onChange={(e) => update("transformacao", e.target.value)} className="bg-secondary min-h-[60px]" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Temas / Conteúdos</Label>
            <EditableTagList tags={expert.temas || []} onChange={(v) => update("temas", v)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

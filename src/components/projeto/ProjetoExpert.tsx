import type { Json, Tables } from "@/integrations/supabase/types";
import { jsonFields, jsonText } from "@/lib/json-fields";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EditableTagList } from "@/components/projeto/EditableTagList";
import { FileUpload } from "@/components/FileUpload";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AIGenerateButton } from "@/components/projeto/AIGenerateButton";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  project: Tables<"imphq_projects">;
  onUpdateData: (data: Json) => void;
}

export function ProjetoExpert({ project, onUpdateData }: Props) {
  const data = jsonFields(project.data);
  const expert = jsonFields(data.expert);

  // Migrate old single foto to fotos array
  const fotos: string[] = Array.isArray(expert.fotos) ? expert.fotos.filter((value): value is string => typeof value === "string") : (typeof expert.foto === "string" ? [expert.foto] : []);

  const update = (key: string, val: Json) => {
    onUpdateData({ ...data, expert: { ...expert, [key]: val } });
  };

  const addFoto = (url: string) => {
    const updated = [...fotos, url];
    onUpdateData({ ...data, expert: { ...expert, fotos: updated, foto: updated[0] } });
  };

  const addFotosMultiple = (urls: string[]) => {
    const updated = [...fotos, ...urls];
    onUpdateData({ ...data, expert: { ...expert, fotos: updated, foto: updated[0] } });
  };

  const removeFoto = (idx: number) => {
    const updated = fotos.filter((_, i) => i !== idx);
    onUpdateData({ ...data, expert: { ...expert, fotos: updated, foto: updated[0] || "" } });
  };

  const setPrincipal = (idx: number) => {
    const updated = [...fotos];
    const [item] = updated.splice(idx, 1);
    updated.unshift(item);
    onUpdateData({ ...data, expert: { ...expert, fotos: updated, foto: updated[0] } });
    toast.success("Foto principal atualizada!");
  };

  const handleAIResult = (result: Json) => {
    if (jsonFields(result).expert) {
      const e = jsonFields(jsonFields(result).expert);
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
          showMenteSelector={true}
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
              <AvatarImage src={fotos[0] || ""} />
              <AvatarFallback className="text-2xl">{(jsonText(expert.nome) || "E")[0]}</AvatarFallback>
            </Avatar>
            <div className="space-y-2 flex-1">
              <Label className="text-xs text-muted-foreground">Fotos do Expert</Label>
              <div className="flex gap-2 items-center">
                <Input
                  value={jsonText(expert.foto_url_input) || ""}
                  onChange={(e) => update("foto_url_input", e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && jsonText(expert.foto_url_input)?.trim()) {
                      addFoto(jsonText(expert.foto_url_input)?.trim() || "");
                      update("foto_url_input", "");
                    }
                  }}
                  className="bg-secondary max-w-xs"
                  placeholder="URL da foto + Enter..."
                />
                <FileUpload
                  bucket="project-media"
                  path={`${project.id}/expert`}
                  onUpload={(url) => addFoto(url)}
                  onUploadMultiple={(urls) => addFotosMultiple(urls)}
                  multiple={true}
                />
              </div>
            </div>
          </div>

          {/* Gallery */}
          {fotos.length > 0 && (
            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground mb-2 block">📸 Galeria ({fotos.length} foto{fotos.length !== 1 ? "s" : ""})</Label>
              <div className="flex flex-wrap gap-3">
                {fotos.map((url, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={url}
                      alt={`Expert foto ${idx + 1}`}
                      className={`h-20 w-20 rounded-lg object-cover border-2 transition-all cursor-pointer ${idx === 0 ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40"}`}
                      onClick={() => idx !== 0 && setPrincipal(idx)}
                      title={idx === 0 ? "Foto principal" : "Clique para definir como principal"}
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeFoto(idx)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    {idx === 0 && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] bg-primary text-primary-foreground px-1.5 rounded-full">Principal</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs text-muted-foreground">Nome Completo</Label>
            <Input value={jsonText(expert.nome) || ""} onChange={(e) => update("nome", e.target.value)} className="bg-secondary" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Área de Atuação</Label>
            <Input value={jsonText(expert.area) || ""} onChange={(e) => update("area", e.target.value)} className="bg-secondary" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Anos de Experiência</Label>
            <Input value={typeof expert.anos_exp === "number" ? expert.anos_exp : jsonText(expert.anos_exp) || ""} onChange={(e) => update("anos_exp", e.target.value)} className="bg-secondary" type="number" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Alunos / Clientes</Label>
            <Input value={typeof expert.alunos === "number" ? expert.alunos : jsonText(expert.alunos) || ""} onChange={(e) => update("alunos", e.target.value)} className="bg-secondary" />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs text-muted-foreground">Bio Curta</Label>
            <Textarea value={jsonText(expert.bio) || ""} onChange={(e) => update("bio", e.target.value)} className="bg-secondary min-h-[60px]" />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs text-muted-foreground">Certificações</Label>
            <EditableTagList tags={(Array.isArray(expert.certificacoes) ? expert.certificacoes.filter((value): value is string => typeof value === "string") : [])} onChange={(v) => update("certificacoes", v)} placeholder="Certificação..." />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🗣️ Como Ele Fala</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Tom de Voz</Label>
            <Input value={jsonText(expert.tom_voz) || ""} onChange={(e) => update("tom_voz", e.target.value)} className="bg-secondary" placeholder="Ex: direto, motivacional, técnico..." />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Palavras que Usa</Label>
            <EditableTagList tags={(Array.isArray(expert.palavras_usa) ? expert.palavras_usa.filter((value): value is string => typeof value === "string") : [])} onChange={(v) => update("palavras_usa", v)} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Palavras que Evita</Label>
            <EditableTagList tags={(Array.isArray(expert.palavras_evita) ? expert.palavras_evita.filter((value): value is string => typeof value === "string") : [])} onChange={(v) => update("palavras_evita", v)} />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🎯 O que Ele Ensina</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Método / Framework</Label>
            <Input value={jsonText(expert.metodo) || ""} onChange={(e) => update("metodo", e.target.value)} className="bg-secondary" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Pilares do Ensino</Label>
            <EditableTagList tags={(Array.isArray(expert.pilares) ? expert.pilares.filter((value): value is string => typeof value === "string") : [])} onChange={(v) => update("pilares", v)} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Transformação Prometida</Label>
            <Textarea value={jsonText(expert.transformacao) || ""} onChange={(e) => update("transformacao", e.target.value)} className="bg-secondary min-h-[60px]" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Temas / Conteúdos</Label>
            <EditableTagList tags={(Array.isArray(expert.temas) ? expert.temas.filter((value): value is string => typeof value === "string") : [])} onChange={(v) => update("temas", v)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

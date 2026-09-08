import type { Json, Tables } from "@/integrations/supabase/types";
import { jsonFields, jsonText, jsonNumber } from "@/lib/json-fields";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";

const PIPELINE_KEYS = [
  { key: "avatar", label: "Avatar", emoji: "👤" },
  { key: "funil", label: "Funil", emoji: "🔻" },
  { key: "copy", label: "Copy", emoji: "✍️" },
  { key: "prompts", label: "Prompts", emoji: "🤖" },
  { key: "design", label: "Design", emoji: "🎨" },
  { key: "trafego", label: "Tráfego", emoji: "📡" },
];

interface Props {
  project: Pick<Tables<"imphq_projects">, "data" | "pipeline">;
  onUpdatePipeline: (pipeline: Json) => void;
  onUpdateData: (data: Json) => void;
}

export function ProjetoPipeline({ project, onUpdatePipeline, onUpdateData }: Props) {
  const pipeline = jsonFields(project.pipeline);
  const data = jsonFields(project.data);
  const notes = jsonFields(data.pipeline_notes);

  const updateVal = (key: string, val: number) => {
    onUpdatePipeline({ ...pipeline, [key]: val });
  };

  const updateNote = (key: string, val: string) => {
    onUpdateData({ ...data, pipeline_notes: { ...notes, [key]: val } });
  };

  return (
    <div className="space-y-4">
      {PIPELINE_KEYS.map((p) => {
        const val = jsonNumber(pipeline[p.key]) ?? 0;
        return (
          <Card key={p.key} className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-sans flex items-center gap-2">
                <span>{p.emoji}</span>
                <span>{p.label}</span>
                <span className="ml-auto font-mono text-primary text-xs">{val}%</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Slider
                value={[val]}
                onValueChange={([v]) => updateVal(p.key, v)}
                max={100}
                step={5}
              />
              <div>
                <Label className="text-xs text-muted-foreground">Notas</Label>
                <Textarea
                  value={jsonText(notes[p.key]) || ""}
                  onChange={(e) => updateNote(p.key, e.target.value)}
                  className="bg-secondary text-sm min-h-[50px]"
                  placeholder="Observações desta etapa..."
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

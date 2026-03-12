import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditableTagList } from "@/components/projeto/EditableTagList";
import { Trash2 } from "lucide-react";
import { Competitor } from "./types";

interface Props {
  competitors: Competitor[];
  updateField: (id: string, field: string, value: any) => void;
  removeCompetitor: (id: string) => void;
}

export function MercadoTab({ competitors, updateField, removeCompetitor }: Props) {
  if (!competitors.length) return <p className="text-muted-foreground text-sm p-4">Nenhum concorrente adicionado.</p>;

  return (
    <div className="space-y-6">
      {/* Score de Escala */}
      <Card className="border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-wider text-primary/80">📊 Score de Escala</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {competitors.map(c => (
            <div key={c.id} className="space-y-1">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: c.color }} />
                  <span className="text-sm font-medium">{c.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-bold" style={{ color: c.color }}>
                    {c.score_escala}/{c.score_max}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-destructive hover:text-destructive"
                    onClick={() => removeCompetitor(c.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <Slider
                value={[c.score_escala]}
                max={c.score_max}
                step={1}
                onValueChange={([v]) => updateField(c.id, "score_escala", v)}
                className="w-full"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Canais & Palavras-chave */}
      <Card className="border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm uppercase tracking-wider text-primary/80">🔑 Canais & Palavras-chave</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {competitors.map(c => (
            <div key={c.id} className="space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-3 h-3 rounded-full" style={{ background: c.color }} />
                <span className="text-sm font-medium">{c.name}</span>
              </div>
              <EditableTagList
                tags={Array.isArray(c.canais_keywords) ? c.canais_keywords : []}
                onChange={tags => updateField(c.id, "canais_keywords", tags)}
                placeholder="Adicionar canal/keyword..."
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Competitor } from "./types";

interface Props {
  competitors: Competitor[];
  updateField: (id: string, field: string, value: any) => void;
}

export function CopywritingTab({ competitors, updateField }: Props) {
  if (!competitors.length) return <p className="text-muted-foreground text-sm p-4">Nenhum concorrente adicionado.</p>;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {competitors.map(c => (
        <Card key={c.id} className="border-border/40" style={{ borderTopColor: c.color, borderTopWidth: 3 }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ background: c.color }} />
              {c.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-primary/80 font-medium">Headline Principal</label>
              <Textarea
                value={c.headline || ""}
                onChange={e => updateField(c.id, "headline", e.target.value)}
                className="mt-1 min-h-[60px] text-sm bg-secondary border-none"
                placeholder="Headline principal do concorrente..."
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-primary/80 font-medium">Hook / Ângulo</label>
              <Textarea
                value={c.hook || ""}
                onChange={e => updateField(c.id, "hook", e.target.value)}
                className="mt-1 min-h-[60px] text-sm bg-secondary border-none"
                placeholder="Hook ou ângulo principal..."
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-primary/80 font-medium">CTA Principal</label>
              <Textarea
                value={c.cta || ""}
                onChange={e => updateField(c.id, "cta", e.target.value)}
                className="mt-1 min-h-[40px] text-sm bg-secondary border-none"
                placeholder="Call to action..."
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

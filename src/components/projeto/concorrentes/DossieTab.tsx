import { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { EditableTagList } from "@/components/projeto/EditableTagList";
import { Upload, Trash2 } from "lucide-react";
import { Competitor } from "./types";

interface Props {
  competitors: Competitor[];
  updateField: (id: string, field: string, value: any) => void;
  uploadScreenshot: (id: string, file: File) => void;
  removeCompetitor: (id: string) => void;
}

export function DossieTab({ competitors, updateField, uploadScreenshot, removeCompetitor }: Props) {
  if (!competitors.length) return <p className="text-muted-foreground text-sm p-4">Nenhum concorrente adicionado.</p>;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {competitors.map(c => (
        <DossieCard key={c.id} c={c} updateField={updateField} uploadScreenshot={uploadScreenshot} removeCompetitor={removeCompetitor} />
      ))}
    </div>
  );
}

function DossieCard({ c, updateField, uploadScreenshot, removeCompetitor }: {
  c: Competitor;
  updateField: Props["updateField"];
  uploadScreenshot: Props["uploadScreenshot"];
  removeCompetitor: Props["removeCompetitor"];
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <Card className="border-border/40" style={{ borderLeftColor: c.color, borderLeftWidth: 4 }}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ background: c.color }} />
          {c.name}
          <Badge variant="secondary" className="text-xs font-mono">
            {c.score_escala}/{c.score_max}
          </Badge>
        </CardTitle>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeCompetitor(c.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs uppercase tracking-wider text-primary/80">Tráfego Est.</label>
            <Input value={c.trafego_est || ""} onChange={e => updateField(c.id, "trafego_est", e.target.value)}
              className="h-7 text-xs bg-secondary border-none mt-1" placeholder="Ex: 50k/mês" />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs uppercase tracking-wider text-primary/80">Ads Ativos</label>
              <div className="mt-1">
                <Switch checked={c.ads_ativos || false} onCheckedChange={v => updateField(c.id, "ads_ativos", v)} />
              </div>
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs uppercase tracking-wider text-primary/80">Stack Tecnológico</label>
          <EditableTagList
            tags={Array.isArray(c.stack_tecnologico) ? c.stack_tecnologico : []}
            onChange={tags => updateField(c.id, "stack_tecnologico", tags)}
            placeholder="WordPress, Hotmart..."
          />
        </div>

        <div>
          <label className="text-xs uppercase tracking-wider text-primary/80">Páginas do Funil</label>
          <EditableTagList
            tags={Array.isArray(c.paginas_funil) ? c.paginas_funil : []}
            onChange={tags => updateField(c.id, "paginas_funil", tags)}
            placeholder="Captura, VSL, Checkout..."
          />
        </div>

        <div>
          <label className="text-xs uppercase tracking-wider text-primary/80">Insights</label>
          <Textarea value={c.insights || ""} onChange={e => updateField(c.id, "insights", e.target.value)}
            className="mt-1 min-h-[60px] text-sm bg-secondary border-none" placeholder="Anotações e insights..." />
        </div>

        {/* Screenshot upload */}
        <div>
          <label className="text-xs uppercase tracking-wider text-primary/80">Screenshot</label>
          {c.screenshot_url ? (
            <div className="mt-1 relative group">
              <img src={c.screenshot_url} alt={c.name} className="rounded-md max-h-40 w-full object-cover border border-border/40" />
              <Button variant="destructive" size="sm" className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 h-6 text-xs"
                onClick={() => updateField(c.id, "screenshot_url", "")}>Remover</Button>
            </div>
          ) : (
            <div className="mt-1">
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadScreenshot(c.id, f); }} />
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => fileRef.current?.click()}>
                <Upload className="h-3 w-3" /> Enviar Screenshot
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

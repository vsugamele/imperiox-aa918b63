import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EditableTagList } from "./EditableTagList";

interface Props {
  project: any;
  onUpdateBrandKit: (brandKit: any) => void;
}

export function ProjetoBranding({ project, onUpdateBrandKit }: Props) {
  const bk = project.brand_kit || {};

  const update = (key: string, val: any) => onUpdateBrandKit({ ...bk, [key]: val });

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🎨 Paleta de Cores</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Cores (hex)</Label>
            <EditableTagList tags={bk.cores || []} onChange={(v) => update("cores", v)} placeholder="#000000" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(bk.cores || []).map((c: string, i: number) => (
              <div key={i} className="h-10 w-10 rounded-md border border-border" style={{ backgroundColor: c }} title={c} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🔤 Tipografia</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Fonte Título</Label>
            <Input value={bk.fonte_titulo || ""} onChange={(e) => update("fonte_titulo", e.target.value)} className="bg-secondary" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Fonte Corpo</Label>
            <Input value={bk.fonte_corpo || ""} onChange={(e) => update("fonte_corpo", e.target.value)} className="bg-secondary" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">✨ Tom Visual</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Descrição do Tom</Label>
            <Textarea value={bk.tom_visual || ""} onChange={(e) => update("tom_visual", e.target.value)} className="bg-secondary min-h-[60px]" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Referências Visuais (URLs)</Label>
            <EditableTagList tags={bk.referencias || []} onChange={(v) => update("referencias", v)} placeholder="https://..." />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

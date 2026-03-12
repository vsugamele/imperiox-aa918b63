import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { EditableTagList } from "../EditableTagList";

interface Props {
  avatar: any;
  onUpdate: (avatar: any) => void;
}

function CopyList({ items, onUpdate, label, fields }: { items: any[]; onUpdate: (items: any[]) => void; label: string; fields: { key: string; label: string; type?: string }[] }) {
  const add = () => {
    const empty: any = {};
    fields.forEach(f => (empty[f.key] = ""));
    onUpdate([...items, empty]);
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">{label}</CardTitle>
        <Button size="sm" variant="outline" onClick={add}><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item: any, i: number) => (
          <div key={i} className="p-3 rounded-md bg-secondary/50 border border-border space-y-2 relative">
            <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-6 w-6 text-destructive" onClick={() => onUpdate(items.filter((_, j) => j !== i))}>
              <Trash2 className="h-3 w-3" />
            </Button>
            {fields.map(f => (
              <div key={f.key}>
                <Label className="text-[10px] text-muted-foreground">{f.label}</Label>
                {f.type === "textarea" ? (
                  <Textarea
                    value={item[f.key] || ""}
                    onChange={e => { const u = [...items]; u[i] = { ...u[i], [f.key]: e.target.value }; onUpdate(u); }}
                    className="bg-secondary text-sm min-h-[40px]"
                  />
                ) : (
                  <Input
                    value={item[f.key] || ""}
                    onChange={e => { const u = [...items]; u[i] = { ...u[i], [f.key]: e.target.value }; onUpdate(u); }}
                    className="bg-secondary text-sm"
                  />
                )}
              </div>
            ))}
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item.</p>}
      </CardContent>
    </Card>
  );
}

export function CopyArsenalTab({ avatar, onUpdate }: Props) {
  const matriz = avatar.matriz_copy || {};
  const updateMatriz = (key: string, val: any) => onUpdate({ ...avatar, matriz_copy: { ...matriz, [key]: val } });

  return (
    <div className="space-y-6">
      <CopyList
        items={matriz.headlines_choque || []}
        onUpdate={items => updateMatriz("headlines_choque", items)}
        label="💥 Headlines de Choque"
        fields={[{ key: "problema", label: "Problema Base" }, { key: "headline", label: "Headline", type: "textarea" }]}
      />
      <CopyList
        items={matriz.aberturas_empaticas || []}
        onUpdate={items => updateMatriz("aberturas_empaticas", items)}
        label="🤝 Aberturas Empáticas"
        fields={[{ key: "problema", label: "Problema" }, { key: "copy", label: "Copy de Abertura", type: "textarea" }]}
      />
      <CopyList
        items={matriz.objecoes_antecipadas || []}
        onUpdate={items => updateMatriz("objecoes_antecipadas", items)}
        label="🛡️ Objeções Antecipadas"
        fields={[{ key: "objecao", label: "Objeção" }, { key: "virada", label: "Virada" }, { key: "copy", label: "Copy", type: "textarea" }]}
      />
      <CopyList
        items={matriz.argumentos_urgencia || []}
        onUpdate={items => updateMatriz("argumentos_urgencia", items)}
        label="⏰ Argumentos de Urgência"
        fields={[{ key: "problema", label: "Problema" }, { key: "copy", label: "Copy", type: "textarea" }]}
      />

      {/* Frases Exatas */}
      <CopyList
        items={avatar.frases_exatas || []}
        onUpdate={items => onUpdate({ ...avatar, frases_exatas: items })}
        label="💬 Frases Exatas do Avatar"
        fields={[{ key: "codigo", label: "Código (ex: FE-01)" }, { key: "frase", label: "Frase", type: "textarea" }, { key: "uso", label: "Uso na Copy" }]}
      />

      {/* Palavras-Gatilho */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🔤 Palavras-Gatilho</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Palavras de Dor</Label>
            <EditableTagList tags={avatar.palavras_dor || []} onChange={v => onUpdate({ ...avatar, palavras_dor: v })} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Palavras de Desejo</Label>
            <EditableTagList tags={avatar.palavras_desejo || []} onChange={v => onUpdate({ ...avatar, palavras_desejo: v })} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Palavras de Solução</Label>
            <EditableTagList tags={avatar.palavras_solucao || []} onChange={v => onUpdate({ ...avatar, palavras_solucao: v })} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

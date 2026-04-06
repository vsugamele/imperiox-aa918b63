import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { AIGenerateButton } from "../AIGenerateButton";

interface Props {
  avatar: any;
  onUpdate: (avatar: any) => void;
  projectId?: string;
}

export function VoyerismosTab({ avatar, onUpdate, projectId }: Props) {
  const voyerismos = avatar.voyerismos || [];

  const add = () => onUpdate({
    ...avatar,
    voyerismos: [...voyerismos, { nome: "", intensidade: "", situacao: "", sintoma_fisico: "", pensamento: "", comportamento: "", uso_copy: "" }],
  });

  const remove = (i: number) => onUpdate({ ...avatar, voyerismos: voyerismos.filter((_: any, j: number) => j !== i) });

  const edit = (i: number, field: string, val: string) => {
    const updated = [...voyerismos];
    updated[i] = { ...updated[i], [field]: val };
    onUpdate({ ...avatar, voyerismos: updated });
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">👁️ Cenas de Voyerismo</CardTitle>
          <div className="flex items-center gap-2">
            {projectId && (
              <AIGenerateButton
                projectId={projectId}
                action="execute_skill"
                label="Gerar Cenas"
                extraBody={{ skill_slug: "dossie-problemas", extra_instructions: "Gere cenas de voyerismo detalhadas: situação real do dia-a-dia, sintoma físico, pensamento interno, comportamento resultante e como usar na copy." }}
                onResult={() => {}}
                contextSources={["Avatar", "Dores", "Problemas"]}
              />
            )}
            <Button size="sm" variant="outline" onClick={add}><Plus className="h-3 w-3 mr-1" /> Cena</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">Cenas reais do dia-a-dia do avatar que revelam dor profunda. Usadas em hooks, aberturas de VSL e copy de alto impacto.</p>
          {voyerismos.map((v: any, i: number) => (
            <div key={i} className="p-4 rounded-md bg-secondary/50 border border-border space-y-3 relative">
              <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-6 w-6 text-destructive" onClick={() => remove(i)}>
                <Trash2 className="h-3 w-3" />
              </Button>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Nome da Cena</Label>
                  <Input value={v.nome || ""} onChange={e => edit(i, "nome", e.target.value)} className="bg-secondary" placeholder="Ex: A tesoura recusada" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Intensidade</Label>
                  <Input value={v.intensidade || ""} onChange={e => edit(i, "intensidade", e.target.value)} className="bg-secondary" placeholder="Ex: 9.2/10" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Situação</Label>
                <Textarea value={v.situacao || ""} onChange={e => edit(i, "situacao", e.target.value)} className="bg-secondary text-sm min-h-[50px]" placeholder="Descreva a cena exata..." />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Sintoma Físico</Label>
                  <Input value={v.sintoma_fisico || ""} onChange={e => edit(i, "sintoma_fisico", e.target.value)} className="bg-secondary" placeholder="Ex: mãos tremem, estômago contrai" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Pensamento</Label>
                  <Input value={v.pensamento || ""} onChange={e => edit(i, "pensamento", e.target.value)} className="bg-secondary" placeholder="Ex: 'E se eu estragar?'" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Comportamento Resultante</Label>
                <Input value={v.comportamento || ""} onChange={e => edit(i, "comportamento", e.target.value)} className="bg-secondary" placeholder="Ex: Indica outra profissional" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Uso na Copy</Label>
                <Textarea value={v.uso_copy || ""} onChange={e => edit(i, "uso_copy", e.target.value)} className="bg-secondary text-sm min-h-[40px]" placeholder="Como usar essa cena em hook/VSL/anúncio..." />
              </div>
            </div>
          ))}
          {voyerismos.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma cena de voyerismo cadastrada.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

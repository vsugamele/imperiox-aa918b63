import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";

interface Props {
  avatar: any;
  onUpdate: (avatar: any) => void;
}

export function ProblemasTab({ avatar, onUpdate }: Props) {
  const problemas = avatar.problemas || [];

  const add = () => onUpdate({
    ...avatar,
    problemas: [...problemas, { rank: problemas.length + 1, nome: "", total: 0, cena_voyerismo: "", scores: { dor: 0, frequencia: 0, comunicar: 0, resolver: 0, urgencia: 0, dinheiro: 0, social: 0 } }],
  });

  const remove = (i: number) => onUpdate({ ...avatar, problemas: problemas.filter((_: any, j: number) => j !== i) });

  const edit = (i: number, field: string, val: any) => {
    const updated = [...problemas];
    updated[i] = { ...updated[i], [field]: val };
    onUpdate({ ...avatar, problemas: updated });
  };

  const editScore = (i: number, scoreKey: string, val: number) => {
    const updated = [...problemas];
    const scores = { ...(updated[i].scores || {}), [scoreKey]: val };
    const total = Object.values(scores).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
    updated[i] = { ...updated[i], scores, total };
    onUpdate({ ...avatar, problemas: updated });
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🎯 Ranking de Problemas</CardTitle>
          <Button size="sm" variant="outline" onClick={add}><Plus className="h-3 w-3 mr-1" /> Problema</Button>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">Problemas rankeados por score multidimensional. Top 5 = base de hooks e abertura de VSL.</p>
          {problemas.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Problema</TableHead>
                    <TableHead className="w-16 text-center">Score</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {problemas.sort((a: any, b: any) => (b.total || 0) - (a.total || 0)).map((p: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{i + 1}</TableCell>
                      <TableCell>
                        <Input value={p.nome || ""} onChange={e => edit(i, "nome", e.target.value)} className="bg-transparent border-none p-0 h-auto text-sm" placeholder="Nome do problema..." />
                      </TableCell>
                      <TableCell className="text-center font-mono font-bold text-primary">{p.total || 0}/35</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => remove(i)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum problema cadastrado.</p>
          )}
        </CardContent>
      </Card>

      {/* Detail cards for each problem */}
      {problemas.map((p: any, i: number) => (
        <Card key={i} className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-sans">#{i + 1} — {p.nome || "Sem nome"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {["dor", "frequencia", "comunicar", "resolver", "urgencia", "dinheiro", "social"].map(key => (
                <div key={key}>
                  <Label className="text-[10px] text-muted-foreground uppercase">{key}</Label>
                  <Input type="number" min={0} max={5} value={p.scores?.[key] || 0} onChange={e => editScore(i, key, Number(e.target.value))} className="bg-secondary h-8 text-sm" />
                </div>
              ))}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Cena de Voyerismo Associada</Label>
              <Textarea value={p.cena_voyerismo || ""} onChange={e => edit(i, "cena_voyerismo", e.target.value)} className="bg-secondary text-sm min-h-[40px]" placeholder="Ex: Mão treme ao pegar tesoura..." />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { AIGenerateButton } from "../AIGenerateButton";

interface Props {
  avatar: any;
  onUpdate: (avatar: any) => void;
  projectId?: string;
}

// Meta para chaves conhecidas (HTML importado + legado manual)
const SCORE_META: Record<string, { label: string; color: string }> = {
  dor:        { label: "Dor",     color: "text-red-400" },
  desejo:     { label: "Desejo",  color: "text-blue-400" },
  piora:      { label: "Piora",   color: "text-orange-400" },
  veloc_:     { label: "Veloc.",  color: "text-purple-400" },
  pagar:      { label: "Pagar",   color: "text-emerald-400" },
  comun_:     { label: "Comun.",  color: "text-yellow-400" },
  freq_:      { label: "Freq.",   color: "text-pink-400" },
  // legado manual
  frequencia: { label: "Freq.",   color: "text-pink-400" },
  comunicar:  { label: "Comun.",  color: "text-yellow-400" },
  resolver:   { label: "Resolve", color: "text-blue-400" },
  urgencia:   { label: "Urgênc.", color: "text-purple-400" },
  dinheiro:   { label: "Dinheiro",color: "text-emerald-400" },
  social:     { label: "Social",  color: "text-orange-400" },
};
const FALLBACK_SCORE_KEYS = ["dor","desejo","piora","veloc_","pagar","comun_","freq_"];

export function ProblemasTab({ avatar, onUpdate, projectId }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const problemas = avatar.problemas || [];

  // Determine active score keys from first problem that has scores, or fallback
  const activeScoreKeys = (() => {
    const first = problemas.find((p: any) => p.scores && Object.keys(p.scores).length > 0);
    if (first) return Object.keys(first.scores);
    return FALLBACK_SCORE_KEYS;
  })();

  const add = () => {
    const emptyScores = Object.fromEntries(activeScoreKeys.map(k => [k, 0]));
    onUpdate({
      ...avatar,
      problemas: [...problemas, {
        rank: problemas.length + 1, nome: "", total: 0, cena_voyerismo: "",
        scores: emptyScores,
      }],
    });
  };

  const remove = (i: number) => {
    if (expanded === i) setExpanded(null);
    onUpdate({ ...avatar, problemas: problemas.filter((_: any, j: number) => j !== i) });
  };

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

  const sorted = [...problemas].sort((a: any, b: any) => (b.total || 0) - (a.total || 0));

  const getScoreColor = (score: number) => {
    if (score >= 28) return "text-red-400 border-red-500/30 bg-red-500/10";
    if (score >= 21) return "text-orange-400 border-orange-500/30 bg-orange-500/10";
    if (score >= 14) return "text-yellow-400 border-yellow-500/30 bg-yellow-500/10";
    return "text-muted-foreground border-border bg-secondary/50";
  };

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">Ranking de Problemas</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Top 5 = base de hooks, VSL e headlines</p>
          </div>
          <div className="flex items-center gap-2">
            {projectId && (
              <AIGenerateButton
                projectId={projectId}
                action="execute_skill"
                label="Gerar Problemas"
                showMenteSelector={true}
                extraBody={{ skill_slug: "dossie-problemas", extra_instructions: "Gere ranking de problemas com scores (dor, desejo, piora, velocidade, pagar, comunicar, frequência) e cenas de voyerismo associadas." }}
                onResult={() => {}}
                contextSources={["Avatar", "Dores", "Desejos"]}
              />
            )}
            <Button size="sm" variant="outline" onClick={add}><Plus className="h-3 w-3 mr-1" /> Problema</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {sorted.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Nenhum problema cadastrado.</p>}
          {sorted.map((p: any, i: number) => {
            const origIdx = problemas.indexOf(p);
            const isOpen = expanded === origIdx;
            return (
              <div key={i} className="rounded-md border border-border overflow-hidden">
                <div
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-secondary/50 transition-colors"
                  onClick={() => setExpanded(isOpen ? null : origIdx)}
                >
                  <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <Input
                      value={p.nome || ""}
                      onChange={e => { e.stopPropagation(); edit(origIdx, "nome", e.target.value); }}
                      onClick={e => e.stopPropagation()}
                      className="bg-transparent border-none p-0 h-auto text-sm font-medium focus-visible:ring-0"
                      placeholder="Nome do problema..."
                    />
                  </div>
                  <Badge variant="outline" className={`text-xs font-mono shrink-0 border ${getScoreColor(p.total || 0)}`}>
                    {p.total || 0}/35
                  </Badge>
                  <Button
                    size="icon" variant="ghost"
                    className="h-6 w-6 text-destructive shrink-0"
                    onClick={e => { e.stopPropagation(); remove(origIdx); }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                  {isOpen ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                </div>
                {isOpen && (
                  <div className="border-t border-border px-3 py-3 bg-secondary/30 space-y-3">
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                      {activeScoreKeys.map(sk => {
                        const meta = SCORE_META[sk] || { label: sk, color: "text-muted-foreground" };
                        return (
                          <div key={sk} className="text-center">
                            <Label className={`text-[10px] font-mono uppercase ${meta.color}`}>{meta.label}</Label>
                            <Input
                              type="number" min={0} max={5}
                              value={p.scores?.[sk] || 0}
                              onChange={e => editScore(origIdx, sk, Number(e.target.value))}
                              className="bg-secondary h-8 text-sm text-center mt-1 px-1"
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Cena de Voyerismo Associada</Label>
                      <Textarea
                        value={p.cena_voyerismo || ""}
                        onChange={e => edit(origIdx, "cena_voyerismo", e.target.value)}
                        className="bg-secondary text-sm min-h-[40px] mt-1"
                        placeholder="Ex: Mao treme ao pegar a tesoura..."
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

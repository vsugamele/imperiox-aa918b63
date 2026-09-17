import type { Json } from "@/integrations/supabase/types";
import { jsonFields, jsonText, jsonNumber } from "@/lib/json-fields";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import { AIGenerateButton } from "@/components/projeto/AIGenerateButton";
import { ConfidenceBadge } from "@/components/projeto/avatar/ConfidenceBadge";

interface Props {
  avatar: Json;
  onUpdate: (avatar: Json) => void;
  projectId?: string;
}

function RankedList({ items, onUpdate, label, accent }: { items: Array<{ [key: string]: Json | undefined }>; onUpdate: (items: Array<{ [key: string]: Json | undefined }>) => void; label: string; accent: string }) {
  const add = () => onUpdate([...items, { rank: items.length + 1, nome: "", score: 0, justificativa: "" }]);
  const remove = (i: number) => onUpdate(items.filter((_, j) => j !== i));
  const edit = (i: number, field: string, val: string | number) => {
    const updated = [...items];
    updated[i] = { ...updated[i], [field]: val };
    onUpdate(updated);
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">{label}</CardTitle>
        <Button size="sm" variant="outline" onClick={add}><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item, i: number) => (
          <div key={i} className={`p-3 rounded-md bg-secondary/50 border ${accent} space-y-2 relative`}>
            <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-6 w-6 text-destructive" onClick={() => remove(i)}>
              <Trash2 className="h-3 w-3" />
            </Button>
            <div className="flex gap-3 items-center">
              <span className="text-xs font-mono text-muted-foreground w-6">#{jsonNumber(item.rank) || i + 1}</span>
              <Input value={jsonText(item.nome) ?? jsonNumber(item.nome) ?? ""} onChange={e => edit(i, "nome", e.target.value)} className="bg-secondary flex-1" placeholder="Nome do desejo..." />
              <Input type="number" value={jsonText(item.score) ?? jsonNumber(item.score) ?? ""} onChange={e => edit(i, "score", Number(e.target.value))} className="bg-secondary w-20" placeholder="Score" />
            </div>
            <Textarea value={jsonText(item.justificativa) ?? jsonNumber(item.justificativa) ?? ""} onChange={e => edit(i, "justificativa", e.target.value)} className="bg-secondary text-sm min-h-[40px]" placeholder="Justificativa / evidência..." />
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground">Nenhum desejo cadastrado.</p>}
      </CardContent>
    </Card>
  );
}

export function DesejosTab({ avatar: rawAvatar, onUpdate, projectId }: Props) {
  const avatar = jsonFields(rawAvatar);
  const meta = jsonFields(avatar._avatar_meta);
  return (
    <div className="space-y-6">
      {projectId && (
        <div className="flex justify-between items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Confiança por bloco:</span>
            <span className="text-[10px] text-muted-foreground">Externos</span><ConfidenceBadge meta={{ score: jsonNumber(jsonFields(meta.desejos_externos).score), reason: jsonText(jsonFields(meta.desejos_externos).reason), source: jsonText(jsonFields(meta.desejos_externos).source), evidence_ids: Array.isArray(jsonFields(meta.desejos_externos).evidence_ids) ? (jsonFields(meta.desejos_externos).evidence_ids as Json[]).filter((value): value is string => typeof value === "string") : [] }} />
            <span className="text-[10px] text-muted-foreground">Internos</span><ConfidenceBadge meta={{ score: jsonNumber(jsonFields(meta.desejos_internos).score), reason: jsonText(jsonFields(meta.desejos_internos).reason), source: jsonText(jsonFields(meta.desejos_internos).source), evidence_ids: Array.isArray(jsonFields(meta.desejos_internos).evidence_ids) ? (jsonFields(meta.desejos_internos).evidence_ids as Json[]).filter((value): value is string => typeof value === "string") : [] }} />
            <span className="text-[10px] text-muted-foreground">Proibidos</span><ConfidenceBadge meta={{ score: jsonNumber(jsonFields(meta.desejos_proibidos).score), reason: jsonText(jsonFields(meta.desejos_proibidos).reason), source: jsonText(jsonFields(meta.desejos_proibidos).source), evidence_ids: Array.isArray(jsonFields(meta.desejos_proibidos).evidence_ids) ? (jsonFields(meta.desejos_proibidos).evidence_ids as Json[]).filter((value): value is string => typeof value === "string") : [] }} />
          </div>
          <AIGenerateButton
            projectId={projectId}
            action="execute_skill"
            label="Mapear Desejos"
            showMenteSelector={true}
            extraBody={{ skill_slug: "mapeamento-desejos", extra_instructions: "Mapeie desejos externos, internos e proibidos do avatar com scores e justificativas." }}
            onResult={() => {}}
            contextSources={["Avatar", "Briefing", "Dores"]}
          />
        </div>
      )}
      <RankedList
        items={Array.isArray(avatar.desejos_externos) ? avatar.desejos_externos.map(jsonFields) : []}
        onUpdate={items => onUpdate({ ...avatar, desejos_externos: items })}
        label="🎯 Desejos Externos (Score /80)"
        accent="border-primary/20"
      />
      <RankedList
        items={Array.isArray(avatar.desejos_internos) ? avatar.desejos_internos.map(jsonFields) : []}
        onUpdate={items => onUpdate({ ...avatar, desejos_internos: items })}
        label="💎 Desejos Internos — Mais Transformadores"
        accent="border-destructive/20"
      />
      <RankedList
        items={Array.isArray(avatar.desejos_proibidos) ? avatar.desejos_proibidos.map(jsonFields) : []}
        onUpdate={items => onUpdate({ ...avatar, desejos_proibidos: items })}
        label="🔥 Desejos Proibidos — Os Mais Poderosos"
        accent="border-amber-500/20"
      />
    </div>
  );
}

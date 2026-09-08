import type { Json } from "@/integrations/supabase/types";
import { jsonFields, jsonText, jsonNumber } from "@/lib/json-fields";
import { avatarConfidence } from "@/components/projeto/avatar/avatar-health";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditableTagList } from "../EditableTagList";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export function DoresTab({ avatar: rawAvatar, onUpdate, projectId }: Props) {
  const avatar = jsonFields(rawAvatar);
  const strings = (value: Json | undefined) => Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  const update = (key: string, val: Json) => onUpdate({ ...avatar, [key]: val });
  const subAvatares = Array.isArray(avatar.sub_avatares) ? avatar.sub_avatares.map(jsonFields) : [];
  const meta = jsonFields(avatar._avatar_meta);

  const updateSub = (i: number, field: string, val: Json) => {
    const updated = [...subAvatares];
    updated[i] = { ...updated[i], [field]: val };
    onUpdate({ ...avatar, sub_avatares: updated });
  };
  const addSub = () => onUpdate({ ...avatar, sub_avatares: [...subAvatares, { nome: "", descricao: "", urgencia: 3, dinheiro: 3 }] });
  const removeSub = (i: number) => onUpdate({ ...avatar, sub_avatares: subAvatares.filter((_: Json, j: number) => j !== i) });

  const ScoreDots = ({ value, max = 5 }: { value: number; max?: number }) => (
    <div className="flex gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} className={`h-2 w-2 rounded-full ${i < value ? "bg-primary" : "bg-muted"}`} />
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🩸 Dores & Medos</CardTitle>
          {projectId && (
            <AIGenerateButton
              projectId={projectId}
              action="execute_skill"
              label="Gerar Dores"
              showMenteSelector={true}
              extraBody={{ skill_slug: "dossie-problemas", extra_instructions: "Foque em mapear dores superficiais, dores profundas, medos específicos e objeções reais do avatar." }}
              onResult={(data: Json) => {
                const result = jsonText(jsonFields(data).result);
                if (!result) return;
                try {
                  const parsed: unknown = JSON.parse(result);
                  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
                  const next = { ...avatar };
                  for (const key of ["dores_superficiais", "dores_profundas", "medos"]) {
                    const values: unknown = Reflect.get(parsed, key);
                    if (Array.isArray(values)) next[key] = [...strings(avatar[key]), ...values.filter((v): v is string => typeof v === "string")];
                  }
                  onUpdate(next);
                } catch { /* result is markdown, not structured */ }
              }}
              contextSources={["Avatar", "Briefing", "Concorrentes"]}
            />
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1"><Label className="text-xs text-muted-foreground">Dores Superficiais</Label><ConfidenceBadge meta={avatarConfidence(meta.dores_superficiais)} /></div>
            <EditableTagList tags={strings(avatar.dores_superficiais)} onChange={v => update("dores_superficiais", v)} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1"><Label className="text-xs text-muted-foreground">Dores Profundas</Label><ConfidenceBadge meta={avatarConfidence(meta.dores_profundas)} /></div>
            <EditableTagList tags={strings(avatar.dores_profundas)} onChange={v => update("dores_profundas", v)} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1"><Label className="text-xs text-muted-foreground">Medos Específicos</Label><ConfidenceBadge meta={avatarConfidence(meta.medos)} /></div>
            <EditableTagList tags={strings(avatar.medos)} onChange={v => update("medos", v)} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1"><Label className="text-xs text-muted-foreground">Objeções Reais</Label><ConfidenceBadge meta={avatarConfidence(meta.objecoes)} /></div>
            <EditableTagList tags={strings(avatar.objecoes)} onChange={v => update("objecoes", v)} />
          </div>
        </CardContent>
      </Card>

      {/* Sub-Avatares */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">👥 Sub-Avatares</CardTitle>
          <Button size="sm" variant="outline" onClick={addSub}><Plus className="h-3 w-3 mr-1" /> Sub</Button>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {subAvatares.map((sub, i: number) => (
            <div key={i} className="p-4 rounded-md bg-secondary/50 border border-border space-y-3 relative">
              <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-6 w-6 text-destructive" onClick={() => removeSub(i)}>
                <Trash2 className="h-3 w-3" />
              </Button>
              <Input value={jsonText(sub.nome) || ""} onChange={e => updateSub(i, "nome", e.target.value)} className="bg-secondary font-medium" placeholder="Nome do sub-avatar" />
              <Textarea value={jsonText(sub.descricao) || ""} onChange={e => updateSub(i, "descricao", e.target.value)} className="bg-secondary text-sm min-h-[50px]" placeholder="Descrição / situação..." />
              {jsonText(sub.dor_principal) && (
                <div className="text-xs border-l-2 border-destructive/50 pl-2">
                  <span className="text-destructive/70 font-mono uppercase tracking-wide text-[10px]">Dor</span>
                  <p className="text-foreground/80">{jsonText(sub.dor_principal)}</p>
                </div>
              )}
              {jsonText(sub.hook) && (
                <div className="text-xs border-l-2 border-primary/50 pl-2">
                  <span className="text-primary/70 font-mono uppercase tracking-wide text-[10px]">Hook</span>
                  <p className="text-foreground/80 italic">{jsonText(sub.hook)}</p>
                </div>
              )}
              {jsonText(sub.crenca_bloqueadora) && (
                <div className="text-xs border-l-2 border-amber-500/50 pl-2">
                  <span className="text-amber-500/70 font-mono uppercase tracking-wide text-[10px]">Crença Bloqueadora</span>
                  <p className="text-foreground/80 italic">"{jsonText(sub.crenca_bloqueadora)}"</p>
                </div>
              )}
              {jsonText(sub.crenca_necessaria) && (
                <div className="text-xs border-l-2 border-emerald-500/50 pl-2">
                  <span className="text-emerald-500/70 font-mono uppercase tracking-wide text-[10px]">Crença Necessária</span>
                  <p className="text-foreground/80 italic">"{jsonText(sub.crenca_necessaria)}"</p>
                </div>
              )}
              {jsonText(sub.objecao) && (
                <div className="text-xs bg-secondary/50 rounded px-2 py-1">
                  <span className="text-muted-foreground font-mono uppercase tracking-wide text-[10px]">Objeção: </span>
                  <span className="text-foreground/80 italic">"{jsonText(sub.objecao)}"</span>
                </div>
              )}
              {jsonText(sub.asset_primario) && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-mono uppercase tracking-wide text-[10px]">Asset: </span>
                  <span>{jsonText(sub.asset_primario)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs text-muted-foreground pt-1">
                <div className="space-y-1"><span>Urgência</span><ScoreDots value={jsonNumber(sub.urgencia) || 0} /></div>
                <div className="space-y-1"><span>Dinheiro</span><ScoreDots value={jsonNumber(sub.dinheiro) || 0} /></div>
              </div>
            </div>
          ))}
          {subAvatares.length === 0 && <p className="text-sm text-muted-foreground col-span-2">Nenhum sub-avatar.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

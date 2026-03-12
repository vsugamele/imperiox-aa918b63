import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { EditableTagList } from "./EditableTagList";

const STORYBOARD_SECTIONS = [
  { key: "antes", label: "🟢 Antes", border: "border-l-green-500" },
  { key: "trigger", label: "🟡 Trigger", border: "border-l-yellow-500" },
  { key: "busca", label: "🟠 Busca", border: "border-l-orange-500" },
  { key: "objecao", label: "🔴 Objeção", border: "border-l-red-500" },
  { key: "decisao", label: "🔵 Decisão", border: "border-l-blue-500" },
];

interface Props {
  project: any;
  onUpdateData: (data: any) => void;
  onUpdateAvatar: (avatar: any) => void;
}

export function ProjetoAvatar({ project, onUpdateData, onUpdateAvatar }: Props) {
  const avatar = project.avatar || {};
  const data = project.data || {};
  const subAvatares = avatar.sub_avatares || [];
  const storyboard = avatar.storyboard || {};

  const update = (key: string, val: any) => onUpdateAvatar({ ...avatar, [key]: val });

  const updateSub = (i: number, field: string, val: any) => {
    const updated = [...subAvatares];
    updated[i] = { ...updated[i], [field]: val };
    onUpdateAvatar({ ...avatar, sub_avatares: updated });
  };

  const addSub = () => {
    onUpdateAvatar({ ...avatar, sub_avatares: [...subAvatares, { nome: "", descricao: "", urgencia: 3, dinheiro: 3 }] });
  };

  const removeSub = (i: number) => {
    onUpdateAvatar({ ...avatar, sub_avatares: subAvatares.filter((_: any, j: number) => j !== i) });
  };

  const updateStory = (key: string, val: string) => {
    onUpdateAvatar({ ...avatar, storyboard: { ...storyboard, [key]: val } });
  };

  const ScoreDots = ({ value, max = 5 }: { value: number; max?: number }) => (
    <div className="flex gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} className={`h-2 w-2 rounded-full ${i < value ? "bg-primary" : "bg-muted"}`} />
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Desejos */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">💫 Desejos & Motivação</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Desejo Externo</Label>
            <Input value={avatar.desejo_externo || ""} onChange={(e) => update("desejo_externo", e.target.value)} className="bg-secondary" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Desejo Interno Core</Label>
            <Input value={avatar.desejo_interno || ""} onChange={(e) => update("desejo_interno", e.target.value)} className="bg-secondary" />
          </div>
        </CardContent>
      </Card>

      {/* Dores & Medos */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🩸 Dores & Medos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Dores Superficiais</Label>
            <EditableTagList tags={avatar.dores_superficiais || []} onChange={(v) => update("dores_superficiais", v)} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Dores Profundas</Label>
            <EditableTagList tags={avatar.dores_profundas || []} onChange={(v) => update("dores_profundas", v)} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Medos Específicos</Label>
            <EditableTagList tags={avatar.medos || []} onChange={(v) => update("medos", v)} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Objeções Reais</Label>
            <EditableTagList tags={avatar.objecoes || []} onChange={(v) => update("objecoes", v)} />
          </div>
        </CardContent>
      </Card>

      {/* Posicionamento */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🧠 Posicionamento Psicológico</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Inimigo</Label>
            <Input value={avatar.inimigo || ""} onChange={(e) => update("inimigo", e.target.value)} className="bg-secondary" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Resultado Sonhado</Label>
            <Input value={avatar.resultado_sonhado || ""} onChange={(e) => update("resultado_sonhado", e.target.value)} className="bg-secondary" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Trigger Event</Label>
            <Input value={avatar.trigger_event || ""} onChange={(e) => update("trigger_event", e.target.value)} className="bg-secondary" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Fase de Consciência</Label>
            <Input value={avatar.fase_consciencia || ""} onChange={(e) => update("fase_consciencia", e.target.value)} className="bg-secondary" />
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
          {subAvatares.map((sub: any, i: number) => (
            <div key={i} className="p-4 rounded-md bg-secondary/50 border border-border space-y-3 relative">
              <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-6 w-6 text-destructive" onClick={() => removeSub(i)}>
                <Trash2 className="h-3 w-3" />
              </Button>
              <Input value={sub.nome || ""} onChange={(e) => updateSub(i, "nome", e.target.value)} className="bg-secondary font-medium" placeholder="Nome do sub-avatar" />
              <Textarea value={sub.descricao || ""} onChange={(e) => updateSub(i, "descricao", e.target.value)} className="bg-secondary text-sm min-h-[50px]" placeholder="Descrição..." />
              <div className="flex justify-between text-xs text-muted-foreground">
                <div className="space-y-1">
                  <span>Urgência</span>
                  <ScoreDots value={sub.urgencia || 0} />
                </div>
                <div className="space-y-1">
                  <span>Dinheiro</span>
                  <ScoreDots value={sub.dinheiro || 0} />
                </div>
              </div>
            </div>
          ))}
          {subAvatares.length === 0 && <p className="text-sm text-muted-foreground col-span-2">Nenhum sub-avatar.</p>}
        </CardContent>
      </Card>

      {/* Storyboard */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">📖 Storyboard Narrativo</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {STORYBOARD_SECTIONS.map((s) => (
            <div key={s.key} className={`border-l-4 ${s.border} pl-4`}>
              <Label className="text-xs font-semibold">{s.label}</Label>
              <Textarea
                value={storyboard[s.key] || ""}
                onChange={(e) => updateStory(s.key, e.target.value)}
                className="bg-secondary text-sm min-h-[60px] mt-1"
                placeholder={`Descreva a fase "${s.label}"...`}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  avatar: any;
  onUpdate: (avatar: any) => void;
}

export function PerfilTab({ avatar, onUpdate }: Props) {
  const perfil = avatar.perfil_psicologico || {};
  const update = (key: string, val: any) => onUpdate({ ...avatar, [key]: val });
  const updatePerfil = (key: string, val: string) =>
    onUpdate({ ...avatar, perfil_psicologico: { ...perfil, [key]: val } });

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🧠 Perfil Psicológico</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Retrato do Avatar</Label>
            <Textarea value={perfil.retrato || ""} onChange={e => updatePerfil("retrato", e.target.value)} className="bg-secondary min-h-[80px]" placeholder="Descrição detalhada do avatar..." />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Arquétipo</Label>
              <Input value={perfil.arquetipo || ""} onChange={e => updatePerfil("arquetipo", e.target.value)} className="bg-secondary" placeholder="Ex: O Mártir Competente" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Ferida Central</Label>
              <Input value={perfil.ferida_central || ""} onChange={e => updatePerfil("ferida_central", e.target.value)} className="bg-secondary" placeholder="Ex: Não se sentir merecedora..." />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Padrão de Autossabotagem</Label>
              <Input value={perfil.padrao || ""} onChange={e => updatePerfil("padrao", e.target.value)} className="bg-secondary" placeholder="Ex: Acumula conhecimento mas não age" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Contradição Central</Label>
              <Input value={perfil.contradicao || ""} onChange={e => updatePerfil("contradicao", e.target.value)} className="bg-secondary" placeholder="Ex: Sabe que é boa mas cobra barato" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">💫 Desejos & Motivação Core</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Desejo Externo</Label>
            <Input value={avatar.desejo_externo || ""} onChange={e => update("desejo_externo", e.target.value)} className="bg-secondary" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Desejo Interno Core</Label>
            <Input value={avatar.desejo_interno || ""} onChange={e => update("desejo_interno", e.target.value)} className="bg-secondary" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Inimigo</Label>
              <Input value={avatar.inimigo || ""} onChange={e => update("inimigo", e.target.value)} className="bg-secondary" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Resultado Sonhado</Label>
              <Input value={avatar.resultado_sonhado || ""} onChange={e => update("resultado_sonhado", e.target.value)} className="bg-secondary" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Trigger Event</Label>
              <Input value={avatar.trigger_event || ""} onChange={e => update("trigger_event", e.target.value)} className="bg-secondary" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Fase de Consciência</Label>
              <Input value={avatar.fase_consciencia || ""} onChange={e => update("fase_consciencia", e.target.value)} className="bg-secondary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Camadas da Psique */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🔬 Camadas da Psique (C1–C4)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "c1_observaveis", label: "C1 — Comportamentos Observáveis", color: "border-l-emerald-500" },
            { key: "c2_conscientes", label: "C2 — Desejos Conscientes", color: "border-l-blue-500" },
            { key: "c3_subconscientes", label: "C3 — Crenças Subconscientes", color: "border-l-amber-500" },
            { key: "c4_trauma", label: "C4 — Trauma / Ferida Core", color: "border-l-red-500" },
          ].map(c => {
            const camadas = avatar.camadas_psique || {};
            return (
              <div key={c.key} className={`border-l-4 ${c.color} pl-4`}>
                <Label className="text-xs font-semibold">{c.label}</Label>
                <Textarea
                  value={camadas[c.key] || ""}
                  onChange={e => onUpdate({ ...avatar, camadas_psique: { ...camadas, [c.key]: e.target.value } })}
                  className="bg-secondary text-sm min-h-[60px] mt-1"
                  placeholder={`Descreva ${c.label}...`}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Engenharia de Crença */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">⚡ Engenharia de Crença</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="border-l-4 border-l-red-500 pl-4">
            <Label className="text-xs font-semibold text-destructive">⛔ Crença Bloqueadora</Label>
            <Textarea value={avatar.crenca_bloqueadora || ""} onChange={e => update("crenca_bloqueadora", e.target.value)} className="bg-secondary text-sm min-h-[60px] mt-1" placeholder="A crença que trava o avatar..." />
          </div>
          <div className="border-l-4 border-l-emerald-500 pl-4">
            <Label className="text-xs font-semibold text-emerald-400">✓ Crença Necessária</Label>
            <Textarea value={avatar.crenca_necessaria || ""} onChange={e => update("crenca_necessaria", e.target.value)} className="bg-secondary text-sm min-h-[60px] mt-1" placeholder="A crença que precisa ser instalada..." />
          </div>
          <div className="border-l-4 border-l-primary pl-4">
            <Label className="text-xs font-semibold text-primary">⚡ Epifania Central</Label>
            <Textarea value={avatar.epifania_central || ""} onChange={e => update("epifania_central", e.target.value)} className="bg-secondary text-sm min-h-[60px] mt-1" placeholder="O momento de virada..." />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

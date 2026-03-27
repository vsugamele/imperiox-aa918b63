import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  avatar: any;
  onUpdate: (avatar: any) => void;
  projectId?: string;
}

const STORYBOARD_SECTIONS = [
  { key: "antes", label: "🟢 Antes", border: "border-l-green-500" },
  { key: "trigger", label: "🟡 Trigger", border: "border-l-yellow-500" },
  { key: "busca", label: "🟠 Busca", border: "border-l-orange-500" },
  { key: "objecao", label: "🔴 Objeção", border: "border-l-red-500" },
  { key: "decisao", label: "🔵 Decisão", border: "border-l-blue-500" },
];

export function GatilhosTab({ avatar, onUpdate, projectId }: Props) {
  const gatilhos = avatar.gatilhos || [];
  const storyboard = avatar.storyboard || {};
  const [generating, setGenerating] = useState(false);

  const add = () => onUpdate({
    ...avatar,
    gatilhos: [...gatilhos, { nome: "", categoria: "", intensidade: "", situacao: "", copy_sugerido: "" }],
  });

  const remove = (i: number) => onUpdate({ ...avatar, gatilhos: gatilhos.filter((_: any, j: number) => j !== i) });

  const edit = (i: number, field: string, val: string) => {
    const updated = [...gatilhos];
    updated[i] = { ...updated[i], [field]: val };
    onUpdate({ ...avatar, gatilhos: updated });
  };

  const updateStory = (key: string, val: string) => {
    onUpdate({ ...avatar, storyboard: { ...storyboard, [key]: val } });
  };

  const generateWithAI = async () => {
    if (!projectId) {
      toast.error("ID do projeto não disponível");
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("openflow-ai", {
        body: { project_id: projectId, action: "generate_gatilhos" },
      });
      if (error) throw error;
      if (data?.gatilhos) {
        const g = data.gatilhos;
        const newAvatar = { ...avatar };

        if (g.gatilhos && (!gatilhos.length || gatilhos.every((gt: any) => !gt.nome))) {
          newAvatar.gatilhos = g.gatilhos;
        }
        if (g.storyboard) {
          const newStory = { ...storyboard };
          for (const key of Object.keys(g.storyboard)) {
            if (!newStory[key]) newStory[key] = g.storyboard[key];
          }
          newAvatar.storyboard = newStory;
        }
        if (!avatar.gatilho_nuclear && g.gatilho_nuclear) newAvatar.gatilho_nuclear = g.gatilho_nuclear;
        if (!avatar.the_high && g.the_high) newAvatar.the_high = g.the_high;
        if (!avatar.the_hell && g.the_hell) newAvatar.the_hell = g.the_hell;
        if (!avatar.segredo_final && g.segredo_final) newAvatar.segredo_final = g.segredo_final;

        onUpdate(newAvatar);
        toast.success("Gatilhos gerados com IA! Campos vazios preenchidos.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar gatilhos com IA");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Gatilhos Emocionais */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">⚡ Gatilhos Emocionais</CardTitle>
          <div className="flex items-center gap-2">
            {projectId && (
              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={generateWithAI} disabled={generating}>
                {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {generating ? "Gerando..." : "Gerar com IA"}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={add}><Plus className="h-3 w-3 mr-1" /> Gatilho</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {gatilhos.map((g: any, i: number) => (
            <div key={i} className="p-3 rounded-md bg-secondary/50 border border-border space-y-2 relative">
              <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-6 w-6 text-destructive" onClick={() => remove(i)}>
                <Trash2 className="h-3 w-3" />
              </Button>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Nome</Label>
                  <Input value={g.nome || ""} onChange={e => edit(i, "nome", e.target.value)} className="bg-secondary" placeholder="Ex: Medo de rejeição" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Categoria</Label>
                  <Input value={g.categoria || ""} onChange={e => edit(i, "categoria", e.target.value)} className="bg-secondary" placeholder="Ex: Medo, Raiva, Vergonha" />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Intensidade</Label>
                  <Input value={g.intensidade || ""} onChange={e => edit(i, "intensidade", e.target.value)} className="bg-secondary" placeholder="Ex: 9/10" />
                </div>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Situação que Ativa</Label>
                <Input value={g.situacao || ""} onChange={e => edit(i, "situacao", e.target.value)} className="bg-secondary" />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Copy Sugerido</Label>
                <Textarea value={g.copy_sugerido || ""} onChange={e => edit(i, "copy_sugerido", e.target.value)} className="bg-secondary text-sm min-h-[40px]" />
              </div>
            </div>
          ))}
          {gatilhos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum gatilho.</p>}
        </CardContent>
      </Card>

      {/* Storyboard Narrativo */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">📖 Storyboard Narrativo</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {STORYBOARD_SECTIONS.map(s => (
            <div key={s.key} className={`border-l-4 ${s.border} pl-4`}>
              <Label className="text-xs font-semibold">{s.label}</Label>
              <Textarea
                value={storyboard[s.key] || ""}
                onChange={e => updateStory(s.key, e.target.value)}
                className="bg-secondary text-sm min-h-[60px] mt-1"
                placeholder={`Descreva a fase "${s.label}"...`}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Síntese Estratégica */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🎯 Síntese Estratégica</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Gatilho Nuclear</Label>
            <Textarea value={avatar.gatilho_nuclear || ""} onChange={e => onUpdate({ ...avatar, gatilho_nuclear: e.target.value })} className="bg-secondary text-sm min-h-[50px]" placeholder="Trauma + frase + sintoma físico..." />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">O High (momento ideal)</Label>
              <Textarea value={avatar.the_high || ""} onChange={e => onUpdate({ ...avatar, the_high: e.target.value })} className="bg-secondary text-sm min-h-[50px]" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">O Hell (pior cenário)</Label>
              <Textarea value={avatar.the_hell || ""} onChange={e => onUpdate({ ...avatar, the_hell: e.target.value })} className="bg-secondary text-sm min-h-[50px]" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">O Segredo Final</Label>
            <Textarea value={avatar.segredo_final || ""} onChange={e => onUpdate({ ...avatar, segredo_final: e.target.value })} className="bg-secondary text-sm min-h-[50px]" placeholder="O que o avatar realmente compra..." />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Ângulo de Diferenciação</Label>
            <Input value={avatar.angulo_diferenciacao || ""} onChange={e => onUpdate({ ...avatar, angulo_diferenciacao: e.target.value })} className="bg-secondary" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Check, RotateCcw, Shuffle, Film, Wand2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  buildVideoPrompt, buildVideoPromptJson, emptyVideoFields,
  type VideoFields, type VideoPlatform,
} from "@/lib/videoPromptBuilder";
import * as o from "./videoPromptOptions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
      {children}
    </Label>
  );
}

function Sel({
  label, value, options, onChange,
}: { label: string; value: string; options: o.Opt[]; onChange: (v: string) => void }) {
  const known = options.find((opt) => opt.value === value);
  const selectValue = known ? value : (value === "" ? "__empty__" : "__free__");
  return (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      <Select
        value={selectValue}
        onValueChange={(v) => {
          if (v === "__empty__" || v === "__free__") return;
          onChange(v);
        }}
      >
        <SelectTrigger className="bg-secondary/40 border-border/60 h-9 text-[13px]">
          <SelectValue placeholder="Selecionar…" />
        </SelectTrigger>
        <SelectContent className="max-h-72 bg-popover">
          {options.map((opt, i) => (
            <SelectItem key={i} value={opt.value || `__opt_${i}`}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ou escreva livre (em inglês cinematográfico)…"
        className="bg-secondary/20 border-border/40 h-8 text-[12px]"
      />
    </div>
  );
}

const DRAFT_KEY = "videoPrompt:draft:v1";

function loadDraft(): VideoFields {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return { ...emptyVideoFields, ...JSON.parse(raw) };
  } catch {}
  return emptyVideoFields;
}

export function VideoPromptGenerator() {
  const [f, setF] = useState<VideoFields>(loadDraft);
  const [tab, setTab] = useState("acao");
  const [copied, setCopied] = useState<"text" | "json" | null>(null);
  const [refining, setRefining] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof VideoFields, v: string) => {
    setF((p) => {
      const next = { ...p, [k]: v };
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const promptText = useMemo(() => buildVideoPrompt(f), [f]);
  const promptJson = useMemo(() => JSON.stringify(buildVideoPromptJson(f), null, 2), [f]);

  const copy = async (kind: "text" | "json") => {
    await navigator.clipboard.writeText(kind === "text" ? promptText : promptJson);
    setCopied(kind);
    toast.success(kind === "text" ? "Prompt copiado" : "JSON copiado");
    setTimeout(() => setCopied(null), 1500);
  };

  const surprise = () => {
    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    setF((p) => ({
      ...p,
      movimentoPrincipal: pick(o.MOVIMENTO_PRINCIPAL).value,
      movimentoCorpo: pick(o.MOVIMENTO_CORPO).value,
      expressaoFacial: pick(o.EXPRESSAO_FACIAL).value,
      olharDirecao: pick(o.OLHAR_DIRECAO).value,
      movimentoCamera: pick(o.MOVIMENTO_CAMERA).value,
      velocidadeCamera: pick(o.VELOCIDADE_CAMERA).value,
      somAmbiente: pick(o.SOM_AMBIENTE).value,
      musicaFundo: pick(o.MUSICA_FUNDO).value,
      atmosferaMood: pick(o.ATMOSFERA_MOOD).value,
      estiloVisual: pick(o.ESTILO_VISUAL).value,
      continuidade: pick(o.CONTINUIDADE).value,
    }));
    toast.success("Cena surpresa gerada");
  };

  const refine = async () => {
    if (refining) return;
    setRefining(true);
    try {
      const { data, error } = await supabase.functions.invoke("prompt-refiner", {
        body: { prompt: promptText, mode: "video_editorial", platform: f.plataforma },
      });
      if (error) throw error;
      const refined = (data as any)?.refined || (data as any)?.prompt;
      if (refined) {
        await navigator.clipboard.writeText(refined);
        toast.success("Refinado pela IA — copiado");
      } else {
        toast.error("Refinador não retornou texto");
      }
    } catch (e: any) {
      toast.error(e?.message || "Falha ao refinar");
    } finally {
      setRefining(false);
    }
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("imphq_prompts_salvos").insert({
        tipo: "video",
        plataforma: f.plataforma,
        prompt_text: promptText,
        prompt_json: buildVideoPromptJson(f),
        campos: f as any,
      } as any);
      if (error) throw error;
      toast.success("Salvo no Cofre");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Esquerda — Formulário */}
      <Card className="col-span-12 lg:col-span-7 p-5 bg-card/60 border-border/60">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="brand-kicker text-primary">Camadas Cinematográficas</div>
            <h2 className="font-display text-2xl text-foreground">Vídeo · Prompt Studio</h2>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={surprise}>
              <Shuffle className="h-3.5 w-3.5 mr-1" /> Surpreender
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setF(emptyVideoFields); toast.success("Resetado"); }}>
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-6 w-full">
            <TabsTrigger value="acao">Ação</TabsTrigger>
            <TabsTrigger value="personagem">Personagem</TabsTrigger>
            <TabsTrigger value="camera">Câmera</TabsTrigger>
            <TabsTrigger value="audio">Áudio</TabsTrigger>
            <TabsTrigger value="voz">Voz</TabsTrigger>
            <TabsTrigger value="tech">Técnico</TabsTrigger>
          </TabsList>

          <TabsContent value="acao" className="mt-4 space-y-3">
            <Sel label="Movimento principal" value={f.movimentoPrincipal} options={o.MOVIMENTO_PRINCIPAL} onChange={(v) => set("movimentoPrincipal", v)} />
            <p className="text-[11px] text-muted-foreground italic leading-relaxed">
              O verbo da cena — sem isso a IA não sabe o que animar. Use frases com ritmo: "embaralha lentamente", "estende a mão".
            </p>
          </TabsContent>

          <TabsContent value="personagem" className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <Sel label="Movimento do corpo" value={f.movimentoCorpo} options={o.MOVIMENTO_CORPO} onChange={(v) => set("movimentoCorpo", v)} />
            <Sel label="Expressão facial" value={f.expressaoFacial} options={o.EXPRESSAO_FACIAL} onChange={(v) => set("expressaoFacial", v)} />
            <Sel label="Olhar / direção" value={f.olharDirecao} options={o.OLHAR_DIRECAO} onChange={(v) => set("olharDirecao", v)} />
          </TabsContent>

          <TabsContent value="camera" className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <Sel label="Movimento da câmera" value={f.movimentoCamera} options={o.MOVIMENTO_CAMERA} onChange={(v) => set("movimentoCamera", v)} />
            <Sel label="Velocidade" value={f.velocidadeCamera} options={o.VELOCIDADE_CAMERA} onChange={(v) => set("velocidadeCamera", v)} />
            <Sel label="Lente (opcional)" value={f.lente} options={o.LENTE} onChange={(v) => set("lente", v)} />
          </TabsContent>

          <TabsContent value="audio" className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <Sel label="Som ambiente" value={f.somAmbiente} options={o.SOM_AMBIENTE} onChange={(v) => set("somAmbiente", v)} />
            <Sel label="Música de fundo" value={f.musicaFundo} options={o.MUSICA_FUNDO} onChange={(v) => set("musicaFundo", v)} />
            <Sel label="Atmosfera / mood" value={f.atmosferaMood} options={o.ATMOSFERA_MOOD} onChange={(v) => set("atmosferaMood", v)} />
          </TabsContent>

          <TabsContent value="voz" className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <FieldLabel>Diálogo / script</FieldLabel>
              <Textarea
                value={f.dialogo}
                onChange={(e) => set("dialogo", e.target.value)}
                placeholder='ex: "I see something approaching… but you already know what it is, don\u2019t you?"'
                className="bg-secondary/40 border-border/60 min-h-[90px] text-[13px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Sel label="Tom de voz" value={f.tomVoz} options={o.TOM_VOZ} onChange={(v) => set("tomVoz", v)} />
              <Sel label="Idioma" value={f.idioma} options={o.IDIOMA} onChange={(v) => set("idioma", v)} />
            </div>
          </TabsContent>

          <TabsContent value="tech" className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <FieldLabel>Duração (s)</FieldLabel>
              <Input value={f.duracao} onChange={(e) => set("duracao", e.target.value)} className="bg-secondary/40 border-border/60 h-9 text-[13px]" />
            </div>
            <Sel label="Estilo visual" value={f.estiloVisual} options={o.ESTILO_VISUAL} onChange={(v) => set("estiloVisual", v)} />
            <Sel label="Continuidade" value={f.continuidade} options={o.CONTINUIDADE} onChange={(v) => set("continuidade", v)} />
            <Sel label="Aspect ratio" value={f.aspectRatio} options={o.ASPECT_RATIO} onChange={(v) => set("aspectRatio", v)} />
          </TabsContent>
        </Tabs>
      </Card>

      {/* Direita — Output */}
      <div className="col-span-12 lg:col-span-5 space-y-4 lg:sticky lg:top-4 self-start">
        {/* Plataforma */}
        <Card className="p-4 bg-card/60 border-border/60">
          <div className="brand-kicker text-primary mb-2 flex items-center gap-2">
            <Film className="h-3.5 w-3.5" /> Plataforma de animação
          </div>
          <Select value={f.plataforma} onValueChange={(v) => set("plataforma", v as VideoPlatform)}>
            <SelectTrigger className="bg-secondary/40 border-border/60 h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              {o.PLATAFORMA.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  <div className="flex flex-col">
                    <span className="font-medium">{p.label}</span>
                    <span className="text-[11px] text-muted-foreground">{p.desc}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>

        {/* Prompt texto */}
        <Card className="p-4 bg-card/60 border-border/60">
          <div className="flex items-center justify-between mb-2">
            <div className="brand-kicker text-emerald-400 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Prompt — Texto
            </div>
            <Button size="sm" variant="ghost" onClick={() => copy("text")}>
              {copied === "text" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <pre className="text-[12px] font-mono leading-6 text-foreground/90 whitespace-pre-wrap max-h-72 overflow-auto">
            {promptText}
          </pre>
        </Card>

        {/* Prompt JSON */}
        <Card className="p-4 bg-card/60 border-border/60">
          <div className="flex items-center justify-between mb-2">
            <div className="brand-kicker text-primary flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Prompt — JSON
            </div>
            <Button size="sm" variant="ghost" onClick={() => copy("json")}>
              {copied === "json" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <pre className="text-[11px] font-mono leading-5 text-muted-foreground whitespace-pre-wrap max-h-60 overflow-auto">
            {promptJson}
          </pre>
        </Card>

        {/* Ações */}
        <div className="flex gap-2">
          <Button onClick={refine} disabled={refining} variant="outline" className="flex-1">
            {refining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Refinar IA
          </Button>
          <Button onClick={save} disabled={saving} className={cn("flex-1")}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar no Cofre"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default VideoPromptGenerator;

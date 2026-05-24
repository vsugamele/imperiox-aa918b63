import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Copy, RotateCcw, Wand2, Check, Save, Sparkles, ImageIcon, Shuffle,
  Loader2, Download, Lock, Unlock, Grid2x2, Image as ImageIc,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { buildHyperPrompt, emptyHyperFields, type HyperFields, type HyperPlataforma } from "@/lib/hyperPromptBuilder";
import * as opts from "./hyperPromptOptions";
import { HYPER_PRESETS } from "@/data/studio/hyperPresets";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type FieldKey = keyof HyperFields;
const DRAFT_KEY = "hyperPrompt:draft:v3";

/* ---------- Inputs ---------- */

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
      {children}
    </Label>
  );
}

function FieldSelect({
  label, value, options, onChange, freePlaceholder,
}: {
  label: string;
  value: string;
  options: opts.Opt[];
  onChange: (v: string) => void;
  freePlaceholder?: string;
}) {
  const known = options.find((o) => o.value === value);
  const isFree = !known && value !== "";
  const selectValue = isFree ? "__free__" : (value || "__empty__");

  return (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      <Select
        value={selectValue}
        onValueChange={(v) => {
          if (v === "__free__" || v === "__empty__") onChange("");
          else onChange(v);
        }}
      >
        <SelectTrigger className="bg-secondary/40 border-border/60 h-9 text-[13px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {options.map((o, i) => (
            <SelectItem key={i} value={o.value === "" ? "__empty__" : o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isFree || selectValue === "__free__" ? (
        <Input
          autoFocus={selectValue === "__free__"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={freePlaceholder || "Digite livre..."}
          className="bg-secondary/40 border-border/60 h-9 text-[13px]"
        />
      ) : null}
    </div>
  );
}

function FieldText({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-secondary/40 border-border/60 h-9 text-[13px]"
      />
    </div>
  );
}

function pickRandom(arr: opts.Opt[]): string {
  const valid = arr.filter((o) => o.value && o.value !== "__free__");
  return valid[Math.floor(Math.random() * valid.length)]?.value || "";
}

/* ---------- Panel scaffolding ---------- */

function PanelHeader({ kicker }: { kicker: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-4 pb-2 border-b border-border/30">
      <span className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[hsl(var(--gold))]/70">
        · {kicker}
      </span>
      <div className="flex-1 h-px bg-gradient-to-r from-[hsl(var(--gold))]/30 to-transparent" />
    </div>
  );
}

/* ---------- Main ---------- */

type Variation = { url: string; prompt: string; ts: number; locked: boolean };

export function HyperPromptGenerator({
  externalFields, onSaved,
}: { externalFields?: HyperFields | null; onSaved?: () => void } = {}) {
  const [fields, setFields] = useState<HyperFields>(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) return { ...emptyHyperFields, ...JSON.parse(raw) };
    } catch {}
    return emptyHyperFields;
  });
  const [tab, setTab] = useState("persona");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refining, setRefining] = useState(false);
  const [refined, setRefined] = useState<string>("");
  const [previewing, setPreviewing] = useState(false);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [history, setHistory] = useState<Variation[]>([]);
  const [refineMode, setRefineMode] = useState<"compact" | "editorial">("compact");
  const [showRaw, setShowRaw] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (externalFields) {
      setFields({ ...emptyHyperFields, ...externalFields });
      toast.success("Prompt carregado do cofre");
    }
  }, [externalFields]);

  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(fields)); } catch {}
  }, [fields]);

  const prompt = useMemo(() => buildHyperPrompt(fields), [fields]);

  const set = (k: FieldKey) => (v: string) =>
    setFields((p) => ({ ...p, [k]: v } as HyperFields));

  const aplicarPreset = (presetId: string) => {
    const preset = HYPER_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setFields((p) => ({
      ...emptyHyperFields,
      ...p,
      ...preset.fields,
      plataforma: (preset.plataforma as HyperPlataforma) || p.plataforma,
      aspectRatio: preset.aspectRatio || p.aspectRatio,
    } as HyperFields));
    setRefined("");
    toast.success(`Preset "${preset.nome}" aplicado`);
  };

  const surpreender = () => {
    setFields((p) => ({
      ...p,
      expressao: p.expressao || pickRandom(opts.expressao),
      emocao: p.emocao || pickRandom(opts.emocao),
      cabeloEstilo: p.cabeloEstilo || pickRandom(opts.cabeloEstilo),
      cabeloCor: p.cabeloCor || pickRandom(opts.cabeloCor),
      roupa: p.roupa || pickRandom(opts.roupa),
      acessorios: p.acessorios || pickRandom(opts.acessorios),
      pose: p.pose || pickRandom(opts.pose),
      prop: p.prop || pickRandom(opts.prop),
      cenario: p.cenario || pickRandom(opts.cenario),
      horario: p.horario || pickRandom(opts.horario),
      luzDirecao: p.luzDirecao || pickRandom(opts.luzDirecao),
      colorGrade: p.colorGrade || pickRandom(opts.colorGrade),
      composicao: p.composicao || pickRandom(opts.composicao),
      camera: p.camera || pickRandom(opts.camera),
      lente: p.lente || pickRandom(opts.lente),
      filme: p.filme || pickRandom(opts.filme),
      estiloFinal: p.estiloFinal || pickRandom(opts.estiloFinal),
    }));
    toast.info("Campos vazios randomizados");
  };

  const copy = async (text = prompt) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copiado");
      setTimeout(() => setCopied(false), 1800);
    } catch { toast.error("Falha ao copiar"); }
  };

  const reset = () => {
    setFields(emptyHyperFields);
    setRefined("");
    setVariations([]);
    toast.info("Valores restaurados");
  };

  const salvar = async () => {
    const nome = window.prompt(
      "Nome para este prompt:",
      `${fields.tipoPersonagem || "prompt"} ${new Date().toLocaleDateString("pt-BR")}`,
    );
    if (!nome) return;
    const tagsRaw = window.prompt("Tags (separadas por vírgula, opcional):", "") || "";
    const tags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean);
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Faça login para salvar"); setSaving(false); return; }
    const thumb = variations[0]?.url || null;
    const { error } = await supabase.from("imphq_prompts_salvos").insert({
      user_id: user.id,
      nome,
      prompt_text: prompt,
      campos: fields as any,
      tags: tags.length ? tags : null,
      plataforma: fields.plataforma,
      thumbnail_url: thumb,
    });
    setSaving(false);
    if (error) return toast.error("Falha ao salvar: " + error.message);
    toast.success("Salvo no cofre");
    onSaved?.();
  };

  const refinar = async () => {
    if (!prompt.trim()) return toast.error("Preencha alguns campos primeiro");
    setRefining(true);
    try {
      const { data, error } = await supabase.functions.invoke("prompt-refiner", {
        body: { prompt, target: fields.plataforma, mode: refineMode },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setRefined(data?.refined || "");
      toast.success(`Refinado (${refineMode === "editorial" ? "editorial" : "compacto"})`);
    } catch (e: any) {
      toast.error("Falha ao refinar: " + (e?.message || ""));
    } finally { setRefining(false); }
  };

  const gerarPreview = async (count = 1) => {
    const basePrompt = refined || prompt;
    if (!basePrompt.trim()) return toast.error("Preencha alguns campos primeiro");
    setPreviewing(true);
    try {
      // mantém variações trancadas
      const locked = variations.filter((v) => v.locked);
      const remaining = Math.max(1, count - locked.length);
      const calls = Array.from({ length: remaining }, () =>
        supabase.functions.invoke("hyper-prompt-preview", { body: { prompt: basePrompt } })
      );
      const results = await Promise.allSettled(calls);
      const novas: Variation[] = results
        .map((r, i) => {
          if (r.status !== "fulfilled") return null;
          const { data, error } = r.value as any;
          if (error || data?.error || !data?.image_url) return null;
          return { url: data.image_url, prompt: basePrompt, ts: Date.now() + i, locked: false };
        })
        .filter(Boolean) as Variation[];
      if (!novas.length) throw new Error("Nenhuma imagem retornada");
      const finalSet = [...locked, ...novas].slice(0, 4);
      setVariations(finalSet);
      setHistory((h) => [...novas, ...h].slice(0, 12));
      toast.success(`${novas.length} variação${novas.length > 1 ? "ões" : ""} gerada${novas.length > 1 ? "s" : ""}`);
    } catch (e: any) {
      toast.error("Falha no preview: " + (e?.message || ""));
    } finally { setPreviewing(false); }
  };

  const toggleLock = (i: number) =>
    setVariations((v) => v.map((x, idx) => idx === i ? { ...x, locked: !x.locked } : x));

  const usarEmCriativo = () => {
    const text = refined || prompt;
    try {
      sessionStorage.setItem("criativo:promptVisual", text);
      const thumb = variations.find((v) => v.locked)?.url || variations[0]?.url;
      if (thumb) sessionStorage.setItem("criativo:previewUrl", thumb);
    } catch {}
    navigate("/criativos/novo?from=hyper");
    toast.success("Prompt enviado para Criativos");
  };

  const completeness = useMemo(() => {
    const must: FieldKey[] = ["tipoPersonagem", "cenario", "luzDirecao", "camera"];
    const filled = must.filter((k) => (fields[k] as string)?.trim()).length;
    return { filled, total: must.length, ok: filled === must.length };
  }, [fields]);

  return (
    <div className="space-y-5">
      {/* HEADER EDITORIAL */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[hsl(var(--gold))]/85">
            · Studio · Persona
          </span>
          <div className="flex-1 h-px bg-gradient-to-r from-[hsl(var(--gold))]/40 via-[hsl(var(--gold))]/15 to-transparent" />
        </div>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <h2 className="font-display italic text-3xl text-foreground leading-none">
            Gerador de <span className="text-[hsl(var(--gold))]">Avatar</span>
          </h2>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Badge variant="outline" className="border-[hsl(var(--gold))]/30 text-[hsl(var(--gold))]/85 uppercase tracking-wider text-[9px]">
              {fields.plataforma}
            </Badge>
            <span className="tabular-nums">{prompt.length} chars</span>
            <span className={cn("inline-block w-1.5 h-1.5 rounded-full", completeness.ok ? "bg-[hsl(var(--success))]" : "bg-amber-500")} />
            <span>{completeness.filled}/{completeness.total} essenciais</span>
          </div>
        </div>
      </div>

      {/* PRESETS — chips */}
      <div className="flex flex-wrap gap-2">
        {HYPER_PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => aplicarPreset(p.id)}
            title={p.descricao}
            className="text-[11px] tracking-wide uppercase font-medium px-3 py-1.5 rounded-full border border-border/50 bg-secondary/30 hover:bg-secondary/60 hover:border-[hsl(var(--gold))]/50 hover:text-[hsl(var(--gold))] transition"
          >
            <span className="mr-1">{p.emoji}</span>{p.nome}
          </button>
        ))}
      </div>

      {/* LAYOUT 2-COL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* FORM (8 col) */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="bg-secondary/15 border-border/50 p-5">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="bg-secondary/40 grid grid-cols-5 h-auto p-1">
                {[
                  ["persona", "Persona"],
                  ["estilo", "Estilo"],
                  ["camera", "Câmera"],
                  ["acabamento", "Acabamento"],
                  ["output", "Output"],
                ].map(([v, l]) => (
                  <TabsTrigger key={v} value={v} className="text-[11px] uppercase tracking-[0.18em] font-semibold py-2 data-[state=active]:bg-background data-[state=active]:text-[hsl(var(--gold))]">
                    {l}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* PERSONA */}
              <TabsContent value="persona" className="mt-5 space-y-5">
                <div>
                  <PanelHeader kicker="Identidade" />
                  <div className="grid md:grid-cols-3 gap-4">
                    <FieldText label="Idade" value={fields.idade} onChange={set("idade")} placeholder="ex.: 35" />
                    <FieldSelect label="Gênero" value={fields.genero} options={opts.genero} onChange={set("genero")} freePlaceholder="ex.: non-binary person" />
                    <FieldSelect label="Tipo de personagem" value={fields.tipoPersonagem} options={opts.tipoPersonagem} onChange={set("tipoPersonagem")} freePlaceholder="ex.: tarot reader" />
                    <FieldSelect label="Fenótipo" value={fields.fenotipo} options={opts.fenotipo} onChange={set("fenotipo")} freePlaceholder="ex.: South Asian" />
                    <FieldSelect label="Tom de pele" value={fields.tomPele} options={opts.tomPele} onChange={set("tomPele")} freePlaceholder="ex.: warm beige" />
                    <FieldSelect label="Expressão facial" value={fields.expressao} options={opts.expressao} onChange={set("expressao")} freePlaceholder="ex.: smoldering gaze" />
                  </div>
                </div>
                <div>
                  <PanelHeader kicker="Estado Emocional" />
                  <div className="grid md:grid-cols-2 gap-4">
                    <FieldSelect label="Emoção dominante" value={fields.emocao} options={opts.emocao} onChange={set("emocao")} freePlaceholder="ex.: defiant calm" />
                    <FieldSelect label="Cabelo — estilo" value={fields.cabeloEstilo} options={opts.cabeloEstilo} onChange={set("cabeloEstilo")} />
                    <FieldSelect label="Cabelo — cor" value={fields.cabeloCor} options={opts.cabeloCor} onChange={set("cabeloCor")} />
                  </div>
                </div>
              </TabsContent>

              {/* ESTILO */}
              <TabsContent value="estilo" className="mt-5 space-y-5">
                <div>
                  <PanelHeader kicker="Roupa & Pose" />
                  <div className="grid md:grid-cols-2 gap-4">
                    <FieldSelect label="Estilo de roupa" value={fields.roupa} options={opts.roupa} onChange={set("roupa")} />
                    <FieldSelect label="Acessórios" value={fields.acessorios} options={opts.acessorios} onChange={set("acessorios")} />
                    <FieldSelect label="Pose / ação" value={fields.pose} options={opts.pose} onChange={set("pose")} />
                    <FieldSelect label="Objeto principal (prop)" value={fields.prop} options={opts.prop} onChange={set("prop")} />
                  </div>
                </div>
                <div>
                  <PanelHeader kicker="Ambiente" />
                  <div className="grid md:grid-cols-2 gap-4">
                    <FieldSelect label="Cenário" value={fields.cenario} options={opts.cenario} onChange={set("cenario")} />
                    <FieldSelect label="Horário / atmosfera" value={fields.horario} options={opts.horario} onChange={set("horario")} />
                  </div>
                </div>
              </TabsContent>

              {/* CÂMERA */}
              <TabsContent value="camera" className="mt-5 space-y-5">
                <div>
                  <PanelHeader kicker="Iluminação & Composição" />
                  <div className="grid md:grid-cols-3 gap-4">
                    <FieldSelect label="Direção / qualidade da luz" value={fields.luzDirecao} options={opts.luzDirecao} onChange={set("luzDirecao")} />
                    <FieldSelect label="Color grade / mood" value={fields.colorGrade} options={opts.colorGrade} onChange={set("colorGrade")} />
                    <FieldSelect label="Composição" value={fields.composicao} options={opts.composicao} onChange={set("composicao")} />
                  </div>
                </div>
                <div>
                  <PanelHeader kicker="Câmera & Óptica" />
                  <div className="grid md:grid-cols-3 gap-4">
                    <FieldSelect label="Câmera" value={fields.camera} options={opts.camera} onChange={set("camera")} freePlaceholder="ex.: Mamiya 7 II" />
                    <FieldSelect label="Lente" value={fields.lente} options={opts.lente} onChange={set("lente")} freePlaceholder="ex.: 75mm Summilux" />
                    <FieldSelect label="Abertura f/" value={fields.abertura} options={opts.abertura} onChange={set("abertura")} freePlaceholder="ex.: 1.6" />
                    <FieldSelect label="ISO" value={fields.iso} options={opts.iso} onChange={set("iso")} freePlaceholder="ex.: 1250" />
                    <FieldSelect label="Shutter (1/Xs)" value={fields.shutter} options={opts.shutter} onChange={set("shutter")} freePlaceholder="ex.: 320" />
                  </div>
                </div>
              </TabsContent>

              {/* ACABAMENTO */}
              <TabsContent value="acabamento" className="mt-5 space-y-5">
                <div>
                  <PanelHeader kicker="Filme & Acabamento" />
                  <div className="grid md:grid-cols-3 gap-4">
                    <FieldSelect label="Emulação de filme" value={fields.filme} options={opts.filme} onChange={set("filme")} freePlaceholder="ex.: Ilford HP5" />
                    <FieldSelect label="Pós-processamento" value={fields.posProcesso} options={opts.posProcesso} onChange={set("posProcesso")} />
                    <FieldSelect label="Estilo final" value={fields.estiloFinal} options={opts.estiloFinal} onChange={set("estiloFinal")} freePlaceholder="ex.: noir cinematic" />
                  </div>
                </div>
                <div>
                  <PanelHeader kicker="Referência Artística" />
                  <div className="grid md:grid-cols-1 gap-4">
                    <FieldSelect label="Moodboard (fotógrafo/estilo)" value={fields.moodboard} options={opts.moodboard} onChange={set("moodboard")} freePlaceholder="ex.: Tim Walker dreamlike" />
                  </div>
                </div>
              </TabsContent>

              {/* OUTPUT */}
              <TabsContent value="output" className="mt-5 space-y-5">
                <div>
                  <PanelHeader kicker="Plataforma & Formato" />
                  <div className="grid md:grid-cols-3 gap-4">
                    <FieldSelect
                      label="Plataforma alvo" value={fields.plataforma} options={opts.plataforma}
                      onChange={(v) => setFields((p) => ({ ...p, plataforma: v as HyperPlataforma }))}
                    />
                    <FieldSelect label="Aspect ratio" value={fields.aspectRatio} options={opts.aspectRatio} onChange={set("aspectRatio")} freePlaceholder="ex.: 5:4" />
                    <FieldText label="Seed (opcional)" value={fields.seed} onChange={set("seed")} placeholder="ex.: 42 — trava consistência" />
                  </div>
                </div>
                <div>
                  <PanelHeader kicker="Negative Prompt" />
                  <Input
                    value={fields.negativo}
                    onChange={(e) => set("negativo")(e.target.value)}
                    placeholder="ex.: blurry, deformed hands, extra fingers, watermark"
                    className="bg-secondary/40 border-border/60 text-[13px]"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </Card>

          {/* HISTORY */}
          {history.length > 0 && (
            <Card className="bg-secondary/15 border-border/40 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[hsl(var(--gold))]/70">· Histórico da sessão</span>
                <button onClick={() => setHistory([])} className="text-[10px] text-muted-foreground hover:text-foreground uppercase tracking-wider">limpar</button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {history.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => setVariations([{ ...h, locked: false }])}
                    className="shrink-0 w-16 h-16 rounded border border-border/40 overflow-hidden hover:border-[hsl(var(--gold))]/60 transition"
                    title={new Date(h.ts).toLocaleTimeString("pt-BR")}
                  >
                    <img src={h.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* PREVIEW STICKY (4 col) */}
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-20 space-y-4">
            <Card className="bg-secondary/15 border-border/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[hsl(var(--gold))]/70">· Preview</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => gerarPreview(1)} disabled={previewing}>
                    {previewing ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageIc className="h-3 w-3" />}
                    <span className="ml-1">1×</span>
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => gerarPreview(4)} disabled={previewing}>
                    <Grid2x2 className="h-3 w-3" />
                    <span className="ml-1">4×</span>
                  </Button>
                </div>
              </div>

              {variations.length === 0 ? (
                <div className="aspect-square rounded border border-dashed border-border/50 flex flex-col items-center justify-center text-center p-6 bg-background/30">
                  <ImageIcon className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-[11px] text-muted-foreground italic font-display">
                    Clique em <span className="text-[hsl(var(--gold))]/80">1×</span> ou <span className="text-[hsl(var(--gold))]/80">4×</span> para gerar
                  </p>
                </div>
              ) : (
                <div className={cn("grid gap-2", variations.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
                  {variations.map((v, i) => (
                    <div key={i} className="relative group aspect-square rounded overflow-hidden border border-border/40">
                      <img src={v.url} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition flex items-end justify-between p-2 gap-1">
                        <button
                          onClick={() => toggleLock(i)}
                          className={cn("p-1.5 rounded bg-background/80 hover:bg-background", v.locked && "text-[hsl(var(--gold))]")}
                          title={v.locked ? "Destravar" : "Travar (mantém ao regerar)"}
                        >
                          {v.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                        </button>
                        <a href={v.url} download target="_blank" rel="noreferrer" className="p-1.5 rounded bg-background/80 hover:bg-background">
                          <Download className="h-3 w-3" />
                        </a>
                      </div>
                      {v.locked && (
                        <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-[hsl(var(--gold))]/90 text-[9px] uppercase tracking-wider font-bold text-background">
                          locked
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* PROMPT BLOCK */}
            <Card className="bg-secondary/15 border-border/50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[hsl(var(--gold))]/70">· Prompt final</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setShowRaw((s) => !s)} className="text-[10px] text-muted-foreground hover:text-foreground uppercase tracking-wider px-2">
                    {showRaw ? "ocultar" : "ver"}
                  </button>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => copy()}>
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
              {showRaw && (
                <pre className="font-mono text-[11px] leading-6 text-foreground/85 whitespace-pre-wrap break-words max-h-64 overflow-y-auto bg-background/40 rounded p-2 border border-border/30">
                  {prompt}
                </pre>
              )}

              {/* Refinador */}
              <div className="pt-2 border-t border-border/30 space-y-2">
                <div className="flex items-center gap-2">
                  <Select value={refineMode} onValueChange={(v) => setRefineMode(v as any)}>
                    <SelectTrigger className="h-7 text-[11px] bg-secondary/40 border-border/60 flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="compact">Refinar — compacto</SelectItem>
                      <SelectItem value="editorial">Refinar — editorial</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-[11px] border-[hsl(var(--gold))]/40" onClick={refinar} disabled={refining}>
                    {refining ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    <span className="ml-1">IA</span>
                  </Button>
                </div>
                {refined && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] uppercase tracking-[0.28em] text-[hsl(var(--gold))]/85">Refinado</span>
                      <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => copy(refined)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <pre className="font-mono text-[11px] leading-6 text-foreground/90 whitespace-pre-wrap break-words max-h-48 overflow-y-auto bg-background/40 rounded p-2 border border-[hsl(var(--gold))]/30">
                      {refined}
                    </pre>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* ACTION BAR */}
      <div className="sticky bottom-4 z-10 flex flex-wrap gap-2 p-3 rounded-lg bg-background/85 backdrop-blur-xl border border-[hsl(var(--gold))]/30 shadow-lg">
        <Button onClick={() => gerarPreview(4)} disabled={previewing} className="flex-1 min-w-[180px] h-11 font-display uppercase tracking-[0.18em] text-xs" size="lg">
          <Wand2 className="h-4 w-4 mr-2" />
          {previewing ? "Gerando..." : "Gerar 4 variações"}
        </Button>
        <Button onClick={surpreender} variant="secondary" className="h-11 text-xs uppercase tracking-wider">
          <Shuffle className="h-4 w-4 mr-2" /> Surpreender
        </Button>
        <Button onClick={() => copy()} variant="secondary" className="h-11 text-xs uppercase tracking-wider">
          <Copy className="h-4 w-4 mr-2" /> Copiar
        </Button>
        <Button onClick={usarEmCriativo} variant="secondary" className="h-11 text-xs uppercase tracking-wider">
          <ImageIcon className="h-4 w-4 mr-2" /> Usar em Criativo
        </Button>
        <Button onClick={salvar} disabled={saving} variant="secondary" className="h-11 text-xs uppercase tracking-wider">
          <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando..." : "Salvar"}
        </Button>
        <Button onClick={reset} variant="outline" className="h-11 text-xs uppercase tracking-wider">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

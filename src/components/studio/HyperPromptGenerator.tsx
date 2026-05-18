import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, RotateCcw, Wand2, Check, Save, Sparkles, ImageIcon, Shuffle, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { buildHyperPrompt, emptyHyperFields, type HyperFields, type HyperPlataforma } from "@/lib/hyperPromptBuilder";
import * as opts from "./hyperPromptOptions";
import { HYPER_PRESETS } from "@/data/studio/hyperPresets";
import { supabase } from "@/integrations/supabase/client";

type FieldKey = keyof HyperFields;
const DRAFT_KEY = "hyperPrompt:draft:v2";

function FieldSelect({
  label,
  value,
  options,
  onChange,
  freePlaceholder,
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
      <Label className="text-[11px] font-bold uppercase tracking-[1.5px] text-muted-foreground">
        {label}
      </Label>
      <Select
        value={selectValue}
        onValueChange={(v) => {
          if (v === "__free__") onChange("");
          else if (v === "__empty__") onChange("");
          else onChange(v);
        }}
      >
        <SelectTrigger className="bg-secondary/40 border-border">
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
          className="bg-secondary/40 border-border"
        />
      ) : null}
    </div>
  );
}

function pickRandom(arr: opts.Opt[]): string {
  const valid = arr.filter((o) => o.value && o.value !== "__free__");
  return valid[Math.floor(Math.random() * valid.length)]?.value || "";
}

export function HyperPromptGenerator({
  externalFields,
  onSaved,
}: {
  externalFields?: HyperFields | null;
  onSaved?: () => void;
} = {}) {
  const [fields, setFields] = useState<HyperFields>(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) return { ...emptyHyperFields, ...JSON.parse(raw) };
    } catch {}
    return emptyHyperFields;
  });
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refining, setRefining] = useState(false);
  const [refined, setRefined] = useState<string>("");
  const [previewing, setPreviewing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const navigate = useNavigate();

  useEffect(() => {
    if (externalFields) {
      setFields({ ...emptyHyperFields, ...externalFields });
      toast.success("Prompt carregado do cofre");
    }
  }, [externalFields]);

  // persiste rascunho
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(fields));
    } catch {}
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
    setPreviewUrl("");
    toast.success(`Preset "${preset.nome}" aplicado`);
  };

  const surpreender = () => {
    setFields((p) => ({
      ...p,
      expressao: p.expressao || pickRandom(opts.expressao),
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

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast.success("Prompt copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Falha ao copiar");
    }
  };

  const reset = () => {
    setFields(emptyHyperFields);
    setRefined("");
    setPreviewUrl("");
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
    if (!user) {
      toast.error("Faça login para salvar");
      setSaving(false);
      return;
    }
    const { error } = await supabase.from("imphq_prompts_salvos").insert({
      user_id: user.id,
      nome,
      prompt_text: prompt,
      campos: fields as any,
      tags: tags.length ? tags : null,
      plataforma: fields.plataforma,
      thumbnail_url: previewUrl || null,
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
        body: { prompt, target: fields.plataforma },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setRefined(data?.refined || "");
      toast.success("Prompt refinado pela IA");
    } catch (e: any) {
      toast.error("Falha ao refinar: " + (e?.message || ""));
    } finally {
      setRefining(false);
    }
  };

  const gerarPreview = async () => {
    if (!prompt.trim()) return toast.error("Preencha alguns campos primeiro");
    setPreviewing(true);
    try {
      const { data, error } = await supabase.functions.invoke("hyper-prompt-preview", {
        body: { prompt: refined || prompt },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPreviewUrl(data?.image_url || "");
      toast.success("Preview gerado");
    } catch (e: any) {
      toast.error("Falha no preview: " + (e?.message || ""));
    } finally {
      setPreviewing(false);
    }
  };

  const usarEmCriativo = () => {
    const text = refined || prompt;
    try {
      sessionStorage.setItem("criativo:promptVisual", text);
      if (previewUrl) sessionStorage.setItem("criativo:previewUrl", previewUrl);
    } catch {}
    navigate("/criativos/novo?from=hyper");
    toast.success("Prompt enviado para Criativos");
  };

  const copyRefined = async () => {
    try {
      await navigator.clipboard.writeText(refined);
      toast.success("Refinado copiado");
    } catch {
      toast.error("Falha ao copiar");
    }
  };

  const Section = ({ title, children, cols = 2 }: any) => (
    <Card className="bg-secondary/20 border-border p-5 space-y-4">
      <h3 className="font-display text-sm font-bold uppercase tracking-[2.5px] text-primary">
        {title}
      </h3>
      <div className={`grid gap-4 ${cols === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        {children}
      </div>
    </Card>
  );

  return (
    <div className="space-y-5">
      <Card className="bg-secondary/20 border-l-4 border-l-primary border-y-border border-r-border p-4 space-y-3">
        <p className="text-sm text-muted-foreground leading-7">
          <strong className="text-foreground">PRESETS RÁPIDOS →</strong> clique em um nicho para preencher tudo de uma vez.
        </p>
        <div className="flex flex-wrap gap-2">
          {HYPER_PRESETS.map((p) => (
            <Button
              key={p.id}
              variant="outline"
              size="sm"
              onClick={() => aplicarPreset(p.id)}
              title={p.descricao}
              className="h-9"
            >
              <span className="mr-1.5">{p.emoji}</span>
              {p.nome}
            </Button>
          ))}
        </div>
      </Card>

      <Section title="🎯 Plataforma & Formato" cols={3}>
        <FieldSelect
          label="Plataforma alvo"
          value={fields.plataforma}
          options={opts.plataforma}
          onChange={(v) => setFields((p) => ({ ...p, plataforma: v as HyperPlataforma }))}
        />
        <FieldSelect label="Aspect ratio" value={fields.aspectRatio} options={opts.aspectRatio} onChange={set("aspectRatio")} freePlaceholder="ex.: 5:4" />
        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold uppercase tracking-[1.5px] text-muted-foreground">
            Negative prompt (--no)
          </Label>
          <Input
            value={fields.negativo}
            onChange={(e) => set("negativo")(e.target.value)}
            placeholder="ex.: blurry, deformed hands, extra fingers"
            className="bg-secondary/40 border-border"
          />
        </div>
      </Section>

      <Section title="👤 Personagem" cols={3}>
        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold uppercase tracking-[1.5px] text-muted-foreground">Idade</Label>
          <Input
            value={fields.idade}
            onChange={(e) => set("idade")(e.target.value)}
            placeholder="ex.: 35"
            className="bg-secondary/40 border-border"
          />
        </div>
        <FieldSelect label="Gênero" value={fields.genero} options={opts.genero} onChange={set("genero")} freePlaceholder="ex.: non-binary person" />
        <FieldSelect label="Tipo de personagem" value={fields.tipoPersonagem} options={opts.tipoPersonagem} onChange={set("tipoPersonagem")} freePlaceholder="ex.: tarot reader" />
        <FieldSelect label="Fenótipo" value={fields.fenotipo} options={opts.fenotipo} onChange={set("fenotipo")} freePlaceholder="ex.: South Asian" />
        <FieldSelect label="Tom de pele" value={fields.tomPele} options={opts.tomPele} onChange={set("tomPele")} freePlaceholder="ex.: warm beige" />
        <FieldSelect label="Expressão facial" value={fields.expressao} options={opts.expressao} onChange={set("expressao")} freePlaceholder="ex.: smoldering gaze" />
      </Section>

      <Section title="💇 Cabelo">
        <FieldSelect label="Estilo de cabelo" value={fields.cabeloEstilo} options={opts.cabeloEstilo} onChange={set("cabeloEstilo")} />
        <FieldSelect label="Cor do cabelo" value={fields.cabeloCor} options={opts.cabeloCor} onChange={set("cabeloCor")} />
      </Section>

      <Section title="👗 Roupa & Acessórios">
        <FieldSelect label="Estilo de roupa" value={fields.roupa} options={opts.roupa} onChange={set("roupa")} />
        <FieldSelect label="Acessórios" value={fields.acessorios} options={opts.acessorios} onChange={set("acessorios")} />
      </Section>

      <Section title="🎬 Ação & Pose">
        <FieldSelect label="Pose / ação" value={fields.pose} options={opts.pose} onChange={set("pose")} />
        <FieldSelect label="Objeto principal (prop)" value={fields.prop} options={opts.prop} onChange={set("prop")} />
      </Section>

      <Section title="🌍 Ambiente">
        <FieldSelect label="Cenário" value={fields.cenario} options={opts.cenario} onChange={set("cenario")} />
        <FieldSelect label="Horário / atmosfera" value={fields.horario} options={opts.horario} onChange={set("horario")} />
      </Section>

      <Section title="💡 Iluminação & Composição" cols={3}>
        <FieldSelect label="Direção / qualidade da luz" value={fields.luzDirecao} options={opts.luzDirecao} onChange={set("luzDirecao")} />
        <FieldSelect label="Color grade / mood" value={fields.colorGrade} options={opts.colorGrade} onChange={set("colorGrade")} />
        <FieldSelect label="Composição" value={fields.composicao} options={opts.composicao} onChange={set("composicao")} />
      </Section>

      <Section title="📷 Câmera & Óptica" cols={3}>
        <FieldSelect label="Câmera" value={fields.camera} options={opts.camera} onChange={set("camera")} freePlaceholder="ex.: Mamiya 7 II" />
        <FieldSelect label="Lente" value={fields.lente} options={opts.lente} onChange={set("lente")} freePlaceholder="ex.: 75mm Summilux" />
        <FieldSelect label="Abertura f/" value={fields.abertura} options={opts.abertura} onChange={set("abertura")} freePlaceholder="ex.: 1.6" />
        <FieldSelect label="ISO" value={fields.iso} options={opts.iso} onChange={set("iso")} freePlaceholder="ex.: 1250" />
        <FieldSelect label="Shutter (1/Xs)" value={fields.shutter} options={opts.shutter} onChange={set("shutter")} freePlaceholder="ex.: 320" />
      </Section>

      <Section title="🎞️ Filme & Acabamento" cols={3}>
        <FieldSelect label="Emulação de filme" value={fields.filme} options={opts.filme} onChange={set("filme")} freePlaceholder="ex.: Ilford HP5" />
        <FieldSelect label="Pós-processamento" value={fields.posProcesso} options={opts.posProcesso} onChange={set("posProcesso")} />
        <FieldSelect label="Estilo final" value={fields.estiloFinal} options={opts.estiloFinal} onChange={set("estiloFinal")} freePlaceholder="ex.: noir cinematic" />
      </Section>

      <div className="flex gap-3 flex-wrap">
        <Button onClick={copy} className="flex-1 min-w-[200px] h-12 font-display tracking-[2px] uppercase" size="lg">
          <Wand2 className="h-4 w-4 mr-2" /> Gerar & Copiar
        </Button>
        <Button onClick={surpreender} variant="secondary" size="lg" className="h-12">
          <Shuffle className="h-4 w-4 mr-2" /> Surpreenda-me
        </Button>
        <Button onClick={refinar} disabled={refining} variant="secondary" size="lg" className="h-12">
          <Sparkles className="h-4 w-4 mr-2" /> {refining ? "Refinando..." : "Refinar com IA"}
        </Button>
        <Button onClick={gerarPreview} disabled={previewing} variant="secondary" size="lg" className="h-12">
          {previewing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ImageIcon className="h-4 w-4 mr-2" />}
          {previewing ? "Gerando..." : "Gerar Preview"}
        </Button>
        <Button onClick={usarEmCriativo} variant="secondary" size="lg" className="h-12">
          <ImageIcon className="h-4 w-4 mr-2" /> Usar em Criativo
        </Button>
        <Button onClick={salvar} disabled={saving} variant="secondary" size="lg" className="h-12">
          <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando..." : "Salvar no Cofre"}
        </Button>
        <Button onClick={reset} variant="outline" size="lg" className="h-12">
          <RotateCcw className="h-4 w-4 mr-2" /> Resetar
        </Button>
      </div>

      <Card className="bg-background/60 border-border p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-sm font-bold uppercase tracking-[2.5px] text-primary">
              Prompt Gerado
            </h3>
            <Badge variant="outline" className="text-[10px] uppercase">{fields.plataforma}</Badge>
            <Badge variant="outline" className="text-[10px]">{prompt.length} chars</Badge>
          </div>
          <Button size="sm" variant="ghost" onClick={copy}>
            {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
        <pre className="font-mono text-[13px] leading-7 text-foreground/90 whitespace-pre-wrap break-words">
          {prompt}
        </pre>
      </Card>

      {refined && (
        <Card className="bg-secondary/30 border-l-4 border-l-primary border-y-border border-r-border p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold uppercase tracking-[2.5px] text-primary">
              ✨ Refinado pela IA
            </h3>
            <Button size="sm" variant="ghost" onClick={copyRefined}>
              <Copy className="h-4 w-4 mr-1" /> Copiar
            </Button>
          </div>
          <pre className="font-mono text-[13px] leading-7 text-foreground/90 whitespace-pre-wrap break-words">
            {refined}
          </pre>
        </Card>
      )}

      {previewUrl && (
        <Card className="bg-secondary/30 border-l-4 border-l-primary border-y-border border-r-border p-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-display text-sm font-bold uppercase tracking-[2.5px] text-primary">
              🖼️ Preview Gerado
            </h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={gerarPreview} disabled={previewing}>
                <Shuffle className="h-4 w-4 mr-1" /> Regerar
              </Button>
              <a href={previewUrl} download target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline">
                  <Download className="h-4 w-4 mr-1" /> Baixar
                </Button>
              </a>
            </div>
          </div>
          <img
            src={previewUrl}
            alt="Preview"
            className="rounded border border-border max-w-md w-full aspect-square object-cover"
          />
        </Card>
      )}
    </div>
  );
}

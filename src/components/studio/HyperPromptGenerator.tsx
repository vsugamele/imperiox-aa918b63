import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, RotateCcw, Wand2, Check } from "lucide-react";
import { toast } from "sonner";
import { buildHyperPrompt, emptyHyperFields, type HyperFields } from "@/lib/hyperPromptBuilder";
import * as opts from "./hyperPromptOptions";

type FieldKey = keyof HyperFields;

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
  // Detect if current value matches a known option; if not and not empty, it's free text
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
          if (v === "__free__") onChange(""); // limpa para o usuário digitar
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

export function HyperPromptGenerator() {
  const [fields, setFields] = useState<HyperFields>(emptyHyperFields);
  const [copied, setCopied] = useState(false);

  const prompt = useMemo(() => buildHyperPrompt(fields), [fields]);

  const set = (k: FieldKey) => (v: string) => setFields((p) => ({ ...p, [k]: v }));

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
    toast.info("Valores restaurados");
  };

  const Section = ({ title, icon, children, cols = 2 }: any) => (
    <Card className="bg-secondary/20 border-border p-5 space-y-4">
      <h3 className="font-display text-sm font-bold uppercase tracking-[2.5px] text-primary">
        {icon} {title}
      </h3>
      <div className={`grid gap-4 ${cols === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        {children}
      </div>
    </Card>
  );

  return (
    <div className="space-y-5">
      <Card className="bg-secondary/20 border-l-4 border-l-primary border-y-border border-r-border p-4">
        <p className="text-sm text-muted-foreground leading-7">
          <strong className="text-foreground">COMO USAR →</strong> escolha um valor em cada campo ou selecione{" "}
          <em className="text-primary">"✎ LIVRE"</em> para digitar algo personalizado. O prompt é montado automaticamente abaixo.
        </p>
      </Card>

      <Section title="👤 Personagem" icon="" cols={3}>
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

      <Section title="💇 Cabelo" icon="">
        <FieldSelect label="Estilo de cabelo" value={fields.cabeloEstilo} options={opts.cabeloEstilo} onChange={set("cabeloEstilo")} />
        <FieldSelect label="Cor do cabelo" value={fields.cabeloCor} options={opts.cabeloCor} onChange={set("cabeloCor")} />
      </Section>

      <Section title="👗 Roupa & Acessórios" icon="">
        <FieldSelect label="Estilo de roupa" value={fields.roupa} options={opts.roupa} onChange={set("roupa")} />
        <FieldSelect label="Acessórios" value={fields.acessorios} options={opts.acessorios} onChange={set("acessorios")} />
      </Section>

      <Section title="🎬 Ação & Pose" icon="">
        <FieldSelect label="Pose / ação" value={fields.pose} options={opts.pose} onChange={set("pose")} />
        <FieldSelect label="Objeto principal (prop)" value={fields.prop} options={opts.prop} onChange={set("prop")} />
      </Section>

      <Section title="🌍 Ambiente" icon="">
        <FieldSelect label="Cenário" value={fields.cenario} options={opts.cenario} onChange={set("cenario")} />
        <FieldSelect label="Horário / atmosfera" value={fields.horario} options={opts.horario} onChange={set("horario")} />
      </Section>

      <Section title="💡 Iluminação" icon="">
        <FieldSelect label="Direção / qualidade da luz" value={fields.luzDirecao} options={opts.luzDirecao} onChange={set("luzDirecao")} />
        <FieldSelect label="Color grade / mood" value={fields.colorGrade} options={opts.colorGrade} onChange={set("colorGrade")} />
      </Section>

      <Section title="📷 Câmera & Óptica" icon="" cols={3}>
        <FieldSelect label="Câmera" value={fields.camera} options={opts.camera} onChange={set("camera")} freePlaceholder="ex.: Mamiya 7 II" />
        <FieldSelect label="Lente" value={fields.lente} options={opts.lente} onChange={set("lente")} freePlaceholder="ex.: 75mm Summilux" />
        <FieldSelect label="Abertura f/" value={fields.abertura} options={opts.abertura} onChange={set("abertura")} freePlaceholder="ex.: 1.6" />
        <FieldSelect label="ISO" value={fields.iso} options={opts.iso} onChange={set("iso")} freePlaceholder="ex.: 1250" />
        <FieldSelect label="Shutter (1/Xs)" value={fields.shutter} options={opts.shutter} onChange={set("shutter")} freePlaceholder="ex.: 320" />
      </Section>

      <Section title="🎞️ Filme & Acabamento" icon="">
        <FieldSelect label="Emulação de filme" value={fields.filme} options={opts.filme} onChange={set("filme")} freePlaceholder="ex.: Ilford HP5" />
        <FieldSelect label="Estilo final" value={fields.estiloFinal} options={opts.estiloFinal} onChange={set("estiloFinal")} freePlaceholder="ex.: noir cinematic" />
      </Section>

      <div className="flex gap-3">
        <Button onClick={copy} className="flex-1 h-12 font-display tracking-[2px] uppercase" size="lg">
          <Wand2 className="h-4 w-4 mr-2" /> Gerar & Copiar
        </Button>
        <Button onClick={reset} variant="outline" size="lg" className="h-12">
          <RotateCcw className="h-4 w-4 mr-2" /> Resetar
        </Button>
      </div>

      <Card className="bg-background/60 border-border p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-bold uppercase tracking-[2.5px] text-primary">
            Prompt Gerado
          </h3>
          <Button size="sm" variant="ghost" onClick={copy}>
            {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
        <pre className="font-mono text-[13px] leading-7 text-foreground/90 whitespace-pre-wrap break-words">
          {prompt}
        </pre>
      </Card>
    </div>
  );
}

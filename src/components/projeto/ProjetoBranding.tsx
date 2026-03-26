import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EditableTagList } from "./EditableTagList";
import { cn } from "@/lib/utils";

interface Props {
  project: any;
  onUpdateBrandKit: (brandKit: any) => void;
}

const ARCHETYPES = [
  { key: "heroi", emoji: "⚔️", label: "Herói", desc: "Coragem, superação, conquista" },
  { key: "mentor", emoji: "🧙", label: "Mentor", desc: "Sabedoria, guia, autoridade" },
  { key: "fora_da_lei", emoji: "🏴‍☠️", label: "Fora da Lei", desc: "Rebelde, disruptivo, liberdade" },
  { key: "explorador", emoji: "🧭", label: "Explorador", desc: "Descoberta, aventura, autonomia" },
  { key: "criador", emoji: "🎨", label: "Criador", desc: "Inovação, originalidade, visão" },
  { key: "cuidador", emoji: "🤲", label: "Cuidador", desc: "Proteção, empatia, serviço" },
  { key: "rei", emoji: "👑", label: "Rei", desc: "Controle, liderança, estabilidade" },
  { key: "mago", emoji: "✨", label: "Mago", desc: "Transformação, visão, poder" },
  { key: "bobo", emoji: "🃏", label: "Bobo", desc: "Humor, leveza, conexão" },
];

export function ProjetoBranding({ project, onUpdateBrandKit }: Props) {
  const bk = project.brand_kit || {};

  const update = (key: string, val: any) => onUpdateBrandKit({ ...bk, [key]: val });

  return (
    <div className="space-y-6">
      {/* Paleta de Cores */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🎨 Paleta de Cores</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Cores (hex)</Label>
            <EditableTagList tags={bk.cores || []} onChange={(v) => update("cores", v)} placeholder="#000000" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(bk.cores || []).map((c: string, i: number) => (
              <div key={i} className="h-10 w-10 rounded-md border border-border" style={{ backgroundColor: c }} title={c} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tipografia */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🔤 Tipografia</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Fonte Título</Label>
            <Input value={bk.fonte_titulo || ""} onChange={(e) => update("fonte_titulo", e.target.value)} className="bg-secondary" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Fonte Corpo</Label>
            <Input value={bk.fonte_corpo || ""} onChange={(e) => update("fonte_corpo", e.target.value)} className="bg-secondary" />
          </div>
        </CardContent>
      </Card>

      {/* Arquétipo da Marca */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🧬 Arquétipo da Marca</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">Selecione o arquétipo que melhor representa a personalidade da marca</p>
          <div className="grid grid-cols-3 gap-2">
            {ARCHETYPES.map((a) => (
              <button
                key={a.key}
                onClick={() => update("arquetipo", a.key)}
                className={cn(
                  "flex flex-col items-center gap-1 p-3 rounded-lg border transition-all text-center",
                  bk.arquetipo === a.key
                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                    : "border-border bg-secondary/50 hover:border-muted-foreground"
                )}
              >
                <span className="text-2xl">{a.emoji}</span>
                <span className="text-xs font-bold">{a.label}</span>
                <span className="text-[9px] text-muted-foreground leading-tight">{a.desc}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Posicionamento */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🎯 Posicionamento</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Inimigo Comum</Label>
            <Textarea
              value={bk.inimigo_comum || ""}
              onChange={(e) => update("inimigo_comum", e.target.value)}
              className="bg-secondary min-h-[60px]"
              placeholder="Contra o quê a marca luta? Ex: métodos ultrapassados, desinformação..."
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Mecanismo-Chave</Label>
            <Textarea
              value={bk.mecanismo_chave || ""}
              onChange={(e) => update("mecanismo_chave", e.target.value)}
              className="bg-secondary min-h-[60px]"
              placeholder="Qual o diferencial ou método exclusivo que a marca oferece?"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Personalidade da Marca</Label>
            <Textarea
              value={bk.personalidade || ""}
              onChange={(e) => update("personalidade", e.target.value)}
              className="bg-secondary min-h-[60px]"
              placeholder="Se a marca fosse uma pessoa, como ela falaria, agiria, se vestiria?"
            />
          </div>
        </CardContent>
      </Card>

      {/* Manifesto da Marca */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">📜 Manifesto da Marca</CardTitle></CardHeader>
        <CardContent>
          <Textarea
            value={bk.manifesto || ""}
            onChange={(e) => update("manifesto", e.target.value)}
            className="bg-secondary min-h-[120px]"
            placeholder="O manifesto é o texto que resume a essência, a missão e os valores da marca em tom emocional..."
          />
        </CardContent>
      </Card>

      {/* Linguagem: Usa / Evita */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🗣️ Linguagem da Marca</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground flex items-center gap-1">✅ Palavras que Usa</Label>
            <EditableTagList
              tags={bk.palavras_usa || []}
              onChange={(v) => update("palavras_usa", v)}
              placeholder="Ex: transformação, método..."
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground flex items-center gap-1">🚫 Palavras que Evita</Label>
            <EditableTagList
              tags={bk.palavras_evita || []}
              onChange={(v) => update("palavras_evita", v)}
              placeholder="Ex: fácil, milagre..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Tom Visual */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">✨ Tom Visual</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Descrição do Tom</Label>
            <Textarea value={bk.tom_visual || ""} onChange={(e) => update("tom_visual", e.target.value)} className="bg-secondary min-h-[60px]" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Referências Visuais (URLs)</Label>
            <EditableTagList tags={bk.referencias || []} onChange={(v) => update("referencias", v)} placeholder="https://..." />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

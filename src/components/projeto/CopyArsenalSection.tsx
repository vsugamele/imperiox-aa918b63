import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Trash2, ChevronDown, Copy, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const COPY_BLOCKS = [
  {
    key: "promessa",
    emoji: "🎯",
    label: "Promessa",
    subtitle: "Mexer psicologicamente com o lead",
    desc: "Desejo + tempo + dor + objeção principal",
  },
  {
    key: "inimigo_comum",
    emoji: "👹",
    label: "Inimigo Comum",
    subtitle: "Terceirizar a culpa",
    desc: "A culpa é do sistema, não do lead. Escancarar que o problema não é dele",
  },
  {
    key: "efeito_colateral",
    emoji: "⚠️",
    label: "Efeito Colateral",
    subtitle: "Risco grave de continuar no caminho errado",
    desc: "Risco de continuar + nome do ciclo (ex: 'ciclo da insegurança profissional')",
  },
  {
    key: "oportunidade",
    emoji: "💎",
    label: "Oportunidade Escancarada",
    subtitle: "Tangibilizar a transformação",
    desc: "Mecanismo único + prova social + caso real (passado × futuro, conquistas, dados)",
  },
  {
    key: "metodo_simplificado",
    emoji: "🧩",
    label: "Método Simplificado",
    subtitle: "Mostrar que é mais simples do que imagina",
    desc: "Quebrar objeção de complexidade. Ex: 'Você realmente não consegue dedicar 5 min por dia?'",
  },
  {
    key: "hora_do_show",
    emoji: "🎬",
    label: "Hora do Show",
    subtitle: "3 pilares que provam a promessa",
    desc: "3 pilares de 10 + conteúdo prático que prova a promessa na prática",
  },
];

interface Props {
  arsenal: Record<string, string | string[]>;
  onChange: (updated: Record<string, string | string[]>) => void;
  projectId?: string;
}

export function CopyArsenalSection({ arsenal, onChange, projectId }: Props) {
  const [generating, setGenerating] = useState(false);

  const getVariations = (key: string): string[] => {
    const val = arsenal[key];
    if (!val) return [""];
    if (Array.isArray(val)) return val.length === 0 ? [""] : val;
    return [val];
  };

  const updateVariations = (key: string, variations: string[]) => {
    onChange({ ...arsenal, [key]: variations });
  };

  const addVariation = (key: string) => {
    const current = getVariations(key);
    updateVariations(key, [...current, ""]);
  };

  const removeVariation = (key: string, index: number) => {
    const current = getVariations(key);
    if (current.length <= 1) return;
    updateVariations(key, current.filter((_, i) => i !== index));
  };

  const updateVariation = (key: string, index: number, val: string) => {
    const current = getVariations(key);
    const updated = [...current];
    updated[index] = val;
    updateVariations(key, updated);
  };

  const copyBlock = (key: string) => {
    const variations = getVariations(key);
    const text = variations.filter(Boolean).join("\n\n---\n\n");
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência");
  };

  const generateWithAI = async () => {
    if (!projectId) {
      toast.error("ID do projeto não disponível");
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("openflow-ai", {
        body: { project_id: projectId, action: "generate_copy_arsenal" },
      });
      if (error) throw error;
      if (data?.arsenal) {
        const newArsenal = { ...arsenal };
        for (const key of Object.keys(data.arsenal)) {
          const existing = getVariations(key);
          const hasContent = existing.some((v: string) => v.trim().length > 0);
          if (!hasContent) {
            newArsenal[key] = data.arsenal[key];
          }
        }
        onChange(newArsenal);
        toast.success("Arsenal de Copy gerado com IA!");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar com IA");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Collapsible>
      <div className="flex items-center gap-2">
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="flex-1 justify-between text-xs">
            <span>✍️ Arsenal de Copy</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </CollapsibleTrigger>
        {projectId && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs gap-1 shrink-0"
            onClick={generateWithAI}
            disabled={generating}
          >
            {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {generating ? "Gerando..." : "Gerar com IA"}
          </Button>
        )}
      </div>
      <CollapsibleContent className="pt-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {COPY_BLOCKS.map((block) => {
            const variations = getVariations(block.key);
            return (
              <div key={block.key} className="p-3 rounded-md bg-background/50 border border-border/50 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <Label className="text-xs font-medium flex items-center gap-1">
                      <span>{block.emoji}</span> {block.label}
                    </Label>
                    <p className="text-[10px] text-primary/70 font-medium">{block.subtitle}</p>
                    <p className="text-[10px] text-muted-foreground">{block.desc}</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-primary"
                    onClick={() => copyBlock(block.key)}
                    title="Copiar tudo"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>

                {variations.map((v, vi) => (
                  <div key={vi} className="flex gap-1">
                    <Textarea
                      value={v}
                      onChange={(e) => updateVariation(block.key, vi, e.target.value)}
                      className="bg-secondary text-sm min-h-[70px] flex-1"
                      placeholder={`Variação ${vi + 1}...`}
                    />
                    {variations.length > 1 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0 text-destructive self-start mt-1"
                        onClick={() => removeVariation(block.key, vi)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}

                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px] px-2 text-muted-foreground"
                  onClick={() => addVariation(block.key)}
                >
                  <Plus className="h-3 w-3 mr-1" /> Variação
                </Button>
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

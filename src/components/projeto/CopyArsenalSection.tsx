import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ChevronDown, Copy } from "lucide-react";
import { toast } from "sonner";
import { AIGenerateButton } from "./AIGenerateButton";

const COPY_BLOCKS = [
  { key: "promessa", emoji: "🎯", label: "Promessa", subtitle: "Mexer psicologicamente com o lead", desc: "Desejo + tempo + dor + objeção principal" },
  { key: "inimigo_comum", emoji: "👹", label: "Inimigo Comum", subtitle: "Terceirizar a culpa", desc: "A culpa é do sistema, não do lead. Escancarar que o problema não é dele" },
  { key: "efeito_colateral", emoji: "⚠️", label: "Efeito Colateral", subtitle: "Risco grave de continuar no caminho errado", desc: "Risco de continuar + nome do ciclo" },
  { key: "oportunidade", emoji: "💎", label: "Oportunidade Escancarada", subtitle: "Tangibilizar a transformação", desc: "Mecanismo único + prova social + caso real" },
  { key: "metodo_simplificado", emoji: "🧩", label: "Método Simplificado", subtitle: "Mostrar que é mais simples do que imagina", desc: "Quebrar objeção de complexidade" },
  { key: "hora_do_show", emoji: "🎬", label: "Hora do Show", subtitle: "3 pilares que provam a promessa", desc: "3 pilares de 10 + conteúdo prático" },
];

interface Props {
  arsenal: Record<string, string | string[]>;
  onChange: (updated: Record<string, string | string[]>) => void;
  projectId?: string;
  produtos?: any[];
}

export function CopyArsenalSection({ arsenal, onChange, projectId, produtos = [] }: Props) {
  const [selectedProductIndex, setSelectedProductIndex] = useState<string>("__all__");

  const productNames = useMemo(() => {
    return Array.isArray(produtos) ? produtos.map((p: any) => p.nome || p.name || "").filter(Boolean) : [];
  }, [produtos]);
  const getVariations = (key: string): string[] => {
    const val = arsenal[key];
    if (!val) return [""];
    if (Array.isArray(val)) return val.length === 0 ? [""] : val;
    return [val];
  };

  const updateVariations = (key: string, variations: string[]) => {
    onChange({ ...arsenal, [key]: variations });
  };

  const addVariation = (key: string) => updateVariations(key, [...getVariations(key), ""]);

  const removeVariation = (key: string, index: number) => {
    const current = getVariations(key);
    if (current.length <= 1) return;
    updateVariations(key, current.filter((_, i) => i !== index));
  };

  const updateVariation = (key: string, index: number, val: string) => {
    const current = [...getVariations(key)];
    current[index] = val;
    updateVariations(key, current);
  };

  const copyBlock = (key: string) => {
    const text = getVariations(key).filter(Boolean).join("\n\n---\n\n");
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência");
  };

  const handleAIResult = (data: any) => {
    if (data?.arsenal) {
      const newArsenal = { ...arsenal };
      for (const key of Object.keys(data.arsenal)) {
        const existing = getVariations(key);
        const hasContent = existing.some((v: string) => v.trim().length > 0);
        if (!hasContent) newArsenal[key] = data.arsenal[key];
      }
      onChange(newArsenal);
      toast.success("Arsenal de Copy gerado com IA!");
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
          <div className="flex items-center gap-2">
            {productNames.length > 1 && (
              <Select value={selectedProductIndex} onValueChange={setSelectedProductIndex}>
                <SelectTrigger className="h-7 text-[10px] w-[140px]"><SelectValue placeholder="Produto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {productNames.map((name: string, i: number) => (
                    <SelectItem key={i} value={String(i)}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <AIGenerateButton
              projectId={projectId}
              action="generate_copy_arsenal"
              onResult={handleAIResult}
              contextSources={["Avatar", "Branding", "Produtos", "Concorrentes", "Pesquisa"]}
              fieldsToFill={COPY_BLOCKS.map(b => b.label)}
              label="Gerar com IA"
              size="sm"
              showMenteSelector={true}
              extraBody={selectedProductIndex !== "__all__" ? { product_index: parseInt(selectedProductIndex) } : undefined}
            />
          </div>
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
                  <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-primary" onClick={() => copyBlock(block.key)} title="Copiar tudo">
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                {variations.map((v, vi) => (
                  <div key={vi} className="flex gap-1">
                    <Textarea value={v} onChange={(e) => updateVariation(block.key, vi, e.target.value)} className="bg-secondary text-sm min-h-[70px] flex-1" placeholder={`Variação ${vi + 1}...`} />
                    {variations.length > 1 && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-destructive self-start mt-1" onClick={() => removeVariation(block.key, vi)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-muted-foreground" onClick={() => addVariation(block.key)}>
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

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, ChevronDown, Copy, Sparkles, Loader2, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
  onMecanismoGenerated?: (mecanismo: string) => void;
  onContextoGenerated?: (contexto: string) => void;
}

export function CopyArsenalSection({ arsenal, onChange, projectId, produtos = [], onMecanismoGenerated, onContextoGenerated }: Props) {
  const productNames = useMemo(() => {
    return Array.isArray(produtos) ? produtos.map((p: any) => p.nome || p.name || "").filter(Boolean) : [];
  }, [produtos]);

  // Default to the first product (index "0") so product_index always reaches the backend
  const [selectedProductIndex, setSelectedProductIndex] = useState<string>(productNames.length > 0 ? "0" : "__all__");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [extraUrl, setExtraUrl] = useState("");
  const [briefingExtra, setBriefingExtra] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    // If products list changes and current selection is "__all__" but we now have products, switch to "0"
    if (productNames.length > 0 && selectedProductIndex === "__all__") {
      setSelectedProductIndex("0");
    }
  }, [productNames.length]);

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

  const clearBlock = (key: string) => {
    updateVariations(key, [""]);
  };

  // Detecta se o produto selecionado tem contexto suficiente para gerar copy de qualidade
  const selectedProductEmpty = useMemo(() => {
    if (selectedProductIndex === "__all__" || !Array.isArray(produtos)) return false;
    const idx = parseInt(selectedProductIndex);
    const prod = produtos[idx];
    if (!prod) return false;
    const hasContext = prod.mecanismo_unico || prod.contexto || prod.briefing ||
      prod.checkout_urls?.length || (prod.links && Object.values(prod.links).some(Boolean));
    return !hasContext;
  }, [selectedProductIndex, produtos]);

  const applyArsenalResult = (data: any) => {
    console.log("[Arsenal] AI response:", data);
    if (data?.error) {
      toast.error(data.error);
      return;
    }
    if (!data?.arsenal || Object.keys(data.arsenal).length === 0) {
      toast.error("A IA não retornou um arsenal válido. Tente novamente.");
      return;
    }
    const newArsenal = { ...arsenal };
    let filled = 0;
    let skipped = 0;
    for (const key of Object.keys(data.arsenal)) {
      if (key === "mecanismo_unico" || key === "contexto") continue; // handled by parent
      const existing = getVariations(key);
      const hasContent = existing.some((v: string) => typeof v === "string" && v.trim().length > 0);
      if (!hasContent) {
        newArsenal[key] = data.arsenal[key];
        filled++;
      } else {
        skipped++;
      }
    }
    onChange(newArsenal);
    if (data.arsenal.mecanismo_unico && onMecanismoGenerated) onMecanismoGenerated(data.arsenal.mecanismo_unico);
    if (data.arsenal.contexto && onContextoGenerated) onContextoGenerated(data.arsenal.contexto);

    if (filled > 0 && skipped > 0) {
      toast.success(`Arsenal gerado: ${filled} bloco(s) preenchido(s), ${skipped} já tinha conteúdo`);
    } else if (filled > 0) {
      toast.success(`Arsenal de Copy gerado: ${filled} bloco(s) preenchido(s)`);
    } else {
      toast.info("Todos os blocos já tinham conteúdo. Limpe os blocos que quer regenerar e tente novamente.");
    }
  };

  const handleGenerate = async () => {
    if (!projectId) return;
    setGenerating(true);
    try {
      const extraUrls = extraUrl.trim() ? [extraUrl.trim()] : [];
      const body: any = {
        project_id: projectId,
        action: "generate_copy_arsenal",
      };
      if (selectedProductIndex !== "__all__") body.product_index = parseInt(selectedProductIndex);
      if (extraUrls.length > 0) body.extra_urls = extraUrls;
      if (briefingExtra.trim()) body.briefing_extra = briefingExtra.trim();

      const { data, error } = await supabase.functions.invoke("openflow-ai", { body });
      if (error) throw error;
      applyArsenalResult(data);
      setDialogOpen(false);
      setExtraUrl("");
      setBriefingExtra("");
    } catch (err: any) {
      console.error("[Arsenal] generate error:", err);
      toast.error(err?.message || "Erro ao gerar arsenal");
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
            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => setDialogOpen(true)}>
              <Sparkles className="h-3 w-3" /> Gerar com IA
            </Button>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-secondary/40 max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base">Gerar Arsenal de Copy com IA</DialogTitle>
            <DialogDescription className="text-xs leading-7">
              Quanto mais contexto você der, melhor o copy. Tudo aqui é opcional — a IA também usa Avatar, Branding e Produtos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {selectedProductEmpty && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-300/90 leading-relaxed">
                  <strong>Produto sem contexto cadastrado.</strong> O copy gerado será genérico. Para resultados melhores, cole a URL da página de vendas abaixo ou descreva o produto no briefing rápido.
                </p>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">URL extra (opcional)</Label>
              <Input
                value={extraUrl}
                onChange={(e) => setExtraUrl(e.target.value)}
                placeholder="https://..."
                className="bg-background text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                Cole o link da LP, página de vendas ou checkout que você quer que a IA leia agora — útil quando ainda não salvou no produto.
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Briefing rápido (opcional)</Label>
              <Textarea
                value={briefingExtra}
                onChange={(e) => setBriefingExtra(e.target.value)}
                placeholder={`1) Qual a transformação central que esse produto entrega? (ex: sair de X pra Y em Z dias)\n2) Quem é o inimigo / o que está bloqueando o avatar hoje?\n3) Que mecanismo único / método diferente você usa? (em 1 frase)`}
                className="bg-background text-sm min-h-[140px] leading-7"
              />
              <p className="text-[10px] text-muted-foreground">
                Responder essas 3 perguntas-chave dispara um copy muito mais afiado. Pode usar bullets, tópicos ou texto corrido.
              </p>
            </div>

            {productNames.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Produto-foco</Label>
                <Select value={selectedProductIndex} onValueChange={setSelectedProductIndex}>
                  <SelectTrigger className="bg-background text-sm h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {productNames.length > 1 && <SelectItem value="__all__">Todos os produtos</SelectItem>}
                    {productNames.map((name: string, i: number) => (
                      <SelectItem key={i} value={String(i)}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={generating}>Cancelar</Button>
            <Button onClick={handleGenerate} disabled={generating} className="gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? "Gerando..." : "Gerar Arsenal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-primary" onClick={() => copyBlock(block.key)} title="Copiar tudo">
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => clearBlock(block.key)} title="Limpar bloco para regenerar">
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
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

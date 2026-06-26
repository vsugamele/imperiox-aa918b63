import { useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Play, Loader2, Copy, RefreshCw, Workflow, Download } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { findItem, COLOR_TOKENS } from "./assetCatalog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isDslOutput, dslToBlueprint } from "@/lib/dsl-parser";

export interface HubAsset {
  id: string;
  catId: string;
  itemId: string;
  pos_x: number;
  pos_y: number;
  output?: string;
  generated_at?: string;
  edges?: Array<{ to: string; label?: string }>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  asset: HubAsset | null;
  product: any;
  projectId: string;
  onSaveOutput: (assetId: string, output: string) => void;
  onOpenBlueprint?: (blueprintId: string) => void;
}

export function AssetDetailDrawer({ open, onClose, asset, product, projectId, onSaveOutput, onOpenBlueprint }: Props) {
  const [generating, setGenerating] = useState(false);
  const [converting, setConverting] = useState(false);
  if (!asset) return null;
  const meta = findItem(asset.catId, asset.itemId);
  if (!meta) return null;
  const { cat, item } = meta;
  const colors = COLOR_TOKENS[cat.color];
  const hasDsl = isDslOutput(asset.output);

  const run = async () => {
    setGenerating(true);
    try {
      const productSummary = product
        ? `PRODUTO: ${product.nome || product.name}
PREÇO: ${product.preco_por || product.preco || product.price || "—"}
DESCRIÇÃO: ${product.descricao || product.description || "—"}
NICHO: ${product.nicho || "—"}
PÚBLICO: ${product.publico || product.avatar || "—"}`
        : "Sem produto vinculado.";

      const input = `${item.promptHint}

${productSummary}

Formato: markdown organizado em blocos com títulos H3 (###) para cada seção. Cada bloco com 3-7 linhas práticas e específicas. Pt-BR.`;

      const { data, error } = await supabase.functions.invoke("copy-engine", {
        body: {
          intent: item.intent,
          input,
          context: { project_id: projectId },
        },
      });
      if (error) throw error;
      const content = (data as any)?.content || "";
      if (!content) throw new Error("Sem conteúdo retornado");
      onSaveOutput(asset.id, content);
      toast.success("Conteúdo gerado!");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao gerar");
    } finally {
      setGenerating(false);
    }
  };
  const visualizarComoFluxo = async () => {
    if (!asset.output) return;
    setConverting(true);
    try {
      const bp = dslToBlueprint(asset.output, item.label);
      const { data, error } = await supabase
        .from("imphq_flow_blueprints")
        .insert({
          project_id: projectId,
          produto_nome: product?.nome || product?.name || null,
          title: `${item.label} (DSL)`,
          source: "dsl",
          blueprint: bp as any,
        })
        .select().single();
      if (error) throw error;
      toast.success(`Fluxo criado com ${bp.nodes.length} passos`);
      onOpenBlueprint?.(data.id);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao converter");
    } finally {
      setConverting(false);
    }
  };

  const exportTypebot = () => {
    if (!asset.output) return;
    const bp = dslToBlueprint(asset.output, item.label);
    const blob = new Blob([JSON.stringify(bp, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${item.id}-blueprint.json`;
    a.click();
    URL.revokeObjectURL(url);
  };


  const copy = () => {
    if (asset.output) {
      navigator.clipboard.writeText(asset.output);
      toast.success("Copiado");
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[640px] p-0 bg-[#080607] border-l border-border/60">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onClose}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="font-display text-base text-foreground/90">{item.label}</h2>
            <div className="w-8" />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
            {/* Product card */}
            {product && (
              <div className={`rounded-xl border ${colors.border} ${colors.bg} p-3 flex gap-3 items-start`}>
                {(product.imagem || product.image) && (
                  <img
                    src={product.imagem || product.image}
                    alt=""
                    className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className={`text-[10px] uppercase tracking-wider ${colors.text} font-semibold`}>
                    {cat.label}
                  </p>
                  <h3 className="font-display text-xl text-primary leading-tight">
                    {product.nome || product.name}
                  </h3>
                  {(product.preco_por || product.preco) && (
                    <p className="text-xs text-emerald-400 mt-0.5 font-semibold">
                      R$ {product.preco_por || product.preco}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Output */}
            {asset.output ? (
              <article className="prose prose-invert prose-sm max-w-none
                                  prose-headings:font-display prose-headings:text-pink-400
                                  prose-h1:text-2xl prose-h2:text-xl prose-h3:text-base prose-h3:uppercase prose-h3:tracking-wider
                                  prose-p:text-foreground/90 prose-p:leading-7
                                  prose-strong:text-primary
                                  prose-li:text-foreground/90 prose-li:leading-7
                                  prose-ul:my-2">
                <ReactMarkdown>{asset.output}</ReactMarkdown>
              </article>
            ) : (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground mb-4">
                  Nenhum conteúdo gerado ainda.
                </p>
                <p className="text-xs text-muted-foreground/70 max-w-md mx-auto">
                  {item.promptHint}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border/40 p-3 space-y-2">
            {asset.output && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={copy}>
                  <Copy className="h-3 w-3 mr-1" /> Copiar
                </Button>
                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={run} disabled={generating}>
                  <RefreshCw className={`h-3 w-3 mr-1 ${generating ? "animate-spin" : ""}`} /> Refazer
                </Button>
              </div>
            )}
            <Button
              onClick={run}
              disabled={generating}
              className="w-full h-11 bg-pink-600 hover:bg-pink-500 text-white font-semibold rounded-xl"
            >
              {generating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando...</>
              ) : (
                <><Play className="h-4 w-4 mr-2 fill-white" /> {asset.output ? "Executar novamente" : "Executar"}</>
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

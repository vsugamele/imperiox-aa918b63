import { useState, useEffect } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, Play, Loader2, Copy, RefreshCw, Workflow, Download, ExternalLink, Save, Link as LinkIcon, Shield, Zap, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { findItem, COLOR_TOKENS, isProductLinkedAsset, PRODUCT_LINKED_ASSETS } from "./assetCatalog";
import { normalizeProductLinks, pickBestLink, type ProductLinkTipo } from "@/lib/produto-links";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isDslOutput, dslToBlueprint } from "@/lib/dsl-parser";
import { isChannelOutput, parseChannelConfig, serializeChannelConfig, type ChannelConfig } from "@/lib/channel-config";
import { NodeCopyDialog } from "./NodeCopyDialog";


export interface HubAsset {
  id: string;
  catId: string;
  itemId: string;
  pos_x: number;
  pos_y: number;
  output?: string;
  generated_at?: string;
  edges?: Array<{ to: string; label?: string }>;
  linked_product_nome?: string | null;
  linked_flow_id?: string | null;
  linked_flow_nome?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  asset: HubAsset | null;
  product: any; // produto resolvido (vinculado OU produto atual do canvas)
  products?: any[]; // todos produtos do projeto, p/ seletor de vínculo
  projectId: string;
  onSaveOutput: (assetId: string, output: string) => void;
  onLinkProduct?: (assetId: string, produtoNome: string | null) => void;
  onOpenBlueprint?: (blueprintId: string) => void;
}

export function AssetDetailDrawer({ open, onClose, asset, product, products = [], projectId, onSaveOutput, onLinkProduct, onOpenBlueprint }: Props) {
  const [generating, setGenerating] = useState(false);
  const [converting, setConverting] = useState(false);
  const isChannel = asset?.catId === "canais";
  const [channel, setChannel] = useState<ChannelConfig>(parseChannelConfig(asset?.output));
  useEffect(() => { setChannel(parseChannelConfig(asset?.output)); }, [asset?.id, asset?.output]);
  if (!asset) return null;
  const meta = findItem(asset.catId, asset.itemId);
  if (!meta) return null;
  const { cat, item } = meta;
  const colors = COLOR_TOKENS[cat.color];
  const hasDsl = !isChannel && isDslOutput(asset.output);


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

  const applySkill = async (intent: "breakthrough_techniques" | "weaponized_credibility") => {
    if (!asset.output) {
      toast.error("Gere a copy primeiro antes de aplicar a skill.");
      return;
    }
    setGenerating(true);
    try {
      const label = intent === "breakthrough_techniques" ? "COPY A POTENCIALIZAR" : "COPY/CLAIM A BLINDAR";
      const { data, error } = await supabase.functions.invoke("copy-engine", {
        body: {
          intent,
          input: `## ${label}\n${asset.output}\n\n## CONTEXTO\nAtivo "${item.label}" do funil.`,
          context: { project_id: projectId },
        },
      });
      if (error) throw error;
      const content = (data as any)?.content;
      if (!content) throw new Error("Sem conteúdo retornado");
      onSaveOutput(asset.id, content);
      toast.success(intent === "breakthrough_techniques" ? "7 manobras aplicadas" : "Copy blindada com provas");
    } catch (e: any) {
      toast.error(e?.message || "Erro");
    } finally {
      setGenerating(false);
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

            {/* Produto vinculado (para nós de oferta/checkout) */}
            {isProductLinkedAsset(asset.catId, asset.itemId) && (() => {
              const role = PRODUCT_LINKED_ASSETS[`${asset.catId}:${asset.itemId}`];
              const linkedNome = asset.linked_product_nome || null;
              const linked = linkedNome ? products.find((p: any) => (p?.nome || p?.name) === linkedNome) : null;
              const productLinks = linked ? normalizeProductLinks(linked) : [];
              const best = linked ? pickBestLink(productLinks, { tipo: role.preferredLinkType as ProductLinkTipo | undefined }) : null;
              return (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] uppercase tracking-wider text-amber-300 font-semibold">
                      🛒 Produto vinculado · {role.role}
                    </p>
                    {linkedNome && onLinkProduct && (
                      <button
                        onClick={() => onLinkProduct(asset.id, null)}
                        className="text-[10px] text-muted-foreground hover:text-rose-300 underline"
                      >Desvincular</button>
                    )}
                  </div>
                  <select
                    value={linkedNome || ""}
                    onChange={(e) => onLinkProduct?.(asset.id, e.target.value || null)}
                    className="w-full h-9 rounded-md bg-[#0a0608] border border-border/60 px-2 text-sm"
                  >
                    <option value="">— Selecionar produto —</option>
                    {products.map((p: any, i: number) => {
                      const nome = p?.nome || p?.name || `Produto ${i + 1}`;
                      return <option key={i} value={nome}>{nome}</option>;
                    })}
                  </select>
                  {linked && (
                    <div className="text-xs space-y-1 pt-1">
                      {(linked.preco_por || linked.preco) && (
                        <p className="text-emerald-400 font-semibold">R$ {linked.preco_por || linked.preco}</p>
                      )}
                      {best ? (
                        <div className="flex items-center gap-1.5">
                          <a href={best.url} target="_blank" rel="noreferrer" className="text-cyan-300 hover:text-cyan-200 underline truncate flex-1">
                            {best.label || best.url}
                          </a>
                          <button
                            onClick={() => { navigator.clipboard.writeText(best.url); toast.success("Link copiado"); }}
                            className="text-[10px] text-muted-foreground hover:text-foreground"
                          >copiar</button>
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">Sem link configurado. Adicione em Briefing › Links do produto.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}



            {/* Channel editor */}
            {isChannel ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">{item.promptHint}</p>
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground">URL / Link</label>
                  <div className="flex gap-2">
                    <Input
                      value={channel.url || ""}
                      onChange={(e) => setChannel({ ...channel, url: e.target.value })}
                      placeholder="https://..."
                      className="bg-[#0a0608] border-border/60"
                    />
                    {channel.url && (
                      <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => window.open(channel.url, "_blank")}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Rótulo curto</label>
                  <Input
                    value={channel.label || ""}
                    onChange={(e) => setChannel({ ...channel, label: e.target.value })}
                    placeholder="Ex: Hotmart 12x sem juros"
                    className="bg-[#0a0608] border-border/60"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Observação / Contexto para IA</label>
                  <Textarea
                    value={channel.observacao || ""}
                    onChange={(e) => setChannel({ ...channel, observacao: e.target.value })}
                    placeholder="Quando usar este link, restrições, regiões etc."
                    rows={3}
                    className="bg-[#0a0608] border-border/60"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Prioridade IA</label>
                    <select
                      value={channel.prioridade_ia || "secundaria"}
                      onChange={(e) => setChannel({ ...channel, prioridade_ia: e.target.value as ChannelConfig["prioridade_ia"] })}
                      className="w-full h-9 rounded-md bg-[#0a0608] border border-border/60 px-2 text-sm"
                    >
                      <option value="preferida">Preferida</option>
                      <option value="secundaria">Secundária</option>
                      <option value="evitar">Evitar</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Status</label>
                    <select
                      value={channel.ativo === false ? "inativo" : "ativo"}
                      onChange={(e) => setChannel({ ...channel, ativo: e.target.value === "ativo" })}
                      className="w-full h-9 rounded-md bg-[#0a0608] border border-border/60 px-2 text-sm"
                    >
                      <option value="ativo">Ativo</option>
                      <option value="inativo">Inativo</option>
                    </select>
                  </div>
                </div>
              </div>
            ) : asset.output ? (
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
            {isChannel ? (
              <>
                {channel.url && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => { navigator.clipboard.writeText(channel.url!); toast.success("Link copiado"); }}>
                      <LinkIcon className="h-3 w-3 mr-1" /> Copiar link
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => window.open(channel.url, "_blank")}>
                      <ExternalLink className="h-3 w-3 mr-1" /> Abrir
                    </Button>
                  </div>
                )}
                <Button
                  onClick={() => { onSaveOutput(asset.id, serializeChannelConfig(channel)); toast.success("Canal salvo"); }}
                  className="w-full h-11 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl"
                >
                  <Save className="h-4 w-4 mr-2" /> Salvar canal
                </Button>
              </>
            ) : (
              <>
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
                {hasDsl && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/30" onClick={visualizarComoFluxo} disabled={converting}>
                      <Workflow className="h-3 w-3 mr-1" /> {converting ? "Convertendo..." : "Visualizar como Fluxo"}
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={exportTypebot}>
                      <Download className="h-3 w-3 mr-1" /> Typebot JSON
                    </Button>
                  </div>
                )}
                {asset.output && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs border-violet-700/50 text-violet-300 hover:bg-violet-900/30" onClick={() => applySkill("breakthrough_techniques")} disabled={generating}>
                      <Zap className="h-3 w-3 mr-1" /> 7 Manobras
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs border-sky-700/50 text-sky-300 hover:bg-sky-900/30" onClick={() => applySkill("weaponized_credibility")} disabled={generating}>
                      <Shield className="h-3 w-3 mr-1" /> Blindar Provas
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
              </>
            )}
          </div>

        </div>
      </SheetContent>
    </Sheet>
  );
}

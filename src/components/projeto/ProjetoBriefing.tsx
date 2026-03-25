import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Trash2, X, ChevronDown, ExternalLink } from "lucide-react";
import { useState } from "react";
import { CopyArsenalSection } from "./CopyArsenalSection";

const PIPELINE_KEYS = [
  { key: "avatar", label: "Avatar", emoji: "👤" },
  { key: "funil", label: "Funil", emoji: "🔻" },
  { key: "copy", label: "Copy", emoji: "✍️" },
  { key: "prompts", label: "Prompts", emoji: "🤖" },
  { key: "design", label: "Design", emoji: "🎨" },
  { key: "trafego", label: "Tráfego", emoji: "📡" },
];

const STATUS_OPTIONS = ["planejamento", "em andamento", "pausado", "concluído"];

const OFFER_TYPES = ["principal", "tripwire", "order_bump", "upsell", "downsell"];

const INTEGRATION_ITEMS = [
  { key: "clarity", label: "Microsoft Clarity", icon: "🔍", desc: "Heatmaps e session replay" },
  { key: "google_analytics", label: "Google Analytics", icon: "📊", desc: "GA4 tracking" },
  { key: "webhook_pagamento", label: "Webhook Pagamento", icon: "🔔", desc: "Hotmart / Kiwify / Ticto" },
  { key: "facebook_pixel", label: "Facebook Pixel / CAPI", icon: "📘", desc: "Conversions API" },
  { key: "resend", label: "Resend (Email)", icon: "📧", desc: "Email transacional" },
  { key: "utms", label: "UTMs no Site", icon: "🔗", desc: "Parâmetros de rastreamento" },
];

interface Props {
  project: any;
  onUpdateData: (data: any) => void;
  onUpdatePipeline: (pipeline: any) => void;
}

export function ProjetoBriefing({ project, onUpdateData, onUpdatePipeline }: Props) {
  const data = project.data || {};
  const pipeline = project.pipeline || {};
  const links = data.links || {};
  const produtos = data.produtos || [];
  const pipelineNotes = data.pipeline_notes || {};
  const checklist = data.integrations_checklist || {};

  const updateField = (key: string, val: any) => onUpdateData({ ...data, [key]: val });
  const updateLink = (key: string, val: string) => onUpdateData({ ...data, links: { ...links, [key]: val } });

  const updateProduto = (index: number, field: string, val: any) => {
    const updated = [...produtos];
    updated[index] = { ...updated[index], [field]: val };
    onUpdateData({ ...data, produtos: updated });
  };

  const addProduto = () => {
    onUpdateData({ ...data, produtos: [...produtos, { nome: "", tipo: "", preco: "", status: "ativo", links: [], ofertas: [] }] });
  };

  const removeProduto = (i: number) => {
    onUpdateData({ ...data, produtos: produtos.filter((_: any, j: number) => j !== i) });
  };

  // Multi-link helpers
  const getProductLinks = (p: any): string[] => {
    if (p.links && Array.isArray(p.links)) return p.links;
    if (p.link) return [p.link];
    return [];
  };

  const updateProductLinks = (index: number, newLinks: string[]) => {
    const updated = [...produtos];
    updated[index] = { ...updated[index], links: newLinks, link: undefined };
    onUpdateData({ ...data, produtos: updated });
  };

  const addProductLink = (index: number) => {
    const current = getProductLinks(produtos[index]);
    updateProductLinks(index, [...current, ""]);
  };

  const removeProductLink = (prodIndex: number, linkIndex: number) => {
    const current = getProductLinks(produtos[prodIndex]);
    updateProductLinks(prodIndex, current.filter((_, i) => i !== linkIndex));
  };

  const updateProductLink = (prodIndex: number, linkIndex: number, val: string) => {
    const current = getProductLinks(produtos[prodIndex]);
    const updated = [...current];
    updated[linkIndex] = val;
    updateProductLinks(prodIndex, updated);
  };

  // Offer helpers
  const getOffers = (p: any) => p.ofertas || [];

  const addOffer = (prodIndex: number) => {
    const updated = [...produtos];
    const ofertas = [...getOffers(updated[prodIndex]), { nome: "", preco_de: "", preco_por: "", tipo_oferta: "principal", link_checkout: "", ativo: true }];
    updated[prodIndex] = { ...updated[prodIndex], ofertas };
    onUpdateData({ ...data, produtos: updated });
  };

  const updateOffer = (prodIndex: number, offerIndex: number, field: string, val: any) => {
    const updated = [...produtos];
    const ofertas = [...getOffers(updated[prodIndex])];
    ofertas[offerIndex] = { ...ofertas[offerIndex], [field]: val };
    updated[prodIndex] = { ...updated[prodIndex], ofertas };
    onUpdateData({ ...data, produtos: updated });
  };

  const removeOffer = (prodIndex: number, offerIndex: number) => {
    const updated = [...produtos];
    const ofertas = getOffers(updated[prodIndex]).filter((_: any, i: number) => i !== offerIndex);
    updated[prodIndex] = { ...updated[prodIndex], ofertas };
    onUpdateData({ ...data, produtos: updated });
  };

  // Pipeline helpers
  const updatePipelineVal = (key: string, val: number) => {
    onUpdatePipeline({ ...pipeline, [key]: val });
  };

  const updatePipelineNote = (key: string, val: string) => {
    onUpdateData({ ...data, pipeline_notes: { ...pipelineNotes, [key]: val } });
  };

  // Checklist helpers
  const updateChecklist = (key: string, field: string, val: any) => {
    const item = checklist[key] || { status: "pendente", nota: "" };
    onUpdateData({ ...data, integrations_checklist: { ...checklist, [key]: { ...item, [field]: val } } });
  };

  const getStatusColor = (status: string) => {
    if (status === "verificado") return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    if (status === "configurado") return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    return "bg-destructive/20 text-destructive border-destructive/30";
  };

  return (
    <div className="space-y-6">
      {/* Dados do Projeto */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">📋 Dados do Projeto</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Nome</Label>
            <Input value={data.nome || project.name || ""} onChange={(e) => updateField("nome", e.target.value)} className="bg-secondary" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Categoria</Label>
            <Input value={data.categoria || project.category || ""} onChange={(e) => updateField("categoria", e.target.value)} className="bg-secondary" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Orçamento Tráfego</Label>
            <Input value={data.orcamento || ""} onChange={(e) => updateField("orcamento", e.target.value)} className="bg-secondary" placeholder="R$ 0,00" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Status Geral</Label>
            <Select value={data.status || "planejamento"} onValueChange={(v) => updateField("status", v)}>
              <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Rápido com notas inline */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">⚡ Pipeline Rápido</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {PIPELINE_KEYS.map((p) => {
            const val = pipeline[p.key] ?? 0;
            return (
              <Collapsible key={p.key}>
                <div className="flex items-center gap-3">
                  <span className="text-lg">{p.emoji}</span>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-muted-foreground">{p.label}</span>
                      <span className="text-xs font-mono text-primary">{val}%</span>
                    </div>
                    <Slider value={[val]} onValueChange={([v]) => updatePipelineVal(p.key, v)} max={100} step={5} />
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="pl-9 pt-2">
                  <Textarea
                    value={pipelineNotes[p.key] || ""}
                    onChange={(e) => updatePipelineNote(p.key, e.target.value)}
                    className="bg-secondary text-sm min-h-[40px]"
                    placeholder="Notas desta etapa..."
                  />
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </CardContent>
      </Card>

      {/* Links */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🔗 Links do Projeto</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {["site", "whatsapp", "instagram"].map((key) => (
            <div key={key}>
              <Label className="text-xs text-muted-foreground capitalize">{key}</Label>
              <Input value={links[key] || ""} onChange={(e) => updateLink(key, e.target.value)} className="bg-secondary" placeholder={`URL do ${key}`} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Produtos */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">📦 Produtos do Projeto</CardTitle>
          <Button size="sm" variant="outline" onClick={addProduto}><Plus className="h-3 w-3 mr-1" /> Produto</Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {produtos.map((p: any, i: number) => {
            const prodLinks = getProductLinks(p);
            const ofertas = getOffers(p);
            return (
              <div key={i} className="p-4 rounded-lg bg-secondary/50 border border-border space-y-4">
                {/* Product basic fields */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Nome</Label>
                    <Input value={p.nome || ""} onChange={(e) => updateProduto(i, "nome", e.target.value)} className="bg-secondary h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Tipo</Label>
                    <Input value={p.tipo || ""} onChange={(e) => updateProduto(i, "tipo", e.target.value)} className="bg-secondary h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Preço</Label>
                    <Input value={p.preco || ""} onChange={(e) => updateProduto(i, "preco", e.target.value)} className="bg-secondary h-8 text-sm" />
                  </div>
                  <div className="flex items-end gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeProduto(i)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>

                {/* Product links */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Links do Produto</Label>
                    <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => addProductLink(i)}>
                      <Plus className="h-3 w-3 mr-1" /> Link
                    </Button>
                  </div>
                  {prodLinks.length === 0 && <p className="text-xs text-muted-foreground/60">Nenhum link adicionado</p>}
                  {prodLinks.map((link: string, li: number) => (
                    <div key={li} className="flex items-center gap-2">
                      <Input value={link} onChange={(e) => updateProductLink(i, li, e.target.value)} className="bg-secondary h-8 text-sm flex-1" placeholder="https://..." />
                      {link && (
                        <a href={link} target="_blank" rel="noopener noreferrer" className="h-8 w-8 flex items-center justify-center text-primary hover:text-primary/80 shrink-0">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeProductLink(i, li)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Ofertas */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground font-medium">🏷️ Ofertas</Label>
                    <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => addOffer(i)}>
                      <Plus className="h-3 w-3 mr-1" /> Oferta
                    </Button>
                  </div>
                  {ofertas.length === 0 && <p className="text-xs text-muted-foreground/60">Nenhuma oferta cadastrada</p>}
                  {ofertas.map((of: any, oi: number) => (
                    <div key={oi} className="grid grid-cols-2 md:grid-cols-6 gap-2 p-3 rounded-md bg-background/50 border border-border/50 items-end">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Nome</Label>
                        <Input value={of.nome || ""} onChange={(e) => updateOffer(i, oi, "nome", e.target.value)} className="bg-secondary h-7 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">De R$</Label>
                        <Input value={of.preco_de || ""} onChange={(e) => updateOffer(i, oi, "preco_de", e.target.value)} className="bg-secondary h-7 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Por R$</Label>
                        <Input value={of.preco_por || ""} onChange={(e) => updateOffer(i, oi, "preco_por", e.target.value)} className="bg-secondary h-7 text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Tipo</Label>
                        <Select value={of.tipo_oferta || "principal"} onValueChange={(v) => updateOffer(i, oi, "tipo_oferta", v)}>
                          <SelectTrigger className="bg-secondary h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {OFFER_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs capitalize">{t.replace("_", " ")}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Link Checkout</Label>
                        <Input value={of.link_checkout || ""} onChange={(e) => updateOffer(i, oi, "link_checkout", e.target.value)} className="bg-secondary h-7 text-xs" placeholder="https://..." />
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={of.ativo !== false ? "default" : "secondary"} className="text-[10px] cursor-pointer" onClick={() => updateOffer(i, oi, "ativo", !of.ativo)}>
                          {of.ativo !== false ? "Ativo" : "Inativo"}
                        </Badge>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeOffer(i, oi)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Mecanismo + Contexto */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Mecanismo Único</Label>
                    <Textarea value={p.mecanismo || ""} onChange={(e) => updateProduto(i, "mecanismo", e.target.value)} className="bg-secondary text-sm min-h-[60px]" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Contexto / Objetivo</Label>
                    <Textarea value={p.contexto || ""} onChange={(e) => updateProduto(i, "contexto", e.target.value)} className="bg-secondary text-sm min-h-[60px]" />
                  </div>
                </div>

                {/* Arsenal de Copy */}
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-between text-xs">
                      <span>✍️ Arsenal de Copy</span>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[
                        { key: "promessa", emoji: "🎯", label: "Promessa", desc: "Desejo + tempo + dor + objeção principal" },
                        { key: "inimigo_comum", emoji: "👹", label: "Inimigo Comum", desc: "A culpa é do sistema, não do lead" },
                        { key: "efeito_colateral", emoji: "⚠️", label: "Efeito Colateral", desc: "Risco de continuar + nome do ciclo" },
                        { key: "oportunidade", emoji: "💎", label: "Oportunidade Escancarada", desc: "Mecanismo único + prova social + caso real" },
                        { key: "metodo_simplificado", emoji: "🧩", label: "Método Simplificado", desc: "Mostrar que é mais simples do que imagina" },
                        { key: "hora_do_show", emoji: "🎬", label: "Hora do Show", desc: "3 pilares + conteúdo que prova a promessa" },
                      ].map((block) => {
                        const arsenal = p.copy_arsenal || {};
                        return (
                          <div key={block.key} className="p-3 rounded-md bg-background/50 border border-border/50 space-y-1">
                            <Label className="text-xs font-medium flex items-center gap-1">
                              <span>{block.emoji}</span> {block.label}
                            </Label>
                            <p className="text-[10px] text-muted-foreground">{block.desc}</p>
                            <Textarea
                              value={arsenal[block.key] || ""}
                              onChange={(e) => {
                                const updated = { ...(p.copy_arsenal || {}), [block.key]: e.target.value };
                                updateProduto(i, "copy_arsenal", updated);
                              }}
                              className="bg-secondary text-sm min-h-[80px]"
                              placeholder={block.desc}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            );
          })}
          {produtos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum produto cadastrado.</p>}
        </CardContent>
      </Card>

      {/* Checklist de Integração */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🛠️ Setup de Integração</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {INTEGRATION_ITEMS.map((item) => {
              const itemData = checklist[item.key] || { status: "pendente", nota: "" };
              return (
                <div key={item.key} className="p-3 rounded-lg bg-secondary/50 border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{item.icon}</span>
                      <div>
                        <p className="text-xs font-medium">{item.label}</p>
                        <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                    <Select value={itemData.status || "pendente"} onValueChange={(v) => updateChecklist(item.key, "status", v)}>
                      <SelectTrigger className="w-auto h-6 text-[10px] px-2 gap-1 border-0">
                        <Badge variant="outline" className={`text-[10px] ${getStatusColor(itemData.status || "pendente")}`}>
                          {itemData.status === "verificado" ? "✓ Verificado" : itemData.status === "configurado" ? "◐ Configurado" : "○ Pendente"}
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendente" className="text-xs">○ Pendente</SelectItem>
                        <SelectItem value="configurado" className="text-xs">◐ Configurado</SelectItem>
                        <SelectItem value="verificado" className="text-xs">✓ Verificado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    value={itemData.nota || ""}
                    onChange={(e) => updateChecklist(item.key, "nota", e.target.value)}
                    className="bg-secondary h-7 text-xs"
                    placeholder="Observação..."
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

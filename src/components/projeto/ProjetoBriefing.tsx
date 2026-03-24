import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, X } from "lucide-react";

const PIPELINE_KEYS = ["avatar", "funil", "copy", "prompts", "design", "trafego"];
const STATUS_OPTIONS = ["planejamento", "em andamento", "pausado", "concluído"];

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

  const updateField = (key: string, val: any) => onUpdateData({ ...data, [key]: val });
  const updateLink = (key: string, val: string) => onUpdateData({ ...data, links: { ...links, [key]: val } });

  const updateProduto = (index: number, field: string, val: any) => {
    const updated = [...produtos];
    updated[index] = { ...updated[index], [field]: val };
    onUpdateData({ ...data, produtos: updated });
  };

  const addProduto = () => {
    onUpdateData({ ...data, produtos: [...produtos, { nome: "", tipo: "", preco: "", status: "ativo", links: [] }] });
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

      {/* Pipeline Rápido */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">⚡ Pipeline Rápido</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {PIPELINE_KEYS.map((key) => {
            const val = pipeline[key] ?? 0;
            return (
              <div key={key}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs capitalize text-muted-foreground">{key}</span>
                  <span className="text-xs font-mono text-primary">{val}%</span>
                </div>
                <Progress value={val} className="h-2" />
              </div>
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
        <CardContent className="space-y-4">
          {produtos.map((p: any, i: number) => {
            const prodLinks = getProductLinks(p);
            return (
              <div key={i} className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-md bg-secondary/50 border border-border relative">
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

                {/* Multiple links */}
                <div className="col-span-2 md:col-span-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Links do Produto</Label>
                    <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => addProductLink(i)}>
                      <Plus className="h-3 w-3 mr-1" /> Link
                    </Button>
                  </div>
                  {prodLinks.length === 0 && (
                    <p className="text-xs text-muted-foreground/60">Nenhum link adicionado</p>
                  )}
                  {prodLinks.map((link: string, li: number) => (
                    <div key={li} className="flex items-center gap-2">
                      <Input
                        value={link}
                        onChange={(e) => updateProductLink(i, li, e.target.value)}
                        className="bg-secondary h-8 text-sm flex-1"
                        placeholder="https://..."
                      />
                      {link && (
                        <a href={link} target="_blank" rel="noopener noreferrer" className="h-8 w-8 flex items-center justify-center text-primary hover:text-primary/80 shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </a>
                      )}
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeProductLink(i, li)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Mecanismo Único</Label>
                  <Textarea value={p.mecanismo || ""} onChange={(e) => updateProduto(i, "mecanismo", e.target.value)} className="bg-secondary text-sm min-h-[60px]" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Contexto / Objetivo</Label>
                  <Textarea value={p.contexto || ""} onChange={(e) => updateProduto(i, "contexto", e.target.value)} className="bg-secondary text-sm min-h-[60px]" />
                </div>
              </div>
            );
          })}
          {produtos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum produto cadastrado.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

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
import { Plus, Trash2, X, ChevronDown, ExternalLink, Copy, Check, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
  { key: "clarity", label: "Microsoft Clarity", icon: "🔍", desc: "Heatmaps e session replay", url: "https://clarity.microsoft.com" },
  { key: "google_analytics", label: "Google Analytics", icon: "📊", desc: "GA4 tracking", url: "https://analytics.google.com" },
  { key: "webhook_pagamento", label: "Webhook Pagamento", icon: "🔔", desc: "Hotmart / Kiwify / Ticto" },
  { key: "facebook_pixel", label: "Facebook Pixel / CAPI", icon: "📘", desc: "Conversions API", url: "https://business.facebook.com/events_manager2" },
  { key: "resend", label: "Resend (Email)", icon: "📧", desc: "Email transacional", url: "https://resend.com/api-keys" },
  { key: "utms", label: "UTMs no Site", icon: "🔗", desc: "Parâmetros de rastreamento" },
];

const INTEGRATION_FIELDS: Record<string, Array<{ field: string; label: string; placeholder: string; help: string; required?: boolean; secret?: boolean; readOnly?: boolean }>> = {
  clarity: [
    { field: "clarity_id", label: "Clarity ID", placeholder: "Ex: abc123xyz", help: "Encontre em clarity.ms → Settings → Overview", required: true },
  ],
  google_analytics: [
    { field: "ga4_measurement_id", label: "Measurement ID", placeholder: "Ex: G-XXXXXXXXXX", help: "GA4 → Admin → Data Streams → seu stream", required: true },
  ],
  webhook_pagamento: [
    { field: "webhook_url", label: "URL do Webhook (copie e cole na plataforma)", placeholder: "", help: "Cole esta URL na Hotmart, Kiwify ou Ticto como endpoint de webhook", readOnly: true },
  ],
  webhook_pagamento_list: [],
  facebook_pixel: [
    { field: "pixel_id", label: "Pixel ID", placeholder: "Ex: 123456789012345", help: "Events Manager → Data Sources → seu Pixel → Settings", required: true },
    { field: "access_token", label: "Access Token (CAPI)", placeholder: "Token de acesso para Conversions API", help: "Events Manager → Settings → Generate Access Token", secret: true, required: true },
    { field: "test_event_code", label: "Test Event Code", placeholder: "Ex: TEST12345", help: "Events Manager → Test Events → código exibido no topo" },
  ],
  resend: [
    { field: "resend_api_key", label: "API Key", placeholder: "re_xxxxxxxx...", help: "Encontre em resend.com → API Keys", required: true, secret: true },
    { field: "from_email", label: "Email Remetente", placeholder: "contato@seudominio.com", help: "Deve ser um domínio verificado no Resend", required: true },
  ],
  utms: [
    { field: "base_url", label: "URL Base do Site", placeholder: "https://seusite.com", help: "URL principal para geração automática de UTMs", required: true },
  ],
};

const SOCIAL_NETWORKS = [
  { key: "youtube", label: "YouTube", emoji: "▶️" },
  { key: "tiktok", label: "TikTok", emoji: "🎵" },
  { key: "pinterest", label: "Pinterest", emoji: "📌" },
  { key: "instagram", label: "Instagram", emoji: "📸" },
  { key: "facebook", label: "Facebook", emoji: "📘" },
  { key: "twitter", label: "Twitter/X", emoji: "🐦" },
  { key: "linkedin", label: "LinkedIn", emoji: "💼" },
  { key: "site", label: "Site", emoji: "🌐" },
  { key: "blog", label: "Blog", emoji: "📝" },
  { key: "whatsapp", label: "WhatsApp", emoji: "💬" },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copiado!");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={handleCopy}>
      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

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
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});

  const toggleSecret = (key: string) => setVisibleSecrets(prev => ({ ...prev, [key]: !prev[key] }));

  const updateField = (key: string, val: any) => onUpdateData({ ...data, [key]: val });
  const updateLink = (key: string, val: string) => onUpdateData({ ...data, links: { ...links, [key]: val } });

  // Project links (social/custom)
  const projectLinks: Array<{ label: string; url: string }> = Array.isArray(data.project_links) ? data.project_links : [];
  const updateProjectLinks = (newLinks: Array<{ label: string; url: string }>) => onUpdateData({ ...data, project_links: newLinks });
  const addSocialLink = (network: typeof SOCIAL_NETWORKS[0]) => {
    const exists = projectLinks.some(l => l.label === network.label);
    if (exists) {
      toast.info(`${network.label} já adicionado`);
      return;
    }
    updateProjectLinks([...projectLinks, { label: network.label, url: "" }]);
  };
  const [customLabel, setCustomLabel] = useState("");
  const [customUrl, setCustomUrl] = useState("");

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

  const updatePipelineVal = (key: string, val: number) => {
    onUpdatePipeline({ ...pipeline, [key]: val });
  };

  const updatePipelineNote = (key: string, val: string) => {
    onUpdateData({ ...data, pipeline_notes: { ...pipelineNotes, [key]: val } });
  };

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

      {/* Pipeline Rápido */}
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

      {/* Links & Redes Sociais (moved from separate tab) */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🔗 Links & Redes Sociais</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Quick add buttons */}
          <div className="flex flex-wrap gap-1.5">
            {SOCIAL_NETWORKS.map((net) => (
              <Button
                key={net.key}
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 px-2"
                onClick={() => addSocialLink(net)}
              >
                <span>{net.emoji}</span> {net.label}
              </Button>
            ))}
          </div>

          {/* Existing links */}
          {projectLinks.map((link, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-secondary/50 border border-border">
              <span className="text-sm font-medium min-w-[80px] truncate">{link.label}</span>
              <Input
                value={link.url}
                onChange={(e) => {
                  const updated = [...projectLinks];
                  updated[i] = { ...updated[i], url: e.target.value };
                  updateProjectLinks(updated);
                }}
                className="bg-secondary h-8 text-xs flex-1"
                placeholder={`URL do ${link.label}...`}
              />
              {link.url && (
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                </a>
              )}
              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive shrink-0" onClick={() => updateProjectLinks(projectLinks.filter((_, j) => j !== i))}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}

          {/* Custom link */}
          <div className="flex gap-2 items-end pt-2 border-t border-border">
            <div className="flex-1">
              <Input value={customLabel} onChange={e => setCustomLabel(e.target.value)} placeholder="Nome do link" className="bg-secondary h-8 text-xs" />
            </div>
            <div className="flex-1">
              <Input value={customUrl} onChange={e => setCustomUrl(e.target.value)} placeholder="https://..." className="bg-secondary h-8 text-xs" />
            </div>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => {
              if (!customLabel.trim() || !customUrl.trim()) return;
              updateProjectLinks([...projectLinks, { label: customLabel.trim(), url: customUrl.trim() }]);
              setCustomLabel("");
              setCustomUrl("");
            }}>
              <Plus className="h-3 w-3 mr-1" /> Custom
            </Button>
          </div>

          {projectLinks.length === 0 && <p className="text-xs text-muted-foreground">Clique em uma rede acima ou adicione um link custom.</p>}
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

                <CopyArsenalSection
                  arsenal={p.copy_arsenal || {}}
                  onChange={(updated) => updateProduto(i, "copy_arsenal", updated)}
                  projectId={project.id}
                />
              </div>
            );
          })}
          {produtos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum produto cadastrado.</p>}
        </CardContent>
      </Card>

      {/* Setup de Integração com campos reais + links externos + toggle secrets */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">🛠️ Setup de Integração</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {INTEGRATION_ITEMS.map((item) => {
              const itemData = checklist[item.key] || { status: "pendente", nota: "" };
              const fbFallback = item.key === "facebook_pixel" ? {
                pixel_id: itemData.pixel_id || data.facebook_pixel_id || "",
                access_token: itemData.access_token || data.facebook_access_token || "",
                test_event_code: itemData.test_event_code || data.facebook_test_event_code || "",
              } : {};

              const fields = INTEGRATION_FIELDS[item.key] || [];
              
              const filledCount = fields.filter((f: any) => {
                if (f.readOnly) return true;
                const val = item.key === "facebook_pixel" && fbFallback[f.field as keyof typeof fbFallback]
                  ? fbFallback[f.field as keyof typeof fbFallback]
                  : itemData[f.field] || "";
                return val.toString().trim().length > 0;
              }).length;
              const requiredFields = fields.filter((f: any) => f.required);
              const requiredFilled = requiredFields.filter((f: any) => {
                const val = item.key === "facebook_pixel" && fbFallback[f.field as keyof typeof fbFallback]
                  ? fbFallback[f.field as keyof typeof fbFallback]
                  : itemData[f.field] || "";
                return val.toString().trim().length > 0;
              }).length;
              const autoStatus = requiredFields.length > 0 && requiredFilled === requiredFields.length
                ? (itemData.status === "verificado" ? "verificado" : "configurado")
                : (itemData.status === "verificado" ? "verificado" : "pendente");

              return (
                <div key={item.key} className="p-3 rounded-lg bg-secondary/50 border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{item.icon}</span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-medium">{item.label}</p>
                          {item.url && (
                            <a href={item.url} target="_blank" rel="noopener noreferrer" title={`Abrir ${item.label}`}>
                              <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary transition-colors" />
                            </a>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className={`text-[10px] ${getStatusColor(autoStatus)}`}>
                        {autoStatus === "verificado" ? "✓ Verificado" : autoStatus === "configurado" ? "◐ Configurado" : "○ Pendente"}
                      </Badge>
                      {autoStatus === "configurado" && itemData.status !== "verificado" && (
                        <Button size="sm" variant="ghost" className="h-5 text-[9px] px-1.5" onClick={() => updateChecklist(item.key, "status", "verificado")}>
                          Marcar verificado
                        </Button>
                      )}
                      {itemData.status === "verificado" && (
                        <Button size="sm" variant="ghost" className="h-5 text-[9px] px-1.5 text-muted-foreground" onClick={() => updateChecklist(item.key, "status", "configurado")}>
                          Desfazer
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {fields.map((f: any) => {
                      const val = item.key === "facebook_pixel" && fbFallback[f.field as keyof typeof fbFallback]
                        ? fbFallback[f.field as keyof typeof fbFallback]
                        : itemData[f.field] || "";
                      const secretKey = `${item.key}_${f.field}`;
                      const isVisible = visibleSecrets[secretKey];

                      if (f.readOnly) {
                        const webhookUrl = `https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/webhook-pagamento?project=${project.id}`;
                        return (
                          <div key={f.field}>
                            <Label className="text-[10px] text-muted-foreground">{f.label}</Label>
                            <div className="flex items-center gap-1">
                              <Input value={webhookUrl} readOnly className="bg-secondary h-7 text-[10px] font-mono flex-1" />
                              <CopyButton text={webhookUrl} />
                            </div>
                            <p className="text-[9px] text-muted-foreground/70 mt-0.5">{f.help}</p>
                          </div>
                        );
                      }

                      return (
                        <div key={f.field}>
                          <Label className="text-[10px] text-muted-foreground">{f.label}{f.required && " *"}</Label>
                          <div className="flex items-center gap-1">
                            <Input
                              value={val}
                              onChange={(e) => updateChecklist(item.key, f.field, e.target.value)}
                              className="bg-secondary h-7 text-xs flex-1"
                              placeholder={f.placeholder}
                              type={f.secret && !isVisible ? "password" : "text"}
                            />
                            {f.secret && (
                              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => toggleSecret(secretKey)}>
                                {isVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              </Button>
                            )}
                          </div>
                          <p className="text-[9px] text-muted-foreground/70 mt-0.5">{f.help}</p>
                        </div>
                      );
                    })}

                    {/* Multiple webhooks for webhook_pagamento */}
                    {item.key === "webhook_pagamento" && (() => {
                      const webhooks: Array<{ nome: string; token: string }> = data.webhooks || [];
                      const addWebhook = () => {
                        const updated = [...webhooks, { nome: "", token: "" }];
                        onUpdateData({ ...data, webhooks: updated });
                      };
                      const updateWebhook = (idx: number, field: string, val: string) => {
                        const updated = [...webhooks];
                        updated[idx] = { ...updated[idx], [field]: val };
                        onUpdateData({ ...data, webhooks: updated });
                      };
                      const removeWebhook = (idx: number) => {
                        onUpdateData({ ...data, webhooks: webhooks.filter((_, i) => i !== idx) });
                      };
                      return (
                        <div className="space-y-2 pt-2 border-t border-border">
                          <div className="flex items-center justify-between">
                            <Label className="text-[10px] text-muted-foreground font-medium">Webhooks por Plataforma</Label>
                            <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={addWebhook}>
                              <Plus className="h-3 w-3 mr-1" /> Webhook
                            </Button>
                          </div>
                          {webhooks.map((wh, wi) => {
                            const whUrl = `https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/webhook-pagamento?project=${project.id}${wh.nome ? `&source=${encodeURIComponent(wh.nome)}` : ""}`;
                            return (
                              <div key={wi} className="p-2 rounded bg-background/50 border border-border/50 space-y-1.5">
                                <div className="flex gap-2 items-center">
                                  <Input value={wh.nome} onChange={e => updateWebhook(wi, "nome", e.target.value)} placeholder="Ex: Hotmart, Kiwify..." className="bg-secondary h-7 text-xs flex-1" />
                                  <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive shrink-0" onClick={() => removeWebhook(wi)}><Trash2 className="h-3 w-3" /></Button>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Input value={whUrl} readOnly className="bg-secondary h-6 text-[9px] font-mono flex-1" />
                                  <CopyButton text={whUrl} />
                                </div>
                                <div className="flex items-center gap-1">
                                  <Input
                                    value={wh.token || ""}
                                    onChange={e => updateWebhook(wi, "token", e.target.value)}
                                    placeholder="Token de validação (opcional)"
                                    className="bg-secondary h-6 text-xs flex-1"
                                    type={visibleSecrets[`wh_${wi}`] ? "text" : "password"}
                                  />
                                  <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => toggleSecret(`wh_${wi}`)}>
                                    {visibleSecrets[`wh_${wi}`] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                          {webhooks.length === 0 && <p className="text-[9px] text-muted-foreground">Adicione webhooks para cada plataforma de pagamento.</p>}
                        </div>
                      );
                    })()}
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

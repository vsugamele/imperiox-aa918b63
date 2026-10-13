import { useState, useMemo } from "react";
import type { Site } from "./SiteCard";
import { jsonFields } from "@/lib/json-fields";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  Smartphone,
  Monitor,
  RefreshCw,
  Palette,
  Type,
  MousePointerClick,
  FileText,
  Link2,
  Github,
  Globe,
} from "lucide-react";
import { SiteThumbnail, getCleanDomain } from "./SiteThumbnail";

interface SiteDetailModalProps {
  site: Site | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAttach?: () => void;
  onUseAsBase?: () => void;
  onCreateEcosystem?: () => void;
  onRescrape?: () => void;
}

export function SiteDetailModal({
  site,
  open,
  onOpenChange,
  onAttach,
  onUseAsBase,
  onCreateEcosystem,
  onRescrape,
}: SiteDetailModalProps) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const domain = useMemo(() => (site ? getCleanDomain(site.url) : ""), [site]);
  const branding = useMemo(() => (site ? jsonFields(site.branding_json) : {}), [site]);

  const colors = useMemo(() => {
    const c = jsonFields(branding.colors);
    return Object.entries(c)
      .filter(([_, val]) => typeof val === "string" && (val.startsWith("#") || val.startsWith("rgb") || val.startsWith("hsl") || val.startsWith("oklch")))
      .map(([key, val]) => ({ name: key, hex: val as string }));
  }, [branding]);

  const typography = useMemo(() => {
    const fonts = Array.isArray(branding.fonts) ? branding.fonts : [];
    const typo = jsonFields(branding.typography);
    return { fonts, typo };
  }, [branding]);

  const buttons = useMemo(() => {
    const comps = jsonFields(branding.components);
    const reasoning = jsonFields(branding.__llm_button_reasoning);
    return { comps, reasoning };
  }, [branding]);

  if (!site) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`${label} copiado!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleRefreshScreenshot = async () => {
    if (!onRescrape) return;
    setIsRefreshing(true);
    try {
      await onRescrape();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-slate-950 border-white/10 text-slate-100">
        {/* Header Superior */}
        <DialogHeader className="p-4 sm:p-5 border-b border-white/10 bg-slate-900/60 flex flex-row items-center justify-between gap-4 space-y-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-slate-800 border border-white/10 p-2 flex items-center justify-center shrink-0">
              <img
                src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
                alt={domain}
                className="w-6 h-6 object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = "none";
                }}
              />
              <Globe className="w-5 h-5 text-slate-400" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base sm:text-lg font-semibold truncate leading-tight flex items-center gap-2">
                <span>{site.titulo}</span>
                <Badge variant="outline" className="text-xs uppercase bg-white/5 border-white/10 shrink-0">
                  {site.tipo}
                </Badge>
              </DialogTitle>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                <span className="font-mono text-slate-300">{domain}</span>
                <span>•</span>
                <a
                  href={site.url}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-primary transition-colors flex items-center gap-1"
                >
                  Abrir site <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 pr-8 sm:pr-0">
            {onCreateEcosystem && (
              <Button
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onCreateEcosystem();
                }}
                className="gap-1.5 bg-gradient-to-r from-amber-500 to-primary text-slate-950 font-medium hover:brightness-110"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Criar Ecossistema</span>
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Corpo com Abas */}
        <Tabs defaultValue="visual" className="flex-1 flex flex-col min-h-0">
          <div className="px-5 border-b border-white/10 bg-slate-900/30 flex items-center justify-between flex-wrap gap-2">
            <TabsList className="bg-transparent h-11 p-0 gap-6 border-0">
              <TabsTrigger
                value="visual"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-1 py-2.5 font-medium text-xs sm:text-sm"
              >
                <Monitor className="w-4 h-4 mr-1.5" />
                Visual & Preview
              </TabsTrigger>
              <TabsTrigger
                value="copy"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-1 py-2.5 font-medium text-xs sm:text-sm"
              >
                <FileText className="w-4 h-4 mr-1.5" />
                Copy Extraída
              </TabsTrigger>
              <TabsTrigger
                value="branding"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-1 py-2.5 font-medium text-xs sm:text-sm"
              >
                <Palette className="w-4 h-4 mr-1.5" />
                Branding & Cores
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2 py-1">
              {onAttach && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-white/10 bg-white/5 hover:bg-white/10"
                  onClick={() => {
                    onOpenChange(false);
                    onAttach();
                  }}
                >
                  <Link2 className="w-3 h-3 mr-1" /> Anexar
                </Button>
              )}
              {onUseAsBase && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-white/10 bg-white/5 hover:bg-white/10"
                  onClick={() => {
                    onOpenChange(false);
                    onUseAsBase();
                  }}
                >
                  <Sparkles className="w-3 h-3 mr-1" /> Usar Copy
                </Button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* ABA 1: VISUAL & PREVIEW */}
            <TabsContent value="visual" className="m-0 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <div className="bg-slate-900 border border-white/10 rounded-lg p-0.5 flex">
                    <button
                      type="button"
                      onClick={() => setDevice("desktop")}
                      className={`px-3 py-1 rounded text-xs flex items-center gap-1.5 transition-colors ${
                        device === "desktop" ? "bg-primary text-primary-foreground font-medium" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Monitor className="w-3.5 h-3.5" /> Desktop
                    </button>
                    <button
                      type="button"
                      onClick={() => setDevice("mobile")}
                      className={`px-3 py-1 rounded text-xs flex items-center gap-1.5 transition-colors ${
                        device === "mobile" ? "bg-primary text-primary-foreground font-medium" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5" /> Mobile
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRefreshScreenshot}
                    disabled={isRefreshing}
                    className="h-8 text-xs border-white/10 bg-white/5 hover:bg-white/10 gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
                    {isRefreshing ? "Atualizando..." : "Recapturar Print"}
                  </Button>
                  <Button asChild size="sm" className="h-8 text-xs gap-1.5">
                    <a href={site.url} target="_blank" rel="noreferrer">
                      Visitar URL <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </Button>
                </div>
              </div>

              {/* Moldura do Preview */}
              <div className="flex justify-center bg-slate-900/40 rounded-xl p-4 sm:p-6 border border-white/5">
                <div
                  className={`transition-all duration-300 rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-slate-950 ${
                    device === "desktop" ? "w-full max-w-3xl" : "w-[360px] h-[580px] flex flex-col"
                  }`}
                >
                  <SiteThumbnail
                    site={site}
                    aspect={device === "desktop" ? "aspect-video" : "h-full w-full"}
                    showBrowserBar={true}
                    onRefreshScreenshot={handleRefreshScreenshot}
                    isRefreshing={isRefreshing}
                  />
                </div>
              </div>

              {site.summary && (
                <div className="rounded-lg bg-slate-900/60 border border-white/10 p-4 space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" /> Resumo Estratégico da IA
                  </span>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{site.summary}</p>
                </div>
              )}
            </TabsContent>

            {/* ABA 2: COPY EXTRAÍDA */}
            <TabsContent value="copy" className="m-0 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold">Copy da Página / VSL</h4>
                  <p className="text-xs text-slate-400">Texto minerado da estrutura persuasiva original.</p>
                </div>
                {site.content_md && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-white/10 bg-white/5 hover:bg-white/10 text-xs"
                    onClick={() => copyToClipboard(site.content_md || "", "Copy")}
                  >
                    {copiedField === "Copy" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    Copiar toda a Copy
                  </Button>
                )}
              </div>

              {site.content_md ? (
                <div className="rounded-xl border border-white/10 bg-slate-900/80 p-4 max-h-[500px] overflow-y-auto">
                  <pre className="font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed select-text">
                    {site.content_md}
                  </pre>
                </div>
              ) : (
                <div className="text-center py-12 border border-dashed border-white/10 rounded-xl text-slate-500 space-y-2">
                  <FileText className="w-8 h-8 mx-auto opacity-40" />
                  <p className="text-xs">Nenhuma copy extraída ainda.</p>
                  <Button size="sm" variant="link" onClick={handleRefreshScreenshot}>
                    Extrair agora via Re-scrape
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* ABA 3: BRANDING & CORES */}
            <TabsContent value="branding" className="m-0 space-y-6">
              {/* Paleta de Cores */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Palette className="w-4 h-4 text-primary" /> Paleta de Cores Identificada
                </h4>
                {colors.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {colors.map((c, i) => (
                      <div
                        key={i}
                        onClick={() => copyToClipboard(c.hex, c.hex)}
                        className="rounded-lg border border-white/10 bg-slate-900/60 p-2.5 flex flex-col gap-2 cursor-pointer hover:border-primary/50 transition-colors group"
                      >
                        <div
                          className="w-full h-12 rounded border border-white/10 shadow-inner group-hover:scale-[1.02] transition-transform"
                          style={{ backgroundColor: c.hex }}
                        />
                        <div className="space-y-0.5">
                          <p className="text-[10px] uppercase font-mono text-slate-400 tracking-wider truncate">{c.name}</p>
                          <p className="text-xs font-mono font-medium text-slate-200 flex items-center justify-between">
                            <span>{c.hex}</span>
                            <Copy className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Nenhuma cor registrada.</p>
                )}
              </div>

              {/* Tipografia */}
              <div className="space-y-3 pt-4 border-t border-white/10">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Type className="w-4 h-4 text-primary" /> Tipografia & Fontes
                </h4>
                {typography.fonts && typography.fonts.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {typography.fonts.map((f: any, i: number) => (
                      <div key={i} className="rounded-lg border border-white/10 bg-slate-900/60 p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono text-slate-400 uppercase">{f.role || "Fonte"}</span>
                          <Badge variant="outline" className="text-[10px] bg-white/5 border-white/10 font-mono">
                            {f.family}
                          </Badge>
                        </div>
                        <p className="text-lg font-medium text-slate-200" style={{ fontFamily: f.family }}>
                          Ag The quick brown fox
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Nenhuma fonte catalogada.</p>
                )}
              </div>

              {/* Botões e CTAs */}
              {buttons.reasoning && Object.keys(buttons.reasoning).length > 0 && (
                <div className="space-y-3 pt-4 border-t border-white/10">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <MousePointerClick className="w-4 h-4 text-primary" /> Análise de CTAs & Conversão
                  </h4>
                  <div className="space-y-2.5">
                    {Object.entries(buttons.reasoning).map(([key, val]: [string, any]) => {
                      if (!val || typeof val !== "object" || !val.text) return null;
                      return (
                        <div key={key} className="rounded-lg border border-white/10 bg-slate-900/60 p-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-primary uppercase font-mono">{key} CTA</span>
                            <Badge className="text-xs bg-primary/20 text-primary border-primary/30">"{val.text}"</Badge>
                          </div>
                          {val.reasoning && (
                            <p className="text-xs text-slate-400 leading-relaxed">{val.reasoning}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Repositório GitHub se houver */}
              {site.github_url && (
                <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                  <span className="text-xs text-slate-400 flex items-center gap-2">
                    <Github className="w-4 h-4 text-slate-300" /> Repositório de Código
                  </span>
                  <a
                    href={site.github_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1 font-mono"
                  >
                    {site.github_url.replace(/^https?:\/\/(www\.)?github\.com\//, "")}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useMemo, useEffect } from "react";
import type { Site } from "./SiteCard";
import { jsonFields } from "@/lib/json-fields";
import { Globe, Video, Newspaper, ShoppingBag, Layout, CheckCircle, FileText, Lock, Sparkles, RefreshCw } from "lucide-react";

interface SiteThumbnailProps {
  site: Site;
  className?: string;
  aspect?: string;
  showBrowserBar?: boolean;
  onRefreshScreenshot?: () => void;
  isRefreshing?: boolean;
}

const TIPO_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  vsl: Video,
  advertorial: Newspaper,
  pdp: ShoppingBag,
  lp: Layout,
  checkout: CheckCircle,
  obrigado: CheckCircle,
  captura: FileText,
  outro: Globe,
};

export function getCleanDomain(rawUrl: string): string {
  try {
    const u = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return rawUrl.replace(/^https?:\/\//, "").split("/")[0] || rawUrl;
  }
}

export function SiteThumbnail({
  site,
  className = "",
  aspect = "aspect-video",
  showBrowserBar = true,
  onRefreshScreenshot,
  isRefreshing = false,
}: SiteThumbnailProps) {
  const domain = useMemo(() => getCleanDomain(site.url), [site.url]);

  const branding = useMemo(() => jsonFields(site.branding_json), [site.branding_json]);
  const ogImage = useMemo(() => {
    const images = jsonFields(branding.images);
    return typeof images.ogImage === "string" && images.ogImage.startsWith("http")
      ? images.ogImage
      : null;
  }, [branding]);

  const brandColors = useMemo(() => {
    const colors = jsonFields(branding.colors);
    const primary = typeof colors.primary === "string" ? colors.primary : null;
    const bg = typeof colors.background === "string" ? colors.background : null;
    return { primary, bg };
  }, [branding]);

  // Construir lista ordenada de candidatos visuais
  const candidates = useMemo(() => {
    const list: string[] = [];
    const rawThumb = site.thumbnail_url?.trim();

    // Se o thumbnail não for link expirado do firecrawl
    if (rawThumb && (rawThumb.startsWith("data:") || rawThumb.startsWith("http"))) {
      if (!rawThumb.includes("firecrawl-scrape-media") || rawThumb.includes("Expires=179") || rawThumb.includes("Expires=18")) {
        list.push(rawThumb);
      }
    }

    // Candidato 2: ogImage do branding
    if (ogImage && !list.includes(ogImage)) {
      list.push(ogImage);
    }

    // Candidato 3: WordPress mshots (rápido, gratuito, alta disponibilidade)
    if (site.url) {
      const cleanUrl = site.url.startsWith("http") ? site.url : `https://${site.url}`;
      const mshots = `https://s0.wp.com/mshots/v1/${encodeURIComponent(cleanUrl)}?w=800`;
      list.push(mshots);
    }

    // Candidato 4: Microlink screenshot
    if (site.url) {
      const cleanUrl = site.url.startsWith("http") ? site.url : `https://${site.url}`;
      const microlink = `https://api.microlink.io?url=${encodeURIComponent(cleanUrl)}&screenshot=true&meta=false&embed=screenshot.url`;
      list.push(microlink);
    }

    return list;
  }, [site.thumbnail_url, site.url, ogImage]);

  const [candidateIndex, setCandidateIndex] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Reset se o site mudar
  useEffect(() => {
    setCandidateIndex(0);
    setHasError(false);
    setIsLoaded(false);
  }, [site.thumbnail_url, site.url]);

  const currentSrc = candidates[candidateIndex] || null;
  const isExhausted = hasError || !currentSrc;

  const handleImageError = () => {
    if (candidateIndex + 1 < candidates.length) {
      setCandidateIndex((prev) => prev + 1);
      setIsLoaded(false);
    } else {
      setHasError(true);
    }
  };

  const TipoIcon = TIPO_ICON[site.tipo] || Globe;
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

  return (
    <div className={`relative ${aspect} w-full overflow-hidden bg-slate-950/80 select-none group/thumb ${className}`}>
      {/* Barra de Navegador Estilo Safari/macOS */}
      {showBrowserBar && (
        <div className="absolute top-0 left-0 right-0 z-20 h-6 bg-slate-950/80 backdrop-blur-md border-b border-white/10 px-2.5 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500/80" />
            <span className="w-2 h-2 rounded-full bg-amber-500/80" />
            <span className="w-2 h-2 rounded-full bg-emerald-500/80" />
          </div>
          <div className="flex items-center gap-1 max-w-[65%] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-slate-300 font-mono truncate">
            <Lock className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
            <span className="truncate">{domain}</span>
          </div>
          <div className="w-8 flex justify-end">
            {onRefreshScreenshot && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRefreshScreenshot();
                }}
                disabled={isRefreshing}
                title="Recapturar screenshot"
                className="pointer-events-auto p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <RefreshCw className={`w-2.5 h-2.5 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Imagem do Site com fallback progressivo */}
      {!isExhausted && currentSrc ? (
        <>
          {/* Skeleton Shimmer enquanto carrega */}
          {!isLoaded && (
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 animate-pulse flex items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-slate-500">
                <Globe className="w-6 h-6 animate-spin opacity-50" />
                <span className="text-[10px] font-mono">Renderizando visual…</span>
              </div>
            </div>
          )}

          <img
            src={currentSrc}
            alt={site.titulo}
            onLoad={() => setIsLoaded(true)}
            onError={handleImageError}
            loading="lazy"
            className={`w-full h-full object-cover object-top transition-all duration-500 group-hover/thumb:scale-[1.03] ${
              showBrowserBar ? "pt-6" : ""
            } ${isLoaded ? "opacity-100" : "opacity-0"}`}
          />
        </>
      ) : (
        /* Branded Mockup: Fallback visual dinâmico com identidade visual do site */
        <div
          className={`w-full h-full flex flex-col items-center justify-center p-4 relative overflow-hidden ${
            showBrowserBar ? "pt-7" : ""
          }`}
          style={{
            background: brandColors.primary
              ? `radial-gradient(circle at 50% 30%, ${brandColors.primary}22 0%, #090a10 85%)`
              : "radial-gradient(circle at 50% 30%, #1e1b4b 0%, #090a10 85%)",
          }}
        >
          {/* Grid decorativo de fundo */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)",
              backgroundSize: "16px 16px",
            }}
          />

          <div className="relative z-10 flex flex-col items-center text-center max-w-[90%] gap-2">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-slate-900/90 border border-white/10 shadow-xl flex items-center justify-center overflow-hidden p-2">
                <img
                  src={faviconUrl}
                  alt={domain}
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = "none";
                  }}
                  className="w-7 h-7 object-contain"
                />
                <TipoIcon className="w-6 h-6 text-slate-400 absolute" />
              </div>
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
              </span>
            </div>

            <div className="space-y-0.5">
              <h4 className="font-medium text-xs text-slate-200 line-clamp-1 max-w-[200px]" title={site.titulo}>
                {site.titulo}
              </h4>
              <p className="text-[10px] text-slate-400 font-mono">{domain}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

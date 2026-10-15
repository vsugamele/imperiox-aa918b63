import { useState, useMemo, useEffect } from "react";
import type { Site } from "./SiteCard";
import { jsonFields } from "@/lib/json-fields";
import { Globe, Video, Newspaper, ShoppingBag, Layout, CheckCircle, FileText, Lock, Sparkles, RefreshCw } from "lucide-react";

/** Site exibível na miniatura, com o papel opcional que ele cumpre no projeto. */
export type SiteThumbnailItem = Site & { role?: string | null };

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

const STAGE_PREVIEW_BY_TIPO: Record<string, string> = {
  vsl: "/map-previews/stage-vsl.png",
  lp: "/map-previews/stage-vsl.png",
  advertorial: "/map-previews/stage-ads.png",
  pdp: "/map-previews/stage-checkout.png",
  checkout: "/map-previews/stage-checkout.png",
  obrigado: "/map-previews/stage-checkout.png",
  captura: "/map-previews/stage-whatsapp.png",
  outro: "/map-previews/stage-vsl.png",
};

const ICON_NAME_TO_EMOJI: Record<string, string> = {
  flame: "🔥",
  brain: "🧠",
  droplets: "💧",
  heart: "❤️",
  shield: "🛡️",
  sparkles: "✨",
  zap: "⚡",
  rocket: "🚀",
  target: "🎯",
  crown: "👑",
};

export function normalizeProjectIcon(rawIcon?: string | null, projectId?: string | null): string {
  const byId: Record<string, string> = {
    jp_freitas: "💈",
    linfaflow: "🌿",
    slimsoda: "🥤",
    memoflow: "🧠",
    cardioflush: "❤️",
    leaftide: "💧",
    horsejello: "🔥",
    "cinna-shield": "🛡️",
    vigor_boost: "✨",
    tatuagem: "🎨",
    laise: "✈️",
    "dr---fitness": "💪",
    lipo: "💧",
  };
  if (rawIcon && rawIcon.trim()) {
    const trimmed = rawIcon.trim();
    const mapped = ICON_NAME_TO_EMOJI[trimmed.toLowerCase()];
    if (mapped) return mapped;
    // Se não for palavra ASCII pura (ex: já é emoji), retorna direto
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) return trimmed;
  }
  if (projectId && byId[projectId]) return byId[projectId];
  return "🎯";
}

export function createVirtualSiteFromUrl(
  url: string,
  titulo = "Página do Projeto",
  tipo = "vsl",
  thumbnailUrl: string | null = null
): Site {
  const cleanUrl = url?.trim() || "https://imperio.hq";
  return {
    id: `virtual-${cleanUrl}`,
    user_id: "",
    titulo,
    url: cleanUrl,
    tipo,
    status: "ativo",
    tags: [tipo],
    thumbnail_url: thumbnailUrl,
    branding_json: null,
    content_md: null,
    summary: null,
    last_scraped_at: null,
    created_at: new Date().toISOString(),
  };
}

export function getCleanDomain(rawUrl: string): string {
  try {
    const u = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return rawUrl.replace(/^https?:\/\//, "").split("/")[0] || rawUrl;
  }
}

function normalizeMshotsUrl(rawThumb: string): string {
  const prefix = "https://s0.wp.com/mshots/v1/";
  if (!rawThumb.startsWith(prefix)) return rawThumb;
  const rest = rawThumb.slice(prefix.length);
  // Se já estiver URL-encoded (começa com https%3A), mantém
  if (rest.startsWith("http%3A") || rest.startsWith("https%3A")) return rawThumb;
  // Remove sufixo ?w=800 ou &w=800 para codificar a URL interna limpa
  const cleanedInner = rest.replace(/[?&]w=\d+$/, "");
  return `${prefix}${encodeURIComponent(cleanedInner)}?w=800`;
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

  const stageFallbackImg = STAGE_PREVIEW_BY_TIPO[site.tipo] || "/map-previews/stage-vsl.png";

  // Construir lista ordenada de candidatos visuais
  const candidates = useMemo(() => {
    const list: string[] = [];
    const rawThumb = site.thumbnail_url?.trim();

    // Candidato 1: thumbnail salvo (normalizando mshots se necessário)
    if (rawThumb && (rawThumb.startsWith("data:") || rawThumb.startsWith("http") || rawThumb.startsWith("/"))) {
      if (!rawThumb.includes("firecrawl-scrape-media") || rawThumb.includes("Expires=179") || rawThumb.includes("Expires=18")) {
        list.push(normalizeMshotsUrl(rawThumb));
      }
    }

    // Candidato 2: ogImage do branding
    if (ogImage && !list.includes(ogImage)) {
      list.push(ogImage);
    }

    // Candidato 3: WordPress mshots (rápido, gratuito, alta disponibilidade)
    if (site.url && !site.url.includes("blueprint.imperio.hq")) {
      const cleanUrl = site.url.startsWith("http") ? site.url : `https://${site.url}`;
      const mshots = `https://s0.wp.com/mshots/v1/${encodeURIComponent(cleanUrl)}?w=800`;
      if (!list.includes(mshots)) list.push(mshots);
    }

    // Candidato 4: Microlink screenshot
    if (site.url && !site.url.includes("blueprint.imperio.hq")) {
      const cleanUrl = site.url.startsWith("http") ? site.url : `https://${site.url}`;
      const microlink = `https://api.microlink.io?url=${encodeURIComponent(cleanUrl)}&screenshot=true&meta=false&embed=screenshot.url`;
      if (!list.includes(microlink)) list.push(microlink);
    }

    // Candidato 5: Thum.io screenshot
    if (site.url && !site.url.includes("blueprint.imperio.hq")) {
      const cleanUrl = site.url.startsWith("http") ? site.url : `https://${site.url}`;
      const thumIo = `https://image.thum.io/get/width/800/crop/600/noanimate/${cleanUrl}`;
      if (!list.includes(thumIo)) list.push(thumIo);
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
    <div className={`relative ${aspect} w-full overflow-hidden bg-slate-950/90 select-none group/thumb ${className}`}>
      {/* Barra de Navegador Estilo Safari/macOS */}
      {showBrowserBar && (
        <div className="absolute top-0 left-0 right-0 z-20 h-6 bg-slate-950/85 backdrop-blur-md border-b border-white/10 px-2.5 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500/80" />
            <span className="w-2 h-2 rounded-full bg-amber-500/80" />
            <span className="w-2 h-2 rounded-full bg-emerald-500/80" />
          </div>
          <div className="flex items-center gap-1 max-w-[68%] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-slate-300 font-mono truncate">
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
          {/* Preview visual da etapa enquanto a captura carrega */}
          {!isLoaded && (
            <div className={`absolute inset-0 overflow-hidden ${showBrowserBar ? "pt-6" : ""}`}>
              <img
                src={stageFallbackImg}
                alt=""
                className="w-full h-full object-cover opacity-35 scale-105 blur-[1px]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-slate-950/40 flex items-center justify-center">
                <div className="flex flex-col items-center gap-1.5 text-slate-300">
                  <Globe className="w-5 h-5 animate-spin text-primary/80" />
                  <span className="text-[10px] font-mono">{domain}</span>
                </div>
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
        /* Branded Visual Stage Preview com identidade visual do site */
        <div
          className={`w-full h-full flex flex-col items-center justify-center p-3 relative overflow-hidden ${
            showBrowserBar ? "pt-7" : ""
          }`}
          style={{
            background: brandColors.primary
              ? `radial-gradient(circle at 50% 30%, ${brandColors.primary}22 0%, #090a10 85%)`
              : "radial-gradient(circle at 50% 30%, #1e1b4b 0%, #090a10 85%)",
          }}
        >
          <img
            src={stageFallbackImg}
            alt={site.titulo}
            className="absolute inset-0 w-full h-full object-cover opacity-45 group-hover/thumb:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/65 to-slate-950/35 pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center text-center max-w-[92%] gap-1.5">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-slate-900/90 border border-white/15 shadow-xl flex items-center justify-center overflow-hidden p-1.5">
                <img
                  src={faviconUrl}
                  alt={domain}
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = "none";
                  }}
                  className="w-6 h-6 object-contain z-10"
                />
                <TipoIcon className="w-5 h-5 text-slate-400 absolute" />
              </div>
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                <Sparkles className="w-2 h-2 text-emerald-400" />
              </span>
            </div>

            <div className="space-y-0.5">
              <h4 className="font-semibold text-[11px] text-white line-clamp-1 max-w-[220px] drop-shadow" title={site.titulo}>
                {site.titulo}
              </h4>
              <p className="text-[10px] text-emerald-300/90 font-mono">{domain}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

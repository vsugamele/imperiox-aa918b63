import { useState } from "react";
import {
  CheckCircle2,
  CreditCard,
  ExternalLink,
  MessageCircle,
  Play,
  QrCode,
  ShieldCheck,
  Sparkles,
  Volume2,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type VisualStageCategory =
  | "ads"
  | "vsl"
  | "checkout"
  | "upsell"
  | "whatsapp"
  | "infra";

export interface ResolvedNodeVisual {
  category: VisualStageCategory;
  archetype: VisualStageCategory;
  assetPath: string;
  fallbackUrl: string;
  imageUrl: string;
  liveScreenshotUrl: string | null;
  isLiveScreenshot: boolean;
  badgeText: string;
  accentColor: string;
}

/**
 * Resolve automaticamente qual imagem visual (gerada em /map-previews/ ou screenshot ao vivo via Microlink)
 * representa melhor uma etapa do funil ou nó do mapa.
 */
export function resolveVisualPreviewForNode(
  kind?: string | null,
  label?: string | null,
  url?: string | null
): ResolvedNodeVisual {
  const combined = `${kind ?? ""} ${label ?? ""}`.toLowerCase();

  const cleanUrl = url && /^https?:\/\//i.test(url.trim()) ? url.trim() : null;
  const liveScreenshotUrl = cleanUrl
    ? `https://api.microlink.io/?url=${encodeURIComponent(cleanUrl)}&screenshot=true&meta=false&embed=screenshot.url`
    : null;

  const buildResult = (
    category: VisualStageCategory,
    assetPath: string,
    badgeText: string,
    accentColor: string
  ): ResolvedNodeVisual => ({
    category,
    archetype: category,
    assetPath,
    fallbackUrl: assetPath,
    imageUrl: liveScreenshotUrl ?? assetPath,
    liveScreenshotUrl,
    isLiveScreenshot: Boolean(liveScreenshotUrl),
    badgeText,
    accentColor,
  });

  if (
    combined.includes("whatsapp") ||
    combined.includes("recupera") ||
    combined.includes("evolution") ||
    combined.includes("x1") ||
    combined.includes("sdr") ||
    combined.includes("direct") ||
    combined.includes("manychat") ||
    combined.includes("zernio")
  ) {
    return buildResult("whatsapp", "/map-previews/stage-whatsapp.png", "Régua X1 / WhatsApp", "#25D366");
  }

  if (
    combined.includes("checkout") ||
    combined.includes("pagamento") ||
    combined.includes("kiwify") ||
    combined.includes("ticto") ||
    combined.includes("hotmart") ||
    combined.includes("venda") ||
    combined.includes("pix")
  ) {
    return buildResult("checkout", "/map-previews/stage-checkout.png", "Checkout PIX + Cartão", "#10b981");
  }

  if (
    combined.includes("upsell") ||
    combined.includes("bump") ||
    combined.includes("downsell") ||
    combined.includes("extra") ||
    combined.includes("ltv")
  ) {
    return buildResult("upsell", "/map-previews/stage-checkout.png", "Order Bump & Upsell VIP", "#c084fc");
  }

  if (
    combined.includes("vsl") ||
    combined.includes("pagina") ||
    combined.includes("página") ||
    combined.includes("lp") ||
    combined.includes("advertorial") ||
    combined.includes("pdp") ||
    combined.includes("site") ||
    combined.includes("quiz")
  ) {
    return buildResult("vsl", "/map-previews/stage-vsl.png", "VSL / Landing Page", "#fbbf24");
  }

  return buildResult("ads", "/map-previews/stage-ads.png", "Criativo / Tráfego", "#38bdf8");
}

interface MapNodeVisualPreviewProps {
  kind?: string | null;
  label?: string | null;
  url?: string | null;
  customImageUrl?: string | null;
  kpiText?: string | null;
  metricBadge?: string | null;
  kpiTone?: "good" | "bad" | "neutral";
  compact?: boolean;
  onOpenLightbox?: (imgUrl: string, title: string) => void;
  className?: string;
}

/**
 * Miniatura visual inteligente para cards de mapa e etapas de funil:
 * - Usa `customImageUrl` se existir.
 * - Se o nó tiver `url` web pública, tenta carregar o print real e faz fallback automático para a arte dark-luxury da etapa (`/map-previews/stage-*.png`).
 * - Renderiza um HUD esquemático sobreposto indicando os elementos de conversão da etapa.
 */
export function MapNodeVisualPreview({
  kind,
  label,
  url,
  customImageUrl,
  kpiText,
  metricBadge,
  kpiTone = "neutral",
  compact = false,
  onOpenLightbox,
  className,
}: MapNodeVisualPreviewProps) {
  const resolved = resolveVisualPreviewForNode(kind, label, url);
  const displayKpi = kpiText ?? metricBadge ?? null;
  const [liveImgFailed, setLiveImgFailed] = useState(false);
  const [assetFailed, setAssetFailed] = useState(false);

  const primarySrc =
    customImageUrl ||
    (!liveImgFailed && resolved.liveScreenshotUrl ? resolved.liveScreenshotUrl : resolved.assetPath);

  return (
    <div
      onClick={(e) => {
        if (onOpenLightbox && primarySrc) {
          e.stopPropagation();
          onOpenLightbox(primarySrc, label || resolved.badgeText);
        }
      }}
      className={cn(
        "group/preview relative w-full overflow-hidden rounded-lg border border-border/70 bg-[#0b0d12] select-none",
        compact ? "h-20" : "h-28",
        className
      )}
    >
      {/* Imagem de fundo (Print Real, Upload ou Ilustração Gerada da Etapa) */}
      {!assetFailed && (
        <img
          src={primarySrc}
          alt={label || resolved.badgeText}
          loading="lazy"
          onError={() => {
            if (!customImageUrl && !liveImgFailed && resolved.liveScreenshotUrl) {
              setLiveImgFailed(true);
            } else {
              setAssetFailed(true);
            }
          }}
          className="h-full w-full object-cover object-center opacity-80 transition-transform duration-300 group-hover/preview:scale-105 group-hover/preview:opacity-95"
        />
      )}

      {/* Gradiente cinematográfico para legibilidade do HUD */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#090b10] via-[#090b10]/35 to-transparent" />

      {/* Top HUD: Etiqueta visual do tipo de ativo + Link se houver URL */}
      <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1">
        <span className="inline-flex items-center gap-1 rounded bg-black/75 backdrop-blur-xs border border-white/15 px-1.5 py-0.5 text-[9px] font-mono font-semibold text-white/90">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: resolved.accentColor }}
          />
          {resolved.badgeText}
        </span>

        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-0.5 rounded bg-black/75 backdrop-blur-xs border border-white/15 px-1.5 py-0.5 text-[9px] font-mono text-primary hover:bg-primary hover:text-black transition-colors"
            title={`Abrir URL: ${url}`}
          >
            <span>Live</span>
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>

      {/* Center / Bottom Schematic Overlay conforme a categoria */}
      <div className="pointer-events-none absolute bottom-1.5 left-1.5 right-1.5 flex items-end justify-between gap-1.5">
        {resolved.category === "ads" && (
          <div className="flex items-center gap-1.5 rounded bg-black/75 backdrop-blur-xs border border-sky-500/30 px-1.5 py-0.5 text-[9px] font-mono text-sky-300">
            <Play className="h-2.5 w-2.5 fill-sky-400 text-sky-400" />
            <span>Hook 0-3s</span>
            <Volume2 className="h-2.5 w-2.5 opacity-80" />
          </div>
        )}

        {resolved.category === "vsl" && (
          <div className="flex items-center gap-1.5 rounded bg-black/75 backdrop-blur-xs border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-mono text-amber-300">
            <Zap className="h-2.5 w-2.5 text-amber-400" />
            <span>Player VSL + CTA</span>
          </div>
        )}

        {resolved.category === "checkout" && (
          <div className="flex items-center gap-1 rounded bg-black/75 backdrop-blur-xs border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-mono text-emerald-300">
            <QrCode className="h-2.5 w-2.5 text-emerald-400" />
            <span>PIX</span>
            <span>+</span>
            <CreditCard className="h-2.5 w-2.5 text-emerald-400" />
            <ShieldCheck className="h-2.5 w-2.5 text-emerald-400" />
          </div>
        )}

        {resolved.category === "upsell" && (
          <div className="flex items-center gap-1 rounded bg-black/75 backdrop-blur-xs border border-purple-500/30 px-1.5 py-0.5 text-[9px] font-mono text-purple-300">
            <Sparkles className="h-2.5 w-2.5 text-purple-400" />
            <span>1-Click Bump</span>
          </div>
        )}

        {resolved.category === "whatsapp" && (
          <div className="flex items-center gap-1 rounded bg-black/75 backdrop-blur-xs border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-mono text-emerald-300">
            <MessageCircle className="h-2.5 w-2.5 text-emerald-400" />
            <span>Áudio + PIX 5min</span>
            <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />
          </div>
        )}

        {displayKpi && (
          <span
            className={cn(
              "ml-auto rounded px-1.5 py-0.5 text-[9px] font-mono font-bold border backdrop-blur-xs",
              kpiTone === "good"
                ? "bg-emerald-950/90 border-emerald-500/50 text-emerald-300"
                : kpiTone === "bad"
                ? "bg-rose-950/90 border-rose-500/50 text-rose-300"
                : "bg-black/80 border-white/20 text-white"
            )}
          >
            {displayKpi}
          </span>
        )}
      </div>
    </div>
  );
}

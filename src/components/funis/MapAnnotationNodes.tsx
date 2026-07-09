import { useEffect, useRef, useState, memo } from "react";
import { NodeResizer, type NodeProps } from "@xyflow/react";
import { ExternalLink, Play, Instagram, Youtube, Music2, Copy, ImagePlus, ImageIcon } from "lucide-react";
import { toast } from "sonner";

function normalizeReelUrl(url: string): string {
  try {
    const u = new URL(url);
    // Instagram: remove query params (igsh, utm, etc) que causam bloqueio
    if (u.hostname.includes("instagram.com")) {
      return `${u.origin}${u.pathname}`;
    }
    return url;
  } catch { return url; }
}

export type AnnotationKind = "frame" | "note" | "label" | "arrow" | "reel";

export interface AnnotationData {
  kind: AnnotationKind;
  text: string;
  style?: {
    borderColor?: string;
    bgColor?: string;
    fontSize?: number;
    orientation?: "diag-down" | "diag-up" | "horizontal" | "vertical";
    showHead?: boolean;
    // reel-specific
    url?: string;
    platform?: "instagram" | "tiktok" | "youtube" | "other";
    thumb?: string;
    thumb_proxy?: string;
    author?: string;
    title?: string;
    description?: string;
  };
  onTextChange?: (id: string, text: string) => void;
  onUploadImage?: (id: string) => void;
  editingId?: string | null;
}

const stopBubble = (e: React.SyntheticEvent) => e.stopPropagation();

const resizerLineClassName = "!pointer-events-auto !border-primary/70 !border-2 !z-50";
const resizerHandleClassName = "!pointer-events-auto !w-5 !h-5 !rounded-sm !bg-primary !border-2 !border-background !shadow-lg !z-50";

function useResizeVisibility(selected?: boolean, editing = false) {
  const [hovered, setHovered] = useState(false);
  return {
    resizeVisible: !!selected || editing || hovered,
    hoverProps: {
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
    },
  };
}

function EditableText({
  id, text, className, style, editing, onDone, placeholder,
}: {
  id: string; text: string; className?: string; style?: React.CSSProperties;
  editing: boolean; onDone: (v: string) => void; placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [local, setLocal] = useState(text);
  useEffect(() => { setLocal(text); }, [text]);
  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      const range = document.createRange();
      range.selectNodeContents(ref.current);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [editing]);
  return (
    <div
      ref={ref}
      contentEditable={editing}
      suppressContentEditableWarning
      onMouseDown={editing ? stopBubble : undefined}
      onClick={editing ? stopBubble : undefined}
      onBlur={(e) => onDone(e.currentTarget.innerText)}
      onKeyDown={(e) => {
        if (e.key === "Escape") { e.currentTarget.blur(); }
        if (e.key === "Enter" && !e.shiftKey && !editing) e.preventDefault();
      }}
      className={className}
      style={{ outline: "none", cursor: editing ? "text" : "inherit", pointerEvents: editing ? "auto" : "none", ...style }}
      data-placeholder={placeholder}
    >
      {local || (!editing && placeholder ? placeholder : "")}
    </div>
  );
}

export const AnnotationFrameNode = memo(({ id, data, selected }: NodeProps) => {
  const d = data as unknown as AnnotationData;
  const editing = d.editingId === id;
  const { resizeVisible, hoverProps } = useResizeVisibility(selected, editing);
  const color = d.style?.borderColor || "#c9922a";
  const bg = d.style?.bgColor || "transparent";
  const edgeBase = "absolute frame-handle pointer-events-auto";
  return (
    <div
      {...hoverProps}
      className="w-full h-full rounded-2xl relative"
      style={{ pointerEvents: "none" }}
    >
      {/* Moldura tracejada + ring interno (decorativos, sem eventos) */}
      <div
        className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/5"
        style={{ border: `1px dashed ${color}66`, background: bg, pointerEvents: "none" }}
      />
      <NodeResizer isVisible={resizeVisible} minWidth={120} minHeight={80} lineClassName={resizerLineClassName} handleClassName={resizerHandleClassName} />

      {/* Faixas interativas nas 4 bordas (10px) */}
      <div className={edgeBase} style={{ top: 0, left: 0, right: 0, height: 10, cursor: "move" }} title="Arraste para mover · clique direito para opções" />
      <div className={edgeBase} style={{ bottom: 0, left: 0, right: 0, height: 10, cursor: "move" }} />
      <div className={edgeBase} style={{ top: 0, bottom: 0, left: 0, width: 10, cursor: "move" }} />
      <div className={edgeBase} style={{ top: 0, bottom: 0, right: 0, width: 10, cursor: "move" }} />

      {/* Label editorial com diamantes */}
      <div
        className="absolute -top-4 left-8 px-4 py-1 bg-[#080607] frame-handle pointer-events-auto flex items-center gap-2"
        style={{ cursor: editing ? "text" : "move" }}
        title="Arraste para mover · clique direito para opções"
      >
        <span className="block w-1 h-1 rotate-45" style={{ background: color, pointerEvents: "none" }} />
        <EditableText
          id={id}
          text={d.text}
          editing={editing}
          onDone={(v) => d.onTextChange?.(id, v)}
          className="text-[11px] font-medium uppercase min-w-[40px]"
          style={{ color, letterSpacing: "0.2em", fontFamily: "'DM Sans', sans-serif" }}
          placeholder="Grupo"
        />
        <span className="block w-1 h-1 rotate-45" style={{ background: color, pointerEvents: "none" }} />
      </div>
    </div>
  );
});

export const AnnotationNoteNode = memo(({ id, data, selected }: NodeProps) => {
  const d = data as unknown as AnnotationData;
  const editing = d.editingId === id;
  const { resizeVisible, hoverProps } = useResizeVisibility(selected, editing);
  return (
    <div
      {...hoverProps}
      className="w-full h-full rounded-md shadow-lg p-3 relative"
      style={{
        background: d.style?.bgColor || "#c9922a",
        color: "#080607",
      }}
    >
      <NodeResizer
        isVisible={resizeVisible}
        minWidth={100}
        minHeight={60}
       
        lineClassName={resizerLineClassName}
        handleClassName={resizerHandleClassName}
      />
      <EditableText
        id={id}
        text={d.text}
        editing={editing}
        onDone={(v) => d.onTextChange?.(id, v)}
        className="text-xs leading-snug whitespace-pre-wrap break-words w-full h-full overflow-hidden"
        placeholder="Nota…"
      />

    </div>
  );
});

export const AnnotationLabelNode = memo(({ id, data, selected }: NodeProps) => {
  const d = data as unknown as AnnotationData;
  const editing = d.editingId === id;
  const { resizeVisible, hoverProps } = useResizeVisibility(selected, editing);
  return (
    <div {...hoverProps} className="w-full h-full relative flex items-center">
      <NodeResizer isVisible={resizeVisible} minWidth={80} minHeight={30} lineClassName={resizerLineClassName} handleClassName={resizerHandleClassName} />
      <EditableText
        id={id}
        text={d.text}
        editing={editing}
        onDone={(v) => d.onTextChange?.(id, v)}
        className="font-serif text-primary/90 w-full whitespace-pre-wrap break-words"
        style={{ fontSize: d.style?.fontSize || 28, lineHeight: 1.15 }}
        placeholder="Título"
      />
    </div>
  );
});

export const AnnotationArrowNode = memo(({ id, data, selected }: NodeProps & { width?: number; height?: number }) => {
  const d = data as unknown as AnnotationData;
  const { resizeVisible, hoverProps } = useResizeVisibility(selected);
  const orient = d.style?.orientation || "diag-down";
  const showHead = d.style?.showHead !== false;
  const color = d.style?.borderColor || "#c9922a";
  const w = 100, h = 100; // svg viewBox in %; we use preserveAspectRatio none
  let x1 = 5, y1 = 5, x2 = 95, y2 = 95;
  if (orient === "diag-up") { x1 = 5; y1 = 95; x2 = 95; y2 = 5; }
  if (orient === "horizontal") { x1 = 5; y1 = 50; x2 = 95; y2 = 50; }
  if (orient === "vertical") { x1 = 50; y1 = 5; x2 = 50; y2 = 95; }
  const headId = `ah-${id}`;
  return (
    <div {...hoverProps} className="w-full h-full relative">
      <NodeResizer isVisible={resizeVisible} minWidth={40} minHeight={20} lineClassName={resizerLineClassName} handleClassName={resizerHandleClassName} />
      <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ overflow: "visible" }}>
        {showHead && (
          <defs>
            <marker id={headId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
            </marker>
          </defs>
        )}
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" markerEnd={showHead ? `url(#${headId})` : undefined} />
      </svg>
    </div>
  );
});

export const AnnotationReelNode = memo(({ id, data, selected }: NodeProps) => {
  const d = data as unknown as AnnotationData;
  const editing = d.editingId === id;
  const { resizeVisible, hoverProps } = useResizeVisibility(selected, editing);
  const url = d.style?.url || "";
  const platform = d.style?.platform || "other";
  const thumb = d.style?.thumb_proxy || d.style?.thumb;
  const author = d.style?.author;
  const title = d.style?.title;
  const PlatformIcon = platform === "instagram" ? Instagram : platform === "youtube" ? Youtube : platform === "tiktok" ? Music2 : Play;
  const platformColor = platform === "instagram" ? "#e1306c" : platform === "youtube" ? "#ff0033" : platform === "tiktok" ? "#25f4ee" : "#c9922a";
  const writeClipboard = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}
    // fallback iframe/permissions-policy
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch { return false; }
  };
  const openReel = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!url) return;
    const clean = normalizeReelUrl(url);
    const win = window.open(clean, "_blank", "noopener,noreferrer");
    if (!win) {
      writeClipboard(clean).then((ok) =>
        ok ? toast.success("Link copiado — cole no navegador") : toast.error("Não foi possível abrir nem copiar"),
      );
    }
  };
  const copyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!url) return;
    const ok = await writeClipboard(normalizeReelUrl(url));
    if (ok) toast.success("Link copiado");
    else toast.error("Falha ao copiar");
  };

  const platformGradient =
    platform === "instagram" ? "linear-gradient(135deg,#f9ce34,#ee2a7b,#6228d7)" :
    platform === "youtube" ? "linear-gradient(135deg,#ff0033,#8b0000)" :
    platform === "tiktok" ? "linear-gradient(135deg,#25f4ee,#000,#fe2c55)" :
    "linear-gradient(135deg,#c9922a,#7a5a1a)";
  const domain = (() => {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
  })();

  return (
    <div
      {...hoverProps}
      className="group w-full h-full rounded-xl relative overflow-hidden bg-[#0a0809] border border-white/10 shadow-2xl flex flex-col transition-colors duration-500 hover:border-[#c9922a]/40"
    >
      <NodeResizer isVisible={resizeVisible} minWidth={160} minHeight={200} lineClassName={resizerLineClassName} handleClassName={resizerHandleClassName} />

      {/* Header editorial */}
      <div className="flex items-center justify-between px-3 py-2 bg-white/[0.02] border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="p-1 rounded-md opacity-90 shrink-0"
            style={{ background: platformGradient }}
          >
            <PlatformIcon className="h-2.5 w-2.5 text-white" />
          </div>
          <span
            className="text-[9px] font-semibold text-white/50 uppercase truncate"
            style={{ letterSpacing: "0.2em", fontFamily: "'DM Sans', sans-serif" }}
          >
            {platform === "other" ? "Reel" : `${platform} reel`}
          </span>
        </div>
        <div className="flex gap-1 shrink-0">
          {d.onUploadImage && (
            <button
              type="button"
              onMouseDown={stopBubble}
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); d.onUploadImage?.(id); }}
              className="nodrag nopan p-1 rounded text-white/30 hover:text-[#c9922a] transition-colors"
              title="Enviar imagem"
            >
              <ImagePlus className="h-3 w-3" />
            </button>
          )}
          {url && (
            <>
              <button
                type="button"
                onMouseDown={stopBubble}
                onClick={copyLink}
                className="nodrag nopan p-1 rounded text-white/30 hover:text-[#c9922a] transition-colors"
                title="Copiar link"
              >
                <Copy className="h-3 w-3" />
              </button>
              <button
                type="button"
                onMouseDown={stopBubble}
                onClick={openReel}
                className="nodrag nopan p-1 rounded text-white/30 hover:text-[#c9922a] transition-colors"
                title="Abrir reel"
              >
                <ExternalLink className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Corpo visual */}
      <div
        className="relative flex-1 flex items-center justify-center overflow-hidden cursor-pointer bg-gradient-to-b from-transparent to-black/40"
        onMouseDown={url ? stopBubble : undefined}
        onClick={url ? copyLink : undefined}
        title={url ? "Clique para copiar o link" : undefined}
      >
        {thumb ? (
          <img src={thumb} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 text-center">
            <div className="relative">
              <div className="absolute inset-0 blur-2xl rounded-full" style={{ background: "rgba(201,146,42,0.15)" }} />
              <ImageIcon className="h-10 w-10 relative" strokeWidth={1} style={{ color: "rgba(201,146,42,0.45)" }} />
            </div>
            <div>
              <div className="text-white/80 text-[12px] font-medium" style={{ fontFamily: "'DM Sans', sans-serif" }}>Preview indisponível</div>
              <div className="text-white/40 text-[10px] leading-relaxed mt-0.5">Clique para copiar o link original</div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 space-y-2 shrink-0">
        {(domain || author) && (
          <div className="text-[10px] tracking-tight truncate" style={{ color: "#c9922a", fontFamily: "'DM Sans', sans-serif" }}>
            {author || domain}
          </div>
        )}
        {title && (
          <div className="text-[13px] italic text-white/90 leading-snug line-clamp-2 font-serif">
            {title}
          </div>
        )}
        <div className="pt-2 border-t border-white/5">
          <EditableText
            id={id}
            text={d.text}
            editing={editing}
            onDone={(v) => d.onTextChange?.(id, v)}
            className="text-[11px] italic leading-snug text-white/50 whitespace-pre-wrap break-words max-h-16 overflow-hidden font-serif"
            placeholder="Anote o que está gostando…"
          />
        </div>
      </div>

      {/* Barra dourada de hover */}
      <div className="absolute bottom-0 left-0 w-full h-px bg-[#c9922a] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
    </div>
  );
});

export const annotationNodeTypes = {
  annotation_frame: AnnotationFrameNode,
  annotation_note: AnnotationNoteNode,
  annotation_label: AnnotationLabelNode,
  annotation_arrow: AnnotationArrowNode,
  annotation_reel: AnnotationReelNode,
};

export const ANNOTATION_TYPE_TO_KIND: Record<string, AnnotationKind> = {
  annotation_frame: "frame",
  annotation_note: "note",
  annotation_label: "label",
  annotation_arrow: "arrow",
  annotation_reel: "reel",
};

export const ANNOTATION_KIND_TO_TYPE: Record<AnnotationKind, string> = {
  frame: "annotation_frame",
  note: "annotation_note",
  label: "annotation_label",
  arrow: "annotation_arrow",
  reel: "annotation_reel",
};

export const ANNOTATION_DEFAULTS: Record<AnnotationKind, { w: number; h: number; text: string; style: AnnotationData["style"] }> = {
  frame: { w: 320, h: 220, text: "Grupo", style: { borderColor: "#c9922a" } },
  note:  { w: 200, h: 120, text: "Nota…", style: { bgColor: "#c9922a" } },
  label: { w: 260, h: 50,  text: "Título", style: { fontSize: 28 } },
  arrow: { w: 180, h: 120, text: "",       style: { orientation: "diag-down", showHead: true, borderColor: "#c9922a" } },
  reel:  { w: 220, h: 320, text: "",       style: { platform: "other" } },
};

// ---------- Reel URL helpers ----------
export function detectReelPlatform(url: string): "instagram" | "tiktok" | "youtube" | "other" {
  const u = url.toLowerCase();
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  return "other";
}

export function extractReelAuthor(url: string): string | undefined {
  try {
    const u = new URL(url);
    const host = u.hostname.replace("www.", "");
    if (host.includes("instagram.com")) {
      const m = u.pathname.match(/^\/([^/]+)\//);
      if (m && !["reel", "reels", "p", "tv"].includes(m[1])) return `@${m[1]}`;
    }
    if (host.includes("tiktok.com")) {
      const m = u.pathname.match(/^\/@([^/]+)/);
      if (m) return `@${m[1]}`;
    }
    if (host.includes("youtube.com")) {
      const m = u.pathname.match(/^\/@([^/]+)/) || u.pathname.match(/^\/channel\/([^/]+)/);
      if (m) return `@${m[1]}`;
    }
    return host;
  } catch { return undefined; }
}

export function extractReelThumb(url: string): string | undefined {
  try {
    const u = new URL(url);
    // YouTube
    if (u.hostname.includes("youtu")) {
      let id: string | null = null;
      if (u.hostname.includes("youtu.be")) id = u.pathname.slice(1).split("/")[0];
      else if (u.pathname.startsWith("/shorts/")) id = u.pathname.split("/")[2];
      else id = u.searchParams.get("v");
      if (id) return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    }
  } catch {}
  return undefined;
}


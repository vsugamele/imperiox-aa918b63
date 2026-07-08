import { useEffect, useRef, useState, memo } from "react";
import { NodeResizer, type NodeProps } from "@xyflow/react";
import { ExternalLink, Play, Instagram, Youtube, Music2, Copy } from "lucide-react";
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

const resizerLineClassName = "nodrag nopan !border-primary/70 !border-2 !z-50";
const resizerHandleClassName = "nodrag nopan !w-5 !h-5 !rounded-sm !bg-primary !border-2 !border-background !shadow-lg !z-50";

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
  return (
    <div
      {...hoverProps}
      className="w-full h-full rounded-lg relative"
      style={{
        border: `2px dashed ${d.style?.borderColor || "#c9922a"}`,
        background: d.style?.bgColor || "rgba(201,146,42,0.04)",
      }}
    >
      <NodeResizer isVisible={resizeVisible} minWidth={120} minHeight={80} lineClassName={resizerLineClassName} handleClassName={resizerHandleClassName} />
      <div className="absolute -top-3 left-3 px-2 bg-[#0a0809]">
        <EditableText
          id={id}
          text={d.text}
          editing={editing}
          onDone={(v) => d.onTextChange?.(id, v)}
          className="text-xs font-serif text-primary/90 min-w-[40px]"
          placeholder="Grupo"
        />
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

  return (
    <div
      {...hoverProps}
      className="w-full h-full rounded-lg relative overflow-hidden bg-[#0a0809] border border-border/60 shadow-lg flex flex-col"
    >
      <NodeResizer isVisible={resizeVisible} minWidth={160} minHeight={200} lineClassName={resizerLineClassName} handleClassName={resizerHandleClassName} />
      <div
        className="relative flex-1 bg-gradient-to-br from-black/60 to-black/20 flex items-center justify-center overflow-hidden cursor-pointer"
        onMouseDown={url ? stopBubble : undefined}
        onClick={url ? copyLink : undefined}
        title={url ? "Clique para copiar o link" : undefined}
      >
        {thumb ? (
          <img src={thumb} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <div className="flex flex-col items-center gap-2 px-3 text-center">
            <PlatformIcon className="h-8 w-8 opacity-40" style={{ color: platformColor }} />
            <span className="text-[10px] text-muted-foreground leading-tight">Preview indisponível<br/>clique para copiar link</span>
          </div>
        )}

        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider flex items-center gap-1"
          style={{ background: `${platformColor}25`, color: platformColor, border: `1px solid ${platformColor}55` }}>
          <PlatformIcon className="h-2.5 w-2.5" /> {platform}
        </div>
        {url && (
          <div className="absolute top-1.5 right-1.5 flex gap-1">
            <button
              type="button"
              onMouseDown={stopBubble}
              onClick={copyLink}
              className="nodrag nopan p-1 rounded bg-black/50 hover:bg-black/80 text-white"
              title="Copiar link"
            >
              <Copy className="h-3 w-3" />
            </button>
            <button
              type="button"
              onMouseDown={stopBubble}
              onClick={openReel}
              className="nodrag nopan p-1 rounded bg-black/50 hover:bg-black/80 text-white"
              title="Abrir reel"
            >
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
      <div className="px-2 py-1.5 bg-[#0a0809] border-t border-border/40">
        {author && <div className="text-[10px] text-primary/80 font-serif truncate">{author}</div>}
        {title && <div className="text-[11px] text-foreground font-medium leading-tight line-clamp-2 mt-0.5">{title}</div>}
        <EditableText
          id={id}
          text={d.text}
          editing={editing}
          onDone={(v) => d.onTextChange?.(id, v)}
          className="text-[11px] leading-snug text-muted-foreground whitespace-pre-wrap break-words max-h-12 overflow-hidden mt-0.5"
          placeholder="Anote o que está gostando…"
        />
      </div>
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


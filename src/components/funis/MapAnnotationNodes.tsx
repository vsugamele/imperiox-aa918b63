import { useEffect, useRef, useState, memo } from "react";
import { NodeResizer, Handle, Position, type NodeProps } from "@xyflow/react";
import { ExternalLink, Play, Instagram, Youtube, Music2, Copy, ImagePlus, ImageIcon, Sparkles, Loader2, Film, FileText, MessageSquare, Megaphone, CalendarClock, Camera, Circle, Video, Send, MessageCircle, Plus, X, Maximize2, Minimize2, Sprout, Mail, ShieldAlert, Pencil, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Small connection handles (source+target overlaid) shown on hover/selected — same visual on all four sides.
function AnnotationHandles({ visible, color = "#c9922a" }: { visible: boolean; color?: string }) {
  const base: React.CSSProperties = {
    width: 10, height: 10, background: color, border: "2px solid #080607",
    borderRadius: 999, opacity: visible ? 1 : 0.5, transition: "opacity 120ms",
    pointerEvents: "auto",
  };
  const sides: { pos: Position; style: React.CSSProperties }[] = [
    { pos: Position.Top, style: {} },
    { pos: Position.Right, style: {} },
    { pos: Position.Bottom, style: {} },
    { pos: Position.Left, style: {} },
  ];
  return (
    <>
      {sides.map(s => (
        <div key={`w-${s.pos}`} style={{ position: "absolute" }}>
          <Handle id={`${s.pos}-t`} type="target" position={s.pos} style={base} />
          <Handle id={`${s.pos}-s`} type="source" position={s.pos} style={base} />
        </div>
      ))}
    </>
  );
}


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

export type AnnotationKind = "frame" | "note" | "label" | "arrow" | "reel" | "script" | "copy" | "ad_asset" | "schedule" | "account";

export type ScheduleItemKind = "post" | "story" | "reel" | "email" | "wa" | "other";
export interface ScheduleItem {
  time: string;   // "HH:MM"
  kind: ScheduleItemKind;
  label: string;
}

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
    // generator-specific
    heading?: string;
    subheading?: string;
    link?: string;
    generating?: boolean;
    // schedule-specific
    recurrence?: "daily" | "weekly";
    items?: ScheduleItem[];
    // account-specific
    accountId?: string;
    viewMode?: "compact" | "expanded";
  };
  onTextChange?: (id: string, text: string) => void;
  onUploadImage?: (id: string) => void;
  onGenerate?: (id: string, kind: AnnotationKind) => void;
  onStyleChange?: (id: string, patch: Partial<NonNullable<AnnotationData["style"]>>) => void;
  editingId?: string | null;
}



const stopBubble = (e: React.SyntheticEvent) => e.stopPropagation();

const resizerLineClassName = "!pointer-events-none !border-white/80 !border-2 !z-50";
const resizerHandleClassName = "!pointer-events-auto !w-3.5 !h-3.5 !rounded-sm !bg-white !border-2 !border-[#080607] !shadow-lg !z-50";

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
      <div className={edgeBase} style={{ top: 0, left: 0, right: 0, height: 16, cursor: "move" }} title="Arraste para mover · clique direito para opções" />
      <div className={edgeBase} style={{ bottom: 0, left: 0, right: 0, height: 16, cursor: "move" }} />
      <div className={edgeBase} style={{ top: 0, bottom: 0, left: 0, width: 16, cursor: "move" }} />
      <div className={edgeBase} style={{ top: 0, bottom: 0, right: 0, width: 16, cursor: "move" }} />

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
      <AnnotationHandles visible={resizeVisible} color="#080607" />
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
      <AnnotationHandles visible={resizeVisible} color="#c9922a" />
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
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState(url);
  const [savingUrl, setSavingUrl] = useState(false);
  useEffect(() => { setUrlDraft(url); }, [url]);
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
  const saveUrl = async () => {
    const raw = urlDraft.trim();
    if (!raw) { setEditingUrl(false); setUrlDraft(url); return; }
    if (!/^https?:\/\//i.test(raw)) { toast.error("Link inválido — precisa começar com http(s)://"); return; }
    if (raw === url) { setEditingUrl(false); return; }
    setSavingUrl(true);
    const newPlatform = detectReelPlatform(raw);
    // Patch imediato para sensação de instantaneidade
    d.onStyleChange?.(id, { url: raw, platform: newPlatform, thumb: undefined, thumb_proxy: undefined, author: undefined, title: undefined, description: undefined });
    setEditingUrl(false);
    try {
      const { data: prev } = await supabase.functions.invoke("link-preview", { body: { url: raw } });
      if (prev) {
        d.onStyleChange?.(id, {
          url: raw,
          platform: newPlatform,
          thumb: prev.thumb || undefined,
          thumb_proxy: prev.thumb_proxy || undefined,
          author: prev.author || undefined,
          title: prev.title || undefined,
          description: prev.description || undefined,
        });
      }
      toast.success("Link atualizado");
    } catch (e) {
      toast.message("Link salvo — preview indisponível");
    } finally {
      setSavingUrl(false);
    }
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
      <AnnotationHandles visible={resizeVisible} color="#c9922a" />
    </div>
  );
});

// -------- Generator nodes (Script / Copy / Ad Asset) --------
function GeneratorShell({
  id, data, selected,
  icon: Icon, kindLabel, accent, minH = 160,
  children,
}: {
  id: string; data: AnnotationData; selected?: boolean;
  icon: any; kindLabel: string; accent: string; minH?: number;
  children: React.ReactNode;
}) {
  const editing = data.editingId === id;
  const { resizeVisible, hoverProps } = useResizeVisibility(selected, editing);
  const generating = !!data.style?.generating;
  return (
    <div
      {...hoverProps}
      className="w-full h-full rounded-xl relative overflow-hidden bg-[#0a0809] border border-white/10 shadow-2xl flex flex-col transition-colors duration-300 hover:border-[#c9922a]/40"
    >
      <NodeResizer isVisible={resizeVisible} minWidth={200} minHeight={minH} lineClassName={resizerLineClassName} handleClassName={resizerHandleClassName} />
      <div className="flex items-center justify-between px-3 py-2 bg-white/[0.02] border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-md shrink-0" style={{ background: `${accent}22`, color: accent }}>
            <Icon className="h-3 w-3" />
          </div>
          <span className="text-[9px] font-semibold text-white/50 uppercase truncate" style={{ letterSpacing: "0.2em", fontFamily: "'DM Sans', sans-serif" }}>
            {kindLabel}
          </span>
        </div>
        {data.onGenerate && (
          <button
            type="button"
            onMouseDown={stopBubble}
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); if (!generating) data.onGenerate?.(id, data.kind); }}
            className="nodrag nopan p-1 rounded text-white/40 hover:text-[#c9922a] transition-colors"
            title="Gerar com IA"
            disabled={generating}
          >
            {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          </button>
        )}
      </div>
      <div className="flex-1 overflow-hidden p-3 space-y-2 text-white/85 text-[12px] leading-snug">
        {children}
      </div>
      <AnnotationHandles visible={resizeVisible} color={accent} />
    </div>
  );
}

export const AnnotationScriptNode = memo(({ id, data, selected }: NodeProps) => {
  const d = data as unknown as AnnotationData;
  const editing = d.editingId === id;
  return (
    <GeneratorShell id={id} data={d} selected={selected} icon={FileText} kindLabel="Script" accent="#ec4899" minH={200}>
      <EditableText id={id} text={d.style?.heading || ""} editing={editing}
        onDone={(v) => d.onTextChange?.(id, `#${v}\n${d.text || ""}`)}
        className="text-[13px] font-medium text-white/90 font-serif" placeholder="Título do roteiro" />
      <EditableText id={id} text={d.text} editing={editing}
        onDone={(v) => d.onTextChange?.(id, v)}
        className="text-[11px] whitespace-pre-wrap break-words text-white/70 overflow-auto max-h-full nowheel"
        placeholder="Escreva ou gere o roteiro (hook, desenvolvimento, CTA)…" />
    </GeneratorShell>
  );
});

export const AnnotationCopyNode = memo(({ id, data, selected }: NodeProps) => {
  const d = data as unknown as AnnotationData;
  const editing = d.editingId === id;
  return (
    <GeneratorShell id={id} data={d} selected={selected} icon={MessageSquare} kindLabel="Copy" accent="#f97316" minH={160}>
      <EditableText id={id} text={d.style?.heading || ""} editing={editing}
        onDone={(v) => d.onTextChange?.(id, v)}
        className="text-[13px] font-semibold text-white/90 font-serif" placeholder="Headline" />
      <EditableText id={id} text={d.text} editing={editing}
        onDone={(v) => d.onTextChange?.(id, v)}
        className="text-[11px] whitespace-pre-wrap break-words text-white/70 overflow-auto max-h-full nowheel"
        placeholder="Copy do anúncio, lead ou CTA…" />
    </GeneratorShell>
  );
});

export const AnnotationAdAssetNode = memo(({ id, data, selected }: NodeProps) => {
  const d = data as unknown as AnnotationData;
  const editing = d.editingId === id;
  const thumb = d.style?.thumb;
  return (
    <GeneratorShell id={id} data={d} selected={selected} icon={Megaphone} kindLabel="Ativo de anúncio" accent="#eab308" minH={220}>
      <EditableText id={id} text={d.style?.heading || ""} editing={editing}
        onDone={(v) => d.onTextChange?.(id, v)}
        className="text-[13px] font-semibold text-white/90 font-serif" placeholder="Nome do ativo" />
      {thumb && (
        <img src={thumb} alt="" className="w-full rounded border border-white/10 object-cover max-h-32" />
      )}
      {d.onUploadImage && !thumb && (
        <button
          type="button"
          onMouseDown={stopBubble}
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); d.onUploadImage?.(id); }}
          className="nodrag nopan text-[10px] text-white/50 hover:text-[#c9922a] underline"
        >
          Enviar imagem
        </button>
      )}
      <EditableText id={id} text={d.text} editing={editing}
        onDone={(v) => d.onTextChange?.(id, v)}
        className="text-[11px] whitespace-pre-wrap break-words text-white/70 overflow-auto max-h-full nowheel"
        placeholder="Descrição / briefing do ativo…" />
      {d.style?.link && (
        <a href={d.style.link} target="_blank" rel="noreferrer"
          onClick={stopBubble}
          className="nodrag inline-flex items-center gap-1 text-[10px] text-[#c9922a] hover:underline truncate">
          <ExternalLink className="h-2.5 w-2.5" /> {d.style.link.replace(/^https?:\/\//, "").slice(0, 40)}
        </a>
      )}
    </GeneratorShell>
  );
});

// -------- Schedule / Cronograma --------
const SCHEDULE_ITEM_META: Record<ScheduleItemKind, { label: string; color: string; Icon: any }> = {
  post:  { label: "Post",   color: "#e1306c", Icon: Camera },
  story: { label: "Story",  color: "#8b5cf6", Icon: Circle },
  reel:  { label: "Reel",   color: "#f97316", Icon: Video },
  email: { label: "Email",  color: "#3b82f6", Icon: Send },
  wa:    { label: "WhatsApp", color: "#25d366", Icon: MessageCircle },
  other: { label: "Outro",  color: "#94a3b8", Icon: Circle },
};

const SCHEDULE_KIND_ORDER: ScheduleItemKind[] = ["post", "story", "reel", "email", "wa", "other"];

export const DEFAULT_SCHEDULE_ITEMS: ScheduleItem[] = [
  { time: "09:00", kind: "post",  label: "Post carrossel — dor do avatar" },
  { time: "13:00", kind: "post",  label: "Post reels — solução" },
  { time: "18:00", kind: "post",  label: "Post prova social" },
  { time: "20:00", kind: "story", label: "Story bastidor" },
  { time: "20:05", kind: "story", label: "Story enquete" },
  { time: "20:10", kind: "story", label: "Story CTA link" },
];

function sortScheduleItems(items: ScheduleItem[]): ScheduleItem[] {
  return [...items].sort((a, b) => (a.time || "").localeCompare(b.time || ""));
}

export const AnnotationScheduleNode = memo(({ id, data, selected }: NodeProps) => {
  const d = data as unknown as AnnotationData;
  const editing = d.editingId === id;
  const { resizeVisible, hoverProps } = useResizeVisibility(selected, editing);
  const recurrence = d.style?.recurrence || "daily";
  const items = d.style?.items || [];

  const patchItems = (next: ScheduleItem[]) => d.onStyleChange?.(id, { items: sortScheduleItems(next) });
  const updateItem = (idx: number, patch: Partial<ScheduleItem>) => {
    patchItems(items.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };
  const removeItem = (idx: number) => patchItems(items.filter((_, i) => i !== idx));
  const addItem = () => patchItems([...items, { time: "20:00", kind: "post", label: "Novo item" }]);
  const cycleKind = (idx: number) => {
    const cur = items[idx].kind;
    const next = SCHEDULE_KIND_ORDER[(SCHEDULE_KIND_ORDER.indexOf(cur) + 1) % SCHEDULE_KIND_ORDER.length];
    updateItem(idx, { kind: next });
  };
  const toggleRecurrence = () => d.onStyleChange?.(id, { recurrence: recurrence === "daily" ? "weekly" : "daily" });

  return (
    <div
      {...hoverProps}
      className="w-full h-full rounded-xl relative overflow-hidden bg-[#0a0809] border border-white/10 shadow-2xl flex flex-col transition-colors duration-300 hover:border-[#3b82f6]/40"
    >
      <NodeResizer isVisible={resizeVisible} minWidth={240} minHeight={200} lineClassName={resizerLineClassName} handleClassName={resizerHandleClassName} />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-white/[0.02] border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded-md shrink-0" style={{ background: "#3b82f622", color: "#3b82f6" }}>
            <CalendarClock className="h-3 w-3" />
          </div>
          <span className="text-[9px] font-semibold text-white/50 uppercase truncate" style={{ letterSpacing: "0.2em", fontFamily: "'DM Sans', sans-serif" }}>
            Cronograma
          </span>
        </div>
        <button
          type="button"
          onMouseDown={stopBubble}
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggleRecurrence(); }}
          className="nodrag nopan text-[9px] uppercase tracking-wider text-white/50 hover:text-[#3b82f6] px-1.5 py-0.5 rounded border border-white/10"
          title="Alternar recorrência"
        >
          {recurrence === "daily" ? "Diário" : "Semanal"}
        </button>
      </div>

      {/* Título */}
      <div className="px-3 pt-2 shrink-0">
        <EditableText
          id={id}
          text={d.text}
          editing={editing}
          onDone={(v) => d.onTextChange?.(id, v)}
          className="text-[13px] font-medium text-white/90 font-serif"
          placeholder="Rotina Diária de Conteúdo"
        />
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-auto nowheel px-2 py-2 space-y-1">
        {items.length === 0 && (
          <div className="text-[11px] text-white/40 italic px-2 py-4 text-center">
            Nenhum item. Clique em "+ item" para começar.
          </div>
        )}
        {items.map((it, idx) => {
          const meta = SCHEDULE_ITEM_META[it.kind] || SCHEDULE_ITEM_META.other;
          const KindIcon = meta.Icon;
          return (
            <div
              key={idx}
              className="nodrag flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-white/[0.03] group/item"
              onMouseDown={stopBubble}
            >
              <input
                type="time"
                value={it.time}
                onChange={(e) => updateItem(idx, { time: e.target.value })}
                className="bg-transparent text-[10px] text-white/80 border border-white/10 rounded px-1 py-0.5 w-[62px] focus:outline-none focus:border-[#3b82f6]/50"
              />
              <button
                type="button"
                onClick={() => cycleKind(idx)}
                className="p-1 rounded shrink-0 hover:bg-white/5"
                style={{ color: meta.color }}
                title={`Tipo: ${meta.label} (clique para alternar)`}
              >
                <KindIcon className="h-3 w-3" />
              </button>
              <input
                type="text"
                value={it.label}
                onChange={(e) => updateItem(idx, { label: e.target.value })}
                placeholder="Descrição…"
                className="flex-1 min-w-0 bg-transparent text-[11px] text-white/85 border-b border-transparent hover:border-white/10 focus:border-[#3b82f6]/50 focus:outline-none px-1 py-0.5"
              />
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="opacity-0 group-hover/item:opacity-100 p-0.5 rounded text-white/40 hover:text-red-400 shrink-0"
                title="Remover"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-white/5 px-2 py-1.5">
        <button
          type="button"
          onMouseDown={stopBubble}
          onClick={(e) => { e.stopPropagation(); addItem(); }}
          className="nodrag nopan w-full flex items-center justify-center gap-1 text-[10px] text-white/50 hover:text-[#3b82f6] py-1 rounded hover:bg-white/[0.03]"
        >
          <Plus className="h-3 w-3" /> item
        </button>
      </div>

      <AnnotationHandles visible={resizeVisible} color="#3b82f6" />
    </div>
  );
});

// ============================================================
// AnnotationAccountNode — conta do Farm (imphq_empresa) como nó
// ============================================================
const ACCOUNT_CACHE = new Map<string, any>();

function warmupBadgeCls(w?: string) {
  switch ((w || "").toLowerCase()) {
    case "pronto": return "border-emerald-500/40 text-emerald-400 bg-emerald-500/10";
    case "aquecendo": return "border-amber-500/40 text-amber-400 bg-amber-500/10";
    case "banido": return "border-red-500/40 text-red-400 bg-red-500/10";
    case "pausado": return "border-slate-500/40 text-slate-400 bg-slate-500/10";
    default: return "border-white/20 text-white/70 bg-white/5";
  }
}

function tipoIcon(tipo?: string) {
  const t = (tipo || "").toLowerCase();
  if (t === "instagram") return Instagram;
  if (t === "youtube") return Youtube;
  if (t === "tiktok") return Music2;
  if (t === "email") return Mail;
  return Sprout;
}

export const AnnotationAccountNode = memo(({ id, data, selected }: NodeProps) => {
  const d = data as unknown as AnnotationData;
  const { resizeVisible, hoverProps } = useResizeVisibility(selected, false);
  const accountId = d.style?.accountId;
  const [row, setRow] = useState<any>(accountId ? ACCOUNT_CACHE.get(accountId) : null);
  const viewMode: "compact" | "expanded" = d.style?.viewMode || "compact";
  const expanded = viewMode === "expanded";

  useEffect(() => {
    if (!accountId) return;
    if (ACCOUNT_CACHE.has(accountId)) { setRow(ACCOUNT_CACHE.get(accountId)); return; }
    (async () => {
      const { data: r } = await supabase.from("imphq_empresa").select("*").eq("id", accountId).maybeSingle();
      if (r) { ACCOUNT_CACHE.set(accountId, r); setRow(r); }
    })();
  }, [accountId]);

  const toggleView = (e: React.MouseEvent) => {
    e.stopPropagation();
    d.onStyleChange?.(id, { viewMode: expanded ? "compact" : "expanded" });
  };

  const idade = row?.data_criacao_conta ? Math.floor((Date.now() - new Date(row.data_criacao_conta).getTime()) / 86400000) : null;
  const risco = Array.isArray(row?.sinais_risco) && row.sinais_risco.length > 0;
  const Tipo = tipoIcon(row?.tipo);

  return (
    <div
      {...hoverProps}
      className="w-full h-full rounded-lg border-2 bg-card/95 backdrop-blur shadow-lg overflow-hidden flex flex-col"
      style={{ borderColor: row?.pronta_venda ? "#10b981" : risco ? "#ef4444" : "#c9922a" }}
    >
      <NodeResizer isVisible={resizeVisible} minWidth={200} minHeight={80} lineClassName={resizerLineClassName} handleClassName={resizerHandleClassName} />
      <AnnotationHandles visible={resizeVisible} color="#c9922a" />

      {!row ? (
        <div className="flex-1 flex items-center justify-center text-[11px] text-muted-foreground">Carregando conta…</div>
      ) : (
        <>
          <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-white/5">
            {row.foto_url ? (
              <img src={row.foto_url} alt={row.nome} className="h-7 w-7 rounded-md object-cover shrink-0 border border-white/10" />
            ) : (
              <div className="h-7 w-7 rounded-md bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <Tipo className="h-3.5 w-3.5 text-primary" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-medium truncate leading-tight">{row.nome}</div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{row.tipo}</div>
            </div>
            <span className={`text-[9px] px-1.5 py-0.5 rounded border ${warmupBadgeCls(row.warmup_status)}`}>{row.warmup_status || "novo"}</span>
            {risco && <ShieldAlert className="h-3 w-3 text-red-400 shrink-0" />}
            <button
              onMouseDown={stopBubble}
              onClick={toggleView}
              className="nodrag p-0.5 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground shrink-0"
              title={expanded ? "Compactar" : "Expandir"}
            >
              {expanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            </button>
          </div>

          {expanded && (
            <div className="flex-1 grid grid-cols-2 gap-x-2 gap-y-1 px-2.5 py-2 text-[10px] leading-tight">
              <Row k="Idade" v={idade !== null ? `${idade}d` : "—"} />
              <Row k="Seguidores" v={row.seguidores || 0} />
              <Row k="Engaj." v={`${row.engajamento_medio || 0}%`} />
              <Row k="Alcance" v={row.ultimo_alcance || "—"} />
              <Row k="Proxy" v={row.proxy_tipo ? `${row.proxy_tipo}${row.proxy_geo ? ` · ${row.proxy_geo}` : ""}` : "—"} />
              <Row k="Cloud" v={row.cloud_phone_provider || "—"} />
              <Row k="Preço" v={row.preco_alvo ? `R$ ${row.preco_alvo}` : "—"} />
              <Row k="Venda" v={row.status_venda || "mantida"} />
              {row.pronta_venda && (
                <div className="col-span-2 mt-1 text-[10px] text-emerald-400 flex items-center gap-1">
                  <Sprout className="h-3 w-3" /> Pronta para venda
                </div>
              )}
            </div>
          )}

          {!expanded && (
            <div className="px-2.5 py-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{row.seguidores || 0} seg. · {row.engajamento_medio || 0}%</span>
              <span>{idade !== null ? `${idade}d` : ""}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
});

function Row({ k, v }: { k: string; v: any }) {
  return (
    <>
      <div className="text-muted-foreground">{k}</div>
      <div className="text-foreground/90 text-right truncate">{String(v)}</div>
    </>
  );
}

export const annotationNodeTypes = {
  annotation_frame: AnnotationFrameNode,
  annotation_note: AnnotationNoteNode,
  annotation_label: AnnotationLabelNode,
  annotation_arrow: AnnotationArrowNode,
  annotation_reel: AnnotationReelNode,
  annotation_script: AnnotationScriptNode,
  annotation_copy: AnnotationCopyNode,
  annotation_ad_asset: AnnotationAdAssetNode,
  annotation_schedule: AnnotationScheduleNode,
  annotation_account: AnnotationAccountNode,
};

export const ANNOTATION_TYPE_TO_KIND: Record<string, AnnotationKind> = {
  annotation_frame: "frame",
  annotation_note: "note",
  annotation_label: "label",
  annotation_arrow: "arrow",
  annotation_reel: "reel",
  annotation_script: "script",
  annotation_copy: "copy",
  annotation_ad_asset: "ad_asset",
  annotation_schedule: "schedule",
  annotation_account: "account",
};

export const ANNOTATION_KIND_TO_TYPE: Record<AnnotationKind, string> = {
  frame: "annotation_frame",
  note: "annotation_note",
  label: "annotation_label",
  arrow: "annotation_arrow",
  reel: "annotation_reel",
  script: "annotation_script",
  copy: "annotation_copy",
  ad_asset: "annotation_ad_asset",
  schedule: "annotation_schedule",
  account: "annotation_account",
};

export const ANNOTATION_DEFAULTS: Record<AnnotationKind, { w: number; h: number; text: string; style: AnnotationData["style"] }> = {
  frame: { w: 320, h: 220, text: "Grupo", style: { borderColor: "#c9922a" } },
  note:  { w: 200, h: 120, text: "Nota…", style: { bgColor: "#c9922a" } },
  label: { w: 260, h: 50,  text: "Título", style: { fontSize: 28 } },
  arrow: { w: 180, h: 120, text: "",       style: { orientation: "diag-down", showHead: true, borderColor: "#c9922a" } },
  reel:  { w: 220, h: 320, text: "",       style: { platform: "other" } },
  script: { w: 280, h: 240, text: "", style: { heading: "" } },
  copy:   { w: 260, h: 180, text: "", style: { heading: "" } },
  ad_asset: { w: 260, h: 260, text: "", style: { heading: "" } },
  schedule: { w: 300, h: 340, text: "Rotina Diária de Conteúdo", style: { recurrence: "daily", items: DEFAULT_SCHEDULE_ITEMS } },
  account: { w: 260, h: 130, text: "", style: { viewMode: "compact" } },
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


import { useEffect, useRef, useState, memo } from "react";
import { NodeResizer, type NodeProps } from "@xyflow/react";

export type AnnotationKind = "frame" | "note" | "label" | "arrow";

export interface AnnotationData {
  kind: AnnotationKind;
  text: string;
  style?: {
    borderColor?: string;
    bgColor?: string;
    fontSize?: number;
    orientation?: "diag-down" | "diag-up" | "horizontal" | "vertical";
    showHead?: boolean;
  };
  onTextChange?: (id: string, text: string) => void;
  editingId?: string | null;
}

const stopBubble = (e: React.SyntheticEvent) => e.stopPropagation();

const resizerLineClassName = "nodrag nopan !border-primary/70 !border-2 !z-50";
const resizerHandleClassName = "nodrag nopan !w-5 !h-5 !rounded-sm !bg-primary !border-2 !border-background !shadow-lg !z-50";

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
  return (
    <div
      className="w-full h-full rounded-lg relative"
      style={{
        border: `2px dashed ${d.style?.borderColor || "#c9922a"}`,
        background: d.style?.bgColor || "rgba(201,146,42,0.04)",
      }}
    >
      <NodeResizer isVisible={selected} minWidth={120} minHeight={80} lineClassName={resizerLineClassName} handleClassName={resizerHandleClassName} />
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
  return (
    <div
      className="w-full h-full rounded-md shadow-lg p-3 relative"
      style={{
        background: d.style?.bgColor || "#c9922a",
        color: "#080607",
      }}
    >
      <NodeResizer
        isVisible={selected}
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
  return (
    <div className="w-full h-full relative flex items-center">
      <NodeResizer isVisible={selected} minWidth={80} minHeight={30} lineClassName={resizerLineClassName} handleClassName={resizerHandleClassName} />
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
    <div className="w-full h-full relative">
      <NodeResizer isVisible={selected} minWidth={40} minHeight={20} lineClassName={resizerLineClassName} handleClassName={resizerHandleClassName} />
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

export const annotationNodeTypes = {
  annotation_frame: AnnotationFrameNode,
  annotation_note: AnnotationNoteNode,
  annotation_label: AnnotationLabelNode,
  annotation_arrow: AnnotationArrowNode,
};

export const ANNOTATION_TYPE_TO_KIND: Record<string, AnnotationKind> = {
  annotation_frame: "frame",
  annotation_note: "note",
  annotation_label: "label",
  annotation_arrow: "arrow",
};

export const ANNOTATION_KIND_TO_TYPE: Record<AnnotationKind, string> = {
  frame: "annotation_frame",
  note: "annotation_note",
  label: "annotation_label",
  arrow: "annotation_arrow",
};

export const ANNOTATION_DEFAULTS: Record<AnnotationKind, { w: number; h: number; text: string; style: AnnotationData["style"] }> = {
  frame: { w: 320, h: 220, text: "Grupo", style: { borderColor: "#c9922a" } },
  note:  { w: 200, h: 120, text: "Nota…", style: { bgColor: "#c9922a" } },
  label: { w: 260, h: 50,  text: "Título", style: { fontSize: 28 } },
  arrow: { w: 180, h: 120, text: "",       style: { orientation: "diag-down", showHead: true, borderColor: "#c9922a" } },
};

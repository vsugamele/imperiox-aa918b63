import { useRef, useCallback } from "react";

interface FlowNode {
  id: string;
  pos_x: number;
  pos_y: number;
  color: string;
}

interface Props {
  nodes: FlowNode[];
  pan: { x: number; y: number };
  zoom: number;
  canvasW: number;
  canvasH: number;
  viewportW: number;
  viewportH: number;
  onPanChange: (pan: { x: number; y: number }) => void;
}

const MINI_W = 160;
const MINI_H = 110;

export function FlowMinimap({ nodes, pan, zoom, canvasW, canvasH, viewportW, viewportH, onPanChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const scaleX = MINI_W / canvasW;
  const scaleY = MINI_H / canvasH;

  // Viewport rect in minimap coords
  const vpX = (-pan.x / zoom) * scaleX;
  const vpY = (-pan.y / zoom) * scaleY;
  const vpW = (viewportW / zoom) * scaleX;
  const vpH = (viewportH / zoom) * scaleY;

  const handleClick = useCallback((e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    // Center viewport on clicked point
    const canvasX = mx / scaleX;
    const canvasY = my / scaleY;
    onPanChange({
      x: -(canvasX - viewportW / zoom / 2) * zoom,
      y: -(canvasY - viewportH / zoom / 2) * zoom,
    });
  }, [scaleX, scaleY, zoom, viewportW, viewportH, onPanChange]);

  return (
    <div
      ref={ref}
      className="absolute bottom-3 right-3 rounded-md border border-border bg-background/80 backdrop-blur-sm cursor-pointer z-10 overflow-hidden"
      style={{ width: MINI_W, height: MINI_H }}
      onClick={handleClick}
    >
      {/* Nodes as dots */}
      {nodes.map(n => (
        <div
          key={n.id}
          className="absolute rounded-sm"
          style={{
            left: n.pos_x * scaleX,
            top: n.pos_y * scaleY,
            width: Math.max(4, 220 * scaleX),
            height: Math.max(3, 100 * scaleY),
            background: n.color,
            opacity: 0.7,
          }}
        />
      ))}
      {/* Viewport indicator */}
      <div
        className="absolute border-2 border-primary/60 rounded-sm"
        style={{
          left: Math.max(0, vpX),
          top: Math.max(0, vpY),
          width: Math.min(vpW, MINI_W),
          height: Math.min(vpH, MINI_H),
        }}
      />
    </div>
  );
}

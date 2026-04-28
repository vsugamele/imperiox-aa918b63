import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface Props {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  className?: string;
  title?: string;
}

/**
 * Mini gráfico de linha SVG, sem dependências externas.
 * Renderiza tendência rápida de uma métrica (gasto, ROAS, etc.)
 */
export function Sparkline({
  data,
  width = 64,
  height = 18,
  stroke = "hsl(var(--primary))",
  fill = "hsl(var(--primary) / 0.15)",
  className,
  title,
}: Props) {
  const path = useMemo(() => {
    if (!data || data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const stepX = width / (data.length - 1);
    const points = data.map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * (height - 2) - 1;
      return [x, y] as const;
    });
    const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const area = `${line} L${width},${height} L0,${height} Z`;
    return { line, area };
  }, [data, width, height]);

  if (!path) {
    return <span className={cn("inline-block text-muted-foreground/40 text-[9px]", className)}>—</span>;
  }

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className}>
      {title && <title>{title}</title>}
      <path d={path.area} fill={fill} stroke="none" />
      <path d={path.line} fill="none" stroke={stroke} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

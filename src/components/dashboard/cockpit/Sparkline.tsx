interface Props {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
  strokeClassName?: string;
}

/**
 * Sparkline editorial — SVG puro, sem libs.
 * Renderiza `values` normalizados no viewport. Ignora valores negativos.
 */
export function Sparkline({
  values,
  width = 72,
  height = 20,
  className = "",
  strokeClassName = "stroke-gold/70",
}: Props) {
  if (!values || values.length < 2) {
    return <div className={className} style={{ width, height }} />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / span) * height).toFixed(1)}`)
    .join(" ");
  const last = values[values.length - 1];
  const lastY = height - ((last - min) / span) * height;
  return (
    <svg width={width} height={height} className={className} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={points}
        fill="none"
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={strokeClassName}
      />
      <circle cx={width} cy={lastY} r={1.5} className="fill-gold" />
    </svg>
  );
}

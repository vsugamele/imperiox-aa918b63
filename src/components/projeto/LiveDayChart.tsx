import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface LiveDayPoint { at: number; gasto: number | null; faturamento: number | null }
interface LiveDayChartProps {
  points: LiveDayPoint[];
  currency: string;
}

// Cores validadas (dataviz validate_palette, modo escuro, fundo #1B1E23): todas as checagens passam,
// CVD ΔE 26,8. Slots 1 e 2 da paleta de referência; texto nunca usa a cor da série.
const SERIES = [
  { key: "faturamento", label: "Faturamento", color: "#3987e5" },
  { key: "gasto", label: "Gasto", color: "#d95926" },
] as const;

const time = (ms: number) => new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function money(value: number | null | undefined, currency: string, compact = false) {
  if (value === null || value === undefined) return "—";
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency, notation: compact ? "compact" : "standard", maximumFractionDigits: compact ? 1 : 2 }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

interface TipProps { active?: boolean; payload?: Array<{ payload: LiveDayPoint }>; currency: string }
function Tip({ active, payload, currency }: TipProps) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-2 py-1.5 text-[11px] shadow-md">
      <div className="mb-1 text-muted-foreground">{time(p.at)}</div>
      {SERIES.map((s) => (
        <div key={s.key} className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 rounded" style={{ background: s.color }} aria-hidden />
          <span className="text-muted-foreground">{s.label}</span>
          <span className="ml-auto pl-3 font-medium tabular-nums text-foreground">{money(p[s.key], currency)}</span>
        </div>
      ))}
    </div>
  );
}

/** Gasto × faturamento acumulados do dia, a partir das leituras de 15 min (LIVE1.2). Um eixo só, mesma moeda. */
export function LiveDayChart({ points, currency }: LiveDayChartProps) {
  const series = SERIES.filter((s) => points.some((p) => p[s.key] !== null));
  if (points.length < 2 || !series.length) {
    return <p className="text-[11px] text-muted-foreground">O gráfico do dia aparece a partir de 2 leituras (a cada 15 min).</p>;
  }
  const last = points[points.length - 1];

  return (
    <figure className="space-y-1" aria-label={`Gasto e faturamento acumulados hoje, ${points.length} leituras`}>
      <figcaption className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground">Dia até agora</span>
        {/* Legenda sempre presente; o valor atual de cada série fica ao lado do nome (rótulo direto). */}
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-3 rounded" style={{ background: s.color }} aria-hidden />
            {s.label} <span className="tabular-nums text-foreground">{money(last[s.key], currency)}</span>
          </span>
        ))}
      </figcaption>
      <div className="h-36 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
            <XAxis dataKey="at" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={time}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} minTickGap={40} />
            <YAxis tickFormatter={(v: number) => money(v, currency, true)} width={56}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <Tooltip content={<Tip currency={currency} />} cursor={{ stroke: "hsl(var(--muted-foreground))", strokeOpacity: 0.4 }} />
            {series.map((s) => (
              <Line key={s.key} dataKey={s.key} name={s.label} type="monotone" stroke={s.color} strokeWidth={2} dot={false}
                activeDot={{ r: 4, stroke: "hsl(var(--card))", strokeWidth: 2 }} connectNulls isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details className="text-[11px] text-muted-foreground">
        <summary className="cursor-pointer select-none">Ver leituras</summary>
        <table className="mt-1 w-full tabular-nums">
          <thead><tr className="text-left"><th className="font-normal">Hora</th>{series.map((s) => <th key={s.key} className="text-right font-normal">{s.label}</th>)}</tr></thead>
          <tbody>
            {points.slice().reverse().map((p) => (
              <tr key={p.at} className="text-foreground"><td>{time(p.at)}</td>{series.map((s) => <td key={s.key} className="text-right">{money(p[s.key], currency)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

import { Activity, AlertTriangle, ArrowDown, ArrowUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { SOURCE_LABEL, type LiveNumber, type LiveSource } from "@shared/live-panel";
import { useLivePanel } from "@/hooks/useLivePanel";

interface LivePanelProps {
  projectId: string;
}

const ZONE_TONE: Record<string, string> = {
  escala: "border-success/40 bg-success/10 text-success",
  lucrativa: "border-success/40 bg-success/10 text-success",
  magra: "border-warning/40 bg-warning/10 text-warning",
  prejuizo: "border-destructive/40 bg-destructive/10 text-destructive",
  sem_venda: "border-border text-muted-foreground",
};

function money(value: number | null, currency: string) {
  if (value === null) return "—";
  try { return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value); } catch { return `${currency} ${value.toFixed(2)}`; }
}
const int = (v: number | null) => (v === null ? "—" : v.toLocaleString("pt-BR"));
const time = (ms: number) => new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function SourceTag({ fonte }: { fonte: LiveSource | null }) {
  if (!fonte) return <span className="text-[10px] text-subtle">sem fonte</span>;
  return <span className="rounded border border-border px-1 text-[10px] text-muted-foreground">{SOURCE_LABEL[fonte]}</span>;
}

function Delta({ value, format, invert = false }: { value: number | null | undefined; format: (v: number) => string; invert?: boolean }) {
  if (value === null || value === undefined || value === 0) return null;
  const up = value > 0;
  const good = invert ? !up : up;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[11px]", good ? "text-success" : "text-destructive")}>
      {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}{format(Math.abs(value))}
    </span>
  );
}

/** Painel ao vivo do dia (LIVE1.1): funil, parcial com fonte de cada número, ritmo e alertas de rastreio. */
export function LivePanel({ projectId }: LivePanelProps) {
  const { data, isLoading, error, dataUpdatedAt, comparison } = useLivePanel(projectId);

  if (isLoading) return <Skeleton className="h-48 w-full rounded-lg" />;
  if (error || !data) return <p className="rounded-lg border border-border p-3 text-xs text-destructive">Painel ao vivo indisponível: {error instanceof Error ? error.message : "erro"}</p>;

  const { parcial, funil, moeda } = data;
  const m = (v: number | null) => money(v, moeda);
  const delta = comparison?.delta;
  const cards: Array<{ label: string; n: LiveNumber; text: string; d?: number | null; fmt: (v: number) => string; invert?: boolean; extra?: React.ReactNode }> = [
    { label: "Gasto", n: parcial.gasto, text: m(parcial.gasto.valor), d: delta?.gasto, fmt: m, invert: true },
    { label: "Faturamento", n: parcial.faturamento, text: m(parcial.faturamento.valor), d: delta?.faturamento, fmt: m },
    { label: "Vendas", n: parcial.vendas, text: int(parcial.vendas.valor), d: delta?.vendas, fmt: (v) => String(v) },
    {
      label: "CPA", n: parcial.cpa, text: m(parcial.cpa.valor), d: delta?.cpa, fmt: m, invert: true,
      extra: parcial.cpa.zona ? <span className={cn("rounded border px-1 text-[10px] font-medium", ZONE_TONE[parcial.cpa.zona])}>{parcial.cpa.zona_label}</span>
        : <span className="text-[10px] text-subtle">sem alvo</span>,
    },
    { label: "ROAS", n: parcial.roas, text: parcial.roas.valor === null ? "—" : `${parcial.roas.valor.toFixed(2)}×`, d: delta?.roas, fmt: (v) => v.toFixed(2) },
    { label: "Lucro", n: parcial.lucro, text: m(parcial.lucro.valor), d: delta?.lucro, fmt: m },
  ];

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-3" data-testid="live-panel">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Activity className="h-4 w-4 text-primary" /> Ao vivo · hoje</h2>
        <span className="text-[11px] text-muted-foreground">
          atualizado às {time(dataUpdatedAt)}{comparison ? ` · variação vs ${time(comparison.at)}` : ""}
        </span>
      </header>

      {funil.etapas.length > 0 && (
        <div className="flex flex-wrap items-stretch gap-1.5">
          {funil.etapas.map((e, i) => (
            <div key={e.key} className="flex items-center gap-1.5">
              {i > 0 && (
                <span className="text-[11px] text-muted-foreground">{funil.conversoes[i - 1]?.taxa !== null ? `${funil.conversoes[i - 1].taxa}% →` : "→"}</span>
              )}
              <div className="min-w-[7rem] rounded-md border border-border px-2 py-1.5">
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">{e.label}<SourceTag fonte={e.fonte} /></div>
                <div className="text-lg font-semibold tabular-nums">{int(e.valor)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-md border border-border px-2 py-1.5">
            <div className="flex items-center justify-between gap-1 text-[11px] text-muted-foreground">{c.label}<SourceTag fonte={c.n.fonte} /></div>
            <div className="text-base font-semibold tabular-nums">{c.text}</div>
            {c.n.outra && c.n.outra.valor > 0 && (
              <div className="text-[10px] text-muted-foreground">{SOURCE_LABEL[c.n.outra.fonte]}: {c.label === "Vendas" ? int(c.n.outra.valor) : m(c.n.outra.valor)}</div>
            )}
            <div className="flex items-center gap-1.5">{c.extra}<Delta value={c.d} format={c.fmt} invert={c.invert} /></div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Ritmo: ~{data.ritmo.vendas_por_hora} vendas/h · dia ≈ {data.ritmo.projecao_vendas} vendas e {m(data.ritmo.projecao_faturamento)}
        {data.pendentes.quantidade > 0 && ` · ${data.pendentes.quantidade} pix/boleto pendentes (${m(data.pendentes.valor)})`}
        {data.reembolsos.quantidade > 0 && ` · ${data.reembolsos.quantidade} reembolsos (${m(data.reembolsos.valor)})`}
        {parcial.cpa.alvo !== null && ` · CPA alvo ${m(parcial.cpa.alvo)}`}
      </p>

      {data.alertas.length > 0 && (
        <ul className="space-y-1">
          {data.alertas.map((a) => (
            <li key={a} className="flex items-start gap-1.5 text-[11px] text-warning"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{a}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

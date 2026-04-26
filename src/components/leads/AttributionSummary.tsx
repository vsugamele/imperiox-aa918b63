import { useMemo } from "react";
import { Clock, MapPin, Compass } from "lucide-react";

interface TimelineEvent {
  id: string;
  type: string;
  timestamp: string;
  title: string;
  subtitle?: string;
  details?: Record<string, any>;
}

interface Props {
  timeline: TimelineEvent[];
  hasSale: boolean;
}

const PURCHASE_TYPES = new Set(["Purchase", "CSVImport"]);

function formatDuration(ms: number): string {
  if (ms < 0) return "—";
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export default function AttributionSummary({ timeline, hasSale }: Props) {
  const stats = useMemo(() => {
    if (timeline.length === 0) return null;

    const sorted = [...timeline].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const first = sorted[0];
    const firstSale = sorted.find((ev) => PURCHASE_TYPES.has(ev.type));

    // Touchpoints antes da venda (exclui a venda em si)
    const touchpointsBeforeSale = firstSale
      ? sorted.filter((ev) => new Date(ev.timestamp) < new Date(firstSale.timestamp)).length
      : sorted.length;

    // Tempo até conversão
    const ttcMs = firstSale && first
      ? new Date(firstSale.timestamp).getTime() - new Date(first.timestamp).getTime()
      : null;

    // Caminho dominante: campanha mais frequente nos detalhes
    const campaignCounts: Record<string, number> = {};
    sorted.forEach((ev) => {
      const camp = ev.details?.utm_campaign;
      const src = ev.details?.utm_source;
      const key = camp || src;
      if (key && typeof key === "string") {
        campaignCounts[key] = (campaignCounts[key] || 0) + 1;
      }
    });
    const dominantEntry = Object.entries(campaignCounts).sort((a, b) => b[1] - a[1])[0];
    const dominant = dominantEntry ? { name: dominantEntry[0], count: dominantEntry[1] } : null;

    return {
      ttcMs,
      touchpointsBeforeSale,
      totalTouchpoints: sorted.length,
      dominant,
      hasSale: !!firstSale,
    };
  }, [timeline]);

  if (!stats || stats.totalTouchpoints === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-2 mb-3 pb-3 border-b border-border">
      <div className="bg-secondary/40 rounded-lg p-2 border border-border/50">
        <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground font-bold">
          <Clock className="h-2.5 w-2.5" />
          Tempo até venda
        </div>
        <div className="mt-1 text-sm font-mono font-bold text-foreground">
          {stats.hasSale && stats.ttcMs !== null ? formatDuration(stats.ttcMs) : (hasSale ? "—" : "Sem venda")}
        </div>
      </div>

      <div className="bg-secondary/40 rounded-lg p-2 border border-border/50">
        <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground font-bold">
          <MapPin className="h-2.5 w-2.5" />
          Touchpoints
        </div>
        <div className="mt-1 text-sm font-mono font-bold text-foreground">
          {stats.hasSale ? `${stats.touchpointsBeforeSale} antes` : `${stats.totalTouchpoints} total`}
        </div>
      </div>

      <div className="bg-secondary/40 rounded-lg p-2 border border-border/50 min-w-0">
        <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground font-bold">
          <Compass className="h-2.5 w-2.5" />
          Caminho dominante
        </div>
        <div className="mt-1 text-[11px] font-mono font-bold text-primary truncate" title={stats.dominant?.name}>
          {stats.dominant ? `${stats.dominant.name}` : "—"}
        </div>
        {stats.dominant && (
          <div className="text-[9px] text-muted-foreground">{stats.dominant.count} toque{stats.dominant.count > 1 ? "s" : ""}</div>
        )}
      </div>
    </div>
  );
}

import type { Json } from "@/integrations/supabase/types";
import { jsonText } from "@/lib/json-fields";
import { useMemo } from "react";
import { Clock, MapPin, Compass } from "lucide-react";

interface TimelineEvent {
  id: string;
  type: string;
  timestamp: string;
  title: string;
  subtitle?: string;
  details?: { [key: string]: Json | undefined };
}

interface Props {
  timeline: TimelineEvent[];
  hasSale: boolean;
}

const PURCHASE_TYPES = new Set(["Purchase", "CompraAprovada"]);

function formatDuration(ms: number): string {
  if (ms < 0) return "—";
  const min = Math.floor(ms / 60000);
  if (min === 0) return "< 1min";
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
    
    // Identifica venda real confirmada
    const firstSale = sorted.find((ev) => {
      if (PURCHASE_TYPES.has(ev.type)) return true;
      if (ev.type === "CSVImport") {
        const st = String(ev.details?.status || "").toLowerCase();
        return ["aprovada", "pago", "approved", "paid"].includes(st);
      }
      return false;
    });

    const isActualSale = hasSale && !!firstSale;

    // Touchpoints antes da venda (exclui a venda em si)
    const touchpointsBeforeSale = isActualSale && firstSale
      ? sorted.filter((ev) => new Date(ev.timestamp) < new Date(firstSale.timestamp)).length
      : sorted.length;

    // Tempo até conversão: apenas quando há venda real
    const ttcMs = isActualSale && firstSale && first
      ? Math.max(0, new Date(firstSale.timestamp).getTime() - new Date(first.timestamp).getTime())
      : null;

    // Caminho dominante: campanha ou fonte de tráfego legítima (exclui emails e lixo)
    const campaignCounts: Record<string, number> = {};
    sorted.forEach((ev) => {
      const camp = ev.details?.utm_campaign;
      const src = ev.details?.utm_source;
      const medium = ev.details?.utm_medium;
      const candidates = [camp, src, medium];
      
      candidates.forEach((cand) => {
        if (cand && typeof cand === "string") {
          const val = cand.trim();
          const isEmail = val.includes("@");
          const isUrl = val.startsWith("http://") || val.startsWith("https://");
          const isJunk = ["null", "undefined", "true", "false", "-", "—", "none", "csvimport"].includes(val.toLowerCase());
          if (!isEmail && !isUrl && !isJunk && val.length > 1) {
            campaignCounts[val] = (campaignCounts[val] || 0) + 1;
          }
        }
      });
    });
    
    const dominantEntry = Object.entries(campaignCounts).sort((a, b) => b[1] - a[1])[0];
    const dominant = dominantEntry ? { name: dominantEntry[0], count: dominantEntry[1] } : null;

    return {
      ttcMs,
      touchpointsBeforeSale,
      totalTouchpoints: sorted.length,
      dominant,
      isActualSale,
    };
  }, [timeline, hasSale]);

  if (!stats || stats.totalTouchpoints === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-2 mb-3 pb-3 border-b border-border">
      <div className="bg-secondary/40 rounded-lg p-2.5 border border-border/50">
        <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground font-bold">
          <Clock className="h-3 w-3 text-amber-400" />
          Tempo até venda
        </div>
        <div className="mt-1 text-sm font-mono font-bold text-foreground">
          {stats.isActualSale && stats.ttcMs !== null ? (
            <span className="text-emerald-400">{formatDuration(stats.ttcMs)}</span>
          ) : (
            <span className="text-amber-400/90 text-xs font-sans font-medium">Aguardando compra</span>
          )}
        </div>
      </div>

      <div className="bg-secondary/40 rounded-lg p-2.5 border border-border/50">
        <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground font-bold">
          <MapPin className="h-3 w-3 text-blue-400" />
          Touchpoints
        </div>
        <div className="mt-1 text-sm font-mono font-bold text-foreground">
          {stats.isActualSale ? `${stats.touchpointsBeforeSale} antes` : `${stats.totalTouchpoints} total`}
        </div>
      </div>

      <div className="bg-secondary/40 rounded-lg p-2.5 border border-border/50 min-w-0">
        <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground font-bold">
          <Compass className="h-3 w-3 text-emerald-400" />
          Caminho dominante
        </div>
        <div className="mt-1 text-xs font-mono font-bold text-primary truncate" title={stats.dominant?.name || "Direto / Orgânico"}>
          {stats.dominant ? stats.dominant.name : "Direto / Orgânico"}
        </div>
        {stats.dominant && (
          <div className="text-[9px] text-muted-foreground">{stats.dominant.count} toque{stats.dominant.count > 1 ? "s" : ""}</div>
        )}
      </div>
    </div>
  );
}

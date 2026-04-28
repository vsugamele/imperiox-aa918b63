import { AlertTriangle, Flame, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  ads: any[];
  onFilter?: (term: string) => void;
}

interface Alert {
  icon: any;
  text: string;
  tone: "danger" | "warn" | "info";
  filter?: string;
}

const toneClass = {
  danger: "bg-red-500/10 border-red-500/20 text-red-300 hover:bg-red-500/15",
  warn:   "bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/15",
  info:   "bg-blue-500/10 border-blue-500/20 text-blue-300 hover:bg-blue-500/15",
};

export function AlertsHeader({ ads, onFilter }: Props) {
  // Agrupa por campanha
  const byCamp = new Map<string, any[]>();
  for (const a of ads) {
    const k = a.campanha || "Sem nome";
    if (!byCamp.has(k)) byCamp.set(k, []);
    byCamp.get(k)!.push(a);
  }

  const alerts: Alert[] = [];

  // 1. Campanhas com gasto > 200 sem compras
  const burning: string[] = [];
  byCamp.forEach((items, name) => {
    const valor = items.reduce((s, a) => s + Number(a.valor || 0), 0);
    const compras = items.reduce((s, a) => s + Number(a.compras || 0), 0);
    if (valor >= 200 && compras === 0) burning.push(name);
  });
  if (burning.length > 0) {
    alerts.push({
      icon: Flame,
      tone: "danger",
      text: `${burning.length} campanha(s) gastaram >R$200 sem nenhuma compra`,
      filter: burning[0],
    });
  }

  // 2. Frequência alta (saturação)
  const saturated: string[] = [];
  byCamp.forEach((items, name) => {
    const freqs = items.filter(a => a.frequencia && a.frequencia > 0).map(a => Number(a.frequencia));
    if (!freqs.length) return;
    const avg = freqs.reduce((a, b) => a + b, 0) / freqs.length;
    if (avg > 4) saturated.push(`${name} (${avg.toFixed(1)})`);
  });
  if (saturated.length > 0) {
    alerts.push({
      icon: AlertTriangle,
      tone: "warn",
      text: `Saturação detectada: ${saturated.slice(0, 2).join(", ")}${saturated.length > 2 ? ` +${saturated.length - 2}` : ""}`,
    });
  }

  // 3. Sem dados nas últimas 24h
  const today = new Date().toISOString().slice(0, 10);
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const recent = ads.filter(a => a.data_ref >= yest);
  if (ads.length > 0 && recent.length === 0) {
    alerts.push({
      icon: EyeOff,
      tone: "info",
      text: "Sem dados das últimas 24h. Sincronize a conta de anúncios.",
    });
  }

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {alerts.slice(0, 3).map((a, i) => {
        const Icon = a.icon;
        const clickable = !!a.filter && !!onFilter;
        return (
          <button
            key={i}
            disabled={!clickable}
            onClick={() => clickable && onFilter!(a.filter!)}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-md border text-xs text-left transition-colors",
              toneClass[a.tone],
              clickable ? "cursor-pointer" : "cursor-default"
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">{a.text}</span>
            {clickable && <span className="text-[10px] opacity-70">filtrar →</span>}
          </button>
        );
      })}
    </div>
  );
}

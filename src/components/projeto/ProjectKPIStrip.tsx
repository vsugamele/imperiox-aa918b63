import { useProjectPulse } from "@/hooks/useProjectPulse";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props {
  projectId: string;
  onNavigate?: (tab: string) => void;
}

const fmtBRL = (n: number) => {
  if (n >= 1000) return `R$ ${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".", ",")}k`;
  return `R$ ${n.toFixed(0)}`;
};

export function ProjectKPIStrip({ projectId, onNavigate }: Props) {
  const { pulse } = useProjectPulse(projectId);

  const delta = pulse.revenueYesterday > 0
    ? ((pulse.revenueToday - pulse.revenueYesterday) / pulse.revenueYesterday) * 100
    : pulse.revenueToday > 0 ? 100 : 0;
  const deltaIcon = delta > 5 ? TrendingUp : delta < -5 ? TrendingDown : Minus;
  const DeltaIcon = deltaIcon;
  const deltaColor = delta > 5 ? "text-emerald-400" : delta < -5 ? "text-red-400" : "text-muted-foreground";

  const Item = ({
    emoji, label, value, sub, color = "text-primary", onClick,
  }: { emoji: string; label: string; value: string; sub?: React.ReactNode; color?: string; onClick?: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="group flex items-baseline gap-2 px-3 py-1.5 rounded-md hover:bg-secondary/40 transition-colors disabled:cursor-default text-left"
    >
      <span className="text-sm opacity-70">{emoji}</span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-sans">{label}</span>
      <span className={`text-sm font-sans font-medium ${color}`}>
        {pulse.loading ? "—" : value}
      </span>
      {!pulse.loading && sub}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1 -mt-2 mb-4 px-1 py-1 border-y border-border/30 bg-secondary/20 rounded-sm">
      <Item
        emoji="💰" label="Hoje" value={fmtBRL(pulse.revenueToday)} color="text-primary"
        onClick={() => onNavigate?.("financas")}
        sub={pulse.revenueYesterday > 0 || pulse.revenueToday > 0 ? (
          <span className={`flex items-center gap-0.5 text-[10px] ${deltaColor}`}>
            <DeltaIcon className="h-3 w-3" />
            {Math.abs(delta).toFixed(0)}%
          </span>
        ) : null}
      />
      <span className="text-border/60">·</span>
      <Item emoji="📈" label="Mês" value={fmtBRL(pulse.revenueMonth)} onClick={() => onNavigate?.("financas")} />
      <span className="text-border/60">·</span>
      <Item
        emoji="🎯" label="ROAS"
        value={pulse.roasToday != null ? `${pulse.roasToday.toFixed(2)}x` : "—"}
        color={pulse.roasToday == null ? "text-muted-foreground" : pulse.roasToday >= 2 ? "text-emerald-400" : pulse.roasToday >= 1 ? "text-primary" : "text-red-400"}
        onClick={() => onNavigate?.("analytics")}
      />
      <span className="text-border/60">·</span>
      <Item
        emoji="🔥" label="Hot leads" value={String(pulse.hotLeads)}
        color={pulse.hotLeads > 0 ? "text-red-400" : "text-muted-foreground"}
        onClick={() => onNavigate?.("comando")}
      />
      <span className="text-border/60">·</span>
      <Item
        emoji="📥" label="Leads hoje" value={String(pulse.leadsToday)}
        color="text-foreground"
        onClick={() => onNavigate?.("kpis")}
      />
    </div>
  );
}

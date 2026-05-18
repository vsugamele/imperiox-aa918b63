import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  kpi?: { label: string; value: ReactNode; hint?: string };
  primaryAction?: ReactNode;
  filters?: ReactNode;
}

/**
 * Header padrão para páginas top-level.
 * Layout: [icon + título + subtítulo]   [KPI hero]   [ação primária]
 *                                        [filtros opcionais abaixo]
 */
export function PageHeader({ icon: Icon, title, subtitle, kpi, primaryAction, filters }: PageHeaderProps) {
  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          {Icon && <Icon className="h-7 w-7 text-primary shrink-0 mt-1" />}
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-bold text-primary truncate">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-4 ml-auto">
          {kpi && (
            <div className="text-right border-r border-border pr-4 hidden md:block">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70">{kpi.label}</div>
              <div className="font-display text-2xl text-primary leading-tight">{kpi.value}</div>
              {kpi.hint && <div className="text-[10px] text-muted-foreground">{kpi.hint}</div>}
            </div>
          )}
          {primaryAction}
        </div>
      </div>
      {filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}
    </div>
  );
}

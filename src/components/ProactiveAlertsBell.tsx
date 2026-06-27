import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Zap, X, AlertTriangle, TrendingUp, Clock, Sparkles } from "lucide-react";
import { useProactiveAlerts, type ProactiveAlert } from "@/hooks/useProactiveAlerts";
import { useNavigate } from "react-router-dom";

const ICON: Record<ProactiveAlert["kind"], any> = {
  roas_drop: TrendingUp,
  stale_conv: Clock,
  pix_pending: AlertTriangle,
  sales_spike: Sparkles,
};

const TONE: Record<ProactiveAlert["severity"], string> = {
  info: "text-sky-400",
  warning: "text-amber-400",
  critical: "text-red-400",
  success: "text-emerald-400",
};

export function ProactiveAlertsBell() {
  const { alerts, total, dismiss } = useProactiveAlerts();
  const navigate = useNavigate();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Alertas proativos">
          <Zap className="h-4 w-4" />
          {total > 0 && (
            <Badge
              variant="secondary"
              className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] bg-primary text-primary-foreground border-0"
            >
              {total}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0 bg-secondary/95 border-border/60 backdrop-blur">
        <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
          <p className="text-sm font-display flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" /> Alertas proativos
          </p>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">tempo real</span>
        </div>
        <ScrollArea className="max-h-[480px]">
          {alerts.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground leading-6">
              Tudo sob controle. ✨<br />
              <span className="text-xs">Sem alertas no momento.</span>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {alerts.map(a => {
                const Icon = ICON[a.kind] || Zap;
                return (
                  <div key={a.key} className="p-3 hover:bg-secondary/40 transition-colors group">
                    <div className="flex items-start gap-3">
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${TONE[a.severity]}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-6 text-foreground">{a.title}</p>
                        <p className="text-xs text-muted-foreground leading-5 mt-0.5">{a.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          {a.action_href && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => navigate(a.action_href!)}
                            >
                              {a.action_label || "Abrir"}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-muted-foreground"
                            onClick={() => dismiss(a.key)}
                          >
                            <X className="h-3 w-3 mr-1" /> Dispensar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

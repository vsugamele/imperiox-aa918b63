import React, { useState, useMemo } from "react";
import type { TimelineEvent } from "@/hooks/useLeadTimeline";
import { format, isValid } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertCircle, AlertTriangle, ChevronDown, ChevronUp, Zap } from "lucide-react";

interface Props {
  timeline: TimelineEvent[];
  eventConfig: Record<string, { icon: React.ReactNode; color: string; label: string }>;
}

interface TimelineGroup {
  id: string;
  type: string;
  count: number;
  events: TimelineEvent[];
  firstTimestamp: string;
  lastTimestamp: string;
  title: string;
  subtitle?: string;
  details?: TimelineEvent["details"];
  isErrorGroup?: boolean;
  errorReason?: string;
}

export function GroupedTimelineView({ timeline, eventConfig }: Props) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const groups = useMemo(() => {
    if (!timeline || timeline.length === 0) return [];
    const res: TimelineGroup[] = [];

    for (const ev of timeline) {
      const obsText = String(ev.details?.obs || "").toLowerCase();
      const statusText = String(ev.details?.status || "").toLowerCase();
      const subText = String(ev.subtitle || "").toLowerCase();

      const isErr =
        ev.type === "Recovery" &&
        (subText.includes("falha") ||
          subText.includes("error") ||
          statusText.includes("falha") ||
          statusText.includes("error") ||
          obsText.includes("no_provider"));

      let reason = "";
      if (obsText.includes("no_provider")) {
        reason = "no_provider (nenhum chip/instância WhatsApp conectada)";
      } else if (ev.details?.obs) {
        reason = String(ev.details.obs);
      }

      const prev = res[res.length - 1];
      const canGroup =
        prev &&
        prev.type === ev.type &&
        ((isErr && prev.isErrorGroup) || (prev.subtitle === ev.subtitle && prev.title === ev.title));

      if (canGroup) {
        prev.count += 1;
        prev.events.push(ev);
        prev.lastTimestamp = ev.timestamp;
      } else {
        res.push({
          id: ev.id,
          type: ev.type,
          count: 1,
          events: [ev],
          firstTimestamp: ev.timestamp,
          lastTimestamp: ev.timestamp,
          title: ev.title,
          subtitle: ev.subtitle,
          details: ev.details,
          isErrorGroup: isErr,
          errorReason: reason,
        });
      }
    }

    return res;
  }, [timeline]);

  return (
    <div className="relative max-h-[440px] overflow-y-auto pr-2">
      <div className="absolute left-[15px] top-0 bottom-0 w-px bg-border" />
      <div className="space-y-3">
        {groups.map((group) => {
          const config = eventConfig[group.type] || {
            icon: <Zap className="h-3 w-3" />,
            color: "bg-muted-foreground",
            label: group.type,
          };
          const isExpanded = !!expandedGroups[group.id];

          if (group.count > 1) {
            return (
              <div key={group.id} className="flex gap-3 relative">
                <div
                  className={cn(
                    "h-[30px] w-[30px] rounded-full flex items-center justify-center text-white shrink-0 z-10 shadow-md",
                    group.isErrorGroup ? "bg-rose-500 ring-2 ring-rose-500/20" : config.color
                  )}
                >
                  {group.isErrorGroup ? <AlertTriangle className="h-3.5 w-3.5" /> : config.icon}
                </div>

                <div className="flex-1 min-w-0 pb-1 rounded-xl p-3 bg-slate-900/60 border border-slate-800/80 shadow-sm">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-slate-100">{config.label}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] px-2 py-0 h-4 font-mono font-bold uppercase tracking-wider",
                          group.isErrorGroup
                            ? "border-rose-500/40 text-rose-400 bg-rose-500/10"
                            : "border-amber-500/40 text-amber-400 bg-amber-500/10"
                        )}
                      >
                        {group.count} tentativas agrupadas
                      </Badge>
                    </div>

                    <span className="text-[10px] text-muted-foreground font-mono">
                      {(() => {
                        try {
                          const d1 = new Date(group.firstTimestamp);
                          const d2 = new Date(group.lastTimestamp);
                          return isValid(d1) && isValid(d2)
                            ? `${format(d1, "dd/MM HH:mm")} → ${format(d2, "dd/MM HH:mm")}`
                            : "";
                        } catch {
                          return "";
                        }
                      })()}
                    </span>
                  </div>

                  {group.subtitle && (
                    <p className="text-[11px] text-slate-300 mt-1 font-medium">{group.subtitle}</p>
                  )}

                  {group.errorReason && (
                    <div className="mt-2 text-[10px] text-rose-300 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1.5 rounded-lg flex items-center gap-2">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                      <span>{group.errorReason}</span>
                    </div>
                  )}

                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px] text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                      onClick={() => toggleGroup(group.id)}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-3 w-3 mr-1" /> Ocultar histórico individual
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3 mr-1" /> Ver detalhes das {group.count} tentativas
                        </>
                      )}
                    </Button>
                  </div>

                  {isExpanded && (
                    <div className="mt-2 space-y-1 pl-2 border-l-2 border-slate-800 text-[10px] font-mono text-slate-400 max-h-48 overflow-y-auto pr-1">
                      {group.events.map((it, idx) => (
                        <div key={it.id || idx} className="flex items-center justify-between py-1 border-b border-slate-900/50">
                          <span className="text-slate-300">Tentativa #{group.events.length - idx}</span>
                          <span className="text-slate-500">
                            {(() => {
                              try {
                                const d = new Date(it.timestamp);
                                return isValid(d) ? format(d, "dd/MM/yyyy HH:mm:ss") : "";
                              } catch {
                                return "";
                              }
                            })()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          }

          // Single event (count === 1)
          const ev = group.events[0];
          return (
            <div key={ev.id} className="flex gap-3 relative">
              <div
                className={`h-[30px] w-[30px] rounded-full ${config.color} flex items-center justify-center text-white shrink-0 z-10 shadow-sm`}
              >
                {config.icon}
              </div>
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-200">{config.label}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {(() => {
                      try {
                        const d = new Date(ev.timestamp);
                        return isValid(d) ? format(d, "dd/MM HH:mm") : "";
                      } catch {
                        return "";
                      }
                    })()}
                  </span>
                </div>
                {ev.subtitle && <p className="text-[11px] text-muted-foreground truncate">{ev.subtitle}</p>}
                {ev.details && Object.keys(ev.details).filter((k) => ev.details![k]).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(ev.details)
                      .filter(([, v]) => v)
                      .slice(0, 4)
                      .map(([k, v]) => (
                        <Badge key={k} variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-slate-800 text-slate-300">
                          {k}: {String(v).substring(0, 30)}
                        </Badge>
                      ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

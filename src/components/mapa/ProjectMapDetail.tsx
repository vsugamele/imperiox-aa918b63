import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { GapSeverity, ProjectMap } from "@shared/project-map";
import { StatusPill } from "@/components/mapa/StatusPill";
import { FORMAT_LABEL, SEVERITY_CLASS, SEVERITY_LABEL } from "@/components/mapa/map-styles";

interface ProjectMapDetailProps {
  map: ProjectMap | null;
  onOpenChange: (open: boolean) => void;
}

const SEVERITIES: GapSeverity[] = ["critica", "importante", "sugestao"];

export function ProjectMapDetail({ map, onOpenChange }: ProjectMapDetailProps) {
  return (
    <Sheet open={!!map} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl p-0">
        {map && (
          <ScrollArea className="h-full">
            <div className="p-5 space-y-6">
              <SheetHeader className="space-y-1 text-left">
                <div className="kicker">Mapa do projeto · {map.score}%</div>
                <SheetTitle className="section-title">{map.projectName}</SheetTitle>
                <SheetDescription className="text-xs">{FORMAT_LABEL[map.dataFormat]}</SheetDescription>
              </SheetHeader>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">O que falta ({map.gaps.length})</h3>
                {map.gaps.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma lacuna encontrada.</p>}
                {SEVERITIES.map((severity) => {
                  const gaps = map.gaps.filter((g) => g.severity === severity);
                  if (!gaps.length) return null;
                  return (
                    <div key={severity} className="space-y-2">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-subtle">{SEVERITY_LABEL[severity]} · {gaps.length}</div>
                      {gaps.map((gap, i) => (
                        <div key={`${gap.area}-${i}`} className={cn("rounded-md border p-3 space-y-1", SEVERITY_CLASS[gap.severity])}>
                          <p className="text-xs text-foreground">{gap.message}</p>
                          <p className="text-[11px] text-muted-foreground">→ {gap.action}</p>
                          {gap.skill && <p className="text-[10px] font-mono text-subtle">skill: {gap.skill}</p>}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Áreas</h3>
                {map.sections.map((section) => (
                  <div key={section.area} className="rounded-md border border-border bg-card p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-foreground">{section.label}</span>
                      <StatusPill status={section.status} />
                    </div>
                    {section.items.length > 1 || section.area === "produtos" ? (
                      <ul className="space-y-2">
                        {section.items.map((item) => (
                          <li key={item.key} className="border-t border-border pt-2 first:border-t-0 first:pt-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-foreground">{item.label}</span>
                              <StatusPill status={item.status} />
                            </div>
                            <Evidence lines={item.evidence} />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <Evidence lines={section.items[0]?.evidence ?? []} />
                    )}
                  </div>
                ))}
              </section>
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Evidence({ lines }: { lines: string[] }) {
  if (!lines.length) return <p className="mt-1 text-[11px] text-subtle">Sem evidência cadastrada.</p>;
  return (
    <ul className="mt-1 space-y-0.5">
      {lines.map((line, i) => (
        <li key={i} className="text-[11px] text-muted-foreground break-all">· {line}</li>
      ))}
    </ul>
  );
}

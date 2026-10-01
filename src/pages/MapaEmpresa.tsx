import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/error-message";
import { STATUS_LABEL, type MapArea, type MapStatus, type ProjectMap } from "@shared/project-map";
import { useCompanyMap } from "@/hooks/useCompanyMap";
import { StatusPill } from "@/components/mapa/StatusPill";
import { ProjectMapDetail } from "@/components/mapa/ProjectMapDetail";
import { STATUS_DOT } from "@/components/mapa/map-styles";
import { Stat } from "@/components/mapa/Stat";

const AREAS: Array<{ area: MapArea; label: string }> = [
  { area: "produtos", label: "Produtos" },
  { area: "avatar", label: "Avatar" },
  { area: "mecanismo", label: "Mecanismo" },
  { area: "concorrentes", label: "Concorrentes" },
  { area: "funil", label: "Funil" },
  { area: "ativos", label: "Ativos" },
  { area: "atendimento", label: "Atendimento" },
];

const LEGEND: MapStatus[] = ["falta", "desenhado", "construido", "rodando"];

const criticalCount = (map: ProjectMap) => map.gaps.filter((g) => g.severity === "critica").length;
const statusOf = (map: ProjectMap, area: MapArea) => map.sections.find((s) => s.area === area)?.status ?? "falta";

export default function MapaEmpresa() {
  const { data: maps = [], isLoading, isFetching, error, refetch } = useCompanyMap();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [onlyCritical, setOnlyCritical] = useState(false);

  const rows = useMemo(() => {
    const sorted = [...maps].sort((a, b) => criticalCount(b) - criticalCount(a) || b.score - a.score);
    return onlyCritical ? sorted.filter((m) => criticalCount(m) > 0) : sorted;
  }, [maps, onlyCritical]);

  const totals = useMemo(() => ({
    projects: maps.length,
    critical: maps.reduce((n, m) => n + criticalCount(m), 0),
    running: maps.filter((m) => m.sections.some((s) => s.status === "rodando")).length,
    score: maps.length ? Math.round(maps.reduce((n, m) => n + m.score, 0) / maps.length) : 0,
  }), [maps]);

  const selected = maps.find((m) => m.projectId === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="kicker">Mapa da Empresa</div>
          <h1 className="section-title mt-1 text-2xl md:text-3xl">O que está desenhado, construído e rodando</h1>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            A mesma leitura que as IAs usam: cada projeto por área, com a evidência de cada status e o que falta, em ordem de prioridade.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("mr-2 h-3.5 w-3.5", isFetching && "animate-spin")} /> Atualizar
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Projetos ativos" value={totals.projects} />
        <Stat label="Lacunas críticas" value={totals.critical} tone={totals.critical ? "text-destructive" : undefined} />
        <Stat label="Com algo rodando" value={totals.running} />
        <Stat label="Maturidade média" value={`${totals.score}%`} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {LEGEND.map((s) => (
            <span key={s} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[s])} /> {STATUS_LABEL[s]}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Switch id="only-critical" checked={onlyCritical} onCheckedChange={setOnlyCritical} />
          <Label htmlFor="only-critical" className="text-xs text-muted-foreground">Só projetos com lacuna crítica</Label>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Lendo os projetos...
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Não foi possível montar o mapa: {errorMessage(error) || "erro desconhecido"}</span>
        </div>
      )}

      {!isLoading && !error && (
        <>
          {/* Desktop: matriz projetos × áreas */}
          <div className="hidden overflow-x-auto rounded-md border border-border md:block">
            <table className="w-full text-left text-xs">
              <thead className="bg-card text-[10px] uppercase tracking-wider text-subtle">
                <tr>
                  <th className="px-3 py-2 font-medium">Projeto</th>
                  {AREAS.map((a) => <th key={a.area} className="px-2 py-2 font-medium">{a.label}</th>)}
                  <th className="px-3 py-2 text-right font-medium">Maturidade</th>
                  <th className="px-3 py-2 text-right font-medium">Críticas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((map) => (
                  <tr key={map.projectId} onClick={() => setSelectedId(map.projectId)} className="cursor-pointer transition-colors hover:bg-card">
                    <td className="px-3 py-2.5 font-medium text-foreground">{map.projectName}</td>
                    {AREAS.map((a) => <td key={a.area} className="px-2 py-2.5"><StatusPill status={statusOf(map, a.area)} /></td>)}
                    <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{map.score}%</td>
                    <td className={cn("px-3 py-2.5 text-right font-mono", criticalCount(map) ? "text-destructive" : "text-subtle")}>{criticalCount(map)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: um cartão por projeto */}
          <div className="space-y-2 md:hidden">
            {rows.map((map) => (
              <button key={map.projectId} onClick={() => setSelectedId(map.projectId)} className="w-full rounded-md border border-border bg-card p-3 text-left">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{map.projectName}</span>
                  <span className="font-mono text-xs text-muted-foreground">{map.score}%</span>
                </div>
                <div className="mt-2 grid grid-cols-7 gap-1">
                  {AREAS.map((a) => (
                    <div key={a.area} className="flex flex-col items-center gap-1">
                      <span className={cn("h-2 w-full rounded-full", STATUS_DOT[statusOf(map, a.area)])} />
                      <span className="text-[8px] text-subtle">{a.label.slice(0, 5)}</span>
                    </div>
                  ))}
                </div>
                {criticalCount(map) > 0 && <p className="mt-2 text-[11px] text-destructive">{criticalCount(map)} lacuna(s) crítica(s)</p>}
              </button>
            ))}
          </div>

          {rows.length === 0 && <p className="py-10 text-center text-xs text-muted-foreground">Nenhum projeto neste filtro.</p>}
        </>
      )}

      <ProjectMapDetail map={selected} onOpenChange={(open) => !open && setSelectedId(null)} />
    </div>
  );
}

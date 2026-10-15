import { Link } from "react-router-dom";
import { ArrowRight, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { SOURCE_LABEL, waitingFor, type ApprovalItem, type ApprovalSource } from "@shared/approval-queue";
import { useApprovals } from "@/hooks/useApprovals";

/** Quantas decisões de cada tipo, na ordem da fila (a fila já vem ordenada por urgência). */
export function countBySource(items: ReadonlyArray<ApprovalItem>): Array<{ source: ApprovalSource; n: number }> {
  const out: Array<{ source: ApprovalSource; n: number }> = [];
  for (const i of items) {
    const cur = out.find((o) => o.source === i.source);
    if (cur) cur.n++;
    else out.push({ source: i.source, n: 1 });
  }
  return out;
}

/**
 * Topo do Hoje (UX1.3): o que espera um sim ou não, vindo da fila única Aprovar. Só resume e leva para lá;
 * decidir continua sendo no Aprovar.
 */
export function DecisionsSummary({ projectId }: { projectId?: string | null }) {
  const { data = [], isLoading, error } = useApprovals();
  if (isLoading || error) return null;
  const items = projectId ? data.filter((i) => !i.projectId || i.projectId === projectId) : data;

  if (!items.length) {
    return (
      <section aria-label="Decisões esperando" className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/5 p-3 text-sm text-foreground">
        <CheckCheck className="h-4 w-4 text-success" /> Nenhuma decisão esperando você.
      </section>
    );
  }

  return (
    <section aria-label="Decisões esperando" className="space-y-2 rounded-lg border border-warning/40 bg-warning/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">{items.length} decisão(ões) esperando você</h2>
        <Link to="/aprovar" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          Decidir no Aprovar <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {countBySource(items).map(({ source, n }) => (
          <li key={source} className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground">
            {SOURCE_LABEL[source]}: <strong className="text-foreground">{n}</strong>
          </li>
        ))}
      </ul>
      <ol className="space-y-1 text-sm" aria-label="Mais urgentes">
        {items.slice(0, 3).map((i) => (
          <li key={i.key} className={cn("flex items-baseline justify-between gap-3", i.risk === "high" && "text-foreground")}>
            <span className="truncate">{i.title}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{waitingFor(i.createdAt)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

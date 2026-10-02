import { Skeleton } from "@/components/ui/skeleton";

interface PageSkeletonProps {
  /** Formato do conteúdo que está chegando. */
  variant: "cards" | "list" | "grid";
  /** Texto para leitores de tela. */
  label: string;
}

/** Esqueleto no formato do conteúdo, no lugar de spinner: a tela já mostra onde as coisas vão aparecer. */
export function PageSkeleton({ variant, label }: PageSkeletonProps) {
  if (variant === "list") {
    return (
      <div role="status" aria-label={label} className="space-y-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex gap-3 rounded-lg border border-border bg-card p-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-7 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (variant === "grid") {
    return (
      <div role="status" aria-label={label} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-border bg-card p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div role="status" aria-label={label} className="grid gap-4 xl:grid-cols-2">
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className="space-y-3 rounded-lg border border-border bg-card p-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-64" />
          <Skeleton className="h-1.5 w-full" />
          {Array.from({ length: 4 }, (__, j) => <Skeleton key={j} className="h-10 w-full" />)}
        </div>
      ))}
    </div>
  );
}

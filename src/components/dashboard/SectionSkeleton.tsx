import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Props {
  h?: number;
  className?: string;
  label?: string;
}

export function SectionSkeleton({ h = 240, className, label }: Props) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-card/30 backdrop-blur-sm p-4 space-y-3",
        className
      )}
      style={{ minHeight: h }}
      aria-busy="true"
      aria-label={label || "Carregando seção"}
    >
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3 w-1/2 opacity-70" />
      <Skeleton className="h-full w-full" style={{ height: Math.max(80, h - 80) }} />
    </div>
  );
}

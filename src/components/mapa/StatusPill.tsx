import { cn } from "@/lib/utils";
import { STATUS_LABEL, type ItemStatus } from "@shared/project-map";
import { STATUS_CLASS } from "@/components/mapa/map-styles";

interface StatusPillProps {
  status: ItemStatus;
  className?: string;
}

export function StatusPill({ status, className }: StatusPillProps) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider whitespace-nowrap", STATUS_CLASS[status], className)}>
      {STATUS_LABEL[status]}
    </span>
  );
}

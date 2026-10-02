import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { DUE_LABEL, dueState, firstName, localDate, type StepStatus } from "@shared/map-steps";
import { useTeamMembers } from "@/hooks/useTeamMembers";

interface StepOwnerChipsProps {
  ownerId: string | null | undefined;
  due: string | null | undefined;
  status: StepStatus;
}

const DUE_TONE = {
  atrasada: "border-destructive/40 bg-destructive/10 text-destructive",
  hoje: "border-warning/40 bg-warning/10 text-warning",
  em_breve: "border-primary/30 bg-primary/5 text-primary",
  futura: "border-border text-muted-foreground",
} as const;

/** Dono e prazo da etapa no card do mapa. Renderize só quando houver um dos dois. */
export function StepOwnerChips({ ownerId, due, status }: StepOwnerChipsProps) {
  const { data: team } = useTeamMembers();
  const owner = ownerId ? team?.members.find((m) => m.id === ownerId) ?? null : null;
  const state = dueState(due, localDate(), status);
  const dueText = due ? (() => {
    const [y, m, d] = due.slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  })() : null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
      {owner && (
        <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-medium text-primary" title={`Responsável: ${owner.name}`}>
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">{firstName(owner.name).slice(0, 1).toUpperCase()}</span>
          {firstName(owner.name)}
        </span>
      )}
      {dueText && (
        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium", state ? DUE_TONE[state] : "border-border text-muted-foreground")}
          title={state ? DUE_LABEL[state] : "Prazo"}>
          <CalendarClock className="h-3 w-3" /> {dueText}
        </span>
      )}
    </div>
  );
}

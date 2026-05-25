import { Check, Circle } from "lucide-react";

interface Item { key: string; label: string; weight: number; done: boolean; }
interface Props { items: Item[]; }

export function ChecklistPanel({ items }: Props) {
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.key} className="flex items-start gap-2 text-sm">
          {i.done ? (
            <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
          ) : (
            <Circle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          )}
          <span className={i.done ? "text-foreground" : "text-muted-foreground"}>{i.label}</span>
          <span className="ml-auto text-[10px] text-muted-foreground/60">+{i.weight}</span>
        </li>
      ))}
    </ul>
  );
}

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  items: any[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

function getLabel(s: any, idx: number): string {
  const m = String(s.title || "").match(/ROTEIRO\s+([A-Z0-9]+)/i);
  if (m) return m[1].toUpperCase();
  if (idx < 26) return String.fromCharCode(65 + idx);
  return String(idx + 1);
}

export function SwipeIndexSidebar({ items, activeId, onSelect }: Props) {
  const [q, setQ] = useState("");

  const indexed = useMemo(() => items.map((s, i) => ({ ...s, __label: getLabel(s, i) })), [items]);
  const filtered = useMemo(() => {
    if (!q.trim()) return indexed;
    const k = q.toLowerCase();
    return indexed.filter((s) => `${s.title} ${s.__label}`.toLowerCase().includes(k));
  }, [indexed, q]);

  return (
    <aside className="lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)] bg-secondary/20 border border-border/40 rounded-lg p-3 flex flex-col">
      <div className="relative mb-3">
        <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar roteiro…"
          className="pl-7 h-8 text-xs bg-background/60 border-border/50"
        />
      </div>
      <nav className="flex-1 overflow-y-auto -mr-1 pr-1 space-y-0.5">
        {filtered.map((s) => {
          const active = s.id === activeId;
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={cn(
                "w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-xs transition border-l-2",
                active
                  ? "bg-[hsl(var(--gold))]/10 border-[hsl(var(--gold))] text-foreground"
                  : "border-transparent hover:bg-secondary/40 text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "shrink-0 inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold tabular-nums",
                  active
                    ? "bg-[hsl(var(--gold))] text-background"
                    : "bg-secondary/60 text-foreground/70",
                )}
              >
                {s.__label}
              </span>
              <span className="truncate font-medium leading-tight">{s.title?.replace(/^ROTEIRO\s+[A-Z0-9]+\s*[—-]\s*/i, "") || "—"}</span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-[11px] text-muted-foreground italic px-2 py-4">Nenhum roteiro encontrado</p>
        )}
      </nav>
    </aside>
  );
}

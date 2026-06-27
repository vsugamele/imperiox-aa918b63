import { useMemo } from "react";
import { ChecklistItem } from "@/hooks/useProductChecklist";
import { cn } from "@/lib/utils";

interface Props {
  byProduct: Map<string, ChecklistItem[]>;
  products: any[];
  currentProductName?: string | null;
  onSwitchProduct?: (name: string) => void;
}

interface Row {
  key: string;
  name: string;
  total: number;
  pending: number;
  overdue: number;
  isCurrent: boolean;
}

export function CrossProductRadar({ byProduct, products, currentProductName, onSwitchProduct }: Props) {
  const rows: Row[] = useMemo(() => {
    const now = Date.now();
    const out: Row[] = [];
    for (const p of products || []) {
      const name = p?.nome || p?.name || "";
      const key = name.trim().toLowerCase();
      const list = byProduct.get(key) || [];
      const pending = list.filter(i => i.status !== "done");
      const overdue = pending.filter(i => i.due_date && new Date(i.due_date).getTime() < now).length;
      out.push({
        key, name,
        total: list.length,
        pending: pending.length,
        overdue,
        isCurrent: (currentProductName || "").toLowerCase() === key,
      });
    }
    return out.sort((a, b) => (b.overdue - a.overdue) || (b.pending - a.pending));
  }, [byProduct, products, currentProductName]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    const all: Array<ChecklistItem & { prodName: string }> = [];
    for (const [k, list] of byProduct.entries()) {
      const prod = products.find((p: any) => (p?.nome || p?.name || "").trim().toLowerCase() === k);
      const name = prod?.nome || prod?.name || (k === "__projeto__" ? "Projeto" : k);
      for (const it of list) {
        if (it.status !== "done" && it.due_date) {
          const d = new Date(it.due_date).getTime();
          if (d - now < 1000 * 60 * 60 * 48) all.push({ ...it, prodName: name });
        }
      }
    }
    return all.sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime()).slice(0, 5);
  }, [byProduct, products]);

  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border border-border/40 bg-secondary/20 p-3 space-y-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">🚨 Radar de Produtos</p>
      <div className="space-y-1">
        {rows.map(r => {
          const tone =
            r.overdue > 0 ? "text-rose-300 bg-rose-500/10" :
            r.pending > 3 ? "text-amber-300 bg-amber-500/10" :
            r.pending > 0 ? "text-sky-300 bg-sky-500/10" :
            "text-emerald-300 bg-emerald-500/10";
          return (
            <button
              key={r.key || r.name}
              onClick={() => onSwitchProduct?.(r.name)}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:brightness-125 transition",
                tone,
                r.isCurrent && "ring-1 ring-primary/60"
              )}
            >
              <span className="flex-1 text-left truncate font-medium">{r.name || "(sem nome)"}</span>
              {r.overdue > 0 && <span className="text-[10px] font-semibold">{r.overdue} atrasada{r.overdue > 1 ? "s" : ""}</span>}
              <span className="text-[10px] tabular-nums opacity-80">{r.pending} pend.</span>
              {r.isCurrent && <span className="text-[9px] uppercase opacity-70">aqui</span>}
            </button>
          );
        })}
      </div>

      {upcoming.length > 0 && (
        <div className="pt-2 border-t border-border/30 space-y-0.5">
          <p className="text-[9px] uppercase text-muted-foreground">Próximas 48h</p>
          {upcoming.map(u => (
            <div key={u.id} className="text-[10px] text-muted-foreground flex gap-1.5">
              <span className="font-semibold text-foreground/80">{u.prodName}</span>
              <span className="truncate flex-1">· {u.title}</span>
              <span className="opacity-70">{new Date(u.due_date!).toLocaleDateString("pt-BR")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

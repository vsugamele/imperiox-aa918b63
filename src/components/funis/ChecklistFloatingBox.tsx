import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus, X, Minus, GripVertical, ExternalLink, AlertTriangle, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChecklistPriority, productKey, useProductChecklist } from "@/hooks/useProductChecklist";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string | null;
  products: any[];
  currentProductName?: string | null;
  onSwitchProduct?: (idx: number) => void;
  onOpenFull?: () => void;
  onClose?: () => void;
}

const PRIO_DOT: Record<ChecklistPriority, string> = {
  high: "bg-rose-400",
  med: "bg-amber-400",
  low: "bg-sky-400",
};

const STORAGE_POS = "hub:checklistBoxPos";
const STORAGE_MIN = "hub:checklistBoxMin";

export function ChecklistFloatingBox({ projectId, products, currentProductName, onSwitchProduct, onOpenFull, onClose }: Props) {
  const { items, add, update, toKanban } = useProductChecklist(projectId);
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_POS) || "") || { x: 24, y: 80 }; }
    catch { return { x: 24, y: 80 }; }
  });
  const [minimized, setMinimized] = useState<boolean>(() => localStorage.getItem(STORAGE_MIN) === "1");
  const [newTitle, setNewTitle] = useState("");
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => { localStorage.setItem(STORAGE_POS, JSON.stringify(pos)); }, [pos]);
  useEffect(() => { localStorage.setItem(STORAGE_MIN, minimized ? "1" : "0"); }, [minimized]);

  const currentKey = productKey(currentProductName);
  const productItems = useMemo(() => items.filter(i => i.product_id === currentKey), [items, currentKey]);
  const pending = productItems.filter(i => i.status !== "done");
  const overdue = pending.filter(i => i.due_date && new Date(i.due_date).getTime() < Date.now()).length;

  // mini radar
  const radar = useMemo(() => {
    const now = Date.now();
    const byProd = new Map<string, { pending: number; overdue: number }>();
    for (const it of items) {
      const k = it.product_id || "__projeto__";
      if (!byProd.has(k)) byProd.set(k, { pending: 0, overdue: 0 });
      if (it.status !== "done") {
        const e = byProd.get(k)!;
        e.pending++;
        if (it.due_date && new Date(it.due_date).getTime() < now) e.overdue++;
      }
    }
    const rows = (products || []).map((p: any) => {
      const name = p?.nome || p?.name || "";
      const k = name.trim().toLowerCase();
      const stats = byProd.get(k) || { pending: 0, overdue: 0 };
      return { name, k, ...stats, current: k === (currentKey || "") };
    }).filter(r => r.pending > 0 && !r.current);
    return rows.sort((a, b) => b.overdue - a.overdue || b.pending - a.pending).slice(0, 3);
  }, [items, products, currentKey]);

  // drag
  const onPointerDown = (e: React.PointerEvent) => {
    if (!boxRef.current) return;
    const rect = boxRef.current.getBoundingClientRect();
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !boxRef.current) return;
    const parent = boxRef.current.parentElement?.getBoundingClientRect();
    if (!parent) return;
    const nx = Math.max(4, Math.min(parent.width - 80, e.clientX - parent.left - dragRef.current.dx));
    const ny = Math.max(4, Math.min(parent.height - 40, e.clientY - parent.top - dragRef.current.dy));
    setPos({ x: nx, y: ny });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  };

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    await add({ title: newTitle.trim(), product_id: currentKey, priority: "med" });
    setNewTitle("");
  };

  const summaryLabel =
    overdue > 0 ? `${overdue} atrasada${overdue > 1 ? "s" : ""} · ${pending.length} pend.` :
    pending.length > 0 ? `${pending.length} pendente${pending.length > 1 ? "s" : ""}` :
    "tudo em dia";

  return (
    <div
      ref={boxRef}
      data-ui
      className={cn(
        "absolute z-40 rounded-lg border border-violet-500/40 bg-[#0a0608]/95 backdrop-blur shadow-xl shadow-black/40",
        minimized ? "w-[240px]" : "w-[320px]"
      )}
      style={{ left: pos.x, top: pos.y }}
    >
      {/* Header */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border/40 cursor-move select-none"
      >
        <GripVertical className="h-3 w-3 text-muted-foreground/60" />
        <Check className="h-3.5 w-3.5 text-violet-400" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold truncate">{currentProductName || "Projeto"}</p>
          <p className={cn("text-[9px] truncate", overdue > 0 ? "text-rose-300" : "text-muted-foreground")}>{summaryLabel}</p>
        </div>
        <button onClick={() => setMinimized(m => !m)} className="p-0.5 text-muted-foreground hover:text-foreground" title={minimized ? "Expandir" : "Minimizar"}>
          {minimized ? <Plus className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
        </button>
        <button onClick={onClose} className="p-0.5 text-muted-foreground hover:text-rose-400" title="Fechar">
          <X className="h-3 w-3" />
        </button>
      </div>

      {!minimized && (
        <div className="p-2 space-y-2 max-h-[60vh] overflow-y-auto">
          {/* Mini radar */}
          {radar.length > 0 && (
            <div className="space-y-0.5">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-2.5 w-2.5" /> outros produtos
              </p>
              {radar.map(r => (
                <button
                  key={r.k}
                  onClick={() => {
                    const idx = products.findIndex((p: any) => (p?.nome || p?.name || "").trim().toLowerCase() === r.k);
                    if (idx >= 0) onSwitchProduct?.(idx);
                  }}
                  className={cn(
                    "w-full flex items-center gap-1.5 px-1.5 py-1 rounded text-[10px] hover:brightness-125 transition",
                    r.overdue > 0 ? "bg-rose-500/10 text-rose-300" : "bg-amber-500/10 text-amber-300"
                  )}
                >
                  <span className="flex-1 text-left truncate font-medium">{r.name}</span>
                  {r.overdue > 0 && <span className="font-semibold">{r.overdue}!</span>}
                  <span className="opacity-80 tabular-nums">{r.pending}</span>
                </button>
              ))}
            </div>
          )}

          {/* Lista */}
          <div className="space-y-1">
            {productItems.length === 0 && (
              <p className="text-[10px] text-muted-foreground text-center py-3">Sem tarefas. Adicione abaixo.</p>
            )}
            {productItems.slice(0, 8).map(it => {
              const isOverdue = it.due_date && it.status !== "done" && new Date(it.due_date).getTime() < Date.now();
              return (
                <div
                  key={it.id}
                  className={cn(
                    "group flex items-center gap-1.5 px-1.5 py-1 rounded border text-[11px]",
                    it.status === "done" ? "bg-emerald-500/5 border-emerald-500/20 opacity-60" :
                    isOverdue ? "bg-rose-500/5 border-rose-500/30" :
                    "bg-secondary/30 border-border/40"
                  )}
                >
                  <button
                    onClick={() => update(it.id, { status: it.status === "done" ? "todo" : "done" })}
                    className={cn(
                      "h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0",
                      it.status === "done" ? "bg-emerald-500/40 border-emerald-500/60" : "border-border/60 hover:border-violet-400"
                    )}
                  >
                    {it.status === "done" && <Check className="h-2 w-2" />}
                  </button>
                  <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", PRIO_DOT[it.priority])} />
                  <span className={cn("flex-1 min-w-0 truncate", it.status === "done" && "line-through")}>{it.title}</span>
                  {!it.kanban_card_id && it.status !== "done" && (
                    <button
                      onClick={() => toKanban(it)}
                      title="Enviar para Kanban"
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition"
                    >
                      <Send className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
              );
            })}
            {productItems.length > 8 && (
              <p className="text-[9px] text-center text-muted-foreground pt-1">+{productItems.length - 8} tarefas</p>
            )}
          </div>

          {/* Input rápido */}
          <div className="flex gap-1">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Nova tarefa…"
              className="h-7 text-[11px]"
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            />
            <button
              onClick={handleAdd}
              className="px-2 rounded bg-violet-500/20 border border-violet-500/40 text-violet-200 hover:bg-violet-500/30 text-xs"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          {/* Footer */}
          <button
            onClick={onOpenFull}
            className="w-full flex items-center justify-center gap-1 text-[10px] text-muted-foreground hover:text-violet-300 pt-1 border-t border-border/30"
          >
            <ExternalLink className="h-2.5 w-2.5" /> ver tudo · templates · radar completo
          </button>
        </div>
      )}
    </div>
  );
}

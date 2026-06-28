import { useState, useMemo } from "react";
import { ASSET_CATEGORIES, COLOR_TOKENS, type ColorKey } from "./assetCatalog";

const PCT_BG: Record<ColorKey, string> = {
  emerald: "bg-emerald-500/70",
  amber: "bg-amber-500/70",
  sky: "bg-sky-500/70",
  violet: "bg-violet-500/70",
  rose: "bg-rose-500/70",
  pink: "bg-pink-500/70",
  cyan: "bg-cyan-500/70",
  indigo: "bg-indigo-500/70",
  fuchsia: "bg-fuchsia-500/70",
};
import { ChevronDown, ChevronRight, Check, Plus, X, ListChecks, Search, Zap, Loader2, StopCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export interface AssetState {
  catId: string;
  itemId: string;
  status?: "pending" | "generated" | "reviewed" | "approved";
  output?: string;
}

interface Props {
  assets: AssetState[];
  onAdd: (catId: string, itemId: string) => void;
  onRemove: (catId: string, itemId: string) => void;
  onAddAll: (catId: string) => void;
  onOpenAsset?: (catId: string, itemId: string) => void;
  open: boolean;
  onToggle: () => void;
  // Auto-Pilot
  onRunAutoPilotAll?: () => void;
  onRunAutoPilotCategory?: (catId: string) => void;
  autopilot?: { running: boolean; done: number; total: number; currentLabel: string; failed: number };
}

export function ChecklistSidebar({ assets, onAdd, onRemove, onAddAll, onOpenAsset, open, onToggle, onRunAutoPilotAll, onRunAutoPilotCategory, autopilot }: Props) {
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");

  const keyMap = useMemo(() => {
    const m = new Map<string, AssetState>();
    for (const a of assets) m.set(`${a.catId}:${a.itemId}`, a);
    return m;
  }, [assets]);

  if (!open) {
    return (
      <button
        onClick={onToggle}
        className="absolute left-3 top-16 z-40 h-9 w-9 rounded-lg bg-[#0a0608] border border-pink-500/40 hover:bg-pink-500/10 flex items-center justify-center shadow-xl"
        title="Abrir checklist"
      >
        <ListChecks className="h-4 w-4 text-pink-300" />
      </button>
    );
  }

  return (
    <div
      data-ui
      className="absolute left-3 top-14 bottom-3 z-40 w-[300px] rounded-xl border-2 border-pink-500/40 bg-[#0a0608]/95 backdrop-blur-md shadow-2xl shadow-pink-500/10 flex flex-col"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-pink-300" />
          <span className="text-xs font-semibold text-pink-100">Checklist</span>
          <span className="text-[10px] text-muted-foreground">{assets.length} ativos</span>
        </div>
        <button onClick={onToggle} className="h-6 w-6 rounded hover:bg-secondary/60 flex items-center justify-center" title="Fechar">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-2 border-b border-border/40 space-y-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar ativo…"
            className="h-7 pl-7 text-xs bg-secondary/40 border-border/40"
          />
        </div>
        {/* ⚡ Auto-Pilot — Gerar tudo */}
        {onRunAutoPilotAll && (
          <button
            onClick={onRunAutoPilotAll}
            disabled={autopilot?.running && false /* sempre clicável: clicar de novo cancela */}
            className={cn(
              "w-full h-8 rounded-md flex items-center justify-center gap-1.5 text-[11px] font-semibold transition-colors border",
              autopilot?.running
                ? "bg-rose-500/15 border-rose-500/50 text-rose-200 hover:bg-rose-500/25"
                : "bg-gradient-to-r from-pink-500/20 to-violet-500/20 border-pink-500/50 text-pink-200 hover:from-pink-500/30 hover:to-violet-500/30"
            )}
            title={autopilot?.running ? "Cancelar auto-pilot" : "Gera todos os ativos pendentes que estão no canvas"}
          >
            {autopilot?.running ? (
              <>
                <StopCircle className="h-3.5 w-3.5" />
                Cancelar ({autopilot.done}/{autopilot.total})
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5" />
                Gerar todos os pendentes
              </>
            )}
          </button>
        )}
        {autopilot?.running && (
          <div className="space-y-1">
            <div className="h-1 bg-secondary/40 rounded overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-pink-500 to-violet-500 transition-all"
                style={{ width: `${autopilot.total > 0 ? (autopilot.done / autopilot.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-[9px] text-muted-foreground truncate flex items-center gap-1">
              <Loader2 className="h-2.5 w-2.5 animate-spin shrink-0" />
              <span className="truncate">{autopilot.currentLabel || "Processando…"}</span>
            </p>
          </div>
        )}
      </div>


      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {ASSET_CATEGORIES.map(cat => {
          const colors = COLOR_TOKENS[cat.color];
          const filteredItems = query
            ? cat.items.filter(i => i.label.toLowerCase().includes(query.toLowerCase()))
            : cat.items;
          if (query && filteredItems.length === 0) return null;
          const isOpen = openCats[cat.id] ?? (!!query);
          const total = cat.items.length;
          const done = cat.items.filter(i => keyMap.has(`${cat.id}:${i.id}`)).length;
          const pct = total > 0 ? (done / total) * 100 : 0;

          return (
            <div key={cat.id} className="rounded-lg overflow-hidden border border-border/30">
              <button
                onClick={() => setOpenCats(s => ({ ...s, [cat.id]: !isOpen }))}
                className={cn("w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-secondary/40 transition-colors", colors.header)}
              >
                {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <span className="text-xs font-semibold flex-1 truncate">{cat.label}</span>
                <span className="text-[9px] tabular-nums opacity-80">{done}/{total}</span>
              </button>
              <div className="h-0.5 bg-secondary/30">
                <div className={cn("h-full transition-all", PCT_BG[cat.color])} style={{ width: `${pct}%` }} />
              </div>


              {isOpen && (
                <div className="bg-[#080607]/60 p-1 space-y-0.5">
                  {done < total && !query && (
                    <button
                      onClick={() => onAddAll(cat.id)}
                      className="w-full text-[10px] px-2 py-1 rounded text-pink-300 hover:bg-pink-500/10 text-left"
                    >
                      + Adicionar todos
                    </button>
                  )}
                  {filteredItems.map(item => {
                    const key = `${cat.id}:${item.id}`;
                    const state = keyMap.get(key);
                    const has = !!state;
                    const status = state?.status || (state?.output ? "generated" : "pending");
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-center gap-1.5 px-2 py-1 rounded text-[11px] group",
                          has ? "bg-secondary/40" : "hover:bg-secondary/30"
                        )}
                      >
                        <button
                          onClick={() => has ? onRemove(cat.id, item.id) : onAdd(cat.id, item.id)}
                          className={cn(
                            "h-4 w-4 rounded flex items-center justify-center border transition-colors shrink-0",
                            has
                              ? status === "approved" ? "bg-emerald-500/30 border-emerald-500/60 text-emerald-200"
                              : status === "generated" || status === "reviewed" ? "bg-pink-500/30 border-pink-500/60 text-pink-200"
                              : "bg-muted/40 border-muted-foreground/40 text-muted-foreground"
                              : "border-border/60 hover:border-pink-500/60 text-transparent hover:text-pink-300"
                          )}
                          title={has ? "Remover do canvas" : "Adicionar ao canvas"}
                        >
                          {has ? <Check className="h-2.5 w-2.5" /> : <Plus className="h-2.5 w-2.5" />}
                        </button>
                        <button
                          onClick={() => has && onOpenAsset?.(cat.id, item.id)}
                          disabled={!has}
                          className={cn(
                            "flex-1 text-left truncate",
                            has ? "text-foreground/90 hover:text-pink-200 cursor-pointer" : "text-muted-foreground cursor-default"
                          )}
                          title={item.promptHint}
                        >
                          {item.label}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

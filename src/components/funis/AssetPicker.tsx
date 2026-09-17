import { useState } from "react";
import { ASSET_CATEGORIES, AssetCategory, COLOR_TOKENS } from "./assetCatalog";
import { ChevronRight, ListChecks, Network, ShoppingCart, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  selectedItems: Set<string>; // key = `${catId}:${itemId}`
  onToggle: (catId: string, itemId: string) => void;
  onAddAll: (catId: string) => void;
  onClose?: () => void;
}

export function AssetPicker({ selectedItems, onToggle, onAddAll }: Props) {
  const [activeCat, setActiveCat] = useState<AssetCategory | null>(null);

  return (
    <div className="flex gap-3 items-start">
      {/* Coluna 1: categorias */}
      <div className="w-[210px] rounded-2xl border-2 border-pink-500/40 bg-[#0a0608]/95 backdrop-blur-md p-2 shadow-2xl shadow-pink-500/10">
        <div className="flex items-center justify-around px-2 py-1.5 mb-1.5 border-b border-border/40">
          <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
          <Network className="h-3.5 w-3.5 text-muted-foreground" />
          <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-1">
          {ASSET_CATEGORIES.map(cat => {
            const isActive = activeCat?.id === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCat(isActive ? null : cat)}
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-all",
                  isActive
                    ? "bg-gradient-to-r from-pink-600/40 to-pink-500/20 text-pink-100 border border-pink-500/60"
                    : "bg-secondary/40 text-foreground/90 hover:bg-secondary/70 border border-transparent"
                )}
              >
                <span>{cat.label}</span>
                <ChevronRight className="h-3.5 w-3.5 opacity-60" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Coluna 2: sub-itens */}
      {activeCat && (
        <div className="w-[230px] rounded-2xl border-2 border-pink-500/40 bg-[#0a0608]/95 backdrop-blur-md p-2 shadow-2xl shadow-pink-500/10 animate-fade-in">
          <button
            onClick={() => onAddAll(activeCat.id)}
            className="flex items-center gap-2 w-full rounded-lg px-3 py-2 mb-1.5 bg-pink-600/20 hover:bg-pink-600/30 text-pink-200 text-xs font-semibold border border-pink-500/50 transition-all"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Adicionar todos
          </button>
          <div className="flex flex-col gap-1 max-h-[420px] overflow-y-auto">
            {activeCat.items.map(item => {
              const key = `${activeCat.id}:${item.id}`;
              const checked = selectedItems.has(key);
              return (
                <label
                  key={item.id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-xs cursor-pointer transition-all",
                    checked
                      ? `${COLOR_TOKENS[activeCat.color].soft} ${COLOR_TOKENS[activeCat.color].text} border ${COLOR_TOKENS[activeCat.color].border}`
                      : "bg-secondary/40 hover:bg-secondary/70 text-foreground/90 border border-transparent"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(activeCat.id, item.id)}
                    className="w-3.5 h-3.5 accent-pink-500"
                  />
                  <span className="font-medium">{item.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

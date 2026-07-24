import { COLUMN_COLOR_PRESETS } from "./kanbanTemplates";
import { Check } from "lucide-react";

interface Props {
  currentColor?: string | null;
  onPick: (hex: string) => void;
}

export function ColumnColorMenu({ currentColor, onPick }: Props) {
  return (
    <div className="grid grid-cols-3 gap-1 p-1">
      {COLUMN_COLOR_PRESETS.map((c) => {
        const active = (currentColor || "").toLowerCase() === c.hex.toLowerCase();
        return (
          <button
            key={c.id}
            onClick={() => onPick(c.hex)}
            className="h-8 rounded-md flex items-center justify-center border border-border/40 hover:border-foreground/40 transition-colors relative"
            style={{ backgroundColor: c.hex + "22" }}
            title={c.label}
          >
            <span className="h-4 w-4 rounded-full" style={{ backgroundColor: c.hex }} />
            {active && <Check className="absolute h-3 w-3 text-foreground" />}
          </button>
        );
      })}
    </div>
  );
}

// Deriva o tom leve da cor pra fundo/borda do card e do header.
export function hexToTint(hex: string | null | undefined, alpha = 0.12): string {
  if (!hex) return "hsl(var(--muted) / 0.3)";
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

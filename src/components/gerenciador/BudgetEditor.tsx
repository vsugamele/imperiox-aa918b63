import { useEffect, useRef, useState } from "react";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: number | null | undefined;
  disabled?: boolean;
  onSave: (next: number) => Promise<void>;
}

function brl(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function BudgetEditor({ value, disabled, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(value != null ? String(value) : "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value != null ? String(value) : "");
  }, [value]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = async () => {
    const num = Number(draft.replace(",", "."));
    if (!num || isNaN(num) || num <= 0) {
      setEditing(false);
      setDraft(value != null ? String(value) : "");
      return;
    }
    if (value != null && Math.abs(num - Number(value)) < 0.001) {
      setEditing(false);
      return;
    }
    try {
      setSaving(true);
      await onSave(num);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setEditing(true)}
        className={cn(
          "group inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded tabular-nums text-xs transition",
          disabled ? "text-muted-foreground cursor-not-allowed" : "text-foreground/90 hover:bg-secondary/60 hover:text-primary"
        )}
        title={disabled ? "Sem ID Meta" : "Editar orçamento diário"}
      >
        {value ? brl(Number(value)) : "—"}
        {!disabled && <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-70 transition" />}
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-1">
      <span className="text-[10px] text-muted-foreground">R$</span>
      <input
        ref={inputRef}
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setEditing(false); setDraft(value != null ? String(value) : ""); }
        }}
        className="w-20 h-7 px-1.5 rounded bg-background border border-border/60 text-xs tabular-nums focus:outline-none focus:border-primary"
        inputMode="decimal"
      />
      <button onClick={commit} disabled={saving} className="h-6 w-6 rounded inline-flex items-center justify-center hover:bg-emerald-500/20 text-emerald-300">
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
      </button>
      <button onClick={() => { setEditing(false); setDraft(value != null ? String(value) : ""); }} disabled={saving} className="h-6 w-6 rounded inline-flex items-center justify-center hover:bg-red-500/20 text-red-300">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

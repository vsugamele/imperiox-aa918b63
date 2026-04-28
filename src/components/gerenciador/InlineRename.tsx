import { useEffect, useRef, useState } from "react";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  disabled?: boolean;
  onSave: (next: string) => void | Promise<void>;
  className?: string;
}

export function InlineRename({ value, disabled, onSave, className }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = async () => {
    const next = draft.trim();
    if (!next || next === value) { setEditing(false); setDraft(value); return; }
    try { setSaving(true); await onSave(next); setEditing(false); }
    finally { setSaving(false); }
  };

  if (!editing) {
    return (
      <span
        className={cn("group inline-flex items-center gap-1.5 max-w-full", className)}
        onDoubleClick={() => !disabled && setEditing(true)}
      >
        <span className="truncate" title={value}>{value}</span>
        {!disabled && (
          <button
            onClick={(e) => { e.stopPropagation(); setEditing(true); }}
            className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition shrink-0"
            title="Renomear"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 w-full">
      <input
        ref={inputRef}
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setEditing(false); setDraft(value); }
        }}
        className="flex-1 min-w-0 h-7 px-1.5 rounded bg-background border border-primary/40 text-xs focus:outline-none"
      />
      <button onClick={commit} disabled={saving} className="h-6 w-6 rounded inline-flex items-center justify-center hover:bg-emerald-500/20 text-emerald-300 shrink-0">
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
      </button>
      <button onClick={() => { setEditing(false); setDraft(value); }} disabled={saving} className="h-6 w-6 rounded inline-flex items-center justify-center hover:bg-red-500/20 text-red-300 shrink-0">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

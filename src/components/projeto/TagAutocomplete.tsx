import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { X, Plus } from "lucide-react";
import { useLeadTags } from "@/hooks/useLeadTags";

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  /** Extra suggestions to merge with the lead tags fetched from DB */
  extraSuggestions?: string[];
}

export function TagAutocomplete({ tags, onChange, placeholder = "Adicionar...", extraSuggestions = [] }: Props) {
  const { tags: leadTags } = useLeadTags();
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    const all = Array.from(new Set([...leadTags, ...extraSuggestions]));
    const q = input.trim().toLowerCase();
    return all
      .filter(t => !tags.includes(t))
      .filter(t => !q || t.toLowerCase().includes(q))
      .slice(0, 10);
  }, [leadTags, extraSuggestions, input, tags]);

  const add = (val: string) => {
    const v = val.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setInput("");
  };

  return (
    <div className="space-y-2" ref={wrapRef}>
      <div className="flex flex-wrap gap-2 items-center">
        {tags.map((tag, i) => (
          <Badge key={i} variant="secondary" className="gap-1 pr-1">
            {tag}
            <button type="button" onClick={() => onChange(tags.filter((_, j) => j !== i))} className="ml-1 hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <div className="relative flex items-center gap-1">
          <Input
            value={input}
            onChange={(e) => { setInput(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); add(input); }
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder={placeholder}
            className="h-7 w-40 text-xs bg-secondary"
          />
          <button type="button" onClick={() => add(input)} className="text-primary hover:text-gold-light">
            <Plus className="h-4 w-4" />
          </button>
          {open && suggestions.length > 0 && (
            <div className="absolute top-full left-0 mt-1 w-56 max-h-56 overflow-auto bg-popover border border-border rounded-md shadow-lg z-50">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); add(s); }}
                  className="block w-full text-left px-3 py-1.5 text-xs hover:bg-secondary"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

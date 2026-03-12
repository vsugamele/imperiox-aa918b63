import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { X, Plus } from "lucide-react";

interface EditableTagListProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export function EditableTagList({ tags, onChange, placeholder = "Adicionar..." }: EditableTagListProps) {
  const [input, setInput] = useState("");

  const addTag = () => {
    const val = input.trim();
    if (val && !tags.includes(val)) {
      onChange([...tags, val]);
      setInput("");
    }
  };

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {tags.map((tag, i) => (
        <Badge key={i} variant="secondary" className="gap-1 pr-1">
          {tag}
          <button onClick={() => onChange(tags.filter((_, j) => j !== i))} className="ml-1 hover:text-destructive">
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <div className="flex items-center gap-1">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
          placeholder={placeholder}
          className="h-7 w-32 text-xs bg-secondary"
        />
        <button onClick={addTag} className="text-primary hover:text-gold-light">
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

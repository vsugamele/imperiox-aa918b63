import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { X, Plus, Tag as TagIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface ContactTag {
  id: string;
  tag: string;
  color: string;
}

const TAG_COLORS = ["#c9922a", "#10b981", "#3b82f6", "#ef4444", "#a855f7", "#ec4899", "#f59e0b"];

interface Props {
  projectId: string;
  phone: string;
}

export default function ContactTagsPanel({ projectId, phone }: Props) {
  const { user } = useAuth();
  const [tags, setTags] = useState<ContactTag[]>([]);
  const [newTag, setNewTag] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("imphq_wa_contact_tags")
      .select("id, tag, color")
      .eq("project_id", projectId)
      .eq("phone", phone)
      .order("created_at");
    setTags((data as any) || []);
  };

  const loadSuggestions = async () => {
    const { data } = await supabase
      .from("imphq_wa_contact_tags")
      .select("tag")
      .eq("project_id", projectId)
      .limit(50);
    const uniq = Array.from(new Set(((data as any) || []).map((d: any) => d.tag)));
    setSuggestions(uniq);
  };

  useEffect(() => {
    if (!projectId || !phone) return;
    load();
    loadSuggestions();
  }, [projectId, phone]);

  const addTag = async (tagText?: string) => {
    const t = (tagText ?? newTag).trim();
    if (!t) return;
    const color = TAG_COLORS[tags.length % TAG_COLORS.length];
    const { error } = await supabase.from("imphq_wa_contact_tags").insert({
      project_id: projectId, phone, tag: t, color, created_by: user?.id || null,
    });
    if (error) {
      if (error.code === "23505") toast.info("Tag já existe");
      else toast.error("Erro: " + error.message);
      return;
    }
    setNewTag("");
    setAdding(false);
    load();
    loadSuggestions();
  };

  const removeTag = async (id: string) => {
    await supabase.from("imphq_wa_contact_tags").delete().eq("id", id);
    load();
  };

  const filteredSuggestions = newTag
    ? suggestions.filter(s => s.toLowerCase().includes(newTag.toLowerCase()) && !tags.some(t => t.tag === s)).slice(0, 5)
    : [];

  return (
    <div className="px-3 py-2 border-b border-border bg-card/40">
      <div className="flex items-center gap-1.5 mb-1.5">
        <TagIcon className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Tags</span>
      </div>
      <div className="flex flex-wrap gap-1.5 items-center">
        {tags.map(t => (
          <span
            key={t.id}
            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-medium"
            style={{ background: `${t.color}22`, borderColor: `${t.color}66`, color: t.color }}
          >
            {t.tag}
            <button onClick={() => removeTag(t.id)} className="hover:opacity-70" title="Remover">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        {adding ? (
          <div className="relative">
            <Input
              autoFocus
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              onBlur={() => setTimeout(() => { setAdding(false); setNewTag(""); }, 150)}
              onKeyDown={e => {
                if (e.key === "Enter") { e.preventDefault(); addTag(); }
                if (e.key === "Escape") { setAdding(false); setNewTag(""); }
              }}
              placeholder="nova tag..."
              className="h-6 text-[11px] w-32 px-2"
            />
            {filteredSuggestions.length > 0 && (
              <div className="absolute top-full mt-1 left-0 z-10 bg-popover border border-border rounded-md shadow-lg min-w-32 max-w-48">
                {filteredSuggestions.map(s => (
                  <button
                    key={s}
                    onMouseDown={e => { e.preventDefault(); addTag(s); }}
                    className="block w-full text-left text-[11px] px-2 py-1 hover:bg-muted"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-0.5 text-[11px] px-2 py-0.5 rounded-full border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors"
          >
            <Plus className="h-2.5 w-2.5" /> tag
          </button>
        )}
      </div>
    </div>
  );
}

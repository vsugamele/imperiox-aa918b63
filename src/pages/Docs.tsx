import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { KB_SECTIONS, KBSection } from "@/data/kbTemplates";
import { Save, RotateCcw, Copy, Download, FileText } from "lucide-react";
import { toast } from "sonner";

interface KBEntry {
  id?: string;
  section_key: string;
  title: string;
  body?: string;
  content?: string;
  order_idx: number;
}

export default function Docs() {
  const [entries, setEntries] = useState<Record<string, KBEntry>>({});
  const [activeKey, setActiveKey] = useState(KB_SECTIONS[0].key);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("imphq_kb").select("*").order("order_idx");
    const map: Record<string, KBEntry> = {};
    (data || []).forEach((d: any) => { map[d.section_key] = d; });
    setEntries(map);
  };

  useEffect(() => { load(); }, []);

  // When active section changes, load its content
  useEffect(() => {
    const entry = entries[activeKey];
    const section = KB_SECTIONS.find(s => s.key === activeKey);
    if (entry) {
      setContent(entry.body || entry.content || "");
    } else if (section) {
      setContent(section.defaultContent);
    }
    setDirty(false);
  }, [activeKey, entries]);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  const handleSave = async () => {
    setSaving(true);
    const existing = entries[activeKey];
    const section = KB_SECTIONS.find(s => s.key === activeKey)!;

    if (existing?.id) {
      const { error } = await supabase.from("imphq_kb")
        .update({ body: content, title: section.title } as any)
        .eq("id", existing.id);
      if (error) { toast.error("Erro ao salvar"); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("imphq_kb")
        .insert({
          id: crypto.randomUUID(),
          section_key: activeKey,
          title: section.title,
          body: content,
          order_idx: KB_SECTIONS.findIndex(s => s.key === activeKey),
        } as any);
      if (error) { toast.error("Erro ao salvar"); setSaving(false); return; }
    }

    toast.success("Salvo!");
    setDirty(false);
    setSaving(false);
    load();
  };

  const handleReset = () => {
    const section = KB_SECTIONS.find(s => s.key === activeKey);
    if (section) {
      setContent(section.defaultContent);
      setDirty(true);
    }
  };

  const handleExportContext = async () => {
    // Build full KB context
    let output = "# KNOWLEDGE BASE — IMPÉRIO DIGITAL\n\n";
    for (const section of KB_SECTIONS) {
      const entry = entries[section.key];
      const body = entry?.body || entry?.content || section.defaultContent;
      output += `${"=".repeat(60)}\n\n## ${section.icon} ${section.title.toUpperCase()}\n\n${"=".repeat(60)}\n\n${body}\n\n`;
    }
    await navigator.clipboard.writeText(output);
    toast.success("Knowledge Base completa copiada!");
  };

  const activeSection = KB_SECTIONS.find(s => s.key === activeKey)!;

  return (
    <div className="flex gap-0 h-[calc(100vh-7rem)] animate-fade-in">
      {/* Sidebar */}
      <div className="w-64 shrink-0 border-r border-border bg-card/50 overflow-y-auto">
        <div className="p-4 border-b border-border">
          <h2 className="font-display text-lg font-bold text-primary flex items-center gap-2">
            <FileText className="h-4 w-4" /> Knowledge Base
          </h2>
          <p className="text-[10px] text-muted-foreground mt-1">{KB_SECTIONS.length} seções</p>
        </div>
        <div className="p-2 space-y-0.5">
          {KB_SECTIONS.map((section) => {
            const hasContent = !!entries[section.key];
            return (
              <button
                key={section.key}
                onClick={() => setActiveKey(section.key)}
                className={`w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors flex items-center gap-2 ${
                  activeKey === section.key
                    ? "bg-primary/15 text-primary font-medium"
                    : "hover:bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="text-base shrink-0">{section.icon}</span>
                <span className="truncate text-xs">{section.title}</span>
                {hasContent && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />}
              </button>
            );
          })}
        </div>
        <div className="p-3 border-t border-border">
          <Button size="sm" variant="outline" className="w-full text-xs" onClick={handleExportContext}>
            <Copy className="h-3 w-3 mr-1" /> Exportar Tudo
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl">{activeSection.icon}</span>
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold truncate">{activeSection.title}</h2>
              <p className="text-xs text-muted-foreground">{activeSection.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="text-[10px]">
              {wordCount} palavras · {charCount} chars
            </Badge>
            {dirty && <Badge className="text-[10px] bg-amber-500/20 text-amber-400">Não salvo</Badge>}
            <Button size="sm" variant="outline" onClick={handleReset}>
              <RotateCcw className="h-3 w-3 mr-1" /> Resetar Padrão
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
              <Save className="h-3 w-3 mr-1" /> {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>

        {/* Textarea */}
        <div className="flex-1 p-4 overflow-hidden">
          <Textarea
            value={content}
            onChange={(e) => { setContent(e.target.value); setDirty(true); }}
            className="h-full bg-secondary/50 font-mono text-sm resize-none border-border"
            placeholder="Escreva o conteúdo desta seção..."
          />
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { KB_SECTIONS, KBSection } from "@/data/kbTemplates";
import { Save, RotateCcw, Copy, FileText, Plus, MoreHorizontal, Pencil, Trash2, ChevronDown, ChevronRight, Link2, X } from "lucide-react";
import { toast } from "sonner";

interface KBEntry {
  id?: string;
  section_key: string;
  title: string;
  body?: string;
  content?: string;
  order_idx: number;
  parent_key?: string | null;
  is_custom?: boolean;
  doc_ids?: string[] | null;
  icon?: string;
  description?: string;
}

interface DocItem {
  id: string;
  title: string;
}

// Merged section for sidebar display
interface SidebarSection {
  key: string;
  title: string;
  icon: string;
  description: string;
  isCustom: boolean;
  isTemplate: boolean;
  hasContent: boolean;
  parentKey?: string | null;
  children: SidebarSection[];
}

export default function Docs() {
  const [entries, setEntries] = useState<Record<string, KBEntry>>({});
  const [activeKey, setActiveKey] = useState(KB_SECTIONS[0].key);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Custom section CRUD
  const [showNewSection, setShowNewSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionIcon, setNewSectionIcon] = useState("📝");
  const [newSectionDesc, setNewSectionDesc] = useState("");
  const [newSectionParent, setNewSectionParent] = useState<string | null>(null);

  // Rename
  const [renameKey, setRenameKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Linked docs
  const [allDocs, setAllDocs] = useState<DocItem[]>([]);
  const [showLinkDoc, setShowLinkDoc] = useState(false);
  const [docSearch, setDocSearch] = useState("");

  // Collapsed sections
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const load = async () => {
    const [kbRes, docsRes] = await Promise.all([
      supabase.from("imphq_kb").select("*").order("order_idx"),
      supabase.from("imphq_docs").select("id, title").order("created_at", { ascending: false }),
    ]);
    const map: Record<string, KBEntry> = {};
    ((kbRes.data as any[]) || []).forEach((d) => { map[d.section_key] = d; });
    setEntries(map);
    setAllDocs((docsRes.data || []) as DocItem[]);
  };

  useEffect(() => { load(); }, []);

  // Build sidebar tree
  const sidebarSections: SidebarSection[] = (() => {
    // Start with template sections
    const templateSections: SidebarSection[] = KB_SECTIONS.map(s => ({
      key: s.key,
      title: s.title,
      icon: s.icon,
      description: s.description,
      isCustom: false,
      isTemplate: true,
      hasContent: !!entries[s.key],
      parentKey: null,
      children: [],
    }));

    // Add custom sections from DB
    const customSections: SidebarSection[] = Object.values(entries)
      .filter(e => e.is_custom)
      .map(e => ({
        key: e.section_key,
        title: e.title,
        icon: (e as any).icon || "📝",
        description: (e as any).description || "",
        isCustom: true,
        isTemplate: false,
        hasContent: !!(e.body || e.content),
        parentKey: e.parent_key || null,
        children: [],
      }));

    const allSections = [...templateSections, ...customSections];

    // Build tree
    const roots: SidebarSection[] = [];
    const byKey = new Map<string, SidebarSection>();
    allSections.forEach(s => byKey.set(s.key, s));

    allSections.forEach(s => {
      if (s.parentKey && byKey.has(s.parentKey)) {
        byKey.get(s.parentKey)!.children.push(s);
      } else {
        roots.push(s);
      }
    });

    return roots;
  })();

  const totalSections = sidebarSections.reduce((acc, s) => acc + 1 + s.children.length, 0);

  // When active section changes, load its content
  useEffect(() => {
    const entry = entries[activeKey];
    const section = KB_SECTIONS.find(s => s.key === activeKey);
    if (entry) {
      setContent(entry.body || entry.content || "");
    } else if (section) {
      setContent(section.defaultContent);
    } else {
      setContent("");
    }
    setDirty(false);
  }, [activeKey, entries]);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  // Get active section info
  const getActiveInfo = () => {
    const entry = entries[activeKey];
    const template = KB_SECTIONS.find(s => s.key === activeKey);
    if (entry?.is_custom) {
      return { title: entry.title, icon: (entry as any).icon || "📝", description: (entry as any).description || "", isCustom: true };
    }
    if (template) {
      return { title: template.title, icon: template.icon, description: template.description, isCustom: false };
    }
    return { title: activeKey, icon: "📝", description: "", isCustom: true };
  };
  const activeInfo = getActiveInfo();

  // Current doc_ids for active section
  const currentDocIds: string[] = entries[activeKey]?.doc_ids || [];
  const linkedDocs = allDocs.filter(d => currentDocIds.includes(d.id));
  const unlinkableDocs = allDocs.filter(d => !currentDocIds.includes(d.id) && d.title.toLowerCase().includes(docSearch.toLowerCase()));

  const handleSave = async () => {
    setSaving(true);
    const existing = entries[activeKey];

    if (existing?.id) {
      const { error } = await supabase.from("imphq_kb")
        .update({ body: content, title: activeInfo.title } as any)
        .eq("id", existing.id);
      if (error) { toast.error("Erro ao salvar"); setSaving(false); return; }
    } else {
      const template = KB_SECTIONS.find(s => s.key === activeKey);
      const { error } = await supabase.from("imphq_kb")
        .insert({
          id: crypto.randomUUID(),
          section_key: activeKey,
          title: template?.title || activeKey,
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
    let output = "# KNOWLEDGE BASE — IMPÉRIO DIGITAL\n\n";
    for (const section of KB_SECTIONS) {
      const entry = entries[section.key];
      const body = entry?.body || entry?.content || section.defaultContent;
      output += `${"=".repeat(60)}\n\n## ${section.icon} ${section.title.toUpperCase()}\n\n${"=".repeat(60)}\n\n${body}\n\n`;
    }
    // Also export custom sections
    Object.values(entries).filter(e => e.is_custom).forEach(e => {
      output += `${"=".repeat(60)}\n\n## ${(e as any).icon || "📝"} ${e.title.toUpperCase()}\n\n${"=".repeat(60)}\n\n${e.body || e.content || ""}\n\n`;
    });
    await navigator.clipboard.writeText(output);
    toast.success("Knowledge Base completa copiada!");
  };

  // Create custom section
  const handleCreateSection = async () => {
    if (!newSectionTitle.trim()) return;
    const key = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const { error } = await supabase.from("imphq_kb").insert({
      id: crypto.randomUUID(),
      section_key: key,
      title: newSectionTitle.trim(),
      body: "",
      order_idx: totalSections,
      is_custom: true,
      parent_key: newSectionParent || null,
      icon: newSectionIcon,
      description: newSectionDesc.trim() || null,
    } as any);
    if (error) { toast.error("Erro ao criar seção"); return; }
    toast.success("Seção criada!");
    setShowNewSection(false);
    setNewSectionTitle("");
    setNewSectionIcon("📝");
    setNewSectionDesc("");
    setNewSectionParent(null);
    await load();
    setActiveKey(key);
  };

  // Delete custom section
  const handleDeleteSection = async (key: string) => {
    const entry = entries[key];
    if (!entry?.id) return;
    if (!confirm("Excluir esta seção?")) return;
    await supabase.from("imphq_kb").delete().eq("id", entry.id);
    // Also delete children
    const childKeys = Object.values(entries).filter(e => e.parent_key === key);
    for (const child of childKeys) {
      if (child.id) await supabase.from("imphq_kb").delete().eq("id", child.id);
    }
    toast.success("Seção excluída");
    if (activeKey === key) setActiveKey(KB_SECTIONS[0].key);
    load();
  };

  // Rename custom section
  const handleRename = async () => {
    if (!renameKey || !renameValue.trim()) return;
    const entry = entries[renameKey];
    if (!entry?.id) return;
    await supabase.from("imphq_kb").update({ title: renameValue.trim() } as any).eq("id", entry.id);
    toast.success("Renomeada!");
    setRenameKey(null);
    load();
  };

  // Link/unlink docs
  const handleLinkDoc = async (docId: string) => {
    const newIds = [...currentDocIds, docId];
    const entry = entries[activeKey];
    if (entry?.id) {
      await supabase.from("imphq_kb").update({ doc_ids: newIds } as any).eq("id", entry.id);
    } else {
      // Need to create the entry first
      const template = KB_SECTIONS.find(s => s.key === activeKey);
      await supabase.from("imphq_kb").insert({
        id: crypto.randomUUID(),
        section_key: activeKey,
        title: template?.title || activeKey,
        body: content,
        order_idx: KB_SECTIONS.findIndex(s => s.key === activeKey),
        doc_ids: newIds,
      } as any);
    }
    toast.success("Documento vinculado");
    load();
  };

  const handleUnlinkDoc = async (docId: string) => {
    const newIds = currentDocIds.filter(id => id !== docId);
    const entry = entries[activeKey];
    if (entry?.id) {
      await supabase.from("imphq_kb").update({ doc_ids: newIds } as any).eq("id", entry.id);
    }
    toast.success("Documento desvinculado");
    load();
  };

  const toggleCollapsed = (key: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const EMOJI_OPTIONS = ["📝", "📋", "🎯", "🚀", "🔥", "💡", "🛠", "📊", "🧠", "⚡", "🎨", "📣", "🛡", "🗣", "📡", "🏛", "✍️", "🤖", "🎭", "📦"];

  // Render sidebar section
  const renderSidebarItem = (section: SidebarSection, depth: number = 0) => {
    const isActive = activeKey === section.key;
    const hasChildren = section.children.length > 0;
    const isOpen = !collapsed.has(section.key);

    return (
      <div key={section.key}>
        <div className="flex items-center group/item">
          {hasChildren && (
            <button onClick={() => toggleCollapsed(section.key)} className="h-5 w-5 flex items-center justify-center shrink-0 hover:bg-muted rounded">
              {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          )}
          <button
            onClick={() => setActiveKey(section.key)}
            className={`flex-1 text-left px-2 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${
              isActive
                ? "bg-primary/15 text-primary font-medium"
                : "hover:bg-secondary text-muted-foreground hover:text-foreground"
            }`}
            style={{ paddingLeft: `${(depth * 12) + (hasChildren ? 0 : 20)}px` }}
          >
            <span className="text-base shrink-0">{section.icon}</span>
            <span className="truncate text-xs">{section.title}</span>
            {section.hasContent && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />}
          </button>
          {/* Context menu */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0">
                <MoreHorizontal className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-40 p-1" align="end">
              <button
                className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted flex items-center gap-2"
                onClick={() => { setNewSectionParent(section.key); setShowNewSection(true); }}
              >
                <Plus className="h-3 w-3" /> Criar Subseção
              </button>
              {section.isCustom && (
                <>
                  <button
                    className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted flex items-center gap-2"
                    onClick={() => { setRenameKey(section.key); setRenameValue(section.title); }}
                  >
                    <Pencil className="h-3 w-3" /> Renomear
                  </button>
                  <button
                    className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-destructive/10 text-destructive flex items-center gap-2"
                    onClick={() => handleDeleteSection(section.key)}
                  >
                    <Trash2 className="h-3 w-3" /> Excluir
                  </button>
                </>
              )}
            </PopoverContent>
          </Popover>
        </div>
        {hasChildren && isOpen && (
          <div className="ml-1">
            {section.children.map(child => renderSidebarItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex gap-0 h-[calc(100vh-7rem)] animate-fade-in">
      {/* Sidebar */}
      <div className="w-64 shrink-0 border-r border-border bg-card/50 overflow-y-auto">
        <div className="p-4 border-b border-border">
          <h2 className="font-display text-lg font-bold text-primary flex items-center gap-2">
            <FileText className="h-4 w-4" /> Knowledge Base <SectionInfo {...sectionHelpTexts.docs} />
          </h2>
          <p className="text-[10px] text-muted-foreground mt-1">{totalSections} seções</p>
        </div>
        <div className="p-2 space-y-0.5">
          {sidebarSections.map(s => renderSidebarItem(s))}
        </div>
        <div className="p-3 space-y-2 border-t border-border">
          <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => { setNewSectionParent(null); setShowNewSection(true); }}>
            <Plus className="h-3 w-3 mr-1" /> Nova Seção
          </Button>
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
            <span className="text-2xl">{activeInfo.icon}</span>
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold truncate">{activeInfo.title}</h2>
              <p className="text-xs text-muted-foreground">{activeInfo.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="text-[10px]">
              {wordCount} palavras · {charCount} chars
            </Badge>
            {dirty && <Badge className="text-[10px] bg-amber-500/20 text-amber-400">Não salvo</Badge>}
            {!activeInfo.isCustom && (
              <Button size="sm" variant="outline" onClick={handleReset}>
                <RotateCcw className="h-3 w-3 mr-1" /> Resetar Padrão
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
              <Save className="h-3 w-3 mr-1" /> {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>

        {/* Textarea */}
        <div className="flex-1 p-4 overflow-hidden flex flex-col gap-3">
          <Textarea
            value={content}
            onChange={(e) => { setContent(e.target.value); setDirty(true); }}
            className="flex-1 bg-secondary/50 font-mono text-sm resize-none border-border"
            placeholder="Escreva o conteúdo desta seção..."
          />

          {/* Linked Documents */}
          <div className="border border-border rounded-md p-3 space-y-2 shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                <Link2 className="h-3 w-3" /> Documentos Vinculados
              </h3>
              <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => { setShowLinkDoc(true); setDocSearch(""); }}>
                <Plus className="h-3 w-3 mr-1" /> Vincular
              </Button>
            </div>
            {linkedDocs.length === 0 ? (
              <p className="text-[10px] text-muted-foreground/60 italic">Nenhum documento vinculado</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {linkedDocs.map(doc => (
                  <Badge key={doc.id} variant="secondary" className="text-[10px] gap-1 pr-1">
                    <FileText className="h-2.5 w-2.5" /> {doc.title}
                    <button onClick={() => handleUnlinkDoc(doc.id)} className="ml-0.5 h-3 w-3 flex items-center justify-center rounded hover:bg-destructive/20">
                      <X className="h-2 w-2" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Section Dialog */}
      <Dialog open={showNewSection} onOpenChange={setShowNewSection}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{newSectionParent ? "Nova Subseção" : "Nova Seção"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Ícone</label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {EMOJI_OPTIONS.map(e => (
                  <button
                    key={e}
                    onClick={() => setNewSectionIcon(e)}
                    className={`h-8 w-8 rounded flex items-center justify-center text-lg hover:bg-muted ${newSectionIcon === e ? "bg-primary/20 ring-1 ring-primary" : ""}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Título</label>
              <Input value={newSectionTitle} onChange={e => setNewSectionTitle(e.target.value)} placeholder="Nome da seção" className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Descrição (opcional)</label>
              <Input value={newSectionDesc} onChange={e => setNewSectionDesc(e.target.value)} placeholder="Breve descrição..." className="mt-1" />
            </div>
            {newSectionParent && (
              <p className="text-[10px] text-muted-foreground">
                Será criada como subseção de: <strong>{entries[newSectionParent]?.title || KB_SECTIONS.find(s => s.key === newSectionParent)?.title || newSectionParent}</strong>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleCreateSection} disabled={!newSectionTitle.trim()}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renameKey} onOpenChange={() => setRenameKey(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Renomear Seção</DialogTitle></DialogHeader>
          <Input value={renameValue} onChange={e => setRenameValue(e.target.value)} placeholder="Novo nome" />
          <DialogFooter><Button onClick={handleRename}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Doc Dialog */}
      <Dialog open={showLinkDoc} onOpenChange={setShowLinkDoc}>
        <DialogContent>
          <DialogHeader><DialogTitle>Vincular Documento</DialogTitle></DialogHeader>
          <Input value={docSearch} onChange={e => setDocSearch(e.target.value)} placeholder="Buscar documento..." />
          <div className="max-h-[200px] overflow-y-auto space-y-1 mt-2">
            {unlinkableDocs.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum documento disponível</p>
            ) : (
              unlinkableDocs.map(doc => (
                <button
                  key={doc.id}
                  onClick={() => { handleLinkDoc(doc.id); setShowLinkDoc(false); }}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-muted text-sm flex items-center gap-2"
                >
                  <FileText className="h-3.5 w-3.5 text-primary" /> {doc.title}
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

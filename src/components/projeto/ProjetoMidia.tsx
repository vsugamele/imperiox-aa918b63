import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Plus, Trash2, Image, Upload, Loader2, Video, FileText, Music, Eye, X, CalendarIcon, Paperclip, FolderOpen, FolderPlus, ChevronRight, Home, Wand2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUpload } from "@/components/FileUpload";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { ReferenciasDoProjetoSection } from "./ReferenciasDoProjetoSection";

const PHOTO_CATEGORIES = [
  { key: "expert", label: "📸 Fotos do Expert" },
  { key: "produtos", label: "📦 Fotos dos Produtos" },
  { key: "complementar", label: "🖼️ Imagens Complementares" },
];

const CONTENT_TABS = [
  { key: "fotos", label: "📸 Fotos", icon: Image },
  { key: "reels", label: "🎬 Reels", icon: Video },
  { key: "stories", label: "📱 Stories", icon: Image },
  { key: "anuncios", label: "📣 Anúncios", icon: Video },
  { key: "feed", label: "📰 Feed", icon: Image },
  { key: "todos", label: "📂 Todos", icon: FileText },
];

const FILE_TYPE_ICONS: Record<string, any> = { image: Image, video: Video, document: FileText, audio: Music };
const FILE_TYPE_LABELS: Record<string, string> = { image: "Imagem", video: "Vídeo", document: "Documento", audio: "Áudio" };

interface ContentItem {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  file_url: string;
  file_type: string;
  thumbnail_url: string | null;
  tags: string[] | null;
  description: string | null;
  size_bytes: number | null;
  content_category: string | null;
  publish_date: string | null;
  created_at: string;
}

interface Props {
  project: any;
  onUpdateData: (data: any) => void;
}

export function ProjetoMidia({ project, onUpdateData }: Props) {
  const data = project.data || {};
  const midia = data.midia || {};
  const [newUrl, setNewUrl] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState("fotos");

  // Content library state
  const [items, setItems] = useState<ContentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [previewItem, setPreviewItem] = useState<ContentItem | null>(null);
  const [editDialog, setEditDialog] = useState(false);
  const [editItem, setEditItem] = useState<ContentItem | null>(null);
  const [tagInput, setTagInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Folder system state
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);

  // Task attachments state
  const [taskAttachments, setTaskAttachments] = useState<any[]>([]);
  // AI edit state
  const [aiEditDialog, setAiEditDialog] = useState(false);
  const [aiEditItem, setAiEditItem] = useState<ContentItem | null>(null);
  const [aiEditInstruction, setAiEditInstruction] = useState("");
  const [aiEditing, setAiEditing] = useState(false);

  const projectId = project.id;

  const loadItems = useCallback(async () => {
    const { data } = await supabase
      .from("imphq_content_library")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setItems((data as ContentItem[]) || []);
  }, [projectId]);

  const loadTaskAttachments = useCallback(async () => {
    // Get cards linked to this project, then their attachments
    const { data: cards } = await supabase
      .from("imphq_kanban_cards")
      .select("id, title")
      .eq("project_id", projectId);
    if (!cards || cards.length === 0) { setTaskAttachments([]); return; }
    const cardIds = cards.map(c => c.id);
    const cardMap = new Map(cards.map(c => [c.id, c.title]));
    const { data: attachments } = await supabase
      .from("imphq_card_attachments")
      .select("*")
      .in("card_id", cardIds)
      .order("created_at", { ascending: false });
    setTaskAttachments((attachments || []).map(a => ({ ...a, card_title: cardMap.get(a.card_id) || "?" })));
  }, [projectId]);

  useEffect(() => { loadItems(); loadTaskAttachments(); }, [loadItems, loadTaskAttachments]);

  // Photo functions
  const addImage = (cat: string, url?: string) => {
    const finalUrl = url || newUrl[cat]?.trim();
    if (!finalUrl) return;
    const current = midia[cat] || [];
    onUpdateData({ ...data, midia: { ...midia, [cat]: [...current, finalUrl] } });
    if (!url) setNewUrl({ ...newUrl, [cat]: "" });
  };

  const addImagesMultiple = (cat: string, urls: string[]) => {
    const current = midia[cat] || [];
    onUpdateData({ ...data, midia: { ...midia, [cat]: [...current, ...urls] } });
  };

  const removeImage = (cat: string, i: number) => {
    const current = midia[cat] || [];
    onUpdateData({ ...data, midia: { ...midia, [cat]: current.filter((_: string, j: number) => j !== i) } });
  };

  // Content functions
  const detectFileType = (file: File): string => {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    if (file.type.startsWith("audio/")) return "audio";
    return "document";
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setUploading(true);
    const baseCategory = activeTab === "todos" ? "geral" : activeTab;
    const category = currentFolder ? `${baseCategory}/${currentFolder}` : baseCategory;
    let uploaded = 0;

    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop();
      const filePath = `${user.id}/${projectId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("project-content").upload(filePath, file, { upsert: true });
      if (uploadError) { toast.error(`Erro: ${file.name}`); continue; }
      const { data: urlData } = supabase.storage.from("project-content").getPublicUrl(filePath);

      const { error: insertError } = await supabase.from("imphq_content_library").insert({
        project_id: projectId,
        user_id: user.id,
        title: file.name.replace(/\.[^.]+$/, ""),
        file_url: urlData.publicUrl,
        file_type: detectFileType(file),
        size_bytes: file.size,
        tags: [],
        content_category: category,
      });
      if (!insertError) uploaded++;
    }
    toast.success(`${uploaded} arquivo(s) enviado(s)`);
    setUploading(false);
    loadItems();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const deleteItem = async (item: ContentItem) => {
    await supabase.from("imphq_content_library").delete().eq("id", item.id);
    toast.success("Removido");
    loadItems();
  };

  const updateItem = async () => {
    if (!editItem) return;
    await supabase.from("imphq_content_library").update({
      title: editItem.title,
      description: editItem.description,
      tags: editItem.tags,
      content_category: editItem.content_category,
      publish_date: editItem.publish_date,
    }).eq("id", editItem.id);
    toast.success("Atualizado");
    setEditDialog(false);
    loadItems();
  };

  const addTag = () => {
    if (!tagInput.trim() || !editItem) return;
    setEditItem({ ...editItem, tags: [...(editItem.tags || []), tagInput.trim()] });
    setTagInput("");
  };

  const removeTag = (idx: number) => {
    if (!editItem) return;
    setEditItem({ ...editItem, tags: (editItem.tags || []).filter((_, i) => i !== idx) });
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  // Extract folders from content_category patterns like "reels/folder-name"
  // Includes empty folders via placeholder rows (file_type='folder').
  const getFoldersForTab = (tab: string): string[] => {
    const relevant = tab === "todos" ? items : items.filter(i => (i.content_category || "geral").startsWith(tab));
    const folders = new Set<string>();
    relevant.forEach(item => {
      const cat = item.content_category || "geral";
      const parts = cat.split("/");
      if (parts.length > 1) folders.add(parts[1]);
    });
    return Array.from(folders).sort();
  };

  const getFilteredItems = (tab: string) => {
    // Hide folder placeholders from the grid — they only exist so empty folders persist
    const visible = items.filter(i => i.file_type !== "folder");
    if (tab === "todos") {
      if (currentFolder) return visible.filter(i => (i.content_category || "").includes(`/${currentFolder}`));
      return visible;
    }
    if (currentFolder) {
      return visible.filter(i => (i.content_category || "geral") === `${tab}/${currentFolder}`);
    }
    return visible.filter(i => {
      const cat = i.content_category || "geral";
      return cat === tab || cat.startsWith(`${tab}/`);
    });
  };

  const createFolder = async () => {
    const name = newFolderName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");
    if (!name) return;
    const baseCategory = activeTab === "todos" ? "geral" : activeTab;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Faça login"); return; }
    const { error } = await supabase.from("imphq_content_library").insert({
      project_id: projectId,
      user_id: user.id,
      title: "__folder__",
      file_url: "folder://placeholder",
      file_type: "folder",
      content_category: `${baseCategory}/${name}`,
      tags: [],
    });
    if (error) { toast.error("Erro ao criar pasta"); return; }
    setCurrentFolder(name);
    setNewFolderName("");
    setFolderDialogOpen(false);
    toast.success(`Pasta "${name}" criada em ${baseCategory}.`);
    loadItems();
  };

  const moveItemToFolder = async (itemId: string, folder: string | null) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const baseCat = (item.content_category || "geral").split("/")[0];
    const newCat = folder ? `${baseCat}/${folder}` : baseCat;
    await supabase.from("imphq_content_library").update({ content_category: newCat }).eq("id", itemId);
    loadItems();
    toast.success("Arquivo movido");
  };

  const handleAiEdit = async () => {
    if (!aiEditItem || !aiEditInstruction.trim()) return;
    setAiEditing(true);
    try {
      const { data: aiData, error } = await supabase.functions.invoke("openflow-ai", {
        body: {
          project_id: projectId,
          action: "edit_image",
          source_image_url: aiEditItem.file_url,
          instruction: aiEditInstruction,
        },
      });
      if (error) throw error;
      if (aiData?.image_url) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("imphq_content_library").insert({
            project_id: projectId,
            user_id: user.id,
            title: `${aiEditItem.title} (editado IA)`,
            file_url: aiData.image_url,
            file_type: "image",
            tags: [...(aiEditItem.tags || []), "ia-editado"],
            content_category: aiEditItem.content_category,
          });
        }
        toast.success("Imagem editada e salva!");
        loadItems();
        setAiEditDialog(false);
        setAiEditInstruction("");
      } else throw new Error(aiData?.error || "Erro ao editar");
    } catch (err: any) { toast.error(err.message || "Erro ao editar imagem"); }
    finally { setAiEditing(false); }
  };

  return (
    <div className="space-y-4">
      <ReferenciasDoProjetoSection projectId={projectId} />
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-secondary flex-wrap h-auto gap-1 p-1">
          {CONTENT_TABS.map(t => (
            <TabsTrigger key={t.key} value={t.key} className="text-xs gap-1">
              {t.label}
              {t.key !== "fotos" && (
                <span className="text-[9px] text-muted-foreground ml-0.5">
                  ({getFilteredItems(t.key).length})
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Fotos Tab - original photos */}
        <TabsContent value="fotos" className="mt-4 space-y-6">
          {PHOTO_CATEGORIES.map((c) => (
            <Card key={c.key} className="bg-card border-border">
              <CardHeader><CardTitle className="text-sm uppercase tracking-wider text-primary font-sans">{c.label}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(midia[c.key] || []).map((url: string, i: number) => (
                    <div key={i} className="relative group aspect-square rounded-md overflow-hidden border border-border bg-secondary">
                      <img src={url} alt="" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
                      <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button size="icon" variant="ghost" className="h-8 w-8 bg-card/80" onClick={() => window.open(url, "_blank")}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 bg-card/80" onClick={() => {
                          const a = document.createElement("a");
                          a.href = url; a.download = `foto-${c.key}-${i}`; a.target = "_blank";
                          a.click();
                        }}>
                          <Upload className="h-4 w-4 rotate-180" />
                        </Button>
                        <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => removeImage(c.key, i)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {(midia[c.key] || []).length === 0 && (
                    <div className="aspect-square rounded-md border border-dashed border-border flex items-center justify-center text-muted-foreground">
                      <Image className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <div className="flex gap-2 items-center">
                  <Input
                    value={newUrl[c.key] || ""}
                    onChange={(e) => setNewUrl({ ...newUrl, [c.key]: e.target.value })}
                    placeholder="Cole a URL da imagem..."
                    className="bg-secondary"
                    onKeyDown={(e) => e.key === "Enter" && addImage(c.key)}
                  />
                  <Button size="sm" variant="outline" onClick={() => addImage(c.key)}><Plus className="h-3 w-3" /></Button>
                  <FileUpload
                    bucket="project-media"
                    path={`${project.id}/${c.key}`}
                    onUpload={(url) => addImage(c.key, url)}
                    onUploadMultiple={(urls) => addImagesMultiple(c.key, urls)}
                    multiple
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Content category tabs */}
        {CONTENT_TABS.filter(t => t.key !== "fotos").map(tab => {
          const folders = getFoldersForTab(tab.key);
          return (
            <TabsContent key={tab.key} value={tab.key} className="mt-4 space-y-3">
              {/* Folder breadcrumb + controls */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Button size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs" onClick={() => setCurrentFolder(null)}>
                    <Home className="h-3 w-3" /> Raiz
                  </Button>
                  {currentFolder && (
                    <>
                      <ChevronRight className="h-3 w-3" />
                      <Badge variant="secondary" className="text-xs gap-1">
                        <FolderOpen className="h-3 w-3" /> {currentFolder}
                        <X className="h-2.5 w-2.5 cursor-pointer" onClick={() => setCurrentFolder(null)} />
                      </Badge>
                    </>
                  )}
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setFolderDialogOpen(true)}>
                  <FolderPlus className="h-3 w-3" /> Nova Pasta
                </Button>
              </div>

              {/* Folder cards */}
              {!currentFolder && folders.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {folders.map(folder => {
                    const count = items.filter(i => (i.content_category || "").includes(`/${folder}`)).length;
                    return (
                      <div
                        key={folder}
                        className="flex flex-col items-center gap-1 p-3 rounded-lg border border-border bg-secondary/30 hover:border-primary/40 cursor-pointer transition-colors"
                        onClick={() => setCurrentFolder(folder)}
                      >
                        <FolderOpen className="h-8 w-8 text-primary/70" />
                        <span className="text-xs font-medium truncate w-full text-center">{folder}</span>
                        <span className="text-[9px] text-muted-foreground">{count} arquivo(s)</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <ContentGrid
                items={getFilteredItems(tab.key)}
                uploading={uploading}
                fileInputRef={fileInputRef}
                onUpload={handleUpload}
                onDelete={deleteItem}
                onEdit={(item) => { setEditItem(item); setEditDialog(true); }}
                onPreview={setPreviewItem}
                onAiEdit={(item) => { setAiEditItem(item); setAiEditDialog(true); }}
              />
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Task Attachments */}
      {taskAttachments.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wider text-primary font-sans flex items-center gap-2">
              <Paperclip className="h-4 w-4" /> Anexos de Tarefas ({taskAttachments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {taskAttachments.map((a: any) => {
                const isImg = a.file_type?.startsWith("image");
                return (
                  <div key={a.id} className="relative rounded-lg border border-border bg-secondary/30 overflow-hidden group">
                    {isImg ? (
                      <div className="aspect-square">
                        <img src={a.file_url} alt={a.file_name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="aspect-square flex items-center justify-center">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="p-1.5">
                      <p className="text-[10px] font-medium truncate">{a.file_name}</p>
                      <p className="text-[9px] text-muted-foreground truncate">📌 {a.card_title}</p>
                    </div>
                    <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button size="icon" variant="ghost" className="h-8 w-8 bg-card/80" onClick={() => window.open(a.file_url, "_blank")}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewItem} onOpenChange={() => setPreviewItem(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{previewItem?.title}</DialogTitle></DialogHeader>
          {previewItem?.file_type === "image" && <img src={previewItem.file_url} alt={previewItem.title} className="w-full rounded-lg" />}
          {previewItem?.file_type === "video" && <video src={previewItem.file_url} controls className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar Conteúdo</DialogTitle></DialogHeader>
          {editItem && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Título</Label>
                <Input value={editItem.title} onChange={e => setEditItem({ ...editItem, title: e.target.value })} className="bg-secondary" />
              </div>
              <div>
                <Label className="text-xs">Descrição</Label>
                <Textarea value={editItem.description || ""} onChange={e => setEditItem({ ...editItem, description: e.target.value })} className="bg-secondary min-h-[60px]" />
              </div>
              <div>
                <Label className="text-xs">Categoria</Label>
                <div className="flex gap-1 flex-wrap mt-1">
                  {["reels", "stories", "anuncios", "feed", "geral"].map(cat => {
                    const baseCat = (editItem.content_category || "geral").split("/")[0];
                    return (
                      <Badge
                        key={cat}
                        variant={baseCat === cat ? "default" : "outline"}
                        className="cursor-pointer text-xs capitalize"
                        onClick={() => {
                          const folder = (editItem.content_category || "").split("/")[1];
                          setEditItem({ ...editItem, content_category: folder ? `${cat}/${folder}` : cat });
                        }}
                      >
                        {cat}
                      </Badge>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label className="text-xs">Pasta</Label>
                <div className="flex gap-2 items-center mt-1">
                  <Select
                    value={(editItem.content_category || "").split("/")[1] || "__root__"}
                    onValueChange={(v) => {
                      const baseCat = (editItem.content_category || "geral").split("/")[0];
                      setEditItem({ ...editItem, content_category: v === "__root__" ? baseCat : `${baseCat}/${v}` });
                    }}
                  >
                    <SelectTrigger className="bg-secondary h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__root__">📁 Raiz (sem pasta)</SelectItem>
                      {getFoldersForTab("todos").map(f => (
                        <SelectItem key={f} value={f}>📂 {f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Data de Publicação</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9", !editItem.publish_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {editItem.publish_date ? format(new Date(editItem.publish_date + "T12:00:00"), "dd/MM/yyyy") : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editItem.publish_date ? new Date(editItem.publish_date + "T12:00:00") : undefined}
                      onSelect={(d) => setEditItem({ ...editItem, publish_date: d ? format(d, "yyyy-MM-dd") : null })}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-xs">Tags</Label>
                <div className="flex gap-1 flex-wrap mb-1">
                  {(editItem.tags || []).map((tag, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px] gap-1">
                      {tag} <X className="h-2.5 w-2.5 cursor-pointer" onClick={() => removeTag(i)} />
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-1">
                  <Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag())} className="bg-secondary text-xs h-7" placeholder="Nova tag..." />
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addTag}><Plus className="h-3 w-3" /></Button>
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground">
                <p>Tamanho: {formatSize(editItem.size_bytes)}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>Cancelar</Button>
            <Button onClick={updateItem}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Folder Dialog */}
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FolderPlus className="h-4 w-4" /> Nova Pasta</DialogTitle></DialogHeader>
          <div>
            <Label className="text-xs">Nome da pasta</Label>
            <Input
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              placeholder="Ex: campanha-abril, semana-1..."
              className="bg-secondary mt-1"
              onKeyDown={e => e.key === "Enter" && createFolder()}
            />
            <p className="text-[10px] text-muted-foreground mt-1">Letras minúsculas, números e hifens.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setFolderDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={createFolder} disabled={!newFolderName.trim()}>Criar Pasta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* AI Edit Dialog */}
      <Dialog open={aiEditDialog} onOpenChange={setAiEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Wand2 className="h-5 w-5 text-primary" /> Editar com IA</DialogTitle>
            <DialogDescription>Descreva a alteração desejada na imagem.</DialogDescription>
          </DialogHeader>
          {aiEditItem && (
            <div className="space-y-3">
              <img src={aiEditItem.file_url} alt={aiEditItem.title} className="w-full max-h-[200px] object-contain rounded-lg border border-border" />
              <Textarea value={aiEditInstruction} onChange={e => setAiEditInstruction(e.target.value)}
                placeholder='Ex: "Adicione texto OFERTA em vermelho", "Mude o fundo para azul escuro", "Remova o background"'
                className="min-h-[80px] bg-secondary text-sm" />
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setAiEditDialog(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleAiEdit} disabled={aiEditing || !aiEditInstruction.trim()} className="gap-1.5">
              {aiEditing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              {aiEditing ? "Editando..." : "Editar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Content Grid Sub-component ── */
function ContentGrid({ items, uploading, fileInputRef, onUpload, onDelete, onEdit, onPreview, onAiEdit }: {
  items: ContentItem[];
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: (item: ContentItem) => void;
  onEdit: (item: ContentItem) => void;
  onPreview: (item: ContentItem) => void;
  onAiEdit?: (item: ContentItem) => void;
}) {
  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.md" onChange={onUpload} className="hidden" />
        <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-1">
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          Upload
        </Button>
      </div>

      {items.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <Image className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum conteúdo nesta categoria</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3 w-3 mr-1" /> Fazer upload
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {items.map(item => {
            const Icon = FILE_TYPE_ICONS[item.file_type] || FileText;
            const isImage = item.file_type === "image";
            const isVideo = item.file_type === "video";

            return (
              <div key={item.id} className="group relative rounded-lg border border-border bg-secondary/30 overflow-hidden hover:border-primary/30 transition-colors">
                <div className="aspect-square relative bg-secondary flex items-center justify-center cursor-pointer" onClick={() => isImage || isVideo ? onPreview(item) : window.open(item.file_url, "_blank")}>
                  {isImage ? (
                    <img src={item.file_url} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : isVideo ? (
                    <video src={item.file_url} className="w-full h-full object-cover" muted />
                  ) : (
                    <Icon className="h-10 w-10 text-muted-foreground" />
                  )}
                  <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onEdit(item); }}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {isImage && onAiEdit && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onAiEdit(item); }} title="Editar com IA">
                        <Wand2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(item); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium truncate">{item.title}</p>
                  <div className="flex items-center justify-between mt-1">
                    <Badge variant="outline" className="text-[9px] px-1 py-0">{FILE_TYPE_LABELS[item.file_type] || "Arquivo"}</Badge>
                    <span className="text-[9px] text-muted-foreground font-mono">{formatSize(item.size_bytes)}</span>
                  </div>
                  {item.publish_date && (
                    <p className="text-[9px] text-primary mt-1 flex items-center gap-0.5">
                      <CalendarIcon className="h-2.5 w-2.5" />
                      {format(new Date(item.publish_date + "T12:00:00"), "dd/MM/yyyy")}
                    </p>
                  )}
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex gap-0.5 mt-1 flex-wrap">
                      {item.tags.slice(0, 3).map((tag, i) => (
                        <span key={i} className="text-[8px] bg-primary/10 text-primary px-1 rounded">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Trash2, Loader2, Image, Video, FileText, Music, Eye, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  created_at: string;
}

const FILE_TYPE_ICONS: Record<string, any> = {
  image: Image,
  video: Video,
  document: FileText,
  audio: Music,
};

const FILE_TYPE_LABELS: Record<string, string> = {
  image: "Imagem",
  video: "Vídeo",
  document: "Documento",
  audio: "Áudio",
};

interface Props {
  projectId: string;
}

export function ProjetoConteudo({ projectId }: Props) {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [filterType, setFilterType] = useState("all");
  const [uploading, setUploading] = useState(false);
  const [previewItem, setPreviewItem] = useState<ContentItem | null>(null);
  const [editDialog, setEditDialog] = useState(false);
  const [editItem, setEditItem] = useState<ContentItem | null>(null);
  const [tagInput, setTagInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadItems = useCallback(async () => {
    const { data } = await supabase
      .from("imphq_content_library")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setItems((data as ContentItem[]) || []);
  }, [projectId]);

  useEffect(() => { loadItems(); }, [loadItems]);

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
    let uploaded = 0;

    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop();
      const filePath = `${user.id}/${projectId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage.from("project-content").upload(filePath, file, { upsert: true });
      if (uploadError) { toast.error(`Erro no upload: ${file.name}`); continue; }

      const { data: urlData } = supabase.storage.from("project-content").getPublicUrl(filePath);
      const fileType = detectFileType(file);

      const { error: insertError } = await supabase.from("imphq_content_library").insert({
        project_id: projectId,
        user_id: user.id,
        title: file.name.replace(/\.[^.]+$/, ""),
        file_url: urlData.publicUrl,
        file_type: fileType,
        size_bytes: file.size,
        tags: [],
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
    toast.success("Conteúdo removido");
    loadItems();
  };

  const updateItem = async () => {
    if (!editItem) return;
    await supabase.from("imphq_content_library").update({
      title: editItem.title,
      description: editItem.description,
      tags: editItem.tags,
    }).eq("id", editItem.id);
    toast.success("Atualizado");
    setEditDialog(false);
    loadItems();
  };

  const addTag = () => {
    if (!tagInput.trim() || !editItem) return;
    const tags = [...(editItem.tags || []), tagInput.trim()];
    setEditItem({ ...editItem, tags });
    setTagInput("");
  };

  const removeTag = (idx: number) => {
    if (!editItem) return;
    const tags = (editItem.tags || []).filter((_, i) => i !== idx);
    setEditItem({ ...editItem, tags });
  };

  const filtered = items.filter(i => filterType === "all" || i.file_type === filterType);

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 flex-wrap">
          <Badge variant={filterType === "all" ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => setFilterType("all")}>
            Todos ({items.length})
          </Badge>
          {Object.entries(FILE_TYPE_LABELS).map(([key, label]) => {
            const count = items.filter(i => i.file_type === key).length;
            if (count === 0) return null;
            const Icon = FILE_TYPE_ICONS[key];
            return (
              <Badge key={key} variant={filterType === key ? "default" : "outline"} className="cursor-pointer text-xs gap-1" onClick={() => setFilterType(key)}>
                <Icon className="h-3 w-3" /> {label} ({count})
              </Badge>
            );
          })}
        </div>
        <div>
          <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.md" onChange={handleUpload} className="hidden" />
          <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-1">
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            Upload
          </Button>
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <Image className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum conteúdo ainda</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3 w-3 mr-1" /> Fazer upload
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map(item => {
            const Icon = FILE_TYPE_ICONS[item.file_type] || FileText;
            const isImage = item.file_type === "image";
            const isVideo = item.file_type === "video";

            return (
              <div key={item.id} className="group relative rounded-lg border border-border bg-secondary/30 overflow-hidden hover:border-primary/30 transition-colors">
                {/* Preview */}
                <div className="aspect-square relative bg-secondary flex items-center justify-center cursor-pointer" onClick={() => isImage || isVideo ? setPreviewItem(item) : window.open(item.file_url, "_blank")}>
                  {isImage ? (
                    <img src={item.file_url} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : isVideo ? (
                    <video src={item.file_url} className="w-full h-full object-cover" muted />
                  ) : (
                    <Icon className="h-10 w-10 text-muted-foreground" />
                  )}
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setEditItem(item); setEditDialog(true); }}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); deleteItem(item); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {/* Info */}
                <div className="p-2">
                  <p className="text-xs font-medium truncate">{item.title}</p>
                  <div className="flex items-center justify-between mt-1">
                    <Badge variant="outline" className="text-[9px] px-1 py-0">{FILE_TYPE_LABELS[item.file_type]}</Badge>
                    <span className="text-[9px] text-muted-foreground font-mono">{formatSize(item.size_bytes)}</span>
                  </div>
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

      {/* Preview Dialog */}
      <Dialog open={!!previewItem} onOpenChange={() => setPreviewItem(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewItem?.title}</DialogTitle>
          </DialogHeader>
          {previewItem?.file_type === "image" && (
            <img src={previewItem.file_url} alt={previewItem.title} className="w-full rounded-lg" />
          )}
          {previewItem?.file_type === "video" && (
            <video src={previewItem.file_url} controls className="w-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Conteúdo</DialogTitle>
          </DialogHeader>
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
                <Label className="text-xs">Tags</Label>
                <div className="flex gap-1 flex-wrap mb-1">
                  {(editItem.tags || []).map((tag, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px] gap-1">
                      {tag}
                      <X className="h-2.5 w-2.5 cursor-pointer" onClick={() => removeTag(i)} />
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-1">
                  <Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag())} className="bg-secondary text-xs h-7" placeholder="Nova tag..." />
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addTag}><Plus className="h-3 w-3" /></Button>
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground">
                <p>URL: <a href={editItem.file_url} target="_blank" className="text-primary hover:underline">{editItem.file_url.slice(0, 60)}...</a></p>
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
    </div>
  );
}

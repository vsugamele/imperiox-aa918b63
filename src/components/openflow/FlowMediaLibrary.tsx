import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Upload, Trash2, Copy, Image as ImageIcon, Mic, Video, FileText, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

export type FlowMedia = {
  id: string;
  project_id: string | null;
  kind: "audio" | "image" | "video" | "doc";
  label: string;
  url: string;
  storage_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  duration_ms: number | null;
  transcript: string | null;
  tags: string[] | null;
  created_at: string;
};

const kindIcon = {
  audio: Mic,
  image: ImageIcon,
  video: Video,
  doc: FileText,
};

const kindFromMime = (mime: string): FlowMedia["kind"] => {
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "doc";
};

interface Props {
  projects: { id: string; name: string }[];
  selectMode?: boolean;
  filterKind?: FlowMedia["kind"];
  onSelect?: (m: FlowMedia) => void;
}

export function FlowMediaLibrary({ projects, selectMode, filterKind, onSelect }: Props) {
  const [items, setItems] = useState<FlowMedia[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<string>(filterKind || "__all__");
  const [projectFilter, setProjectFilter] = useState<string>("__all__");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("imphq_flow_media").select("*").order("created_at", { ascending: false }).limit(200);
    if (kindFilter !== "__all__") q = q.eq("kind", kindFilter);
    if (projectFilter !== "__all__") q = q.eq("project_id", projectFilter);
    const { data, error } = await q;
    if (error) toast.error("Erro ao carregar mídias: " + error.message);
    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [kindFilter, projectFilter]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    for (const file of files) {
      try {
        const kind = kindFromMime(file.type);
        const ext = file.name.split(".").pop() || "bin";
        const path = `${kind}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("flow-media").upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (upErr) {
          if (upErr.message?.includes("Bucket not found")) {
            toast.error("Bucket 'flow-media' não existe. Crie no Storage do Supabase (privado).");
            setUploading(false);
            return;
          }
          throw upErr;
        }
        const { data: signed } = await supabase.storage.from("flow-media").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
        const url = signed?.signedUrl || "";

        // duration para áudio/vídeo (best-effort)
        let duration_ms: number | null = null;
        if (kind === "audio" || kind === "video") {
          try {
            duration_ms = await new Promise<number | null>((resolve) => {
              const el: any = kind === "audio" ? new Audio() : document.createElement("video");
              el.preload = "metadata";
              el.onloadedmetadata = () => resolve(Math.round((el.duration || 0) * 1000) || null);
              el.onerror = () => resolve(null);
              el.src = URL.createObjectURL(file);
              setTimeout(() => resolve(null), 3000);
            });
          } catch {}
        }

        const { error: insErr } = await supabase.from("imphq_flow_media").insert({
          project_id: projectFilter !== "__all__" ? projectFilter : null,
          kind,
          label: file.name,
          url,
          storage_path: path,
          mime_type: file.type,
          size_bytes: file.size,
          duration_ms,
          created_by: userId,
        });
        if (insErr) throw insErr;
        toast.success(`✓ ${file.name}`);
      } catch (err: any) {
        toast.error(`Falha em ${file.name}: ${err?.message || err}`);
      }
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    load();
  };

  const remove = async (m: FlowMedia) => {
    if (!confirm(`Remover "${m.label}"?`)) return;
    if (m.storage_path) {
      await supabase.storage.from("flow-media").remove([m.storage_path]);
    }
    await supabase.from("imphq_flow_media").delete().eq("id", m.id);
    toast.success("Removido");
    load();
  };

  const copyId = (m: FlowMedia) => {
    navigator.clipboard.writeText(m.id);
    toast.success("ID copiado");
  };

  const filtered = items.filter((m) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return m.label.toLowerCase().includes(s) || (m.tags || []).some((t) => t.toLowerCase().includes(s));
  });

  const acceptByKind = filterKind === "audio" ? "audio/*"
    : filterKind === "image" ? "image/*"
    : filterKind === "video" ? "video/*"
    : "audio/*,image/*,video/*,.pdf,.doc,.docx";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou tag…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 pl-7 text-xs" />
        </div>
        {!filterKind && (
          <Select value={kindFilter} onValueChange={setKindFilter}>
            <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              <SelectItem value="audio">Áudio</SelectItem>
              <SelectItem value="image">Imagem</SelectItem>
              <SelectItem value="video">Vídeo</SelectItem>
              <SelectItem value="doc">Documento</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os projetos</SelectItem>
            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <input ref={fileRef} type="file" multiple accept={acceptByKind} className="hidden" onChange={onUpload} />
        <Button size="sm" className="h-8 text-xs bg-amber-500 text-black hover:bg-amber-400" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />} Enviar mídia
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          Nenhuma mídia ainda. Envie áudios, imagens ou vídeos para reaproveitar nos fluxos.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((m) => {
            const Icon = kindIcon[m.kind];
            return (
              <Card key={m.id} className="bg-slate-900/50 border-white/5 group hover:border-primary/30 transition">
                <CardContent className="p-3 space-y-2">
                  <div className="aspect-video bg-slate-950/60 rounded flex items-center justify-center overflow-hidden">
                    {m.kind === "image" ? (
                      <img src={m.url} alt={m.label} className="w-full h-full object-cover" />
                    ) : m.kind === "video" ? (
                      <video src={m.url} className="w-full h-full object-cover" controls preload="metadata" />
                    ) : m.kind === "audio" ? (
                      <audio src={m.url} controls className="w-full px-2" />
                    ) : (
                      <Icon className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Icon className="h-3 w-3 text-primary shrink-0" />
                    <p className="text-xs truncate flex-1" title={m.label}>{m.label}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    <Badge variant="outline" className="text-[9px]">{m.kind}</Badge>
                    {m.duration_ms ? <Badge variant="outline" className="text-[9px]">{Math.round(m.duration_ms / 1000)}s</Badge> : null}
                    {m.size_bytes ? <Badge variant="outline" className="text-[9px]">{Math.round(m.size_bytes / 1024)}kb</Badge> : null}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    {selectMode ? (
                      <Button size="sm" className="h-6 text-[10px] flex-1 bg-primary text-primary-foreground" onClick={() => onSelect?.(m)}>Selecionar</Button>
                    ) : (
                      <>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => copyId(m)}><Copy className="h-3 w-3 mr-1" />ID</Button>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-rose-400 ml-auto" onClick={() => remove(m)}><Trash2 className="h-3 w-3" /></Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

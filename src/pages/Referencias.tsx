import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { EditableTagList } from "@/components/projeto/EditableTagList";
import { FileUpload } from "@/components/FileUpload";
import { Plus, Search, Star, ExternalLink, Trash2, Image } from "lucide-react";
import { toast } from "sonner";

const TIPOS = ["criativo", "landing_page", "email", "video", "copy"];
const PLATAFORMAS = ["Meta Ads", "Google Ads", "TikTok", "YouTube", "Instagram", "Email", "Outro"];

const TIPO_STYLES: Record<string, { border: string; badge: string }> = {
  criativo: { border: "border-l-rose-500", badge: "bg-rose-500/15 text-rose-400 border-rose-500/30" },
  landing_page: { border: "border-l-blue-500", badge: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  email: { border: "border-l-amber-500", badge: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  video: { border: "border-l-violet-500", badge: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  copy: { border: "border-l-emerald-500", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
};

interface Ref {
  id: string; project_id?: string; tipo?: string; titulo: string;
  url?: string; image_url?: string; tags?: string[]; notas?: string;
  score?: number; plataforma?: string; created_at?: string;
}

export default function Referencias() {
  const [refs, setRefs] = useState<Ref[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState("all");
  const [filterPlat, setFilterPlat] = useState("all");
  const [filterProject, setFilterProject] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Ref | null>(null);
  const [form, setForm] = useState<Partial<Ref>>({ titulo: "", tipo: "criativo", tags: [] });

  const load = async () => {
    const [rRes, pRes] = await Promise.all([
      supabase.from("imphq_referencias").select("*").order("created_at", { ascending: false }),
      supabase.from("imphq_projects").select("id, name").order("name"),
    ]);
    setRefs((rRes.data || []) as Ref[]);
    setProjects(pRes.data || []);
  };

  useEffect(() => { load(); }, []);

  const filtered = refs.filter(r => {
    const ms = !search || r.titulo?.toLowerCase().includes(search.toLowerCase()) || r.notas?.toLowerCase().includes(search.toLowerCase());
    const mt = filterTipo === "all" || r.tipo === filterTipo;
    const mp = filterPlat === "all" || r.plataforma === filterPlat;
    const mpr = filterProject === "all" || r.project_id === filterProject;
    return ms && mt && mp && mpr;
  });

  const createRef = async () => {
    if (!form.titulo?.trim()) { toast.error("Título obrigatório"); return; }
    const id = crypto.randomUUID();
    const { error } = await supabase.from("imphq_referencias").insert({
      id, titulo: form.titulo, tipo: form.tipo || "criativo",
      url: form.url || null, image_url: form.image_url || null,
      tags: form.tags || [], notas: form.notas || null,
      score: form.score || 0, plataforma: form.plataforma || null,
      project_id: filterProject !== "all" ? filterProject : null,
    } as any);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Referência criada!");
    setShowNew(false);
    setForm({ titulo: "", tipo: "criativo", tags: [] });
    load();
  };

  const saveEdit = async () => {
    if (!editing) return;
    const { error } = await supabase.from("imphq_referencias").update({
      titulo: editing.titulo, tipo: editing.tipo, url: editing.url,
      image_url: editing.image_url, tags: editing.tags, notas: editing.notas,
      score: editing.score, plataforma: editing.plataforma, project_id: editing.project_id,
    }).eq("id", editing.id);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Salvo!"); setEditing(null); load();
  };

  const deleteRef = async (id: string) => {
    await supabase.from("imphq_referencias").delete().eq("id", id);
    toast.success("Removido"); setEditing(null); load();
  };

  const projectName = (id?: string) => projects.find(p => p.id === id)?.name || "";

  const ScoreStars = ({ score, onChange }: { score: number; onChange?: (s: number) => void }) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star
          key={s}
          className={`h-3.5 w-3.5 transition-colors ${s <= score ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.4)]" : "text-muted-foreground/30"} ${onChange ? "cursor-pointer hover:text-amber-300" : ""}`}
          onClick={() => onChange?.(s)}
        />
      ))}
    </div>
  );

  const RefForm = ({ data, setData }: { data: Partial<Ref>; setData: (d: any) => void }) => (
    <div className="space-y-3">
      <div><Label>Título *</Label><Input value={data.titulo || ""} onChange={e => setData({ ...data, titulo: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Tipo</Label>
          <Select value={data.tipo || "criativo"} onValueChange={v => setData({ ...data, tipo: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t} className="capitalize">{t.replace("_", " ")}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Plataforma</Label>
          <Select value={data.plataforma || "none"} onValueChange={v => setData({ ...data, plataforma: v === "none" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma</SelectItem>
              {PLATAFORMAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Projeto</Label>
        <Select value={data.project_id || "none"} onValueChange={v => setData({ ...data, project_id: v === "none" ? undefined : v })}>
          <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div><Label>URL</Label><Input value={data.url || ""} onChange={e => setData({ ...data, url: e.target.value })} placeholder="https://..." /></div>
      <div>
        <Label>Imagem</Label>
        <div className="flex items-center gap-2">
          <Input value={data.image_url || ""} onChange={e => setData({ ...data, image_url: e.target.value })} placeholder="URL da imagem..." className="flex-1" />
          <FileUpload bucket="project-media" path="referencias" onUpload={url => setData({ ...data, image_url: url })} label="Upload" />
        </div>
      </div>
      <div><Label>Score</Label><ScoreStars score={data.score || 0} onChange={s => setData({ ...data, score: s })} /></div>
      <div><Label>Tags</Label><EditableTagList tags={data.tags || []} onChange={tags => setData({ ...data, tags })} /></div>
      <div><Label>Notas</Label><Textarea value={data.notas || ""} onChange={e => setData({ ...data, notas: e.target.value })} className="min-h-[80px]" /></div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-primary">🗂️ Referências</h1>
        <Button size="sm" onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" /> Nova Referência</Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-9 bg-secondary" />
        </div>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Tipos</SelectItem>
            {TIPOS.map(t => <SelectItem key={t} value={t} className="capitalize">{t.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPlat} onValueChange={setFilterPlat}>
          <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Plataforma" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Plataformas</SelectItem>
            {PLATAFORMAS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Projeto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Projetos</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-xs">{filtered.length} refs</Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((r, i) => {
          const style = TIPO_STYLES[r.tipo || "criativo"] || TIPO_STYLES.criativo;
          return (
            <Card
              key={r.id}
              className={`bg-card border-border border-l-4 ${style.border} hover:scale-[1.02] cursor-pointer transition-all duration-200 group overflow-hidden animate-fade-in`}
              style={{ animationDelay: `${i * 40}ms`, animationFillMode: "both" }}
              onClick={() => setEditing({ ...r })}
            >
              {r.image_url && (
                <div className="h-36 bg-secondary overflow-hidden">
                  <img src={r.image_url} alt={r.titulo} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
              )}
              {!r.image_url && (
                <div className="h-24 bg-gradient-to-br from-secondary/80 to-secondary/30 flex items-center justify-center">
                  <Image className="h-8 w-8 text-muted-foreground/20" />
                </div>
              )}
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-sm truncate">{r.titulo}</h3>
                  <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" onClick={e => { e.stopPropagation(); deleteRef(r.id); }}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {r.tipo && <Badge className={`text-[9px] border ${style.badge}`}>{r.tipo.replace("_", " ")}</Badge>}
                  {r.plataforma && <Badge variant="outline" className="text-[9px]">{r.plataforma}</Badge>}
                </div>
                {r.score && r.score > 0 && <ScoreStars score={r.score} />}
                {r.project_id && <p className="text-[10px] text-muted-foreground">{projectName(r.project_id)}</p>}
                {r.url && (
                  <a href={r.url} target="_blank" rel="noopener" className="text-[10px] text-primary hover:underline flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <ExternalLink className="h-2.5 w-2.5" /> Abrir link
                  </a>
                )}
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma referência cadastrada.</p>}
      </div>

      {/* New Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Referência</DialogTitle></DialogHeader>
          <RefForm data={form} setData={setForm} />
          <DialogFooter><Button onClick={createRef}>Criar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Referência</DialogTitle></DialogHeader>
          {editing && <RefForm data={editing} setData={setEditing} />}
          <DialogFooter className="flex justify-between">
            <Button variant="destructive" size="sm" onClick={() => editing && deleteRef(editing.id)}><Trash2 className="h-3 w-3 mr-1" /> Excluir</Button>
            <Button onClick={saveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

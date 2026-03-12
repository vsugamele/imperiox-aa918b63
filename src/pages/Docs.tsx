import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Trash2, Save, Search, ArrowLeft, BookOpen } from "lucide-react";
import { toast } from "sonner";

export default function Docs() {
  const [docs, setDocs] = useState<any[]>([]);
  const [kb, setKb] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState("all");
  const [filterCat, setFilterCat] = useState("all");
  const [editing, setEditing] = useState<any>(null);

  const load = async () => {
    const [docRes, kbRes, pRes] = await Promise.all([
      supabase.from("imphq_docs").select("*").order("created_at", { ascending: false }),
      supabase.from("imphq_kb").select("*").order("order_idx"),
      supabase.from("imphq_projects").select("id, name").order("name"),
    ]);
    setDocs(docRes.data || []);
    setKb(kbRes.data || []);
    setProjects(pRes.data || []);
  };

  useEffect(() => { load(); }, []);

  const allItems = [
    ...docs.map(d => ({ ...d, source: "doc" })),
    ...kb.map(k => ({ ...k, source: "kb" })),
  ];

  const categories = [...new Set(allItems.map(i => i.cat || i.section_key).filter(Boolean))];

  const filtered = allItems.filter(i => {
    const matchSearch = !search || i.title?.toLowerCase().includes(search.toLowerCase()) || i.content?.toLowerCase().includes(search.toLowerCase());
    const matchProject = filterProject === "all" || i.project_id === filterProject;
    const matchCat = filterCat === "all" || i.cat === filterCat || i.section_key === filterCat;
    return matchSearch && matchProject && matchCat;
  });

  const createDoc = async () => {
    const id = crypto.randomUUID();
    const { data, error } = await supabase.from("imphq_docs").insert({
      id, title: "Novo Documento", content: "",
      project_id: filterProject !== "all" ? filterProject : null,
    } as any).select().single();
    if (error) { toast.error("Erro: " + error.message); return; }
    setEditing(data);
    toast.success("Doc criado!");
  };

  const saveDoc = async () => {
    if (!editing) return;
    const { error } = await supabase.from("imphq_docs")
      .update({ title: editing.title, content: editing.content, cat: editing.cat })
      .eq("id", editing.id);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Salvo!"); setEditing(null); load();
  };

  const deleteDoc = async (id: string) => {
    await supabase.from("imphq_docs").delete().eq("id", id);
    toast.success("Doc removido");
    if (editing?.id === id) setEditing(null);
    load();
  };

  const projectName = (id?: string) => projects.find(p => p.id === id)?.name || "";

  // Editor view
  if (editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { setEditing(null); load(); }}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
          <Badge variant="outline" className="text-[10px]">{editing.source === "kb" ? "KB" : "DOC"}</Badge>
        </div>
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <Input value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} className="bg-secondary text-lg font-medium max-w-md" />
            <div className="flex gap-2 shrink-0">
              <Input value={editing.cat || ""} onChange={e => setEditing({ ...editing, cat: e.target.value })} className="bg-secondary w-32 text-xs" placeholder="Categoria" />
              <Button size="sm" onClick={saveDoc}><Save className="h-3 w-3 mr-1" /> Salvar</Button>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              value={editing.content || editing.body || ""}
              onChange={e => setEditing({ ...editing, content: e.target.value })}
              className="bg-secondary min-h-[500px] font-mono text-sm"
              placeholder="Escreva o conteúdo..."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-primary">📄 Docs & Knowledge Base</h1>
        <Button size="sm" onClick={createDoc}><Plus className="h-4 w-4 mr-1" /> Novo Doc</Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-9 bg-secondary" />
        </div>
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="Projeto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Projetos</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-xs">{filtered.length} docs</Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(d => (
          <Card key={d.id} className="bg-card border-border hover:border-primary/20 cursor-pointer transition-colors group" onClick={() => setEditing(d)}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  {d.source === "kb" ? <BookOpen className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" /> : <FileText className="h-4 w-4 text-primary mt-0.5 shrink-0" />}
                  <div className="min-w-0">
                    <h3 className="font-medium text-sm truncate">{d.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-[9px]">{d.source === "kb" ? "KB" : "Doc"}</Badge>
                      {(d.cat || d.section_key) && <Badge variant="outline" className="text-[9px]">{d.cat || d.section_key}</Badge>}
                    </div>
                    {d.project_id && <p className="text-[10px] text-muted-foreground mt-1">{projectName(d.project_id)}</p>}
                    {(d.content || d.body) && (
                      <p className="text-[10px] text-muted-foreground mt-2 line-clamp-2">{(d.content || d.body).substring(0, 120)}...</p>
                    )}
                  </div>
                </div>
                {d.source === "doc" && (
                  <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0" onClick={(e) => { e.stopPropagation(); deleteDoc(d.id); }}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

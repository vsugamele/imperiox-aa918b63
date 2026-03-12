import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

export default function Projetos() {
  const [projects, setProjects] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", icon: "📁", category: "", description: "" });
  const navigate = useNavigate();

  const load = async () => {
    const { data } = await supabase.from("imphq_projects").select("*").order("created_at", { ascending: false });
    setProjects(data || []);
  };

  useEffect(() => { load(); }, []);

  const filtered = projects.filter((p) =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    if (!form.name) return;
    const id = form.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const { error } = await supabase.from("imphq_projects").insert({
      id, name: form.name, icon: form.icon, category: form.category, description: form.description,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setOpen(false);
    setForm({ name: "", icon: "📁", category: "", description: "" });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-primary">Projetos</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Projeto</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle className="font-display">Novo Projeto</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="w-16">
                  <Label>Emoji</Label>
                  <Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} className="bg-secondary text-center text-xl" />
                </div>
                <div className="flex-1">
                  <Label>Nome</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-secondary" />
                </div>
              </div>
              <div><Label>Categoria</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="bg-secondary" /></div>
              <div><Label>Descrição</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-secondary" /></div>
              <Button onClick={handleCreate} className="w-full">Criar Projeto</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar projetos..." className="pl-9 bg-secondary" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((p) => (
          <Card key={p.id} onClick={() => navigate(`/projetos/${p.id}`)} className="bg-card border-border hover:border-primary/30 cursor-pointer transition-all hover:shadow-lg hover:shadow-primary/5">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <span className="text-2xl">{p.icon || "📁"}</span>
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color || "hsl(var(--primary))" }} />
              </div>
              <h3 className="mt-2 font-medium text-sm">{p.name}</h3>
              <p className="text-xs text-muted-foreground mt-1">{p.category || "Sem categoria"}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

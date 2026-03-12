import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EditableTagList } from "@/components/projeto/EditableTagList";
import { Search, MessageCircle, Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  lead: "bg-primary/20 text-primary",
  cliente: "bg-primary/10 text-primary",
  vip: "bg-accent/20 text-accent-foreground",
  inativo: "bg-muted text-muted-foreground",
};
const STATUSES = ["lead", "cliente", "vip", "inativo"];

interface Lead {
  id: string; nome?: string; phone?: string; email?: string; project_id?: string;
  funil_id?: string; plataforma?: string; status?: string; score?: number;
  tags?: string[]; total_gasto?: number; data?: any;
}

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [form, setForm] = useState({ nome: "", email: "", phone: "", plataforma: "", status: "lead", tags: [] as string[] });

  const load = async () => {
    const { data } = await supabase.from("imphq_leads").select("*").order("criado_em", { ascending: false });
    setLeads((data || []) as Lead[]);
  };

  useEffect(() => { load(); }, []);

  const filtered = leads.filter((l) => {
    const matchSearch = l.nome?.toLowerCase().includes(search.toLowerCase()) || l.email?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const createLead = async () => {
    if (!form.nome.trim()) { toast.error("Nome obrigatório"); return; }
    const id = crypto.randomUUID();
    const { error } = await supabase.from("imphq_leads").insert({
      id, nome: form.nome, email: form.email || null, phone: form.phone || null,
      plataforma: form.plataforma || null, status: form.status, tags: form.tags,
    });
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Lead criado!");
    setShowNew(false); setForm({ nome: "", email: "", phone: "", plataforma: "", status: "lead", tags: [] });
    load();
  };

  const saveEdit = async () => {
    if (!editLead) return;
    const { error } = await supabase.from("imphq_leads").update({
      nome: editLead.nome, email: editLead.email, phone: editLead.phone,
      plataforma: editLead.plataforma, status: editLead.status, tags: editLead.tags,
    }).eq("id", editLead.id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Lead atualizado!"); setEditLead(null); load();
  };

  const deleteLead = async (id: string) => {
    await supabase.from("imphq_leads").delete().eq("id", id);
    toast.success("Lead removido"); setEditLead(null); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-primary">Leads</h1>
        <Button size="sm" onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" /> Novo Lead</Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar leads..." className="pl-9 bg-secondary" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Total Gasto</TableHead>
              <TableHead>Plataforma</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.nome}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{l.email || "—"}</TableCell>
                <TableCell>
                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${STATUS_COLORS[l.status || "lead"]}`}>
                    {l.status || "lead"}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-primary">{l.score ?? "—"}</TableCell>
                <TableCell className="font-mono text-sm">
                  {l.total_gasto ? `R$ ${parseFloat(String(l.total_gasto)).toFixed(2)}` : "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{l.plataforma || "—"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(l.tags || []).slice(0, 3).map((t, i) => (
                      <Badge key={i} variant="secondary" className="text-[9px]">{t}</Badge>
                    ))}
                    {(l.tags || []).length > 3 && <Badge variant="outline" className="text-[9px]">+{(l.tags || []).length - 3}</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setEditLead({ ...l })}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    {l.phone && (
                      <Button size="icon" variant="ghost" asChild>
                        <a href={`https://wa.me/${l.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener">
                          <MessageCircle className="h-4 w-4 text-emerald-400" />
                        </a>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* New Lead Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Lead</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Plataforma</Label><Input value={form.plataforma} onChange={e => setForm({ ...form, plataforma: e.target.value })} placeholder="Meta, Google..." /></div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Tags</Label><EditableTagList tags={form.tags} onChange={tags => setForm({ ...form, tags })} /></div>
          </div>
          <DialogFooter><Button onClick={createLead}>Criar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Lead Dialog */}
      <Dialog open={!!editLead} onOpenChange={() => setEditLead(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Lead</DialogTitle></DialogHeader>
          {editLead && (
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={editLead.nome || ""} onChange={e => setEditLead({ ...editLead, nome: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Email</Label><Input value={editLead.email || ""} onChange={e => setEditLead({ ...editLead, email: e.target.value })} /></div>
                <div><Label>Telefone</Label><Input value={editLead.phone || ""} onChange={e => setEditLead({ ...editLead, phone: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Plataforma</Label><Input value={editLead.plataforma || ""} onChange={e => setEditLead({ ...editLead, plataforma: e.target.value })} /></div>
                <div>
                  <Label>Status</Label>
                  <Select value={editLead.status || "lead"} onValueChange={v => setEditLead({ ...editLead, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Tags</Label><EditableTagList tags={editLead.tags || []} onChange={tags => setEditLead({ ...editLead, tags })} /></div>
            </div>
          )}
          <DialogFooter className="flex justify-between">
            <Button variant="destructive" size="sm" onClick={() => editLead && deleteLead(editLead.id)}>
              <Trash2 className="h-3 w-3 mr-1" /> Excluir
            </Button>
            <Button onClick={saveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

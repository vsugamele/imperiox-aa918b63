import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

export default function Equipe() {
  const { user } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<any>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newMember, setNewMember] = useState({ name: "", email: "", role: "", department: "" });

  const fetchMembers = async () => {
    const { data } = await supabase.from("imphq_team_members").select("*").order("created_at");
    setMembers(data || []);
  };

  useEffect(() => { fetchMembers(); }, []);

  const addMember = async () => {
    if (!newMember.name.trim()) { toast.error("Nome é obrigatório"); return; }
    const { error } = await supabase.from("imphq_team_members").insert({
      ...newMember,
      user_id: user?.id,
      is_active: true,
    } as any);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Membro adicionado!");
    setNewMember({ name: "", email: "", role: "", department: "" });
    setDialogOpen(false);
    fetchMembers();
  };

  const startEdit = (m: any) => {
    setEditingId(m.id);
    setEditRow({ name: m.name || "", email: m.email || "", role: m.role || "", department: m.department || "" });
  };

  const saveEdit = async (id: string) => {
    const { error } = await supabase.from("imphq_team_members").update(editRow).eq("id", id);
    if (error) { toast.error("Erro ao salvar"); return; }
    setEditingId(null);
    fetchMembers();
  };

  const toggleActive = async (m: any) => {
    await supabase.from("imphq_team_members").update({ is_active: !m.is_active }).eq("id", m.id);
    fetchMembers();
  };

  const deleteMember = async (id: string) => {
    await supabase.from("imphq_team_members").delete().eq("id", id);
    toast.success("Membro removido");
    fetchMembers();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-primary">Equipe</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-3 w-3 mr-1" /> Membro</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Membro</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs text-muted-foreground">Nome *</Label><Input value={newMember.name} onChange={(e) => setNewMember({ ...newMember, name: e.target.value })} /></div>
              <div><Label className="text-xs text-muted-foreground">Email</Label><Input value={newMember.email} onChange={(e) => setNewMember({ ...newMember, email: e.target.value })} /></div>
              <div><Label className="text-xs text-muted-foreground">Cargo</Label><Input value={newMember.role} onChange={(e) => setNewMember({ ...newMember, role: e.target.value })} /></div>
              <div><Label className="text-xs text-muted-foreground">Departamento</Label><Input value={newMember.department} onChange={(e) => setNewMember({ ...newMember, department: e.target.value })} /></div>
              <Button onClick={addMember} className="w-full">Adicionar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Departamento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id}>
                {editingId === m.id ? (
                  <>
                    <TableCell><Input value={editRow.name} onChange={(e) => setEditRow({ ...editRow, name: e.target.value })} className="h-8 bg-secondary" /></TableCell>
                    <TableCell><Input value={editRow.email} onChange={(e) => setEditRow({ ...editRow, email: e.target.value })} className="h-8 bg-secondary" /></TableCell>
                    <TableCell><Input value={editRow.role} onChange={(e) => setEditRow({ ...editRow, role: e.target.value })} className="h-8 bg-secondary" /></TableCell>
                    <TableCell><Input value={editRow.department} onChange={(e) => setEditRow({ ...editRow, department: e.target.value })} className="h-8 bg-secondary" /></TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] cursor-pointer ${m.is_active ? "border-success text-success" : "border-destructive text-destructive"}`} onClick={() => toggleActive(m)}>
                        {m.is_active ? "ativo" : "inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-primary" onClick={() => saveEdit(m.id)}><Check className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                      </div>
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell className="font-medium">{m.name || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.email || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.role || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.department || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] cursor-pointer ${m.is_active ? "border-success text-success" : "border-destructive text-destructive"}`} onClick={() => toggleActive(m)}>
                        {m.is_active ? "ativo" : "inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(m)}><Pencil className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMember(m.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))}
            {members.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum membro na equipe.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Pencil, CreditCard } from "lucide-react";
import { toast } from "sonner";

interface AdAccount {
  id: string;
  bm_id: string;
  ad_account_id: string;
  nome: string;
  plataforma: string;
  status: string;
  notas: string | null;
  created_at: string;
}

const STATUS_OPTIONS = ["ativo", "pausado", "banido", "desativado"];
const STATUS_COLORS: Record<string, string> = {
  ativo: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  pausado: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  banido: "bg-red-500/20 text-red-400 border-red-500/30",
  desativado: "bg-muted text-muted-foreground border-border",
};

export function AdAccountsTab() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<AdAccount | null>(null);
  const [form, setForm] = useState({ bm_id: "", ad_account_id: "", nome: "", plataforma: "Facebook", status: "ativo", notas: "" });

  const load = async () => {
    const { data } = await supabase.from("imphq_ad_accounts").select("*").order("created_at", { ascending: false });
    setAccounts((data || []) as AdAccount[]);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ bm_id: "", ad_account_id: "", nome: "", plataforma: "Facebook", status: "ativo", notas: "" });
    setShowDialog(true);
  };

  const openEdit = (acc: AdAccount) => {
    setEditing(acc);
    setForm({
      bm_id: acc.bm_id,
      ad_account_id: acc.ad_account_id,
      nome: acc.nome,
      plataforma: acc.plataforma,
      status: acc.status,
      notas: acc.notas || "",
    });
    setShowDialog(true);
  };

  const save = async () => {
    if (!form.bm_id.trim() || !form.ad_account_id.trim() || !form.nome.trim()) {
      toast.error("Preencha BM ID, Ad Account ID e Nome");
      return;
    }
    const payload = {
      bm_id: form.bm_id.trim(),
      ad_account_id: form.ad_account_id.trim(),
      nome: form.nome.trim(),
      plataforma: form.plataforma,
      status: form.status,
      notas: form.notas || null,
    };

    if (editing) {
      const { error } = await supabase.from("imphq_ad_accounts").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Conta atualizada!");
    } else {
      const { error } = await supabase.from("imphq_ad_accounts").insert({ ...payload, user_id: user?.id });
      if (error) { toast.error(error.message); return; }
      toast.success("Conta adicionada!");
    }
    setShowDialog(false);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("imphq_ad_accounts").delete().eq("id", id);
    toast.success("Conta removida");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">Gerencie suas Business Managers e contas de anúncios</p>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Ad Account</Button>
      </div>

      {accounts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhuma conta de anúncios cadastrada</p>
          <p className="text-xs">Adicione suas BMs e Ad Accounts para organizar a operação</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] uppercase">Nome</TableHead>
                <TableHead className="text-[10px] uppercase">BM ID</TableHead>
                <TableHead className="text-[10px] uppercase">Ad Account ID</TableHead>
                <TableHead className="text-[10px] uppercase">Plataforma</TableHead>
                <TableHead className="text-[10px] uppercase">Status</TableHead>
                <TableHead className="text-[10px] uppercase">Notas</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map(acc => (
                <TableRow key={acc.id}>
                  <TableCell className="font-medium text-sm">{acc.nome}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{acc.bm_id}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{acc.ad_account_id}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[9px]">{acc.plataforma}</Badge></TableCell>
                  <TableCell>
                    <Badge className={`text-[9px] ${STATUS_COLORS[acc.status] || ""}`}>{acc.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{acc.notas || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(acc)}><Pencil className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(acc.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar" : "Adicionar"} Ad Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: BM Principal - Conta 01" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>BM ID *</Label><Input value={form.bm_id} onChange={e => setForm({ ...form, bm_id: e.target.value })} placeholder="Ex: 123456789" className="font-mono" /></div>
              <div><Label>Ad Account ID *</Label><Input value={form.ad_account_id} onChange={e => setForm({ ...form, ad_account_id: e.target.value })} placeholder="Ex: act_123456789" className="font-mono" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Plataforma</Label>
                <Select value={form.plataforma} onValueChange={v => setForm({ ...form, plataforma: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Facebook">Facebook</SelectItem>
                    <SelectItem value="Google">Google</SelectItem>
                    <SelectItem value="TikTok">TikTok</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Notas</Label><Textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} placeholder="Observações sobre essa conta..." className="min-h-[60px]" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={save}>{editing ? "Atualizar" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

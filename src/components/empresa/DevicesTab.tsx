import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Smartphone } from "lucide-react";
import { toast } from "sonner";

interface Device {
  id: string; provider: string; device_id?: string | null; nome?: string | null;
  proxy_tipo?: string | null; proxy_geo?: string | null; fingerprint_id?: string | null;
  status: string; project_id?: string | null; notas?: string | null;
}

const PROVIDERS = ["geelark", "bitbrowser", "adspower", "outro"];
const STATUS = ["ativo", "pausado", "banido"];

export function DevicesTab() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [contas, setContas] = useState<any[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Device | null>(null);
  const empty: Device = { id: "", provider: "geelark", status: "ativo" };
  const [form, setForm] = useState<Device>(empty);

  const load = async () => {
    const [d, c, p] = await Promise.all([
      supabase.from("imphq_cloud_phones" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("imphq_empresa").select("id, nome, tipo, cloud_phone_ref"),
      supabase.from("imphq_projects").select("id, name").order("name"),
    ]);
    setDevices((d.data as any) || []);
    setContas(c.data || []);
    setProjects(p.data || []);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEdit(null); setForm(empty); setOpen(true); };
  const openEdit = (d: Device) => { setEdit(d); setForm(d); setOpen(true); };

  const save = async () => {
    const { id, ...payload } = form as any;
    if (edit) {
      const { error } = await (supabase.from("imphq_cloud_phones" as any) as any).update(payload).eq("id", edit.id);
      if (error) return toast.error(error.message);
      toast.success("Device atualizado");
    } else {
      const { error } = await (supabase.from("imphq_cloud_phones" as any) as any).insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Device criado");
    }
    setOpen(false); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover este device? As contas vinculadas ficam sem device.")) return;
    const { error } = await (supabase.from("imphq_cloud_phones" as any) as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido"); load();
  };

  const contasDoDevice = (deviceId: string) => contas.filter(c => c.cloud_phone_ref === deviceId);
  const projectName = (id?: string | null) => projects.find(p => p.id === id)?.name || "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium flex items-center gap-2"><Smartphone className="h-4 w-4 text-primary" /> Cloud Phones / Devices</h2>
          <p className="text-xs text-muted-foreground">GeeLark, BitBrowser e outros — cada device pode hospedar várias contas (email, IG, TikTok).</p>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="h-3.5 w-3.5 mr-1" /> Novo Device</Button>
      </div>

      <div className="rounded-lg border border-border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[10px] uppercase">Nome</TableHead>
              <TableHead className="text-[10px] uppercase">Provider</TableHead>
              <TableHead className="text-[10px] uppercase">Device ID</TableHead>
              <TableHead className="text-[10px] uppercase">Proxy</TableHead>
              <TableHead className="text-[10px] uppercase">Projeto</TableHead>
              <TableHead className="text-[10px] uppercase">Contas</TableHead>
              <TableHead className="text-[10px] uppercase">Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-xs text-muted-foreground">Nenhum device cadastrado</TableCell></TableRow>
            ) : devices.map(d => {
              const linked = contasDoDevice(d.id);
              return (
                <TableRow key={d.id}>
                  <TableCell className="text-sm">{d.nome || "—"}</TableCell>
                  <TableCell className="text-xs">{d.provider}</TableCell>
                  <TableCell className="text-xs font-mono">{d.device_id || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{d.proxy_tipo || "—"}{d.proxy_geo ? ` · ${d.proxy_geo}` : ""}</TableCell>
                  <TableCell className="text-xs">{projectName(d.project_id)}</TableCell>
                  <TableCell className="text-xs">
                    {linked.length === 0 ? <span className="text-muted-foreground">—</span> : (
                      <div className="flex flex-wrap gap-1">
                        {linked.map(c => <Badge key={c.id} variant="outline" className="text-[9px]">{c.tipo}:{c.nome}</Badge>)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[9px] ${d.status === "ativo" ? "border-emerald-500/30 text-emerald-400" : d.status === "banido" ? "border-red-500/30 text-red-400" : "border-amber-500/30 text-amber-400"}`}>{d.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(d)}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(d.id)}><Trash2 className="h-3 w-3" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-secondary/40">
          <DialogHeader><DialogTitle>{edit ? "Editar" : "Novo"} Device</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 text-sm leading-7">
            <div className="space-y-1 col-span-2"><Label className="text-xs">Nome</Label><Input value={form.nome || ""} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="GeeLark #01" /></div>
            <div className="space-y-1">
              <Label className="text-xs">Provider</Label>
              <Select value={form.provider} onValueChange={v => setForm({ ...form, provider: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PROVIDERS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Device ID</Label><Input value={form.device_id || ""} onChange={e => setForm({ ...form, device_id: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Proxy tipo</Label><Input placeholder="residencial / mobile" value={form.proxy_tipo || ""} onChange={e => setForm({ ...form, proxy_tipo: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Proxy geo</Label><Input placeholder="BR-SP" value={form.proxy_geo || ""} onChange={e => setForm({ ...form, proxy_geo: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Fingerprint</Label><Input value={form.fingerprint_id || ""} onChange={e => setForm({ ...form, fingerprint_id: e.target.value })} /></div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Projeto vinculado</Label>
              <Select value={form.project_id || "__none__"} onValueChange={v => setForm({ ...form, project_id: v === "__none__" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2"><Label className="text-xs">Notas</Label><Input value={form.notas || ""} onChange={e => setForm({ ...form, notas: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

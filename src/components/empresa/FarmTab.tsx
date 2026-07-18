import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sprout, Plus, Flame, ShieldAlert, DollarSign, Pencil, Activity } from "lucide-react";
import { toast } from "sonner";

type Conta = any;
type Conteudo = any;
type Evento = any;

const WARMUP = ["novo", "aquecendo", "pronto", "pausado", "banido"];
const STATUS_VENDA = ["mantida", "listada", "negociando", "vendida"];

export function FarmTab() {
  const [contas, setContas] = useState<Conta[]>([]);
  const [conteudo, setConteudo] = useState<Conteudo[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [edit, setEdit] = useState<Conta | null>(null);
  const [sub, setSub] = useState("contas");

  const load = async () => {
    const [c, ct, ev] = await Promise.all([
      supabase.from("imphq_empresa").select("*").in("tipo", ["instagram", "tiktok", "youtube"]).order("created_at", { ascending: false }),
      supabase.from("imphq_empresa_conteudo").select("*").order("horario_agendado", { ascending: true }).limit(200),
      supabase.from("imphq_empresa_eventos").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    setContas(c.data || []);
    setConteudo(ct.data || []);
    setEventos(ev.data || []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!edit) return;
    const { id, nome, tipo, foto_url, mapa_node_id, extra, created_at, updated_at, ...patch } = edit;
    const { error } = await supabase.from("imphq_empresa").update(patch).eq("id", edit.id);
    if (error) return toast.error(error.message);
    toast.success("Atualizado");
    setEdit(null); load();
  };

  const stats = {
    total: contas.length,
    prontas: contas.filter(c => c.pronta_venda).length,
    risco: contas.filter(c => (c.sinais_risco?.length || 0) > 0).length,
    vendidas: contas.filter(c => c.status_venda === "vendida").length,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={<Sprout className="h-4 w-4" />} label="Contas no farm" value={stats.total} />
        <Kpi icon={<Flame className="h-4 w-4 text-primary" />} label="Prontas p/ venda" value={stats.prontas} />
        <Kpi icon={<ShieldAlert className="h-4 w-4 text-destructive" />} label="Em risco" value={stats.risco} />
        <Kpi icon={<DollarSign className="h-4 w-4 text-primary" />} label="Vendidas" value={stats.vendidas} />
      </div>

      <Tabs value={sub} onValueChange={setSub}>
        <TabsList>
          <TabsTrigger value="contas">Contas</TabsTrigger>
          <TabsTrigger value="fila">Fila de conteúdo</TabsTrigger>
          <TabsTrigger value="eventos">Eventos</TabsTrigger>
        </TabsList>

        <TabsContent value="contas">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Conta</TableHead>
                <TableHead>Warmup</TableHead>
                <TableHead>Idade</TableHead>
                <TableHead>Seguidores</TableHead>
                <TableHead>Eng.</TableHead>
                <TableHead>Proxy</TableHead>
                <TableHead>Cloud</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {contas.map(c => {
                  const idade = c.data_criacao_conta ? Math.floor((Date.now() - new Date(c.data_criacao_conta).getTime()) / 86400000) : null;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.nome} <span className="text-xs text-muted-foreground">· {c.tipo}</span></TableCell>
                      <TableCell><Badge variant="outline">{c.warmup_status || "novo"}</Badge></TableCell>
                      <TableCell>{idade !== null ? `${idade}d` : "—"}</TableCell>
                      <TableCell>{c.seguidores || 0}</TableCell>
                      <TableCell>{c.engajamento_medio || 0}%</TableCell>
                      <TableCell className="text-xs">{c.proxy_tipo || "—"} {c.proxy_geo ? `· ${c.proxy_geo}` : ""}</TableCell>
                      <TableCell className="text-xs">{c.cloud_phone_provider || "—"}</TableCell>
                      <TableCell>
                        {c.pronta_venda && <Badge className="mr-1">pronta</Badge>}
                        <Badge variant="secondary">{c.status_venda || "mantida"}</Badge>
                      </TableCell>
                      <TableCell><Button size="sm" variant="ghost" onClick={() => setEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button></TableCell>
                    </TableRow>
                  );
                })}
                {contas.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">Nenhuma conta ainda. Cadastre em Instagram/TikTok/YouTube.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="fila">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Conta</TableHead><TableHead>Legenda</TableHead>
                <TableHead>Agendado</TableHead><TableHead>Status</TableHead>
                <TableHead>Alcance</TableHead><TableHead>Likes</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {conteudo.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs">{contas.find(c => c.id === p.conta_id)?.nome || p.conta_id}</TableCell>
                    <TableCell className="text-xs max-w-xs truncate">{p.legenda}</TableCell>
                    <TableCell className="text-xs">{p.horario_agendado ? new Date(p.horario_agendado).toLocaleString("pt-BR") : "—"}</TableCell>
                    <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                    <TableCell>{p.alcance}</TableCell><TableCell>{p.likes}</TableCell>
                  </TableRow>
                ))}
                {conteudo.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Fila vazia.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="eventos">
          <Card><CardContent className="p-4 space-y-2">
            {eventos.map(e => (
              <div key={e.id} className="flex items-center gap-3 text-xs border-b border-border/50 pb-2">
                <Activity className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium">{e.tipo}</span>
                <span className="text-muted-foreground">{contas.find(c => c.id === e.conta_id)?.nome || e.conta_id}</span>
                <span className="ml-auto text-muted-foreground">{new Date(e.created_at).toLocaleString("pt-BR")}</span>
              </div>
            ))}
            {eventos.length === 0 && <div className="text-center text-sm text-muted-foreground py-8">Sem eventos.</div>}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!edit} onOpenChange={o => !o && setEdit(null)}>
        <DialogContent className="max-w-2xl bg-secondary/40">
          <DialogHeader><DialogTitle>Editar conta do farm</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Nicho"><Input value={edit.nicho || ""} onChange={e => setEdit({ ...edit, nicho: e.target.value })} /></Field>
              <Field label="Data criação da conta"><Input type="date" value={edit.data_criacao_conta || ""} onChange={e => setEdit({ ...edit, data_criacao_conta: e.target.value })} /></Field>
              <Field label="Warmup">
                <Select value={edit.warmup_status || "novo"} onValueChange={v => setEdit({ ...edit, warmup_status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{WARMUP.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Dias em warmup"><Input type="number" value={edit.warmup_days || 0} onChange={e => setEdit({ ...edit, warmup_days: +e.target.value })} /></Field>
              <Field label="Seguidores"><Input type="number" value={edit.seguidores || 0} onChange={e => setEdit({ ...edit, seguidores: +e.target.value })} /></Field>
              <Field label="Engajamento médio (%)"><Input type="number" step="0.1" value={edit.engajamento_medio || 0} onChange={e => setEdit({ ...edit, engajamento_medio: +e.target.value })} /></Field>
              <Field label="Último alcance"><Input type="number" value={edit.ultimo_alcance || 0} onChange={e => setEdit({ ...edit, ultimo_alcance: +e.target.value })} /></Field>
              <Field label="Cloud phone provider"><Input placeholder="GeeLark, etc." value={edit.cloud_phone_provider || ""} onChange={e => setEdit({ ...edit, cloud_phone_provider: e.target.value })} /></Field>
              <Field label="Cloud phone ID"><Input value={edit.cloud_phone_id || ""} onChange={e => setEdit({ ...edit, cloud_phone_id: e.target.value })} /></Field>
              <Field label="Proxy tipo"><Input placeholder="residencial / mobile" value={edit.proxy_tipo || ""} onChange={e => setEdit({ ...edit, proxy_tipo: e.target.value })} /></Field>
              <Field label="Proxy geo"><Input placeholder="BR-SP" value={edit.proxy_geo || ""} onChange={e => setEdit({ ...edit, proxy_geo: e.target.value })} /></Field>
              <Field label="Fingerprint ID"><Input value={edit.fingerprint_id || ""} onChange={e => setEdit({ ...edit, fingerprint_id: e.target.value })} /></Field>
              <Field label="Preço-alvo (R$)"><Input type="number" value={edit.preco_alvo || ""} onChange={e => setEdit({ ...edit, preco_alvo: +e.target.value })} /></Field>
              <Field label="Status de venda">
                <Select value={edit.status_venda || "mantida"} onValueChange={v => setEdit({ ...edit, status_venda: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_VENDA.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Marketplace"><Input value={edit.marketplace || ""} onChange={e => setEdit({ ...edit, marketplace: e.target.value })} /></Field>
              <Field label="Comprador"><Input value={edit.comprador || ""} onChange={e => setEdit({ ...edit, comprador: e.target.value })} /></Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ icon, label, value }: any) {
  return (
    <Card><CardContent className="p-3 flex items-center gap-3">
      {icon}
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-display">{value}</div>
      </div>
    </CardContent></Card>
  );
}

function Field({ label, children }: any) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}

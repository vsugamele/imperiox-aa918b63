import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Copy, Trash2, TrendingUp, DollarSign, MousePointerClick, Target } from "lucide-react";
import { toast } from "sonner";

interface TrackingLink {
  id: string; nome: string; destino: string; project_id?: string;
  utm_source?: string; utm_medium?: string; utm_campaign?: string;
  utm_content?: string; utm_term?: string; ativo: boolean;
  created_at: string; clickCount?: number;
}

export default function Tracker() {
  const [links, setLinks] = useState<TrackingLink[]>([]);
  const [clicks, setClicks] = useState<any[]>([]);
  const [vendas, setVendas] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ nome: "", destino: "", utm_source: "", utm_medium: "", utm_campaign: "", utm_content: "", utm_term: "" });

  const load = async () => {
    const [lRes, cRes, vRes] = await Promise.all([
      supabase.from("imphq_tracking_links").select("*").order("created_at", { ascending: false }),
      supabase.from("imphq_clicks").select("*"),
      supabase.from("imphq_vendas").select("*"),
    ]);
    const linksData = (lRes.data || []) as TrackingLink[];
    const clicksData = cRes.data || [];
    // Enrich links with click counts
    const enriched = linksData.map(l => ({
      ...l,
      clickCount: clicksData.filter((c: any) => c.link_id === l.id).length,
    }));
    setLinks(enriched);
    setClicks(clicksData);
    setVendas(vRes.data || []);
  };

  useEffect(() => { load(); }, []);

  const buildUrl = (l: Partial<TrackingLink>) => {
    if (!l.destino) return "";
    const params = new URLSearchParams();
    if (l.utm_source) params.set("utm_source", l.utm_source);
    if (l.utm_medium) params.set("utm_medium", l.utm_medium);
    if (l.utm_campaign) params.set("utm_campaign", l.utm_campaign);
    if (l.utm_content) params.set("utm_content", l.utm_content);
    if (l.utm_term) params.set("utm_term", l.utm_term);
    const qs = params.toString();
    return qs ? `${l.destino}?${qs}` : l.destino;
  };

  const createLink = async () => {
    if (!form.nome || !form.destino) { toast.error("Nome e destino obrigatórios"); return; }
    const id = crypto.randomUUID();
    const { error } = await supabase.from("imphq_tracking_links").insert({
      id, nome: form.nome, destino: form.destino,
      utm_source: form.utm_source || null, utm_medium: form.utm_medium || null,
      utm_campaign: form.utm_campaign || null, utm_content: form.utm_content || null,
      utm_term: form.utm_term || null, ativo: true,
    });
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Link criado!");
    setShowNew(false); setForm({ nome: "", destino: "", utm_source: "", utm_medium: "", utm_campaign: "", utm_content: "", utm_term: "" });
    load();
  };

  const toggleAtivo = async (link: TrackingLink) => {
    await supabase.from("imphq_tracking_links").update({ ativo: !link.ativo }).eq("id", link.id);
    load();
  };

  const deleteLink = async (id: string) => {
    await supabase.from("imphq_tracking_links").delete().eq("id", id);
    toast.success("Link removido");
    load();
  };

  const copyLink = (link: TrackingLink) => {
    navigator.clipboard.writeText(buildUrl(link));
    toast({ title: "URL copiada!" } as any);
  };

  // KPI calculations
  const totalClicks = clicks.length;
  const totalVendas = vendas.length;
  const totalReceita = vendas.reduce((s: number, v: any) => s + (parseFloat(v.valor) || 0), 0);
  const cpl = totalClicks > 0 ? (totalReceita / totalClicks).toFixed(2) : "—";
  const convRate = totalClicks > 0 ? ((totalVendas / totalClicks) * 100).toFixed(1) : "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-primary">UTM Tracker</h1>
        <Button size="sm" onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" /> Novo Link</Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border"><CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><MousePointerClick className="h-3 w-3" /> Total Clicks</div>
          <p className="text-2xl font-bold text-primary font-mono">{totalClicks}</p>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><DollarSign className="h-3 w-3" /> Receita</div>
          <p className="text-2xl font-bold text-primary font-mono">R$ {totalReceita.toFixed(2)}</p>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Target className="h-3 w-3" /> CPL</div>
          <p className="text-2xl font-bold text-primary font-mono">R$ {cpl}</p>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><TrendingUp className="h-3 w-3" /> Conv. Rate</div>
          <p className="text-2xl font-bold text-primary font-mono">{convRate}%</p>
        </CardContent></Card>
      </div>

      {/* Links Table */}
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Medium</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Clicks</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {links.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.nome}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{l.utm_source || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{l.utm_medium || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{l.utm_campaign || "—"}</TableCell>
                <TableCell className="font-mono text-primary">{l.clickCount ?? 0}</TableCell>
                <TableCell>
                  <Switch checked={l.ativo} onCheckedChange={() => toggleAtivo(l)} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => copyLink(l)}><Copy className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteLink(l.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* New Link Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Link UTM</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Meta - Campanha X" /></div>
            <div><Label>URL Destino</Label><Input value={form.destino} onChange={e => setForm({ ...form, destino: e.target.value })} placeholder="https://seusite.com/pagina" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>utm_source</Label><Input value={form.utm_source} onChange={e => setForm({ ...form, utm_source: e.target.value })} placeholder="meta" /></div>
              <div><Label>utm_medium</Label><Input value={form.utm_medium} onChange={e => setForm({ ...form, utm_medium: e.target.value })} placeholder="cpc" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>utm_campaign</Label><Input value={form.utm_campaign} onChange={e => setForm({ ...form, utm_campaign: e.target.value })} /></div>
              <div><Label>utm_content</Label><Input value={form.utm_content} onChange={e => setForm({ ...form, utm_content: e.target.value })} /></div>
              <div><Label>utm_term</Label><Input value={form.utm_term} onChange={e => setForm({ ...form, utm_term: e.target.value })} /></div>
            </div>
            {form.destino && (
              <div className="p-2 bg-secondary rounded text-xs text-muted-foreground break-all">
                <span className="text-primary font-medium">Preview: </span>{buildUrl(form as any)}
              </div>
            )}
          </div>
          <DialogFooter><Button onClick={createLink}>Criar Link</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

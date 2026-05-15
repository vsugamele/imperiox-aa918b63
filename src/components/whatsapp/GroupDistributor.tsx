import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Link2, Copy, BarChart3, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";

interface Distributor {
  id: string;
  campaign_id: string | null;
  slug: string;
  max_per_group: number;
  redirect_order: string[];
  click_count: number;
  is_active: boolean;
  created_at: string;
  weights?: Record<string, number> | null;
  group_invites?: Record<string, string> | null;
}

interface WaCampaign {
  id: string;
  name: string;
  groups: string[];
}

export default function GroupDistributor() {
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [campaigns, setCampaigns] = useState<WaCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ slug: "", max_per_group: 250, campaign_id: "" });
  const [showStats, setShowStats] = useState<Distributor | null>(null);
  const [clickStats, setClickStats] = useState<{ group_jid: string; count: number }[]>([]);
  const [cardStats, setCardStats] = useState<Record<string, { group_jid: string; count: number }[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [distRes, campRes] = await Promise.all([
      supabase.from("imphq_wa_group_distributors").select("*").order("created_at", { ascending: false }),
      supabase.from("imphq_wa_campaigns").select("id, name, groups").order("name"),
    ]);
    const dists = (distRes.data as any[]) || [];
    setDistributors(dists);
    setCampaigns((campRes.data as any[]) || []);
    setLoading(false);

    // Fetch click counts per distributor for sparklines (parallel)
    if (dists.length > 0) {
      const stats: Record<string, { group_jid: string; count: number }[]> = {};
      await Promise.all(dists.map(async (d) => {
        const groups: string[] = d.redirect_order || [];
        if (groups.length === 0) { stats[d.id] = []; return; }
        const counts = await Promise.all(groups.map(async (jid) => {
          const { count } = await supabase
            .from("imphq_wa_distributor_clicks")
            .select("id", { count: "exact", head: true })
            .eq("distributor_id", d.id)
            .eq("group_jid", jid);
          return { group_jid: jid, count: count || 0 };
        }));
        stats[d.id] = counts;
      }));
      setCardStats(stats);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const generateSlug = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let slug = "";
    for (let i = 0; i < 8; i++) slug += chars[Math.floor(Math.random() * chars.length)];
    setForm(f => ({ ...f, slug }));
  };

  const createDistributor = async () => {
    if (!form.slug.trim()) { toast.error("Slug obrigatório"); return; }

    const campaign = campaigns.find(c => c.id === form.campaign_id);
    const groups = campaign?.groups || [];

    const { error } = await supabase.from("imphq_wa_group_distributors").insert({
      slug: form.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, ""),
      max_per_group: form.max_per_group || 250,
      campaign_id: form.campaign_id || null,
      redirect_order: groups as any,
      is_active: true,
    } as any);

    if (error) {
      if (error.message.includes("unique")) toast.error("Slug já existe!");
      else toast.error(error.message);
      return;
    }

    toast.success("Distribuidor criado!");
    setShowCreate(false);
    setForm({ slug: "", max_per_group: 250, campaign_id: "" });
    load();
  };

  const toggleActive = async (dist: Distributor) => {
    await supabase
      .from("imphq_wa_group_distributors")
      .update({ is_active: !dist.is_active } as any)
      .eq("id", dist.id);
    toast.success(dist.is_active ? "Desativado" : "Ativado");
    load();
  };

  const deleteDist = async (id: string) => {
    await supabase.from("imphq_wa_group_distributors").delete().eq("id", id);
    toast.success("Excluído");
    load();
  };

  const copyLink = (slug: string) => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const url = `https://${projectId}.supabase.co/functions/v1/wa-group-distributor?slug=${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const openStats = async (dist: Distributor) => {
    setShowStats(dist);
    const { data } = await supabase
      .from("imphq_wa_distributor_clicks")
      .select("group_jid")
      .eq("distributor_id", dist.id);

    const countMap: Record<string, number> = {};
    for (const jid of dist.redirect_order || []) countMap[jid] = 0;
    for (const click of data || []) {
      countMap[click.group_jid] = (countMap[click.group_jid] || 0) + 1;
    }

    setClickStats(Object.entries(countMap).map(([group_jid, count]) => ({ group_jid, count })));
  };

  const campaignName = (id: string | null) => campaigns.find(c => c.id === id)?.name || "—";

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">🔗 Distribuidor de Grupos</h2>
          <p className="text-xs text-muted-foreground">Links inteligentes que distribuem leads entre grupos automaticamente</p>
        </div>
        <Button size="sm" onClick={() => { generateSlug(); setShowCreate(true); }}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Novo Link
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : distributors.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground text-sm">Nenhum distribuidor criado.</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => { generateSlug(); setShowCreate(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Criar primeiro
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {distributors.map(d => {
            const stats = cardStats[d.id] || [];
            const maxCount = Math.max(1, ...stats.map(s => s.count));
            const fullestPct = stats.length ? Math.round((maxCount / (d.max_per_group || 250)) * 100) : 0;
            const fullUrl = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/wa-group-distributor?slug=${d.slug}`;
            return (
            <Card key={d.id} className="group relative overflow-hidden hover:border-primary/30 transition-colors">
              <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${d.is_active ? "bg-gold" : "bg-muted-foreground/40"}`} />
              <CardContent className="p-4 pl-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-gold" />
                      <span className="font-mono text-sm font-semibold">{d.slug}</span>
                      <Badge className={`text-[10px] ${d.is_active ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                        {d.is_active ? "ativo" : "inativo"}
                      </Badge>
                      {d.is_active && <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />}
                    </div>
                    <button
                      onClick={() => copyLink(d.slug)}
                      title="Clique para copiar"
                      className="block max-w-full truncate text-[10px] text-muted-foreground/70 font-mono hover:text-gold transition-colors text-left"
                    >
                      {fullUrl}
                    </button>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                      <span>📢 {campaignName(d.campaign_id)}</span>
                      <span>👥 {(d.redirect_order || []).length} grupos</span>
                      <span>🖱️ {d.click_count} cliques</span>
                      <span>🔒 máx {d.max_per_group}</span>
                      {fullestPct >= 70 && (
                        <span className={fullestPct >= 90 ? "text-destructive" : "text-amber-400"}>
                          ⚠️ {fullestPct}% do mais cheio
                        </span>
                      )}
                    </div>
                    {/* Sparkline horizontal */}
                    {stats.length > 0 && (
                      <div className="flex items-end gap-0.5 h-6 mt-1">
                        {stats.slice(0, 24).map((s, i) => {
                          const h = Math.max(2, (s.count / maxCount) * 100);
                          const pct = (s.count / (d.max_per_group || 250)) * 100;
                          const color = pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-amber-500" : "bg-gold/70";
                          return (
                            <div
                              key={i}
                              className={`w-1.5 rounded-sm ${color} transition-all`}
                              style={{ height: `${h}%` }}
                              title={`${s.count} cliques`}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyLink(d.slug)} title="Copiar link">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openStats(d)} title="Estatísticas">
                      <BarChart3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleActive(d)} title={d.is_active ? "Desativar" : "Ativar"}>
                      {d.is_active ? <PowerOff className="h-3.5 w-3.5 text-amber-400" /> : <Power className="h-3.5 w-3.5 text-emerald-400" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteDist(d.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Distribuidor de Grupos</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Slug (identificador único do link)</Label>
              <div className="flex gap-2">
                <Input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="meu-grupo" className="font-mono" />
                <Button size="sm" variant="outline" onClick={generateSlug}>Gerar</Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">URL: ...wa-group-distributor?slug={form.slug || "..."}</p>
            </div>
            <div>
              <Label>Campanha (herda os grupos)</Label>
              <Select value={form.campaign_id} onValueChange={v => setForm({ ...form, campaign_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione uma campanha" /></SelectTrigger>
                <SelectContent>
                  {campaigns.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({(c.groups || []).length} grupos)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Máximo de leads por grupo</Label>
              <Input
                type="number"
                value={form.max_per_group}
                onChange={e => setForm({ ...form, max_per_group: parseInt(e.target.value) || 250 })}
                min={1}
                max={1024}
              />
            </div>
          </div>
          <DialogFooter><Button onClick={createDistributor}>Criar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats + Weights Dialog */}
      <Dialog open={!!showStats} onOpenChange={() => setShowStats(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display text-xl text-gold">Estatísticas — {showStats?.slug}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {/* Mini-dashboard */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-secondary/40 rounded-md p-2.5 border border-border/40">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cliques</div>
                <div className="font-display text-xl text-foreground">{showStats?.click_count || 0}</div>
              </div>
              <div className="bg-secondary/40 rounded-md p-2.5 border border-border/40">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Grupo + cheio</div>
                <div className="font-display text-xl text-foreground">
                  {clickStats.length ? Math.max(...clickStats.map(s => s.count)) : 0}
                  <span className="text-xs text-muted-foreground">/{showStats?.max_per_group}</span>
                </div>
              </div>
              <div className="bg-secondary/40 rounded-md p-2.5 border border-border/40">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Vagas livres</div>
                <div className="font-display text-xl text-gold">
                  {clickStats.reduce((sum, s) => sum + Math.max(0, (showStats?.max_per_group || 0) - s.count), 0)}
                </div>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground bg-muted/30 p-2 rounded">
              💡 Defina pesos (1-10) para distribuir mais leads em grupos específicos. Sem pesos = preenchimento sequencial.
            </div>
            <ScrollArea className="max-h-[360px]">
              <div className="space-y-3">
                {clickStats.map((s, i) => {
                  const pct = showStats?.max_per_group ? Math.min(100, (s.count / showStats.max_per_group) * 100) : 0;
                  const weight = showStats?.weights?.[s.group_jid] ?? 1;
                  return (
                    <div key={i} className="space-y-1 border-b border-border/50 pb-2">
                      <div className="flex justify-between text-xs">
                        <span className="font-mono truncate max-w-[200px]">{s.group_jid}</span>
                        <span className="text-muted-foreground">{s.count}/{showStats?.max_per_group}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <Label className="text-[10px] text-muted-foreground w-12">Peso:</Label>
                        <Input
                          type="number"
                          min={0}
                          max={10}
                          step={1}
                          value={weight}
                          className="h-7 w-20 text-xs"
                          onChange={async (e) => {
                            const w = Math.max(0, Math.min(10, parseInt(e.target.value) || 1));
                            const newWeights = { ...(showStats?.weights || {}), [s.group_jid]: w };
                            setShowStats(prev => prev ? { ...prev, weights: newWeights } : prev);
                            await supabase
                              .from("imphq_wa_group_distributors")
                              .update({ weights: newWeights } as any)
                              .eq("id", showStats!.id);
                          }}
                        />
                        <span className="text-[10px] text-muted-foreground">
                          {weight === 0 ? "(pausado)" : weight === 1 ? "(padrão)" : `(${weight}x mais leads)`}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {clickStats.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum clique registrado ainda.</p>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

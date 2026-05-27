import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Link2, Copy, BarChart3, Power, PowerOff, RefreshCw, Search, Users, ChevronDown, ChevronRight, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { buildDistributorUrl } from "@/lib/whatsappUrls";

type PendingConfirm =
  | { kind: "delete_dist"; id: string; slug: string }
  | { kind: "remove_group"; jid: string }
  | { kind: "delete_week"; weekId: string; weekIndex: number }
  | { kind: "advance_now"; toIndex: number }
  | null;

const GROUPS_CACHE_TTL_MS = 5 * 60 * 1000;

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
  rotation_mode?: "none" | "weekly_current" | "weekly_cohort" | string;
  rotation_cron?: string | null;
  current_week?: number | null;
  last_rotation_at?: string | null;
}

interface WeekRow {
  id: string;
  distributor_id: string;
  week_index: number;
  group_jid: string;
  invite_url: string | null;
  start_at: string;
  archived_at: string | null;
}

interface WaCampaign {
  id: string;
  name: string;
  groups: string[];
}

interface Provider {
  id: string;
  instance_name?: string;
  display_name?: string | null;
  provider: string;
  project_id: string;
  is_active?: boolean;
}

interface GroupRow { id: string; subject: string }

export default function GroupDistributor() {
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [campaigns, setCampaigns] = useState<WaCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ slug: "", max_per_group: 250, campaign_id: "" });
  const [showStats, setShowStats] = useState<Distributor | null>(null);
  const [clickStats, setClickStats] = useState<{ group_jid: string; count: number }[]>([]);
  const [cardStats, setCardStats] = useState<Record<string, { group_jid: string; count: number }[]>>({});
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [weekClicks, setWeekClicks] = useState<Record<string, number>>({}); // key: `${week_index}|${group_jid}` -> count
  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, boolean>>({});
  const [newWeek, setNewWeek] = useState({ group_jid: "", invite_url: "", start_at: "" });
  const [newGroupJid, setNewGroupJid] = useState("");

  // ── Grupos do chip (Evolution) ──
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>(
    () => localStorage.getItem("wa.distributor.lastProviderId") || "",
  );
  const [availableGroups, setAvailableGroups] = useState<GroupRow[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");
  const [showManualJid, setShowManualJid] = useState(false);
  const groupsCacheRef = useRef<Map<string, { ts: number; rows: GroupRow[] }>>(new Map());
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [confirmAction, setConfirmAction] = useState<PendingConfirm>(null);
  const setBusyKey = (k: string, v: boolean) => setBusy(p => ({ ...p, [k]: v }));

  const fetchGroups = useCallback(async (providerId: string, force = false) => {
    if (!providerId) return;
    const cached = groupsCacheRef.current.get(providerId);
    if (!force && cached && Date.now() - cached.ts < GROUPS_CACHE_TTL_MS) {
      setAvailableGroups(cached.rows);
      return;
    }
    setLoadingGroups(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-api", {
        body: { action: "fetch_groups", provider_id: providerId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const rows = (data?.groups || []) as GroupRow[];
      groupsCacheRef.current.set(providerId, { ts: Date.now(), rows });
      setAvailableGroups(rows);
    } catch (e: any) {
      toast.error("Erro ao buscar grupos: " + e.message);
      setAvailableGroups([]);
    }
    setLoadingGroups(false);
  }, []);


  const addGroupToDistributor = async () => {
    if (!showStats) return;
    const jid = newGroupJid.trim();
    if (!jid) { toast.error("Informe o JID do grupo"); return; }
    const current = showStats.redirect_order || [];
    if (current.includes(jid)) { toast.error("Grupo já está na lista"); return; }
    const next = [...current, jid];
    const { error } = await supabase
      .from("imphq_wa_group_distributors")
      .update({ redirect_order: next as any })
      .eq("id", showStats.id);
    if (error) { toast.error(error.message); return; }
    setShowStats(prev => prev ? { ...prev, redirect_order: next } : prev);
    setClickStats(prev => [...prev, { group_jid: jid, count: 0 }]);
    setNewGroupJid("");
    toast.success("Grupo adicionado");
  };

  const removeGroupFromDistributor = (jid: string) => {
    setConfirmAction({ kind: "remove_group", jid });
  };

  const doRemoveGroup = async (jid: string) => {
    if (!showStats) return;
    setBusyKey(`group:${jid}`, true);
    const next = (showStats.redirect_order || []).filter(g => g !== jid);
    const newWeights = { ...(showStats.weights || {}) };
    delete newWeights[jid];
    const newInvites = { ...(showStats.group_invites || {}) };
    delete newInvites[jid];
    const { error } = await supabase
      .from("imphq_wa_group_distributors")
      .update({ redirect_order: next as any, weights: newWeights as any, group_invites: newInvites as any })
      .eq("id", showStats.id);
    setBusyKey(`group:${jid}`, false);
    if (error) { toast.error(error.message); return; }
    setShowStats(prev => prev ? { ...prev, redirect_order: next, weights: newWeights, group_invites: newInvites } : prev);
    setClickStats(prev => prev.filter(s => s.group_jid !== jid));
    toast.success("Grupo removido");
  };

  const loadWeeks = useCallback(async (distId: string) => {
    const { data } = await supabase
      .from("imphq_wa_distributor_weeks" as any)
      .select("*")
      .eq("distributor_id", distId)
      .order("week_index", { ascending: true });
    const rows = ((data as any[]) || []) as WeekRow[];
    setWeeks(rows);

    // 1 query agregada: pega todos os cliques desse distribuidor e agrupa local
    // por (week_index, group_jid) usando o start_at de cada semana como janela.
    const counts: Record<string, number> = {};
    if (rows.length > 0) {
      const minStart = rows.reduce(
        (m, w) => (w.start_at < m ? w.start_at : m),
        rows[0].start_at,
      );
      const { data: clicks } = await supabase
        .from("imphq_wa_distributor_clicks")
        .select("group_jid, created_at")
        .eq("distributor_id", distId)
        .gte("created_at", minStart);
      const byJid = new Map<string, string[]>();
      for (const c of clicks || []) {
        const arr = byJid.get(c.group_jid) || [];
        arr.push(c.created_at);
        byJid.set(c.group_jid, arr);
      }
      for (const w of rows) {
        const arr = byJid.get(w.group_jid) || [];
        counts[`${w.week_index}|${w.group_jid}`] = arr.filter(t => t >= w.start_at).length;
      }
    }
    setWeekClicks(counts);
  }, []);

  useEffect(() => {
    if (showStats?.id) loadWeeks(showStats.id);
    else setWeeks([]);
  }, [showStats?.id, loadWeeks]);

  const updateRotation = async (patch: Partial<Distributor>) => {
    if (!showStats) return;
    setShowStats(prev => prev ? { ...prev, ...patch } : prev);
    await supabase
      .from("imphq_wa_group_distributors")
      .update(patch as any)
      .eq("id", showStats.id);
  };

  const addWeek = async () => {
    if (!showStats || !newWeek.group_jid.trim()) {
      toast.error("Informe o JID do grupo da nova semana");
      return;
    }
    const nextIdx = (weeks[weeks.length - 1]?.week_index || 0) + 1;
    const { error } = await supabase.from("imphq_wa_distributor_weeks" as any).insert({
      distributor_id: showStats.id,
      week_index: nextIdx,
      group_jid: newWeek.group_jid.trim(),
      invite_url: newWeek.invite_url.trim() || null,
      start_at: newWeek.start_at || new Date().toISOString(),
    });
    if (error) { toast.error(error.message); return; }
    setNewWeek({ group_jid: "", invite_url: "", start_at: "" });
    await loadWeeks(showStats.id);
    toast.success(`Semana ${nextIdx} adicionada`);
  };

  const advanceNow = () => {
    if (!showStats) return;
    const next = weeks.find(w => w.week_index > (showStats.current_week || 1) && !w.archived_at);
    if (!next) { toast.error("Sem próxima semana cadastrada"); return; }
    setConfirmAction({ kind: "advance_now", toIndex: next.week_index });
  };

  const doAdvance = async (toIndex: number) => {
    if (!showStats) return;
    setBusyKey("advance", true);
    await supabase
      .from("imphq_wa_distributor_weeks" as any)
      .update({ archived_at: new Date().toISOString() })
      .eq("distributor_id", showStats.id)
      .eq("week_index", showStats.current_week || 1);
    await updateRotation({ current_week: toIndex, last_rotation_at: new Date().toISOString() });
    await loadWeeks(showStats.id);
    setBusyKey("advance", false);
    toast.success(`Avançou para semana ${toIndex}`);
  };

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

    // 1 query agregada: pega todos os cliques de todos os distribuidores
    // e agrupa local por distributor_id + group_jid (substitui N×M counts).
    if (dists.length > 0) {
      const stats: Record<string, { group_jid: string; count: number }[]> = {};
      const initOrder: Record<string, string[]> = {};
      for (const d of dists) {
        initOrder[d.id] = d.redirect_order || [];
        stats[d.id] = (d.redirect_order || []).map((jid: string) => ({ group_jid: jid, count: 0 }));
      }
      const { data: allClicks } = await supabase
        .from("imphq_wa_distributor_clicks")
        .select("distributor_id, group_jid")
        .in("distributor_id", dists.map(d => d.id));
      const tally = new Map<string, number>();
      for (const c of allClicks || []) {
        const key = `${c.distributor_id}|${c.group_jid}`;
        tally.set(key, (tally.get(key) || 0) + 1);
      }
      for (const d of dists) {
        stats[d.id] = (initOrder[d.id] || []).map(jid => ({
          group_jid: jid,
          count: tally.get(`${d.id}|${jid}`) || 0,
        }));
      }
      setCardStats(stats);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Carrega chips Evolution ativos
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("imphq_wa_providers")
        .select("id, instance_name, display_name, provider, project_id, is_active")
        .eq("is_active", true)
        .eq("provider", "evolution")
        .order("created_at");
      const list = (data as any[]) || [];
      setProviders(list);
      if (!selectedProviderId && list.length > 0) {
        setSelectedProviderId(list[0].id);
        localStorage.setItem("wa.distributor.lastProviderId", list[0].id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quando abre o modal, busca grupos se já existe um chip selecionado
  useEffect(() => {
    if (showStats && selectedProviderId && availableGroups.length === 0 && !loadingGroups) {
      fetchGroups(selectedProviderId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showStats?.id]);


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
    setBusyKey(`active:${dist.id}`, true);
    await supabase
      .from("imphq_wa_group_distributors")
      .update({ is_active: !dist.is_active } as any)
      .eq("id", dist.id);
    toast.success(dist.is_active ? "Desativado" : "Ativado");
    await load();
    setBusyKey(`active:${dist.id}`, false);
  };

  const deleteDist = (dist: Distributor) => {
    setConfirmAction({ kind: "delete_dist", id: dist.id, slug: dist.slug });
  };

  const doDeleteDist = async (id: string) => {
    setBusyKey(`del:${id}`, true);
    await supabase.from("imphq_wa_group_distributors").delete().eq("id", id);
    setBusyKey(`del:${id}`, false);
    toast.success("Excluído");
    load();
  };

  const copyLink = (slug: string) => {
    const url = buildDistributorUrl(slug);
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

  const totalClicks = distributors.reduce((acc, d) => acc + (d.click_count || 0), 0);
  const totalActive = distributors.filter(d => d.is_active).length;

  return (
    <div className="p-4 space-y-5">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-xl border border-gold/20 bg-gradient-to-br from-gold/10 via-secondary/40 to-background p-5">
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-gold/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h2 className="font-display text-2xl text-gold flex items-center gap-2">
              <Link2 className="h-5 w-5" /> Distribuidor de Grupos
            </h2>
            <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
              Links inteligentes que distribuem leads entre grupos automaticamente, evitando filas cheias e queimadas.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-display text-foreground">{totalClicks.toLocaleString("pt-BR")}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">cliques totais</div>
            </div>
            <div className="text-right border-l border-border/40 pl-4">
              <div className="text-2xl font-display text-gold">{totalActive}<span className="text-base text-muted-foreground">/{distributors.length}</span></div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">ativos</div>
            </div>
            <Button size="sm" className="bg-gold text-background hover:bg-gold/90 shadow-lg shadow-gold/20" onClick={() => { generateSlug(); setShowCreate(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Novo Link
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : distributors.length === 0 ? (
        <Card className="border-dashed border-gold/20">
          <CardContent className="p-12 text-center space-y-3">
            <div className="mx-auto w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center">
              <Link2 className="h-8 w-8 text-gold" />
            </div>
            <p className="text-foreground font-display text-lg">Nenhum link criado ainda</p>
            <p className="text-muted-foreground text-xs max-w-sm mx-auto leading-relaxed">
              Crie um link único que rotaciona leads entre seus grupos de WhatsApp, com limites e contingência.
            </p>
            <Button size="sm" className="mt-2" onClick={() => { generateSlug(); setShowCreate(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Criar primeiro link
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {distributors.map(d => {
            const stats = cardStats[d.id] || [];
            const maxCount = Math.max(1, ...stats.map(s => s.count));
            const fullestPct = stats.length ? Math.round((maxCount / (d.max_per_group || 250)) * 100) : 0;
            const fullUrl = buildDistributorUrl(d.slug);
            const progressColor = fullestPct >= 90 ? "bg-destructive" : fullestPct >= 70 ? "bg-amber-500" : "bg-gold";
            return (
            <Card key={d.id} className="group relative overflow-hidden hover:border-gold/40 hover:shadow-lg hover:shadow-gold/5 transition-all duration-200">
              <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${d.is_active ? "bg-gold" : "bg-muted-foreground/40"}`} />
              <CardContent className="p-4 pl-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${d.is_active ? "bg-gold/15 text-gold" : "bg-muted/40 text-muted-foreground"}`}>
                        <Link2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold">{d.slug}</span>
                          <Badge className={`text-[10px] ${d.is_active ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-muted text-muted-foreground"}`}>
                            {d.is_active ? "● ativo" : "○ inativo"}
                          </Badge>
                          {d.rotation_mode && d.rotation_mode !== "none" && (
                            <Badge variant="outline" className="text-[10px] border-gold/40 text-gold">
                              🔄 Semana {d.current_week || 1}
                            </Badge>
                          )}
                        </div>
                        <button
                          onClick={() => copyLink(d.slug)}
                          title="Clique para copiar"
                          className="block max-w-full truncate text-[10px] text-muted-foreground/70 font-mono hover:text-gold transition-colors text-left mt-0.5"
                        >
                          {fullUrl}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/60 border border-border/40 text-muted-foreground">
                        📢 {campaignName(d.campaign_id)}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/60 border border-border/40 text-muted-foreground">
                        👥 {(d.redirect_order || []).length} grupos
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/10 border border-gold/30 text-gold">
                        🖱️ {d.click_count} cliques
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/60 border border-border/40 text-muted-foreground">
                        🔒 máx {d.max_per_group}
                      </span>
                    </div>

                    {/* Progress bar for fullest group */}
                    {stats.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-muted-foreground">Grupo mais cheio</span>
                          <span className={fullestPct >= 90 ? "text-destructive font-semibold" : fullestPct >= 70 ? "text-amber-400 font-semibold" : "text-muted-foreground"}>
                            {fullestPct}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                          <div className={`h-full ${progressColor} transition-all duration-500`} style={{ width: `${Math.min(100, fullestPct)}%` }} />
                        </div>
                      </div>
                    )}

                    {/* Sparkline */}
                    {stats.length > 0 && (
                      <div className="flex items-end gap-0.5 h-7">
                        {stats.slice(0, 32).map((s, i) => {
                          const h = Math.max(3, (s.count / maxCount) * 100);
                          const pct = (s.count / (d.max_per_group || 250)) * 100;
                          const color = pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-amber-500" : "bg-gold/70";
                          return (
                            <div
                              key={i}
                              className={`flex-1 max-w-[8px] rounded-sm ${color} hover:opacity-100 opacity-80 transition-all`}
                              style={{ height: `${h}%` }}
                              title={`${s.count} cliques (${Math.round(pct)}%)`}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-gold/10 hover:text-gold" onClick={() => copyLink(d.slug)} title="Copiar link">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-gold/10 hover:text-gold" onClick={() => openStats(d)} title="Estatísticas">
                      <BarChart3 className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" disabled={!!busy[`active:${d.id}`]} onClick={() => toggleActive(d)} title={d.is_active ? "Desativar" : "Ativar"}>
                      {busy[`active:${d.id}`] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : d.is_active ? <PowerOff className="h-3.5 w-3.5 text-amber-400" /> : <Power className="h-3.5 w-3.5 text-emerald-400" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" disabled={!!busy[`del:${d.id}`]} onClick={() => deleteDist(d)}>
                      {busy[`del:${d.id}`] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display text-xl text-gold">Estatísticas — {showStats?.slug}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {/* Rotação semanal */}
            <div className="bg-secondary/40 rounded-md p-3 border border-border/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-display text-sm text-gold">🔄 Rotação semanal</div>
                {showStats?.rotation_mode && showStats.rotation_mode !== "none" && (
                  <Badge variant="outline" className="text-[10px]">
                    Semana {showStats.current_week || 1}{weeks.length ? ` / ${weeks.length}` : ""}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Modo</Label>
                  <Select
                    value={showStats?.rotation_mode || "none"}
                    onValueChange={(v) => updateRotation({ rotation_mode: v as any })}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum (peso/sequencial)</SelectItem>
                      <SelectItem value="weekly_current">Semana corrente</SelectItem>
                      <SelectItem value="weekly_cohort">Cohort fixo por lead</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Cron de avanço</Label>
                  <Select
                    value={showStats?.rotation_cron || "0 9 * * 1"}
                    onValueChange={(v) => updateRotation({ rotation_cron: v })}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0 9 * * 1">Toda segunda 09h</SelectItem>
                      <SelectItem value="0 9 * * 4">Toda quinta 09h</SelectItem>
                      <SelectItem value="0 20 * * 0">Todo domingo 20h</SelectItem>
                      <SelectItem value="0 9 * * 6">Todo sábado 09h</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {showStats?.rotation_mode && showStats.rotation_mode !== "none" && (
                <>
                  <div className="text-[11px] text-muted-foreground bg-muted/30 p-2 rounded leading-7">
                    {showStats.rotation_mode === "weekly_current"
                      ? "✦ Todo lead que clicar é redirecionado para o grupo da semana corrente. Ideal para webinars evergreen com reset semanal."
                      : "✦ Cada lead fica fixo no grupo da semana em que clicou pela primeira vez (cohort). Ideal para sequência de aquecimento."}
                  </div>
                  <div className="space-y-1.5">
                    {weeks.map((w, idx) => {
                      const isActive = w.week_index === (showStats.current_week || 1) && !w.archived_at;
                      const isOpen = !!expandedWeeks[w.id];
                      const subject = availableGroups.find(g => g.id === w.group_jid)?.subject;
                      const clicks = weekClicks[`${w.week_index}|${w.group_jid}`] ?? 0;
                      const max = showStats.max_per_group || 250;
                      const pct = Math.min(100, Math.round((clicks / max) * 100));
                      const vagas = Math.max(0, max - clicks);
                      const nextWeek = weeks[idx + 1];
                      const endAt = w.archived_at || nextWeek?.start_at || null;
                      return (
                        <div key={w.id} className={`text-xs rounded border ${isActive ? "border-gold/60 bg-gold/5" : w.archived_at ? "border-border/30 bg-muted/20 opacity-70" : "border-border/40"}`}>
                          <div
                            className="flex items-center gap-2 p-2 cursor-pointer hover:bg-muted/20"
                            onClick={() => setExpandedWeeks(p => ({ ...p, [w.id]: !p[w.id] }))}
                          >
                            {isOpen ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
                            <Badge variant={isActive ? "default" : "outline"} className="text-[10px] shrink-0">S{w.week_index}</Badge>
                            <div className="flex-1 min-w-0">
                              <div className="truncate font-medium">{subject || <span className="font-mono text-muted-foreground">{w.group_jid}</span>}</div>
                              {subject && <div className="font-mono truncate text-[10px] text-muted-foreground">{w.group_jid}</div>}
                            </div>
                            <div className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                              {clicks}/{max}
                            </div>
                            <div className="text-[10px] text-muted-foreground shrink-0">
                              {w.archived_at ? "🗄 arquivada" : isActive ? "✓ ativa" : new Date(w.start_at).toLocaleDateString("pt-BR")}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmAction({ kind: "delete_week", weekId: w.id, weekIndex: w.week_index });
                              }}
                            ><Trash2 className="h-3 w-3" /></Button>
                          </div>
                          {isOpen && (
                            <div className="border-t border-border/40 p-3 space-y-2 bg-background/40">
                              <div className="grid grid-cols-[80px_1fr_auto] items-center gap-2">
                                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">JID</span>
                                <span className="font-mono text-[11px] truncate">{w.group_jid}</span>
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { navigator.clipboard.writeText(w.group_jid); toast.success("JID copiado"); }}>
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                              {w.invite_url && (
                                <div className="grid grid-cols-[80px_1fr_auto_auto] items-center gap-2">
                                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Convite</span>
                                  <span className="font-mono text-[11px] truncate text-emerald-400">{w.invite_url}</span>
                                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { navigator.clipboard.writeText(w.invite_url!); toast.success("Link copiado"); }}>
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => window.open(w.invite_url!, "_blank")}>
                                    <ExternalLink className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                              <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Início</span>
                                <span className="text-[11px]">{new Date(w.start_at).toLocaleString("pt-BR")}</span>
                              </div>
                              {endAt && (
                                <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{w.archived_at ? "Arquivada" : "Próx. troca"}</span>
                                  <span className="text-[11px]">{new Date(endAt).toLocaleString("pt-BR")}</span>
                                </div>
                              )}
                              <div className="space-y-1 pt-1">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="text-muted-foreground">Cliques nesta semana</span>
                                  <span className="tabular-nums">
                                    <span className="font-medium">{clicks}</span>
                                    <span className="text-muted-foreground"> / {max}</span>
                                    <span className="text-muted-foreground"> · {vagas} vagas</span>
                                  </span>
                                </div>
                                <div className="h-1.5 w-full rounded bg-muted/40 overflow-hidden">
                                  <div
                                    className={`h-full transition-all ${pct >= 80 ? "bg-gold" : pct >= 50 ? "bg-emerald-500" : "bg-primary/60"}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                              {!subject && selectedProviderId && (
                                <button
                                  className="text-[10px] text-primary hover:underline"
                                  onClick={() => fetchGroups(selectedProviderId)}
                                >↻ buscar nome do grupo</button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-[1fr_1fr_120px_auto] gap-1.5">
                    <Input placeholder="JID grupo" value={newWeek.group_jid} onChange={(e) => setNewWeek(p => ({ ...p, group_jid: e.target.value }))} className="h-8 text-xs font-mono" />
                    <Input placeholder="https://chat.whatsapp.com/..." value={newWeek.invite_url} onChange={(e) => setNewWeek(p => ({ ...p, invite_url: e.target.value }))} className="h-8 text-xs font-mono" />
                    <Input type="datetime-local" value={newWeek.start_at} onChange={(e) => setNewWeek(p => ({ ...p, start_at: e.target.value }))} className="h-8 text-xs" />
                    <Button size="sm" className="h-8" onClick={addWeek}><Plus className="h-3 w-3 mr-1" />Semana</Button>
                  </div>
                  <Button size="sm" variant="outline" className="w-full h-8 text-xs" onClick={advanceNow}>
                    ⏭ Avançar agora (manual)
                  </Button>
                </>
              )}
            </div>

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
              💡 <b>Pesos</b> (1-10) distribuem mais leads em grupos específicos. <b>Link de convite</b> habilita redirect 302 direto ao WhatsApp (chat.whatsapp.com/...).
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
                      <div className="flex items-center gap-2">
                        <Label className="text-[10px] text-muted-foreground w-12">Link:</Label>
                        <Input
                          type="url"
                          placeholder="https://chat.whatsapp.com/..."
                          defaultValue={showStats?.group_invites?.[s.group_jid] || ""}
                          className="h-7 flex-1 text-xs font-mono"
                          onBlur={async (e) => {
                            const url = e.target.value.trim();
                            const cur = showStats?.group_invites || {};
                            const next = { ...cur };
                            if (url) next[s.group_jid] = url; else delete next[s.group_jid];
                            setShowStats(prev => prev ? { ...prev, group_invites: next } : prev);
                            await supabase
                              .from("imphq_wa_group_distributors")
                              .update({ group_invites: next } as any)
                              .eq("id", showStats!.id);
                            toast.success("Convite salvo");
                          }}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => removeGroupFromDistributor(s.group_jid)}
                          title="Remover grupo do distribuidor"
                        ><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  );
                })}
                {clickStats.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum grupo configurado. Adicione abaixo.</p>
                )}
                {/* Picker de grupos do chip */}
                <div className="pt-3 border-t border-border/40 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <Users className="h-3 w-3" /> Adicionar grupo do chip
                    </Label>
                    <button
                      type="button"
                      className="text-[10px] text-muted-foreground hover:text-gold underline-offset-2 hover:underline"
                      onClick={() => setShowManualJid(v => !v)}
                    >
                      {showManualJid ? "← voltar à lista" : "colar JID manualmente"}
                    </button>
                  </div>

                  {showManualJid ? (
                    <div className="flex gap-1.5">
                      <Input
                        placeholder="JID do grupo (ex: 12036...@g.us)"
                        value={newGroupJid}
                        onChange={(e) => setNewGroupJid(e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                      <Button size="sm" className="h-8" onClick={addGroupToDistributor}>
                        <Plus className="h-3 w-3 mr-1" />Grupo
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-1.5">
                        <Select
                          value={selectedProviderId || undefined}
                          onValueChange={(v) => { setSelectedProviderId(v); localStorage.setItem("wa.distributor.lastProviderId", v); fetchGroups(v); }}
                        >
                          <SelectTrigger className="h-8 text-xs flex-1">
                            <SelectValue placeholder="Selecione o chip" />
                          </SelectTrigger>
                          <SelectContent>
                            {providers.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.display_name || p.instance_name || p.id}
                              </SelectItem>
                            ))}
                            {providers.length === 0 && (
                              <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum chip Evolution ativo</div>
                            )}
                          </SelectContent>
                        </Select>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 shrink-0"
                          disabled={!selectedProviderId || loadingGroups}
                          onClick={() => fetchGroups(selectedProviderId, true)}
                          title="Recarregar grupos"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${loadingGroups ? "animate-spin" : ""}`} />
                        </Button>
                      </div>

                      {selectedProviderId && (
                        <>
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                            <Input
                              placeholder={`Buscar entre ${availableGroups.length} grupos...`}
                              value={groupSearch}
                              onChange={(e) => setGroupSearch(e.target.value)}
                              className="h-8 pl-7 text-xs"
                            />
                          </div>
                          <div className="max-h-56 overflow-y-auto rounded-md border border-border/40 bg-background/40 divide-y divide-border/30">
                            {loadingGroups ? (
                              <p className="text-xs text-muted-foreground text-center py-4">Carregando grupos…</p>
                            ) : availableGroups.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-4">Nenhum grupo encontrado neste chip.</p>
                            ) : (
                              availableGroups
                                .filter(g => {
                                  const q = groupSearch.trim().toLowerCase();
                                  if (!q) return true;
                                  return (g.subject || "").toLowerCase().includes(q) || g.id.toLowerCase().includes(q);
                                })
                                .slice(0, 200)
                                .map(g => {
                                  const already = (showStats?.redirect_order || []).includes(g.id);
                                  return (
                                    <div key={g.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted/30">
                                      <div className="flex-1 min-w-0">
                                        <div className="text-xs truncate">{g.subject || "(sem nome)"}</div>
                                        <div className="text-[10px] font-mono text-muted-foreground truncate">{g.id}</div>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 px-2 text-[10px] shrink-0"
                                        disabled={already}
                                        onClick={async () => {
                                          setNewGroupJid(g.id);
                                          // adiciona direto
                                          if (already) return;
                                          const current = showStats!.redirect_order || [];
                                          const next = [...current, g.id];
                                          const { error } = await supabase
                                            .from("imphq_wa_group_distributors")
                                            .update({ redirect_order: next as any })
                                            .eq("id", showStats!.id);
                                          if (error) { toast.error(error.message); return; }
                                          setShowStats(prev => prev ? { ...prev, redirect_order: next } : prev);
                                          setClickStats(prev => [...prev, { group_jid: g.id, count: 0 }]);
                                          toast.success(`+ ${g.subject || g.id.slice(0, 8)}`);
                                        }}
                                        title={already ? "Já está no distribuidor" : "Adicionar ao distribuidor"}
                                      >
                                        {already ? "✓ no distrib." : <><Plus className="h-3 w-3 mr-0.5" />Distrib.</>}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 px-2 text-[10px] shrink-0 text-gold hover:text-gold"
                                        onClick={() => {
                                          setNewWeek(p => ({ ...p, group_jid: g.id }));
                                          toast.info("JID copiado para 'Nova semana'");
                                        }}
                                        title="Usar como JID da próxima semana de rotação"
                                      >
                                        → Semana
                                      </Button>
                                    </div>
                                  );
                                })
                            )}
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useState, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { SectionInfo } from "@/components/SectionInfo";
import { sectionHelpTexts } from "@/data/sectionHelpTexts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Play, Pause, Trash2, Settings2, Users, ListOrdered, Calendar, History, Search, Cog, Copy, Clock } from "lucide-react";
import { toast } from "sonner";
import CampaignStepEditor from "./CampaignStepEditor";
import CampaignLogViewer from "./CampaignLogViewer";
import CampaignKPICards from "./CampaignKPICards";
import CampaignAutomationPanel from "./CampaignAutomationPanel";

interface Campaign {
  id: string;
  project_id: string | null;
  provider_id: string | null;
  name: string;
  produto: string | null;
  status: string;
  groups: string[];
  start_date: string | null;
  exit_message: string | null;
  welcome_message: string | null;
  anti_hack: boolean;
  mention_all: boolean;
  created_at: string;
}

interface Props {
  projects: { id: string; name: string }[];
  providers: any[];
}

export default function CampaignManager({ projects, providers }: Props) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null);
  const [showSteps, setShowSteps] = useState<Campaign | null>(null);
  const [showLogs, setShowLogs] = useState<Campaign | null>(null);
  const [showGroups, setShowGroups] = useState<Campaign | null>(null);
  const [showAutomation, setShowAutomation] = useState<Campaign | null>(null);
  const [form, setForm] = useState({
    name: "",
    project_id: "",
    provider_id: "",
    start_date: "",
    produto: "",
    exit_message: "",
    send_window_start: "08:00",
    send_window_end: "22:00",
  });
  const [nextSteps, setNextSteps] = useState<Record<string, { date: string; time: string; preview: string } | null>>({});
  const [availableGroups, setAvailableGroups] = useState<{ id: string; subject: string }[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("imphq_wa_campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    const campaignsData = (data as any[]) || [];
    setCampaigns(campaignsData);
    setLoading(false);

    // Compute next scheduled step per campaign
    if (campaignsData.length > 0) {
      const ids = campaignsData.map((c) => c.id);
      const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const { data: stepsData } = await supabase
        .from("imphq_wa_campaign_steps")
        .select("campaign_id, content, send_date, send_time, days_offset, is_active")
        .in("campaign_id", ids)
        .eq("is_active", true);
      const map: Record<string, { date: string; time: string; preview: string } | null> = {};
      for (const c of campaignsData) {
        const stepsForCamp = (stepsData || []).filter((s: any) => s.campaign_id === c.id);
        // Find next step >= today (or matching offset for today)
        const upcoming = stepsForCamp
          .map((s: any) => {
            const date = s.send_date || todayStr;
            return { ...s, _date: date };
          })
          .filter((s: any) => s._date >= todayStr)
          .sort((a: any, b: any) => {
            if (a._date !== b._date) return a._date < b._date ? -1 : 1;
            return (a.send_time || "").localeCompare(b.send_time || "");
          });
        const next = upcoming[0];
        map[c.id] = next
          ? {
              date: next._date,
              time: (next.send_time || "09:00").slice(0, 5),
              preview: (next.content || "").slice(0, 40),
            }
          : null;
      }
      setNextSteps(map);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () =>
    setForm({
      name: "",
      project_id: "",
      provider_id: "",
      start_date: "",
      produto: "",
      exit_message: "",
      send_window_start: "08:00",
      send_window_end: "22:00",
    });

  const createCampaign = async () => {
    if (!form.name) {
      toast.error("Nome obrigatório");
      return;
    }
    const { error } = await supabase.from("imphq_wa_campaigns").insert({
      name: form.name,
      project_id: form.project_id || null,
      provider_id: form.provider_id || null,
      produto: form.produto || null,
      start_date: form.start_date || null,
      exit_message: form.exit_message || null,
      send_window_start: form.send_window_start || "08:00",
      send_window_end: form.send_window_end || "22:00",
      status: "draft",
      groups: [] as any,
    } as any);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Campanha criada!");
    setShowCreate(false);
    resetForm();
    load();
  };

  const duplicateCampaign = async (c: Campaign) => {
    // 1. Insert new campaign as draft
    const { data: newCamp, error: cErr } = await supabase
      .from("imphq_wa_campaigns")
      .insert({
        name: `${c.name} (cópia)`,
        project_id: c.project_id,
        provider_id: c.provider_id,
        produto: c.produto,
        start_date: null,
        status: "draft",
        groups: c.groups as any,
        welcome_message: c.welcome_message,
        exit_message: c.exit_message,
        anti_hack: c.anti_hack,
        mention_all: c.mention_all,
      } as any)
      .select()
      .single();
    if (cErr || !newCamp) {
      toast.error(cErr?.message || "Erro ao duplicar");
      return;
    }
    // 2. Duplicate steps
    const { data: srcSteps } = await supabase
      .from("imphq_wa_campaign_steps")
      .select("*")
      .eq("campaign_id", c.id)
      .order("step_order");
    if (srcSteps && srcSteps.length > 0) {
      const cloned = srcSteps.map((s: any) => ({
        campaign_id: newCamp.id,
        step_order: s.step_order,
        content: s.content,
        media_url: s.media_url,
        media_type: s.media_type,
        send_time: s.send_time,
        days_offset: s.days_offset,
        send_date: null, // reset specific dates
        is_active: s.is_active,
      }));
      await supabase.from("imphq_wa_campaign_steps").insert(cloned as any);
    }
    toast.success(`Campanha duplicada (${srcSteps?.length || 0} steps)`);
    load();
  };

  const toggleStatus = async (campaign: Campaign) => {
    const newStatus = campaign.status === "active" ? "paused" : "active";
    await supabase.from("imphq_wa_campaigns").update({ status: newStatus } as any).eq("id", campaign.id);
    toast.success(`Campanha ${newStatus === "active" ? "ativada" : "pausada"}`);
    load();
  };

  const deleteCampaign = async (id: string) => {
    await supabase.from("imphq_wa_campaigns").delete().eq("id", id);
    toast.success("Campanha excluída");
    load();
  };

  const fetchGroups = async (providerId: string) => {
    if (!providerId) return;
    setLoadingGroups(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-api", {
        body: { action: "fetch_groups", provider_id: providerId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAvailableGroups(data?.groups || []);
    } catch (e: any) {
      toast.error("Erro ao buscar grupos: " + e.message);
    }
    setLoadingGroups(false);
  };

  const openGroupSelector = async (campaign: Campaign) => {
    if (!campaign.provider_id) {
      toast.error("Configure um Provider para esta campanha antes de buscar grupos.");
      return;
    }
    setShowGroups(campaign);
    setSelectedGroups(Array.isArray(campaign.groups) ? campaign.groups : []);
    await fetchGroups(campaign.provider_id);
  };

  const saveGroups = async () => {
    if (!showGroups) return;
    await supabase.from("imphq_wa_campaigns").update({ groups: selectedGroups as any } as any).eq("id", showGroups.id);
    toast.success("Grupos salvos!");
    setShowGroups(null);
    load();
  };

  const toggleGroup = (jid: string) => {
    setSelectedGroups(prev => prev.includes(jid) ? prev.filter(g => g !== jid) : [...prev, jid]);
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-muted text-muted-foreground",
      active: "bg-emerald-500/20 text-emerald-400",
      paused: "bg-amber-500/20 text-amber-400",
      completed: "bg-blue-500/20 text-blue-400",
    };
    return <Badge className={`text-[10px] ${colors[status] || ""}`}>{status}</Badge>;
  };

  const projectName = (id: string | null) => projects.find(p => p.id === id)?.name || "—";

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">📢 Campanhas <SectionInfo {...sectionHelpTexts.campanhas_whatsapp} /></h2>
          <p className="text-xs text-muted-foreground">Sequências automáticas de mensagens para grupos WhatsApp</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Nova Campanha
        </Button>
      </div>

      <CampaignKPICards />

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : campaigns.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground text-sm">Nenhuma campanha criada ainda.</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowCreate(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Criar primeira campanha
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {campaigns.map(c => (
            <Card key={c.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm">{c.name}</h3>
                      {statusBadge(c.status)}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                      <span>📁 {projectName(c.project_id)}</span>
                      <span>👥 {Array.isArray(c.groups) ? c.groups.length : 0} grupos</span>
                      {c.start_date && <span>📅 Início: {c.start_date}</span>}
                      {c.exit_message && <span>🚪 Msg saída ✓</span>}
                      {nextSteps[c.id] && (
                        <span className="text-primary flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Próximo: {nextSteps[c.id]!.date.split("-").reverse().join("/")} {nextSteps[c.id]!.time}
                          {nextSteps[c.id]!.preview && ` — ${nextSteps[c.id]!.preview}…`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openGroupSelector(c)} title="Grupos">
                      <Users className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowSteps(c)} title="Sequência">
                      <ListOrdered className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowLogs(c)} title="Logs">
                      <History className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowAutomation(c)} title="Automações">
                      <Cog className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => duplicateCampaign(c)} title="Duplicar">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => toggleStatus(c)}
                      title={c.status === "active" ? "Pausar" : "Ativar"}
                    >
                      {c.status === "active" ? <Pause className="h-3.5 w-3.5 text-amber-400" /> : <Play className="h-3.5 w-3.5 text-emerald-400" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteCampaign(c.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Campaign Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Campanha</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome da campanha</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Lançamento Curso X" /></div>
            <div><Label>Produto</Label><Input value={form.produto} onChange={e => setForm({ ...form, produto: e.target.value })} placeholder="Ex: Mentoria Premium, Curso Y..." /></div>
            <div>
              <Label>Projeto</Label>
              <Select value={form.project_id} onValueChange={v => setForm({ ...form, project_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Provider</Label>
              <Select value={form.provider_id} onValueChange={v => setForm({ ...form, provider_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {providers.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.instance_name || p.twilio_from} ({p.provider})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data de início</Label>
              <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Janela início (anti-ban)</Label>
                <Input type="time" value={form.send_window_start} onChange={e => setForm({ ...form, send_window_start: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Janela fim</Label>
                <Input type="time" value={form.send_window_end} onChange={e => setForm({ ...form, send_window_end: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Mensagem de saída (quando alguém sai do grupo)</Label>
              <Textarea
                value={form.exit_message}
                onChange={e => setForm({ ...form, exit_message: e.target.value })}
                placeholder="Olá! Vi que saiu do grupo. Posso te ajudar com algo?"
                rows={2}
                className="text-xs"
              />
            </div>
          </div>
          <DialogFooter><Button onClick={createCampaign}>Criar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Group Selector Dialog */}
      <Dialog open={!!showGroups} onOpenChange={() => { setShowGroups(null); setGroupSearch(""); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Selecionar Grupos — {showGroups?.name}</DialogTitle></DialogHeader>
          {loadingGroups ? (
            <p className="text-sm text-muted-foreground py-4">Buscando grupos via Evolution API...</p>
          ) : availableGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhum grupo encontrado. Verifique se a instância está conectada.</p>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar grupo..."
                  value={groupSearch}
                  onChange={e => setGroupSearch(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
              <ScrollArea className="max-h-[350px]">
                <div className="space-y-1.5">
                  {availableGroups
                    .filter(g => !groupSearch || g.subject.toLowerCase().includes(groupSearch.toLowerCase()))
                    .map(g => (
                      <label key={g.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedGroups.includes(g.id)}
                          onChange={() => toggleGroup(g.id)}
                          className="rounded"
                        />
                        <span className="text-sm truncate">{g.subject}</span>
                        <span className="text-[10px] text-muted-foreground ml-auto">{g.id.slice(0, 15)}...</span>
                      </label>
                    ))}
                </div>
              </ScrollArea>
            </>
          )}
          <DialogFooter>
            <p className="text-xs text-muted-foreground mr-auto">{selectedGroups.length} selecionados</p>
            <Button onClick={saveGroups}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Steps Editor Dialog */}
      <Dialog open={!!showSteps} onOpenChange={() => setShowSteps(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader><DialogTitle>Sequência — {showSteps?.name}</DialogTitle></DialogHeader>
          {showSteps && <CampaignStepEditor campaignId={showSteps.id} projectId={showSteps.project_id || ""} produto={showSteps.produto || ""} />}
        </DialogContent>
      </Dialog>

      {/* Logs Dialog */}
      <Dialog open={!!showLogs} onOpenChange={() => setShowLogs(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader><DialogTitle>Logs — {showLogs?.name}</DialogTitle></DialogHeader>
          {showLogs && <CampaignLogViewer campaignId={showLogs.id} />}
        </DialogContent>
      </Dialog>

      {/* Automation Dialog */}
      <Dialog open={!!showAutomation} onOpenChange={() => setShowAutomation(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Automações — {showAutomation?.name}</DialogTitle></DialogHeader>
          {showAutomation && (
            <CampaignAutomationPanel
              campaignId={showAutomation.id}
              welcomeMessage={showAutomation.welcome_message}
              exitMessage={showAutomation.exit_message}
              antiHack={showAutomation.anti_hack}
              mentionAll={showAutomation.mention_all}
              onUpdate={load}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

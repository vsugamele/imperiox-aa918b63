import { useEffect, useState, useCallback } from "react";
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
import { Plus, Play, Pause, Trash2, Settings2, Users, ListOrdered, Calendar, History } from "lucide-react";
import { toast } from "sonner";
import CampaignStepEditor from "./CampaignStepEditor";
import CampaignLogViewer from "./CampaignLogViewer";

interface Campaign {
  id: string;
  project_id: string | null;
  provider_id: string | null;
  name: string;
  status: string;
  groups: string[];
  start_date: string | null;
  exit_message: string | null;
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
  const [form, setForm] = useState({ name: "", project_id: "", provider_id: "", start_date: "" });
  const [availableGroups, setAvailableGroups] = useState<{ id: string; subject: string }[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("imphq_wa_campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    setCampaigns((data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const createCampaign = async () => {
    if (!form.name) { toast.error("Nome obrigatório"); return; }
    const { error } = await supabase.from("imphq_wa_campaigns").insert({
      name: form.name,
      project_id: form.project_id || null,
      provider_id: form.provider_id || null,
      start_date: form.start_date || null,
      status: "draft",
      groups: [] as any,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Campanha criada!");
    setShowCreate(false);
    setForm({ name: "", project_id: "", provider_id: "", start_date: "" });
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

  const fetchGroups = async (provider: any) => {
    if (!provider) return;
    setLoadingGroups(true);
    try {
      const apiUrl = (provider.api_url || "").replace(/\/+$/, "");
      const res = await fetch(
        `${apiUrl}/group/fetchAllGroups/${encodeURIComponent(provider.instance_name)}?getParticipants=false`,
        { headers: { apikey: provider.api_key || "" } }
      );
      const data = await res.json();
      const groups = (Array.isArray(data) ? data : []).map((g: any) => ({
        id: g.id || g.jid,
        subject: g.subject || g.name || g.id,
      }));
      setAvailableGroups(groups);
    } catch (e: any) {
      toast.error("Erro ao buscar grupos: " + e.message);
    }
    setLoadingGroups(false);
  };

  const openGroupSelector = async (campaign: Campaign) => {
    setShowGroups(campaign);
    setSelectedGroups(Array.isArray(campaign.groups) ? campaign.groups : []);
    const provider = providers.find(p => p.id === campaign.provider_id);
    if (provider) await fetchGroups(provider);
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
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>📁 {projectName(c.project_id)}</span>
                      <span>👥 {Array.isArray(c.groups) ? c.groups.length : 0} grupos</span>
                      {c.start_date && <span>📅 Início: {c.start_date}</span>}
                      {c.exit_message && <span>🚪 Msg saída ✓</span>}
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
            <div>
              <Label>Mensagem de saída (quando alguém sai do grupo)</Label>
              <Textarea
                value={(form as any).exit_message || ""}
                onChange={e => setForm({ ...form, exit_message: e.target.value } as any)}
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
      <Dialog open={!!showGroups} onOpenChange={() => setShowGroups(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Selecionar Grupos — {showGroups?.name}</DialogTitle></DialogHeader>
          {loadingGroups ? (
            <p className="text-sm text-muted-foreground py-4">Buscando grupos via Evolution API...</p>
          ) : availableGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhum grupo encontrado. Verifique se a instância está conectada.</p>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-1.5">
                {availableGroups.map(g => (
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
          {showSteps && <CampaignStepEditor campaignId={showSteps.id} />}
        </DialogContent>
      </Dialog>

      {/* Logs Dialog */}
      <Dialog open={!!showLogs} onOpenChange={() => setShowLogs(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader><DialogTitle>Logs — {showLogs?.name}</DialogTitle></DialogHeader>
          {showLogs && <CampaignLogViewer campaignId={showLogs.id} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

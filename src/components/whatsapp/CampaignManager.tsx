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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Play, Pause, Trash2, Settings2, Users, ListOrdered, Calendar, History, Search, Cog, Copy, Clock, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import CampaignStepEditor from "./CampaignStepEditor";
import CampaignLogViewer from "./CampaignLogViewer";
import CampaignKPICards from "./CampaignKPICards";
import CampaignAutomationPanel from "./CampaignAutomationPanel";
import CampaignSettingsDialog from "./CampaignSettingsDialog";

interface Campaign {
  id: string;
  project_id: string | null;
  provider_id: string | null;
  name: string;
  produto: string | null;
  status: string;
  groups: string[];
  paused_groups: string[];
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
  const [showSettings, setShowSettings] = useState<Campaign | null>(null);
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
  const [stepCounts, setStepCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<"all" | "active" | "paused" | "draft">("all");
  const [search, setSearch] = useState("");
  const [availableGroups, setAvailableGroups] = useState<{ id: string; subject: string }[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");

  // AI generation states during campaign creation
  const [generateWithAI, setGenerateWithAI] = useState(false);
  const [aiCount, setAiCount] = useState(7);
  const [aiTom, setAiTom] = useState("vendas");
  const [includeAvatar, setIncludeAvatar] = useState(true);
  const [includeExpert, setIncludeExpert] = useState(true);
  const [includeProduct, setIncludeProduct] = useState(true);
  const [mainTheme, setMainTheme] = useState("");
  const [offerDetail, setOfferDetail] = useState("");
  const [briefing, setBriefing] = useState("");
  const [showAdvancedBriefing, setShowAdvancedBriefing] = useState(false);

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
        .in("campaign_id", ids);
      const map: Record<string, { date: string; time: string; preview: string } | null> = {};
      const counts: Record<string, number> = {};
      for (const c of campaignsData) {
        const stepsForCamp = (stepsData || []).filter((s: any) => s.campaign_id === c.id);
        counts[c.id] = stepsForCamp.filter((s: any) => s.is_active).length;
        const upcoming = stepsForCamp
          .filter((s: any) => s.is_active)
          .map((s: any) => ({ ...s, _date: s.send_date || todayStr }))
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
      setStepCounts(counts);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
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
    setGenerateWithAI(false);
    setAiCount(7);
    setAiTom("vendas");
    setIncludeAvatar(true);
    setIncludeExpert(true);
    setIncludeProduct(true);
    setMainTheme("");
    setOfferDetail("");
    setBriefing("");
    setShowAdvancedBriefing(false);
  };

  const createCampaign = async () => {
    if (!form.name) {
      toast.error("Nome obrigatório");
      return;
    }
    const { data: newCamp, error } = await supabase
      .from("imphq_wa_campaigns")
      .insert({
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
      } as any)
      .select()
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Campanha criada!");
    setShowCreate(false);

    if (generateWithAI && newCamp) {
      const structuredBriefing = [
        `[ESPECIFICAÇÕES DA SEQUÊNCIA]`,
        `- Tom de voz desejado: ${aiTom}`,
        `- Foco do Produto: ${form.produto || "Geral do Projeto"}`,
        ``,
        `[DADOS DO PROJETO INTEGRADOS]`,
        includeAvatar ? `- IMPORTANTE: Extraia e utilize ativamente as Dores, Desejos, Problemas e Perfil Psicológico do Avatar cadastrados no projeto para gerar conexão.` : "- Não carregar contexto de avatar.",
        includeExpert ? `- IMPORTANTE: Incorpore a Persona, Bio, Tom de voz e pilares do Expert do projeto para manter a autoridade.` : "- Não carregar contexto de expert.",
        includeProduct ? `- IMPORTANTE: Utilize a Promessa, Mecanismo Único e links de checkout dos Produtos cadastrados no projeto para acelerar as vendas.` : "- Não carregar contexto de produtos.",
        ``,
        `[PERGUNTAS DE ALINHAMENTO / ALVO]`,
        mainTheme.trim() ? `- Gancho/Tema Central da Sequência: ${mainTheme.trim()}` : "",
        offerDetail.trim() ? `- Detalhes da Oferta/Bônus/Escassez: ${offerDetail.trim()}` : "",
        briefing.trim() ? `- Briefing Adicional do Usuário: ${briefing.trim()}` : "",
      ].filter(Boolean).join("\n");

      toast.promise(
        supabase.functions.invoke("wa-campaign-ai-generate", {
          body: {
            campaign_id: newCamp.id,
            project_id: form.project_id,
            produto: form.produto,
            count: aiCount,
            tom: aiTom,
            briefing: structuredBriefing,
          },
        }),
        {
          loading: "Gerando sequência de mensagens com IA em background...",
          success: (res) => {
            if (res.data?.error) {
              throw new Error(res.data.error);
            }
            const countInserted = res.data?.inserted || 0;
            load();
            return `✨ Sequência gerada com sucesso! ${countInserted} mensagens adicionadas à campanha.`;
          },
          error: (err) => `Erro ao gerar sequência com IA: ${err.message || "tente novamente"}`,
        }
      );
    }

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
    // Pre-flight check before activating
    if (campaign.status !== "active") {
      const issues: string[] = [];
      if (!campaign.provider_id) issues.push("provider WhatsApp");
      if (!Array.isArray(campaign.groups) || campaign.groups.length === 0) issues.push("ao menos 1 grupo");
      if ((stepCounts[campaign.id] || 0) === 0) issues.push("ao menos 1 step ativo");
      if (issues.length > 0) {
        toast.error(`Antes de ativar, configure: ${issues.join(", ")}.`);
        return;
      }
    }
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

      {/* Filtros + busca */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 p-1 rounded-md bg-secondary/40 border border-border">
          {([
            ["all", "Todas", campaigns.length],
            ["active", "Ativas", campaigns.filter(c => c.status === "active").length],
            ["paused", "Pausadas", campaigns.filter(c => c.status === "paused").length],
            ["draft", "Rascunho", campaigns.filter(c => c.status === "draft").length],
          ] as const).map(([key, label, count]) => (
            <button
              key={key}
              onClick={() => setFilter(key as any)}
              className={`px-2.5 py-1 text-[11px] uppercase tracking-wider rounded transition-colors ${
                filter === key ? "bg-gold/15 text-gold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label} <span className="text-muted-foreground/60">({count})</span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar campanha..."
            className="pl-8 h-8 text-xs bg-secondary/40"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : campaigns.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground text-sm font-display text-base">Nenhuma campanha criada ainda.</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowCreate(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Criar primeira campanha
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {campaigns
            .filter(c => filter === "all" || c.status === filter)
            .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()))
            .map(c => {
              const sideColor =
                c.status === "active" ? "bg-gold" :
                c.status === "paused" ? "bg-amber-500" :
                c.status === "completed" ? "bg-blue-500" : "bg-muted-foreground/40";
              return (
            <Card key={c.id} className="group relative overflow-hidden hover:border-primary/30 transition-colors">
              <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${sideColor}`} />
              <CardContent className="p-4 pl-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm">{c.name}</h3>
                      {statusBadge(c.status)}
                      {c.status === "active" && <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                      <span>📁 {projectName(c.project_id)}</span>
                      <span>👥 {Array.isArray(c.groups) ? c.groups.length : 0} grupos</span>
                      <span>📝 {stepCounts[c.id] || 0} steps</span>
                      {c.start_date && <span>📅 {c.start_date}</span>}
                      {c.exit_message && <span>🚪 saída ✓</span>}
                      {nextSteps[c.id] && (
                        <span className="text-gold flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {nextSteps[c.id]!.date.split("-").reverse().join("/")} {nextSteps[c.id]!.time}
                          {nextSteps[c.id]!.preview && ` — ${nextSteps[c.id]!.preview}…`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
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
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowSettings(c)} title="Configurações (provider, fallback...)">
                      <Settings2 className="h-3.5 w-3.5" />
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
              );
            })}
        </div>
      )}

      {/* Create Campaign Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Campanha</DialogTitle>
            <DialogDescription className="hidden">Criação de uma nova campanha de disparo para grupos de WhatsApp.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pr-1">
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

            {/* AI Generation options during Campaign Creation */}
            <div className="pt-3 border-t border-border/40 mt-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs font-bold flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-gold animate-pulse" /> Gerar Sequência com IA
                  </Label>
                  <p className="text-[10px] text-muted-foreground">Cria a campanha e gera todas as mensagens na hora</p>
                </div>
                <Switch checked={generateWithAI} onCheckedChange={setGenerateWithAI} />
              </div>

              {generateWithAI && (
                <div className="space-y-3 p-3.5 rounded-lg border border-primary/10 bg-primary/5 animate-slide-in">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Qtd. de mensagens</Label>
                      <Input type="number" min={1} max={30} value={aiCount} onChange={e => setAiCount(parseInt(e.target.value) || 7)} className="h-8 text-xs bg-background" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Tom de Voz</Label>
                      <Select value={aiTom} onValueChange={setAiTom}>
                        <SelectTrigger className="h-8 text-xs bg-background"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vendas" className="text-xs">🔥 Venda direta</SelectItem>
                          <SelectItem value="conteudo" className="text-xs">📚 Conteúdo de valor</SelectItem>
                          <SelectItem value="aquecimento" className="text-xs">☀️ Aquecimento de Leads</SelectItem>
                          <SelectItem value="lancamento" className="text-xs">🚀 Lançamento oficial</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {form.project_id && (
                    <div className="space-y-1.5 pt-1">
                      <Label className="text-[10px] font-bold text-muted-foreground block">Puxar do projeto:</Label>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                          <Checkbox checked={includeAvatar} onCheckedChange={v => setIncludeAvatar(!!v)} />
                          <span>Avatar</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                          <Checkbox checked={includeExpert} onCheckedChange={v => setIncludeExpert(!!v)} />
                          <span>Expert</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                          <Checkbox checked={includeProduct} onCheckedChange={v => setIncludeProduct(!!v)} />
                          <span>Produto</span>
                        </label>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAdvancedBriefing(!showAdvancedBriefing)}
                      className="w-full text-[11px] h-7.5 border-dashed flex items-center justify-center gap-1"
                    >
                      <span>Mais perguntas de alinhamento</span>
                      {showAdvancedBriefing ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </Button>

                    {showAdvancedBriefing && (
                      <div className="space-y-2.5 pt-1.5 border-t border-border/20">
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold">🎯 Gancho ou tema central da sequência</Label>
                          <Input value={mainTheme} onChange={e => setMainTheme(e.target.value)} placeholder="Ex: Aula prática e depois oferta secreta..." className="h-8 text-xs bg-background" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] font-semibold">💰 Oferta final, bônus ou prazo de escassez</Label>
                          <Input value={offerDetail} onChange={e => setOfferDetail(e.target.value)} placeholder="Ex: R$ 497 com bônus de mentoria até sexta..." className="h-8 text-xs bg-background" />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Instruções extras de copy (opcional)</Label>
                    <Textarea value={briefing} onChange={e => setBriefing(e.target.value)} placeholder="Ex: use metáforas de jornada, CTA no dia 4..." rows={2} className="text-xs bg-background resize-none" />
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter><Button onClick={createCampaign}>Criar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Group Selector Dialog */}
      <Dialog open={!!showGroups} onOpenChange={() => { setShowGroups(null); setGroupSearch(""); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Selecionar Grupos — {showGroups?.name}</DialogTitle>
            <DialogDescription className="hidden">Seleção de grupos de WhatsApp ativos para envio da campanha.</DialogDescription>
          </DialogHeader>
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
                    .map(g => {
                      const isPaused = (showGroups?.paused_groups || []).includes(g.id);
                      const isSelected = selectedGroups.includes(g.id);
                      return (
                        <div key={g.id} className={`flex items-center gap-2 p-2 rounded hover:bg-muted/50 ${isPaused ? "opacity-60" : ""}`}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleGroup(g.id)}
                            className="rounded cursor-pointer"
                          />
                          <span className="text-sm truncate flex-1">{g.subject}</span>
                          {isSelected && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 shrink-0"
                              title={isPaused ? "Retomar grupo" : "Pausar grupo (não recebe disparos)"}
                              onClick={async () => {
                                if (!showGroups) return;
                                const next = isPaused
                                  ? (showGroups.paused_groups || []).filter(j => j !== g.id)
                                  : [...(showGroups.paused_groups || []), g.id];
                                await supabase.from("imphq_wa_campaigns").update({ paused_groups: next as any } as any).eq("id", showGroups.id);
                                setShowGroups({ ...showGroups, paused_groups: next });
                                load();
                                toast.success(isPaused ? "Grupo retomado" : "Grupo pausado");
                              }}
                            >
                              {isPaused ? <Play className="h-3 w-3 text-emerald-400" /> : <Pause className="h-3 w-3 text-amber-400" />}
                            </Button>
                          )}
                          <span className="text-[10px] text-muted-foreground">{g.id.slice(0, 12)}...</span>
                        </div>
                      );
                    })}
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
          <DialogHeader>
            <DialogTitle>Sequência — {showSteps?.name}</DialogTitle>
            <DialogDescription className="hidden">Editor de passos e mensagens para a sequência da campanha.</DialogDescription>
          </DialogHeader>
          {showSteps && <CampaignStepEditor campaignId={showSteps.id} projectId={showSteps.project_id || ""} produto={showSteps.produto || ""} />}
        </DialogContent>
      </Dialog>

      {/* Logs Dialog */}
      <Dialog open={!!showLogs} onOpenChange={() => setShowLogs(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Logs — {showLogs?.name}</DialogTitle>
            <DialogDescription className="hidden">Visualização do histórico de disparos e eventos da campanha.</DialogDescription>
          </DialogHeader>
          {showLogs && <CampaignLogViewer campaignId={showLogs.id} />}
        </DialogContent>
      </Dialog>

      {/* Automation Dialog */}
      <Dialog open={!!showAutomation} onOpenChange={() => setShowAutomation(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Automações — {showAutomation?.name}</DialogTitle>
            <DialogDescription className="hidden">Configuração de respostas automáticas de entrada e saída nos grupos.</DialogDescription>
          </DialogHeader>
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

      {showSettings && (
        <CampaignSettingsDialog
          open={!!showSettings}
          onClose={() => setShowSettings(null)}
          campaign={showSettings}
          projects={projects}
          providers={providers}
          onSaved={load}
        />
      )}
    </div>
  );
}

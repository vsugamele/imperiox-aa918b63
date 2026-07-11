import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { SectionInfo } from "@/components/SectionInfo";
import { sectionHelpTexts } from "@/data/sectionHelpTexts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Zap, Mail, MessageCircle, Send, Save, Copy, BookOpen, Clock, ScrollText, Play, Pause, CopyPlus, Activity, CheckCircle2, XCircle, Loader2, RotateCcw, Megaphone, Users, Mic, BarChart3, History, LogOut, Info, Image as ImageIcon, Bot } from "lucide-react";
import { toast } from "sonner";
import { FlowEditor, type Acao, type ProjectTemplate } from "@/components/openflow/FlowEditor";
import { ExecutionsPanel } from "@/components/openflow/ExecutionsPanel";
import { AutomacaoLogs } from "@/components/openflow/AutomacaoLogs";
import { WebhookGuide } from "@/components/openflow/WebhookGuide";
import { CampanhasManager, type Campanha } from "@/components/openflow/CampanhasManager";
import { OpenFlowAnalytics } from "@/components/openflow/OpenFlowAnalytics";
import FlowROIDashboard from "@/components/openflow/FlowROIDashboard";
import { ColdLeadReactivation } from "@/components/openflow/ColdLeadReactivation";
import { FlowSimulator } from "@/components/openflow/FlowSimulator";
import { PageHeader } from "@/components/shared/PageHeader";
import { StepGuide } from "@/components/openflow/StepGuide";
import { VersionHistoryDrawer } from "@/components/openflow/VersionHistoryDrawer";
import { FlowMediaLibrary } from "@/components/openflow/FlowMediaLibrary";
import { useAutoSave } from "@/components/openflow/flow-editor/useAutoSave";
import { SaveIndicator } from "@/components/openflow/flow-editor/SaveIndicator";

const TRIGGERS: { value: string; label: string; icon: string; color: string; group: string }[] = [
  { value: "lead_novo", label: "Novo Lead", icon: "👤", color: "border-l-blue-500", group: "Lead" },
  { value: "inicio_checkout", label: "Início de Checkout", icon: "🛍️", color: "border-l-purple-500", group: "Lead" },
  { value: "tag_adicionada", label: "Tag Adicionada", icon: "🏷️", color: "border-l-indigo-500", group: "Lead" },
  { value: "carrinho_abandonado", label: "Carrinho Abandonado", icon: "🛒", color: "border-l-amber-500", group: "Pagamento" },
  { value: "aguardando_pagamento", label: "Aguardando Pagamento / Pix", icon: "💰", color: "border-l-yellow-500", group: "Pagamento" },
  { value: "boleto_gerado", label: "Boleto Gerado", icon: "📄", color: "border-l-yellow-600", group: "Pagamento" },
  { value: "pagamento_recusado", label: "Pagamento Recusado", icon: "❌", color: "border-l-red-500", group: "Pagamento" },
  { value: "pagamento_expirado", label: "Pagamento Expirado", icon: "⌛", color: "border-l-orange-500", group: "Pagamento" },
  { value: "compra_approved", label: "Compra Aprovada (qualquer)", icon: "✅", color: "border-l-emerald-500", group: "Pós-venda" },
  { value: "venda_principal_aprovada", label: "Venda Principal Aprovada", icon: "💎", color: "border-l-emerald-600", group: "Pós-venda" },
  { value: "primeiro_acesso", label: "Primeiro Acesso", icon: "🎉", color: "border-l-emerald-400", group: "Pós-venda" },
  { value: "upsell_aprovado", label: "Upsell Aprovado", icon: "⬆️", color: "border-l-green-600", group: "Pós-venda" },
  { value: "upsell_recusado", label: "Upsell Recusado", icon: "↘️", color: "border-l-orange-500", group: "Pós-venda" },
  { value: "orderbump_aprovado", label: "Orderbump Aprovado", icon: "🎁", color: "border-l-green-500", group: "Pós-venda" },
  { value: "orderbump_recusado", label: "Orderbump Recusado", icon: "🚫", color: "border-l-orange-400", group: "Pós-venda" },
  { value: "downsell_aprovado", label: "Downsell Aprovado", icon: "⬇️", color: "border-l-amber-500", group: "Pós-venda" },
  { value: "reembolso", label: "Reembolso", icon: "↩️", color: "border-l-red-500", group: "Retenção" },
  { value: "chargeback", label: "Chargeback", icon: "⚠️", color: "border-l-red-600", group: "Retenção" },
  { value: "compra_cancelada", label: "Compra Cancelada", icon: "🚫", color: "border-l-rose-500", group: "Retenção" },
  { value: "assinatura_cancelada", label: "Assinatura Cancelada", icon: "💔", color: "border-l-pink-500", group: "Retenção" },
  { value: "assinatura_renovada", label: "Assinatura Renovada", icon: "🔄", color: "border-l-teal-500", group: "Retenção" },
  { value: "trial_iniciado", label: "Trial Iniciado", icon: "🆓", color: "border-l-cyan-500", group: "Retenção" },
  { value: "whatsapp_mensagem_recebida", label: "Qualquer mensagem no WhatsApp", icon: "💬", color: "border-l-green-500", group: "WhatsApp" },
  { value: "whatsapp_palavra_chave", label: "Palavra-chave no WhatsApp", icon: "🔑", color: "border-l-green-600", group: "WhatsApp" },
];

const TRIGGER_GROUPS = ["Lead", "Pagamento", "Pós-venda", "Retenção", "WhatsApp"];


interface Automacao {
  id: string; project_id?: string; produto?: string; nome: string;
  trigger_tipo: string; acoes: Acao[]; ativo: boolean; created_at?: string;
  provider_id?: string;
  quiet_start?: number | null; quiet_end?: number | null; dedupe_hours?: number | null;
  campanha_id?: string | null;
  tag_filtro?: string | null;
  link_checkout?: string | null;
  stalled_hours?: number | null;
  stalled_operator?: string | null;
  follow_up_hours?: number | null;
  follow_up_template?: string | null;
  exit_trigger_tipo?: string | null;
  exit_trigger_payload?: any;
  exit_cascade?: boolean;
  flow_objective?: string | null;
  prioridade?: number | null;
  exclusivo?: boolean | null;
  trigger_config?: { keywords?: string[]; match_mode?: "any" | "all" | "exact" | "regex" } | null;
}


const triggerMeta = (t: string) => TRIGGERS.find(tr => tr.value === t) || { label: t, icon: "⚡", color: "border-l-primary" };

const renderTriggerOptions = () => TRIGGER_GROUPS.map(g => (
  <div key={g}>
    <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">{g}</div>
    {TRIGGERS.filter(t => t.group === g).map(t => (
      <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>
    ))}
  </div>
));

export default function OpenFlow() {
  const navigate = useNavigate();
  const [automacoes, setAutomacoes] = useState<Automacao[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Automacao | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [form, setForm] = useState({ nome: "", trigger_tipo: "carrinho_abandonado", project_id: "", produto: "", campanha_id: "", tag_filtro: "" });
  const [projectProducts, setProjectProducts] = useState<string[]>([]);
  const [editProjectProducts, setEditProjectProducts] = useState<string[]>([]);
  const [projectTemplates, setProjectTemplates] = useState<ProjectTemplate[]>([]);
  const [kpis, setKpis] = useState({ total: 0, success: 0, errors: 0, rate: 0 });
  const [filterProject, setFilterProject] = useState<string>("__all__");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [allProducts, setAllProducts] = useState<string[]>([]);
  const [customTagMode, setCustomTagMode] = useState(false);
  const [customProductMode, setCustomProductMode] = useState(false);
  const [customTagModeNew, setCustomTagModeNew] = useState(false);
  const [health, setHealth] = useState<Map<string, { execucoes: number; sucessos: number; falhas: number; taxa_sucesso: number }>>(new Map());
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const load = async () => {
    const [aRes, wRes, pRes, provRes, hubRes, cRes] = await Promise.all([
      supabase.from("imphq_automacoes").select("*").order("created_at", { ascending: false }),
      supabase.from("imphq_webhooks").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("imphq_projects").select("id, name").order("name"),
      supabase.from("imphq_wa_providers").select("*").eq("is_active", true).order("created_at"),
      supabase.from("wa_hub_iso_sessions" as any).select("id, session_key, tenant_id, status").eq("status", "connected"),
      supabase.from("imphq_campanhas" as any).select("*").order("created_at", { ascending: false }),
    ]);
    setAutomacoes((aRes.data || []).map((a: any) => ({ ...a, acoes: a.acoes || [] })));
    setWebhooks(wRes.data || []);
    setProjects(pRes.data || []);
    setCampanhas((cRes.data || []) as any);
    const hubProviders = (hubRes.data || []).map((s: any) => ({
      id: `hub_${s.id}`, provider: "hub_local", instance_name: s.session_key,
      twilio_from: null, project_id: s.tenant_id || null,
    }));
    setProviders([...(provRes.data || []), ...hubProviders]);

    try {
      const [fullProjsRes, tagCountsRes] = await Promise.all([
        supabase.from("imphq_projects").select("data"),
        supabase.rpc("get_lead_tag_counts" as any, { p_project_id: null, p_limit: 200 })
      ]);
      const prodsSet = new Set<string>();
      (fullProjsRes.data || []).forEach((p: any) => {
        const prods = (p.data?.produtos || []) as any[];
        prods.forEach(prod => { if (prod.nome) prodsSet.add(prod.nome); });
      });
      setAllProducts(Array.from(prodsSet).sort());
      setAllTags((tagCountsRes.data || []).map((t: any) => t.tag).filter(Boolean));
    } catch (e) { console.warn(e); }

    try {
      const { data: hRows } = await supabase.from("imphq_automacao_health" as any).select("*");
      const hMap = new Map<string, any>();
      (hRows || []).forEach((h: any) => hMap.set(h.automacao_id, h));
      setHealth(hMap);
    } catch (e) {
      console.warn("Erro ao buscar health metrics", e);
    }
  };

  const loadKpis = async () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: logs } = await supabase.from("imphq_automacao_logs" as any).select("status").gte("created_at", sevenDaysAgo);
    if (logs) {
      const total = logs.length;
      const success = logs.filter((l: any) => l.status === "success").length;
      const errors = logs.filter((l: any) => l.status === "error").length;
      setKpis({ total, success, errors, rate: total > 0 ? Math.round((success / total) * 100) : 0 });
    }
  };

  useEffect(() => { load(); loadKpis(); }, []);

  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const id = searchParams.get("automacao");
    if (!id || automacoes.length === 0) return;
    const found = automacoes.find(a => a.id === id);
    if (found) {
      setEditing(found);
      // remove o param para não reabrir ao fechar
      const next = new URLSearchParams(searchParams);
      next.delete("automacao");
      setSearchParams(next, { replace: true });
    }
  }, [automacoes, searchParams, setSearchParams]);

  const loadTemplates = async () => {
    if (!editing?.project_id) { setProjectTemplates([]); return; }
    const [projRes, waRes] = await Promise.all([
      supabase.from("imphq_projects").select("data").eq("id", editing.project_id!).single(),
      supabase.from("imphq_wa_templates").select("name, content").eq("project_id", editing.project_id!),
    ]);
    const tpls: ProjectTemplate[] = [];
    const d = (projRes.data?.data || {}) as any;
    if (Array.isArray(d.emails)) d.emails.forEach((e: any, i: number) => { if (e.body) tpls.push({ label: e.subject || `Email ${i + 1}`, content: e.body, source: "Email" }); });
    if (waRes.data?.length) waRes.data.forEach((t: any) => { if (t.content) tpls.push({ label: t.name || "WhatsApp", content: t.content, source: "💬 WhatsApp" }); });
    setProjectTemplates(tpls);
  };

  useEffect(() => { loadTemplates(); }, [editing?.project_id]);

  const createAutomacao = async (preset?: { nome?: string; trigger_tipo?: string; acoes?: Acao[] }) => {
    const nome = preset?.nome || form.nome;
    if (!nome.trim()) { toast.error("Nome obrigatório"); return; }
    const { data, error } = await supabase.from("imphq_automacoes").insert({
      id: crypto.randomUUID(), nome, trigger_tipo: preset?.trigger_tipo || form.trigger_tipo,
      project_id: form.project_id || null, acoes: (preset?.acoes || []) as any, ativo: true,
      produto: (form as any).produto || null,
      campanha_id: (form as any).campanha_id || null,
      tag_filtro: form.tag_filtro || null,
    } as any).select("*").single();
    if (error) { toast.error(error.message); return; }
    toast.success("Automação criada!"); setShowNew(false); load();
    if (data && preset?.acoes?.length) setEditing(data as any);
  };

  const saveAutomacao = async (a: Automacao, opts?: { silent?: boolean }) => {
    const { error } = await supabase.from("imphq_automacoes").update({
      nome: a.nome, trigger_tipo: a.trigger_tipo, acoes: a.acoes as any, ativo: a.ativo,
      produto: a.produto, project_id: a.project_id, quiet_start: a.quiet_start, quiet_end: a.quiet_end,
      dedupe_hours: a.dedupe_hours, campanha_id: a.campanha_id, tag_filtro: a.tag_filtro,
      provider_id: a.provider_id, link_checkout: (a as any).link_checkout,
      stalled_hours: a.stalled_hours, stalled_operator: a.stalled_operator,
      follow_up_hours: a.follow_up_hours, follow_up_template: a.follow_up_template,
      exit_trigger_tipo: a.exit_trigger_tipo, exit_cascade: a.exit_cascade,
      flow_objective: a.flow_objective,
      prioridade: a.prioridade ?? 5, exclusivo: !!a.exclusivo,
      trigger_config: a.trigger_config ?? null,
    } as any).eq("id", a.id);

    if (error) {
      if (!opts?.silent) toast.error(error.message);
      throw new Error(error.message);
    }
    if (!opts?.silent) { toast.success("Salvo!"); setEditing(null); load(); }
  };

  const autoSave = useAutoSave<Automacao | null>({
    value: editing,
    enabled: !!editing,
    onSave: async (v) => { if (v) await saveAutomacao(v, { silent: true }); },
  });

  // Reset autosave baseline when opening a different flow
  useEffect(() => {
    if (editing) autoSave.resetBaseline(editing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id]);

  const closeEditor = async () => {
    try { await autoSave.forceSave(); } catch {}
    setEditing(null);
    load();
  };



  const handleGenerateAI = async () => {
    if (!editing) return;
    setIsGeneratingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke("openflow-ai", {
        body: {
          project_id: editing.project_id,
          trigger_tipo: editing.trigger_tipo,
          num_etapas: 5,
          produto: editing.produto || undefined,
        },
      });
      if (error) throw error;
      const acoesGeradas: Acao[] = (data?.acoes || []).map((a: any) => ({
        id: crypto.randomUUID(),
        tipo: a.tipo || "email",
        template: a.template || "",
        delay_min: typeof a.delay_min === "number" ? a.delay_min : 60,
        ...(a.ia_vision !== undefined ? { ia_vision: !!a.ia_vision } : {}),
        ...(a.ia_voice_response !== undefined ? { ia_voice_response: !!a.ia_voice_response } : {}),
        ...(a.ia_search_web !== undefined ? { ia_search_web: !!a.ia_search_web } : {}),
        ...(a.questioning_strategy ? { questioning_strategy: a.questioning_strategy } : {}),
        ...(a.timeout_min !== undefined ? { timeout_min: a.timeout_min } : {}),
        ...(a.tag ? { tag: a.tag } : {}),
        ...(a.stop_event_type ? { stop_event_type: a.stop_event_type } : {}),
      }));
      setEditing({ ...editing, acoes: [...editing.acoes, ...acoesGeradas] });
      toast.success(`${acoesGeradas.length} etapas geradas com IA!`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar com IA");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const deleteAutomacao = async (id: string) => {
    if (!confirm("Excluir?")) return;
    const { error } = await supabase.from("imphq_automacoes").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Excluído"); load(); }
  };

  const filtered = automacoes.filter(a => filterProject === "__all__" || a.project_id === filterProject);

  const [templates, setTemplates] = useState<any[]>([]);
  useEffect(() => {
    if (!showNew) return;
    supabase.from("imphq_flow_templates" as any).select("*").order("ordem").then(({ data }) => setTemplates(data || []));
  }, [showNew]);

  return (
    <div className="container mx-auto p-4 lg:p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="OpenFlow" subtitle="Editor visual de réguas de recuperação e automação" icon={Zap} />
        <Button onClick={() => navigate("/openflow/agentes")} variant="outline" className="border-primary/40 text-primary hover:bg-primary/10 font-semibold">
          <Bot className="h-4 w-4 mr-2" /> Agentes IA
        </Button>
      </div>


      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900/50 border-white/5"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Execuções</p><p className="text-2xl font-bold">{kpis.total}</p></CardContent></Card>
        <Card className="bg-slate-900/50 border-white/5"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Sucessos (7d)</p><p className="text-2xl font-bold text-emerald-400">{kpis.success}</p></CardContent></Card>
        <Card className="bg-slate-900/50 border-white/5"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Falhas</p><p className="text-2xl font-bold text-rose-400">{kpis.errors}</p></CardContent></Card>
        <Card className="bg-slate-900/50 border-white/5"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Taxa Global</p><p className="text-2xl font-bold text-primary">{kpis.rate}%</p></CardContent></Card>
      </div>

      <Tabs defaultValue="fluxos" className="w-full">
        <TabsList className="bg-slate-900/80 border border-white/5 p-1">
          <TabsTrigger value="fluxos" className="gap-2"><Zap className="h-4 w-4" /> Fluxos Ativos</TabsTrigger>
          <TabsTrigger value="guia" className="gap-2"><Info className="h-4 w-4" /> Guia de Etapas</TabsTrigger>
          <TabsTrigger value="campanhas" className="gap-2"><Megaphone className="h-4 w-4" /> Campanhas</TabsTrigger>
          <TabsTrigger value="logs" className="gap-2"><Activity className="h-4 w-4" /> Logs & Monitoramento</TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2"><BarChart3 className="h-4 w-4" /> Performance</TabsTrigger>
          <TabsTrigger value="roi" className="gap-2"><Zap className="h-4 w-4" /> ROI Global</TabsTrigger>
          <TabsTrigger value="midias" className="gap-2"><ImageIcon className="h-4 w-4" /> Mídias</TabsTrigger>
        </TabsList>

        <TabsContent value="fluxos" className="space-y-6 pt-4">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="flex gap-2 items-center flex-1 md:flex-none">
              <Select value={filterProject} onValueChange={setFilterProject}>
                <SelectTrigger className="w-full md:w-[240px] h-9 bg-slate-900 border-white/5"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="__all__">Todos os Projetos</SelectItem>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={() => setShowNew(true)} className="bg-amber-500 text-black hover:bg-amber-400 font-bold"><Plus className="h-4 w-4 mr-2" /> Novo Fluxo</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(a => {
              const meta = triggerMeta(a.trigger_tipo);
              const stats = health.get(a.id);
              return (
                <Card key={a.id} className="bg-slate-900/40 border-white/5 hover:border-primary/20 transition-all group overflow-hidden">
                  <CardContent className={`p-5 border-l-4 ${meta.color} relative`}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-slate-100 group-hover:text-primary transition-colors">{a.nome}</h3>
                        <p className="text-[10px] text-muted-foreground uppercase font-medium">{projects.find(p => p.id === a.project_id)?.name || "Global"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={a.ativo} onCheckedChange={v => saveAutomacao({ ...a, ativo: v })} className="scale-75" />
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary" onClick={() => setEditing(a)}><History className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-rose-400" onClick={() => deleteAutomacao(a.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-4">
                      <Badge variant="outline" className="bg-slate-950/50 border-white/5 text-[10px]">{meta.icon} {meta.label}</Badge>
                      {a.produto && <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-none">📦 {a.produto}</Badge>}
                      {(a as any).exit_conditions?.length > 0 && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="text-[10px] border-rose-500/30 text-rose-400 bg-rose-500/5">
                                <LogOut className="h-2.5 w-2.5 mr-1" /> {(a as any).exit_conditions.length} Saídas
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Este fluxo possui {(a as any).exit_conditions.length} condições de saída configuradas.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/5">
                      <div className="text-center">
                        <p className="text-[9px] text-muted-foreground uppercase">Execs</p>
                        <p className="text-xs font-bold">{(a as any).stats_cache?.executions || stats?.execucoes || 0}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-muted-foreground uppercase">Taxa</p>
                        <p className={`text-xs font-bold ${(a as any).stats_cache?.success_rate > 70 ? 'text-emerald-400' : 'text-primary'}`}>
                          {(a as any).stats_cache?.success_rate || stats?.taxa_sucesso || 0}%
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-muted-foreground uppercase">Receita</p>
                        <p className="text-xs font-bold text-emerald-400">
                          R$ {((a as any).stats_cache?.revenue || 0).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>

                    {((a as any).stats_cache?.success_rate < 30 && ((a as any).stats_cache?.executions > 10)) && (
                      <div className="mt-3 flex items-center gap-2 px-2 py-1.5 rounded-md bg-rose-500/10 border border-rose-500/20">
                        <Activity className="h-3 w-3 text-rose-400" />
                        <span className="text-[10px] text-rose-300 font-medium">Saúde Crítica: Ajuste o fluxo</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="guia"><StepGuide /></TabsContent>
        <TabsContent value="campanhas"><CampanhasManager projects={projects} /></TabsContent>
        <TabsContent value="logs"><AutomacaoLogs automacoes={automacoes} projects={projects} /></TabsContent>
        <TabsContent value="analytics"><OpenFlowAnalytics automacoes={automacoes} /></TabsContent>
        <TabsContent value="roi"><FlowROIDashboard projectId={filterProject === "__all__" ? "" : filterProject} /></TabsContent>
        <TabsContent value="midias" className="pt-4"><FlowMediaLibrary projects={projects} /></TabsContent>
      </Tabs>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-3xl bg-slate-950 border-white/10">
          <DialogHeader><DialogTitle className="font-display text-2xl">Criar novo fluxo</DialogTitle></DialogHeader>
          <div className="space-y-5 py-2 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground">Título do fluxo *</Label>
              <Input placeholder="Ex: Carrinho Abandonado — Projeto X" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} className="h-11 bg-secondary/40 border-white/10" />
              <p className="text-[11px] text-muted-foreground">O nome deve conter no mínimo 4 caracteres.</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase text-muted-foreground">Projeto</Label>
              <Select value={form.project_id} onValueChange={v => setForm({ ...form, project_id: v })}>
                <SelectTrigger className="h-11 bg-secondary/40 border-white/10"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label className="text-xs uppercase text-muted-foreground">Gatilho *</Label>
              {TRIGGER_GROUPS.map(g => (
                <div key={g} className="space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">{g}</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {TRIGGERS.filter(t => t.group === g).map(t => {
                      const active = form.trigger_tipo === t.value;
                      return (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => setForm({ ...form, trigger_tipo: t.value })}
                          title={t.label}
                          className={`aspect-square rounded-xl border-2 flex flex-col items-center justify-center gap-1 p-2 transition-all ${active ? "border-primary bg-primary/10 shadow-[0_0_15px_rgba(201,146,42,0.25)]" : "border-white/5 bg-secondary/30 hover:border-primary/30 hover:bg-secondary/50"}`}
                        >
                          <span className="text-2xl leading-none">{t.icon}</span>
                          <span className={`text-[9px] leading-tight text-center line-clamp-2 ${active ? "text-primary font-semibold" : "text-muted-foreground"}`}>{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {templates.length > 0 && (
              <div className="border-t border-white/5 pt-4 space-y-2">
                <Label className="text-xs uppercase text-muted-foreground">Ou escolha um template</Label>
                <div className="grid grid-cols-2 gap-2">{templates.map(t => <button key={t.id} onClick={() => createAutomacao({ nome: t.nome, trigger_tipo: t.trigger_tipo, acoes: t.acoes })} className="text-left p-3 rounded-xl border border-white/5 hover:border-primary/40 bg-white/5 transition-all"><p className="text-sm font-bold">{t.icon} {t.nome}</p><p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{t.descricao}</p></button>)}</div>
              </div>
            )}
          </div>
          <DialogFooter><Button onClick={() => createAutomacao()} className="w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90 h-11">Criar Fluxo</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={v => { if (!v) closeEditor(); }}>
        <DialogContent className="max-w-[99vw] w-[99vw] h-[97vh] p-0 overflow-hidden bg-slate-950 border-white/10 flex flex-col">
          <DialogHeader className="px-6 py-4 border-b border-white/5 bg-slate-900/50 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={closeEditor}
                  aria-label="Voltar"
                  className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10"
                >
                  <LogOut className="h-4 w-4 rotate-180 text-slate-300" />
                </Button>
                <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center"><Zap className="h-5 w-5 text-primary" /></div>
                {editing && (
                  <div>
                    <DialogTitle className="text-xl font-bold text-slate-100">{editing.nome || "Editar Fluxo"}</DialogTitle>
                    <p className="text-xs text-muted-foreground font-mono">
                      {triggerMeta(editing.trigger_tipo).icon} {triggerMeta(editing.trigger_tipo).label}
                      {" · "}{projects.find(p => p.id === editing.project_id)?.name || "Todos os projetos"}
                      {editing.produto ? ` · ${editing.produto}` : ""}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <SaveIndicator
                  status={autoSave.status}
                  error={autoSave.error}
                  lastSavedAt={autoSave.lastSavedAt}
                  onRetry={() => autoSave.forceSave()}
                />
                {editing && <Button variant="outline" onClick={() => setEditing({ ...editing, ativo: !editing.ativo })} className="h-9 px-3 text-xs font-semibold bg-white/5 border-white/10 hover:bg-white/10">
                  {editing.ativo ? <><Pause className="h-3.5 w-3.5 mr-1.5" /> Pausar</> : <><Play className="h-3.5 w-3.5 mr-1.5" /> Retomar</>}
                </Button>}
                {editing && <Button variant="outline" onClick={() => setShowHistory(true)} className="h-9 px-3 text-xs font-semibold bg-white/5 border-white/10 hover:bg-white/10"><History className="h-3.5 w-3.5 mr-1.5" /> Histórico</Button>}
                <Button variant="outline" onClick={closeEditor} className="h-9 px-4 text-xs font-semibold bg-white/5 border-white/10 hover:bg-white/10">Fechar</Button>
              </div>
            </div>
          </DialogHeader>


          {editing && (
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-4 w-full">

                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 bg-secondary/10 p-4 rounded-2xl border border-white/5">
                  <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Nome do Fluxo</Label><Input value={editing.nome} onChange={e => setEditing({ ...editing, nome: e.target.value })} className="h-9 bg-background/50 border-white/10" /></div>
                  <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Projeto</Label><Select value={editing.project_id || "none"} onValueChange={v => setEditing({ ...editing, project_id: v === "none" ? undefined : v, produto: undefined })}><SelectTrigger className="h-9 bg-background/50 border-white/10"><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="none">Todos</SelectItem>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Trigger</Label><Select value={editing.trigger_tipo} onValueChange={v => setEditing({ ...editing, trigger_tipo: v })}><SelectTrigger className="h-9 bg-background/50 border-white/10"><SelectValue /></SelectTrigger><SelectContent className="max-h-[60vh]">{renderTriggerOptions()}</SelectContent></Select></div>
                  <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Produto</Label><Select value={editing.produto || "none"} onValueChange={v => setEditing({ ...editing, produto: v === "none" ? undefined : v })}><SelectTrigger className="h-9 bg-background/50 border-white/10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Todos</SelectItem>{allProducts.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Filtro por Tag</Label><Select value={editing.tag_filtro || "none"} onValueChange={v => setEditing({ ...editing, tag_filtro: v === "none" ? undefined : v })}><SelectTrigger className="h-9 bg-background/50 border-white/10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Nenhuma</SelectItem>{allTags.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Número de Disparo</Label>
                    <Select
                      value={editing.provider_id || "none"}
                      onValueChange={v => setEditing({ ...editing, provider_id: v === "none" ? undefined : v })}
                    >
                      <SelectTrigger className="h-9 bg-background/50 border-white/10">
                        <SelectValue placeholder="Padrão do sistema" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Padrão do sistema</SelectItem>
                        {providers
                          .filter(p => !p.project_id || p.project_id === editing.project_id)
                          .map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.provider === "hub_local" ? "📱" : p.provider === "evolution" ? "🟢" : "🔵"} {p.instance_name || p.twilio_from || p.id.slice(0, 12)}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {editing.trigger_tipo?.startsWith("whatsapp_") && (
                  <div className="bg-secondary/10 p-4 rounded-2xl border border-white/5 space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🔑</span>
                        <Label className="text-xs font-bold text-foreground">
                          {editing.trigger_tipo === "whatsapp_palavra_chave"
                            ? "Dispara quando o lead enviar uma dessas palavras/frases:"
                            : "Filtro opcional por palavra-chave (deixe vazio para disparar em qualquer mensagem):"}
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Modo</Label>
                        <Select
                          value={editing.trigger_config?.match_mode || "any"}
                          onValueChange={(v: any) => setEditing({
                            ...editing,
                            trigger_config: { ...(editing.trigger_config || {}), match_mode: v },
                          })}
                        >
                          <SelectTrigger className="h-8 w-[180px] bg-background/50 border-white/10 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="any">Contém qualquer uma</SelectItem>
                            <SelectItem value="all">Contém todas</SelectItem>
                            <SelectItem value="exact">Mensagem exata</SelectItem>
                            <SelectItem value="regex">Regex avançado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <EditableTagList
                      tags={editing.trigger_config?.keywords || []}
                      onChange={(kws) => setEditing({
                        ...editing,
                        trigger_config: { ...(editing.trigger_config || {}), keywords: kws },
                        trigger_tipo: kws.length > 0 ? "whatsapp_palavra_chave" : "whatsapp_mensagem_recebida",
                      })}
                      placeholder="Ex: comprar, preço, info…"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Enter para adicionar cada palavra. Sem diferença entre maiúsculas/minúsculas. Deixe vazio para disparar em toda mensagem recebida.
                    </p>
                  </div>
                )}

                <FlowEditor 
                  triggerTipo={editing.trigger_tipo} 
                  acoes={editing.acoes} 

                  onChange={v => setEditing({ ...editing, acoes: v })} 
                  onTriggerChange={v => setEditing({ ...editing, trigger_tipo: v })}
                  projectId={editing.project_id} 
                  providers={providers} 
                  templates={projectTemplates} 
                  onTemplateSaved={loadTemplates} 
                  automacaoId={editing.id} 
                  flowObjective={editing.flow_objective || ""}
                  onUpdateObjective={v => setEditing({ ...editing, flow_objective: v })}
                  onGenerateAI={handleGenerateAI}
                  isGenerating={isGeneratingAI}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-secondary/5 p-4 rounded-xl border border-white/5 space-y-4">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2"><Clock className="h-3.5 w-3.5" /> Configurações de Tempo</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Silêncio Início (h)</Label><Input type="number" min={0} max={23} value={editing.quiet_start ?? ""} onChange={e => setEditing({ ...editing, quiet_start: e.target.value === "" ? null : Number(e.target.value) })} className="h-9 bg-background/50 border-white/10" /></div>
                      <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Silêncio Fim (h)</Label><Input type="number" min={0} max={23} value={editing.quiet_end ?? ""} onChange={e => setEditing({ ...editing, quiet_end: e.target.value === "" ? null : Number(e.target.value) })} className="h-9 bg-background/50 border-white/10" /></div>
                    </div>
                  </div>
                  <div className="bg-secondary/5 p-4 rounded-xl border border-white/5 space-y-4">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5" /> Segurança & Status</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Dedupe (h)</Label><Input type="number" min={0} value={editing.dedupe_hours ?? 0} onChange={e => setEditing({ ...editing, dedupe_hours: Number(e.target.value) || 0 })} className="h-9 bg-background/50 border-white/10" /></div>
                      <div className="flex items-center justify-between gap-2 h-16 pt-4"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Ativo</Label><Switch checked={editing.ativo} onCheckedChange={v => setEditing({ ...editing, ativo: v })} /></div>
                    </div>
                  </div>
                </div>

                <div className="bg-secondary/5 p-4 rounded-xl border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                        <Activity className="h-3.5 w-3.5" /> Conflito entre Fluxos
                      </h4>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        Quando o mesmo lead entra em mais de um fluxo, prioridade decide quem vence. Exclusivo bloqueia outros até este terminar.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Prioridade (1-10)</Label>
                      <Input
                        type="number" min={1} max={10}
                        value={editing.prioridade ?? 5}
                        onChange={e => setEditing({ ...editing, prioridade: Math.max(1, Math.min(10, Number(e.target.value) || 5)) })}
                        className="h-9 bg-background/50 border-white/10"
                      />
                      <p className="text-[9px] text-muted-foreground/60 ml-1">Maior número = ganha em conflito</p>
                    </div>
                    <div className="flex items-center justify-between gap-2 h-16 pt-4">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Exclusivo</Label>
                      <Switch checked={!!editing.exclusivo} onCheckedChange={v => setEditing({ ...editing, exclusivo: v })} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <VersionHistoryDrawer
        open={showHistory}
        onOpenChange={setShowHistory}
        automacaoId={editing?.id || null}
        automacaoNome={editing?.nome}
        onRestore={(snap) => {
          if (!editing) return;
          setEditing({
            ...editing,
            ...(snap.nome ? { nome: snap.nome } : {}),
            ...(snap.trigger_tipo ? { trigger_tipo: snap.trigger_tipo } : {}),
            ...(Array.isArray(snap.acoes) ? { acoes: snap.acoes } : {}),
            ...(snap.flow_objective !== undefined ? { flow_objective: snap.flow_objective } : {}),
          });
          load();
        }}
      />
    </div>
  );
}

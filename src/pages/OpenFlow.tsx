import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SectionInfo } from "@/components/SectionInfo";
import { sectionHelpTexts } from "@/data/sectionHelpTexts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Zap, Mail, MessageCircle, Send, Save, Copy, BookOpen, Clock, ScrollText, Play, CopyPlus, Activity, CheckCircle2, XCircle, Loader2, RotateCcw, Megaphone, Users, Mic, BarChart3, History, LogOut } from "lucide-react";
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

// ── Constants ────────────────────────────────────────────────────
const TRIGGERS: { value: string; label: string; icon: string; color: string; group: string }[] = [
  // Lead
  { value: "lead_novo", label: "Novo Lead", icon: "👤", color: "border-l-blue-500", group: "Lead" },
  { value: "inicio_checkout", label: "Início de Checkout", icon: "🛍️", color: "border-l-purple-500", group: "Lead" },
  { value: "tag_adicionada", label: "Tag Adicionada", icon: "🏷️", color: "border-l-indigo-500", group: "Lead" },
  // Pagamento - pendente
  { value: "carrinho_abandonado", label: "Carrinho Abandonado", icon: "🛒", color: "border-l-amber-500", group: "Pagamento" },
  { value: "aguardando_pagamento", label: "Aguardando Pagamento / Pix", icon: "💰", color: "border-l-yellow-500", group: "Pagamento" },
  { value: "boleto_gerado", label: "Boleto Gerado", icon: "📄", color: "border-l-yellow-600", group: "Pagamento" },
  { value: "pagamento_recusado", label: "Pagamento Recusado", icon: "❌", color: "border-l-red-500", group: "Pagamento" },
  { value: "pagamento_expirado", label: "Pagamento Expirado", icon: "⌛", color: "border-l-orange-500", group: "Pagamento" },
  // Pós-venda
  { value: "compra_aprovada", label: "Compra Aprovada", icon: "✅", color: "border-l-emerald-500", group: "Pós-venda" },
  { value: "primeiro_acesso", label: "Primeiro Acesso", icon: "🎉", color: "border-l-emerald-400", group: "Pós-venda" },
  { value: "upsell_aprovado", label: "Upsell Aprovado", icon: "⬆️", color: "border-l-green-600", group: "Pós-venda" },
  { value: "orderbump_aprovado", label: "Orderbump Aprovado", icon: "🎁", color: "border-l-green-500", group: "Pós-venda" },
  // Retenção
  { value: "reembolso", label: "Reembolso", icon: "↩️", color: "border-l-red-500", group: "Retenção" },
  { value: "chargeback", label: "Chargeback", icon: "⚠️", color: "border-l-red-600", group: "Retenção" },
  { value: "compra_cancelada", label: "Compra Cancelada", icon: "🚫", color: "border-l-rose-500", group: "Retenção" },
  { value: "assinatura_cancelada", label: "Assinatura Cancelada", icon: "💔", color: "border-l-pink-500", group: "Retenção" },
  { value: "assinatura_renovada", label: "Assinatura Renovada", icon: "🔄", color: "border-l-teal-500", group: "Retenção" },
  { value: "trial_iniciado", label: "Trial Iniciado", icon: "🆓", color: "border-l-cyan-500", group: "Retenção" },
];

const TRIGGER_GROUPS = ["Lead", "Pagamento", "Pós-venda", "Retenção"];

const ACAO_TIPOS = [
  { value: "email", label: "Email (Resend)", icon: Mail },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "audio", label: "Áudio WhatsApp (IA)", icon: Mic },
  { value: "telegram", label: "Telegram", icon: Send },
  { value: "aguardar", label: "Aguardar", icon: Clock },
  { value: "wait_event", label: "Aguardar Evento", icon: Clock },
  { value: "ab_split", label: "Divisão A/B", icon: Zap },
];

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
}

// ── Helpers ──────────────────────────────────────────────────────
const triggerMeta = (t: string) => TRIGGERS.find(tr => tr.value === t) || { label: t, icon: "⚡", color: "border-l-primary" };

const renderTriggerOptions = () => TRIGGER_GROUPS.map(g => (
  <div key={g}>
    <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">{g}</div>
    {TRIGGERS.filter(t => t.group === g).map(t => (
      <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>
    ))}
  </div>
));

// ── Main Component ───────────────────────────────────────────────
export default function OpenFlow() {
  const [automacoes, setAutomacoes] = useState<Automacao[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Automacao | null>(null);
  const [form, setForm] = useState({ nome: "", trigger_tipo: "carrinho_abandonado", project_id: "", produto: "", campanha_id: "", tag_filtro: "" });
  const [projectProducts, setProjectProducts] = useState<string[]>([]);
  const [editProjectProducts, setEditProjectProducts] = useState<string[]>([]);
  const [webhookProject, setWebhookProject] = useState("none");
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [projectTemplates, setProjectTemplates] = useState<ProjectTemplate[]>([]);
  const [kpis, setKpis] = useState({ total: 0, success: 0, errors: 0, rate: 0 });
  const [testDialog, setTestDialog] = useState<Automacao | null>(null);
  const [testForm, setTestForm] = useState({ nome: "João Teste", email: "joao@teste.com", telefone: "(11) 99999-9999", produto: "Produto Teste", provider_id: "" });
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [filterProject, setFilterProject] = useState<string>("__all__");
  const [filterCampanha, setFilterCampanha] = useState<string>("__all__");
  const [leadCounts, setLeadCounts] = useState<{ byCamp: Map<string, number>; byProject: Map<string, number>; global: number }>({ byCamp: new Map(), byProject: new Map(), global: 0 });
  const [allTags, setAllTags] = useState<string[]>([]);
  const [allProducts, setAllProducts] = useState<string[]>([]);
  const [customTagMode, setCustomTagMode] = useState(false);
  const [customProductMode, setCustomProductMode] = useState(false);
  const [customTagModeNew, setCustomTagModeNew] = useState(false);
  const [customProductModeNew, setCustomProductModeNew] = useState(false);
  const [health, setHealth] = useState<Map<string, { execucoes: number; sucessos: number; falhas: number; taxa_sucesso: number }>>(new Map());
  const [versionsOf, setVersionsOf] = useState<Automacao | null>(null);
  const [versionsList, setVersionsList] = useState<any[]>([]);

  // ── Data loading ─────────────────────────────────────────────
  const load = async () => {
    const [aRes, wRes, pRes, provRes, hubRes, cRes] = await Promise.all([
      supabase.from("imphq_automacoes").select("*").order("created_at", { ascending: false }),
      supabase.from("imphq_webhooks").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("imphq_projects").select("id, name").order("name"),
      supabase.from("imphq_wa_providers").select("*").eq("is_active", true).order("created_at"),
      supabase.from("wa_hub_iso_sessions").select("id, session_key, tenant_id, status").eq("status", "connected"),
      supabase.from("imphq_campanhas" as any).select("*").order("created_at", { ascending: false }),
    ]);
    setAutomacoes((aRes.data || []).map((a: any) => ({ ...a, acoes: a.acoes || [] })));
    setWebhooks(wRes.data || []);
    setProjects(pRes.data || []);
    setCampanhas(((cRes.data || []) as any) as Campanha[]);
    const hubProviders = (hubRes.data || []).map((s: any) => ({
      id: `hub_${s.id}`, provider: "hub_local", instance_name: s.session_key,
      twilio_from: null, project_id: s.tenant_id || null,
    }));
    setProviders([...(provRes.data || []), ...hubProviders]);

    // Fetch distinct tags and all products
    try {
      const [fullProjsRes, tagCountsRes] = await Promise.all([
        supabase.from("imphq_projects").select("data"),
        supabase.rpc("get_lead_tag_counts", { p_project_id: null, p_limit: 200 })
      ]);
      const prodsSet = new Set<string>();
      (fullProjsRes.data || []).forEach((p: any) => {
        const prods = (p.data?.produtos || []) as any[];
        prods.forEach(prod => {
          if (prod.nome) prodsSet.add(prod.nome);
        });
      });
      setAllProducts(Array.from(prodsSet).sort());
      setAllTags((tagCountsRes.data || []).map((t: any) => t.tag).filter(Boolean));
    } catch (e) {
      console.warn("Erro ao buscar tags/produtos extras", e);
    }

    // Lead counts (últimos 30 dias) para badges nos cards
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: leadsRecent } = await supabase
      .from("imphq_leads")
      .select("project_id, campanha_id")
      .gte("criado_em", since)
      .limit(5000);
    const byCamp = new Map<string, number>();
    const byProject = new Map<string, number>();
    let global = 0;
    (leadsRecent || []).forEach((l: any) => {
      global++;
      if (l.campanha_id) byCamp.set(l.campanha_id, (byCamp.get(l.campanha_id) || 0) + 1);
      if (l.project_id) byProject.set(l.project_id, (byProject.get(l.project_id) || 0) + 1);
    });
    setLeadCounts({ byCamp, byProject, global });
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

  // Open editor when arriving via ?flow=<id> (e.g., from Imperius createFlow)
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const flowId = searchParams.get("flow");
    if (!flowId || automacoes.length === 0) return;
    const target = automacoes.find((a) => a.id === flowId);
    if (target) {
      setEditing(target);
      searchParams.delete("flow");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, automacoes]);


  // ── Templates loading ────────────────────────────────────────
  const loadTemplates = async () => {
    if (!editing?.project_id) { setProjectTemplates([]); return; }
    const [projRes, waRes] = await Promise.all([
      supabase.from("imphq_projects").select("data").eq("id", editing.project_id!).single(),
      supabase.from("imphq_wa_templates").select("name, content").eq("project_id", editing.project_id!),
    ]);
    const tpls: ProjectTemplate[] = [];
    const d = (projRes.data?.data || {}) as any;
    if (Array.isArray(d.emails)) d.emails.forEach((e: any, i: number) => { if (e.body) tpls.push({ label: e.subject || `Email ${i + 1}`, content: e.body, source: "Email" }); });
    if (d.email_config?.templates && Array.isArray(d.email_config.templates)) d.email_config.templates.forEach((t: any, i: number) => { if (t.html_body) tpls.push({ label: t.subject || `Resend ${i + 1}`, content: t.html_body, source: "✉️ Resend" }); });
    if (d.copy_arsenal) { const ca = d.copy_arsenal; if (ca.headlines) tpls.push({ label: "Headlines", content: ca.headlines, source: "Copy" }); if (ca.storytelling) tpls.push({ label: "Storytelling", content: ca.storytelling, source: "Copy" }); if (ca.ctas) tpls.push({ label: "CTAs", content: ca.ctas, source: "Copy" }); }
    if (waRes.data?.length) waRes.data.forEach((t: any) => { if (t.content) tpls.push({ label: t.name || "WhatsApp", content: t.content, source: "💬 WhatsApp" }); });
    setProjectTemplates(tpls);
  };

  useEffect(() => { loadTemplates(); }, [editing?.project_id]);

  useEffect(() => {
    if (!form.project_id) { setProjectProducts([]); return; }
    supabase.from("imphq_projects").select("data").eq("id", form.project_id).single().then(({ data }) => {
      setProjectProducts(((data?.data as any)?.produtos || []).map((p: any) => p.nome).filter(Boolean));
    });
  }, [form.project_id]);

  useEffect(() => {
    if (!editing?.project_id) { setEditProjectProducts([]); return; }
    supabase.from("imphq_projects").select("data").eq("id", editing.project_id).single().then(({ data }) => {
      setEditProjectProducts(((data?.data as any)?.produtos || []).map((p: any) => p.nome).filter(Boolean));
    });
  }, [editing?.project_id]);

  // ── CRUD operations ──────────────────────────────────────────
  const createAutomacao = async (preset?: { nome?: string; trigger_tipo?: string; acoes?: Acao[] }) => {
    const nome = preset?.nome || form.nome;
    if (!nome.trim()) { toast.error("Nome obrigatório"); return; }
    const { data, error } = await supabase.from("imphq_automacoes").insert({
      id: crypto.randomUUID(), nome, trigger_tipo: preset?.trigger_tipo || form.trigger_tipo,
      project_id: form.project_id || null, acoes: (preset?.acoes || []) as any, ativo: true,
      produto: (form as any).produto || null,
      campanha_id: form.campanha_id || null,
      tag_filtro: form.tag_filtro || null,
    } as any).select("*").single();
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Automação criada!"); setShowNew(false);
    setForm({ nome: "", trigger_tipo: "carrinho_abandonado", project_id: "", produto: "", campanha_id: "", tag_filtro: "" });
    setCustomTagModeNew(false); setCustomProductModeNew(false); load();
    if (data && preset?.acoes?.length) setEditing(data as any);
  };

  const [templates, setTemplates] = useState<any[]>([]);
  useEffect(() => {
    if (!showNew) return;
    supabase.from("imphq_flow_templates" as any).select("*").order("ordem").then(({ data }) => setTemplates(data || []));
  }, [showNew]);

  const useTemplate = async (tpl: any) => {
    await createAutomacao({ nome: tpl.nome, trigger_tipo: tpl.trigger_tipo, acoes: tpl.acoes || [] });
  };


  const validateFlow = (auto: Automacao): string[] => {
    const warnings: string[] = [];
    if (!auto.acoes || auto.acoes.length === 0) {
      warnings.push("O fluxo não tem nenhuma ação configurada.");
      return warnings;
    }
    auto.acoes.forEach((a, i) => {
      const n = i + 1;
      const needsContent = ["whatsapp", "email", "telegram", "audio", "ia_message", "notify_operator", "gpt_prompt"];
      if (needsContent.includes(a.tipo)) {
        const hasContent = (a.mensagem || a.template || a.corpo || a.assunto || a.conteudo || "").trim();
        if (!hasContent) warnings.push(`Etapa ${n} (${a.tipo}): sem conteúdo configurado.`);
      }
      if (a.tipo === "email" && !(a.assunto || a.template || "").trim()) {
        warnings.push(`Etapa ${n} (email): sem assunto ou corpo.`);
      }
      if (a.tipo === "ab_split" && !a.rota_a_porcentagem) {
        warnings.push(`Etapa ${n} (Divisão A/B): porcentagem não configurada.`);
      }
      if (a.tipo === "webhook_call" && !(a.webhook_url || "").trim()) {
        warnings.push(`Etapa ${n} (Webhook): URL não configurada.`);
      }
    });
    const hasOnlyDelays = auto.acoes.every(a => a.tipo === "aguardar" || a.tipo === "delay");
    if (hasOnlyDelays) warnings.push("O fluxo só tem etapas de espera — nenhuma mensagem será enviada.");
    const msgTypes = ["whatsapp", "email", "telegram", "audio", "ia_message"];
    const hasMsgAction = auto.acoes.some(a => msgTypes.includes(a.tipo));
    if (!hasMsgAction) warnings.push("Nenhuma ação de envio de mensagem no fluxo.");
    return warnings;
  };

  const saveAutomacao = async () => {
    if (!editing) return;
    const warnings = validateFlow(editing);
    if (warnings.length > 0) {
      warnings.forEach(w => toast.warning(w, { duration: 5000 }));
    }
    const { error } = await supabase.from("imphq_automacoes").update({
      nome: editing.nome, trigger_tipo: editing.trigger_tipo,
      acoes: editing.acoes as any, ativo: editing.ativo, project_id: editing.project_id,
      produto: (editing as any).produto || null, provider_id: editing.provider_id || null,
      quiet_start: editing.quiet_start ?? null,
      quiet_end: editing.quiet_end ?? null,
      dedupe_hours: editing.dedupe_hours ?? 0,
      campanha_id: editing.campanha_id || null,
      tag_filtro: editing.tag_filtro || null,
      link_checkout: (editing as any).link_checkout || null,
      stalled_hours: editing.stalled_hours ?? null,
      stalled_operator: editing.stalled_operator || null,
      follow_up_hours: editing.follow_up_hours ?? null,
      follow_up_template: editing.follow_up_template || null,
    } as any).eq("id", editing.id);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Salvo!"); setEditing(null);
    setCustomTagMode(false); setCustomProductMode(false); load();
  };

  const toggleAtivo = async (id: string, ativo: boolean) => {
    await supabase.from("imphq_automacoes").update({ ativo }).eq("id", id);
    load();
  };

  const deleteAutomacao = async (id: string) => {
    await supabase.from("imphq_automacoes").delete().eq("id", id);
    toast.success("Removida"); setEditing(null); load();
  };

  const duplicateAutomacao = async (auto: Automacao) => {
    const { error } = await supabase.from("imphq_automacoes").insert({
      id: crypto.randomUUID(), nome: `Cópia de ${auto.nome}`, trigger_tipo: auto.trigger_tipo,
      project_id: auto.project_id || null, acoes: auto.acoes as any, ativo: false,
      produto: (auto as any).produto || null,
    } as any);
    if (error) { toast.error("Erro ao duplicar: " + error.message); return; }
    toast.success("Automação duplicada!"); load();
  };

  const testAutomacao = async () => {
    if (!testDialog) return;
    setIsTesting(true); setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("openflow-executor", {
        body: {
          trigger_tipo: testDialog.trigger_tipo,
          project_id: testDialog.project_id || "test-project",
          automacao_id: testDialog.id,
          lead_data: { nome: testForm.nome, email: testForm.email, telefone: testForm.telefone, phone: testForm.telefone.replace(/\D/g, ""), produto: testForm.produto, lead_id: "test-lead-" + Date.now(), provider_id: testForm.provider_id || undefined },
        },
      });
      if (error) throw error;
      setTestResult(data);
      toast[data?.ok ? "success" : "error"](data?.ok ? `Teste concluído! ${data.executed} execução(ões)` : data?.error || "Erro");
      loadKpis();
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || "desconhecido"));
      setTestResult({ error: e?.message });
    } finally { setIsTesting(false); }
  };

  const generateWithAI = async () => {
    if (!editing) return;
    setIsGeneratingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke("openflow-ai", {
        body: { project_id: editing.project_id || null, trigger_tipo: editing.trigger_tipo, num_etapas: 5, produto: editing.produto || null },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      if (data?.acoes?.length) { setEditing({ ...editing, acoes: data.acoes }); toast.success(`${data.acoes.length} ações geradas!`); }
      else toast.error("IA não retornou ações");
    } catch (e: any) { toast.error("Erro: " + (e?.message || "erro")); }
    finally { setIsGeneratingAI(false); }
  };

  // ── Derived values ───────────────────────────────────────────
  const projectName = (id?: string) => projects.find(p => p.id === id)?.name || "";
  const baseWebhookUrl = "https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/webhook-pagamento";
  const webhookUrl = webhookProject !== "none" ? `${baseWebhookUrl}?project=${webhookProject}` : baseWebhookUrl;

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        icon={Zap}
        title="OpenFlow"
        subtitle="Automações por gatilho · webhooks unificados"
        kpi={{ label: "Ativas", value: automacoes.filter((a) => a.ativo).length, hint: `${automacoes.length} total` }}
        primaryAction={
          <div className="flex items-center gap-2">
            <SectionInfo {...sectionHelpTexts.openflow} />
            <Button size="sm" onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" /> Nova</Button>
          </div>
        }
      />


      {/* KPI Strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Execuções (7d)", value: kpis.total, icon: Activity, iconClass: "text-primary" },
          { label: "Sucesso", value: kpis.success, icon: CheckCircle2, iconClass: "text-emerald-500" },
          { label: "Erros", value: kpis.errors, icon: XCircle, iconClass: "text-red-500" },
          { label: "Taxa", value: `${kpis.rate}%`, icon: Zap, iconClass: "text-blue-500" },
        ].map(kpi => (
          <Card key={kpi.label} className="bg-card border-border">
            <CardContent className="p-3 flex items-center gap-3">
              <kpi.icon className={`h-4 w-4 ${kpi.iconClass} shrink-0`} />
              <div className="min-w-0">
                <p className="text-lg font-semibold text-foreground leading-tight">{kpi.value}</p>
                <p className="text-[10px] text-muted-foreground truncate">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="automacoes">
        <TabsList>
          <TabsTrigger value="automacoes">Fluxos</TabsTrigger>
          <TabsTrigger value="campanhas"><Megaphone className="h-3 w-3 mr-1" /> Campanhas</TabsTrigger>
          <TabsTrigger value="execucoes"><Activity className="h-3 w-3 mr-1" /> Execuções</TabsTrigger>
          <TabsTrigger value="reativacao"><Clock className="h-3 w-3 mr-1" /> Reativação</TabsTrigger>
          <TabsTrigger value="simulador"><Play className="h-3 w-3 mr-1" /> Simulador</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart3 className="h-3 w-3 mr-1" /> Analytics</TabsTrigger>
          <TabsTrigger value="logs"><ScrollText className="h-3 w-3 mr-1" /> Logs</TabsTrigger>
          <TabsTrigger value="guia"><BookOpen className="h-3 w-3 mr-1" /> Guia</TabsTrigger>
        </TabsList>

        <TabsContent value="campanhas" className="mt-4">
          <CampanhasManager projects={projects} onChange={load} />
        </TabsContent>

        <TabsContent value="reativacao" className="mt-4">
          <ColdLeadReactivation projects={projects} automacoes={automacoes} />
        </TabsContent>

        <TabsContent value="simulador" className="mt-4">
          <FlowSimulator automacoes={automacoes} projects={projects} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-4 space-y-5">
          <OpenFlowAnalytics automacoes={automacoes} />
          <FlowROIDashboard projectId={filterProject !== "__all__" && filterProject !== "__none__" ? filterProject : (projects[0]?.id || "")} />
        </TabsContent>

        {/* ── Automações Tab ────────────────────────────────────── */}
        <TabsContent value="automacoes" className="space-y-5 mt-4">
          {/* Webhook URL */}
          <Card className="bg-card border-border">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">🔗 Webhook URL:</span>
                <Select value={webhookProject} onValueChange={setWebhookProject}>
                  <SelectTrigger className="w-[180px] h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Genérica</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-secondary px-3 py-1.5 rounded flex-1 truncate font-mono">{webhookUrl}</code>
                <Button size="sm" variant="outline" className="h-7" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("Copiado!"); }}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Filtrar por projeto:</span>
              <Select value={filterProject} onValueChange={v => { setFilterProject(v); setFilterCampanha("__all__"); }}>
                <SelectTrigger className="h-7 w-[200px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os projetos</SelectItem>
                  <SelectItem value="__none__">Sem projeto</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Filtrar por campanha:</span>
              <Select value={filterCampanha} onValueChange={setFilterCampanha}>
                <SelectTrigger className="h-7 w-[200px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas as campanhas</SelectItem>
                  <SelectItem value="__none__">Sem campanha</SelectItem>
                  {campanhas
                    .filter(c => filterProject === "__all__" || c.project_id === filterProject)
                    .map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Automações agrupadas por campanha */}
          {(() => {
            const filtered = automacoes.filter(a => {
              if (filterProject !== "__all__") {
                if (filterProject === "__none__" && a.project_id) return false;
                if (filterProject !== "__none__" && a.project_id !== filterProject) return false;
              }
              if (filterCampanha === "__all__") return true;
              if (filterCampanha === "__none__") return !a.campanha_id;
              return a.campanha_id === filterCampanha;
            });
            const groups = new Map<string, Automacao[]>();
            filtered.forEach(a => {
              const key = a.campanha_id || "__none__";
              if (!groups.has(key)) groups.set(key, []);
              groups.get(key)!.push(a);
            });
            const renderCard = (a: Automacao) => {
              const tm = triggerMeta(a.trigger_tipo);
              const camp = campanhas.find(c => c.id === a.campanha_id);
              return (
                <Card
                  key={a.id}
                  className={`bg-card border-border border-l-4 ${tm.color} hover:border-primary/20 cursor-pointer transition-all`}
                  onClick={() => setEditing({ ...a })}
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span>{tm.icon}</span>
                        <h3 className="font-medium text-sm truncate">{a.nome}</h3>
                        {(a as any).source === "imperius" && (
                          <Badge variant="outline" className="text-[9px] uppercase bg-violet-500/15 text-violet-300 border-violet-500/30 shrink-0">
                            Imperius
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setTestDialog(a); setTestResult(null); }}>
                          <Play className="h-3 w-3 text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicateAutomacao(a)}>
                          <CopyPlus className="h-3 w-3 text-muted-foreground" />
                        </Button>
                        <Switch checked={a.ativo} onCheckedChange={v => toggleAtivo(a.id, v)} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{tm.label}</Badge>
                      {a.project_id && <Badge className="text-[9px] bg-primary/10 text-primary border-0">{projectName(a.project_id)}</Badge>}
                      {camp && <Badge className="text-[9px] bg-violet-500/10 text-violet-400 border-0">📣 {camp.nome}</Badge>}
                      {a.tag_filtro && <Badge className="text-[9px] bg-indigo-500/10 text-indigo-400 border-0">🏷️ {a.tag_filtro}</Badge>}
                      {(a as any).produto && <Badge variant="outline" className="text-[9px]">📦 {(a as any).produto}</Badge>}
                      {(() => {
                        const n = a.campanha_id
                          ? (leadCounts.byCamp.get(a.campanha_id) || 0)
                          : a.project_id
                          ? (leadCounts.byProject.get(a.project_id) || 0)
                          : leadCounts.global;
                        return (
                          <Badge variant="outline" className="text-[9px] gap-1" title="Leads no escopo (últimos 30 dias)">
                            <Users className="h-2.5 w-2.5" /> {n}
                          </Badge>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-1">
                      {a.acoes.map((ac, i) => {
                        const AcIcon = ACAO_TIPOS.find(t => t.value === ac.tipo)?.icon || Zap;
                        return (
                          <div key={i} className="flex items-center gap-1">
                            <div className="p-1 bg-secondary rounded"><AcIcon className="h-3 w-3 text-muted-foreground" /></div>
                            {ac.delay_min > 0 && <span className="text-[9px] text-muted-foreground">{ac.delay_min}m</span>}
                            {i < a.acoes.length - 1 && <span className="text-muted-foreground/40">→</span>}
                          </div>
                        );
                      })}
                      {a.acoes.length === 0 && <span className="text-[10px] text-muted-foreground italic">Sem ações</span>}
                    </div>
                  </CardContent>
                </Card>
              );
            };
            const groupKeys = Array.from(groups.keys()).sort((a, b) => (a === "__none__" ? 1 : b === "__none__" ? -1 : 0));
            return (
              <div className="space-y-5">
                {groupKeys.map(key => {
                  const camp = campanhas.find(c => c.id === key);
                  return (
                    <div key={key} className="space-y-2">
                      <div className="flex items-center gap-2">
                        {camp ? (
                          <>
                            <Megaphone className="h-3.5 w-3.5 text-violet-400" />
                            <h3 className="text-xs uppercase tracking-wider font-medium text-foreground">{camp.nome}</h3>
                            <Badge variant="outline" className="text-[9px]">{projectName(camp.project_id)}</Badge>
                            {camp.status !== "ativa" && <Badge variant="outline" className="text-[9px]">{camp.status}</Badge>}
                          </>
                        ) : (
                          <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Sem campanha</h3>
                        )}
                        <span className="text-[10px] text-muted-foreground">· {groups.get(key)!.length} fluxo(s)</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {groups.get(key)!.map(renderCard)}
                      </div>
                    </div>
                  );
                })}
                {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhuma automação</p>}
              </div>
            );
          })()}

          {/* Recent Webhooks */}
          {webhooks.length > 0 && (
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Webhooks Recentes</p>
                <div className="space-y-1 max-h-[240px] overflow-y-auto">
                  {webhooks.slice(0, 15).map(w => (
                    <div key={w.id} className="flex items-center justify-between p-2 rounded bg-secondary/50 text-xs">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[9px]">{w.plataforma}</Badge>
                        <span className="text-muted-foreground">{w.evento}</span>
                        {w.project_id && <Badge className="text-[9px] bg-primary/10 text-primary border-0">{projectName(w.project_id)}</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        {w.processado && <span className="text-emerald-500 text-[9px]">✓</span>}
                        <span className="text-[10px] text-muted-foreground">{new Date(w.created_at).toLocaleString("pt-BR")}</span>
                        <Button
                          variant="ghost" size="icon" className="h-6 w-6"
                          title="Reprocessar webhook"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              toast.info("Reprocessando...");
                              const { data, error } = await supabase.functions.invoke("webhook-pagamento", {
                                body: w.payload,
                                headers: w.project_id ? { "x-reprocess": "true" } : undefined,
                              });
                              if (error) throw error;
                              toast.success(`Reprocessado! Evento: ${data?.evento || w.evento}`);
                              load(); loadKpis();
                            } catch (err: any) {
                              toast.error("Erro ao reprocessar: " + (err?.message || "desconhecido"));
                            }
                          }}
                        >
                          <RotateCcw className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="execucoes" className="mt-4">
          <ExecutionsPanel automacoes={automacoes} projects={projects} />
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <AutomacaoLogs automacoes={automacoes} projects={projects} />
        </TabsContent>

        <TabsContent value="guia" className="mt-4">
          <WebhookGuide projects={projects} />
        </TabsContent>
      </Tabs>

      {/* ── New Automation Dialog ──────────────────────────────── */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Automação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Recuperação de Carrinho" /></div>
            <div>
              <Label>Trigger</Label>
              <Select value={form.trigger_tipo} onValueChange={v => setForm({ ...form, trigger_tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-[60vh]">{renderTriggerOptions()}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Projeto</Label>
              <Select value={form.project_id || "none"} onValueChange={v => setForm({ ...form, project_id: v === "none" ? "" : v, produto: "" })}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Todos os projetos</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Produto Selector (Novo com dropdown e fallback digitação) */}
            <div>
              <Label>Produto (Opcional)</Label>
              {customProductModeNew ? (
                <div className="flex gap-2 items-center">
                  <Input
                    value={form.produto || ""}
                    onChange={e => setForm({ ...form, produto: e.target.value })}
                    placeholder="Digite o nome do produto..."
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => { setCustomProductModeNew(false); setForm({ ...form, produto: "" }); }}>
                    Voltar para lista
                  </Button>
                </div>
              ) : (
                <Select
                  value={form.produto || "none"}
                  onValueChange={v => {
                    if (v === "custom") {
                      setCustomProductModeNew(true);
                      setForm({ ...form, produto: "" });
                    } else {
                      setForm({ ...form, produto: v === "none" ? "" : v });
                    }
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Todos os produtos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Todos os produtos</SelectItem>
                    {(form.project_id && projectProducts.length > 0 ? projectProducts : allProducts).map(p => (
                      <SelectItem key={p} value={p}>📦 {p}</SelectItem>
                    ))}
                    <SelectItem value="custom" className="text-primary font-medium">➕ Digitar produto personalizado...</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Tag Filter Selector (Novo com dropdown e fallback digitação) */}
            <div>
              <Label>Filtrar por Tag do Lead (Opcional)</Label>
              {customTagModeNew ? (
                <div className="flex gap-2 items-center">
                  <Input
                    value={form.tag_filtro || ""}
                    onChange={e => setForm({ ...form, tag_filtro: e.target.value })}
                    placeholder="Digite a tag personalizada..."
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => { setCustomTagModeNew(false); setForm({ ...form, tag_filtro: "" }); }}>
                    Voltar para lista
                  </Button>
                </div>
              ) : (
                <Select
                  value={form.tag_filtro || "none"}
                  onValueChange={v => {
                    if (v === "custom") {
                      setCustomTagModeNew(true);
                      setForm({ ...form, tag_filtro: "" });
                    } else {
                      setForm({ ...form, tag_filtro: v === "none" ? "" : v });
                    }
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Todas as tags (Sem filtro)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma tag (Qualquer lead)</SelectItem>
                    {allTags.map(t => <SelectItem key={t} value={t}>🏷️ {t}</SelectItem>)}
                    <SelectItem value="custom" className="text-primary font-medium">➕ Digitar tag personalizada...</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            {form.project_id && (
              <div>
                <Label>Campanha (opcional)</Label>
                <Select value={form.campanha_id || "none"} onValueChange={v => setForm({ ...form, campanha_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Sem campanha" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem campanha</SelectItem>
                    {campanhas.filter(c => c.project_id === form.project_id).map(c => (
                      <SelectItem key={c.id} value={c.id}>📣 {c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-1">Vincular a uma campanha permite agrupar formulários e fluxos por iniciativa.</p>
              </div>
            )}

            {templates.length > 0 && (
              <div className="border-t border-border/40 pt-3 space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Ou comece de um template</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {templates.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => useTemplate(t)}
                      className="text-left p-2.5 rounded border border-border/40 hover:border-primary/60 hover:bg-secondary/40 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <span>{t.icon}</span>{t.nome}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{t.descricao}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter><Button onClick={() => createAutomacao()}>Criar vazio</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ───────────────────────────────────────── */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Automação</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div><Label>Nome</Label><Input value={editing.nome} onChange={e => setEditing({ ...editing, nome: e.target.value })} className="h-8 text-xs" /></div>
                <div>
                  <Label>Projeto</Label>
                  <Select value={editing.project_id || "none"} onValueChange={v => setEditing({ ...editing, project_id: v === "none" ? undefined : v, produto: undefined })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Todos</SelectItem>
                      {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Trigger</Label>
                  <Select value={editing.trigger_tipo} onValueChange={v => setEditing({ ...editing, trigger_tipo: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-[60vh]">{renderTriggerOptions()}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Produto</Label>
                  {customProductMode ? (
                    <div className="flex gap-1.5 items-center">
                      <Input
                        value={editing.produto || ""}
                        onChange={e => setEditing({ ...editing, produto: e.target.value })}
                        className="h-8 text-xs"
                        placeholder="Produto..."
                      />
                      <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0 text-[10px]" onClick={() => { setCustomProductMode(false); setEditing({ ...editing, produto: undefined }); }}>
                        Lista
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={editing.produto || "none"}
                      onValueChange={v => {
                        if (v === "custom") {
                          setCustomProductMode(true);
                          setEditing({ ...editing, produto: "" });
                        } else {
                          setEditing({ ...editing, produto: v === "none" ? undefined : v });
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Todos</SelectItem>
                        {(editProjectProducts.length > 0 ? editProjectProducts : allProducts).map(p => (
                          <SelectItem key={p} value={p}>📦 {p}</SelectItem>
                        ))}
                        <SelectItem value="custom" className="text-primary font-medium text-xs">➕ Digitar personalizado...</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div>
                  <Label>Filtrar por Tag</Label>
                  {customTagMode ? (
                    <div className="flex gap-1.5 items-center">
                      <Input
                        value={editing.tag_filtro || ""}
                        onChange={e => setEditing({ ...editing, tag_filtro: e.target.value })}
                        className="h-8 text-xs"
                        placeholder="Tag..."
                      />
                      <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0 text-[10px]" onClick={() => { setCustomTagMode(false); setEditing({ ...editing, tag_filtro: undefined }); }}>
                        Lista
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={editing.tag_filtro || "none"}
                      onValueChange={v => {
                        if (v === "custom") {
                          setCustomTagMode(true);
                          setEditing({ ...editing, tag_filtro: "" });
                        } else {
                          setEditing({ ...editing, tag_filtro: v === "none" ? undefined : v });
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sem tag" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma tag (Qualquer lead)</SelectItem>
                        {allTags.map(t => <SelectItem key={t} value={t}>🏷️ {t}</SelectItem>)}
                        <SelectItem value="custom" className="text-primary font-medium text-xs">➕ Digitar personalizado...</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              {editing.project_id && (
                <div>
                  <Label>Campanha</Label>
                  <Select value={editing.campanha_id || "none"} onValueChange={v => setEditing({ ...editing, campanha_id: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="Sem campanha" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem campanha (escopo: projeto inteiro)</SelectItem>
                      {campanhas.filter(c => c.project_id === editing.project_id).map(c => (
                        <SelectItem key={c.id} value={c.id}>📣 {c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>WhatsApp Padrão</Label>
                  <Select 
                    key={editing.provider_id || "auto"} 
                    value={editing.provider_id || "auto"} 
                    onValueChange={v => {
                      const newPid = v === "auto" ? undefined : v;
                      setEditing(prev => prev ? { ...prev, provider_id: newPid } : prev);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Auto (primeiro ativo)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">🔄 Auto (primeiro ativo)</SelectItem>
                      {providers.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.provider === "hub_local" ? "📱" : p.provider === "evolution" ? "🟢" : "🔵"} {p.display_name || p.instance_name || p.twilio_from || p.id.slice(0, 12)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Link de Checkout Padrão ({"{{link}}"})</Label>
                  <Input 
                    type="text" 
                    placeholder="https://pay.kiwify.com.br/..." 
                    value={(editing as any).link_checkout || ""} 
                    onChange={e => setEditing({ ...editing, link_checkout: e.target.value })} 
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
                <div>
                  <Label className="text-xs">Silêncio - início (h)</Label>
                  <Input type="number" min={0} max={23} placeholder="ex: 22" value={editing.quiet_start ?? ""} onChange={e => setEditing({ ...editing, quiet_start: e.target.value === "" ? null : Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">Silêncio - fim (h)</Label>
                  <Input type="number" min={0} max={23} placeholder="ex: 8" value={editing.quiet_end ?? ""} onChange={e => setEditing({ ...editing, quiet_end: e.target.value === "" ? null : Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">Dedupe (h)</Label>
                  <Input type="number" min={0} placeholder="0" value={editing.dedupe_hours ?? 0} onChange={e => setEditing({ ...editing, dedupe_hours: Number(e.target.value) || 0 })} />
                </div>
                <div className="flex items-center justify-between gap-2 pb-1">
                  <Label>Ativo</Label>
                  <Switch checked={editing.ativo} onCheckedChange={v => setEditing({ ...editing, ativo: v })} />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground -mt-2">Janela de silêncio: não dispara nesse intervalo (ex.: 22 → 8). Dedupe: bloqueia disparos repetidos pro mesmo lead pelas N horas.</p>

              {/* Gatilhos Comportamentais */}
              <div className="border border-border/60 bg-secondary/20 rounded-lg p-3 space-y-3">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  Gatilhos Comportamentais (Event-Driven)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Bloco Notificar Atendente se travado */}
                  <div className="space-y-2 border border-border/40 p-2.5 rounded bg-background/50">
                    <Label className="text-xs font-medium text-foreground">🚨 Alerta de Travamento (Lead parado)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Tempo limite (horas)</Label>
                        <Input 
                          type="number" 
                          min={1} 
                          placeholder="Ex: 2" 
                          value={editing.stalled_hours ?? ""} 
                          onChange={e => setEditing({ ...editing, stalled_hours: e.target.value === "" ? null : Number(e.target.value) })} 
                          className="h-8 text-xs font-normal"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Atendente a notificar</Label>
                        <Input 
                          type="text" 
                          placeholder="Ex: CARINA ou todos" 
                          value={editing.stalled_operator || ""} 
                          onChange={e => setEditing({ ...editing, stalled_operator: e.target.value })} 
                          className="h-8 text-xs font-normal"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Se o lead ficar na mesma etapa por mais de X horas sem responder, envia alerta interno no Imperio HQ.</p>
                  </div>

                  {/* Bloco Follow-up automático */}
                  <div className="space-y-2 border border-border/40 p-2.5 rounded bg-background/50">
                    <Label className="text-xs font-medium text-foreground">🔁 Follow-Up Automático (Inatividade)</Label>
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Tempo de espera (horas)</Label>
                        <Input 
                          type="number" 
                          min={1} 
                          placeholder="Ex: 4" 
                          value={editing.follow_up_hours ?? ""} 
                          onChange={e => setEditing({ ...editing, follow_up_hours: e.target.value === "" ? null : Number(e.target.value) })} 
                          className="h-8 text-xs font-normal w-full"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Mensagem de Follow-up (WhatsApp)</Label>
                        <textarea
                          placeholder="Olá {{nome}}, tudo bem? Vi que ficou com dúvida na última etapa..."
                          value={editing.follow_up_template || ""}
                          onChange={e => setEditing({ ...editing, follow_up_template: e.target.value })}
                          className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Se o lead não responder por X horas no WhatsApp, dispara essa mensagem automaticamente para reengajá-lo.</p>
                  </div>
                </div>
              </div>
              <FlowEditor
                triggerTipo={editing.trigger_tipo}
                acoes={editing.acoes}
                onChange={acoes => setEditing({ ...editing, acoes })}
                onGenerateAI={generateWithAI}
                isGenerating={isGeneratingAI}
                templates={projectTemplates}
                providers={editing.project_id ? providers.filter((p: any) => p.project_id === editing.project_id) : providers}
                projectId={editing.project_id}
                onTemplateSaved={loadTemplates}
                automacaoId={editing.id}
              />
            </div>
          )}
          <DialogFooter className="flex justify-between">
            <Button variant="destructive" size="sm" onClick={() => editing && deleteAutomacao(editing.id)}><Trash2 className="h-3 w-3 mr-1" /> Excluir</Button>
            <Button onClick={saveAutomacao}><Save className="h-3 w-3 mr-1" /> Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Test Dialog ───────────────────────────────────────── */}
      <Dialog open={!!testDialog} onOpenChange={() => { setTestDialog(null); setTestResult(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Testar Automação</DialogTitle></DialogHeader>
          {testDialog && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Testar <strong>{testDialog.nome}</strong></p>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Nome</Label><Input value={testForm.nome} onChange={e => setTestForm({ ...testForm, nome: e.target.value })} className="h-8 text-xs" /></div>
                <div><Label className="text-xs">Email</Label><Input value={testForm.email} onChange={e => setTestForm({ ...testForm, email: e.target.value })} className="h-8 text-xs" /></div>
                <div><Label className="text-xs">Telefone</Label><Input value={testForm.telefone} onChange={e => setTestForm({ ...testForm, telefone: e.target.value })} className="h-8 text-xs" placeholder="5511999999999" /></div>
                <div><Label className="text-xs">Produto</Label><Input value={testForm.produto} onChange={e => setTestForm({ ...testForm, produto: e.target.value })} className="h-8 text-xs" /></div>
              </div>
              <div>
                <Label className="text-xs">WhatsApp Provider (para envio real)</Label>
                <Select value={testForm.provider_id} onValueChange={v => setTestForm({ ...testForm, provider_id: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione para enviar WhatsApp real..." /></SelectTrigger>
                  <SelectContent>
                    {providers.map((p: any) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.provider === "hub_local" ? "📱" : p.provider === "evolution" ? "🟢" : "🔵"} {p.display_name || p.instance_name || p.twilio_from || p.id.slice(0, 12)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {providers.length === 0 && <p className="text-[10px] text-muted-foreground mt-1">Nenhum provider ativo encontrado.</p>}
              </div>
              {testResult && (
                <div className={`p-3 rounded border text-xs ${testResult.ok ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30"}`}>
                  {testResult.ok ? (
                    <div className="space-y-2">
                      <p className="font-medium text-emerald-500">✅ {testResult.executed} execução(ões) — {testResult.results?.reduce((s: number, r: any) => s + (r.messages_sent || 0), 0) || 0} msg enviada(s)</p>
                      {testResult.results?.map((r: any, i: number) => (
                        <div key={i} className="space-y-1 border-t border-border/30 pt-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[9px]">{r.status}</Badge>
                            <span className="text-[10px] font-medium">{r.automacao_nome}</span>
                            <span className="text-[10px] text-muted-foreground">{r.steps_executed} steps</span>
                          </div>
                          {r.step_results?.map((step: any, si: number) => (
                            <div key={si} className="flex items-center gap-2 pl-3 text-[10px]">
                              <span className="text-muted-foreground">#{si}</span>
                              <Badge className={`text-[8px] ${step.status === "sent" || step.status === "completed" ? "bg-emerald-500/20 text-emerald-400" : step.status === "error" ? "bg-red-500/20 text-red-400" : "bg-muted text-muted-foreground"}`}>
                                {step.tipo}: {step.status}
                              </Badge>
                              {step.reason && <span className="text-red-400">{step.reason}</span>}
                              {step.provider_id && <span className="text-muted-foreground">provider: {step.provider_id.slice(0, 8)}…</span>}
                              {step.message_preview && <span className="text-muted-foreground truncate max-w-[200px]">"{step.message_preview}"</span>}
                            </div>
                          ))}
                          {r.error && <p className="text-red-400 text-[10px] pl-3">❌ {r.error}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-red-400">❌ {testResult.error || "Erro"}</p>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={testAutomacao} disabled={isTesting}>
              {isTesting ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Executando...</> : <><Play className="h-3 w-3 mr-1" /> Testar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

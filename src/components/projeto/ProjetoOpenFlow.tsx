import { useEffect, useState, useMemo, useCallback } from "react";
import { z } from "zod";
import type { Tables, Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { jsonFields, jsonText, jsonNumber } from "@/lib/json-fields";
import { openFlowActionsSchema } from "@/lib/openflow-action-schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Plus, Trash2, Zap, MessageCircle, Play, Pause, Activity,
  CheckCircle2, Loader2, Megaphone, Mic, Mail, Clock, Tag,
  History, LogOut, Info, Bot, Layers, AlertTriangle, X, Package,
  ExternalLink, Copy, CopyPlus, ArrowRight, GitBranch, RefreshCw,
  Search, ShieldAlert, Sparkles, Filter, ChevronRight
} from "lucide-react";
import { toast } from "sonner";
import { FlowEditor, type Acao, type ProjectTemplate, type WaProvider } from "@/components/openflow/FlowEditor";
import { AutomacaoLogs } from "@/components/openflow/AutomacaoLogs";
import { CampanhasManager, type Campanha } from "@/components/openflow/CampanhasManager";
import { FlowSimulator } from "@/components/openflow/FlowSimulator";
import { VersionHistoryDrawer } from "@/components/openflow/VersionHistoryDrawer";
import { useAutoSave } from "@/components/openflow/flow-editor/useAutoSave";
import { SaveIndicator } from "@/components/openflow/flow-editor/SaveIndicator";
import { EditableTagList } from "@/components/projeto/EditableTagList";
import { X1BuilderWizard } from "@/components/openflow/X1BuilderWizard";
import { X1Checklist } from "@/components/openflow/flow-editor/X1Checklist";
import { AIGenerateDialog } from "@/components/openflow/AIGenerateDialog";
import { FLOW_TEMPLATES, type FlowTemplate } from "@/components/openflow/flow-editor/templates";

const TRIGGERS: { value: string; label: string; icon: string; color: string; group: string }[] = [
  { value: "carrinho_abandonado", label: "Carrinho Abandonado", icon: "🛒", color: "border-l-amber-500", group: "Pagamento" },
  { value: "aguardando_pagamento", label: "Aguardando Pagamento / Pix", icon: "💰", color: "border-l-yellow-500", group: "Pagamento" },
  { value: "boleto_gerado", label: "Boleto Gerado", icon: "📄", color: "border-l-yellow-600", group: "Pagamento" },
  { value: "pagamento_recusado", label: "Pagamento Recusado", icon: "❌", color: "border-l-red-500", group: "Pagamento" },
  { value: "pagamento_expirado", label: "Pagamento Expirado", icon: "⌛", color: "border-l-orange-500", group: "Pagamento" },
  { value: "compra_approved", label: "Compra Aprovada (qualquer)", icon: "✅", color: "border-l-emerald-500", group: "Pós-venda" },
  { value: "venda_principal_aprovada", label: "Venda Principal Aprovada", icon: "💎", color: "border-l-emerald-600", group: "Pós-venda" },
  { value: "primeiro_acesso", label: "Primeiro Acesso", icon: "🎉", color: "border-l-emerald-400", group: "Pós-venda" },
  { value: "upsell_aprovado", label: "Upsell Aprovado", icon: "⬆️", color: "border-l-green-600", group: "Pós-venda" },
  { value: "orderbump_aprovado", label: "Orderbump Aprovado", icon: "🎁", color: "border-l-green-500", group: "Pós-venda" },
  { value: "lead_novo", label: "Novo Lead", icon: "👤", color: "border-l-blue-500", group: "Lead" },
  { value: "inicio_checkout", label: "Início de Checkout", icon: "🛍️", color: "border-l-purple-500", group: "Lead" },
  { value: "tag_adicionada", label: "Tag Adicionada", icon: "🏷️", color: "border-l-indigo-500", group: "Lead" },
  { value: "whatsapp_mensagem_recebida", label: "Qualquer mensagem no WhatsApp", icon: "💬", color: "border-l-green-500", group: "WhatsApp" },
  { value: "whatsapp_palavra_chave", label: "Palavra-chave no WhatsApp", icon: "🔑", color: "border-l-green-600", group: "WhatsApp" },
  { value: "reembolso", label: "Reembolso", icon: "↩️", color: "border-l-red-500", group: "Retenção" },
  { value: "chargeback", label: "Chargeback", icon: "⚠️", color: "border-l-red-600", group: "Retenção" },
  { value: "compra_cancelada", label: "Compra Cancelada", icon: "🚫", color: "border-l-rose-500", group: "Retenção" },
  { value: "webhook_externo", label: "Webhook externo", icon: "🔗", color: "border-l-violet-500", group: "Outros canais" },
];

const CANAIS: { value: string; label: string; icon: string }[] = [
  { value: "whatsapp", label: "WhatsApp", icon: "💬" },
  { value: "messenger", label: "Messenger", icon: "📨" },
  { value: "webchat", label: "Chat do site", icon: "🌐" },
];

const TRIGGER_GROUPS = ["Pagamento", "Lead", "Pós-venda", "WhatsApp", "Retenção", "Outros canais"];
const triggerConfigSchema = z.object({
  keywords: z.array(z.string()).optional(),
  match_mode: z.enum(["any", "all", "exact", "regex"]).optional()
}).passthrough().nullable();

export interface Automacao {
  id: string;
  project_id?: string;
  produto?: string;
  nome: string;
  trigger_tipo: string;
  acoes: Acao[];
  ativo: boolean;
  created_at?: string;
  canal?: string | null;
  provider_id?: string;
  quiet_start?: number | null;
  quiet_end?: number | null;
  dedupe_hours?: number | null;
  campanha_id?: string | null;
  tag_filtro?: string | null;
  link_checkout?: string | null;
  stalled_hours?: number | null;
  stalled_operator?: string | null;
  follow_up_hours?: number | null;
  follow_up_template?: string | null;
  exit_trigger_tipo?: string | null;
  exit_trigger_payload?: Json;
  exit_conditions?: Json;
  stats_cache?: Json;
  exit_cascade?: boolean;
  flow_objective?: string | null;
  prioridade?: number | null;
  exclusivo?: boolean | null;
  trigger_config?: { keywords?: string[]; match_mode?: "any" | "all" | "exact" | "regex" } | null;
}

function readAutomacao(row: Tables<"imphq_automacoes">): Automacao {
  const acoes = openFlowActionsSchema.parse(row.acoes ?? []) as Acao[];
  const trigger_config = triggerConfigSchema.parse(row.trigger_config ?? null);
  return { ...row, acoes, trigger_config };
}

function actionJson(actions: Acao[]): Json {
  return JSON.parse(JSON.stringify(openFlowActionsSchema.parse(actions))) as Json;
}

const triggerMeta = (t: string) =>
  TRIGGERS.find(tr => tr.value === t) || { label: t, icon: "⚡", color: "border-l-primary", group: "Geral" };

interface Props {
  projectId: string;
  project: Tables<"imphq_projects">;
  onNavigateTab?: (tab: string) => void;
}

export function ProjetoOpenFlow({ projectId, project, onNavigateTab }: Props) {
  const [automacoes, setAutomacoes] = useState<Automacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<WaProvider[]>([]);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [kpis, setKpis] = useState({ total: 0, activeCount: 0, pausedCount: 0, executions7d: 0, success7d: 0, errors7d: 0, rate7d: 0 });
  const [alertDismissed, setAlertDismissed] = useState(false);

  // Sub-tabs
  const [subTab, setSubTab] = useState<"fluxos" | "templates" | "logs" | "campanhas">("fluxos");

  // Filter
  const [filterProduct, setFilterProduct] = useState<string>("__all__");
  const [searchFilter, setSearchFilter] = useState("");

  // Editor states
  const [editing, setEditing] = useState<Automacao | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [projectTemplates, setProjectTemplates] = useState<ProjectTemplate[]>([]);
  const [templatesRefresh, setTemplatesRefresh] = useState(0);

  // Creation dialogs
  const [showNewManual, setShowNewManual] = useState(false);
  const [showX1Wizard, setShowX1Wizard] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [simulatorTargetAuto, setSimulatorTargetAuto] = useState<Automacao | null>(null);

  // Form for manual creation
  const [manualForm, setManualForm] = useState({
    nome: "",
    trigger_tipo: "carrinho_abandonado",
    produto: "__none__",
    canal: "whatsapp",
    tag_filtro: "",
  });

  // Extract products defined in project
  const projectProducts = useMemo(() => {
    const data = jsonFields(project.data);
    const list = data.produtos;
    const prods: string[] = [];
    if (Array.isArray(list)) {
      list.forEach((item) => {
        const nome = jsonText(jsonFields(item).nome);
        if (nome && !prods.includes(nome)) prods.push(nome);
      });
    }
    return prods;
  }, [project.data]);

  // Combined product list (from project data + already referenced in flows)
  const availableProducts = useMemo(() => {
    const set = new Set<string>(projectProducts);
    automacoes.forEach((a) => {
      if (a.produto && a.produto.trim()) set.add(a.produto.trim());
    });
    return Array.from(set).sort();
  }, [projectProducts, automacoes]);

  // Load data scoped to project
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, provRes, hubRes, cRes, tagCountsRes] = await Promise.all([
        supabase
          .from("imphq_automacoes")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false }),
        supabase.from("imphq_wa_providers").select("*").eq("is_active", true).order("created_at"),
        supabase.from("wa_hub_iso_sessions").select("id, session_key, tenant_id, status").eq("status", "connected"),
        supabase.from("imphq_campanhas").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
        supabase.rpc("get_lead_tag_counts", { p_project_id: projectId, p_limit: 100 }),
      ]);

      const parsed: Automacao[] = [];
      for (const a of aRes.data || []) {
        const actions = openFlowActionsSchema.safeParse(a.acoes ?? []);
        const trigger = triggerConfigSchema.safeParse(a.trigger_config ?? null);
        if (actions.success && trigger.success) {
          parsed.push({ ...a, acoes: actions.data as Acao[], trigger_config: trigger.data });
        }
      }
      setAutomacoes(parsed);

      const hubProviders = (hubRes.data || []).map((s) => ({
        id: `hub_${s.id}`,
        provider: "hub_local",
        instance_name: s.session_key,
        twilio_from: null,
        project_id: s.tenant_id || null,
      }));
      setProviders([...(provRes.data || []), ...hubProviders]);
      setCampanhas(cRes.data || []);
      setAllTags((tagCountsRes.data || []).map((t) => t.tag).filter(Boolean));

      // Load 7d KPIs for this project's automations
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const autoIds = parsed.map(a => a.id);
      
      let logs7d: { status: string }[] = [];
      if (autoIds.length > 0) {
        const { data: logs } = await supabase
          .from("imphq_automacao_logs")
          .select("status")
          .in("automacao_id", autoIds)
          .gte("created_at", sevenDaysAgo);
        logs7d = logs || [];
      }

      const activeCount = parsed.filter(a => a.ativo).length;
      const pausedCount = parsed.filter(a => !a.ativo).length;
      const executions7d = logs7d.length;
      const success7d = logs7d.filter(l => l.status === "success").length;
      const errors7d = logs7d.filter(l => l.status === "error").length;
      const rate7d = executions7d > 0 ? Math.round((success7d / executions7d) * 100) : (activeCount > 0 ? 100 : 0);

      setKpis({
        total: parsed.length,
        activeCount,
        pausedCount,
        executions7d,
        success7d,
        errors7d,
        rate7d,
      });

    } catch (e) {
      console.error("Erro ao carregar dados do OpenFlow do projeto:", e);
      toast.error("Erro ao carregar automações do projeto.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load project templates when editing
  useEffect(() => {
    let cancelled = false;
    const loadTemplates = async () => {
      const [projRes, waRes] = await Promise.all([
        supabase.from("imphq_projects").select("data").eq("id", projectId).single(),
        supabase.from("imphq_wa_templates").select("name, content").eq("project_id", projectId),
      ]);
      const tpls: ProjectTemplate[] = [];
      const d = jsonFields(projRes.data?.data);
      if (Array.isArray(d.emails)) {
        d.emails.forEach((value, i) => {
          const e = jsonFields(value);
          const body = jsonText(e.body);
          if (body) tpls.push({ label: jsonText(e.subject) || `Email ${i + 1}`, content: body, source: "Email" });
        });
      }
      if (waRes.data?.length) {
        waRes.data.forEach((t) => {
          if (t.content) tpls.push({ label: t.name || "WhatsApp", content: t.content, source: "💬 WhatsApp" });
        });
      }
      if (!cancelled) setProjectTemplates(tpls);
    };
    void loadTemplates();
    return () => { cancelled = true; };
  }, [projectId, templatesRefresh]);

  // Save automation
  const saveAutomacao = async (a: Automacao, opts?: { silent?: boolean }) => {
    const { error } = await supabase.from("imphq_automacoes").update({
      nome: a.nome,
      trigger_tipo: a.trigger_tipo,
      acoes: actionJson(a.acoes),
      ativo: a.ativo,
      canal: a.canal || "whatsapp",
      produto: a.produto || null,
      project_id: projectId,
      quiet_start: a.quiet_start,
      quiet_end: a.quiet_end,
      dedupe_hours: a.dedupe_hours,
      campanha_id: a.campanha_id || null,
      tag_filtro: a.tag_filtro || null,
      provider_id: a.provider_id || null,
      link_checkout: a.link_checkout || null,
      stalled_hours: a.stalled_hours,
      stalled_operator: a.stalled_operator,
      follow_up_hours: a.follow_up_hours,
      follow_up_template: a.follow_up_template,
      exit_trigger_tipo: a.exit_trigger_tipo,
      exit_cascade: a.exit_cascade,
      flow_objective: a.flow_objective,
      prioridade: a.prioridade ?? 5,
      exclusivo: !!a.exclusivo,
      trigger_config: a.trigger_config ?? null,
    }).eq("id", a.id);

    if (error) {
      if (!opts?.silent) toast.error(error.message);
      throw new Error(error.message);
    }
    if (!opts?.silent) {
      toast.success("Automação salva!");
      setEditing(null);
      loadData();
    }
  };

  const autoSave = useAutoSave<Automacao | null>({
    value: editing,
    enabled: !!editing,
    onSave: async (v) => { if (v) await saveAutomacao(v, { silent: true }); },
  });

  useEffect(() => {
    if (editing) autoSave.resetBaseline(editing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id]);

  const closeEditor = async () => {
    const saved = await autoSave.forceSave();
    if (!saved) {
      toast.error("Não foi possível salvar automaticamente.");
      return;
    }
    setEditing(null);
    loadData();
  };

  // Toggle active switch directly from list
  const toggleAtivo = async (a: Automacao, ativo: boolean) => {
    const { error } = await supabase.from("imphq_automacoes").update({ ativo }).eq("id", a.id);
    if (error) {
      toast.error(error.message);
    } else {
      setAutomacoes(prev => prev.map(item => item.id === a.id ? { ...item, ativo } : item));
      toast.success(ativo ? `Fluxo "${a.nome}" ativado!` : `Fluxo "${a.nome}" pausado.`);
    }
  };

  // Delete
  const deleteAutomacao = async (id: string) => {
    if (!confirm("Excluir esta automação permanentemente?")) return;
    const { error } = await supabase.from("imphq_automacoes").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Automação excluída.");
      loadData();
    }
  };

  // Duplicate
  const duplicateAutomacao = async (a: Automacao) => {
    const newId = crypto.randomUUID();
    const { data, error } = await supabase.from("imphq_automacoes").insert({
      id: newId,
      nome: `${a.nome} (Cópia)`,
      trigger_tipo: a.trigger_tipo,
      project_id: projectId,
      produto: a.produto || null,
      acoes: actionJson(a.acoes),
      ativo: false,
      canal: a.canal || "whatsapp",
      provider_id: a.provider_id || null,
      campanha_id: a.campanha_id || null,
      tag_filtro: a.tag_filtro || null,
      link_checkout: a.link_checkout || null,
      trigger_config: (a.trigger_config as Json) || null,
    }).select("*").single();

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Fluxo duplicado!");
      loadData();
      if (data) setEditing(readAutomacao(data));
    }
  };

  // Create manual flow
  const handleCreateManual = async () => {
    if (!manualForm.nome.trim()) {
      toast.error("Dê um nome para a automação.");
      return;
    }
    const defaultProduct = manualForm.produto === "__none__" 
      ? (filterProduct !== "__all__" && filterProduct !== "__none__" ? filterProduct : null)
      : manualForm.produto;

    const { data, error } = await supabase.from("imphq_automacoes").insert({
      id: crypto.randomUUID(),
      nome: manualForm.nome.trim(),
      trigger_tipo: manualForm.trigger_tipo,
      project_id: projectId,
      produto: defaultProduct,
      canal: manualForm.canal,
      tag_filtro: manualForm.tag_filtro || null,
      ativo: true,
      acoes: [
        {
          tipo: "whatsapp",
          template: "Olá {{nome}}! Vi que você se interessou pelo {{produto}}.",
          delay_min: 0,
        }
      ],
    }).select("*").single();

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Automação criada!");
      setShowNewManual(false);
      setManualForm({ nome: "", trigger_tipo: "carrinho_abandonado", produto: "__none__", canal: "whatsapp", tag_filtro: "" });
      loadData();
      if (data) setEditing(readAutomacao(data));
    }
  };

  // 1-Click clone from template into this project
  const handleCloneTemplate = async (template: FlowTemplate, customProduct?: string) => {
    const prod = customProduct || (filterProduct !== "__all__" && filterProduct !== "__none__" ? filterProduct : projectProducts[0] || null);
    const flowName = prod ? `${template.nome} · ${prod}` : `${template.nome} · ${project.name}`;

    const { data, error } = await supabase.from("imphq_automacoes").insert({
      id: crypto.randomUUID(),
      nome: flowName,
      trigger_tipo: template.trigger_tipo,
      project_id: projectId,
      produto: prod,
      acoes: actionJson(template.acoes),
      ativo: false,
      canal: "whatsapp",
    }).select("*").single();

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Fluxo "${flowName}" adicionado ao projeto (desativado para revisão)!`);
    loadData();
    if (data) setEditing(readAutomacao(data));
  };

  // Filtered automations
  const filtered = useMemo(() => {
    return automacoes.filter((a) => {
      if (filterProduct === "__none__" && a.produto && a.produto.trim()) return false;
      if (filterProduct !== "__all__" && filterProduct !== "__none__" && a.produto !== filterProduct) return false;
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const matchName = a.nome.toLowerCase().includes(q);
        const matchProd = (a.produto || "").toLowerCase().includes(q);
        const matchTrigger = a.trigger_tipo.toLowerCase().includes(q);
        if (!matchName && !matchProd && !matchTrigger) return false;
      }
      return true;
    });
  }, [automacoes, filterProduct, searchFilter]);

  // Helper to render trigger select
  const renderTriggerOptions = () => TRIGGER_GROUPS.map(g => (
    <div key={g}>
      <div className="px-2 py-1 text-[10px] uppercase font-bold text-muted-foreground">{g}</div>
      {TRIGGERS.filter(t => t.group === g).map(t => (
        <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>
      ))}
    </div>
  ));

  // Render pipeline step badges
  const renderPipelinePreview = (acoes: Acao[]) => {
    if (!acoes || acoes.length === 0) {
      return <span className="text-[11px] text-muted-foreground italic">Sem ações configuradas</span>;
    }
    const visibleSteps = acoes.slice(0, 4);
    const extraCount = acoes.length - 4;

    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {visibleSteps.map((step, idx) => {
          let label = "Msg";
          let icon = <MessageCircle className="h-3 w-3" />;
          let color = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";

          if (step.tipo === "audio") {
            label = "Áudio";
            icon = <Mic className="h-3 w-3" />;
            color = "bg-rose-500/10 text-rose-400 border-rose-500/20";
          } else if (step.tipo === "ia_message") {
            label = "IA";
            icon = <Bot className="h-3 w-3" />;
            color = "bg-purple-500/10 text-purple-400 border-purple-500/20";
          } else if (step.tipo === "aguardar" || (step.delay_min && step.delay_min > 0)) {
            label = `${step.delay_min || 0}m`;
            icon = <Clock className="h-3 w-3" />;
            color = "bg-amber-500/10 text-amber-400 border-amber-500/20";
          } else if (step.tipo === "adicionar_tag" || step.tipo === "remover_tag") {
            label = step.tag || "Tag";
            icon = <Tag className="h-3 w-3" />;
            color = "bg-blue-500/10 text-blue-400 border-blue-500/20";
          } else if (step.tipo === "wait_reply") {
            label = "Resposta";
            icon = <Clock className="h-3 w-3" />;
            color = "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
          } else if (step.tipo === "stop_on_event") {
            label = "Parar";
            icon = <X className="h-3 w-3" />;
            color = "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
          }

          return (
            <div key={idx} className="flex items-center gap-1">
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border ${color}`}>
                {icon}
                <span className="truncate max-w-[70px]">{label}</span>
              </span>
              {idx < visibleSteps.length - 1 && (
                <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0" />
              )}
            </div>
          );
        })}
        {extraCount > 0 && (
          <span className="text-[10px] text-muted-foreground font-mono bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
            +{extraCount}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center text-primary">
                <Zap className="h-4 w-4" />
              </div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                OpenFlow · Automações do Projeto
              </h2>
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/30 text-xs font-mono">
                {project.name}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Réguas de recuperação, conversão no WhatsApp (X1), carrinhos abandonados e pós-venda deste projeto.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={() => setShowX1Wizard(true)}
              className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs h-9 shadow-sm"
            >
              <Bot className="h-3.5 w-3.5 mr-1.5" />
              Novo Fluxo X1 (Wizard)
            </Button>
            <Button
              variant="outline"
              onClick={() => setSubTab("templates")}
              className="border-primary/40 text-primary hover:bg-primary/10 text-xs h-9 font-semibold"
            >
              <Layers className="h-3.5 w-3.5 mr-1.5" />
              Modelos Rápidos
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowNewManual(true)}
              className="border-border hover:bg-secondary/40 text-xs h-9"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Novo Manual
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setSimulatorTargetAuto(null);
                setShowSimulator(true);
              }}
              className="text-xs h-9 text-muted-foreground hover:text-foreground"
            >
              <Play className="h-3.5 w-3.5 mr-1.5 text-emerald-400" />
              Simulador
            </Button>
          </div>
        </div>

        {/* Live Project KPIs Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-border">
          <div className="bg-background p-3 rounded-lg border border-border">
            <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">Total Fluxos</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold font-mono text-foreground">{kpis.total}</span>
              <span className="text-[11px] text-emerald-400 font-mono">({kpis.activeCount} ativos)</span>
            </div>
          </div>
          <div className="bg-background p-3 rounded-lg border border-border">
            <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">Execuções (7d)</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold font-mono text-foreground">{kpis.executions7d}</span>
              <span className="text-[11px] text-muted-foreground font-mono">disparos</span>
            </div>
          </div>
          <div className="bg-background p-3 rounded-lg border border-border">
            <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">Taxa de Sucesso</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold font-mono text-emerald-400">{kpis.rate7d}%</span>
              <span className="text-[11px] text-muted-foreground font-mono">{kpis.success7d} ok</span>
            </div>
          </div>
          <div className="bg-background p-3 rounded-lg border border-border">
            <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">Falhas (7d)</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-xl font-bold font-mono ${kpis.errors7d > 0 ? "text-rose-400" : "text-muted-foreground"}`}>
                {kpis.errors7d}
              </span>
              {kpis.errors7d > 0 ? (
                <button
                  onClick={() => setSubTab("logs")}
                  className="text-[10px] text-rose-400 underline font-mono hover:text-rose-300"
                >
                  ver logs
                </button>
              ) : (
                <span className="text-[11px] text-emerald-400/80 font-mono">limpo</span>
              )}
            </div>
          </div>
        </div>

        {/* Alert Banner if there are errors */}
        {kpis.errors7d > 0 && !alertDismissed && (
          <div className="mt-4 bg-rose-500/10 border border-rose-500/25 rounded-lg px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-rose-300">
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>
                <strong>Atenção:</strong> {kpis.errors7d} disparos deste projeto falharam nos últimos 7 dias.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSubTab("logs")}
                className="h-7 px-2.5 text-[11px] border-rose-500/40 text-rose-300 hover:bg-rose-500/20"
              >
                Auditar Logs
              </Button>
              <button
                onClick={() => setAlertDismissed(true)}
                className="text-rose-400 hover:text-rose-200"
                aria-label="Dispensar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sub Tabs Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            size="sm"
            variant={subTab === "fluxos" ? "default" : "ghost"}
            onClick={() => setSubTab("fluxos")}
            className="text-xs h-8"
          >
            <Zap className="h-3.5 w-3.5 mr-1.5" />
            Fluxos Ativos ({automacoes.length})
          </Button>
          <Button
            size="sm"
            variant={subTab === "templates" ? "default" : "ghost"}
            onClick={() => setSubTab("templates")}
            className="text-xs h-8"
          >
            <Layers className="h-3.5 w-3.5 mr-1.5 text-amber-400" />
            Templates Prontos
          </Button>
          <Button
            size="sm"
            variant={subTab === "logs" ? "default" : "ghost"}
            onClick={() => setSubTab("logs")}
            className="text-xs h-8"
          >
            <Activity className="h-3.5 w-3.5 mr-1.5 text-blue-400" />
            Logs & Monitoramento
          </Button>
          <Button
            size="sm"
            variant={subTab === "campanhas" ? "default" : "ghost"}
            onClick={() => setSubTab("campanhas")}
            className="text-xs h-8"
          >
            <Megaphone className="h-3.5 w-3.5 mr-1.5 text-purple-400" />
            Campanhas & Disparos
          </Button>
        </div>

        {/* Product and Search Filters when on Fluxos */}
        {subTab === "fluxos" && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-44">
              <Search className="h-3 w-3 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Buscar fluxo…"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="h-8 pl-8 text-xs bg-card border-border"
              />
            </div>

            <Select value={filterProduct} onValueChange={setFilterProduct}>
              <SelectTrigger className="h-8 w-48 text-xs bg-card border-border">
                <Package className="h-3 w-3 text-amber-400 mr-1.5 shrink-0" />
                <SelectValue placeholder="Filtrar por produto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os Produtos ({automacoes.length})</SelectItem>
                <SelectItem value="__none__">Sem Produto Específico</SelectItem>
                {availableProducts.map((p) => {
                  const count = automacoes.filter(a => a.produto === p).length;
                  return (
                    <SelectItem key={p} value={p}>
                      📦 {p} {count > 0 ? `(${count})` : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {(filterProduct !== "__all__" || searchFilter) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setFilterProduct("__all__");
                  setSearchFilter("");
                }}
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3 mr-1" /> Limpar
              </Button>
            )}
          </div>
        )}
      </div>

      {/* SUB-TAB 1: FLUXOS */}
      {subTab === "fluxos" && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Carregando automações do projeto...
            </div>
          ) : filtered.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center space-y-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
                  <Zap className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    {automacoes.length === 0
                      ? "Nenhuma automação criada para este projeto ainda"
                      : "Nenhum fluxo encontrado com os filtros selecionados"}
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
                    {automacoes.length === 0
                      ? "Crie réguas de recuperação de carrinho, Pix, WhatsApp X1 ou boas-vindas com 1 clique."
                      : "Tente limpar o filtro de produto ou a busca por texto."}
                  </p>
                </div>
                {automacoes.length === 0 && (
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <Button
                      onClick={() => setSubTab("templates")}
                      className="bg-primary text-primary-foreground font-bold text-xs"
                    >
                      <Layers className="h-3.5 w-3.5 mr-1.5" />
                      Explorar Templates Prontos
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowX1Wizard(true)}
                      className="text-xs border-border"
                    >
                      <Bot className="h-3.5 w-3.5 mr-1.5 text-amber-400" />
                      Criar com Wizard X1
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((a) => {
                const meta = triggerMeta(a.trigger_tipo);
                const stepCount = a.acoes?.length || 0;

                return (
                  <Card
                    key={a.id}
                    className="bg-card border-border hover:border-primary/30 transition-all group overflow-hidden flex flex-col justify-between"
                  >
                    <CardContent className={`p-4 border-l-4 ${meta.color} flex flex-col h-full justify-between gap-3`}>
                      <div className="space-y-2">
                        {/* Top: Name + Switch */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5 min-w-0">
                            <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors truncate" title={a.nome}>
                              {a.nome}
                            </h3>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge variant="outline" className="bg-slate-950/60 border-white/10 text-[10px] py-0 px-1.5">
                                {meta.icon} {meta.label}
                              </Badge>
                              {a.produto && (
                                <Badge variant="secondary" className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] py-0 px-1.5">
                                  📦 {a.produto}
                                </Badge>
                              )}
                              {a.canal && (
                                <Badge variant="outline" className="text-[10px] text-muted-foreground border-white/5 py-0 px-1.5">
                                  {a.canal === "whatsapp" ? "💬 WA" : a.canal}
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1 shrink-0">
                            <Switch
                              checked={a.ativo}
                              onCheckedChange={(val) => toggleAtivo(a, val)}
                              className="scale-75"
                              title={a.ativo ? "Fluxo ativo (clique para pausar)" : "Fluxo pausado (clique para ativar)"}
                            />
                          </div>
                        </div>

                        {/* Pipeline sequence visualizer */}
                        <div className="bg-background p-2.5 rounded-lg border border-border/60 space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                            <span>Pipeline ({stepCount} {stepCount === 1 ? "ação" : "ações"})</span>
                            {a.tag_filtro && (
                              <span className="text-blue-400 truncate max-w-[120px]">🏷️ {a.tag_filtro}</span>
                            )}
                          </div>
                          {renderPipelinePreview(a.acoes)}
                        </div>
                      </div>

                      {/* Footer action buttons */}
                      <div className="flex items-center justify-between gap-1 pt-2 border-t border-border/80">
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditing(a)}
                            className="h-7 px-2.5 text-xs bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 font-semibold"
                          >
                            Editar Fluxo
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSimulatorTargetAuto(a);
                              setShowSimulator(true);
                            }}
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-emerald-400"
                            title="Simular disparo deste fluxo"
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Simular
                          </Button>
                        </div>

                        <div className="flex items-center gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => duplicateAutomacao(a)}
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            title="Duplicar fluxo"
                          >
                            <CopyPlus className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteAutomacao(a.id)}
                            className="h-7 w-7 text-muted-foreground hover:text-rose-400"
                            title="Excluir fluxo"
                          >
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
        </div>
      )}

      {/* SUB-TAB 2: TEMPLATES PRONTOS */}
      {subTab === "templates" && (
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  Biblioteca de Modelos Testados
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Importe réguas comprovadas de marketing direto e vendas consultivas com 1 clique direto para o projeto <strong>{project.name}</strong>.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Vincular ao produto:</span>
                <Select value={filterProduct} onValueChange={setFilterProduct}>
                  <SelectTrigger className="h-8 w-44 text-xs bg-background border-border">
                    <SelectValue placeholder="Escolher produto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Primeiro do Projeto</SelectItem>
                    {projectProducts.map(p => (
                      <SelectItem key={p} value={p}>📦 {p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FLOW_TEMPLATES.map((tmpl) => {
              const alreadyHas = automacoes.some(a => a.nome.toLowerCase().includes(tmpl.nome.toLowerCase()));

              return (
                <Card
                  key={tmpl.id}
                  className="bg-card border-border hover:border-amber-500/30 transition-all flex flex-col justify-between"
                >
                  <CardContent className="p-5 space-y-4 flex flex-col justify-between h-full">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{tmpl.emoji}</span>
                          <div>
                            <h4 className="font-bold text-sm text-foreground">{tmpl.nome}</h4>
                            <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                              {triggerMeta(tmpl.trigger_tipo).label}
                            </span>
                          </div>
                        </div>
                        {alreadyHas && (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                            Já Importado
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                        {tmpl.descricao}
                      </p>

                      <div className="bg-background p-2.5 rounded-lg border border-border text-xs">
                        <span className="text-[10px] text-muted-foreground font-mono uppercase block mb-1">
                          Passos ({tmpl.acoes.length})
                        </span>
                        {renderPipelinePreview(tmpl.acoes)}
                      </div>
                    </div>

                    <Button
                      onClick={() => handleCloneTemplate(tmpl)}
                      className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs h-8 mt-2"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Clonar para {project.name}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: LOGS & AUDITORIA */}
      {subTab === "logs" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-400" />
                Histórico & Logs de Execução do Projeto
              </h3>
              <p className="text-xs text-muted-foreground">
                Auditoria de cada mensagem enviada, lead acionado e eventuais erros de entrega.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={loadData}
              className="h-8 text-xs border-border"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Atualizar
            </Button>
          </div>

          <AutomacaoLogs
            automacoes={automacoes.map(a => ({ id: a.id, nome: a.nome }))}
            projects={[{ id: project.id, name: project.name }]}
          />
        </div>
      )}

      {/* SUB-TAB 4: CAMPANHAS & DISPAROS */}
      {subTab === "campanhas" && (
        <div className="space-y-4">
          <CampanhasManager
            projects={[{ id: project.id, name: project.name }]}
            onChange={loadData}
          />
        </div>
      )}

      {/* DIALOG: NOVO FLUXO MANUAL */}
      <Dialog open={showNewManual} onOpenChange={setShowNewManual}>
        <DialogContent className="max-w-lg bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-primary" />
              Criar Nova Automação Manual
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              A automação será vinculada automaticamente ao projeto <strong>{project.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nome da Automação</Label>
              <Input
                placeholder="Ex: Carrinho Abandonado · WhatsApp"
                value={manualForm.nome}
                onChange={(e) => setManualForm(prev => ({ ...prev, nome: e.target.value }))}
                className="bg-background border-border text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Gatilho (Trigger)</Label>
              <Select
                value={manualForm.trigger_tipo}
                onValueChange={(val) => setManualForm(prev => ({ ...prev, trigger_tipo: val }))}
              >
                <SelectTrigger className="bg-background border-border text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {renderTriggerOptions()}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Vincular a Produto</Label>
                <Select
                  value={manualForm.produto}
                  onValueChange={(val) => setManualForm(prev => ({ ...prev, produto: val }))}
                >
                  <SelectTrigger className="bg-background border-border text-xs h-9">
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem produto específico</SelectItem>
                    {projectProducts.map(p => (
                      <SelectItem key={p} value={p}>📦 {p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Canal</Label>
                <Select
                  value={manualForm.canal}
                  onValueChange={(val) => setManualForm(prev => ({ ...prev, canal: val }))}
                >
                  <SelectTrigger className="bg-background border-border text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CANAIS.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Filtro por Tag (Opcional)</Label>
              <Select
                value={manualForm.tag_filtro || "__none__"}
                onValueChange={(val) => setManualForm(prev => ({ ...prev, tag_filtro: val === "__none__" ? "" : val }))}
              >
                <SelectTrigger className="bg-background border-border text-xs h-9">
                  <SelectValue placeholder="Nenhuma tag obrigatória" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhuma tag</SelectItem>
                  {allTags.map(t => (
                    <SelectItem key={t} value={t}>🏷️ {t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowNewManual(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleCreateManual} className="bg-primary text-primary-foreground font-bold">
              Criar e Abrir Editor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* X1 BUILDER WIZARD */}
      <X1BuilderWizard
        open={showX1Wizard}
        onOpenChange={setShowX1Wizard}
        projects={[{ id: project.id, name: project.name }]}
        onCreated={(automacaoId) => {
          loadData();
          setShowX1Wizard(false);
          // If created, open in editor
          supabase.from("imphq_automacoes").select("*").eq("id", automacaoId).single().then(({ data }) => {
            if (data) setEditing(readAutomacao(data));
          });
        }}
      />

      {/* SIMULATOR DIALOG */}
      <Dialog open={showSimulator} onOpenChange={setShowSimulator}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-border text-foreground p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-4 w-4 text-emerald-400" />
              Simulador de Disparos · {project.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Teste as respostas, delays e condições dos fluxos sem enviar mensagens reais para o WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <FlowSimulator
            automacoes={simulatorTargetAuto ? [simulatorTargetAuto] : automacoes}
            projects={[{ id: project.id, name: project.name }]}
          />
        </DialogContent>
      </Dialog>

      {/* FULL INLINE FLOW EDITOR DIALOG */}
      <Dialog open={!!editing} onOpenChange={(v) => { if (!v) closeEditor(); }}>
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
                <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                {editing && (
                  <div>
                    <DialogTitle className="text-xl font-bold text-slate-100">{editing.nome || "Editar Fluxo"}</DialogTitle>
                    <p className="text-xs text-muted-foreground font-mono">
                      {triggerMeta(editing.trigger_tipo).icon} {triggerMeta(editing.trigger_tipo).label}
                      {" · "}<strong>{project.name}</strong>
                      {editing.produto ? ` · 📦 ${editing.produto}` : ""}
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
                {editing && (
                  <Button
                    variant="outline"
                    onClick={() => setEditing({ ...editing, ativo: !editing.ativo })}
                    className="h-9 px-3 text-xs font-semibold bg-white/5 border-white/10 hover:bg-white/10"
                  >
                    {editing.ativo ? (
                      <><Pause className="h-3.5 w-3.5 mr-1.5" /> Pausar</>
                    ) : (
                      <><Play className="h-3.5 w-3.5 mr-1.5" /> Retomar</>
                    )}
                  </Button>
                )}
                {editing && (
                  <Button
                    variant="outline"
                    onClick={() => setShowHistory(true)}
                    className="h-9 px-3 text-xs font-semibold bg-white/5 border-white/10 hover:bg-white/10"
                  >
                    <History className="h-3.5 w-3.5 mr-1.5" /> Histórico
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={closeEditor}
                  className="h-9 px-4 text-xs font-semibold bg-white/5 border-white/10 hover:bg-white/10"
                >
                  Concluir
                </Button>
              </div>
            </div>
          </DialogHeader>

          {editing && (
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-4 w-full">
                {/* Meta Configuration Strip */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 bg-secondary/10 p-4 rounded-2xl border border-white/5">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Nome do Fluxo</Label>
                    <Input
                      value={editing.nome}
                      onChange={e => setEditing({ ...editing, nome: e.target.value })}
                      className="h-9 bg-background/50 border-white/10 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Canal</Label>
                    <Select value={editing.canal || "whatsapp"} onValueChange={v => setEditing({ ...editing, canal: v })}>
                      <SelectTrigger className="h-9 bg-background/50 border-white/10 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CANAIS.map(c => <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Trigger</Label>
                    <Select value={editing.trigger_tipo} onValueChange={v => setEditing({ ...editing, trigger_tipo: v })}>
                      <SelectTrigger className="h-9 bg-background/50 border-white/10 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-[60vh]">{renderTriggerOptions()}</SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Produto</Label>
                    <Select
                      value={editing.produto || "none"}
                      onValueChange={v => setEditing({ ...editing, produto: v === "none" ? undefined : v })}
                    >
                      <SelectTrigger className="h-9 bg-background/50 border-white/10 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Todos os Produtos</SelectItem>
                        {availableProducts.map(p => <SelectItem key={p} value={p}>📦 {p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Filtro por Tag</Label>
                    <Select
                      value={editing.tag_filtro || "none"}
                      onValueChange={v => setEditing({ ...editing, tag_filtro: v === "none" ? undefined : v })}
                    >
                      <SelectTrigger className="h-9 bg-background/50 border-white/10 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {allTags.map(t => <SelectItem key={t} value={t}>🏷️ {t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Número de Disparo</Label>
                    <Select
                      value={editing.provider_id || "none"}
                      onValueChange={v => setEditing({ ...editing, provider_id: v === "none" ? undefined : v })}
                    >
                      <SelectTrigger className="h-9 bg-background/50 border-white/10 text-xs">
                        <SelectValue placeholder="Padrão" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Padrão do sistema</SelectItem>
                        {providers
                          .filter(p => !p.project_id || p.project_id === projectId)
                          .map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.provider === "hub_local" ? "📱" : p.provider === "evolution" ? "🟢" : "🔵"} {p.instance_name || p.twilio_from || p.id.slice(0, 12)}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Keyword triggers if WhatsApp */}
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
                          onValueChange={(v) => {
                            if (v === "any" || v === "all" || v === "exact" || v === "regex") {
                              setEditing({
                                ...editing,
                                trigger_config: { ...(editing.trigger_config || {}), match_mode: v },
                              });
                            }
                          }}
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
                      placeholder="Ex: comprar, preço, quero, desconto…"
                    />
                  </div>
                )}

                {editing.trigger_tipo?.startsWith("whatsapp_") && (
                  <X1Checklist acoes={editing.acoes} />
                )}

                {/* The Flow Action Canvas */}
                <FlowEditor
                  triggerTipo={editing.trigger_tipo}
                  acoes={editing.acoes}
                  onChange={v => setEditing({ ...editing, acoes: v })}
                  onTriggerChange={v => setEditing({ ...editing, trigger_tipo: v })}
                  projectId={projectId}
                  providers={providers}
                  templates={projectTemplates}
                  onTemplateSaved={() => setTemplatesRefresh(v => v + 1)}
                  automacaoId={editing.id}
                  flowObjective={editing.flow_objective || ""}
                  onUpdateObjective={v => setEditing({ ...editing, flow_objective: v })}
                  onGenerateAI={() => setAiDialogOpen(true)}
                  isGenerating={false}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* AI GENERATION DIALOG */}
      {editing && (
        <AIGenerateDialog
          open={aiDialogOpen}
          onOpenChange={setAiDialogOpen}
          projectId={projectId}
          triggerTipo={editing.trigger_tipo}
          produto={editing.produto}
          existingAcoes={editing.acoes}
          onApply={(mode, acoes) => {
            if (mode === "replace") {
              setEditing({ ...editing, acoes });
            } else {
              setEditing({ ...editing, acoes: [...editing.acoes, ...acoes] });
            }
            toast.success("Ações geradas pela IA aplicadas ao fluxo!");
          }}
        />
      )}

      {/* VERSION HISTORY */}
      {editing && (
        <VersionHistoryDrawer
          open={showHistory}
          onOpenChange={setShowHistory}
          automacaoId={editing.id}
          automacaoNome={editing.nome}
          onRestore={(snapshot) => {
            try {
              const parsed = openFlowActionsSchema.parse(snapshot);
              setEditing({ ...editing, acoes: parsed as Acao[] });
              toast.success("Versão restaurada com sucesso!");
            } catch {
              toast.error("Erro ao restaurar versão.");
            }
          }}
        />
      )}
    </div>
  );
}

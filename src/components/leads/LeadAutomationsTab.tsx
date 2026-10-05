import React, { useState, useMemo } from "react";
import type { Tables, Json } from "@/integrations/supabase/types";
import { jsonFields, jsonText } from "@/lib/json-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { format, isValid } from "date-fns";
import {
  Zap,
  Play,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Clock,
  MessageCircle,
  Mic,
  Tag,
  GitFork,
  Bot,
  Filter,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Smartphone,
  Eye,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { objectFields } from "@/lib/json-fields";
import { LeadAccessDiagnosticCard } from "./LeadAccessDiagnosticCard";

type Automation = Tables<"imphq_automacoes">;

interface LeadVenda {
  id: string;
  produto_nome?: string | null;
  valor?: number | null;
  status?: string | null;
  data?: Json;
}

interface Lead {
  id: string;
  nome?: string | null;
  email?: string | null;
  phone?: string | null;
  project_id?: string | null;
  campanha_id?: string | null;
  data?: Json;
  tags?: string[] | null;
  _vendas?: LeadVenda[];
}

interface ProjectReference {
  id: string;
  name: string;
  icon?: string | null;
}

interface LeadAutomationLog {
  id: string;
  action: string;
  created_at: string | null;
  details: { [key: string]: Json | undefined };
  _source: "activity" | "automacao_log";
}

interface Props {
  lead: Lead;
  automations: Automation[];
  projects: ProjectReference[];
  leadAutomationLogs: LeadAutomationLog[];
  onTriggerAutomation: (lead: Lead, auto: Automation) => Promise<void>;
}

// Mapeamento amigável de Triggers para humanos
const TRIGGER_HUMAN_INFO: Record<string, { label: string; icon: string; description: string; color: string }> = {
  carrinho_abandonado: {
    label: "Carrinho Abandonado",
    icon: "🛒",
    description: "Dispara automaticamente quando o lead abandona o checkout sem pagar.",
    color: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  },
  aguardando_pagamento: {
    label: "Aguardando Pagamento / Pix",
    icon: "💰",
    description: "Dispara quando um Pix ou boleto é gerado e aguarda liquidação.",
    color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  },
  pix_gerado: {
    label: "Pix Gerado",
    icon: "⚡",
    description: "Dispara quando o lead gera a chave Pix para pagamento.",
    color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  },
  boleto_gerado: {
    label: "Boleto Gerado",
    icon: "📄",
    description: "Dispara réguas de cobrança e lembretes para boletos bancários.",
    color: "bg-yellow-600/10 text-yellow-400 border-yellow-600/30",
  },
  compra_aprovada: {
    label: "Compra Aprovada",
    icon: "✅",
    description: "Dispara mensagens de boas-vindas e acesso imediato após o pagamento.",
    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  },
  compra_approved: {
    label: "Compra Aprovada",
    icon: "✅",
    description: "Dispara mensagens de boas-vindas e onboarding após confirmação da compra.",
    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  },
  pagamento_recusado: {
    label: "Pagamento Recusado",
    icon: "❌",
    description: "Dispara resgate imediato quando a operadora de cartão rejeita a transação.",
    color: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  },
  pagamento_expirado: {
    label: "Pagamento Expirado",
    icon: "⌛",
    description: "Dispara oferta de nova chave ou segunda chance quando o Pix/Boleto vence.",
    color: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  },
  lead_novo: {
    label: "Novo Lead Capturado",
    icon: "👤",
    description: "Dispara primeiro contato ou qualificação inicial assim que o lead entra.",
    color: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  },
  inicio_checkout: {
    label: "Início de Checkout",
    icon: "🛍️",
    description: "Dispara quando o lead clica para ir ao formulário de compra.",
    color: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  },
  tag_adicionada: {
    label: "Tag Aplicada",
    icon: "🏷️",
    description: "Dispara quando uma tag específica é adicionada ao lead.",
    color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
  },
};

// Extrai passos resumidos de uma ação
function summarizeAction(raw: unknown, index: number) {
  const action = objectFields(raw);
  const t = String(action.tipo || "");
  const cfg = action.config ? objectFields(action.config) : action;

  if (t === "whatsapp" || t === "mensagem") {
    const text = cfg.template || cfg.mensagem || cfg.text || cfg.content || "Mensagem de texto";
    return {
      step: index + 1,
      icon: MessageCircle,
      label: "Mensagem WhatsApp",
      preview: typeof text === "string" ? text.slice(0, 75) + (text.length > 75 ? "..." : "") : "Mensagem",
      fullText: String(text),
      color: "text-emerald-400",
    };
  }
  if (t === "audio") {
    const text = cfg.template || cfg.transcript || cfg.mensagem || "Áudio com voz clonada";
    return {
      step: index + 1,
      icon: Mic,
      label: "Áudio Clonado",
      preview: typeof text === "string" ? text.slice(0, 75) + (text.length > 75 ? "..." : "") : "Áudio",
      fullText: String(text),
      color: "text-cyan-400",
    };
  }
  if (t === "delay" || t === "aguardar" || t === "espera") {
    const min = cfg.delay_min || cfg.minutos || cfg.minutes || 0;
    const hr = cfg.horas || cfg.hours || 0;
    const timeLabel = hr ? `${hr}h ${min ? `${min}m` : ""}` : `${min} min`;
    return {
      step: index + 1,
      icon: Clock,
      label: `Aguardar ${timeLabel}`,
      preview: `Pausa de ${timeLabel} antes da próxima etapa`,
      fullText: `Espera programada de ${timeLabel}`,
      color: "text-amber-400",
    };
  }
  if (t === "tag" || t === "adicionar_tag") {
    const tag = cfg.tag || cfg.nome || "nova_tag";
    return {
      step: index + 1,
      icon: Tag,
      label: `Aplicar Tag: ${tag}`,
      preview: `Adiciona tag ao lead`,
      fullText: `Adiciona tag: ${tag}`,
      color: "text-indigo-400",
    };
  }
  if (t === "condicao" || t === "condition") {
    return {
      step: index + 1,
      icon: GitFork,
      label: "Verificação Condicional",
      preview: "Checa se já comprou ou respondeu",
      fullText: "Condição lógica de ramificação do fluxo",
      color: "text-violet-400",
    };
  }
  if (t === "ia_message" || t === "gpt_prompt" || t === "ia_gerar") {
    return {
      step: index + 1,
      icon: Bot,
      label: "Resposta IA Inteligente",
      preview: "Gera mensagem contextual com IA",
      fullText: String(cfg.prompt || cfg.template || "Resposta IA"),
      color: "text-pink-400",
    };
  }

  return {
    step: index + 1,
    icon: Zap,
    label: t || "Etapa",
    preview: "Ação automática",
    fullText: JSON.stringify(cfg),
    color: "text-slate-400",
  };
}

export function LeadAutomationsTab({
  lead,
  automations,
  projects,
  leadAutomationLogs,
  onTriggerAutomation,
}: Props) {
  const [filterMode, setFilterMode] = useState<"scoped" | "all">("scoped");
  const [selectedFlowToInspect, setSelectedFlowToInspect] = useState<Automation | null>(null);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);

  // 1. Identifica Projeto e Produto do Lead
  const currentProject = useMemo(() => {
    return projects.find((p) => p.id === lead.project_id) || null;
  }, [projects, lead.project_id]);

  const leadProduct = useMemo(() => {
    // 1. Das vendas confirmadas/pendentes do lead
    if (lead._vendas && lead._vendas.length > 0) {
      const v = lead._vendas.find((v) => v.produto_nome && v.produto_nome.trim().length > 0);
      if (v?.produto_nome) return v.produto_nome.trim();
    }
    // 2. Do JSON de dados do lead
    const d = jsonFields(lead.data);
    const fromData =
      jsonText(d.produto) ||
      jsonText(d.produto_nome) ||
      jsonText(d.ultimo_produto) ||
      jsonText(d.checkout_produto) ||
      jsonText(d.offer_name);
    if (fromData && fromData.trim()) return fromData.trim();

    // 3. Das tags
    if (Array.isArray(lead.tags)) {
      const tag = lead.tags.find(
        (t) => t.toLowerCase().startsWith("produto:") || t.toLowerCase().startsWith("prod:")
      );
      if (tag) return tag.split(":")[1]?.trim() || null;
    }

    // 4. Se o nome do projeto for um produto (ex: "LinfaFlow")
    if (currentProject?.name) return currentProject.name.trim();

    return null;
  }, [lead, currentProject]);

  // 2. Filtro estrito: separa fluxos do projeto/produto dos fluxos de outras marcas
  const { scopedAutomations, otherAutomations } = useMemo(() => {
    const leadProjId = lead.project_id;
    const leadProjName = currentProject?.name?.toLowerCase().trim() || "";
    const leadProdName = leadProduct?.toLowerCase().trim() || "";

    // Nomes de OUTROS projetos conhecidos para exclusão de conflitos cruzados
    const otherProjectNames = projects
      .filter((p) => p.id !== leadProjId)
      .map((p) => p.name.toLowerCase().trim())
      .filter((n) => n.length > 2);

    const scoped: Automation[] = [];
    const others: Automation[] = [];

    automations.forEach((a) => {
      const autoName = a.nome.toLowerCase();
      const autoProd = (a.produto || "").toLowerCase().trim();

      // Regra 1: Se a automação está explicitamente vinculada a outro projeto
      if (a.project_id && leadProjId && a.project_id !== leadProjId) {
        others.push(a);
        return;
      }

      // Regra 2: Se a automação menciona no título o nome de OUTRO projeto explicitamente
      // (ex: "Aprovada - JP Freitas" ou "Código dos Cortes" quando o lead é LinfaFlow)
      const matchesOtherProject = otherProjectNames.some(
        (otherName) => autoName.includes(otherName) || (autoProd && autoProd.includes(otherName))
      );
      if (matchesOtherProject && !autoName.includes(leadProjName)) {
        others.push(a);
        return;
      }

      // Regra 3: Se a automação tem um produto específico configurado
      if (autoProd && leadProdName) {
        // Se o produto da automação é diferente do produto do lead
        if (!autoProd.includes(leadProdName) && !leadProdName.includes(autoProd)) {
          others.push(a);
          return;
        }
      }

      // Regra 4: Se bate diretamente com o projeto do lead
      if (a.project_id && a.project_id === leadProjId) {
        scoped.push(a);
        return;
      }

      // Regra 5: Se o nome da automação ou produto bate com o projeto/produto do lead
      if (
        (leadProjName && autoName.includes(leadProjName)) ||
        (leadProdName && (autoName.includes(leadProdName) || autoProd.includes(leadProdName)))
      ) {
        scoped.push(a);
        return;
      }

      // Regra 6: Fluxos globais genéricos sem projeto e sem produto (ex: "Recuperação de Carrinho Abandonado")
      if (!a.project_id && !a.produto) {
        scoped.push(a);
        return;
      }

      others.push(a);
    });

    return { scopedAutomations: scoped, otherAutomations: others };
  }, [automations, lead.project_id, currentProject, leadProduct, projects]);

  const displayedAutomations = filterMode === "scoped" ? scopedAutomations : automations;

  const handleTrigger = async (auto: Automation) => {
    try {
      setTriggeringId(auto.id);
      await onTriggerAutomation(lead, auto);
    } finally {
      setTriggeringId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Card de Diagnóstico IA e Resolução de Acesso (Exibido para projetos/produtos JP) */}
      <LeadAccessDiagnosticCard lead={lead} projectName={currentProject?.name} />

      {/* 1. Header de Contexto do Lead e Seletor de Escopo */}
      <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px] font-mono border-slate-700 bg-slate-800/80 text-slate-200">
              {currentProject?.icon || "📁"} {currentProject?.name || "Projeto Geral"}
            </Badge>
            {leadProduct && (
              <Badge variant="outline" className="text-[10px] font-mono border-amber-500/40 bg-amber-500/10 text-amber-400">
                📦 {leadProduct}
              </Badge>
            )}
            {lead.campanha_id && (
              <Badge variant="outline" className="text-[10px] font-mono border-violet-500/40 bg-violet-500/10 text-violet-300">
                📣 Campanha vinculada
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-slate-400">
            {filterMode === "scoped"
              ? `Exibindo apenas os fluxos desenhados para ${leadProduct || currentProject?.name || "este lead"}.`
              : "Exibindo todos os fluxos da empresa (incluindo outros projetos e produtos)."}
          </p>
        </div>

        {/* Toggle de Escopo */}
        <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFilterMode("scoped")}
            className={cn(
              "px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all flex items-center gap-1.5",
              filterMode === "scoped"
                ? "bg-amber-500 text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            <Filter className="h-3 w-3" />
            Deste Projeto ({scopedAutomations.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("all")}
            className={cn(
              "px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all flex items-center gap-1.5",
              filterMode === "all"
                ? "bg-slate-800 text-slate-100 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            <Layers className="h-3 w-3" />
            Todos ({automations.length})
          </button>
        </div>
      </div>

      {/* 2. Lista de Fluxos com Visualização do que cada um faz */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            Fluxos Disponíveis ({displayedAutomations.length})
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[11px] text-amber-400 hover:text-amber-300 hover:bg-slate-800 gap-1"
            asChild
          >
            <Link to="/openflow">
              Criar Novo Fluxo no OpenFlow <ExternalLink className="h-3 w-3 ml-0.5" />
            </Link>
          </Button>
        </div>

        {displayedAutomations.length === 0 ? (
          <div className="p-8 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30 space-y-2">
            <Zap className="h-8 w-8 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400 font-medium">
              Nenhum fluxo específico encontrado para {leadProduct || "este projeto"}.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
              onClick={() => setFilterMode("all")}
            >
              Ver todos os {automations.length} fluxos da empresa
            </Button>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
            {displayedAutomations.map((a) => {
              const triggerInfo = TRIGGER_HUMAN_INFO[a.trigger_tipo] || {
                label: a.trigger_tipo,
                icon: "⚡",
                description: `Dispara no evento: ${a.trigger_tipo}`,
                color: "bg-slate-800 text-slate-300 border-slate-700",
              };

              const rawActions = Array.isArray(a.acoes) ? a.acoes : [];
              const steps = rawActions.map((item, idx) => summarizeAction(item, idx));
              const isTriggering = triggeringId === a.id;

              return (
                <div
                  key={a.id}
                  className="p-3.5 rounded-xl border border-slate-800/90 bg-slate-900/50 hover:bg-slate-900/80 transition-all space-y-3 group shadow-sm"
                >
                  {/* Topo do Card: Nome, Status e Badges */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm text-slate-100 group-hover:text-amber-400 transition-colors truncate">
                          ⚡ {a.nome}
                        </h4>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] px-1.5 py-0 h-4 font-mono font-medium shrink-0",
                            a.ativo
                              ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                              : "border-slate-700 text-slate-400 bg-slate-800"
                          )}
                        >
                          {a.ativo ? "● Ativo" : "○ Pausado"}
                        </Badge>
                      </div>

                      {/* Descrição em Linguagem Humana do que o fluxo faz */}
                      <p className="text-[11px] text-slate-400 leading-snug">
                        {triggerInfo.description}
                      </p>
                    </div>

                    {/* Botões de Ação Imediata */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-[11px] border-slate-800 bg-slate-950 text-slate-300 hover:text-white hover:bg-slate-800 gap-1"
                        onClick={() => setSelectedFlowToInspect(a)}
                        title="Ver o que este fluxo faz detalhadamente"
                      >
                        <Eye className="h-3 w-3" /> Ver Detalhes
                      </Button>

                      <Button
                        size="sm"
                        className="h-7 px-3 text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold gap-1 shadow-sm"
                        onClick={() => handleTrigger(a)}
                        disabled={isTriggering}
                        title={`Disparar "${a.nome}" manualmente para este lead`}
                      >
                        <Play className="h-3 w-3 fill-current" />
                        {isTriggering ? "Disparando..." : "Disparar"}
                      </Button>
                    </div>
                  </div>

                  {/* Badges de Gatilho, Canal e Produto */}
                  <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                    <Badge variant="outline" className={cn("px-1.5 py-0 h-4 font-mono", triggerInfo.color)}>
                      {triggerInfo.icon} {triggerInfo.label}
                    </Badge>
                    <Badge variant="outline" className="px-1.5 py-0 h-4 font-mono border-slate-700 bg-slate-800/80 text-slate-300">
                      📱 {a.canal || "whatsapp"}
                    </Badge>
                    {a.produto && (
                      <Badge variant="outline" className="px-1.5 py-0 h-4 font-mono border-amber-500/30 text-amber-400 bg-amber-500/5">
                        📦 {a.produto}
                      </Badge>
                    )}
                    {a.flow_objective && (
                      <span className="text-[10px] text-slate-400 italic truncate max-w-[220px]">
                        🎯 {a.flow_objective}
                      </span>
                    )}
                  </div>

                  {/* Régua Visual de Passos (O que acontece na prática) */}
                  {steps.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/60">
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 shrink-0 mr-1">
                          Régua ({steps.length}):
                        </span>
                        {steps.map((st, i) => {
                          const Icon = st.icon;
                          return (
                            <React.Fragment key={i}>
                              <div
                                className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950 border border-slate-800/80 text-[10px] text-slate-300 shrink-0"
                                title={st.fullText}
                              >
                                <Icon className={cn("h-3 w-3", st.color)} />
                                <span className="font-mono text-slate-400 text-[9px]">#{st.step}</span>
                                <span className="truncate max-w-[130px]">{st.label}</span>
                              </div>
                              {i < steps.length - 1 && (
                                <span className="text-slate-600 text-[9px] shrink-0 font-bold">➔</span>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Modal Detalhado de Inspeção do Fluxo ("O que é cada fluxo") */}
      <Dialog open={!!selectedFlowToInspect} onOpenChange={() => setSelectedFlowToInspect(null)}>
        <DialogContent className="max-w-xl bg-slate-950 border-slate-800 text-slate-100">
          {selectedFlowToInspect && (() => {
            const a = selectedFlowToInspect;
            const trigger = TRIGGER_HUMAN_INFO[a.trigger_tipo] || {
              label: a.trigger_tipo,
              icon: "⚡",
              description: a.trigger_tipo,
              color: "bg-slate-800 text-slate-300 border-slate-700",
            };
            const actions = Array.isArray(a.acoes) ? a.acoes : [];
            const steps = actions.map((item, idx) => summarizeAction(item, idx));

            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{trigger.icon}</span>
                    <DialogTitle className="text-slate-100 font-bold text-lg">
                      {a.nome}
                    </DialogTitle>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Visualização da arquitetura e das mensagens configuradas neste fluxo.
                  </p>
                </DialogHeader>

                <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
                  {/* Bloco 1: Quando Roda (Gatilho) */}
                  <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60 space-y-1.5">
                    <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">
                      Ponto de Entrada (Gatilho)
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge className={cn("text-xs font-mono", trigger.color)}>
                        {trigger.icon} {trigger.label}
                      </Badge>
                      <span className="text-xs text-slate-300">
                        {trigger.description}
                      </span>
                    </div>
                  </div>

                  {/* Bloco 2: Objetivo Estratégico (se houver) */}
                  {a.flow_objective && (
                    <div className="p-3 rounded-lg border border-violet-500/20 bg-violet-500/5 space-y-1">
                      <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider block">
                        🎯 Objetivo do Fluxo
                      </span>
                      <p className="text-xs text-slate-200 italic">"{a.flow_objective}"</p>
                    </div>
                  )}

                  {/* Bloco 3: Passo a Passo Detalhado */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Sequência de Disparos ({steps.length} etapas)
                    </span>

                    {steps.length === 0 ? (
                      <p className="text-xs text-slate-500 italic p-3 bg-slate-900/30 rounded border border-slate-800">
                        Nenhuma ação configurada no interior deste fluxo.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {steps.map((st, i) => {
                          const Icon = st.icon;
                          return (
                            <div
                              key={i}
                              className="p-3 rounded-lg border border-slate-800 bg-slate-900/40 space-y-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-mono text-slate-300 font-bold">
                                    {st.step}
                                  </span>
                                  <Icon className={cn("h-4 w-4", st.color)} />
                                  <span className="text-xs font-semibold text-slate-200">
                                    {st.label}
                                  </span>
                                </div>
                              </div>

                              {st.fullText && (
                                <div className="p-2 rounded bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed">
                                  {st.fullText}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <DialogFooter className="flex items-center justify-between border-t border-slate-800 pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs border-slate-800 bg-slate-900 text-slate-300 hover:text-white"
                    asChild
                  >
                    <Link to={`/openflow?edit=${a.id}`}>
                      <ExternalLink className="h-3.5 w-3.5 mr-1" /> Editar no OpenFlow Canvas
                    </Link>
                  </Button>

                  <Button
                    size="sm"
                    className="text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                    onClick={() => {
                      handleTrigger(a);
                      setSelectedFlowToInspect(null);
                    }}
                  >
                    <Play className="h-3 w-3 mr-1 fill-current" /> Disparar para {lead.nome || "este lead"}
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* 4. Histórico de Ações Executadas para este Lead */}
      <div className="space-y-2 border-t border-slate-800/80 pt-3">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          Histórico de Execuções deste Lead ({leadAutomationLogs.length})
        </p>

        {leadAutomationLogs.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4 bg-slate-900/20 rounded-lg border border-slate-800/40">
            Nenhuma ação automática disparada para este lead ainda.
          </p>
        ) : (
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {leadAutomationLogs.map((log) => (
              <div
                key={log.id}
                className="p-2.5 bg-slate-900/50 rounded-lg border border-slate-800/70 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">
                    ⚡ {log.action}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {log.created_at
                      ? (() => {
                          try {
                            const d = new Date(log.created_at);
                            return isValid(d) ? format(d, "dd/MM HH:mm") : "";
                          } catch {
                            return "";
                          }
                        })()
                      : ""}
                  </span>
                </div>
                {log.details && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(log.details)
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <Badge
                          key={k}
                          variant="outline"
                          className="text-[9px] px-1.5 py-0 h-4 border-slate-800 text-slate-400"
                        >
                          {k}: {String(v).substring(0, 30)}
                        </Badge>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

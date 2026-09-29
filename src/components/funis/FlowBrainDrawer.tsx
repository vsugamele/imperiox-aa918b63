import React, { useState, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sparkles,
  Bot,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Target,
  Brain,
  MessageCircle,
  CreditCard,
  Copy,
  ExternalLink,
  Wrench,
  Layers,
  Flame,
  Check
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/error-message";
import type { Json } from "@/integrations/supabase/types";

export interface FlowNodeItem {
  id: string;
  label: string;
  kind: string;
  color?: string;
  description?: string | null;
  notes?: string | null;
  url?: string | null;
  stage_role?: string | null;
  executor_type?: string | null;
  linked_skill_id?: string | null;
  api_binding?: Json | null;
  checklist?: Array<{ id: string; text: string; done: boolean }>;
}

export interface FlowEdgeItem {
  id: string;
  source_id: string;
  target_id: string;
  label?: string | null;
}

interface FlowBrainDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodes: FlowNodeItem[];
  edges: FlowEdgeItem[];
  mapName: string;
  mapId: string;
  onRefresh: () => void;
  onExecuteSkill?: (skillId: string, nodeLabel: string) => void;
}

// Stage role mapping helper
function inferStageRole(kind: string, label: string): string {
  const text = (kind + " " + label).toLowerCase();
  if (/anuncio|trafego|meta|facebook|tiktok|instagram|youtube/.test(text)) return "trafego_anuncio";
  if (/captura|optin|landing|pv|pagina de vendas|vsl|webinar|aula|live/.test(text)) return "captura_vsl";
  if (/obrigado|grupo vip|comunidade/.test(text)) return "obrigado_grupo";
  if (/x1|mesa|consultiv|wa-ai-reply|atendimento|openflow/.test(text)) return "whatsapp_x1";
  if (/checkout|pagamento|recovery|carrinho/.test(text)) return "checkout";
  if (/order.*bump|upsell|downsell/.test(text)) return "upsell_orderbump";
  if (/membros|curso|area/.test(text)) return "retencao_membros";
  return "geral";
}

// Recommended skill mapping helper
function inferRecommendedSkill(stageRole: string, label: string): { skillId: string; skillName: string } {
  const text = label.toLowerCase();
  if (stageRole === "trafego_anuncio") {
    if (/hook|gancho/.test(text)) return { skillId: "hooklab", skillName: "HookLab (400 Hooks)" };
    if (/reels|video|shorts/.test(text)) return { skillId: "roteiros-virais-comment-to-dm", skillName: "Roteiros Virais Comment-to-DM" };
    return { skillId: "angulos-criativos", skillName: "Ângulos Criativos" };
  }
  if (stageRole === "captura_vsl") {
    if (/webinar|live/.test(text)) return { skillId: "webinar-blocks", skillName: "Webinar Blocks (5 Blocos)" };
    if (/vsl/.test(text)) return { skillId: "devastador-v4", skillName: "Devastador Copy V4 (7 Blocos)" };
    return { skillId: "lp-persuasiva-v2", skillName: "LP Persuasiva (16 Blocos)" };
  }
  if (stageRole === "obrigado_grupo") {
    return { skillId: "webinar-blocks", skillName: "Régua de Grupo VIP D-3 a D+1" };
  }
  if (stageRole === "whatsapp_x1") {
    return { skillId: "roteiros-virais-comment-to-dm", skillName: "Árvore SPIN X1 (wa-ai-reply)" };
  }
  if (stageRole === "checkout") {
    return { skillId: "proof-elements", skillName: "Proof Elements & Reason-Why" };
  }
  if (stageRole === "upsell_orderbump") {
    return { skillId: "tripwire-matador-v2", skillName: "Tripwire Matador V2" };
  }
  return { skillId: "rebel-copy", skillName: "Rebel Copy (Carlton)" };
}

// Recommended executor type
function inferExecutorType(stageRole: string, label: string): { type: string; label: string; badgeColor: string } {
  const text = label.toLowerCase();
  if (/wa-ai-reply|recovery|openflow|cron|api/.test(text)) {
    return { type: "API_AUTONOMOUS", label: "⚡ 100% Autônomo (API / Cron)", badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" };
  }
  if (/anuncio|vsl|copy|captura|obrigado/.test(text)) {
    return { type: "AI_SKILL", label: "🧠 Skill da IA (Gerador)", badgeColor: "bg-purple-500/10 text-purple-300 border-purple-500/25" };
  }
  if (/flow|kling|midjourney|higgsfield|white.*rabbit|zernio/.test(text)) {
    return { type: "EXTERNAL_TOOL", label: "🛠️ Ferramenta Externa (Com Prompt)", badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/25" };
  }
  return { type: "HUMAN_OPERATOR", label: "👤 Operador Humano", badgeColor: "bg-slate-800 text-slate-300 border-slate-700" };
}

export function FlowBrainDrawer({
  open,
  onOpenChange,
  nodes,
  edges,
  mapName,
  mapId,
  onRefresh,
  onExecuteSkill,
}: FlowBrainDrawerProps) {
  const [applying, setApplying] = useState(false);
  const [copiedPlaybook, setCopiedPlaybook] = useState(false);

  // 1. Diagnostics & Flow Integrity Audit
  const auditReport = useMemo(() => {
    const alerts: Array<{ id: string; type: "critical" | "warning" | "info"; title: string; desc: string; nodeId?: string }> = [];

    // Map source and target connections
    const targets = new Set(edges.map((e) => e.target_id));
    const sources = new Set(edges.map((e) => e.source_id));

    // Check traffic nodes
    const trafficNodes = nodes.filter((n) => inferStageRole(n.kind, n.label) === "trafego_anuncio");
    const checkoutNodes = nodes.filter((n) => inferStageRole(n.kind, n.label) === "checkout");
    const waNodes = nodes.filter((n) => inferStageRole(n.kind, n.label) === "whatsapp_x1");
    const optinNodes = nodes.filter((n) => inferStageRole(n.kind, n.label) === "captura_vsl");
    const thankNodes = nodes.filter((n) => inferStageRole(n.kind, n.label) === "obrigado_grupo");

    // Alerts
    if (trafficNodes.length === 0) {
      alerts.push({
        id: "no-traffic",
        type: "critical",
        title: "Nenhum nó de Tráfego / Anúncio detectado",
        desc: "O funil não tem canais de aquisição de topo mapeados (Meta Ads, Google, TikTok).",
      });
    }

    if (checkoutNodes.length === 0) {
      alerts.push({
        id: "no-checkout",
        type: "critical",
        title: "Nenhum nó de Checkout mapeado",
        desc: "Não há página de pagamento ou checkout (Kiwify, Ticto, CartPanda) para fechar a venda.",
      });
    }

    // Check orphan nodes
    nodes.forEach((n) => {
      const isConnected = sources.has(n.id) || targets.has(n.id);
      if (!isConnected && nodes.length > 1) {
        alerts.push({
          id: `orphan-${n.id}`,
          type: "warning",
          title: `Nó isolado: "${n.label}"`,
          desc: "Este nó não está conectado a nenhuma etapa anterior ou seguinte no fluxo.",
          nodeId: n.id,
        });
      }
    });

    // Check if optin leads to thank-you / VIP group
    optinNodes.forEach((opt) => {
      const optinEdges = edges.filter((e) => e.source_id === opt.id);
      const leadsToThankYou = optinEdges.some((e) => {
        const targetNode = nodes.find((n) => n.id === e.target_id);
        return targetNode && inferStageRole(targetNode.kind, targetNode.label) === "obrigado_grupo";
      });
      if (!leadsToThankYou && thankNodes.length > 0) {
        alerts.push({
          id: `optin-no-thank-${opt.id}`,
          type: "warning",
          title: `Captura "${opt.label}" sem Página de Obrigado vinculada`,
          desc: "Recomenda-se ligar a captura à página de obrigado para conduzir o lead ao Grupo VIP do WhatsApp.",
          nodeId: opt.id,
        });
      }
    });

    // Check if checkout has recovery
    checkoutNodes.forEach((ck) => {
      const hasRecovery = nodes.some(
        (n) => n.label.toLowerCase().includes("recovery") || n.label.toLowerCase().includes("recuperação")
      );
      if (!hasRecovery) {
        alerts.push({
          id: `checkout-no-recovery-${ck.id}`,
          type: "info",
          title: `Checkout sem Nó de Recuperação de Pix`,
          desc: "Adicione a automação de payment-recovery (3 toques em 15m/2h/24h) para recuperar 15-30% de carrinhos abandonados.",
          nodeId: ck.id,
        });
      }
    });

    return alerts;
  }, [nodes, edges]);

  // 2. Auto-enrich nodes with semantic attributes in bulk
  const handleAutoClassifyAll = async () => {
    setApplying(true);
    try {
      let updatedCount = 0;
      for (const node of nodes) {
        const stageRole = node.stage_role || inferStageRole(node.kind, node.label);
        const { skillId } = inferRecommendedSkill(stageRole, node.label);
        const { type } = inferExecutorType(stageRole, node.label);

        const { error } = await supabase
          .from("imphq_company_map_nodes")
          .update({
            stage_role: stageRole,
            linked_skill_id: node.linked_skill_id || skillId,
            executor_type: node.executor_type || type,
          })
          .eq("id", node.id);

        if (!error) updatedCount++;
      }

      toast.success(`${updatedCount} nós enriquecidos com semântica e skills!`);
      onRefresh();
    } catch (err) {
      toast.error("Erro ao enriquecer nós: " + errorMessage(err));
    } finally {
      setApplying(false);
    }
  };

  // 3. Generate Master Execution Playbook
  const generatePlaybookText = () => {
    let playbook = `# PLAYBOOK DE EXECUÇÃO: ${mapName.toUpperCase()}\n`;
    playbook += `Gerado pelo Flow Brain — Imperio HQ\n`;
    playbook += `Data: ${new Date().toLocaleDateString("pt-BR")}\n\n`;

    playbook += `## 1. RESUMO OPERACIONAL DO FUNIL\n`;
    playbook += `Total de Etapas: ${nodes.length} nós | Conexões: ${edges.length} flechas\n\n`;

    playbook += `## 2. ETAPAS, EXECUTORES E SKILLS\n\n`;

    nodes.forEach((n, idx) => {
      const role = n.stage_role || inferStageRole(n.kind, n.label);
      const { skillId, skillName } = inferRecommendedSkill(role, n.label);
      const exec = inferExecutorType(role, n.label);

      playbook += `### ${idx + 1}. ${n.label.toUpperCase()} (${role.replace(/_/g, " ").toUpperCase()})\n`;
      playbook += `- Executor: ${exec.label}\n`;
      playbook += `- Skill Mestra: ${n.linked_skill_id || skillId} (${skillName})\n`;
      if (n.description) playbook += `- Descrição: ${n.description}\n`;
      if (n.url) playbook += `- URL / Destino: ${n.url}\n`;
      if (n.notes) playbook += `- Notas / Parâmetros: ${n.notes}\n`;

      if (n.checklist && n.checklist.length > 0) {
        playbook += `- Checklists:\n`;
        n.checklist.forEach((c) => {
          playbook += `  [${c.done ? "X" : " "}] ${c.text}\n`;
        });
      }
      playbook += `\n`;
    });

    return playbook;
  };

  const handleCopyPlaybook = () => {
    const text = generatePlaybookText();
    navigator.clipboard.writeText(text);
    setCopiedPlaybook(true);
    toast.success("Playbook Mestre copiado!", {
      description: "Cole no Claude Code, Antigravity ou passe para a equipe.",
    });
    setTimeout(() => setCopiedPlaybook(false), 3000);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl bg-[#0A0B0D] border-l border-[#1B1E23] p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="p-6 border-b border-[#1B1E23] bg-[#0E1013]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-lime-400/10 text-lime-400 border border-lime-400/20">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle className="text-lg font-bold text-white flex items-center gap-2">
                  Flow Brain — Orquestrador do Funil
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  Entendimento semântico de cada nó, atribuição de agentes e diagnósticos
                </SheetDescription>
              </div>
            </div>
            <Badge variant="outline" className="font-mono text-[10px] border-lime-400/30 text-lime-400">
              {nodes.length} Etapas
            </Badge>
          </div>

          {/* Quick Actions Bar */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#1B1E23]">
            <Button
              size="sm"
              onClick={handleAutoClassifyAll}
              disabled={applying}
              className="bg-lime-400 text-black hover:bg-lime-500 font-semibold text-xs h-8"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              {applying ? "Classificando..." : "Auto-Vincular Skills & Executores"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyPlaybook}
              className="text-xs h-8 border-[#1B1E23] hover:bg-white/5"
            >
              {copiedPlaybook ? <Check className="h-3.5 w-3.5 mr-1 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
              {copiedPlaybook ? "Copiado!" : "Copiar Playbook"}
            </Button>
          </div>
        </SheetHeader>

        {/* Scrollable Content */}
        <ScrollArea className="flex-1 p-6 space-y-6">
          {/* Section: Diagnostic Alerts */}
          <div>
            <h3 className="text-xs font-mono font-semibold uppercase text-muted-foreground tracking-wider mb-3 flex items-center gap-2">
              <Flame className="h-3.5 w-3.5 text-amber-400" />
              Auditoria de Integridade do Fluxo ({auditReport.length})
            </h3>
            {auditReport.length === 0 ? (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-2.5 text-emerald-300 text-xs">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Fluxo 100% íntegro! Todas as etapas principais (Tráfego, Captura, WhatsApp e Checkout) estão conectadas.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {auditReport.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                      alert.type === "critical"
                        ? "bg-rose-500/10 border-rose-500/25 text-rose-300"
                        : alert.type === "warning"
                        ? "bg-amber-500/10 border-amber-500/25 text-amber-300"
                        : "bg-blue-500/10 border-blue-500/25 text-blue-300"
                    }`}
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold">{alert.title}</p>
                      <p className="text-[11px] opacity-80 mt-0.5">{alert.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Step by Step Node Semantics */}
          <div className="mt-6">
            <h3 className="text-xs font-mono font-semibold uppercase text-muted-foreground tracking-wider mb-3 flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-blue-400" />
              Estrutura Semântica das Etapas ({nodes.length})
            </h3>

            <div className="space-y-3">
              {nodes.map((node, i) => {
                const role = node.stage_role || inferStageRole(node.kind, node.label);
                const { skillId, skillName } = inferRecommendedSkill(role, node.label);
                const exec = inferExecutorType(role, node.label);
                const hasSkill = !!(node.linked_skill_id || skillId);

                return (
                  <div
                    key={node.id}
                    className="p-3 rounded-xl border border-[#1B1E23] bg-[#0E1013] hover:border-[#2A2E35] transition-all"
                  >
                    {/* Top Row: Title + Role */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-mono text-muted-foreground w-4">{i + 1}.</span>
                        <div
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ background: node.color || "#3b82f6" }}
                        />
                        <span className="text-xs font-semibold text-white truncate">{node.label}</span>
                      </div>
                      <Badge variant="outline" className="text-[9px] uppercase font-mono border-white/10 shrink-0">
                        {role.replace(/_/g, " ")}
                      </Badge>
                    </div>

                    {/* Description or URL */}
                    {node.description && (
                      <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1 pl-6">
                        {node.description}
                      </p>
                    )}

                    {/* Badges: Executor + Skill */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-2.5 pl-6">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${exec.badgeColor}`}>
                        {exec.label}
                      </span>

                      {hasSkill && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/25">
                          <Brain className="h-2.5 w-2.5 text-purple-400" />
                          Skill: {node.linked_skill_id || skillName}
                        </span>
                      )}

                      {node.url && (
                        <a
                          href={node.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-white/5 text-primary hover:underline border border-white/10"
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                          Link Ativo
                        </a>
                      )}
                    </div>

                    {/* Action to trigger skill */}
                    {onExecuteSkill && hasSkill && (
                      <div className="mt-2.5 pt-2 border-t border-white/5 flex justify-end pl-6">
                        <button
                          onClick={() => onExecuteSkill(node.linked_skill_id || skillId, node.label)}
                          className="text-[10px] font-mono text-lime-400 hover:text-lime-300 hover:underline flex items-center gap-1"
                        >
                          <Sparkles className="h-3 w-3" />
                          Gerar Ativo com esta Skill →
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

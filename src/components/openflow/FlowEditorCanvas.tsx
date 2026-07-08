import { useCallback, useMemo, useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  addEdge, // Added
  type Node,
  type Edge,
  type Connection, // Added
  BackgroundVariant,
  Panel,
  useReactFlow,
} from "@xyflow/react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import "@xyflow/react/dist/style.css";
import {
  Mail,
  MessageCircle,
  Clock,
  Zap,
  Globe,
  Brain,
  GitBranch,
  Timer,
  Bell,
  PhoneCall,
  Cpu,
  Tag,
  Split,
  Unlock,
  Mic,
  Send,
  BarChart3,
  Sparkles,
  Repeat,
  Octagon,
  LogOut,
  CheckCircle2,
  Plus
} from "lucide-react";
import type { Acao } from "./FlowEditor";

// ── Node type metadata map ───────────────────────────────────
const NODE_META: Record<string, { color: string; bg: string; icon: any; emoji: string; label: string }> = {
  whatsapp:        { color: "#22c55e", bg: "#022c22", icon: MessageCircle, emoji: "💬", label: "WhatsApp" },
  email:           { color: "#3b82f6", bg: "#1e3a8a", icon: Mail, emoji: "✉️", label: "Email" },
  audio:           { color: "#ec4899", bg: "#881337", icon: Mic, emoji: "🎙️", label: "Áudio IA" },
  delay:           { color: "#f59e0b", bg: "#78350f", icon: Clock, emoji: "⏱", label: "Aguardar" },
  aguardar:        { color: "#f59e0b", bg: "#78350f", icon: Clock, emoji: "⏱", label: "Aguardar" },
  wait_event:      { color: "#06b6d4", bg: "#164e63", icon: Timer, emoji: "⏱️", label: "Aguardar Evento" },
  wait_reply:      { color: "#84cc16", bg: "#1a2e05", icon: MessageCircle, emoji: "💬", label: "Aguardar Resposta" },
  input_capture:   { color: "#f97316", bg: "#7c2d12", icon: Zap, emoji: "📥", label: "Capturar Resposta" },
  generate_image:  { color: "#ec4899", bg: "#831843", icon: Sparkles, emoji: "🎨", label: "Gerar Imagem" },
  ab_split:        { color: "#d946ef", bg: "#701a75", icon: Split, emoji: "🔀", label: "Divisão A/B" },
  condicao:        { color: "#8b5cf6", bg: "#4c1d95", icon: GitBranch, emoji: "🔀", label: "Condição" },
  condicao_lead:   { color: "#f97316", bg: "#7c2d12", icon: GitBranch, emoji: "🔀", label: "Condição Lead" },
  webhook_call:    { color: "#06b6d4", bg: "#083344", icon: Globe, emoji: "🌐", label: "Webhook" },
  ia_message:      { color: "#a855f7", bg: "#581c87", icon: Sparkles, emoji: "🤖", label: "Mensagem IA" },
  notify_operator: { color: "#ef4444", bg: "#7f1d1d", icon: Bell, emoji: "🔔", label: "Notificar Atendente" },
  abrir_conversa:  { color: "#10b981", bg: "#064e3b", icon: Unlock, emoji: "🔓", label: "Abrir Conversa" },
  gpt_prompt:      { color: "#14b8a6", bg: "#115e59", icon: Brain, emoji: "🤖", label: "Prompt GPT" },
  update_memory:   { color: "#64748b", bg: "#334155", icon: Brain, emoji: "💾", label: "Atualizar Memória" },
  adicionar_tag:   { color: "#6366f1", bg: "#312e81", icon: Tag, emoji: "🏷️", label: "Atribuir Tag" },
  remover_tag:     { color: "#ef4444", bg: "#7f1d1d", icon: Tag, emoji: "🏷️", label: "Remover Tag" },
  telegram:        { color: "#0ea5e9", bg: "#075985", icon: Send, emoji: "📨", label: "Telegram" },
  qualify_lead:    { color: "#eab308", bg: "#713f12", icon: BarChart3, emoji: "⭐", label: "Qualificar Lead" },
  branch_by_awareness: { color: "#f97316", bg: "#7c2d12", icon: Brain, emoji: "🧠", label: "Ramificar Consciência" },
  branch_by_intent: { color: "#ec4899", bg: "#881337", icon: GitBranch, emoji: "🎯", label: "Ramificar Intenção" },
  trigger:         { color: "#eab308", bg: "#422006", icon: Zap, emoji: "⚡", label: "Gatilho" },
  loop_steps:      { color: "#eab308", bg: "#422006", icon: Repeat, emoji: "🔁", label: "Loop" },
  stop_on_event:   { color: "#ef4444", bg: "#7f1d1d", icon: Octagon, emoji: "🛑", label: "Parar Fluxo" },
  ia_scheduling:   { color: "#3b82f6", bg: "#1e3a8a", icon: Clock, emoji: "📅", label: "Agendamento por IA" },
  semantic_router: { color: "#a855f7", bg: "#581c87", icon: GitBranch, emoji: "🔀", label: "Roteador Semântico" },
  business_hours_split: { color: "#f59e0b", bg: "#78350f", icon: Timer, emoji: "⏰", label: "Horário Comercial" },
  default:         { color: "#94a3b8", bg: "#1e293b", icon: Zap, emoji: "⚡", label: "Ação" },
};

// ── Custom Node Component ──────────────────────────────────────
function ActionNode({ data, selected }: { data: any; selected: boolean }) {
  const meta = NODE_META[data.tipo] || NODE_META.default;
  const acao = data.acao || {};

  return (
    <div
      className={`rounded-2xl p-4 border text-left transition-all relative ${
        selected
          ? "border-primary bg-slate-900 shadow-[0_0_15px_rgba(234,179,8,0.3)] scale-[1.03]"
          : "border-border/60 bg-slate-950/90 hover:border-slate-700 shadow-lg"
      }`}
      style={{
        width: 220,
      }}
    >
      {/* Input port for sequential flow */}
      {data.tipo !== "trigger" && (
        <Handle
          type="target"
          position={Position.Top}
          style={{ background: "#475569", width: 8, height: 8, border: "2px solid #0f172a" }}
        />
      )}

      {/* Node Header */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-lg shrink-0"
          style={{ background: `${meta.color}22`, border: `1px solid ${meta.color}44` }}
        >
          <span className="text-sm">{meta.emoji}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground" style={{ color: meta.color }}>
            {meta.label}
          </p>
          {data.index !== undefined && data.index >= 0 && (
            <span className="text-[8px] font-mono text-muted-foreground/80 font-bold bg-secondary/80 px-1 py-0.2 rounded">
              #{data.index + 1}
            </span>
          )}
        </div>
      </div>

      {/* Node Description/Detail */}
      {data.label && (
        <p className="text-[11px] text-slate-300 font-medium leading-relaxed line-clamp-2">
          {data.label}
        </p>
      )}

      {/* Loop detail */}
      {data.tipo === "loop_steps" && (
        <div className="text-[9px] text-yellow-400 font-medium mt-1 space-y-0.5 border-t border-white/5 pt-1.5">
          <p>🔁 Repetir: {acao.loop_count ?? 3} vezes</p>
          <p>↩️ Voltar: {acao.loop_jump_back_steps ?? 1} etapas</p>
          <p>⏱️ Intervalo: {acao.loop_interval_hours ?? 24}h</p>
        </div>
      )}

      {/* Stop detail */}
      {data.tipo === "stop_on_event" && (
        <div className="text-[9px] text-red-400 font-medium mt-1 space-y-0.5 border-t border-white/5 pt-1.5">
          <p>🛑 Parar se: {acao.stop_event_type || "Compra Aprovada"}</p>
        </div>
      )}

      {/* IA routes handles */}
      {data.tipo === "ia_message" && Array.isArray(acao.ia_routes) && acao.ia_routes.length > 0 && (
        <div className="mt-2 space-y-1.5 border-t border-white/5 pt-2 select-none">
          <p className="text-[8px] font-bold uppercase tracking-wider text-purple-400 mb-1">Rotas de Resposta:</p>
          {acao.ia_routes.map((route: any, rIdx: number) => (
            <div key={rIdx} className="relative flex items-center justify-between bg-slate-900 border border-slate-800/80 rounded px-2 py-1 text-[9px] text-slate-300 font-semibold shadow-sm">
              <span className="truncate pr-4">{route.name || `Rota ${rIdx + 1}`}</span>
              <Handle
                type="source"
                position={Position.Right}
                id={`route-${rIdx}`}
                style={{
                  top: "50%",
                  right: -4,
                  transform: "translateY(-50%)",
                  background: "#a855f7",
                  width: 7,
                  height: 7,
                  border: "2px solid #0f172a",
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* AB Split branching */}
      {data.tipo === "ab_split" && (
        <div className="mt-2 space-y-1 border-t border-white/5 pt-1.5 select-none">
          <div className="relative flex items-center justify-between bg-slate-900 border border-slate-800/80 rounded px-2 py-1 text-[9px] text-fuchsia-400 font-semibold shadow-sm">
            <span>Rota B ({100 - (acao.rota_a_porcentagem ?? 50)}%)</span>
            <Handle
              type="source"
              position={Position.Right}
              id="route-b"
              style={{
                top: "50%",
                right: -4,
                transform: "translateY(-50%)",
                background: "#d946ef",
                width: 7,
                height: 7,
                border: "2px solid #0f172a",
              }}
            />
          </div>
        </div>
      )}

      {/* Condition branching */}
      {(data.tipo === "condicao" || data.tipo === "condicao_lead") && (
        <div className="mt-2 space-y-1 border-t border-white/5 pt-1.5 select-none">
          <div className="relative flex items-center justify-between bg-slate-900 border border-slate-800/80 rounded px-2 py-1 text-[9px] text-violet-400 font-semibold shadow-sm">
            <span>Se Sim / Verdadeiro</span>
            <Handle
              type="source"
              position={Position.Right}
              id="branch-true"
              style={{
                top: "50%",
                right: -4,
                transform: "translateY(-50%)",
                background: "#8b5cf6",
                width: 7,
                height: 7,
                border: "2px solid #0f172a",
              }}
            />
          </div>
          <div className="relative flex items-center justify-between bg-slate-900 border border-slate-800/80 rounded px-2 py-1 text-[9px] text-red-400 font-semibold shadow-sm">
            <span>Se Não / Falso</span>
            <Handle
              type="source"
              position={Position.Right}
              id="branch-false"
              style={{
                top: "50%",
                right: -4,
                transform: "translateY(-50%)",
                background: "#ef4444",
                width: 7,
                height: 7,
                border: "2px solid #0f172a",
              }}
            />
          </div>
        </div>
      )}

      {/* Semantic Router branching */}
      {data.tipo === "semantic_router" && (
        <div className="mt-2 space-y-1 border-t border-white/5 pt-1.5 select-none">
          <div className="relative flex items-center justify-between bg-slate-900 border border-slate-800/80 rounded px-2 py-1 text-[9px] text-purple-400 font-semibold shadow-sm">
            <span>Rota B (Desviar)</span>
            <Handle
              type="source"
              position={Position.Right}
              id="route-b"
              style={{
                top: "50%",
                right: -4,
                transform: "translateY(-50%)",
                background: "#a855f7",
                width: 7,
                height: 7,
                border: "2px solid #0f172a",
              }}
            />
          </div>
        </div>
      )}

      {/* Business Hours Split branching */}
      {data.tipo === "business_hours_split" && (
        <div className="mt-2 space-y-1 border-t border-white/5 pt-1.5 select-none">
          <div className="relative flex items-center justify-between bg-slate-900 border border-slate-800/80 rounded px-2 py-1 text-[9px] text-amber-400 font-semibold shadow-sm">
            <span>Fora de Horário (Pular)</span>
            <Handle
              type="source"
              position={Position.Right}
              id="route-b"
              style={{
                top: "50%",
                right: -4,
                transform: "translateY(-50%)",
                background: "#f59e0b",
                width: 7,
                height: 7,
                border: "2px solid #0f172a",
              }}
            />
          </div>
        </div>
      )}

      {data.delay_min > 0 && (
        <p className="text-[9px] text-amber-400 font-semibold mt-1 flex items-center gap-0.5">
          ⏱️ {data.delay_min} min delay
        </p>
      )}

      {/* Stats Overlay Panel */}
      {data.stats && data.stats.reached > 0 && (
        <div className="mt-3 pt-2 border-t border-slate-800/80 grid grid-cols-3 gap-1 text-center select-none">
          <div className="flex flex-col p-1 rounded bg-slate-900/60 border border-slate-800/40">
            <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wide">Entraram</span>
            <span className="text-xs font-mono font-extrabold text-blue-400">{data.stats.reached}</span>
          </div>
          <div className="flex flex-col p-1 rounded bg-slate-900/60 border border-slate-800/40">
            <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wide">Avançaram</span>
            <span className="text-xs font-mono font-extrabold text-emerald-400">{data.stats.completed}</span>
          </div>
          <div className="flex flex-col p-1 rounded bg-slate-900/60 border border-slate-800/40">
            <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wide">Aguardando</span>
            <span className="text-xs font-mono font-extrabold text-amber-400">{data.stats.waiting}</span>
          </div>
        </div>
      )}

      {/* Output port for sequential flow */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: meta.color, width: 8, height: 8, border: "2px solid #0f172a" }}
      />
    </div>
  );
}

const nodeTypes = { actionNode: ActionNode };

// ── Adapter: acoes[] → nodes + edges ─────────────────────────
function acoesToNodesEdges(
  acoes: Acao[], 
  triggerTipo: string,
  stepStats?: Record<number, { reached: number; completed: number; waiting: number; failed: number }>,
  flowObjective?: string,
  onUpdateObjective?: (objective: string) => void
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  
  // Grid layout parameters
  const xCenter = 150;
  const yGap = 165;

  // 1. Add Trigger Node at top
  nodes.push({
    id: "trigger",
    type: "actionNode",
    position: { x: xCenter, y: 0 },
    data: {
      tipo: "trigger",
      label: triggerTipo || "Gatilho Inicial",
      index: -1,
      acao: {}
    },
  });

  // Resolve unique node ids (protects React Flow from silently dropping duplicates)
  const seen = new Set<string>(["trigger"]);
  const resolvedIds: string[] = acoes.map((acao: any, i) => {
    let candidate = acao.id || `step-${i}`;
    if (seen.has(candidate)) {
      const base = candidate;
      let n = 2;
      while (seen.has(`${base}__${n}`)) n++;
      candidate = `${base}__${n}`;
      if (typeof console !== "undefined") {
        console.warn(`[OpenFlow] ID duplicado no bloco #${i + 1} (${base}) — renomeado para ${candidate}`);
      }
    }
    seen.add(candidate);
    return candidate;
  });

  // 2. Add Action Nodes
  acoes.forEach((acao: any, i) => {
    const id = resolvedIds[i];
    let label = acao.template || acao.webhook_url || acao.tag || "";
    
    
    if (acao.tipo === "ia_message") {
      label = `Objetivo: ${acao.template}`;
    } else if (acao.tipo === "condicao_lead") {
      label = `${acao.condition_field} ${acao.condition_operator} ${acao.condition_value}`;
    } else if (acao.tipo === "wait_event") {
      label = `Aguardar: ${acao.event_name}`;
    } else if (acao.tipo === "wait_reply") {
      label = `Esperar lead responder (timeout ${acao.timeout_min ?? 1440}min)`;
    } else if (acao.tipo === "loop_steps") {
      label = `Loop: Repetir ${acao.loop_count ?? 3}x`;
    } else if (acao.tipo === "stop_on_event") {
      label = `Parar se: ${acao.stop_event_type || "Compra Aprovada"}`;
    } else if (acao.tipo === "input_capture") {
      label = acao.capture_variable ? `Definir {{${acao.capture_variable}}}` : "Definir variável…";
    } else if (acao.tipo === "generate_image") {
      const p = acao.image_prompt || acao.template || "";
      label = p ? `🎨 ${p.slice(0, 60)}${p.length > 60 ? "…" : ""}` : "Gerar imagem…";
    }

    if (acao.tipo === "whatsapp" && acao.media?.url) {
      label = `📎 ${acao.media.label || "mídia"}${label ? ` — ${label}` : ""}`;
    }

    const posX = acao.position_x !== undefined ? acao.position_x : xCenter;
    const posY = acao.position_y !== undefined ? acao.position_y : (i + 1) * yGap;

    nodes.push({
      id,
      type: "actionNode",
      position: { x: posX, y: posY },
      data: {
        tipo: acao.tipo,
        label: label.substring(0, 50) + (label.length > 50 ? "…" : ""),
        delay_min: acao.delay_min || 0,
        index: i,
        acao,
        stats: stepStats?.[i],
      },
    });

    // ── SEQUENTIAL CONNECTIONS ──
    // Determine the source node for the sequential connection
    let sourceId = i === 0 ? "trigger" : resolvedIds[i - 1];
    
    // If the action has an explicit next_id, we'll use that for the connection
    // But for now we still support the legacy sequential flow by default if no explicit connection exists
    const hasExplicitNext = !!acao.next_id;
    
    if (!hasExplicitNext) {
      // Default sequential connection
      let edgeLabel = undefined;
      let edgeStyle = { stroke: "#64748b", strokeWidth: 2 };
      let edgeLabelStyle = { fill: "#94a3b8", fontSize: 9, fontWeight: "bold" };
      
      if (i > 0 && stepStats) {
        const prev = stepStats[i - 1];
        const curr = stepStats[i];
        if (prev && curr && prev.reached > 0) {
          const pct = Math.min(100, Math.round((curr.reached / prev.reached) * 100));
          edgeLabel = `${pct}% conv`;
          edgeStyle = { stroke: pct > 50 ? "#10b981" : "#64748b", strokeWidth: 2 };
          edgeLabelStyle = { fill: pct > 50 ? "#10b981" : "#94a3b8", fontSize: 9, fontWeight: "bold" };
        }
      }

      edges.push({
        id: `e-${sourceId}-${id}`,
        source: sourceId,
        target: id,
        label: edgeLabel,
        style: edgeStyle,
        labelStyle: edgeLabelStyle,
        animated: false,
      });
    } else if (acao.next_id) {
      // Explicit connection from next_id
      edges.push({
        id: `e-${id}-${acao.next_id}`,
        source: id,
        target: acao.next_id,
        style: { stroke: "#64748b", strokeWidth: 2 },
        animated: false,
      });
    }

    // ── BRANCHING CONNECTIONS (Legacy jumps + New IDs) ──
    
    // 1. Explicit true_next_id / false_next_id
    if (acao.true_next_id) {
      edges.push({
        id: `e-${id}-true-${acao.true_next_id}`,
        source: id,
        sourceHandle: "branch-true",
        target: acao.true_next_id,
        label: "Se Sim",
        style: { stroke: "#8b5cf6", strokeWidth: 2, strokeDasharray: "5,3" },
        labelStyle: { fill: "#8b5cf6", fontSize: 9, fontWeight: "bold" },
      });
    }

    if (acao.false_next_id) {
      edges.push({
        id: `e-${id}-false-${acao.false_next_id}`,
        source: id,
        sourceHandle: "branch-false", // We should probably add this handle to ActionNode
        target: acao.false_next_id,
        label: "Se Não",
        style: { stroke: "#ef4444", strokeWidth: 2, strokeDasharray: "5,3" },
        labelStyle: { fill: "#ef4444", fontSize: 9, fontWeight: "bold" },
      });
    }

    // 2. Legacy jumps (Compatibility)
    if (
      !acao.true_next_id &&
      (acao.tipo === "condicao_lead" || acao.tipo === "ab_split" || acao.tipo === "condicao" || acao.tipo === "semantic_router" || acao.tipo === "business_hours_split") &&
      (acao.condition_jump_steps || acao.jump_steps || acao.else_skip)
    ) {
      const jumpVal = acao.condition_jump_steps || acao.jump_steps || acao.else_skip || 1;
      const jumpTargetIdx = i + jumpVal;
      if (jumpTargetIdx < acoes.length) {
        const jumpTargetId = resolvedIds[jumpTargetIdx];
        const isAb = acao.tipo === "ab_split";
        const isSem = acao.tipo === "semantic_router";
        const isBh = acao.tipo === "business_hours_split";
        const handleId = isAb || isSem || isBh ? "route-b" : "branch-true";
        
        let label = "Se Sim";
        let strokeColor = "#10b981";

        if (isAb) {
          label = "Rota B";
          strokeColor = "#d946ef";
        } else if (isSem) {
          label = "Rota B (Desviar)";
          strokeColor = "#a855f7";
        } else if (isBh) {
          label = "Fora de Horário";
          strokeColor = "#f59e0b";
        }

        let labelText = label;
        if (stepStats) {
          const src = stepStats[i];
          const tgt = stepStats[jumpTargetIdx];
          if (src && tgt && src.reached > 0) {
            const pct = Math.min(100, Math.round((tgt.reached / src.reached) * 100));
            labelText = `${label} (${pct}% conv)`;
          }
        }

        edges.push({
          id: `e-legacy-branch-${id}`,
          source: id,
          sourceHandle: handleId,
          target: jumpTargetId,
          label: labelText,
          style: { stroke: strokeColor, strokeWidth: 2, strokeDasharray: "5,3" },
          labelStyle: { fill: strokeColor, fontSize: 9, fontWeight: "bold" },
        });
      }
    }

    // 2b. Else branch real (If/Else) para condicao_lead — desenha aresta vermelha "Se Não"
    if (
      acao.tipo === "condicao_lead" &&
      !acao.false_next_id &&
      typeof acao.condition_else_jump_steps === "number" &&
      acao.condition_else_jump_steps > 0
    ) {
      const elseTargetIdx = i + acao.condition_else_jump_steps;
      if (elseTargetIdx < acoes.length) {
        const elseTargetId = resolvedIds[elseTargetIdx];
        let labelText = "Se Não";
        if (stepStats) {
          const src = stepStats[i];
          const tgt = stepStats[elseTargetIdx];
          if (src && tgt && src.reached > 0) {
            const pct = Math.min(100, Math.round((tgt.reached / src.reached) * 100));
            labelText = `Se Não (${pct}% conv)`;
          }
        }
        edges.push({
          id: `e-legacy-else-${id}`,
          source: id,
          sourceHandle: "branch-false",
          target: elseTargetId,
          label: labelText,
          style: { stroke: "#ef4444", strokeWidth: 2, strokeDasharray: "5,3" },
          labelStyle: { fill: "#ef4444", fontSize: 9, fontWeight: "bold" },
        });
      }
    }



    // Handle branching jumps for Conversational AI (ia_message routes)
    if (acao.tipo === "ia_message" && Array.isArray(acao.ia_routes) && acao.ia_routes.length > 0) {
      acao.ia_routes.forEach((route: any, rIdx: number) => {
        const jumpVal = route.jump_steps || 0;
        const jumpTarget = i + 1 + jumpVal;
        if (jumpTarget < acoes.length) {
          let label = route.name || `Rota ${rIdx + 1}`;
          if (stepStats) {
            const src = stepStats[i];
            const tgt = stepStats[jumpTarget];
            if (src && tgt && src.reached > 0) {
              const pct = Math.min(100, Math.round((tgt.reached / src.reached) * 100));
              label = `${label} (${pct}% conv)`;
            }
          }

          edges.push({
            id: `e-ai-route-${id}-${rIdx}`,
            source: id,
            sourceHandle: `route-${rIdx}`,
            target: resolvedIds[jumpTarget],
            label,
            style: { stroke: "#a855f7", strokeWidth: 2, strokeDasharray: "4,4" },
            labelStyle: { fill: "#a855f7", fontSize: 9, fontWeight: "bold" },
            animated: true,
          });
        }
      });
    }

    // Handle loopback edges (loop_steps)
    if (acao.tipo === "loop_steps") {
      const jumpVal = acao.loop_jump_back_steps ?? 1;
      const targetIdx = Math.max(0, i - jumpVal);
      let label = "Retorno Loop";
      if (stepStats) {
        const src = stepStats[i];
        const tgt = stepStats[targetIdx];
        if (src && tgt && src.reached > 0) {
          const pct = Math.min(100, Math.round((tgt.reached / src.reached) * 100));
          label = `Retorno Loop (${pct}%)`;
        }
      }

      edges.push({
        id: `e-loop-${id}`,
        source: id,
        target: targetIdx === 0 ? "trigger" : resolvedIds[targetIdx] ?? `step-${targetIdx}`,
        label,
        style: { stroke: "#eab308", strokeWidth: 2, strokeDasharray: "4,4" },
        labelStyle: { fill: "#eab308", fontSize: 8, fontWeight: "bold" },
        animated: true,
      });
    }
  });

  return { nodes, edges };
}

// ── Main Component ─────────────────────────────────────────────
interface FlowEditorCanvasProps {
  acoes: Acao[];
  triggerTipo: string;
  onChange: (acoes: Acao[]) => void;
  onActionSelect?: (index: number) => void;
  stepStats?: Record<number, { reached: number; completed: number; waiting: number; failed: number }>;
  flowObjective?: string;
  onUpdateObjective?: (objective: string) => void;
}

// Paleta de elementos agrupada por categoria
const PALETTE_GROUPS: { group: string; items: { tipo: string; label: string }[] }[] = [
  {
    group: "Mensagens",
    items: [
      { tipo: "whatsapp", label: "💬 WhatsApp" },
      { tipo: "ia_message", label: "🤖 IA Conversacional" },
      { tipo: "audio", label: "🎙️ Áudio IA" },
      { tipo: "email", label: "✉️ Email" },
    ],
  },
  {
    group: "Esperas",
    items: [
      { tipo: "aguardar", label: "⏱ Aguardar Tempo" },
      { tipo: "wait_reply", label: "💬 Aguardar Resposta" },
      { tipo: "wait_event", label: "⏱️ Aguardar Evento" },
    ],
  },
  {
    group: "Lógica",
    items: [
      { tipo: "condicao_lead", label: "🔀 Condição por Lead" },
      { tipo: "ab_split", label: "🔀 Teste A/B" },
      { tipo: "stop_on_event", label: "🛑 Parar Fluxo" },
    ],
  },
  {
    group: "Ações no Lead",
    items: [
      { tipo: "adicionar_tag", label: "🏷️ Atribuir Tag" },
      { tipo: "qualify_lead", label: "⭐ Qualificar Lead" },
      { tipo: "notify_operator", label: "🔔 Notificar Atendente" },
    ],
  },
  {
    group: "Integrações",
    items: [
      { tipo: "webhook_call", label: "🌐 Webhook" },
      { tipo: "gpt_prompt", label: "🤖 Prompt GPT" },
    ],
  },
];


export function FlowEditorCanvas({ 
  acoes, 
  triggerTipo, 
  onChange, 
  onActionSelect, 
  stepStats,
  flowObjective,
  onUpdateObjective
}: FlowEditorCanvasProps) {
  const { nodes: initNodes, edges: initEdges } = useMemo(
    () => acoesToNodesEdges(acoes, triggerTipo, stepStats, flowObjective, onUpdateObjective),
    [acoes, triggerTipo, stepStats, flowObjective, onUpdateObjective]
  );
  
  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);

  useEffect(() => {
    setNodes(initNodes);
  }, [initNodes, setNodes]);

  useEffect(() => {
    setEdges(initEdges);
  }, [initEdges, setEdges]);

  const handleNodeClick = useCallback(
    (_: any, node: Node) => {
      const idx = node.data?.index as number | undefined;
      if (idx !== undefined && idx >= 0 && onActionSelect) {
        onActionSelect(idx);
      }
    },
    [onActionSelect]
  );

  const handleNodeDragStop = useCallback(
    (_event: any, node: Node) => {
      const idx = node.data?.index as number | undefined;
      if (idx !== undefined && idx >= 0) {
        const updatedAcoes = [...acoes];
        updatedAcoes[idx] = {
          ...updatedAcoes[idx],
          position_x: Math.round(node.position.x),
          position_y: Math.round(node.position.y),
        };
        onChange(updatedAcoes);
      }
    },
    [acoes, onChange]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, animated: true, style: { strokeWidth: 2 } }, eds));
      
      const updatedAcoes = [...acoes];
      const sourceNode = nodes.find(n => n.id === params.source);
      const sourceIdx = sourceNode?.data?.index as number | undefined;
      const targetId = params.target;
      
      if (sourceIdx !== undefined && sourceIdx >= 0) {
        if (params.sourceHandle === "branch-true") {
          updatedAcoes[sourceIdx] = { ...updatedAcoes[sourceIdx], true_next_id: targetId };
        } else if (params.sourceHandle === "branch-false") {
          updatedAcoes[sourceIdx] = { ...updatedAcoes[sourceIdx], false_next_id: targetId };
        } else if (params.sourceHandle?.startsWith("route-")) {
          updatedAcoes[sourceIdx] = { ...updatedAcaoInIdx(updatedAcoes, sourceIdx), next_id: targetId };
        } else {
          updatedAcoes[sourceIdx] = { ...updatedAcoes[sourceIdx], next_id: targetId };
        }
        onChange(updatedAcoes);
      }
    },
    [nodes, acoes, onChange, setEdges]
  );

  // Helper function to handle potential undefined
  function updatedAcaoInIdx(arr: any[], idx: number) {
    return arr[idx] || {};
  }

  return (
    <div className="flex-1 w-full h-full relative" style={{ minHeight: "530px" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onNodeDragStop={handleNodeDragStop}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.4}
        maxZoom={1.5}
        style={{ background: "transparent" }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#334155" />
        <Controls style={{ background: "#0f172a", border: "1px solid #334155", color: "#fff" }} />
        <MiniMap
          style={{ background: "#090d16", border: "1px solid #1e293b" }}
          nodeColor={(n) => {
            const meta = NODE_META[(n.data as any)?.tipo] || NODE_META.default;
            return meta.color;
          }}
          maskColor="rgba(15, 23, 42, 0.6)"
        />
        <Panel
          position="bottom-left"
          className="bg-slate-900/90 border border-slate-800 text-[10px] text-muted-foreground p-2 rounded-lg pointer-events-none"
        >
          ✨ Arraste os blocos para organizar • Clique em um bloco para editar
        </Panel>

        <Panel position="top-right" className="m-3 pointer-events-auto flex items-center gap-2">
          <div
            className={`px-2 py-1 rounded-md text-[10px] font-semibold border ${
              nodes.length - 1 < acoes.length
                ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                : "bg-slate-900/90 border-slate-800 text-slate-300"
            }`}
            title={
              nodes.length - 1 < acoes.length
                ? "Alguns blocos tinham IDs duplicados. Corrigimos no canvas — duplique/edite novamente para persistir."
                : "Todos os blocos da lista estão no canvas"
            }
          >
            {nodes.length - 1}/{acoes.length} blocos
          </div>
          <FitViewButton />
        </Panel>

        {/* Sidebar de Elementos + Painéis Estratégicos */}
        <Panel position="top-left" className="m-3 pointer-events-auto">
          <FlowSidebar
            flowObjective={flowObjective}
            onUpdateObjective={onUpdateObjective}
            onAddAcao={(tipo) => onChange([...acoes, { id: crypto.randomUUID(), tipo, template: "", delay_min: 0 } as Acao])}
          />
        </Panel>
      </ReactFlow>
    </div>
  );
}

// ── Sidebar de Elementos ───────────────────────────────────────
function FlowSidebar({
  flowObjective,
  onUpdateObjective,
  onAddAcao,
}: {
  flowObjective?: string;
  onUpdateObjective?: (objective: string) => void;
  onAddAcao: (tipo: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<"elementos" | "objetivo" | "saida">("elementos");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-xl px-2 py-3 text-slate-300 hover:text-amber-400 hover:border-amber-500/40 transition-all flex flex-col items-center gap-2"
        title="Abrir paleta de elementos"
      >
        <Sparkles className="h-4 w-4" />
        <span className="text-[9px] uppercase tracking-widest [writing-mode:vertical-rl] rotate-180 font-bold">
          Elementos
        </span>
      </button>
    );
  }

  return (
    <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl w-72 max-h-[calc(100vh-340px)] flex flex-col overflow-hidden animate-in fade-in slide-in-from-left-4 duration-300">
      {/* Header com tabs */}
      <div className="flex items-center border-b border-slate-800 bg-slate-950/40 shrink-0">
        <button
          onClick={() => setTab("elementos")}
          className={`flex-1 text-[10px] uppercase font-bold tracking-wider py-2.5 transition-colors ${
            tab === "elementos" ? "text-amber-400 border-b-2 border-amber-500" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          ✨ Elementos
        </button>
        <button
          onClick={() => setTab("objetivo")}
          className={`flex-1 text-[10px] uppercase font-bold tracking-wider py-2.5 transition-colors ${
            tab === "objetivo" ? "text-purple-400 border-b-2 border-purple-500" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          🎯 Objetivo
        </button>
        <button
          onClick={() => setTab("saida")}
          className={`flex-1 text-[10px] uppercase font-bold tracking-wider py-2.5 transition-colors ${
            tab === "saida" ? "text-rose-400 border-b-2 border-rose-500" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          🚪 Saída
        </button>
        <button
          onClick={() => setOpen(false)}
          className="px-2 py-2.5 text-slate-500 hover:text-amber-400 border-l border-slate-800"
          title="Recolher"
        >
          ‹
        </button>
      </div>

      {/* Conteúdo scrollável */}
      <div className="flex-1 overflow-y-auto p-3 pb-5">
        {tab === "elementos" && (
          <div className="space-y-4">
            <p className="text-[10px] text-slate-500 leading-snug px-1">
              Clique em um elemento para adicionar ao final do fluxo.
            </p>
            {PALETTE_GROUPS.map((g) => (
              <div key={g.group} className="space-y-1.5">
                <div className="text-[9px] uppercase tracking-widest font-bold text-slate-500 px-1">
                  {g.group}
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {g.items.map((it) => (
                    <button
                      key={it.tipo}
                      onClick={() => onAddAcao(it.tipo)}
                      className="text-left text-[11px] text-slate-200 bg-slate-950/60 hover:bg-amber-500/10 hover:text-amber-300 border border-slate-800 hover:border-amber-500/40 rounded-lg px-2.5 py-2 transition-all flex items-center justify-between group"
                    >
                      <span className="truncate">{it.label}</span>
                      <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "objetivo" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-purple-400">
              <Brain className="h-4 w-4" />
              <span className="text-[10px] uppercase font-bold tracking-wider">Objetivo do Fluxo</span>
            </div>
            <Textarea
              value={flowObjective || ""}
              onChange={(e) => onUpdateObjective?.(e.target.value)}
              placeholder="Ex: Recuperar leads de carrinho abandonado com foco em objeção de preço..."
              className="text-[11px] bg-slate-950/50 border-white/10 min-h-[140px] resize-none leading-relaxed text-slate-300"
            />
            <p className="text-[9px] text-muted-foreground/60 italic leading-snug">
              Este objetivo guia a IA e ajuda a manter a régua estratégica.
            </p>
          </div>
        )}

        {tab === "saida" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-rose-400">
              <LogOut className="h-4 w-4" />
              <span className="text-[10px] uppercase font-bold tracking-wider">Condições de Saída</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              O lead sairá do fluxo se:
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2 bg-slate-950/50 border border-white/5 rounded-lg text-[10px] text-slate-300">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Compra Aprovada
              </div>
              <div className="flex items-center gap-2 p-2 bg-slate-950/50 border border-white/5 rounded-lg text-[10px] text-slate-300">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Lead respondeu (se IA)
              </div>
              <Button variant="outline" size="sm" className="w-full text-[9px] h-7 border-dashed border-white/10 bg-transparent hover:bg-white/5">
                <Plus className="h-3 w-3 mr-1" /> Add Condição Personalizada
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


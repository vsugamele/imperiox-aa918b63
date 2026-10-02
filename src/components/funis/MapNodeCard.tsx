import { Handle, NodeResizer, Position } from "@xyflow/react";
import { Bot, Copy, ExternalLink, Flame, ImageIcon, Phone, Sparkles, Trash2, User, Wrench, Zap } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { EXECUTOR_LABEL, executorGroup, type ExecutorGroup } from "@shared/map-steps";
import { readStageContract } from "@shared/project-map";
import { pickKpiForKind } from "@/hooks/useCompanyMapLiveStats";
import { KIND_PRESETS } from "@/components/funis/map-element-presets";
import { extractAgentData } from "@/components/funis/map-agent-data";
import { SIZE_PRESETS, matchesLens, type ChecklistItem, type MapNodeData } from "@/components/funis/map-node-model";
import { StepOwnerChips } from "@/components/funis/StepOwnerChips";

const EXECUTOR_ICON: Record<ExecutorGroup, typeof Bot> = { ia: Bot, automatico: Zap, ferramenta: Wrench, humano: User };

const STATUS_STYLE = {
  done: { label: "Feito", cls: "bg-success/15 text-success border-success/30" },
  in_progress: { label: "Em andamento", cls: "bg-primary/15 text-primary border-primary/30" },
  ready_review: { label: "Revisar", cls: "bg-warning/15 text-warning border-warning/30" },
  pending: { label: "A fazer", cls: "bg-muted text-muted-foreground border-border" },
  not_declared: { label: "Sem status", cls: "bg-transparent text-subtle border-dashed border-border" },
} as const;

/** Primeira frase útil: corta marcadores do playbook ("O QUÊ:", "REGRA:") para caber numa linha de leitura. */
function firstSentence(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const cut = clean.split(/(?<=[.!?])\s|\s(?=[A-ZÇÃÉÊÍÓÚ]{3,}[A-ZÇÃÉÊÍÓÚ ]*:)/)[0] ?? clean;
  return cut.replace(/^[A-ZÇÃÉÊÍÓÚ ]{3,}:\s*/, "").trim();
}

/** "O que faz": objetivo declarado no contrato; sem ele, a primeira frase da descrição. */
function whatItDoes(data: MapNodeData): string | null {
  const contract = readStageContract({
    id: data.id, label: data.label, kind: data.kind, description: data.description, notes: data.notes,
    stage_role: data.stage_role, executor_type: data.executor_type, linked_skill_id: data.linked_skill_id,
    url: data.url, metrics_target: data.metrics_target, checklist: data.checklist,
  });
  const objective = contract.fields.find((f) => f.key === "objective");
  if (objective?.value && objective.source !== "Papel cadastrado") return firstSentence(objective.value);
  return data.description ? firstSentence(data.description) : null;
}

/** Texto preto em cor clara, branco em cor escura (ex.: TikTok #000) para o número da etapa ficar legível. */
function readableOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#000";
  const n = parseInt(m[1], 16);
  const luminance = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luminance > 0.55 ? "#000" : "#fff";
}

const openImage = (url: string, label: string) =>
  window.dispatchEvent(new CustomEvent("open-image-lightbox", { detail: { url, label } }));

export function MapNodeCard({ data, selected }: { data: MapNodeData; selected?: boolean }) {
  const preset = KIND_PRESETS[data.kind] || KIND_PRESETS.canal;
  const Icon = preset.icon;
  const checklist: ChecklistItem[] = data.checklist || [];
  const done = checklist.filter((c) => c.done).length;
  const total = checklist.length;
  const pendingItems = checklist.filter((c) => !c.done).slice(0, 2);
  const sizeCfg = SIZE_PRESETS[data.size || "M"] || SIZE_PRESETS.M;
  const isImageNode = data.kind === "imagem";
  // Etapas usam só a largura salva (altura pelo conteúdo); imagem usa largura e altura.
  const hasCustomWidth = !!data.width;
  const hasCustomSize = isImageNode && !!(data.width && data.height);
  const activeLens = data.activeLens || "all";
  const isLensMatch = matchesLens(data, activeLens);
  const isSimulated = !!data.isSimulatedActive;

  const agent = extractAgentData(data.notes, data);
  const status = agent.status_source !== "not_declared" ? STATUS_STYLE[agent.status] : STATUS_STYLE.not_declared;
  const group = executorGroup(data);
  const ExecIcon = EXECUTOR_ICON[group];
  const skill = agent.skill !== "none" ? agent.skill : null;
  const summary = isImageNode ? null : whatItDoes(data);
  const kpi = pickKpiForKind(data.kind, data.liveStats);

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-xl border bg-card shadow-md transition-all duration-200 hover:shadow-xl cursor-pointer overflow-hidden",
        selected && "ring-2 ring-primary/70",
        !isLensMatch && "opacity-20 grayscale pointer-events-none scale-95",
        isLensMatch && activeLens !== "all" && "ring-2 ring-primary shadow-[0_0_24px_hsl(var(--primary)/0.35)]",
        isSimulated && "ring-4 ring-warning scale-105 z-30 animate-pulse",
      )}
      style={hasCustomSize ? { width: "100%", height: "100%" } : hasCustomWidth ? { width: "100%" } : { minWidth: sizeCfg.min, maxWidth: sizeCfg.max }}
    >
      {/* Faixa de cor do tipo da etapa */}
      <div className="h-1 w-full shrink-0" style={{ background: data.color }} />

      {isSimulated && (
        <div className="absolute -top-0.5 left-1/2 z-20 -translate-x-1/2 flex items-center gap-1 rounded-b-md bg-warning px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-black">
          <Flame className="h-3 w-3" /> Lead aqui agora
        </div>
      )}

      <NodeResizer
        isVisible={selected}
        minWidth={180}
        minHeight={80}
        lineClassName="!border-primary/70 !border-2"
        handleClassName="!w-3 !h-3 !rounded-sm !bg-primary !border-2 !border-background"
      />
      {/* Conectores nos 4 lados: alvo invisível embaixo (recebe), origem por cima (arrasta). */}
      {[Position.Top, Position.Right, Position.Bottom, Position.Left].map((pos) => {
        const base: React.CSSProperties = {
          width: 14, height: 14, background: data.color, border: "2px solid hsl(var(--background))",
          borderRadius: 999, opacity: 0.85, transition: "opacity 120ms, transform 120ms", pointerEvents: "auto",
        };
        return (
          <div key={`h-${pos}`}>
            <Handle id={`${pos}-t`} type="target" position={pos} isConnectableStart={false}
              style={{ ...base, zIndex: 10, background: "transparent", border: "none", opacity: 0 }} />
            <Handle id={`${pos}-s`} type="source" position={pos} style={{ ...base, zIndex: 11 }}
              className="opacity-0 group-hover:!opacity-100 hover:!scale-125" title="Arraste para conectar" />
          </div>
        );
      })}

      {/* Ações rápidas no hover */}
      <div className="nodrag absolute right-1.5 top-2 z-10 flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        <button
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            const product = (data.notes || "").match(/\[product_name:([^\]]+)\]/)?.[1] || "";
            navigator.clipboard.writeText(agent.prompt || `Ação: ${data.label}\nDescrição: ${data.description || ""}${product ? `\nProduto: ${product}` : ""}`);
            toast.success("Prompt da etapa copiado");
          }}
          title="Copiar o prompt da etapa para uma IA"
        >
          <Bot className="h-3.5 w-3.5" />
        </button>
        <button className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={(e) => { e.stopPropagation(); data.onGenerateCopy?.(data.id); }} title="Gerar copy com IA">
          <Sparkles className="h-3.5 w-3.5" />
        </button>
        <button className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={(e) => { e.stopPropagation(); data.onDuplicate?.(data.id); }} title="Duplicar">
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button className="rounded p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); data.onDelete?.(data.id); }} title="Excluir">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className={cn("flex flex-1 flex-col gap-2 p-3", hasCustomSize && "min-h-0")}>
        {/* Cabeçalho: número, tipo, status */}
        <div className="flex items-center gap-2 pr-1">
          {data.stepNumber ? (
            <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 font-mono text-xs font-bold" style={{ background: data.color, color: readableOn(data.color) }}>
              {data.stepNumber}
            </span>
          ) : null}
          <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: data.color }} />
            <span className="truncate">{preset.label}</span>
          </span>
          {!isImageNode && (
            <span className={cn("ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium", status.cls)}
              title="Status declarado na etapa; checklist e print não provam que está funcionando.">
              {status.label}
            </span>
          )}
        </div>

        {/* Título e papel */}
        <div>
          <p className="text-[15px] font-semibold leading-snug text-foreground">{data.label}</p>
          {data.stage_role && <p className="mt-0.5 text-xs text-primary">{data.stage_role}</p>}
        </div>

        {/* Print da página / imagem */}
        {data.image_url && (
          <button
            type="button"
            className={cn("nodrag relative overflow-hidden rounded-md border border-border bg-muted/40 text-left", isImageNode && hasCustomSize ? "flex-1 min-h-0" : "shrink-0")}
            onClick={(e) => { e.stopPropagation(); openImage(data.image_url!, data.label); }}
            title="Ampliar"
          >
            <img
              src={data.image_url}
              alt={`Print de ${data.label}`}
              draggable={false}
              loading="lazy"
              className={cn("w-full object-cover object-top", isImageNode ? (hasCustomSize ? "h-full" : "max-h-64") : "aspect-[16/10]")}
            />
            {!isImageNode && (
              <span className="absolute bottom-1 right-1 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                <ImageIcon className="h-3 w-3" /> print
              </span>
            )}
          </button>
        )}

        {summary && <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{summary}</p>}

        {/* Quem executa */}
        {!isImageNode && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <ExecIcon className="h-3.5 w-3.5 text-muted-foreground" /> {EXECUTOR_LABEL[group]}
            </span>
            {skill && <span className="truncate rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground" title={`Skill: ${skill}`}>{skill}</span>}
            {agent.output_url && (
              <a href={agent.output_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                className="nodrag inline-flex items-center gap-1 text-[11px] text-success hover:underline">
                <ExternalLink className="h-3 w-3" /> entregável
              </a>
            )}
          </div>
        )}

        {/* Dono e prazo */}
        {!isImageNode && (data.owner_member_id || data.due_date) && (
          <StepOwnerChips ownerId={data.owner_member_id} due={data.due_date} status={agent.status} />
        )}

        {/* Checklist: progresso e o que falta */}
        {total > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-success transition-all" style={{ width: `${Math.round((done / total) * 100)}%` }} />
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">{done}/{total}</span>
            </div>
            {pendingItems.length > 0 && (
              <div className="nodrag space-y-0.5">
                {pendingItems.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-start gap-1.5 rounded px-0.5 py-0.5 text-xs leading-snug hover:bg-muted/60" onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={c.done} className="mt-0.5 h-3.5 w-3.5" onCheckedChange={(v) => data.onToggleItem?.(data.id, c.id, !!v)} />
                    <span>{c.text || "—"}</span>
                  </label>
                ))}
                {total - done > pendingItems.length && (
                  <p className="pl-5 text-[11px] text-muted-foreground">+{total - done - pendingItems.length} pendente(s)</p>
                )}
              </div>
            )}
          </div>
        )}

        {data.waInfo && (
          <div className="flex items-center justify-between gap-2 border-t border-border pt-2 text-xs">
            <span className="flex min-w-0 items-center gap-1 text-success">
              <Phone className="h-3 w-3 shrink-0" /> <span className="truncate">{data.waInfo.phone || data.waInfo.instance || data.waInfo.provider}</span>
            </span>
            {typeof data.waInfo.conversations === "number" && <span className="shrink-0 text-muted-foreground">{data.waInfo.conversations} conversas</span>}
          </div>
        )}

        {kpi && (
          <div className="flex items-center justify-between border-t border-border pt-2 text-xs">
            <span className={cn("flex items-center gap-1 font-medium",
              kpi.tone === "good" ? "text-success" : kpi.tone === "warn" ? "text-warning" : kpi.tone === "bad" ? "text-destructive" : "text-muted-foreground")}>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" /> {kpi.primary}
            </span>
            <span className="text-muted-foreground">{kpi.secondary}</span>
          </div>
        )}

        {data.url && (
          <a href={data.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
            className="nodrag mt-auto inline-flex max-w-full items-center gap-1 truncate text-[11px] text-primary hover:underline">
            <ExternalLink className="h-3 w-3 shrink-0" /> <span className="truncate">{data.url.replace(/^https?:\/\//, "")}</span>
          </a>
        )}
      </div>
    </div>
  );
}

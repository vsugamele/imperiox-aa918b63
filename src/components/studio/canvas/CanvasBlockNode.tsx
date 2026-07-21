import { Handle, Position, NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { CANVAS_BLOCKS } from "./blockTypes";
import { KIND_COLORS } from "@/lib/studioAutoLayout";
import { Loader2, CheckCircle2, AlertCircle, Sparkles, X, Film, Mic, Send, ImagePlus } from "lucide-react";

export function CanvasBlockNode({ data, selected }: NodeProps) {
  const d = data as any;
  const meta = CANVAS_BLOCKS.find(b => b.id === d.tipo);
  const isProduct = d.tipo === "product";
  const isMedia = d.tipo === "media";
  const status = d.status || "pendente";
  const output = d.output || {};
  const preview = output.url || output.image_url || output.video_url || output.audio_url || (isMedia ? d.config?.url : undefined);
  const previewKind = output.kind || (isMedia ? d.config?.kind : undefined);

  const kindColor = KIND_COLORS[d.tipo] || "#c9922a";

  if (isProduct) {
    return (
      <div className={cn(
        "rounded-xl border-2 border-primary bg-gradient-to-br from-primary/20 to-primary/5 px-4 py-3 min-w-[200px] text-center shadow-lg shadow-primary/20",
        selected && "ring-2 ring-primary"
      )}>
        <Handle type="source" position={Position.Right} style={{ background: kindColor, width: 10, height: 10 }} />
        <div className="text-2xl mb-1">🎯</div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Produto</div>
        <div className="font-display text-base font-bold text-primary">{d.titulo || "Sem produto"}</div>
      </div>
    );
  }

  const hasMedia = !!preview && (previewKind === "image" || previewKind === "video" || isMedia);

  const refCount = (d.config?.reference_urls || []).length;

  return (
    <div className={cn(
      "group/node relative rounded-lg border-2 p-2.5 min-w-[180px] max-w-[220px] bg-[#0a0608]/95 backdrop-blur transition",
      meta?.color || "border-border/60 bg-background/60",
      selected && "ring-2 ring-primary shadow-lg shadow-primary/20",
      status === "gerando" && "animate-pulse ring-2 ring-blue-400/60 shadow-lg shadow-blue-400/30",
      status === "erro" && "ring-1 ring-rose-500/60",
    )}>
      {!isMedia && <Handle type="target" position={Position.Left} style={{ background: kindColor, width: 10, height: 10 }} />}
      <Handle type="source" position={Position.Right} style={{ background: kindColor, width: 10, height: 10 }} />

      <button
        onClick={(e) => { e.stopPropagation(); d.onDelete?.(d.id); }}
        className="absolute -top-2 -right-2 z-10 opacity-0 group-hover/node:opacity-100 transition bg-rose-500 hover:bg-rose-600 text-white rounded-full p-0.5 shadow-lg"
        title="Remover bloco"
      >
        <X className="h-3 w-3" />
      </button>

      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-base">{meta?.icon}</span>
        <span className="text-xs font-semibold truncate flex-1">{d.titulo || meta?.label}</span>
        {status === "gerando" && <Loader2 className="h-3 w-3 animate-spin text-blue-400" />}
        {status === "gerado" && !isMedia && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
        {status === "erro" && <AlertCircle className="h-3 w-3 text-rose-400" />}
      </div>

      {isMedia && !preview && (
        <button
          onClick={(e) => { e.stopPropagation(); d.onOpenDrawer?.(d.id); }}
          className="w-full h-24 rounded border-2 border-dashed border-slate-500/40 flex flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground hover:border-primary/60 hover:text-primary transition mb-1"
        >
          <ImagePlus className="h-4 w-4" />
          Escolher mídia
        </button>
      )}

      {preview && (previewKind === "image" || (isMedia && previewKind !== "video")) && (
        <img src={preview} alt="" className="w-full h-24 object-cover rounded mb-1" />
      )}
      {preview && previewKind === "video" && (
        <video src={preview} className="w-full h-24 object-cover rounded mb-1" muted />
      )}
      {preview && previewKind === "audio" && (
        <div className="text-[10px] text-emerald-400 mb-1 truncate">🎵 áudio pronto</div>
      )}

      {d.tipo === "modeling" && (d.config?.ficha_snapshot || output.ficha) && (
        <div className="text-[10px] text-fuchsia-300/90 mb-1 line-clamp-2 leading-tight">
          {(output.ficha || d.config?.ficha_snapshot)?.estilo_visual || "ficha carregada"}
        </div>
      )}

      {d.tipo === "storyboard" && (
        <div className="text-[10px] text-cyan-300/90 mb-1 line-clamp-2 leading-tight">
          🎞️ {output.ficha?.storyboard?.length || 0} cenas · alvo: {d.config?.target_kind || "image"}
        </div>
      )}

      <div className="text-[10px] text-muted-foreground truncate">
        {d.tipo === "modeling"
          ? (d.config?.model_id ? "modelagem vinculada" : "escolha uma modelagem")
          : d.tipo === "storyboard"
          ? (d.config?.model_id ? "abra p/ explodir cenas" : "escolha uma modelagem")
          : (d.config?.model || d.config?.prompt?.slice(0, 40) || meta?.desc)}
      </div>
      {refCount > 0 && (
        <div className="text-[9px] text-primary/80 mt-0.5">🖼 {refCount} ref{refCount > 1 ? "s" : ""}</div>
      )}

      <div className="flex items-center justify-between mt-1.5">
        <span className={cn(
          "text-[9px] px-1.5 py-0.5 rounded border font-semibold uppercase",
          status === "gerado" && "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
          status === "gerando" && "bg-blue-500/15 text-blue-300 border-blue-500/40",
          status === "erro" && "bg-rose-500/15 text-rose-300 border-rose-500/40",
          status === "pendente" && "bg-muted/30 text-muted-foreground border-muted-foreground/30",
        )}>{status}</span>
        {status === "pendente" && !isMedia && d.tipo !== "modeling" && d.tipo !== "storyboard" && d.tipo !== "prompt" && d.tipo !== "publish" && (
          <button
            onClick={(e) => { e.stopPropagation(); d.onGenerate?.(d.id); }}
            className="text-[9px] text-primary hover:underline flex items-center gap-0.5"
          >
            <Sparkles className="h-2.5 w-2.5" /> gerar
          </button>
        )}
      </div>

      {hasMedia && (previewKind === "image" || previewKind === "video" || isMedia) && (
        <div className="opacity-0 group-hover/node:opacity-100 transition flex gap-1 mt-1.5 pt-1.5 border-t border-border/40">
          {(previewKind === "image" || (isMedia && previewKind !== "video")) && (
            <button
              onClick={(e) => { e.stopPropagation(); d.onSpawnDownstream?.(d.id, "video"); }}
              className="flex-1 text-[9px] px-1 py-1 rounded bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 flex items-center justify-center gap-0.5"
              title="Animar em vídeo"
            >
              <Film className="h-2.5 w-2.5" /> animar
            </button>
          )}
          {(previewKind === "image" || (isMedia && previewKind !== "video")) && (
            <button
              onClick={(e) => { e.stopPropagation(); d.onSpawnDownstream?.(d.id, "avatar"); }}
              className="flex-1 text-[9px] px-1 py-1 rounded bg-violet-500/15 hover:bg-violet-500/30 text-violet-300 border border-violet-500/40 flex items-center justify-center gap-0.5"
              title="Avatar falante"
            >
              <Mic className="h-2.5 w-2.5" /> falar
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); d.onSpawnDownstream?.(d.id, "publish"); }}
            className="flex-1 text-[9px] px-1 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 flex items-center justify-center gap-0.5"
            title="Publicar/salvar"
          >
            <Send className="h-2.5 w-2.5" /> publicar
          </button>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ZoomIn, ZoomOut, Maximize2, X, ImagePlus, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import type { FlowBlueprint, FlowBlock, FlowNode } from "@/lib/typebot-parser";

const NODE_W = 280;
const HEADER_H = 36;

interface Props {
  blueprintId: string;
  onClose: () => void;
}

const BLOCK_LABEL: Record<string, string> = {
  text: "💬 Texto",
  image: "🖼️ Imagem",
  video: "🎬 Vídeo",
  input_text: "📝 Input",
  input_email: "✉️ E-mail",
  input_phone: "📞 Telefone",
  input_number: "🔢 Número",
  input_choice: "☑️ Escolha",
  condition: "🔀 Condição",
  set_variable: "🧮 Variável",
  wait: "⏱️ Espera",
  redirect: "🔗 Redirect",
  webhook: "🌐 Webhook",
  code: "⚙️ Código",
  ai_prompt: "✨ IA",
  unknown: "❓",
};

export function FlowBlueprintCanvas({ blueprintId, onClose }: Props) {
  const [blueprint, setBlueprint] = useState<FlowBlueprint | null>(null);
  const [title, setTitle] = useState("");
  const [zoom, setZoom] = useState(0.8);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState<{ x: number; y: number } | null>(null);
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [editing, setEditing] = useState<{ nodeId: string; blockId: string } | null>(null);
  const [regenLoading, setRegenLoading] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("imphq_flow_blueprints").select("*").eq("id", blueprintId).maybeSingle();
      if (data) {
        setBlueprint(data.blueprint as any);
        setTitle(data.title);
      }
    })();

    const channel = supabase
      .channel(`flow-jobs-${blueprintId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "imphq_flow_image_jobs", filter: `blueprint_id=eq.${blueprintId}` },
        async () => {
          const { data } = await supabase.from("imphq_flow_blueprints").select("blueprint").eq("id", blueprintId).maybeSingle();
          if (data) setBlueprint(data.blueprint as any);
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [blueprintId]);

  const persist = async (next: FlowBlueprint) => {
    setBlueprint(next);
    await supabase.from("imphq_flow_blueprints").update({ blueprint: next as any, title }).eq("id", blueprintId);
  };

  const updateBlock = async (nodeId: string, blockId: string, patch: Partial<FlowBlock>) => {
    if (!blueprint) return;
    const next: FlowBlueprint = {
      ...blueprint,
      nodes: blueprint.nodes.map(n => n.id === nodeId
        ? { ...n, blocks: n.blocks.map(b => b.id === blockId ? { ...b, ...patch } : b) }
        : n),
    };
    await persist(next);
  };

  const regenImage = async (nodeId: string, block: FlowBlock) => {
    if (!block.image_prompt) {
      toast.error("Defina um image_prompt antes.");
      return;
    }
    setRegenLoading(block.id);
    const { data: job } = await supabase.from("imphq_flow_image_jobs")
      .insert({ blueprint_id: blueprintId, block_id: block.id, prompt: block.image_prompt })
      .select().single();
    if (job) {
      supabase.functions.invoke("flow-image-worker", { body: { job_id: job.id } }).catch(() => {});
      toast.success("Gerando imagem...");
    }
    setTimeout(() => setRegenLoading(null), 8000);
  };

  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-node]")) return;
    setPanning({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (panning) setPan({ x: e.clientX - panning.x, y: e.clientY - panning.y });
    if (dragNodeId && blueprint) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = (e.clientX - rect.left - pan.x) / zoom - dragOffset.current.x;
      const y = (e.clientY - rect.top - pan.y) / zoom - dragOffset.current.y;
      setBlueprint({
        ...blueprint,
        nodes: blueprint.nodes.map(n => n.id === dragNodeId ? { ...n, x: Math.round(x), y: Math.round(y) } : n),
      });
    }
  };
  const onMouseUp = async () => {
    setPanning(null);
    if (dragNodeId && blueprint) {
      await supabase.from("imphq_flow_blueprints").update({ blueprint: blueprint as any }).eq("id", blueprintId);
    }
    setDragNodeId(null);
  };

  const startNodeDrag = (e: React.MouseEvent, n: FlowNode) => {
    if ((e.target as HTMLElement).closest("[data-block-click]")) return;
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;
    dragOffset.current = { x: x - n.x, y: y - n.y };
    setDragNodeId(n.id);
  };

  const editingBlock = useMemo(() => {
    if (!editing || !blueprint) return null;
    const n = blueprint.nodes.find(x => x.id === editing.nodeId);
    return n?.blocks.find(b => b.id === editing.blockId) || null;
  }, [editing, blueprint]);

  if (!blueprint) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="fixed inset-0 z-50 bg-[#080607]">
      <div data-ui className="absolute top-3 left-3 right-3 z-30 flex items-center gap-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)}
          onBlur={() => supabase.from("imphq_flow_blueprints").update({ title }).eq("id", blueprintId)}
          className="w-[340px] h-8 text-xs bg-[#0a0608] border-border/60" />
        <Badge variant="outline" className="text-[10px]">{blueprint.nodes.length} nodes</Badge>
        <div className="ml-auto flex items-center gap-1 bg-[#0a0608]/90 border border-border/60 rounded-md p-0.5">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(z => Math.max(0.3, z - 0.1))}><ZoomOut className="h-3.5 w-3.5" /></Button>
          <span className="text-[10px] text-muted-foreground w-9 text-center">{Math.round(zoom * 100)}%</span>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(z => Math.min(2, z + 0.1))}><ZoomIn className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setZoom(0.8); setPan({ x: 0, y: 0 }); }}><Maximize2 className="h-3.5 w-3.5" /></Button>
        </div>
        <Button size="sm" variant="outline" className="h-8" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>

      <div
        ref={canvasRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "20px 20px" }}
        onMouseDown={onCanvasMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <div className="absolute origin-top-left" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, width: 6000, height: 4000 }}>
          <svg className="absolute inset-0 pointer-events-none" width="6000" height="4000">
            {blueprint.edges.map(e => {
              const from = blueprint.nodes.find(n => n.id === e.from);
              const to = blueprint.nodes.find(n => n.id === e.to);
              if (!from || !to) return null;
              const sx = from.x + NODE_W, sy = from.y + 60;
              const tx = to.x, ty = to.y + 60;
              const mx = (sx + tx) / 2;
              return (
                <g key={e.id}>
                  <path d={`M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`}
                    stroke="rgb(236 72 153 / 0.5)" strokeWidth="2" fill="none" />
                  <circle cx={sx} cy={sy} r="3" fill="rgb(236 72 153)" />
                  <circle cx={tx} cy={ty} r="3" fill="rgb(236 72 153)" />
                </g>
              );
            })}
          </svg>

          {blueprint.nodes.map(n => (
            <div key={n.id} data-node
              className="absolute rounded-lg bg-[#0e0a0c] border border-border/60 shadow-xl cursor-move select-none"
              style={{ left: n.x, top: n.y, width: NODE_W }}
              onMouseDown={(e) => startNodeDrag(e, n)}
            >
              <div className="px-3 py-2 border-b border-border/40 text-xs font-semibold text-pink-200 flex items-center justify-between" style={{ height: HEADER_H }}>
                <span className="truncate">{n.title}</span>
                {n.id === blueprint.start_node_id && <Badge className="h-4 text-[9px] bg-emerald-500/20 text-emerald-300 border-emerald-500/40">START</Badge>}
              </div>
              <div className="p-2 space-y-1">
                {n.blocks.map(b => (
                  <button
                    key={b.id}
                    data-block-click
                    onClick={(e) => { e.stopPropagation(); setEditing({ nodeId: n.id, blockId: b.id }); }}
                    className="w-full text-left rounded-md bg-secondary/40 hover:bg-pink-500/10 transition-colors p-2 group"
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
                      <span>{BLOCK_LABEL[b.type] || b.type}</span>
                    </div>
                    {b.type === "image" && (
                      <div className="relative">
                        {b.image_url ? (
                          <img src={b.image_url} className="w-full h-24 object-cover rounded" alt="" />
                        ) : (
                          <div className="w-full h-24 rounded bg-secondary/60 flex items-center justify-center text-[10px] text-muted-foreground">
                            {regenLoading === b.id ? <Loader2 className="h-4 w-4 animate-spin" /> : (b.image_prompt ? "Gerando…" : "Sem imagem")}
                          </div>
                        )}
                        <span
                          role="button"
                          onClick={(e) => { e.stopPropagation(); regenImage(n.id, b); }}
                          className="absolute top-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded bg-black/60 hover:bg-pink-600 cursor-pointer"
                        >
                          <RefreshCw className="h-3 w-3" />
                        </span>
                      </div>
                    )}
                    {b.type === "input_choice" && (
                      <div className="space-y-1">
                        {b.text && <p className="text-[11px] text-foreground/90 line-clamp-2">{b.text}</p>}
                        <div className="flex flex-wrap gap-1">
                          {(b.options || []).slice(0, 4).map((o, i) => (
                            <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-pink-500/10 text-pink-200 border border-pink-500/30">{o}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {b.type !== "image" && b.type !== "input_choice" && (
                      <p className="text-[11px] text-foreground/80 line-clamp-3">
                        {b.text || b.expression || b.url || b.image_prompt || <span className="italic text-muted-foreground">vazio</span>}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent side="right" className="bg-[#0a0608] border-border/60 w-[480px]">
          <SheetHeader>
            <SheetTitle className="text-pink-200">Editar bloco</SheetTitle>
          </SheetHeader>
          {editingBlock && editing && (
            <div className="mt-4 space-y-3">
              <div>
                <Label className="text-xs">Tipo</Label>
                <p className="text-sm">{BLOCK_LABEL[editingBlock.type]}</p>
              </div>
              {("text" in editingBlock || ["text","input_text","input_email","input_phone","input_number","input_choice","ai_prompt"].includes(editingBlock.type)) && (
                <div>
                  <Label className="text-xs">Texto</Label>
                  <Textarea
                    value={editingBlock.text || ""}
                    onChange={(e) => updateBlock(editing.nodeId, editing.blockId, { text: e.target.value })}
                    rows={6}
                  />
                </div>
              )}
              {editingBlock.type === "input_choice" && (
                <div>
                  <Label className="text-xs">Opções (uma por linha)</Label>
                  <Textarea
                    value={(editingBlock.options || []).join("\n")}
                    onChange={(e) => updateBlock(editing.nodeId, editing.blockId, { options: e.target.value.split("\n").filter(Boolean) })}
                    rows={5}
                  />
                </div>
              )}
              {editingBlock.type === "image" && (
                <>
                  <div>
                    <Label className="text-xs">URL da imagem</Label>
                    <Input value={editingBlock.image_url || ""} onChange={(e) => updateBlock(editing.nodeId, editing.blockId, { image_url: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Prompt para IA (gpt-image-2)</Label>
                    <Textarea
                      value={editingBlock.image_prompt || ""}
                      onChange={(e) => updateBlock(editing.nodeId, editing.blockId, { image_prompt: e.target.value })}
                      rows={4}
                    />
                  </div>
                  <Button size="sm" onClick={() => regenImage(editing.nodeId, editingBlock)} className="gap-1.5">
                    <ImagePlus className="h-3.5 w-3.5" /> Gerar/regenerar imagem
                  </Button>
                </>
              )}
              {editingBlock.type === "redirect" && (
                <div>
                  <Label className="text-xs">URL</Label>
                  <Input value={editingBlock.url || ""} onChange={(e) => updateBlock(editing.nodeId, editing.blockId, { url: e.target.value })} />
                </div>
              )}
              {editingBlock.type === "set_variable" && (
                <>
                  <div><Label className="text-xs">Variável</Label><Input value={editingBlock.variable || ""} onChange={(e) => updateBlock(editing.nodeId, editing.blockId, { variable: e.target.value })} /></div>
                  <div><Label className="text-xs">Expressão</Label><Textarea value={editingBlock.expression || ""} onChange={(e) => updateBlock(editing.nodeId, editing.blockId, { expression: e.target.value })} rows={3} /></div>
                </>
              )}
              {editingBlock.type === "wait" && (
                <div>
                  <Label className="text-xs">Segundos</Label>
                  <Input type="number" value={editingBlock.seconds || 0} onChange={(e) => updateBlock(editing.nodeId, editing.blockId, { seconds: Number(e.target.value) })} />
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

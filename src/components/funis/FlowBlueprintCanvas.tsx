import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ZoomIn, ZoomOut, Maximize2, X, ImagePlus, Loader2, RefreshCw, Sparkles, FlaskConical, Images, Library, Upload } from "lucide-react";
import { ReferenciasPicker } from "./ReferenciasPicker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import type { FlowBlueprint, FlowBlock, FlowNode } from "@/lib/typebot-parser";
import { FlowLiveControl, NodeStatsBadge, type NodeStat } from "./FlowLiveOverlay";
import { FlowVariantsPanel } from "./FlowVariantsPanel";
import { GeneratedImagesPanel } from "./GeneratedImagesPanel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ImageTipo = "mockup_pagina" | "mensagem_autoridade" | "icone";
const TIPO_LABEL: Record<ImageTipo, string> = {
  mockup_pagina: "🖥️ Mockup de página (LP/VSL/checkout)",
  mensagem_autoridade: "💎 Mensagem de autoridade (WhatsApp)",
  icone: "✨ Ícone/ilustração do passo",
};

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
  const [nodeStats, setNodeStats] = useState<Record<string, NodeStat>>({});
  const [variantsNode, setVariantsNode] = useState<{ id: string; title: string; copy: string } | null>(null);
  const [ctxTipo, setCtxTipo] = useState<ImageTipo>("mockup_pagina");
  const [ctxExtra, setCtxExtra] = useState("");
  const [ctxRefUrl, setCtxRefUrl] = useState("");
  const [ctxLoading, setCtxLoading] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [refPickerMode, setRefPickerMode] = useState<null | "image_url" | "context">(null);
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

  const genWithContext = async (blockId: string) => {
    setCtxLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("flow-image-context", {
        body: { blueprint_id: blueprintId, block_id: blockId, tipo: ctxTipo, extra: ctxExtra, reference_url: ctxRefUrl || undefined },
      });
      if (error) throw error;
      toast.success("Imagem gerada com contexto!");
      const { data: bp } = await supabase.from("imphq_flow_blueprints").select("blueprint").eq("id", blueprintId).maybeSingle();
      if (bp) setBlueprint(bp.blueprint as any);
      setCtxExtra(""); setCtxRefUrl("");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar");
    } finally {
      setCtxLoading(false);
    }
  };

  const uploadRef = async (file: File) => {
    const path = `refs/${blueprintId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("flow-media").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); return; }
    const { data: signed } = await supabase.storage.from("flow-media").createSignedUrl(path, 60 * 60 * 24 * 7);
    if (signed?.signedUrl) { setCtxRefUrl(signed.signedUrl); toast.success("Referência anexada"); }
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
        <FlowLiveControl blueprintId={blueprintId} onStatsChange={setNodeStats} />
        <div className="ml-auto flex items-center gap-1 bg-[#0a0608]/90 border border-border/60 rounded-md p-0.5">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(z => Math.max(0.3, z - 0.1))}><ZoomOut className="h-3.5 w-3.5" /></Button>
          <span className="text-[10px] text-muted-foreground w-9 text-center">{Math.round(zoom * 100)}%</span>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(z => Math.min(2, z + 0.1))}><ZoomIn className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setZoom(0.8); setPan({ x: 0, y: 0 }); }}><Maximize2 className="h-3.5 w-3.5" /></Button>
        </div>
        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setGalleryOpen(true)}>
          <Images className="h-3.5 w-3.5" /> Imagens
        </Button>
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
              <NodeStatsBadge stat={nodeStats[n.id]} />
              <div className="px-3 py-2 border-b border-border/40 text-xs font-semibold text-pink-200 flex items-center justify-between gap-1" style={{ height: HEADER_H }}>
                <span className="truncate">{n.title}</span>
                <div className="flex items-center gap-1">
                  {(() => {
                    const skillLog = ((blueprint as any).meta?.skill_log || []) as Array<{ node_id: string; skill: string; label: string; before: string; after: string }>;
                    const applied = skillLog.filter(s => s.node_id === n.id);
                    if (!applied.length) return null;
                    return (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-0.5 rounded bg-amber-500/20 px-1 py-0.5 text-[9px] text-amber-200 border border-amber-500/40 hover:bg-amber-500/30">
                            <Sparkles className="h-2.5 w-2.5" /> {applied.length}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent side="right" className="w-80 bg-secondary/95 border-border/60 text-xs leading-6 space-y-3">
                          <p className="font-semibold text-amber-300">💡 Skills aplicadas neste node</p>
                          {applied.map((s, i) => (
                            <div key={i} className="space-y-1 border-l-2 border-amber-500/40 pl-2">
                              <p className="text-[11px] font-semibold text-foreground">{s.label}</p>
                              <p className="text-[10px] text-muted-foreground"><span className="text-rose-300">antes:</span> {s.before}…</p>
                              <p className="text-[10px] text-muted-foreground"><span className="text-emerald-300">depois:</span> {s.after}…</p>
                            </div>
                          ))}
                        </PopoverContent>
                      </Popover>
                    );
                  })()}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const firstText = n.blocks.find(b => typeof b.text === "string" && b.text.length > 0);
                      setVariantsNode({ id: n.id, title: n.title, copy: firstText?.text || "" });
                    }}
                    className="inline-flex items-center gap-0.5 rounded bg-sky-500/20 px-1 py-0.5 text-[9px] text-sky-200 border border-sky-500/40 hover:bg-sky-500/30"
                    title="Testar variantes A/B"
                  >
                    <FlaskConical className="h-2.5 w-2.5" /> A/B
                  </button>
                  {n.id === blueprint.start_node_id && <Badge className="h-4 text-[9px] bg-emerald-500/20 text-emerald-300 border-emerald-500/40">START</Badge>}
                </div>
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
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => regenImage(editing.nodeId, editingBlock)} className="gap-1.5 flex-1" variant="outline">
                      <ImagePlus className="h-3.5 w-3.5" /> Gerar do prompt cru
                    </Button>
                    <Button size="sm" onClick={() => setRefPickerMode("image_url")} className="gap-1.5 flex-1" variant="outline">
                      <Library className="h-3.5 w-3.5" /> Da biblioteca
                    </Button>
                  </div>

                  <div className="mt-4 rounded-md border border-pink-500/30 bg-pink-500/5 p-3 space-y-2">
                    <p className="text-xs font-semibold text-pink-200 flex items-center gap-1"><Sparkles className="h-3 w-3" /> Gerar com contexto do funil</p>
                    <p className="text-[10px] text-muted-foreground">Usa branding, avatar e sites de referência vinculados ao projeto.</p>
                    <div>
                      <Label className="text-[10px]">Tipo</Label>
                      <Select value={ctxTipo} onValueChange={(v) => setCtxTipo(v as ImageTipo)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(TIPO_LABEL) as ImageTipo[]).map(k => (
                            <SelectItem key={k} value={k} className="text-xs">{TIPO_LABEL[k]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px]">Instruções extras (opcional)</Label>
                      <Textarea value={ctxExtra} onChange={(e) => setCtxExtra(e.target.value)} rows={2} placeholder="ex: destaque o depoimento da Maria, paleta mais escura..." className="text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px]">Imagem de referência (opcional)</Label>
                      <div className="flex gap-2 mt-1">
                        <label className="flex-1 cursor-pointer">
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadRef(f); }} />
                          <div className="h-8 flex items-center justify-center gap-1.5 text-xs border border-border/60 rounded-md hover:border-pink-500/60 hover:bg-pink-500/5">
                            <Upload className="h-3 w-3" /> Upload
                          </div>
                        </label>
                        <button
                          type="button"
                          onClick={() => setRefPickerMode("context")}
                          className="flex-1 h-8 flex items-center justify-center gap-1.5 text-xs border border-border/60 rounded-md hover:border-pink-500/60 hover:bg-pink-500/5"
                        >
                          <Library className="h-3 w-3" /> Da biblioteca
                        </button>
                      </div>
                      {ctxRefUrl && <p className="text-[10px] text-emerald-300 mt-1 truncate">✓ {ctxRefUrl.split("/").pop()}</p>}
                    </div>
                    <Button size="sm" onClick={() => genWithContext(editing.blockId)} disabled={ctxLoading} className="w-full gap-1.5 bg-pink-600 hover:bg-pink-700">
                      {ctxLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      Gerar com contexto
                    </Button>
                  </div>
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

      {variantsNode && (
        <FlowVariantsPanel
          open={!!variantsNode}
          onClose={() => setVariantsNode(null)}
          blueprintId={blueprintId}
          nodeId={variantsNode.id}
          nodeTitle={variantsNode.title}
          originalCopy={variantsNode.copy}
        />
      )}

      <GeneratedImagesPanel
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        blueprintId={blueprintId}
        blueprint={blueprint}
      />

      <ReferenciasPicker
        open={!!refPickerMode}
        onClose={() => setRefPickerMode(null)}
        onSelect={(url) => {
          if (refPickerMode === "image_url" && editing) {
            updateBlock(editing.nodeId, editing.blockId, { image_url: url });
            toast.success("Imagem da biblioteca aplicada");
          } else if (refPickerMode === "context") {
            setCtxRefUrl(url);
            toast.success("Referência anexada");
          }
        }}
      />
    </div>
  );
}

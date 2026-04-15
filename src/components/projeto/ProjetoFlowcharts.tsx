import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Plus, Trash2, ZoomIn, ZoomOut, Save, GripVertical, X, ArrowRight, ImageIcon, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { FlowMinimap } from "./flowchart/FlowMinimap";
import { FlowImportDialog } from "./flowchart/FlowImportDialog";

interface FlowNode {
  id: string;
  title: string;
  subtitle?: string;
  type: "etapa" | "decisao" | "resultado" | "nota" | "imagem";
  image_url?: string;
  color: string;
  pos_x: number;
  pos_y: number;
  connects_to?: string[];
}

interface Flowchart {
  id: string;
  name: string;
  nodes: FlowNode[];
}

interface Props {
  project: any;
  onUpdateData: (data: any) => void;
}

const NODE_W = 220;
const NODE_H = 100;
const CANVAS_W = 4000;
const CANVAS_H = 3000;

const TYPE_STYLES: Record<string, { bg: string; border: string; label: string }> = {
  etapa:     { bg: "bg-blue-500/15", border: "border-blue-500/50", label: "Etapa" },
  decisao:   { bg: "bg-amber-500/15", border: "border-amber-500/50", label: "Decisão" },
  resultado: { bg: "bg-emerald-500/15", border: "border-emerald-500/50", label: "Resultado" },
  nota:      { bg: "bg-slate-500/15", border: "border-slate-500/50", label: "Nota" },
  imagem:    { bg: "bg-purple-500/15", border: "border-purple-500/50", label: "Imagem" },
};

const COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#64748b"];

export function ProjetoFlowcharts({ project, onUpdateData }: Props) {
  const data = project.data || {};
  const flowcharts: Flowchart[] = data.flowcharts || [];

  const [activeIdx, setActiveIdx] = useState<number | null>(flowcharts.length > 0 ? 0 : null);
  const [zoom, setZoom] = useState(0.8);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [connectLine, setConnectLine] = useState<{ x: number; y: number } | null>(null);
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const autoSaveRef = useRef<NodeJS.Timeout>();

  const active = activeIdx !== null ? flowcharts[activeIdx] : null;

  const persist = useCallback((updated: Flowchart[]) => {
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      onUpdateData({ ...data, flowcharts: updated });
    }, 800);
  }, [data, onUpdateData]);

  const updateActive = useCallback((chart: Flowchart) => {
    if (activeIdx === null) return;
    const updated = [...flowcharts];
    updated[activeIdx] = chart;
    persist(updated);
  }, [activeIdx, flowcharts, persist]);

  // --- CRUD flowcharts ---
  const addFlowchart = () => {
    const fc: Flowchart = { id: crypto.randomUUID(), name: "Novo Fluxograma", nodes: [] };
    const updated = [...flowcharts, fc];
    onUpdateData({ ...data, flowcharts: updated });
    setActiveIdx(updated.length - 1);
  };

  const deleteFlowchart = (idx: number) => {
    const updated = flowcharts.filter((_, i) => i !== idx);
    onUpdateData({ ...data, flowcharts: updated });
    setActiveIdx(updated.length > 0 ? Math.min(idx, updated.length - 1) : null);
  };

  const renameFlowchart = (idx: number, name: string) => {
    const updated = [...flowcharts];
    updated[idx] = { ...updated[idx], name };
    onUpdateData({ ...data, flowcharts: updated });
  };

  // --- Import nodes ---
  const importNodes = (newNodes: FlowNode[]) => {
    if (!active) return;
    const chart = { ...active, nodes: [...active.nodes, ...newNodes] };
    updateActive(chart);
  };

  // --- AI Generate ---
  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("openflow-ai", {
        body: { project_id: project.id, action: "generate_flowchart", description: aiPrompt, num_nodes: 10 },
      });
      if (fnError) throw fnError;
      const nodes: FlowNode[] = fnData?.nodes || [];
      if (nodes.length === 0) { toast.error("A IA não retornou nós."); return; }

      if (!active) {
        // Create new flowchart with the nodes
        const fc: Flowchart = { id: crypto.randomUUID(), name: aiPrompt.slice(0, 40), nodes };
        const updated = [...flowcharts, fc];
        onUpdateData({ ...data, flowcharts: updated });
        setActiveIdx(updated.length - 1);
      } else {
        updateActive({ ...active, nodes: [...active.nodes, ...nodes] });
      }
      toast.success(`${nodes.length} nós gerados com IA!`);
      setAiDialogOpen(false);
      setAiPrompt("");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao gerar fluxograma: " + (err.message || "Erro desconhecido"));
    } finally {
      setAiLoading(false);
    }
  };
  const addNode = (type: FlowNode["type"]) => {
    if (!active) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    const cx = rect ? (-pan.x + rect.width / 2) / zoom : 400;
    const cy = rect ? (-pan.y + rect.height / 2) / zoom : 200;
    const node: FlowNode = {
      id: crypto.randomUUID(),
      title: TYPE_STYLES[type].label,
      type,
      color: type === "etapa" ? "#3b82f6" : type === "decisao" ? "#f59e0b" : type === "resultado" ? "#10b981" : "#64748b",
      pos_x: Math.round(cx - NODE_W / 2 + Math.random() * 60),
      pos_y: Math.round(cy - NODE_H / 2 + Math.random() * 60),
    };
    const chart = { ...active, nodes: [...active.nodes, node] };
    updateActive(chart);
  };

  const removeNode = (nodeId: string) => {
    if (!active) return;
    const nodes = active.nodes.filter(n => n.id !== nodeId).map(n => ({
      ...n,
      connects_to: n.connects_to?.filter(id => id !== nodeId),
    }));
    updateActive({ ...active, nodes });
  };

  const updateNode = (nodeId: string, patch: Partial<FlowNode>) => {
    if (!active) return;
    const nodes = active.nodes.map(n => n.id === nodeId ? { ...n, ...patch } : n);
    updateActive({ ...active, nodes });
  };

  // --- Drag ---
  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    if ((e.target as HTMLElement).closest("input, textarea, button, .connect-dot")) return;
    e.stopPropagation();
    const node = active?.nodes.find(n => n.id === nodeId);
    if (!node) return;
    setDraggingId(nodeId);
    setDragOffset({ x: e.clientX / zoom - node.pos_x, y: e.clientY / zoom - node.pos_y });
  }, [active, zoom]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (connectingFrom && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setConnectLine({ x: (e.clientX - rect.left) / zoom - pan.x / zoom, y: (e.clientY - rect.top) / zoom - pan.y / zoom });
    }
    if (draggingId && active) {
      const nx = e.clientX / zoom - dragOffset.x;
      const ny = e.clientY / zoom - dragOffset.y;
      const nodes = active.nodes.map(n => n.id === draggingId ? { ...n, pos_x: Math.max(0, nx), pos_y: Math.max(0, ny) } : n);
      // Direct state update for smooth drag — persist on mouseUp
      if (activeIdx !== null) {
        const updated = [...flowcharts];
        updated[activeIdx] = { ...active, nodes };
        // We don't persist here for performance, just update local
      }
      updateActive({ ...active, nodes });
      return;
    }
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  }, [connectingFrom, draggingId, active, zoom, dragOffset, isPanning, panStart, activeIdx, flowcharts, updateActive]);

  const handleMouseUp = useCallback(() => {
    if (draggingId) setDraggingId(null);
    if (isPanning) setIsPanning(false);
    if (connectingFrom) { setConnectingFrom(null); setConnectLine(null); }
  }, [draggingId, isPanning, connectingFrom]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".flow-node")) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan]);

  // --- Connect ---
  const startConnect = (nodeId: string) => setConnectingFrom(nodeId);
  const endConnect = (toId: string) => {
    if (!connectingFrom || !active || connectingFrom === toId) { setConnectingFrom(null); setConnectLine(null); return; }
    const nodes = active.nodes.map(n => {
      if (n.id === connectingFrom) {
        const existing = n.connects_to || [];
        if (existing.includes(toId)) return n;
        return { ...n, connects_to: [...existing, toId] };
      }
      return n;
    });
    updateActive({ ...active, nodes });
    setConnectingFrom(null);
    setConnectLine(null);
    toast.success("Conexão criada");
  };

  const removeConnection = (fromId: string, toId: string) => {
    if (!active) return;
    const nodes = active.nodes.map(n => {
      if (n.id === fromId) {
        const ct = (n.connects_to || []).filter(id => id !== toId);
        return { ...n, connects_to: ct.length > 0 ? ct : undefined };
      }
      return n;
    });
    updateActive({ ...active, nodes });
  };

  // --- SVG Arrows ---
  const renderConnections = () => {
    if (!active) return null;
    const lines: JSX.Element[] = [];
    active.nodes.forEach(from => {
      (from.connects_to || []).forEach(toId => {
        const to = active.nodes.find(n => n.id === toId);
        if (!to) return;
        const x1 = from.pos_x + NODE_W;
        const y1 = from.pos_y + NODE_H / 2;
        const x2 = to.pos_x;
        const y2 = to.pos_y + NODE_H / 2;
        const mx = (x1 + x2) / 2;
        lines.push(
          <g key={`${from.id}-${toId}`} className="cursor-pointer" onClick={() => removeConnection(from.id, toId)}>
            <path d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} opacity={0.6} markerEnd="url(#arrowhead)" />
            <circle cx={mx} cy={(y1 + y2) / 2} r={6} fill="hsl(var(--destructive))" opacity={0} className="hover:opacity-100 transition-opacity" />
            <text x={mx} y={(y1 + y2) / 2 + 4} textAnchor="middle" fill="white" fontSize={8} opacity={0} className="hover:opacity-100">×</text>
          </g>
        );
      });
    });
    // Connection preview
    if (connectingFrom && connectLine) {
      const from = active.nodes.find(n => n.id === connectingFrom);
      if (from) {
        const x1 = from.pos_x + NODE_W;
        const y1 = from.pos_y + NODE_H / 2;
        lines.push(
          <line key="preview" x1={x1} y1={y1} x2={connectLine.x} y2={connectLine.y} stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="6,4" opacity={0.5} />
        );
      }
    }
    return lines;
  };

  return (
    <div className="space-y-4">
      {/* Flowchart selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {flowcharts.map((fc, i) => (
          <div key={fc.id} className="flex items-center gap-1">
            {editingNode === fc.id ? (
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onBlur={() => { renameFlowchart(i, newName); setEditingNode(null); }}
                onKeyDown={e => { if (e.key === "Enter") { renameFlowchart(i, newName); setEditingNode(null); } }}
                className="h-8 w-40 text-xs bg-secondary"
                autoFocus
              />
            ) : (
              <Badge
                variant={activeIdx === i ? "default" : "secondary"}
                className="cursor-pointer hover:opacity-80"
                onClick={() => setActiveIdx(i)}
                onDoubleClick={() => { setEditingNode(fc.id); setNewName(fc.name); }}
              >
                {fc.name}
              </Badge>
            )}
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => deleteFlowchart(i)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addFlowchart} className="h-8 gap-1">
          <Plus className="h-3 w-3" /> Novo Fluxograma
        </Button>
      </div>

      {active ? (
        <>
          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground mr-2">Adicionar:</span>
            {Object.entries(TYPE_STYLES).filter(([k]) => k !== "imagem").map(([key, s]) => (
              <Button key={key} variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => addNode(key as FlowNode["type"])}>
                <Plus className="h-3 w-3" /> {s.label}
              </Button>
            ))}
            <FlowImportDialog onImportNodes={importNodes} projectSlug={project.slug} />
            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.max(0.3, z - 0.1))}>
                <ZoomOut className="h-3 w-3" />
              </Button>
              <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.min(2, z + 0.1))}>
                <ZoomIn className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Canvas */}
          <div
            className="relative overflow-hidden rounded-lg border border-border bg-background"
            style={{ height: 520, cursor: isPanning ? "grabbing" : "grab" }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div
              ref={canvasRef}
              style={{ width: CANVAS_W, height: CANVAS_H, transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}
              className="absolute top-0 left-0"
            >
              {/* Grid dots */}
              <svg width={CANVAS_W} height={CANVAS_H} className="absolute inset-0 pointer-events-none">
                <defs>
                  <pattern id="flowGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <circle cx="1" cy="1" r="1" fill="hsl(var(--muted-foreground))" opacity="0.15" />
                  </pattern>
                  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--primary))" opacity="0.6" />
                  </marker>
                </defs>
                <rect width="100%" height="100%" fill="url(#flowGrid)" />
                {renderConnections()}
              </svg>

              {/* Nodes */}
              {active.nodes.map(node => {
                const style = TYPE_STYLES[node.type] || TYPE_STYLES.etapa;
                const isImage = node.type === "imagem";
                return (
                  <div
                    key={node.id}
                    className={`flow-node absolute rounded-lg border-2 ${style.bg} ${style.border} p-3 select-none`}
                    style={{ left: node.pos_x, top: node.pos_y, width: NODE_W, minHeight: NODE_H, borderLeftColor: node.color, borderLeftWidth: 4 }}
                    onMouseDown={e => handleNodeMouseDown(e, node.id)}
                    onMouseUp={() => { if (connectingFrom) endConnect(node.id); }}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex-1 min-w-0">
                        <Input
                          value={node.title}
                          onChange={e => updateNode(node.id, { title: e.target.value })}
                          className="h-6 text-xs font-semibold bg-transparent border-none p-0 focus-visible:ring-0"
                        />
                        {isImage && node.image_url ? (
                          <img src={node.image_url} alt={node.title} className="mt-1 rounded max-h-32 w-full object-cover" />
                        ) : (
                          <Textarea
                            value={node.subtitle || ""}
                            onChange={e => updateNode(node.id, { subtitle: e.target.value })}
                            placeholder="Descrição..."
                            className="mt-1 text-[10px] bg-transparent border-none p-0 min-h-[24px] resize-none focus-visible:ring-0 text-muted-foreground"
                            rows={2}
                          />
                        )}
                      </div>
                      <div className="flex flex-col gap-1 items-center">
                        <GripVertical className="h-3 w-3 text-muted-foreground cursor-grab" />
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeNode(node.id)}>
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                    {/* Color picker */}
                    <div className="flex gap-1 mt-2">
                      {COLORS.map(c => (
                        <button key={c} className={`h-3 w-3 rounded-full border ${node.color === c ? "ring-2 ring-primary ring-offset-1" : "border-border"}`} style={{ background: c }} onClick={() => updateNode(node.id, { color: c })} />
                      ))}
                    </div>
                    {/* Type badge */}
                    <div className="flex items-center justify-between mt-2">
                      <Badge variant="outline" className="text-[9px] h-4">
                        {isImage && <ImageIcon className="h-2 w-2 mr-0.5 inline" />}
                        {style.label}
                      </Badge>
                      {/* Connect dot */}
                      <div
                        className="connect-dot h-4 w-4 rounded-full bg-primary/60 hover:bg-primary cursor-crosshair flex items-center justify-center"
                        onMouseDown={e => { e.stopPropagation(); startConnect(node.id); }}
                      >
                        <ArrowRight className="h-2 w-2 text-primary-foreground" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Minimap */}
            <FlowMinimap
              nodes={active.nodes}
              pan={pan}
              zoom={zoom}
              canvasW={CANVAS_W}
              canvasH={CANVAS_H}
              viewportW={canvasRef.current?.parentElement?.clientWidth || 800}
              viewportH={520}
              onPanChange={setPan}
            />
          </div>
        </>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-sm mb-3">Nenhum fluxograma ainda. Crie um para visualizar seus processos estratégicos.</p>
            <Button onClick={addFlowchart} className="gap-1">
              <Plus className="h-4 w-4" /> Criar Primeiro Fluxograma
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

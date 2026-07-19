import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  useNodesState, useEdgesState, addEdge, Connection, Edge, Node,
  useReactFlow, NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { supabase } from "@/integrations/supabase/client";
import { useProjectList } from "@/hooks/useProjectList";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Play, Clapperboard, LayoutGrid, Copy, Layers } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ModelagemTab } from "@/components/studio/ModelagemTab";
import { toast } from "sonner";
import { StudioBlockLibrary } from "@/components/studio/canvas/StudioBlockLibrary";
import { StudioNodeDrawer } from "@/components/studio/canvas/StudioNodeDrawer";
import { CanvasBlockNode } from "@/components/studio/canvas/CanvasBlockNode";
import { CANVAS_BLOCKS, TEMPLATES, CanvasBlockType } from "@/components/studio/canvas/blockTypes";
import { autoLayout, isValidStudioConnection, KIND_COLORS } from "@/lib/studioAutoLayout";
import { StudioRunLogPanel } from "@/components/studio/canvas/StudioRunLogPanel";
import { StudioCostDialog } from "@/components/studio/canvas/StudioCostDialog";

const nodeTypes = { block: CanvasBlockNode };

function InnerCanvas() {
  const { data: projects = [] } = useProjectList();
  const [projectId, setProjectId] = useState<string>("");
  const [productIdx, setProductIdx] = useState(0);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [drawerNode, setDrawerNode] = useState<Node | null>(null);
  const [dragBlock, setDragBlock] = useState<CanvasBlockType | null>(null);
  const [briefing, setBriefing] = useState<any>({});
  const [costOpen, setCostOpen] = useState(false);
  const [modelagemOpen, setModelagemOpen] = useState(false);
  const [estimate, setEstimate] = useState<any>(null);
  const [pendingRun, setPendingRun] = useState<{ startNodeId?: string } | null>(null);
  const rf = useReactFlow();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const produtos = briefing?.produtos || [];
  const produto = produtos[productIdx];

  // Load projects → set default
  useEffect(() => {
    if (!projectId && projects.length) setProjectId(projects[0].id);
  }, [projects, projectId]);

  // Load briefing
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const { data } = await supabase.from("imphq_projects").select("data").eq("id", projectId).maybeSingle();
      const raw: any = (data as any)?.data;
      const b = raw?.briefing ?? raw;
      setBriefing(typeof b === "string" ? (() => { try { return JSON.parse(b); } catch { return {}; } })() : (b || {}));
    })();
  }, [projectId]);

  // Load or create workflow for this project/product
  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    (async () => {
      const { data: user } = await supabase.auth.getUser();
      const uid = user.user?.id;
      const { data: existing } = await (supabase
        .from("imphq_studio_workflows") as any)
        .select("id")
        .eq("user_id", uid)
        .eq("projeto_id", projectId)
        .eq("produto_idx", productIdx)
        .maybeSingle();

      let wid = existing?.id;
      if (!wid) {
        const { data: created, error } = await supabase
          .from("imphq_studio_workflows")
          .insert({
            user_id: uid,
            name: `Studio · ${produto?.nome || produto?.name || "Fluxo"}`,
            projeto_id: projectId,
            produto_idx: productIdx,
          } as any)
          .select("id")
          .single();
        if (error) { toast.error("Erro ao criar fluxo: " + error.message); setLoading(false); return; }
        wid = created!.id;
      }
      setWorkflowId(wid);

      const [{ data: nodeRows }, { data: edgeRows }] = await Promise.all([
        supabase.from("imphq_studio_canvas_nodes").select("*").eq("workflow_id", wid),
        supabase.from("imphq_studio_canvas_edges").select("*").eq("workflow_id", wid),
      ]);

      const productNode: Node = {
        id: "product-hub",
        type: "block",
        position: { x: 40, y: 40 },
        draggable: false,
        selectable: false,
        data: { tipo: "product", titulo: produto?.nome || produto?.name || "Produto" },
      };

      const flowNodes: Node[] = [
        productNode,
        ...((nodeRows || []) as any[]).map(n => ({
          id: n.id,
          type: "block",
          position: n.position || { x: 200, y: 200 },
          data: {
            id: n.id, tipo: n.tipo, titulo: n.titulo, config: n.config, output: n.output, status: n.status,
          },
        })),
      ];
      const nodeTipoMap = new Map<string, string>();
      ((nodeRows || []) as any[]).forEach(n => nodeTipoMap.set(n.id, n.tipo));
      const flowEdges: Edge[] = ((edgeRows || []) as any[]).map(e => {
        const color = KIND_COLORS[nodeTipoMap.get(e.source_id) || ""] || "hsl(var(--primary))";
        return { id: e.id, source: e.source_id, target: e.target_id, animated: true, style: { stroke: color, strokeWidth: 2 } };
      });

      setNodes(flowNodes);
      setEdges(flowEdges);
      setLoading(false);
    })();
  }, [projectId, productIdx, produto?.nome, setNodes, setEdges]);

  // Realtime
  useEffect(() => {
    if (!workflowId) return;
    const ch = supabase
      .channel(`studio-canvas-${workflowId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "imphq_studio_canvas_nodes", filter: `workflow_id=eq.${workflowId}` }, (payload) => {
        const n = payload.new as any;
        setNodes(prev => prev.map(x => x.id === n.id ? {
          ...x,
          data: { ...x.data, config: n.config, output: n.output, status: n.status, titulo: n.titulo, duration_ms: n.duration_ms, cost_actual: n.cost_actual },
        } : x));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [workflowId, setNodes]);

  // Persist position on drag end
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);
    for (const ch of changes) {
      if (ch.type === "position" && ch.dragging === false && ch.id !== "product-hub") {
        const n = rf.getNode(ch.id);
        if (n) supabase.from("imphq_studio_canvas_nodes").update({ position: n.position }).eq("id", ch.id).then(() => {});
      }
    }
  }, [onNodesChange, rf]);

  const persistEdge = async (source: string, target: string) => {
    if (!workflowId) return null;
    if (source === "product-hub") return null; // hub não persiste
    const { data, error } = await supabase.from("imphq_studio_canvas_edges").insert({
      workflow_id: workflowId, source_id: source, target_id: target,
    }).select("id").single();
    if (error) { toast.error(error.message); return null; }
    return data.id;
  };

  const edgeStyleFor = useCallback((sourceId: string) => {
    const src = rf.getNode(sourceId);
    const tipo = (src?.data as any)?.tipo || "prompt";
    const color = KIND_COLORS[tipo] || "hsl(var(--primary))";
    return { stroke: color, strokeWidth: 2 };
  }, [rf]);

  const onConnect = useCallback(async (c: Connection) => {
    if (!c.source || !c.target) return;
    const src = rf.getNode(c.source);
    const tgt = rf.getNode(c.target);
    const srcTipo = (src?.data as any)?.tipo;
    const tgtTipo = (tgt?.data as any)?.tipo;
    if (srcTipo && tgtTipo && !isValidStudioConnection(srcTipo, tgtTipo)) {
      toast.error(`Conexão inválida: ${srcTipo} → ${tgtTipo}`);
      return;
    }
    const newId = c.source === "product-hub" ? `hub-${c.target}` : await persistEdge(c.source, c.target);
    if (!newId && c.source !== "product-hub") return;
    setEdges(eds => addEdge({ ...c, id: newId as string, animated: true, style: edgeStyleFor(c.source!) }, eds));
  }, [workflowId, setEdges, rf, edgeStyleFor]);

  const onEdgesDelete = useCallback(async (removed: Edge[]) => {
    for (const e of removed) {
      if (!e.id.startsWith("hub-")) await supabase.from("imphq_studio_canvas_edges").delete().eq("id", e.id);
    }
  }, []);

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragBlock || !workflowId || !wrapperRef.current) return;
    const bounds = wrapperRef.current.getBoundingClientRect();
    const position = rf.screenToFlowPosition({ x: e.clientX - bounds.left, y: e.clientY - bounds.top });
    const { data, error } = await supabase.from("imphq_studio_canvas_nodes").insert({
      workflow_id: workflowId,
      tipo: dragBlock.id,
      titulo: dragBlock.label,
      config: dragBlock.defaultConfig || {},
      position,
      status: "pendente",
    }).select("*").single();
    if (error) { toast.error(error.message); return; }
    setNodes(prev => [...prev, {
      id: data.id, type: "block", position,
      data: { id: data.id, tipo: data.tipo, titulo: data.titulo, config: data.config, output: {}, status: "pendente" },
    }]);
    setDragBlock(null);
  }, [dragBlock, workflowId, rf, setNodes]);

  const generate = async (nodeId: string) => {
    if (!workflowId) return;
    await supabase.from("imphq_studio_canvas_nodes").update({ status: "gerando" }).eq("id", nodeId);
    setNodes(prev => prev.map(x => x.id === nodeId ? { ...x, data: { ...x.data, status: "gerando" } } : x));
    try {
      const { error } = await supabase.functions.invoke("studio-canvas-run", {
        body: { workflow_id: workflowId, node_id: nodeId, projeto_id: projectId, produto_idx: productIdx },
      });
      if (error) throw error;
      toast.success("Bloco enviado para geração");
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || "desconhecido"));
      await supabase.from("imphq_studio_canvas_nodes").update({ status: "erro" }).eq("id", nodeId);
    }
  };

  const openCostDialog = async (startNodeId?: string) => {
    if (!workflowId) return;
    setPendingRun({ startNodeId });
    setEstimate(null);
    setCostOpen(true);
    try {
      const { data, error } = await supabase.functions.invoke("studio-canvas-estimate", {
        body: { workflow_id: workflowId, start_node_id: startNodeId },
      });
      if (error) throw error;
      setEstimate(data);
    } catch (e: any) {
      toast.error("Erro na estimativa: " + (e?.message || "desconhecido"));
      setCostOpen(false);
    }
  };

  const confirmRun = async ({ forceRerun }: { forceRerun: boolean }) => {
    if (!workflowId) return;
    setRunning(true);
    try {
      const body: any = { workflow_id: workflowId, projeto_id: projectId, produto_idx: productIdx, force_rerun: forceRerun };
      if (pendingRun?.startNodeId) body.start_node_id = pendingRun.startNodeId;
      else body.run_all = true;
      const { error } = await supabase.functions.invoke("studio-canvas-run", { body });
      if (error) throw error;
      toast.success("Pipeline em execução");
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || "desconhecido"));
    } finally { setRunning(false); setPendingRun(null); }
  };

  const runAll = () => openCostDialog(undefined);
  const runFromNode = (nodeId: string) => openCostDialog(nodeId);

  const plantTemplate = async (key: string) => {
    if (!workflowId) return;
    const t = TEMPLATES.find(x => x.key === key);
    if (!t) return;
    const created: any[] = [];
    for (const n of t.nodes) {
      const meta = CANVAS_BLOCKS.find(b => b.id === n.tipo);
      const { data } = await supabase.from("imphq_studio_canvas_nodes").insert({
        workflow_id: workflowId,
        tipo: n.tipo,
        titulo: n.titulo || meta?.label,
        config: { ...(meta?.defaultConfig || {}), ...(n.config || {}) },
        position: n.position,
        status: "pendente",
      }).select("*").single();
      created.push(data);
    }
    const newNodes: Node[] = created.map(d => ({
      id: d.id, type: "block", position: d.position,
      data: { id: d.id, tipo: d.tipo, titulo: d.titulo, config: d.config, output: {}, status: "pendente" },
    }));
    const newEdges: Edge[] = [];
    for (const e of t.edges) {
      const src = created[e.from]?.id, tgt = created[e.to]?.id;
      if (!src || !tgt) continue;
      const { data } = await supabase.from("imphq_studio_canvas_edges").insert({
        workflow_id: workflowId, source_id: src, target_id: tgt,
      }).select("id").single();
      if (data) {
        const srcTipo = created.find(c => c.id === src)?.tipo || "prompt";
        const color = KIND_COLORS[srcTipo] || "hsl(var(--primary))";
        newEdges.push({ id: data.id, source: src, target: tgt, animated: true, style: { stroke: color, strokeWidth: 2 } });
      }
    }
    setNodes(prev => [...prev, ...newNodes]);
    setEdges(prev => [...prev, ...newEdges]);
    toast.success(`Template "${t.name}" plantado`);
  };

  const deleteNode = async (id: string) => {
    await supabase.from("imphq_studio_canvas_nodes").delete().eq("id", id);
    setNodes(prev => prev.filter(x => x.id !== id));
    setEdges(prev => prev.filter(x => x.source !== id && x.target !== id));
  };

  const updateNode = async (id: string, patch: any) => {
    await supabase.from("imphq_studio_canvas_nodes").update(patch).eq("id", id);
    setNodes(prev => prev.map(x => x.id === id ? { ...x, data: { ...x.data, ...patch } } : x));
  };

  const duplicateNode = useCallback(async (id: string) => {
    if (!workflowId) return;
    const src = rf.getNode(id);
    if (!src || id === "product-hub") return;
    const d: any = src.data;
    const position = { x: (src.position?.x || 0) + 40, y: (src.position?.y || 0) + 40 };
    const { data, error } = await supabase.from("imphq_studio_canvas_nodes").insert({
      workflow_id: workflowId,
      tipo: d.tipo,
      titulo: (d.titulo || "") + " (cópia)",
      config: d.config || {},
      position,
      status: "pendente",
    }).select("*").single();
    if (error) { toast.error(error.message); return; }
    setNodes(prev => [...prev, {
      id: data.id, type: "block", position,
      data: { id: data.id, tipo: data.tipo, titulo: data.titulo, config: data.config, output: {}, status: "pendente" },
    }]);
    toast.success("Bloco duplicado");
  }, [workflowId, rf, setNodes]);

  const organize = useCallback(async () => {
    const laid = autoLayout(nodes, edges, "LR");
    setNodes(laid);
    // persist
    for (const n of laid) {
      if (n.id === "product-hub") continue;
      await supabase.from("imphq_studio_canvas_nodes").update({ position: n.position }).eq("id", n.id);
    }
    setTimeout(() => rf.fitView({ padding: 0.2, duration: 400 }), 50);
    toast.success("Canvas organizado");
  }, [nodes, edges, setNodes, rf]);

  // Atalhos: Ctrl/Cmd+D duplica nó selecionado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        const sel = nodes.find(n => n.selected);
        if (sel && sel.id !== "product-hub") {
          e.preventDefault();
          duplicateNode(sel.id);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nodes, duplicateNode]);

  const isValidConnection = useCallback((c: Connection | Edge) => {
    if (!c.source || !c.target) return false;
    const src = rf.getNode(c.source);
    const tgt = rf.getNode(c.target);
    const srcTipo = (src?.data as any)?.tipo;
    const tgtTipo = (tgt?.data as any)?.tipo;
    if (!srcTipo || !tgtTipo) return true;
    return isValidStudioConnection(srcTipo, tgtTipo);
  }, [rf]);

  // wire generate + duplicate + delete onto nodes' data
  const nodesWithHandlers = useMemo(() => nodes.map(n => ({
    ...n,
    data: { ...n.data, onGenerate: generate, onDuplicate: duplicateNode, onRunFrom: runFromNode, onDelete: deleteNode },
  })), [nodes, duplicateNode]);

  const nodeTitles = useMemo(() => {
    const m: Record<string, string> = {};
    for (const n of nodes) m[n.id] = (n.data as any)?.titulo || (n.data as any)?.tipo || n.id;
    return m;
  }, [nodes]);

  return (
    <div className="flex gap-3 h-[calc(100vh-140px)] p-4">
      <StudioBlockLibrary
        onDragStart={setDragBlock}
        onDragEnd={() => setDragBlock(null)}
        onPickTemplate={plantTemplate}
        templates={TEMPLATES}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Clapperboard className="h-6 w-6 text-primary" />
          <h1 className="font-display text-xl font-bold text-primary mr-2">Studio</h1>
          <Select value={projectId} onValueChange={(v) => { setProjectId(v); setProductIdx(0); }}>
            <SelectTrigger className="w-[220px] h-8 text-xs"><SelectValue placeholder="Projeto" /></SelectTrigger>
            <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
          {produtos.length > 0 && (
            <Select value={String(productIdx)} onValueChange={(v) => setProductIdx(Number(v))}>
              <SelectTrigger className="w-[220px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {produtos.map((p: any, i: number) => (
                  <SelectItem key={i} value={String(i)}>{p.nome || p.name || `Produto ${i+1}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={organize} disabled={!workflowId || nodes.length < 2} className="h-8 text-xs gap-1.5" title="Reorganizar layout (dagre)">
            <LayoutGrid className="h-3.5 w-3.5" /> Organizar
          </Button>
          <Button size="sm" variant="outline" onClick={() => setModelagemOpen(true)} className="h-8 text-xs gap-1.5" title="Modelar a partir de referências">
            <Layers className="h-3.5 w-3.5" /> Modelagem
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.location.assign("/studio/legado")} className="h-8 text-xs">
            Studio legado
          </Button>
          <Button size="sm" onClick={runAll} disabled={!workflowId || running} className="h-8 gap-1.5">
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Executar tudo
          </Button>
        </div>

        <div ref={wrapperRef} className="flex-1 rounded-lg border border-border/60 bg-[#050304] overflow-hidden relative"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/50">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
          <ReactFlow
            nodes={nodesWithHandlers}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgesDelete={onEdgesDelete}
            onNodeClick={(_, n) => n.id !== "product-hub" && setDrawerNode(n)}
            isValidConnection={isValidConnection}
            nodeTypes={nodeTypes}
            deleteKeyCode={["Backspace", "Delete"]}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} color="#c9922a22" />
            <Controls className="!bg-secondary !border-border" />
            <MiniMap className="!bg-secondary !border-border" nodeColor="#c9922a" maskColor="rgba(0,0,0,0.6)" />
          </ReactFlow>
          <StudioRunLogPanel workflowId={workflowId} nodeTitles={nodeTitles} />
        </div>
      </div>

      <StudioNodeDrawer
        node={drawerNode}
        onClose={() => setDrawerNode(null)}
        onGenerate={(id) => { generate(id); }}
        onDelete={deleteNode}
        onUpdate={updateNode}
        onDuplicate={duplicateNode}
        onRunFrom={runFromNode}
      />

      <StudioCostDialog
        open={costOpen}
        onOpenChange={setCostOpen}
        estimate={estimate}
        onConfirm={confirmRun}
      />
    </div>
  );
}

export default function StudioCanvasPage() {
  return (
    <ReactFlowProvider>
      <InnerCanvas />
    </ReactFlowProvider>
  );
}

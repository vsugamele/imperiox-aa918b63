import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  addEdge, applyEdgeChanges, applyNodeChanges,
  type Node, type Edge, type Connection, type NodeChange, type EdgeChange,
  Handle, Position, useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Plus, Trash2, Save, Building2, Target, Users, Megaphone, ShoppingCart, Wrench, FileText, Link2, X, Check, Wand2, LayoutGrid, Download, Sparkles, TrendingUp, ListChecks, Copy, MousePointer } from "lucide-react";
import { MAP_TEMPLATES } from "./mapTemplates";
import { applyTemplate, autopopulateFromBusiness, autoLayout, exportMapPng } from "./companyMapHelpers";
import { useCompanyMapLiveStats } from "@/hooks/useCompanyMapLiveStats";

const KIND_PRESETS: Record<string, { label: string; color: string; icon: any }> = {
  vertical:   { label: "Vertical / Unidade",  color: "#c9922a", icon: Building2 },
  area:       { label: "Área / Time",         color: "#3b82f6", icon: Users },
  oferta:     { label: "Oferta / Produto",    color: "#10b981", icon: ShoppingCart },
  canal:      { label: "Canal",               color: "#f59e0b", icon: Megaphone },
  processo:   { label: "Processo",            color: "#8b5cf6", icon: Wrench },
  meta:       { label: "Meta / KPI",          color: "#ef4444", icon: Target },
  doc:        { label: "Documento",           color: "#64748b", icon: FileText },
};

interface ChecklistItem { id: string; text: string; done: boolean; }
interface MapNode {
  id: string; map_id: string; label: string; kind: string; color: string;
  description?: string | null; notes?: string | null;
  position: { x: number; y: number }; size: string;
  checklist: ChecklistItem[];
  show_live_kpis?: boolean;
  linked_funnel_id?: string | null; linked_project_id?: string | null; linked_flow_id?: string | null;
}

function MapNodeCard({ data }: { data: any }) {
  const preset = KIND_PRESETS[data.kind] || KIND_PRESETS.canal;
  const Icon = preset.icon;
  const checklist: ChecklistItem[] = data.checklist || [];
  const done = checklist.filter((c) => c.done).length;
  const total = checklist.length;
  const preview = checklist.slice(0, 3);
  const rest = Math.max(0, total - preview.length);
  return (
    <div
      className="rounded-xl border-2 bg-card/95 backdrop-blur px-3 py-2 min-w-[200px] max-w-[260px] shadow-lg hover:shadow-xl transition-all cursor-pointer"
      style={{ borderColor: data.color }}
    >
      <Handle type="target" position={Position.Top} style={{ background: data.color }} />
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1 rounded" style={{ background: `${data.color}20`, color: data.color }}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{preset.label}</span>
      </div>
      <p className="text-sm font-medium leading-snug">{data.label}</p>
      {data.description && <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{data.description}</p>}
      {total > 0 && (
        <div className="mt-2 pt-2 border-t border-border/40">
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="text-muted-foreground flex items-center gap-1"><ListChecks className="h-3 w-3" /> Checklist</span>
            <Badge variant="outline" className="text-[9px] h-4 px-1">{done}/{total}</Badge>
          </div>
          <div className="space-y-0.5 nodrag">
            {preview.map((c) => (
              <label
                key={c.id}
                className="flex items-start gap-1.5 text-[10px] leading-tight cursor-pointer hover:bg-white/5 rounded px-1 py-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={c.done}
                  className="h-3 w-3 mt-0.5"
                  onCheckedChange={(v) => data.onToggleItem?.(data.id, c.id, !!v)}
                />
                <span className={c.done ? "line-through text-muted-foreground" : ""}>{c.text || "—"}</span>
              </label>
            ))}
            {rest > 0 && <div className="text-[9px] text-muted-foreground pl-5">+{rest} itens</div>}
          </div>
        </div>
      )}
      {data.show_live_kpis && data.liveStats && (
        <div className="mt-1.5 pt-1.5 border-t border-border/40 flex items-center justify-between text-[10px]">
          <span className="text-emerald-400 font-medium">
            R$ {(data.liveStats.revenue30d || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
          </span>
          <span className="text-muted-foreground">{data.liveStats.leadsAbertos || 0} leads</span>
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: data.color }} />
    </div>
  );
}

const nodeTypes = { mapnode: MapNodeCard };

function InnerMap({ projects }: { projects: any[] }) {
  const [mapId, setMapId] = useState<string | null>(null);
  const [maps, setMaps] = useState<{ id: string; name: string }[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [rawNodes, setRawNodes] = useState<MapNode[]>([]);
  const [selected, setSelected] = useState<MapNode | null>(null);
  const [funis, setFunis] = useState<{ id: string; nome: string }[]>([]);
  const [flows, setFlows] = useState<{ id: string; name: string }[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [checklistPanel, setChecklistPanel] = useState(false);
  const [checklistFilter, setChecklistFilter] = useState<"pending" | "done" | "all">("pending");
  const { setCenter } = useReactFlow();

  // load maps list
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("imphq_company_maps").select("id,name").order("created_at");
      const list = data || [];
      if (list.length === 0) {
        const { data: created } = await supabase.from("imphq_company_maps").insert({ name: "Mapa Principal" }).select("id,name").single();
        if (created) { setMaps([created]); setMapId(created.id); }
      } else {
        setMaps(list);
        setMapId(list[0].id);
      }
    })();
    supabase.from("imphq_funis").select("id,nome").then(({ data }) => setFunis(data || []));
    supabase.from("imphq_flows").select("id,nome").then(({ data }) => setFlows(((data || []) as any[]).map(d => ({ id: d.id, name: d.nome }))));
  }, []);

  // Toggle single checklist item directly on the canvas
  const toggleChecklistItem = useCallback(async (nodeId: string, itemId: string, done: boolean) => {
    const raw = rawNodes.find(r => r.id === nodeId);
    if (!raw) return;
    const next = (raw.checklist || []).map(c => c.id === itemId ? { ...c, done } : c);
    setRawNodes(list => list.map(r => r.id === nodeId ? { ...r, checklist: next } : r));
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, checklist: next } } : n));
    await supabase.from("imphq_company_map_nodes").update({ checklist: next as any }).eq("id", nodeId);
  }, [rawNodes]);

  // load nodes/edges
  const loadMap = useCallback(async (id: string) => {
    const [{ data: nds }, { data: eds }] = await Promise.all([
      supabase.from("imphq_company_map_nodes").select("*").eq("map_id", id),
      supabase.from("imphq_company_map_edges").select("*").eq("map_id", id),
    ]);
    const list = (nds || []) as any as MapNode[];
    setRawNodes(list);
    setNodes(list.map(n => ({
      id: n.id, type: "mapnode",
      position: n.position || { x: 0, y: 0 },
      data: { ...n, onToggleItem: toggleChecklistItem },
    })));
    setEdges((eds || []).map((e: any) => ({
      id: e.id, source: e.source_id, target: e.target_id,
      animated: e.style !== "dashed",
      label: e.label || undefined,
      style: { stroke: "#c9922a", strokeWidth: 2, strokeDasharray: e.style === "dashed" ? "6 4" : undefined },
    })));
  }, [toggleChecklistItem]);

  // live KPIs for project-linked nodes
  const liveProjectIds = useMemo(
    () => rawNodes.filter(n => n.show_live_kpis && n.linked_project_id).map(n => n.linked_project_id!),
    [rawNodes]
  );
  const { data: liveStats } = useCompanyMapLiveStats(liveProjectIds);

  // re-inject stats + toggle callback into node data
  useEffect(() => {
    setNodes(nds => nds.map(n => {
      const raw = rawNodes.find(r => r.id === n.id);
      const stats = raw?.linked_project_id && liveStats ? liveStats[raw.linked_project_id] : null;
      return { ...n, data: { ...n.data, liveStats: stats, onToggleItem: toggleChecklistItem } };
    }));
  }, [liveStats, rawNodes, toggleChecklistItem]);

  useEffect(() => { if (mapId) loadMap(mapId); }, [mapId, loadMap]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(nds => applyNodeChanges(changes, nds));
    changes.forEach(async (c: any) => {
      if (c.type === "position" && c.dragging === false && c.position) {
        await supabase.from("imphq_company_map_nodes").update({ position: c.position }).eq("id", c.id);
      }
      if (c.type === "select") {
        setSelectedIds(prev => c.selected ? Array.from(new Set([...prev, c.id])) : prev.filter(x => x !== c.id));
      }
    });
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges(eds => applyEdgeChanges(changes, eds));
    changes.forEach(async (c: any) => {
      if (c.type === "remove") {
        await supabase.from("imphq_company_map_edges").delete().eq("id", c.id);
      }
    });
  }, []);

  const onConnect = useCallback(async (conn: Connection) => {
    if (!mapId || !conn.source || !conn.target) return;
    const { data } = await supabase.from("imphq_company_map_edges")
      .insert({ map_id: mapId, source_id: conn.source, target_id: conn.target })
      .select().single();
    if (data) setEdges(eds => addEdge({ id: data.id, source: conn.source!, target: conn.target!, animated: true, style: { stroke: "#c9922a", strokeWidth: 2 } }, eds));
  }, [mapId]);

  const addNode = async (kind: string) => {
    if (!mapId) return;
    const preset = KIND_PRESETS[kind];
    const { data } = await supabase.from("imphq_company_map_nodes").insert({
      map_id: mapId, kind, color: preset.color,
      label: `Novo ${preset.label}`,
      position: { x: 200 + Math.random() * 400, y: 150 + Math.random() * 300 },
    }).select().single();
    if (data) await loadMap(mapId);
  };

  const createMap = async () => {
    const name = prompt("Nome do novo mapa:");
    if (!name) return;
    const { data } = await supabase.from("imphq_company_maps").insert({ name }).select().single();
    if (data) { setMaps(m => [...m, data]); setMapId(data.id); }
  };

  const onNodeClick = (_: any, node: Node) => {
    const raw = rawNodes.find(r => r.id === node.id);
    if (raw) setSelected({ ...raw, checklist: raw.checklist || [] });
  };

  const saveSelected = async () => {
    if (!selected) return;
    const { error } = await supabase.from("imphq_company_map_nodes").update({
      label: selected.label, description: selected.description, notes: selected.notes,
      color: selected.color, kind: selected.kind, checklist: selected.checklist as any,
      show_live_kpis: !!selected.show_live_kpis,
      linked_funnel_id: selected.linked_funnel_id || null,
      linked_project_id: selected.linked_project_id || null,
      linked_flow_id: selected.linked_flow_id || null,
    }).eq("id", selected.id);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Salvo");
    if (mapId) await loadMap(mapId);
    setSelected(null);
  };

  const runAutoLayout = async () => {
    const next = autoLayout(nodes, edges);
    setNodes(next);
    await Promise.all(next.map(n =>
      supabase.from("imphq_company_map_nodes").update({ position: n.position }).eq("id", n.id)
    ));
    toast.success("Organizado");
  };

  const handleTemplate = async (tplId: string) => {
    if (!mapId) return;
    const tpl = MAP_TEMPLATES.find(t => t.id === tplId);
    if (!tpl) return;
    if (!confirm(`Carregar template "${tpl.name}"? Os nós atuais deste mapa serão substituídos.`)) return;
    await applyTemplate(mapId, tpl);
    await loadMap(mapId);
    toast.success("Template carregado");
  };

  const handleAutopopulate = async () => {
    if (!mapId) return;
    if (!confirm("Gerar mapa a partir dos seus projetos, fluxos e canais? Os nós atuais serão substituídos.")) return;
    const t = toast.loading("Gerando mapa...");
    try { await autopopulateFromBusiness(mapId); await loadMap(mapId); toast.success("Mapa gerado", { id: t }); }
    catch (e: any) { toast.error(e.message || "Erro", { id: t }); }
  };

  const handleExport = async () => {
    try { await exportMapPng(); toast.success("PNG baixado"); }
    catch (e: any) { toast.error(e.message || "Erro ao exportar"); }
  };


  const deleteNode = async () => {
    if (!selected) return;
    if (!confirm("Excluir este nó e suas conexões?")) return;
    await supabase.from("imphq_company_map_nodes").delete().eq("id", selected.id);
    setSelected(null);
    if (mapId) await loadMap(mapId);
  };

  // ============ Bulk selection actions ============
  const bulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Excluir ${selectedIds.length} nós e suas conexões?`)) return;
    await supabase.from("imphq_company_map_nodes").delete().in("id", selectedIds);
    setSelectedIds([]);
    if (mapId) await loadMap(mapId);
    toast.success("Selecionados excluídos");
  };

  const bulkDuplicate = async () => {
    if (!mapId || selectedIds.length === 0) return;
    const originals = rawNodes.filter(n => selectedIds.includes(n.id));
    const payload = originals.map(n => ({
      map_id: mapId, kind: n.kind, color: n.color,
      label: `${n.label} (cópia)`, description: n.description, notes: n.notes,
      checklist: (n.checklist || []) as any,
      position: { x: (n.position?.x || 0) + 40, y: (n.position?.y || 0) + 40 },
    }));
    await supabase.from("imphq_company_map_nodes").insert(payload);
    setSelectedIds([]);
    if (mapId) await loadMap(mapId);
    toast.success("Duplicados");
  };

  const bulkChangeKind = async (kind: string) => {
    if (selectedIds.length === 0) return;
    const preset = KIND_PRESETS[kind];
    await supabase.from("imphq_company_map_nodes")
      .update({ kind, color: preset.color })
      .in("id", selectedIds);
    if (mapId) await loadMap(mapId);
    toast.success("Tipo aplicado");
  };

  // ============ Aggregated checklist ============
  const aggregatedChecklist = useMemo(() => {
    const rows: { nodeId: string; nodeLabel: string; nodeColor: string; nodeKind: string; item: ChecklistItem; position: { x: number; y: number } }[] = [];
    rawNodes.forEach(n => (n.checklist || []).forEach(item => rows.push({
      nodeId: n.id, nodeLabel: n.label, nodeColor: n.color, nodeKind: n.kind, item, position: n.position,
    })));
    return rows.filter(r => checklistFilter === "all" ? true : checklistFilter === "done" ? r.item.done : !r.item.done);
  }, [rawNodes, checklistFilter]);

  const totalDone = rawNodes.reduce((a, n) => a + (n.checklist || []).filter(c => c.done).length, 0);
  const totalItems = rawNodes.reduce((a, n) => a + (n.checklist || []).length, 0);

  const focusNode = (id: string, position: { x: number; y: number }) => {
    setCenter(position.x + 100, position.y + 40, { zoom: 1.2, duration: 500 });
  };

  return (
    <div className="relative h-[calc(100vh-200px)] border border-border/40 rounded-lg overflow-hidden bg-[#0a0809]">
      {/* Top toolbar */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-card/80 backdrop-blur border border-border/40 rounded-lg p-1.5">
        <Select value={mapId || ""} onValueChange={setMapId}>
          <SelectTrigger className="h-7 text-xs w-[180px] border-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            {maps.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={createMap}>
          <Plus className="h-3 w-3" /> Novo mapa
        </Button>
        <div className="w-px h-5 bg-border/40 mx-1" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
              <Sparkles className="h-3 w-3" /> Template
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[260px]">
            {MAP_TEMPLATES.map(t => (
              <DropdownMenuItem key={t.id} onClick={() => handleTemplate(t.id)} className="flex-col items-start gap-0.5">
                <span className="text-sm font-medium">{t.name}</span>
                <span className="text-[10px] text-muted-foreground">{t.description}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={handleAutopopulate}>
          <Wand2 className="h-3 w-3" /> Gerar do meu negócio
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={runAutoLayout}>
          <LayoutGrid className="h-3 w-3" /> Organizar
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setChecklistPanel(true)}>
          <ListChecks className="h-3 w-3" /> Checklist
          {totalItems > 0 && <Badge variant="outline" className="h-4 px-1 text-[9px] ml-1">{totalDone}/{totalItems}</Badge>}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={handleExport}>
          <Download className="h-3 w-3" /> PNG
        </Button>
      </div>

      {/* Palette */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1 bg-card/80 backdrop-blur border border-border/40 rounded-lg p-2">
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1 px-1">Adicionar nó</p>
        {Object.entries(KIND_PRESETS).map(([key, p]) => {
          const Icon = p.icon;
          return (
            <Button key={key} size="sm" variant="ghost" className="h-7 text-xs justify-start gap-2"
              onClick={() => addNode(key)}>
              <div className="p-0.5 rounded" style={{ background: `${p.color}30`, color: p.color }}>
                <Icon className="h-3 w-3" />
              </div>
              {p.label}
            </Button>
          );
        })}
      </div>

      {/* Bulk selection toolbar */}
      {selectedIds.length >= 2 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-card/95 backdrop-blur border border-primary/40 rounded-lg p-2 shadow-xl">
          <div className="flex items-center gap-1.5 px-2 text-xs">
            <MousePointer className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium">{selectedIds.length} selecionados</span>
          </div>
          <div className="w-px h-5 bg-border/40" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                <Wrench className="h-3 w-3" /> Mudar tipo
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {Object.entries(KIND_PRESETS).map(([k, p]) => (
                <DropdownMenuItem key={k} onClick={() => bulkChangeKind(k)}>{p.label}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={bulkDuplicate}>
            <Copy className="h-3 w-3" /> Duplicar
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-red-400" onClick={bulkDelete}>
            <Trash2 className="h-3 w-3" /> Excluir
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setSelectedIds([])}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-[10px] text-muted-foreground bg-card/80 backdrop-blur px-3 py-1 rounded-full border border-border/40 pointer-events-none">
        Shift+arraste = selecionar em área · Cmd/Ctrl+clique = adicionar · Arraste um nó selecionado para mover todos
      </div>
      <ReactFlow
        nodes={nodes} edges={edges} nodeTypes={nodeTypes}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        onConnect={onConnect} onNodeClick={onNodeClick}
        panOnDrag={[0, 1, 2]}
        selectionKeyCode={["Shift"]}
        multiSelectionKeyCode={["Meta", "Control"]}
        nodesDraggable
        deleteKeyCode={null}
        fitView proOptions={{ hideAttribution: true }}
      >
        <Background color="#1f1d1e" gap={20} />
        <Controls className="!bg-card !border-border" />
        <MiniMap className="!bg-card !border-border" nodeColor={(n: any) => n.data?.color || "#c9922a"} />
      </ReactFlow>

      {/* Aggregated checklist panel */}
      <Sheet open={checklistPanel} onOpenChange={setChecklistPanel}>
        <SheetContent className="w-[440px] sm:max-w-[440px] overflow-y-auto bg-secondary/40">
          <SheetHeader>
            <SheetTitle className="font-serif flex items-center gap-2">
              <ListChecks className="h-4 w-4" /> Checklist do mapa
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{totalDone} de {totalItems} concluídos</span>
              <div className="flex gap-1">
                {(["pending", "done", "all"] as const).map(f => (
                  <Button key={f} size="sm" variant={checklistFilter === f ? "default" : "ghost"}
                    className="h-6 text-[10px] px-2" onClick={() => setChecklistFilter(f)}>
                    {f === "pending" ? "Pendentes" : f === "done" ? "Feitos" : "Todos"}
                  </Button>
                ))}
              </div>
            </div>
            <div className="h-1.5 bg-muted/30 rounded overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${totalItems ? (totalDone / totalItems) * 100 : 0}%` }} />
            </div>

            {aggregatedChecklist.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">
                {totalItems === 0 ? "Nenhum item de checklist ainda. Abra um nó pra adicionar." : "Nada por aqui com esse filtro."}
              </p>
            )}

            <div className="space-y-1">
              {aggregatedChecklist.map((r) => (
                <div key={`${r.nodeId}-${r.item.id}`} className="flex items-start gap-2 p-2 rounded border border-border/30 hover:border-border/60 bg-card/40">
                  <Checkbox
                    checked={r.item.done}
                    className="mt-0.5"
                    onCheckedChange={(v) => toggleChecklistItem(r.nodeId, r.item.id, !!v)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs ${r.item.done ? "line-through text-muted-foreground" : ""}`}>{r.item.text || "—"}</p>
                    <button
                      onClick={() => { focusNode(r.nodeId, r.position); setChecklistPanel(false); }}
                      className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1 mt-0.5"
                    >
                      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: r.nodeColor }} />
                      {r.nodeLabel}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Editor sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto bg-secondary/40">
          <SheetHeader><SheetTitle className="font-serif">Editar nó do mapa</SheetTitle></SheetHeader>
          {selected && (
            <div className="space-y-4 mt-4">
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={selected.kind} onValueChange={(v) => setSelected({ ...selected, kind: v, color: KIND_PRESETS[v].color })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(KIND_PRESETS).map(([k, p]) => <SelectItem key={k} value={k}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Rótulo</Label>
                <Input value={selected.label} onChange={e => setSelected({ ...selected, label: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Descrição (o que cuida)</Label>
                <Textarea rows={2} value={selected.description || ""}
                  onChange={e => setSelected({ ...selected, description: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Como cuida / observações</Label>
                <Textarea rows={3} value={selected.notes || ""}
                  onChange={e => setSelected({ ...selected, notes: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Projeto</Label>
                  <Select value={selected.linked_project_id || "none"}
                    onValueChange={(v) => setSelected({ ...selected, linked_project_id: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Funil</Label>
                  <Select value={selected.linked_funnel_id || "none"}
                    onValueChange={(v) => setSelected({ ...selected, linked_funnel_id: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {funis.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {selected.linked_project_id && (
                <label className="flex items-center gap-2 text-xs cursor-pointer p-2 rounded bg-emerald-500/5 border border-emerald-500/20">
                  <Checkbox checked={!!selected.show_live_kpis}
                    onCheckedChange={(v) => setSelected({ ...selected, show_live_kpis: !!v })} />
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Mostrar KPIs ao vivo (faturamento 30d + leads abertos)</span>
                </label>
              )}
              <div>
                <Label className="text-xs">Fluxo (OpenFlow)</Label>
                <Select value={selected.linked_flow_id || "none"}
                  onValueChange={(v) => setSelected({ ...selected, linked_flow_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {flows.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs">Checklist</Label>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1"
                    onClick={() => setSelected({ ...selected, checklist: [...selected.checklist, { id: crypto.randomUUID(), text: "", done: false }] })}>
                    <Plus className="h-3 w-3" /> Item
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {selected.checklist.map((c, i) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <Checkbox checked={c.done} onCheckedChange={(v) => {
                        const cl = [...selected.checklist]; cl[i] = { ...c, done: !!v };
                        setSelected({ ...selected, checklist: cl });
                      }} />
                      <Input className="h-7 text-xs" value={c.text} placeholder="Tarefa..."
                        onChange={e => {
                          const cl = [...selected.checklist]; cl[i] = { ...c, text: e.target.value };
                          setSelected({ ...selected, checklist: cl });
                        }} />
                      <Button size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => setSelected({ ...selected, checklist: selected.checklist.filter(x => x.id !== c.id) })}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border/40">
                <Button variant="ghost" size="sm" className="text-red-400 gap-1" onClick={deleteNode}>
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </Button>
                <Button size="sm" className="gap-1" onClick={saveSelected}>
                  <Save className="h-3.5 w-3.5" /> Salvar
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function CompanyMapCanvas({ projects }: { projects: any[] }) {
  return <ReactFlowProvider><InnerMap projects={projects} /></ReactFlowProvider>;
}

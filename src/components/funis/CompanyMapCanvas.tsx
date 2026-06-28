import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  addEdge, applyEdgeChanges, applyNodeChanges,
  type Node, type Edge, type Connection, type NodeChange, type EdgeChange,
  Handle, Position,
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
import { toast } from "sonner";
import { Plus, Trash2, Save, Building2, Target, Users, Megaphone, ShoppingCart, Wrench, FileText, Link2, X, Check } from "lucide-react";

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
  linked_funnel_id?: string | null; linked_project_id?: string | null; linked_flow_id?: string | null;
}

function MapNodeCard({ data }: { data: any }) {
  const preset = KIND_PRESETS[data.kind] || KIND_PRESETS.canal;
  const Icon = preset.icon;
  const done = (data.checklist || []).filter((c: ChecklistItem) => c.done).length;
  const total = (data.checklist || []).length;
  return (
    <div
      className="rounded-xl border-2 bg-card/95 backdrop-blur px-3 py-2 min-w-[180px] max-w-[240px] shadow-lg hover:shadow-xl transition-all cursor-pointer"
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
        <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">Checklist</span>
          <Badge variant="outline" className="text-[9px] h-4 px-1">{done}/{total}</Badge>
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
    supabase.from("imphq_flows").select("id,name").then(({ data }) => setFlows((data || []) as any));
  }, []);

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
      data: { ...n },
    })));
    setEdges((eds || []).map((e: any) => ({
      id: e.id, source: e.source_id, target: e.target_id,
      animated: true, style: { stroke: "#c9922a", strokeWidth: 2 },
    })));
  }, []);

  useEffect(() => { if (mapId) loadMap(mapId); }, [mapId, loadMap]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(nds => applyNodeChanges(changes, nds));
    // persist positions on drag end
    changes.forEach(async (c: any) => {
      if (c.type === "position" && c.dragging === false && c.position) {
        await supabase.from("imphq_company_map_nodes").update({ position: c.position }).eq("id", c.id);
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
      linked_funnel_id: selected.linked_funnel_id || null,
      linked_project_id: selected.linked_project_id || null,
      linked_flow_id: selected.linked_flow_id || null,
    }).eq("id", selected.id);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Salvo");
    if (mapId) await loadMap(mapId);
    setSelected(null);
  };

  const deleteNode = async () => {
    if (!selected) return;
    if (!confirm("Excluir este nó e suas conexões?")) return;
    await supabase.from("imphq_company_map_nodes").delete().eq("id", selected.id);
    setSelected(null);
    if (mapId) await loadMap(mapId);
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

      <ReactFlow
        nodes={nodes} edges={edges} nodeTypes={nodeTypes}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        onConnect={onConnect} onNodeClick={onNodeClick}
        fitView proOptions={{ hideAttribution: true }}
      >
        <Background color="#1f1d1e" gap={20} />
        <Controls className="!bg-card !border-border" />
        <MiniMap className="!bg-card !border-border" nodeColor={(n: any) => n.data?.color || "#c9922a"} />
      </ReactFlow>

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

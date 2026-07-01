import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type NodeProps,
  type Connection,
  BackgroundVariant,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Building2, Users, Package, Megaphone, Workflow,
  Target, FileText, Plus, Save, Trash2, ExternalLink,
  Network, Loader2, ChevronDown, Map,
} from "lucide-react";

// ── Node type config ──────────────────────────────────────────────────────────

type NoTipo = "vertical" | "area" | "produto" | "canal" | "processo" | "meta" | "documento";

const NO_META: Record<NoTipo, { label: string; cor: string; icon: React.ElementType; desc: string }> = {
  vertical:  { label: "Vertical / Unidade", cor: "#f59e0b", icon: Building2,  desc: "Divisão principal do negócio (ex: Expert, E-commerce)" },
  area:      { label: "Área / Time",        cor: "#f97316", icon: Users,       desc: "Subdivisão operacional (ex: Tráfego, Produto, Pós-venda)" },
  produto:   { label: "Oferta / Produto",   cor: "#22c55e", icon: Package,     desc: "Produto ou oferta específica do portfólio" },
  canal:     { label: "Canal",              cor: "#eab308", icon: Megaphone,   desc: "Canal de aquisição ou comunicação (Meta, YouTube, Email)" },
  processo:  { label: "Processo",           cor: "#8b5cf6", icon: Workflow,    desc: "Processo ou automação interna" },
  meta:      { label: "Meta / KPI",         cor: "#ef4444", icon: Target,      desc: "Objetivo mensurável ou indicador de desempenho" },
  documento: { label: "Documento",          cor: "#6b7280", icon: FileText,    desc: "SOP, briefing, script ou referência" },
};

// ── Custom node component ─────────────────────────────────────────────────────

interface NoData {
  tipo: NoTipo;
  label: string;
  descricao?: string;
  projeto_id?: string;
  funil_id?: string;
  projeto_nome?: string;
  funil_nome?: string;
  onEdit?: (id: string) => void;
}

function MapaNoComponent({ id, data, selected }: NodeProps) {
  const d = data as unknown as NoData;
  const meta = NO_META[d.tipo] || NO_META.vertical;
  const Icon = meta.icon;

  return (
    <div
      className="relative cursor-pointer select-none"
      onDoubleClick={() => d.onEdit?.(id)}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !border-0 !bg-white/30" />
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !border-0 !bg-white/30" />

      <div
        className="min-w-[130px] max-w-[200px] rounded-lg px-3 py-2 text-sm font-medium transition-all"
        style={{
          border: `2px solid ${meta.cor}`,
          backgroundColor: `${meta.cor}15`,
          boxShadow: selected ? `0 0 0 2px ${meta.cor}80, 0 4px 24px ${meta.cor}30` : `0 2px 8px ${meta.cor}20`,
        }}
      >
        <div className="flex items-center gap-1.5 mb-0.5">
          <Icon className="h-3 w-3 flex-shrink-0" style={{ color: meta.cor }} />
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: meta.cor }}>
            {meta.label}
          </span>
        </div>
        <p className="text-xs text-white font-semibold leading-snug">{d.label}</p>
        {d.descricao && (
          <p className="text-[10px] text-white/50 mt-0.5 leading-snug line-clamp-2">{d.descricao}</p>
        )}
        {(d.funil_nome || d.projeto_nome) && (
          <div className="mt-1 flex items-center gap-1">
            <ExternalLink className="h-2.5 w-2.5" style={{ color: meta.cor }} />
            <span className="text-[9px] truncate" style={{ color: meta.cor }}>
              {d.funil_nome || d.projeto_nome}
            </span>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !border-0 !bg-white/30" />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !border-0 !bg-white/30" />
    </div>
  );
}

const NODE_TYPES = { mapaNo: MapaNoComponent };

// ── Main page ─────────────────────────────────────────────────────────────────

interface MapaMeta { id: string; nome: string }
interface ProjetoOpt { id: string; nome: string }
interface FunilOpt  { id: string; nome: string }

let nodeCounter = 1;
function newId() { return `no-${Date.now()}-${nodeCounter++}`; }

export default function MapaEmpresa() {
  const navigate = useNavigate();

  // Maps list
  const [mapas, setMapas] = useState<MapaMeta[]>([]);
  const [mapaAtualId, setMapaAtualId] = useState<string | null>(null);
  const [mapaLoading, setMapaLoading] = useState(false);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const rfInstance = useRef<unknown>(null);

  // UI state
  const [saving, setSaving] = useState(false);
  const [editNoId, setEditNoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<NoData>>({});
  const [projetos, setProjetos] = useState<ProjetoOpt[]>([]);
  const [funis, setFunis] = useState<FunilOpt[]>([]);
  const [showNomeDialog, setShowNomeDialog] = useState(false);
  const [novoNome, setNovoNome] = useState("");

  const autoSaveTimer = useRef<NodeJS.Timeout>();

  // ── Load options ──────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      const [{ data: proj }, { data: fun }] = await Promise.all([
        supabase.from("imphq_projects").select("id, name").order("name"),
        supabase.from("imphq_funis").select("id, nome").order("nome"),
      ]);
      setProjetos((proj || []).map((p: { id: string; name: string }) => ({ id: p.id, nome: p.name })));
      setFunis((fun || []).map((f: { id: string; nome: string }) => ({ id: f.id, nome: f.nome })));
    };
    load();
    loadMapas();
  }, []);

  // ── Load mapas list ───────────────────────────────────────────────────────

  const loadMapas = async () => {
    const { data } = await supabase
      .from("imphq_mapas_empresa")
      .select("id, nome")
      .order("criado_em", { ascending: true });
    const list: MapaMeta[] = (data || []).map((m: { id: string; nome: string }) => ({ id: m.id, nome: m.nome }));
    setMapas(list);
    if (list.length > 0 && !mapaAtualId) {
      loadMapa(list[0].id);
    }
  };

  // ── Load specific map ─────────────────────────────────────────────────────

  const loadMapa = async (id: string) => {
    setMapaLoading(true);
    setMapaAtualId(id);
    const { data } = await supabase
      .from("imphq_mapas_empresa")
      .select("data")
      .eq("id", id)
      .single();

    const mapData = data?.data as { nos?: unknown[]; arestas?: unknown[] } | null;
    const nos = (mapData?.nos || []) as Array<{
      id: string; tipo: NoTipo; label: string; descricao?: string;
      pos_x: number; pos_y: number; projeto_id?: string; funil_id?: string;
      projeto_nome?: string; funil_nome?: string;
    }>;
    const arestas = (mapData?.arestas || []) as Array<{ id: string; source: string; target: string }>;

    setNodes(nos.map(n => ({
      id: n.id,
      type: "mapaNo",
      position: { x: n.pos_x || 0, y: n.pos_y || 0 },
      data: {
        tipo: n.tipo,
        label: n.label,
        descricao: n.descricao,
        projeto_id: n.projeto_id,
        funil_id: n.funil_id,
        projeto_nome: n.projeto_nome,
        funil_nome: n.funil_nome,
        onEdit: handleEditNo,
      },
    })));

    setEdges(arestas.map(a => ({
      id: a.id,
      source: a.source,
      target: a.target,
      type: "smoothstep",
      animated: true,
      style: { stroke: "#f59e0b55", strokeDasharray: "6,3", strokeWidth: 1.5 },
    })));
    setMapaLoading(false);
  };

  // ── Auto-save ─────────────────────────────────────────────────────────────

  const triggerSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => saveCurrentMap(), 1400);
  }, [nodes, edges, mapaAtualId]);

  useEffect(() => { triggerSave(); }, [nodes, edges]);

  const saveCurrentMap = async () => {
    if (!mapaAtualId) return;
    setSaving(true);
    const nos = nodes.map(n => ({
      id: n.id,
      tipo: (n.data as unknown as NoData).tipo,
      label: (n.data as unknown as NoData).label,
      descricao: (n.data as unknown as NoData).descricao,
      projeto_id: (n.data as unknown as NoData).projeto_id,
      funil_id: (n.data as unknown as NoData).funil_id,
      projeto_nome: (n.data as unknown as NoData).projeto_nome,
      funil_nome: (n.data as unknown as NoData).funil_nome,
      pos_x: n.position.x,
      pos_y: n.position.y,
    }));
    const arestas = edges.map(e => ({ id: e.id, source: e.source, target: e.target }));
    await supabase
      .from("imphq_mapas_empresa")
      .update({ data: { nos, arestas }, atualizado_em: new Date().toISOString() })
      .eq("id", mapaAtualId);
    setSaving(false);
  };

  // ── Connect nodes ─────────────────────────────────────────────────────────

  const onConnect = useCallback((connection: Connection) => {
    setEdges(eds => addEdge({
      ...connection,
      id: `e-${Date.now()}`,
      type: "smoothstep",
      animated: true,
      style: { stroke: "#f59e0b55", strokeDasharray: "6,3", strokeWidth: 1.5 },
    }, eds));
  }, [setEdges]);

  // ── Add node ──────────────────────────────────────────────────────────────

  const addNode = (tipo: NoTipo) => {
    if (!mapaAtualId) { toast.error("Selecione ou crie um mapa primeiro"); return; }
    const meta = NO_META[tipo];
    const id = newId();
    const newNode: Node = {
      id,
      type: "mapaNo",
      position: { x: 100 + Math.random() * 400, y: 100 + Math.random() * 300 },
      data: {
        tipo,
        label: meta.label,
        descricao: "",
        onEdit: handleEditNo,
      },
    };
    setNodes(nds => [...nds, newNode]);
    // Open edit immediately
    setTimeout(() => handleEditNo(id), 100);
  };

  // ── Edit node ─────────────────────────────────────────────────────────────

  const handleEditNo = useCallback((id: string) => {
    setEditNoId(id);
  }, []);

  useEffect(() => {
    if (editNoId) {
      const node = nodes.find(n => n.id === editNoId);
      if (node) setEditForm({ ...(node.data as unknown as NoData) });
    }
  }, [editNoId, nodes]);

  const saveEditNo = () => {
    if (!editNoId) return;
    setNodes(nds => nds.map(n => n.id === editNoId
      ? { ...n, data: { ...n.data, ...editForm, onEdit: handleEditNo } }
      : n
    ));
    setEditNoId(null);
    setEditForm({});
  };

  const deleteNode = (id: string) => {
    setNodes(nds => nds.filter(n => n.id !== id));
    setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
    setEditNoId(null);
  };

  // ── Navigate to linked resource ───────────────────────────────────────────

  const openLinked = (data: NoData) => {
    if (data.funil_id) {
      navigate("/funis");
      toast.info(`Abrindo funil: ${data.funil_nome || data.funil_id}`);
    } else if (data.projeto_id) {
      navigate(`/projetos/${data.projeto_id}`);
    }
  };

  // ── Create new map ────────────────────────────────────────────────────────

  const criarMapa = async () => {
    if (!novoNome.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("imphq_mapas_empresa")
      .insert({ nome: novoNome.trim(), user_id: user?.id, data: { nos: [], arestas: [] } })
      .select("id, nome")
      .single();
    if (error) { toast.error("Erro ao criar mapa"); return; }
    const novo = { id: data.id, nome: data.nome };
    setMapas(m => [...m, novo]);
    setShowNomeDialog(false);
    setNovoNome("");
    setNodes([]);
    setEdges([]);
    setMapaAtualId(data.id);
    toast.success(`Mapa "${data.nome}" criado!`);
  };

  // ── Node click (single) for navigation ───────────────────────────────────

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const d = node.data as unknown as NoData;
    if ((d.funil_id || d.projeto_id) && !editNoId) {
      // Single click with link: navigate after a brief pause (to avoid conflict with double-click)
    }
  }, [editNoId]);

  const mapaAtualNome = mapas.find(m => m.id === mapaAtualId)?.nome || "";

  // Inject onEdit into nodes after load (React Flow requires stable references)
  const nodesWithCallback = nodes.map(n => ({
    ...n,
    data: { ...n.data, onEdit: handleEditNo },
  }));

  const editNode = nodes.find(n => n.id === editNoId);
  const editMeta = editForm.tipo ? NO_META[editForm.tipo] : null;

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col bg-background">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-background/90 backdrop-blur-sm shrink-0">
        <Network className="h-4 w-4 text-primary" />
        <span className="font-semibold text-sm text-primary">Mapa da Empresa</span>
        <div className="w-px h-4 bg-border/50 mx-1" />

        {/* Map selector */}
        <Select value={mapaAtualId || ""} onValueChange={loadMapa}>
          <SelectTrigger className="h-7 text-xs w-[180px] bg-secondary border-border/50">
            <SelectValue placeholder="Selecionar mapa..." />
          </SelectTrigger>
          <SelectContent>
            {mapas.map(m => (
              <SelectItem key={m.id} value={m.id} className="text-xs">{m.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 px-2" onClick={() => setShowNomeDialog(true)}>
          <Plus className="h-3 w-3" /> Novo mapa
        </Button>

        <div className="flex-1" />

        {saving && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Loader2 className="h-2.5 w-2.5 animate-spin" /> Salvando...
          </span>
        )}

        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 px-2 border-border/50" onClick={saveCurrentMap} disabled={saving || !mapaAtualId}>
          <Save className="h-3 w-3" /> Salvar
        </Button>
      </div>

      {/* ── Canvas + right sidebar ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* React Flow canvas */}
        <div className="flex-1 relative">
          {!mapaAtualId ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
              <Map className="h-12 w-12 opacity-20" />
              <p className="text-sm">Crie ou selecione um mapa para começar</p>
              <Button size="sm" onClick={() => setShowNomeDialog(true)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Criar primeiro mapa
              </Button>
            </div>
          ) : mapaLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <ReactFlow
              nodes={nodesWithCallback}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              nodeTypes={NODE_TYPES}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              deleteKeyCode="Delete"
              className="bg-background"
            >
              <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#ffffff08" />
              <Controls className="[&>button]:bg-secondary [&>button]:border-border/50 [&>button]:text-foreground" />
              <MiniMap
                className="!bg-secondary/80 !border !border-border/50 !rounded-lg"
                nodeColor={(n) => {
                  const t = (n.data as unknown as NoData)?.tipo;
                  return t ? NO_META[t]?.cor || "#6b7280" : "#6b7280";
                }}
              />
              <Panel position="top-left">
                <div className="text-[10px] text-muted-foreground/50 bg-background/80 rounded px-2 py-1 border border-border/30">
                  {mapaAtualNome} · {nodes.length} nós · Duplo-clique para editar
                </div>
              </Panel>
            </ReactFlow>
          )}
        </div>

        {/* Right sidebar — add nodes */}
        <div className="w-52 border-l border-border/50 bg-secondary/30 flex flex-col p-3 gap-1 shrink-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold mb-2">
            ADICIONAR NÓ
          </p>
          {(Object.entries(NO_META) as [NoTipo, typeof NO_META[NoTipo]][]).map(([tipo, meta]) => {
            const Icon = meta.icon;
            return (
              <button
                key={tipo}
                onClick={() => addNode(tipo)}
                disabled={!mapaAtualId}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition-all hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed group"
                style={{ border: `1px solid ${meta.cor}40` }}
              >
                <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${meta.cor}20` }}>
                  <Icon className="h-3 w-3" style={{ color: meta.cor }} />
                </div>
                <span style={{ color: meta.cor }}>{meta.label}</span>
              </button>
            );
          })}

          <div className="flex-1" />

          {nodes.length > 0 && (
            <div className="border-t border-border/50 pt-2 mt-1">
              <p className="text-[9px] text-muted-foreground/40 text-center">
                Delete = remover nó selecionado
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Edit node dialog ── */}
      <Dialog open={!!editNoId} onOpenChange={v => { if (!v) { setEditNoId(null); setEditForm({}); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              {editMeta && (
                <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: `${editMeta.cor}20` }}>
                  <editMeta.icon className="h-3 w-3" style={{ color: editMeta.cor }} />
                </div>
              )}
              Editar nó
              {editMeta && (
                <Badge variant="outline" className="text-[10px] ml-1" style={{ borderColor: `${editMeta.cor}60`, color: editMeta.cor }}>
                  {editMeta.label}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Nome *</Label>
              <Input
                value={editForm.label || ""}
                onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))}
                className="bg-secondary text-sm h-8"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Descrição</Label>
              <Textarea
                value={editForm.descricao || ""}
                onChange={e => setEditForm(f => ({ ...f, descricao: e.target.value }))}
                className="bg-secondary text-xs min-h-[60px] resize-none"
                placeholder="Detalhes, responsável, métricas..."
              />
            </div>

            {/* Link to project */}
            {(editForm.tipo === "produto" || editForm.tipo === "vertical") && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Vincular Projeto</Label>
                <Select
                  value={editForm.projeto_id || "__none__"}
                  onValueChange={v => {
                    const proj = projetos.find(p => p.id === v);
                    setEditForm(f => ({ ...f, projeto_id: v === "__none__" ? undefined : v, projeto_nome: proj?.nome }));
                  }}
                >
                  <SelectTrigger className="bg-secondary h-8 text-xs"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" className="text-xs">— Nenhum —</SelectItem>
                    {projetos.map(p => <SelectItem key={p.id} value={p.id} className="text-xs">{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Link to funil */}
            {(editForm.tipo === "produto" || editForm.tipo === "canal" || editForm.tipo === "processo") && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Vincular Funil</Label>
                <Select
                  value={editForm.funil_id || "__none__"}
                  onValueChange={v => {
                    const funil = funis.find(f => f.id === v);
                    setEditForm(f => ({ ...f, funil_id: v === "__none__" ? undefined : v, funil_nome: funil?.nome }));
                  }}
                >
                  <SelectTrigger className="bg-secondary h-8 text-xs"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" className="text-xs">— Nenhum —</SelectItem>
                    {funis.map(f => <SelectItem key={f.id} value={f.id} className="text-xs">{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Navigate to linked resource */}
            {(editForm.funil_id || editForm.projeto_id) && (
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-1.5 text-xs h-7 border-primary/30 text-primary"
                onClick={() => { openLinked(editForm as NoData); setEditNoId(null); }}
              >
                <ExternalLink className="h-3 w-3" />
                Abrir {editForm.funil_id ? "Funil" : "Projeto"}
              </Button>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive gap-1 mr-auto"
              onClick={() => editNoId && deleteNode(editNoId)}
            >
              <Trash2 className="h-3.5 w-3.5" /> Remover
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setEditNoId(null); setEditForm({}); }}>Cancelar</Button>
            <Button size="sm" onClick={saveEditNo} disabled={!editForm.label?.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── New map dialog ── */}
      <Dialog open={showNomeDialog} onOpenChange={setShowNomeDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm">Novo Mapa</DialogTitle>
          </DialogHeader>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Nome do mapa</Label>
            <Input
              value={novoNome}
              onChange={e => setNovoNome(e.target.value)}
              placeholder="Ex: JP Freitas, iGaming 2025..."
              className="bg-secondary text-sm h-8"
              autoFocus
              onKeyDown={e => e.key === "Enter" && criarMapa()}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setShowNomeDialog(false)}>Cancelar</Button>
            <Button size="sm" onClick={criarMapa} disabled={!novoNome.trim()}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

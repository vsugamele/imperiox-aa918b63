import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FileUpload } from "@/components/FileUpload";
import { Plus, Trash2, ChevronLeft, Eye, ShoppingCart, ArrowRight, Save, ExternalLink, Image, ZoomIn, ZoomOut, GripVertical } from "lucide-react";
import { toast } from "sonner";

interface Etapa {
  nome: string; tipo?: string; visitantes: number; conversoes: number;
  url?: string; image_url?: string; pos_x?: number; pos_y?: number;
  descricao?: string; connects_to?: number[];
}
interface Funil {
  id: string; nome: string; tipo?: string; status?: string; url?: string;
  project_id?: string; data: { etapas?: Etapa[] }; criado_em?: string;
}

const DEFAULT_ETAPAS: Etapa[] = [
  { nome: "Anúncio", tipo: "criativo", visitantes: 0, conversoes: 0, pos_x: 80, pos_y: 80 },
  { nome: "Opt-in", tipo: "pagina", visitantes: 0, conversoes: 0, pos_x: 400, pos_y: 80 },
  { nome: "VSL/Webinar", tipo: "vsl", visitantes: 0, conversoes: 0, pos_x: 720, pos_y: 80 },
  { nome: "Checkout", tipo: "checkout", visitantes: 0, conversoes: 0, pos_x: 1040, pos_y: 80 },
  { nome: "Upsell", tipo: "upsell", visitantes: 0, conversoes: 0, pos_x: 1360, pos_y: 80 },
];

const TIPO_STYLES: Record<string, { bg: string; border: string; text: string; label: string }> = {
  criativo: { bg: "bg-rose-500/10", border: "border-rose-500/40", text: "text-rose-400", label: "Criativo" },
  pagina: { bg: "bg-blue-500/10", border: "border-blue-500/40", text: "text-blue-400", label: "Página" },
  vsl: { bg: "bg-violet-500/10", border: "border-violet-500/40", text: "text-violet-400", label: "VSL" },
  checkout: { bg: "bg-emerald-500/10", border: "border-emerald-500/40", text: "text-emerald-400", label: "Checkout" },
  upsell: { bg: "bg-amber-500/10", border: "border-amber-500/40", text: "text-amber-400", label: "Upsell" },
  outro: { bg: "bg-gray-500/10", border: "border-gray-500/40", text: "text-gray-400", label: "Outro" },
};
const TIPOS = Object.keys(TIPO_STYLES);

function getConversionColor(taxa: number) {
  if (taxa >= 30) return { text: "text-emerald-400", dot: "bg-emerald-400" };
  if (taxa >= 10) return { text: "text-amber-400", dot: "bg-amber-400" };
  return { text: "text-red-400", dot: "bg-red-400" };
}

const STATUS_STYLES: Record<string, string> = {
  Ativo: "border-l-emerald-500 from-emerald-500/8 to-transparent",
  Rascunho: "border-l-amber-500 from-amber-500/8 to-transparent",
  Pausado: "border-l-muted-foreground from-muted/10 to-transparent",
};

const CARD_W = 240;
const CARD_H = 340;
const CANVAS_W = 4000;
const CANVAS_H = 3000;

export default function Funis() {
  const [funis, setFunis] = useState<Funil[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [filterProject, setFilterProject] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [selectedFunil, setSelectedFunil] = useState<Funil | null>(null);
  const [form, setForm] = useState({ nome: "", tipo: "Perpétuo", status: "Rascunho", project_id: "" });
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const [fRes, pRes] = await Promise.all([
      supabase.from("imphq_funis").select("*").order("updated_at", { ascending: false }),
      supabase.from("imphq_projects").select("id, name").order("name"),
    ]);
    setFunis((fRes.data || []).map((f: any) => ({ ...f, data: f.data || {} })));
    setProjects(pRes.data || []);
  };

  useEffect(() => { load(); }, []);

  const filtered = funis.filter(f => filterProject === "all" || f.project_id === filterProject);

  const createFunil = async () => {
    if (!form.nome.trim()) { toast.error("Nome obrigatório"); return; }
    const id = crypto.randomUUID();
    const { error } = await supabase.from("imphq_funis").insert([{
      id, nome: form.nome, tipo: form.tipo, status: form.status,
      project_id: form.project_id || null,
      data: { etapas: DEFAULT_ETAPAS } as any,
    }]);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Funil criado!"); setShowNew(false);
    setForm({ nome: "", tipo: "Perpétuo", status: "Rascunho", project_id: "" }); load();
  };

  const deleteFunil = async (id: string) => {
    await supabase.from("imphq_funis").delete().eq("id", id);
    toast.success("Funil removido"); setSelectedFunil(null); load();
  };

  const updateEtapa = async (funilId: string, etapas: Etapa[]) => {
    await supabase.from("imphq_funis").update({ data: { etapas } as any }).eq("id", funilId);
    setSelectedFunil(prev => prev ? { ...prev, data: { ...prev.data, etapas } } : null);
  };

  const addEtapa = () => {
    if (!selectedFunil) return;
    const etapas = selectedFunil.data.etapas || [];
    // Place new card at center of current viewport
    const rect = canvasRef.current?.getBoundingClientRect();
    const cx = rect ? (-pan.x + rect.width / 2) / zoom : 400;
    const cy = rect ? (-pan.y + rect.height / 2) / zoom : 200;
    const newEtapa: Etapa = { nome: "Nova Etapa", tipo: "outro", visitantes: 0, conversoes: 0, pos_x: Math.round(cx - CARD_W / 2), pos_y: Math.round(cy - CARD_H / 2) };
    const updated = [...etapas, newEtapa];
    setSelectedFunil({ ...selectedFunil, data: { ...selectedFunil.data, etapas: updated } });
  };

  const removeEtapa = (idx: number) => {
    if (!selectedFunil) return;
    const updated = (selectedFunil.data.etapas || []).filter((_, i) => i !== idx);
    setSelectedFunil({ ...selectedFunil, data: { ...selectedFunil.data, etapas: updated } });
  };

  const setEtapaField = (idx: number, field: string, value: any) => {
    if (!selectedFunil) return;
    const etapas = [...(selectedFunil.data.etapas || [])];
    etapas[idx] = { ...etapas[idx], [field]: value };
    setSelectedFunil({ ...selectedFunil, data: { ...selectedFunil.data, etapas } });
  };

  const saveEtapas = () => {
    if (!selectedFunil) return;
    updateEtapa(selectedFunil.id, selectedFunil.data.etapas || []);
    toast.success("Etapas salvas!");
  };

  const projectName = (id?: string) => projects.find(p => p.id === id)?.name || "";

  // --- Drag handlers ---
  const handleCardMouseDown = useCallback((e: React.MouseEvent, idx: number) => {
    if ((e.target as HTMLElement).closest("input, select, button, [role='combobox']")) return;
    e.stopPropagation();
    const etapas = selectedFunil?.data.etapas || [];
    const etapa = etapas[idx];
    setDraggingIdx(idx);
    setDragOffset({
      x: e.clientX / zoom - (etapa.pos_x ?? 0),
      y: e.clientY / zoom - (etapa.pos_y ?? 0),
    });
  }, [selectedFunil, zoom]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingIdx !== null && selectedFunil) {
      const etapas = [...(selectedFunil.data.etapas || [])];
      const newX = Math.max(0, Math.round(e.clientX / zoom - dragOffset.x));
      const newY = Math.max(0, Math.round(e.clientY / zoom - dragOffset.y));
      etapas[draggingIdx] = { ...etapas[draggingIdx], pos_x: newX, pos_y: newY };
      setSelectedFunil({ ...selectedFunil, data: { ...selectedFunil.data, etapas } });
      return;
    }
    if (isPanning) {
      setPan({
        x: pan.x + (e.clientX - panStart.x),
        y: pan.y + (e.clientY - panStart.y),
      });
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  }, [draggingIdx, selectedFunil, zoom, dragOffset, isPanning, pan, panStart]);

  const handleMouseUp = useCallback(() => {
    setDraggingIdx(null);
    setIsPanning(false);
  }, []);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".etapa-card")) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setZoom(z => Math.min(2, Math.max(0.25, z + delta)));
  }, []);

  // Canvas detail view
  if (selectedFunil) {
    const etapas = selectedFunil.data.etapas || [];

    // Build connector pairs based on connects_to or sequential
    const connectors: { from: Etapa; to: Etapa; fromIdx: number; toIdx: number }[] = [];
    for (let i = 0; i < etapas.length; i++) {
      const targets = etapas[i].connects_to;
      if (targets && targets.length > 0) {
        for (const t of targets) {
          if (t >= 0 && t < etapas.length && t !== i) {
            connectors.push({ from: etapas[i], to: etapas[t], fromIdx: i, toIdx: t });
          }
        }
      } else if (i < etapas.length - 1) {
        connectors.push({ from: etapas[i], to: etapas[i + 1], fromIdx: i, toIdx: i + 1 });
      }
    }

    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedFunil(null); load(); }}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h1 className="font-display text-2xl font-bold text-primary">{selectedFunil.nome}</h1>
          <Badge variant="outline">{selectedFunil.tipo}</Badge>
          <Badge variant={selectedFunil.status === "Ativo" ? "default" : "secondary"}>{selectedFunil.status}</Badge>
          {selectedFunil.project_id && <Badge variant="outline" className="text-[10px]">{projectName(selectedFunil.project_id)}</Badge>}
          <div className="ml-auto flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(z => Math.max(0.25, z - 0.1))}><ZoomOut className="h-3.5 w-3.5" /></Button>
            <span className="text-xs text-muted-foreground font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(z => Math.min(2, z + 0.1))}><ZoomIn className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="ghost" onClick={() => { setPan({ x: 0, y: 0 }); setZoom(0.85); }}>Reset</Button>
          </div>
        </div>

        {/* 2D Canvas with pan & zoom */}
        <div
          ref={canvasRef}
          className="relative rounded-xl border border-border bg-[radial-gradient(circle,hsl(var(--border))_1px,transparent_1px)] bg-[size:20px_20px] overflow-hidden select-none"
          style={{ height: "75vh", cursor: isPanning ? "grabbing" : draggingIdx !== null ? "move" : "grab" }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <div style={{
            width: CANVAS_W, height: CANVAS_H,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            position: "relative",
          }}>
            {/* SVG Connectors */}
            <svg className="absolute inset-0 pointer-events-none" width={CANVAS_W} height={CANVAS_H}>
              {connectors.map((c, i) => {
                const fromX = (c.from.pos_x ?? 0) + CARD_W;
                const fromY = (c.from.pos_y ?? 0) + CARD_H / 2;
                const toX = (c.to.pos_x ?? 0);
                const toY = (c.to.pos_y ?? 0) + CARD_H / 2;
                const midX = (fromX + toX) / 2;
                return (
                  <g key={i}>
                    <defs>
                      <marker id={`arrow-canvas-${i}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                        <path d="M0,0 L8,4 L0,8" fill="hsl(var(--primary))" opacity="0.5" />
                      </marker>
                    </defs>
                    <path
                      d={`M${fromX},${fromY} C${midX},${fromY} ${midX},${toY} ${toX},${toY}`}
                      stroke="hsl(var(--primary))"
                      strokeWidth="2"
                      fill="none"
                      opacity="0.3"
                      markerEnd={`url(#arrow-canvas-${i})`}
                      strokeDasharray="6 4"
                    >
                      <animate attributeName="stroke-dashoffset" from="20" to="0" dur="2s" repeatCount="indefinite" />
                    </path>
                  </g>
                );
              })}
            </svg>

            {/* Cards */}
            {etapas.map((etapa, i) => {
              const taxa = etapa.visitantes > 0 ? (etapa.conversoes / etapa.visitantes) * 100 : 0;
              const convColors = getConversionColor(taxa);
              const tipoStyle = TIPO_STYLES[etapa.tipo || "outro"] || TIPO_STYLES.outro;
              const x = etapa.pos_x ?? 80;
              const y = etapa.pos_y ?? 80;

              return (
                <div
                  key={i}
                  className={`etapa-card absolute rounded-xl border-2 ${tipoStyle.border} ${tipoStyle.bg} backdrop-blur-sm p-3 space-y-2 hover:shadow-lg transition-shadow`}
                  style={{ left: x, top: y, width: CARD_W, zIndex: draggingIdx === i ? 50 : 1 }}
                  onMouseDown={(e) => handleCardMouseDown(e, i)}
                >
                  {/* Drag handle + index */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="cursor-grab active:cursor-grabbing p-0.5">
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
                      </div>
                      <span className="text-[10px] font-mono font-bold text-muted-foreground bg-secondary/80 rounded px-1.5 py-0.5">#{i}</span>
                    </div>
                    <Badge variant="outline" className={`text-[9px] ${tipoStyle.text} ${tipoStyle.border}`}>
                      {tipoStyle.label}
                    </Badge>
                  </div>

                  {/* Thumbnail */}
                  {etapa.image_url ? (
                    <div className="h-28 rounded-lg overflow-hidden bg-card/50 border border-border">
                      <img src={etapa.image_url} alt={etapa.nome} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className={`h-20 rounded-lg ${tipoStyle.bg} border ${tipoStyle.border} flex items-center justify-center`}>
                      <Image className="h-6 w-6 text-muted-foreground/20" />
                    </div>
                  )}

                  {/* Name - onBlur to prevent focus loss */}
                  <Input
                    defaultValue={etapa.nome}
                    onBlur={e => setEtapaField(i, "nome", e.target.value)}
                    className="h-7 text-xs font-bold bg-transparent border-none p-0 focus-visible:ring-0"
                  />

                  {/* Description */}
                  <Input
                    defaultValue={etapa.descricao || ""}
                    onBlur={e => setEtapaField(i, "descricao", e.target.value)}
                    className="h-6 text-[10px] bg-card/50 border-border p-1"
                    placeholder="Descrição..."
                  />

                  {/* Tipo selector */}
                  <Select value={etapa.tipo || "outro"} onValueChange={v => setEtapaField(i, "tipo", v)}>
                    <SelectTrigger className="h-6 text-[10px] bg-card/50 border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS.map(t => <SelectItem key={t} value={t} className="text-xs">{TIPO_STYLES[t].label}</SelectItem>)}
                    </SelectContent>
                  </Select>

                  {/* URL - onBlur */}
                  <div className="flex items-center gap-1">
                    <Input
                      defaultValue={etapa.url || ""}
                      onBlur={e => setEtapaField(i, "url", e.target.value)}
                      className="h-6 text-[10px] bg-card/50 border-border p-1"
                      placeholder="URL..."
                    />
                    {etapa.url && (
                      <a href={etapa.url} target="_blank" rel="noopener" className="shrink-0">
                        <ExternalLink className="h-3 w-3 text-primary" />
                      </a>
                    )}
                  </div>

                  {/* Connect to */}
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-muted-foreground shrink-0">→</span>
                    <Input
                      defaultValue={(etapa.connects_to || []).join(",")}
                      onBlur={e => {
                        const val = e.target.value.trim();
                        const arr = val ? val.split(",").map(Number).filter(n => !isNaN(n)) : [];
                        setEtapaField(i, "connects_to", arr.length > 0 ? arr : undefined);
                      }}
                      className="h-5 text-[9px] bg-card/50 border-border p-1 font-mono"
                      placeholder="Conecta a: 1,2"
                      title="Índices das etapas destino (0-based), separados por vírgula"
                    />
                  </div>

                  {/* Upload */}
                  <FileUpload
                    bucket="project-media"
                    path={`funis/${selectedFunil.id}`}
                    onUpload={url => setEtapaField(i, "image_url", url)}
                    label="Img"
                    className="[&_button]:h-6 [&_button]:text-[10px]"
                  />

                  {/* Metrics */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Eye className="h-2.5 w-2.5" /> Visitas</p>
                      <Input type="number" value={etapa.visitantes} onChange={e => setEtapaField(i, "visitantes", parseInt(e.target.value) || 0)} className="h-6 text-xs font-mono bg-card/50 border-border p-1" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1"><ShoppingCart className="h-2.5 w-2.5" /> Conv.</p>
                      <Input type="number" value={etapa.conversoes} onChange={e => setEtapaField(i, "conversoes", parseInt(e.target.value) || 0)} className="h-6 text-xs font-mono bg-card/50 border-border p-1" />
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-mono font-bold ${convColors.text}`}>{taxa.toFixed(1)}%</span>
                    <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => removeEtapa(i)}>
                      <Trash2 className="h-2.5 w-2.5 text-destructive" />
                    </Button>
                  </div>

                  <div className="w-full h-1.5 bg-card/30 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${convColors.dot}`} style={{ width: `${Math.min(taxa, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={addEtapa}><Plus className="h-3 w-3 mr-1" /> Etapa</Button>
          <Button size="sm" onClick={saveEtapas}><Save className="h-3 w-3 mr-1" /> Salvar</Button>
          <Button size="sm" variant="destructive" onClick={() => deleteFunil(selectedFunil.id)}><Trash2 className="h-3 w-3 mr-1" /> Excluir</Button>
          <span className="text-[10px] text-muted-foreground ml-2">Arraste os cards para posicionar • Scroll para zoom • Arraste o fundo para mover</span>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-primary">🔗 Funis</h1>
        <Button size="sm" onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" /> Novo Funil</Button>
      </div>

      <div className="flex items-center gap-3">
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue placeholder="Filtrar por projeto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Projetos</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-xs">{filtered.length} funis</Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((f, idx) => {
          const etapas = f.data?.etapas || [];
          const statusStyle = STATUS_STYLES[f.status || "Rascunho"] || STATUS_STYLES.Rascunho;
          return (
            <Card
              key={f.id}
              className={`bg-gradient-to-br ${statusStyle} border-border border-l-4 hover:scale-[1.02] cursor-pointer transition-all duration-200 animate-fade-in`}
              style={{ animationDelay: `${idx * 60}ms`, animationFillMode: "both" }}
              onClick={() => setSelectedFunil(f)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-sm">{f.nome}</h3>
                  <Badge variant={f.status === "Ativo" ? "default" : "outline"} className="text-[10px]">{f.status || "Rascunho"}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{f.tipo || "Perpétuo"} • {etapas.length} etapas</p>
                {f.project_id && <p className="text-[10px] text-muted-foreground mt-1">{projectName(f.project_id)}</p>}
                {etapas.length > 0 && (
                  <div className="flex items-center gap-1 mt-2 overflow-hidden">
                    {etapas.slice(0, 5).map((e, i) => {
                      const ts = TIPO_STYLES[e.tipo || "outro"] || TIPO_STYLES.outro;
                      return (
                        <div key={i} className="flex items-center">
                          <div className={`px-1.5 py-0.5 rounded text-[8px] font-medium ${ts.bg} ${ts.text} border ${ts.border}`}>{e.nome}</div>
                          {i < Math.min(etapas.length, 5) - 1 && <ArrowRight className="h-2 w-2 text-muted-foreground/50 mx-0.5 shrink-0" />}
                        </div>
                      );
                    })}
                    {etapas.length > 5 && <span className="text-[9px] text-muted-foreground">+{etapas.length - 5}</span>}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">Nenhum funil cadastrado</p>}
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Funil</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Funil VSL Principal" /></div>
            <div>
              <Label>Projeto</Label>
              <Select value={form.project_id || "none"} onValueChange={v => setForm({ ...form, project_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Perpétuo">Perpétuo</SelectItem>
                    <SelectItem value="Lançamento">Lançamento</SelectItem>
                    <SelectItem value="Webinar">Webinar</SelectItem>
                    <SelectItem value="VSL">VSL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Rascunho">Rascunho</SelectItem>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                    <SelectItem value="Pausado">Pausado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={createFunil}>Criar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

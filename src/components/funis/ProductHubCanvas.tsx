import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Play, Loader2, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { AssetPicker } from "./AssetPicker";
import { AssetDetailDrawer, HubAsset } from "./AssetDetailDrawer";
import { findItem, COLOR_TOKENS } from "./assetCatalog";
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
  briefing?: any;
}

interface Props {
  projects: Project[];
}

const PRODUCT_NODE_W = 260;
const PRODUCT_NODE_H = 380;
const ASSET_NODE_W = 220;
const ASSET_NODE_H = 130;

export function ProductHubCanvas({ projects }: Props) {
  const [projectId, setProjectId] = useState<string>("");
  const [productIdx, setProductIdx] = useState(0);
  const [assets, setAssets] = useState<HubAsset[]>([]);
  const [funilId, setFunilId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [drawerAsset, setDrawerAsset] = useState<HubAsset | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!projectId && projects.length > 0) setProjectId(projects[0].id);
  }, [projects, projectId]);

  const currentProject = useMemo(() => projects.find(p => p.id === projectId), [projects, projectId]);
  const products = useMemo(() => {
    const b = currentProject?.briefing || {};
    const prods = b?.produtos || b?.products || [];
    return (Array.isArray(prods) ? prods : []).map((p: any) =>
      typeof p === "string" ? { nome: p } : p
    );
  }, [currentProject]);
  const currentProduct = products[productIdx];

  // Load/save hub funil
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const { data } = await supabase
        .from("imphq_funis")
        .select("id, data")
        .eq("project_id", projectId)
        .eq("tipo", "hub")
        .maybeSingle();
      if (data) {
        setFunilId(data.id);
        const hub = (data.data as any)?.hub || {};
        setAssets(hub[currentProduct?.nome || currentProduct?.name || "_"] || []);
      } else {
        setFunilId(null);
        setAssets([]);
      }
    })();
  }, [projectId, productIdx, currentProduct]);

  const persist = async (newAssets: HubAsset[]) => {
    if (!projectId) return;
    const key = currentProduct?.nome || currentProduct?.name || "_";
    if (funilId) {
      const { data: row } = await supabase.from("imphq_funis").select("data").eq("id", funilId).maybeSingle();
      const hub = (row?.data as any)?.hub || {};
      hub[key] = newAssets;
      await supabase.from("imphq_funis").update({ data: { ...(row?.data as any || {}), hub } as any }).eq("id", funilId);
    } else {
      const { data: created } = await supabase.from("imphq_funis").insert([{
        id: crypto.randomUUID(),
        project_id: projectId,
        nome: `Hub: ${currentProject?.name || ""}`.trim(),
        tipo: "hub",
        status: "Ativo",
        data: { hub: { [key]: newAssets } } as any,
      }]).select("id").single();
      if (created) setFunilId(created.id);
    }
  };

  const handleToggle = (catId: string, itemId: string) => {
    const key = `${catId}:${itemId}`;
    const exists = assets.find(a => `${a.catId}:${a.itemId}` === key);
    let next: HubAsset[];
    if (exists) {
      next = assets.filter(a => a.id !== exists.id);
    } else {
      next = [
        ...assets,
        {
          id: crypto.randomUUID(),
          catId, itemId,
          pos_x: 600 + (assets.length % 3) * 260,
          pos_y: 80 + Math.floor(assets.length / 3) * 180,
        },
      ];
    }
    setAssets(next);
    persist(next);
  };

  const handleAddAll = (catId: string) => {
    const cat = findItem(catId, "")?.cat;
    // fallback: get from catalog directly
    import("./assetCatalog").then(({ ASSET_CATEGORIES }) => {
      const c = ASSET_CATEGORIES.find(x => x.id === catId);
      if (!c) return;
      const existingKeys = new Set(assets.map(a => `${a.catId}:${a.itemId}`));
      const toAdd: HubAsset[] = c.items
        .filter(i => !existingKeys.has(`${c.id}:${i.id}`))
        .map((i, idx) => ({
          id: crypto.randomUUID(),
          catId: c.id,
          itemId: i.id,
          pos_x: 600 + ((assets.length + idx) % 3) * 260,
          pos_y: 80 + Math.floor((assets.length + idx) / 3) * 180,
        }));
      const next = [...assets, ...toAdd];
      setAssets(next);
      persist(next);
      toast.success(`${toAdd.length} ativos adicionados`);
    });
  };

  const handleSaveOutput = (assetId: string, output: string) => {
    const next = assets.map(a => a.id === assetId ? { ...a, output, generated_at: new Date().toISOString() } : a);
    setAssets(next);
    persist(next);
    setDrawerAsset(next.find(a => a.id === assetId) || null);
  };

  const handleDelete = (assetId: string) => {
    const next = assets.filter(a => a.id !== assetId);
    setAssets(next);
    persist(next);
  };

  const selectedKeys = useMemo(
    () => new Set(assets.map(a => `${a.catId}:${a.itemId}`)),
    [assets]
  );

  // Pan
  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-node]") || (e.target as HTMLElement).closest("[data-ui]")) return;
    setPanning({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (panning) setPan({ x: e.clientX - panning.x, y: e.clientY - panning.y });
  };
  const onMouseUp = () => setPanning(null);

  // SVG connections from product to assets
  const productCenter = { x: 80 + PRODUCT_NODE_W, y: 80 + PRODUCT_NODE_H / 2 };

  if (!projectId) {
    return (
      <div className="p-6 text-center text-muted-foreground text-sm">Selecione um projeto.</div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-180px)] bg-[#080607] rounded-xl border border-border/40 overflow-hidden">
      {/* Toolbar */}
      <div data-ui className="absolute top-3 left-3 right-3 z-30 flex items-center gap-2">
        <Select value={projectId} onValueChange={(v) => { setProjectId(v); setProductIdx(0); }}>
          <SelectTrigger className="w-[220px] h-8 text-xs bg-[#0a0608]/90 border-border/60"><SelectValue /></SelectTrigger>
          <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
        {products.length > 0 && (
          <Select value={String(productIdx)} onValueChange={(v) => setProductIdx(Number(v))}>
            <SelectTrigger className="w-[240px] h-8 text-xs bg-[#0a0608]/90 border-border/60"><SelectValue /></SelectTrigger>
            <SelectContent>
              {products.map((p: any, i) => (
                <SelectItem key={i} value={String(i)}>{p.nome || p.name || `Produto ${i+1}`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="ml-auto flex items-center gap-1 bg-[#0a0608]/90 border border-border/60 rounded-md p-0.5">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(z => Math.max(0.4, z - 0.1))}><ZoomOut className="h-3.5 w-3.5" /></Button>
          <span className="text-[10px] text-muted-foreground w-9 text-center">{Math.round(zoom * 100)}%</span>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(z => Math.min(2, z + 0.1))}><ZoomIn className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setZoom(1); setPan({x:0,y:0}); }}><Maximize2 className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <div
          className="absolute origin-top-left"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, width: 4000, height: 3000 }}
        >
          {/* SVG connections */}
          <svg className="absolute inset-0 pointer-events-none" width="4000" height="3000">
            {currentProduct && assets.map(a => {
              const start = productCenter;
              const end = { x: a.pos_x, y: a.pos_y + ASSET_NODE_H / 2 };
              const midX = (start.x + end.x) / 2;
              const d = `M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${end.y}, ${end.x} ${end.y}`;
              return (
                <g key={a.id}>
                  <path d={d} stroke="rgb(34 197 94 / 0.6)" strokeWidth="1.5" strokeDasharray="5 5" fill="none" />
                  <circle cx={start.x} cy={start.y} r="4" fill="rgb(34 197 94)" />
                  <circle cx={end.x} cy={end.y} r="4" fill="rgb(34 197 94)" />
                </g>
              );
            })}
          </svg>

          {/* Product node */}
          {currentProduct && (
            <div
              data-node
              className="absolute rounded-xl border-2 border-emerald-700/60 bg-[#0a0608] overflow-hidden shadow-2xl"
              style={{ left: 80, top: 80, width: PRODUCT_NODE_W, height: PRODUCT_NODE_H }}
            >
              <div className="bg-emerald-900/40 text-emerald-200 text-xs font-semibold text-center py-1.5 border-b border-emerald-700/40">
                Produto
              </div>
              {(currentProduct.imagem || currentProduct.image) && (
                <img src={currentProduct.imagem || currentProduct.image} alt="" className="w-full h-44 object-cover" />
              )}
              <div className="p-3 space-y-1">
                <h3 className="text-sm font-semibold text-foreground leading-tight">
                  {currentProduct.nome || currentProduct.name}
                </h3>
                {(currentProduct.preco_por || currentProduct.preco) && (
                  <p className="text-xs text-emerald-400 font-semibold">R$ {currentProduct.preco_por || currentProduct.preco}</p>
                )}
                {currentProduct.descricao && (
                  <p className="text-[10px] text-muted-foreground line-clamp-3 mt-1">{currentProduct.descricao}</p>
                )}
                {currentProduct.idioma && (
                  <p className="text-[9px] text-muted-foreground mt-1">{currentProduct.idioma}</p>
                )}
              </div>
            </div>
          )}

          {/* + button next to product */}
          {currentProduct && (
            <button
              data-node
              onClick={() => setPickerOpen(o => !o)}
              className="absolute h-7 w-7 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg z-10"
              style={{ left: 80 + PRODUCT_NODE_W + 12, top: 80 + PRODUCT_NODE_H / 2 - 14 }}
            >
              <Plus className="h-4 w-4" />
            </button>
          )}

          {/* Asset picker (anchored to + button) */}
          {pickerOpen && (
            <div
              data-node
              className="absolute z-20"
              style={{ left: 80 + PRODUCT_NODE_W + 60, top: 80 }}
            >
              <AssetPicker
                selectedItems={selectedKeys}
                onToggle={handleToggle}
                onAddAll={handleAddAll}
              />
            </div>
          )}

          {/* Asset nodes */}
          {assets.map(a => {
            const meta = findItem(a.catId, a.itemId);
            if (!meta) return null;
            const colors = COLOR_TOKENS[meta.cat.color];
            return (
              <div
                key={a.id}
                data-node
                className={`absolute rounded-xl border-2 ${colors.border} bg-[#0a0608] overflow-hidden shadow-xl group cursor-pointer hover:scale-[1.02] transition-transform`}
                style={{ left: a.pos_x, top: a.pos_y, width: ASSET_NODE_W }}
                onClick={() => setDrawerAsset(a)}
              >
                <div className={`${colors.header} text-xs font-semibold text-center py-1.5 border-b ${colors.border}`}>
                  {meta.cat.label}
                </div>
                <div className="p-3 space-y-1">
                  <h4 className="text-sm font-semibold text-foreground leading-tight">{meta.item.label}</h4>
                  <p className="text-[10px] text-muted-foreground line-clamp-2">{meta.item.promptHint}</p>
                  {a.output && (
                    <p className="text-[9px] text-emerald-400 mt-1">✓ gerado</p>
                  )}
                </div>
                <div className="absolute -top-3 right-2 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); setDrawerAsset(a); }}
                    className="h-6 w-6 rounded-md bg-card border border-border/60 flex items-center justify-center hover:bg-pink-600/40"
                    title="Abrir"
                  >
                    <Play className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }}
                    className="h-6 w-6 rounded-md bg-card border border-border/60 flex items-center justify-center hover:bg-red-600/40"
                    title="Remover"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Empty state */}
      {!currentProduct && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-sm text-muted-foreground">Adicione produtos no Briefing deste projeto.</p>
        </div>
      )}

      {/* Drawer */}
      <AssetDetailDrawer
        open={!!drawerAsset}
        onClose={() => setDrawerAsset(null)}
        asset={drawerAsset}
        product={currentProduct}
        projectId={projectId}
        onSaveOutput={handleSaveOutput}
      />
    </div>
  );
}

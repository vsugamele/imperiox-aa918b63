import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Trash2, Play, ZoomIn, ZoomOut, Maximize2, Package, Check, Circle, CircleDot, CheckCircle2, Filter, Sparkles, Workflow } from "lucide-react";
import { HubAuditPanel } from "./HubAuditPanel";
import { AssetPicker } from "./AssetPicker";
import { ChecklistSidebar } from "./ChecklistSidebar";
import { AssetDetailDrawer, HubAsset as BaseHubAsset } from "./AssetDetailDrawer";
import { findItem, COLOR_TOKENS, isProductLinkedAsset, PRODUCT_LINKED_ASSETS } from "./assetCatalog";
import { LinkProductDialog } from "./LinkProductDialog";
import { LinkFlowDialog } from "./LinkFlowDialog";
import { useFlowStats } from "@/hooks/useFlowStats";
import { Link as RouterLink } from "react-router-dom";
import { Zap } from "lucide-react";
import { ASSET_PACKAGES } from "./assetPackages";
import { ProductImageMenu } from "./ProductImageMenu";
import { FlowGeneratorDialog } from "./FlowGeneratorDialog";
import { ImportProductDialog } from "./ImportProductDialog";
import { EcosystemDrawer } from "./EcosystemDrawer";
import { ProductChecklistDrawer } from "./ProductChecklistDrawer";
import { ChecklistFloatingBox } from "./ChecklistFloatingBox";
import { Globe, ListChecks } from "lucide-react";
import { Download } from "lucide-react";
import { SalesScriptAutopilotDialog } from "./SalesScriptAutopilotDialog";
import { FlowBlueprintCanvas } from "./FlowBlueprintCanvas";
import { useFunnelRevenue, getProductRevenue } from "@/hooks/useFunnelRevenue";
import { RevenueOverlayBar, NodeRevenueBadge, LiveActivityFeed, useFunnelLiveActivity } from "./RevenueOverlay";
import { DollarSign } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isDslOutput as isDslOutputCheck } from "@/lib/dsl-parser";
import { isChannelOutput, parseChannelConfig } from "@/lib/channel-config";

export type AssetStatus = "pending" | "generated" | "reviewed" | "approved";

export interface HubAsset extends BaseHubAsset {
  status?: AssetStatus;
}

interface Project {
  id: string;
  name: string;
  briefing?: any;
}

interface Props {
  projects: Project[];
  onProjectsReload?: () => void | Promise<void>;
}

const PRODUCT_NODE_W = 260;
const PRODUCT_NODE_H = 380;
const ASSET_NODE_W = 220;
const ASSET_NODE_H = 130;
const GRID = 20;

const STATUS_META: Record<AssetStatus, { label: string; color: string; icon: any; next: AssetStatus | null }> = {
  pending:   { label: "Pendente",  color: "text-muted-foreground bg-muted/40 border-muted-foreground/40", icon: Circle, next: "generated" },
  generated: { label: "Gerado",    color: "text-amber-300 bg-amber-500/15 border-amber-500/50",            icon: CircleDot, next: "reviewed" },
  reviewed:  { label: "Revisado",  color: "text-sky-300 bg-sky-500/15 border-sky-500/50",                  icon: CircleDot, next: "approved" },
  approved:  { label: "Aprovado",  color: "text-emerald-300 bg-emerald-500/15 border-emerald-500/50",      icon: CheckCircle2, next: null },
};

const STATUS_FILTERS: Array<{ id: "all" | AssetStatus; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "pending", label: "Pendentes" },
  { id: "generated", label: "Gerados" },
  { id: "reviewed", label: "Revisados" },
  { id: "approved", label: "Aprovados" },
];

function snap(n: number) { return Math.round(n / GRID) * GRID; }

export function ProductHubCanvas({ projects, onProjectsReload }: Props) {
  const [projectId, setProjectId] = useState<string>("");
  const [productIdx, setProductIdx] = useState(0);
  const [assets, setAssets] = useState<HubAsset[]>([]);
  const [funilId, setFunilId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [productChecklistOpen, setProductChecklistOpen] = useState(false);
  const [checklistBoxVisible, setChecklistBoxVisible] = useState<boolean>(() => localStorage.getItem("hub:checklistBoxVisible") !== "0");
  const [drawerAsset, setDrawerAsset] = useState<HubAsset | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState<{ x: number; y: number } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [draggingProduct, setDraggingProduct] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [productPosMap, setProductPosMap] = useState<Record<string, { x: number; y: number }>>(() => {
    try { return JSON.parse(localStorage.getItem("hub:productPos") || "{}"); } catch { return {}; }
  });
  const productKey = `${projectId}:${productIdx}`;
  const productPos = productPosMap[productKey] || { x: 80, y: 80 };
  const setProductPos = (pos: { x: number; y: number }, persistNow = false) => {
    setProductPosMap(prev => {
      const next = { ...prev, [productKey]: pos };
      if (persistNow) {
        try { localStorage.setItem("hub:productPos", JSON.stringify(next)); } catch {}
      }
      return next;
    });
  };
  const [statusFilter, setStatusFilter] = useState<"all" | AssetStatus>("all");
  const [auditOpen, setAuditOpen] = useState(false);
  const [imageOverrides, setImageOverrides] = useState<Record<string, string>>({});
  const [flowGenOpen, setFlowGenOpen] = useState(false);
  const [autopilotOpen, setAutopilotOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [ecosystemOpen, setEcosystemOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [flowGenPreset, setFlowGenPreset] = useState<{ objetivo?: string; canal?: string; tom?: string; title?: string } | null>(null);
  const [openBlueprintId, setOpenBlueprintId] = useState<string | null>(null);
  const [blueprints, setBlueprints] = useState<Array<{ id: string; title: string; objetivo?: string }>>([]);
  const [linkDialog, setLinkDialog] = useState<{ assetId: string; catId: string; itemId: string } | null>(null);
  const [flowLinkDialog, setFlowLinkDialog] = useState<{ assetId: string; currentFlowId?: string | null; label: string } | null>(null);
  const [pnlOpen, setPnlOpen] = useState<boolean>(() => localStorage.getItem("hub:pnlOpen") === "1");
  const [pnlDays, setPnlDays] = useState<number>(() => Number(localStorage.getItem("hub:pnlDays") || 30));
  const [liveFeedOpen, setLiveFeedOpen] = useState<boolean>(() => localStorage.getItem("hub:liveFeed") !== "0");
  const revenue = useFunnelRevenue(pnlOpen ? projectId : "", pnlDays);
  const liveActivity = useFunnelLiveActivity(projectId);
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
        const list = (hub[currentProduct?.nome || currentProduct?.name || "_"] || []) as HubAsset[];
        setAssets(list.map(a => ({ ...a, status: a.status || (a.output ? "generated" : "pending") })));
      } else {
        setFunilId(null);
        setAssets([]);
      }
    })();
  }, [projectId, productIdx, currentProduct]);

  const reloadBlueprints = async () => {
    if (!projectId) { setBlueprints([]); return; }
    const { data } = await supabase
      .from("imphq_flow_blueprints")
      .select("id, title, objetivo")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setBlueprints((data as any) || []);
  };
  useEffect(() => { reloadBlueprints(); }, [projectId]);



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

  const handleImportedProduct = async (produto: any) => {
    if (!projectId) return;
    const { data: row } = await supabase.from("imphq_projects").select("data").eq("id", projectId).maybeSingle();
    const d: any = (row?.data && typeof row.data === "object") ? row.data : {};
    const briefing = (d.briefing && typeof d.briefing === "object") ? d.briefing : null;
    const target = briefing || d;
    const list = Array.isArray(target.produtos) ? target.produtos : [];
    target.produtos = [...list, produto];
    const newData = briefing ? { ...d, briefing: target } : { ...d, produtos: target.produtos };
    await supabase.from("imphq_projects").update({ data: newData }).eq("id", projectId);
    await onProjectsReload?.();
    setProductIdx(list.length); // novo produto vira o atual
  };


  const handleToggle = (catId: string, itemId: string) => {
    const key = `${catId}:${itemId}`;
    const exists = assets.find(a => `${a.catId}:${a.itemId}` === key);
    let next: HubAsset[];
    if (exists) {
      next = assets.filter(a => a.id !== exists.id);
    } else {
      const id = crypto.randomUUID();
      const productLinked = isProductLinkedAsset(catId, itemId);
      // auto-link se houver só 1 produto; caso 2+, abre dialog após inserir
      const autoLinkNome = productLinked && products.length === 1
        ? (products[0]?.nome || products[0]?.name || null)
        : null;
      next = [
        ...assets,
        {
          id,
          catId, itemId,
          pos_x: snap(600 + (assets.length % 3) * 260),
          pos_y: snap(80 + Math.floor(assets.length / 3) * 180),
          status: "pending",
          linked_product_nome: autoLinkNome,
        },
      ];
      if (productLinked && products.length > 1) {
        setLinkDialog({ assetId: id, catId, itemId });
      }
    }
    setAssets(next);
    persist(next);
  };

  const handleLinkProduct = (assetId: string, produtoNome: string | null) => {
    const next = assets.map(a => a.id === assetId ? { ...a, linked_product_nome: produtoNome } : a);
    setAssets(next);
    persist(next);
    if (drawerAsset?.id === assetId) {
      setDrawerAsset(next.find(a => a.id === assetId) || null);
    }
  };

  const handleLinkFlow = (assetId: string, flowId: string | null, flowNome: string | null) => {
    const next = assets.map(a => a.id === assetId ? { ...a, linked_flow_id: flowId, linked_flow_nome: flowNome } : a);
    setAssets(next);
    persist(next);
    if (drawerAsset?.id === assetId) setDrawerAsset(next.find(a => a.id === assetId) || null);
  };

  const linkedFlowIds = useMemo(() => assets.map(a => a.linked_flow_id).filter(Boolean) as string[], [assets]);
  const flowStats = useFlowStats(linkedFlowIds);



  const handleAddSuggested = (catId: string, itemId: string) => {
    const key = `${catId}:${itemId}`;
    if (assets.find(a => `${a.catId}:${a.itemId}` === key)) return;
    const next: HubAsset[] = [
      ...assets,
      {
        id: crypto.randomUUID(),
        catId, itemId,
        pos_x: snap(600 + (assets.length % 3) * 260),
        pos_y: snap(80 + Math.floor(assets.length / 3) * 180),
        status: "pending",
      },
    ];
    setAssets(next);
    persist(next);
  };

  const handleAddAll = (catId: string) => {
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
          pos_x: snap(600 + ((assets.length + idx) % 3) * 260),
          pos_y: snap(80 + Math.floor((assets.length + idx) / 3) * 180),
          status: "pending",
        }));
      const next = [...assets, ...toAdd];
      setAssets(next);
      persist(next);
      toast.success(`${toAdd.length} ativos adicionados`);
    });
  };

  const handleAddPackage = (pkgId: string) => {
    const pkg = ASSET_PACKAGES.find(p => p.id === pkgId);
    if (!pkg) return;
    const existingKeyMap = new Map<string, string>();
    assets.forEach(a => existingKeyMap.set(`${a.catId}:${a.itemId}`, a.id));
    const toAdd: HubAsset[] = [];
    pkg.items.forEach((it, idx) => {
      const key = `${it.catId}:${it.itemId}`;
      if (existingKeyMap.has(key)) return;
      const id = crypto.randomUUID();
      existingKeyMap.set(key, id);
      toAdd.push({
        id, catId: it.catId, itemId: it.itemId,
        pos_x: snap(600 + ((assets.length + idx) % 4) * 240),
        pos_y: snap(80 + Math.floor((assets.length + idx) / 4) * 160),
        status: "pending",
        edges: [],
      });
    });
    if (toAdd.length === 0) {
      toast.info("Todos os ativos deste pacote já estão no canvas");
      return;
    }
    let next = [...assets, ...toAdd];
    if (pkg.edges?.length) {
      next = next.map(a => {
        const fromKey = `${a.catId}:${a.itemId}`;
        const newEdges = pkg.edges!
          .filter(e => e.from === fromKey)
          .map(e => ({ to: existingKeyMap.get(e.to)!, label: e.label }))
          .filter(e => e.to);
        if (newEdges.length === 0) return a;
        const existing = a.edges || [];
        const merged = [...existing];
        newEdges.forEach(ne => { if (!merged.find(x => x.to === ne.to)) merged.push(ne); });
        return { ...a, edges: merged };
      });
    }
    setAssets(next);
    persist(next);
    toast.success(`${pkg.emoji} ${pkg.label}: ${toAdd.length} ativos${pkg.edges?.length ? " + conexões" : ""}`);
  };

  const handleSaveOutput = (assetId: string, output: string) => {
    const next = assets.map(a => a.id === assetId
      ? { ...a, output, generated_at: new Date().toISOString(), status: (a.status === "approved" ? "approved" : "generated") as AssetStatus }
      : a
    );
    setAssets(next);
    persist(next);
    setDrawerAsset(next.find(a => a.id === assetId) || null);
  };

  const handleAdvanceStatus = (assetId: string) => {
    const next = assets.map(a => {
      if (a.id !== assetId) return a;
      const cur: AssetStatus = a.status || (a.output ? "generated" : "pending");
      const nxt = STATUS_META[cur].next || "pending";
      return { ...a, status: nxt };
    });
    setAssets(next);
    persist(next);
  };

  const handleSetStatus = (assetId: string, status: AssetStatus) => {
    const next = assets.map(a => a.id === assetId ? { ...a, status } : a);
    setAssets(next);
    persist(next);
  };

  const handleDelete = (assetId: string) => {
    const next = assets.filter(a => a.id !== assetId);
    setAssets(next);
    persist(next);
  };

  const handleRemoveByKey = (catId: string, itemId: string) => {
    const next = assets.filter(a => !(a.catId === catId && a.itemId === itemId));
    setAssets(next);
    persist(next);
  };

  const handleOpenAssetByKey = (catId: string, itemId: string) => {
    const a = assets.find(x => x.catId === catId && x.itemId === itemId);
    if (a) setDrawerAsset(a);
  };


  const selectedKeys = useMemo(
    () => new Set(assets.map(a => `${a.catId}:${a.itemId}`)),
    [assets]
  );

  const visibleAssets = useMemo(() => {
    if (statusFilter === "all") return assets;
    return assets.filter(a => (a.status || (a.output ? "generated" : "pending")) === statusFilter);
  }, [assets, statusFilter]);

  // Pan
  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-node]") || (e.target as HTMLElement).closest("[data-ui]")) return;
    setPanning({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (panning) {
      setPan({ x: e.clientX - panning.x, y: e.clientY - panning.y });
      return;
    }
    if (draggingProduct) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = (e.clientX - rect.left - pan.x) / zoom - dragOffset.current.x;
      const y = (e.clientY - rect.top - pan.y) / zoom - dragOffset.current.y;
      setProductPos({ x, y });
      return;
    }
    if (dragId) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = (e.clientX - rect.left - pan.x) / zoom - dragOffset.current.x;
      const y = (e.clientY - rect.top - pan.y) / zoom - dragOffset.current.y;
      setAssets(prev => prev.map(a => a.id === dragId ? { ...a, pos_x: x, pos_y: y } : a));
    }
  };
  const onMouseUp = () => {
    if (dragId) {
      const snapped = assets.map(a => a.id === dragId ? { ...a, pos_x: snap(a.pos_x), pos_y: snap(a.pos_y) } : a);
      setAssets(snapped);
      persist(snapped);
      setDragId(null);
    }
    if (draggingProduct) {
      setProductPos({ x: snap(productPos.x), y: snap(productPos.y) }, true);
      setDraggingProduct(false);
    }
    setPanning(null);
  };

  const startDrag = (e: React.MouseEvent, a: HubAsset) => {
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;
    dragOffset.current = { x: x - a.pos_x, y: y - a.pos_y };
    setDragId(a.id);
  };

  const startDragProduct = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;
    dragOffset.current = { x: x - productPos.x, y: y - productPos.y };
    setDraggingProduct(true);
  };

  const productCenter = { x: productPos.x + PRODUCT_NODE_W, y: productPos.y + PRODUCT_NODE_H / 2 };

  if (!projectId) {
    return <div className="p-6 text-center text-muted-foreground text-sm">Selecione um projeto.</div>;
  }

  const counts = {
    all: assets.length,
    pending: assets.filter(a => (a.status || (a.output ? "generated" : "pending")) === "pending").length,
    generated: assets.filter(a => a.status === "generated").length,
    reviewed: assets.filter(a => a.status === "reviewed").length,
    approved: assets.filter(a => a.status === "approved").length,
  };

  return (
    <div className="relative h-[calc(100vh-180px)] bg-[#080607] rounded-xl border border-border/40 overflow-hidden">
      <ChecklistSidebar
        open={checklistOpen}
        onToggle={() => setChecklistOpen(o => !o)}
        assets={assets.map(a => ({ catId: a.catId, itemId: a.itemId, status: a.status, output: a.output }))}
        onAdd={handleToggle}
        onRemove={handleRemoveByKey}
        onAddAll={handleAddAll}
        onOpenAsset={handleOpenAssetByKey}
      />

      {/* Toolbar */}
      <div data-ui className={cn("absolute top-3 right-3 z-30 flex items-center gap-2 flex-wrap", checklistOpen ? "left-[320px]" : "left-16")}>

        <Select value={projectId} onValueChange={(v) => { setProjectId(v); setProductIdx(0); }}>
          <SelectTrigger className="w-[200px] h-8 text-xs bg-[#0a0608]/90 border-border/60"><SelectValue /></SelectTrigger>
          <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
        {products.length > 0 && (
          <Select value={String(productIdx)} onValueChange={(v) => setProductIdx(Number(v))}>
            <SelectTrigger className="w-[220px] h-8 text-xs bg-[#0a0608]/90 border-border/60"><SelectValue /></SelectTrigger>
            <SelectContent>
              {products.map((p: any, i) => (
                <SelectItem key={i} value={String(i)}>{p.nome || p.name || `Produto ${i+1}`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={() => setImportOpen(true)}
          disabled={!projectId}
          className="h-8 text-xs gap-1.5 bg-[#0a0608]/90 border-primary/40 hover:bg-primary/10"
          title="Importar produto a partir de uma URL"
        >
          <Download className="h-3.5 w-3.5 text-primary" /> Importar
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setEcosystemOpen(true)}
          disabled={!projectId}
          className="h-8 text-xs gap-1.5 bg-[#0a0608]/90 border-emerald-500/40 hover:bg-emerald-500/10"
          title="Ver fluxos OpenFlow, avatar, páginas e KPIs do projeto"
        >
          <Globe className="h-3.5 w-3.5 text-emerald-400" /> Ecossistema
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const nv = !checklistBoxVisible;
            setChecklistBoxVisible(nv);
            localStorage.setItem("hub:checklistBoxVisible", nv ? "1" : "0");
          }}
          disabled={!projectId}
          className={cn(
            "h-8 text-xs gap-1.5 bg-[#0a0608]/90 border-violet-500/40 hover:bg-violet-500/10",
            checklistBoxVisible && "ring-1 ring-violet-500/60"
          )}
          title="Mostrar/ocultar box de checklist no canvas"
        >
          <ListChecks className="h-3.5 w-3.5 text-violet-400" /> Checklist
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const nv = !pnlOpen;
            setPnlOpen(nv);
            localStorage.setItem("hub:pnlOpen", nv ? "1" : "0");
          }}
          disabled={!projectId}
          className={cn(
            "h-8 text-xs gap-1.5 bg-[#0a0608]/90 border-emerald-500/40 hover:bg-emerald-500/10",
            pnlOpen && "ring-1 ring-emerald-500/60"
          )}
          title="Mostrar receita real por produto e atividade ao vivo"
        >
          <DollarSign className="h-3.5 w-3.5 text-emerald-400" /> P&L Live
        </Button>





        {/* Pacotes */}
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 bg-[#0a0608]/90 border-pink-500/40 hover:bg-pink-500/10">
              <Package className="h-3.5 w-3.5 text-pink-400" /> Pacotes
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-2 bg-[#0a0608] border-border/60" align="start">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1.5">Pacotes prontos</p>
            <div className="flex flex-col gap-1">
              {ASSET_PACKAGES.map(pkg => (
                <button
                  key={pkg.id}
                  onClick={() => handleAddPackage(pkg.id)}
                  className="text-left rounded-lg px-3 py-2 hover:bg-pink-500/10 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{pkg.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground/90 group-hover:text-pink-300">{pkg.label}</p>
                      <p className="text-[10px] text-muted-foreground line-clamp-1">{pkg.description}</p>
                    </div>
                    <span className="text-[9px] text-muted-foreground">{pkg.items.length}</span>
                  </div>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Filtro status */}
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 bg-[#0a0608]/90 border-border/60">
              <Filter className="h-3.5 w-3.5" />
              {STATUS_FILTERS.find(f => f.id === statusFilter)?.label}
              <span className="text-[10px] text-muted-foreground">({counts[statusFilter]})</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[180px] p-1 bg-[#0a0608] border-border/60" align="start">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={cn(
                  "flex items-center justify-between w-full rounded-md px-2 py-1.5 text-xs transition-colors",
                  statusFilter === f.id ? "bg-pink-500/20 text-pink-200" : "hover:bg-secondary/60 text-foreground/80"
                )}
              >
                <span>{f.label}</span>
                <span className="text-[10px] text-muted-foreground">{counts[f.id]}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>

        {/* Auditor IA */}
        <Button
          size="sm"
          onClick={() => setAuditOpen(o => !o)}
          className="h-8 text-xs gap-1.5 bg-gradient-to-r from-pink-600 to-fuchsia-600 hover:from-pink-500 hover:to-fuchsia-500 text-white border-0"
        >
          <Sparkles className="h-3.5 w-3.5" /> Auditar funil
        </Button>

        {/* Fluxos (Typebot Engine) */}
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 bg-[#0a0608]/90 border-cyan-500/40 hover:bg-cyan-500/10">
              <Workflow className="h-3.5 w-3.5 text-cyan-400" /> Fluxos
              {blueprints.length > 0 && <span className="text-[9px] text-muted-foreground">({blueprints.length})</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-2 bg-[#0a0608] border-border/60" align="start">
            <Button size="sm" onClick={() => setFlowGenOpen(true)} className="w-full mb-2 gap-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white">
              <Sparkles className="h-3.5 w-3.5" /> Novo fluxo (IA ou Typebot)
            </Button>
            {blueprints.length === 0 && <p className="text-[10px] text-muted-foreground p-2 text-center">Nenhum fluxo ainda.</p>}
            <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto">
              {blueprints.map(bp => (
                <button key={bp.id} onClick={() => setOpenBlueprintId(bp.id)}
                  className="text-left rounded-lg px-3 py-2 hover:bg-cyan-500/10 transition-colors">
                  <p className="text-xs font-semibold text-foreground/90">{bp.title}</p>
                  {bp.objetivo && <p className="text-[10px] text-muted-foreground">{bp.objetivo}</p>}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Botão dedicado X1 — atendimento 1:1 WhatsApp */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setFlowGenPreset({ objetivo: "x1_vendas", canal: "whatsapp", tom: "Sugamele, conversacional, pt-BR", title: "⚔️ Gerar Fluxo X1 (vendas 1:1)" });
            setFlowGenOpen(true);
          }}
          className="h-8 text-xs gap-1.5 bg-[#0a0608]/90 border-amber-500/40 hover:bg-amber-500/10"
          title="Gera fluxo de atendimento 1:1 estilo Sugamele com diagnóstico, pitch, objeções e follow-up"
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-400" /> X1
        </Button>

        {/* Botão Autopilot — script completo com skills + WA + imagens */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAutopilotOpen(true)}
          className="h-8 text-xs gap-1.5 bg-gradient-to-r from-amber-500/10 to-sky-500/10 border-amber-500/50 hover:from-amber-500/20 hover:to-sky-500/20"
          title="Gera script de venda completo: blueprint + 7 manobras + blindagem de provas + imagens + atrela WhatsApp"
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Script Completo
        </Button>




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
            {currentProduct && visibleAssets.map(a => {
              const start = productCenter;
              const end = { x: a.pos_x, y: a.pos_y + ASSET_NODE_H / 2 };
              const midX = (start.x + end.x) / 2;
              const d = `M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${end.y}, ${end.x} ${end.y}`;
              return (
                <g key={a.id}>
                  <path d={d} stroke="rgb(34 197 94 / 0.5)" strokeWidth="1.5" strokeDasharray="5 5" fill="none" />
                  <circle cx={start.x} cy={start.y} r="4" fill="rgb(34 197 94)" />
                  <circle cx={end.x} cy={end.y} r="4" fill="rgb(34 197 94)" />
                </g>
              );
            })}
            {/* asset → asset edges */}
            {visibleAssets.map(a => {
              if (!a.edges?.length) return null;
              return a.edges.map((edge, idx) => {
                const target = visibleAssets.find(t => t.id === edge.to);
                if (!target) return null;
                const start = { x: a.pos_x + ASSET_NODE_W, y: a.pos_y + ASSET_NODE_H / 2 };
                const end = { x: target.pos_x, y: target.pos_y + ASSET_NODE_H / 2 };
                const midX = (start.x + end.x) / 2;
                const d = `M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${end.y}, ${end.x} ${end.y}`;
                const labelX = (start.x + end.x) / 2;
                const labelY = (start.y + end.y) / 2 - 6;
                return (
                  <g key={`${a.id}-${edge.to}-${idx}`}>
                    <path d={d} stroke="rgb(56 189 248 / 0.7)" strokeWidth="1.5" fill="none" />
                    <circle cx={start.x} cy={start.y} r="3" fill="rgb(56 189 248)" />
                    <circle cx={end.x} cy={end.y} r="3" fill="rgb(56 189 248)" />
                    {edge.label && (
                      <text x={labelX} y={labelY} textAnchor="middle" fill="rgb(186 230 253)" fontSize="10" className="select-none">
                        {edge.label}
                      </text>
                    )}
                  </g>
                );
              });
            })}
          </svg>


          {/* Product node */}
          {currentProduct && (
            <div
              data-node
              className="absolute rounded-xl border-2 border-emerald-700/60 bg-[#0a0608] overflow-hidden shadow-2xl"
              style={{ left: productPos.x, top: productPos.y, width: PRODUCT_NODE_W, height: PRODUCT_NODE_H }}
            >
              <div
                onMouseDown={startDragProduct}
                className={cn("bg-emerald-900/40 text-emerald-200 text-xs font-semibold text-center py-1.5 border-b border-emerald-700/40 select-none", draggingProduct ? "cursor-grabbing" : "cursor-grab")}
              >
                Produto
              </div>
              <ProductImageMenu
                projectId={projectId}
                productIdx={productIdx}
                product={currentProduct}
                imageUrl={imageOverrides[`${projectId}:${productIdx}`] || currentProduct.imagem || currentProduct.image}
                onSaved={(url) => setImageOverrides(prev => ({ ...prev, [`${projectId}:${productIdx}`]: url }))}
              />

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
              </div>
            </div>
          )}

          {/* + button */}
          {currentProduct && (
            <button
              data-node
              onClick={() => setPickerOpen(o => !o)}
              className="absolute h-7 w-7 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg z-10"
              style={{ left: productPos.x + PRODUCT_NODE_W + 12, top: productPos.y + PRODUCT_NODE_H / 2 - 14 }}
            >
              <Plus className="h-4 w-4" />
            </button>
          )}

          {/* Asset picker */}
          {pickerOpen && (
            <div data-node className="absolute z-20" style={{ left: productPos.x + PRODUCT_NODE_W + 60, top: productPos.y }}>
              <AssetPicker selectedItems={selectedKeys} onToggle={handleToggle} onAddAll={handleAddAll} />
            </div>
          )}

          {/* Asset nodes */}
          {visibleAssets.map(a => {
            const meta = findItem(a.catId, a.itemId);
            if (!meta) return null;
            const colors = COLOR_TOKENS[meta.cat.color];
            const status: AssetStatus = a.status || (a.output ? "generated" : "pending");
            const sMeta = STATUS_META[status];
            const StatusIcon = sMeta.icon;
            const isDragging = dragId === a.id;
            return (
              <div
                key={a.id}
                data-node
                className={cn(
                  `absolute rounded-xl border-2 ${colors.border} bg-[#0a0608] overflow-hidden shadow-xl group transition-shadow`,
                  isDragging ? "cursor-grabbing shadow-2xl ring-2 ring-pink-500/40 z-30" : "cursor-grab hover:shadow-2xl"
                )}
                style={{ left: a.pos_x, top: a.pos_y, width: ASSET_NODE_W }}
                onMouseDown={(e) => startDrag(e, a)}
                onClick={(e) => { if (!isDragging) { e.stopPropagation(); setDrawerAsset(a); } }}
              >
                <div className={`${colors.header} text-xs font-semibold text-center py-1.5 border-b ${colors.border} flex items-center justify-center gap-1.5`}>
                  <span>{meta.cat.label}</span>
                  {a.output && !isChannelOutput(a.output) && isDslOutputCheck(a.output) && (
                    <span className="text-[9px] px-1 rounded bg-emerald-600/30 text-emerald-200 border border-emerald-500/40" title="Output em DSL executável">🔗 fluxo</span>
                  )}
                  {a.catId === "canais" && isChannelOutput(a.output) && (
                    <span className="text-[9px] px-1 rounded bg-cyan-600/30 text-cyan-100 border border-cyan-500/40" title="Canal configurado">🔗 link</span>
                  )}
                </div>
                <div className="p-3 space-y-1">
                  <h4 className="text-sm font-semibold text-foreground leading-tight">{meta.item.label}</h4>
                  {a.catId === "canais" && isChannelOutput(a.output) ? (() => {
                    const ch = parseChannelConfig(a.output);
                    const prioColor = ch.prioridade_ia === "preferida" ? "text-emerald-300" : ch.prioridade_ia === "evitar" ? "text-rose-300" : "text-muted-foreground";
                    return (
                      <>
                        {ch.label && <p className="text-[10px] text-foreground/80 line-clamp-1">{ch.label}</p>}
                        {ch.url && (
                          <a
                            href={ch.url}
                            target="_blank"
                            rel="noreferrer"
                            data-node
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="text-[10px] text-cyan-300 hover:text-cyan-200 underline line-clamp-1 block"
                          >
                            {ch.url.replace(/^https?:\/\//, "").slice(0, 36)}
                          </a>
                        )}
                        <p className={cn("text-[9px] uppercase tracking-wider", prioColor)}>
                          {ch.ativo === false ? "inativo • " : ""}{ch.prioridade_ia || "secundaria"}
                        </p>
                      </>
                    );
                  })() : (
                    <p className="text-[10px] text-muted-foreground line-clamp-2">{meta.item.promptHint}</p>
                  )}

                  {/* Status badge */}
                  <button
                    data-node
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); handleAdvanceStatus(a.id); }}
                    title="Avançar status"
                    className={cn(
                      "mt-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border transition-all hover:scale-105",
                      sMeta.color
                    )}
                  >
                    <StatusIcon className="h-2.5 w-2.5" />
                    {sMeta.label}
                  </button>

                  {/* Produto vinculado */}
                  {isProductLinkedAsset(a.catId, a.itemId) && (
                    a.linked_product_nome ? (
                      <p className="mt-1.5 text-[9px] text-amber-300 truncate" title={a.linked_product_nome}>
                        🛒 {a.linked_product_nome}
                      </p>
                    ) : (
                      <button
                        data-node
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); setLinkDialog({ assetId: a.id, catId: a.catId, itemId: a.itemId }); }}
                        className="mt-1.5 text-[9px] text-muted-foreground hover:text-amber-300 underline block"
                      >
                        🛒 Vincular produto
                      </button>
                    )
                  )}
                  {pnlOpen && isProductLinkedAsset(a.catId, a.itemId) && a.linked_product_nome && (
                    <NodeRevenueBadge data={getProductRevenue(revenue, a.linked_product_nome)} />
                  )}
                </div>



                <div className="absolute -top-3 right-2 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); setDrawerAsset(a); }}
                    className="h-6 w-6 rounded-md bg-card border border-border/60 flex items-center justify-center hover:bg-pink-600/40"
                    title="Abrir"
                  >
                    <Play className="h-3 w-3" />
                  </button>
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); handleSetStatus(a.id, "approved"); }}
                    className="h-6 w-6 rounded-md bg-card border border-border/60 flex items-center justify-center hover:bg-emerald-600/40"
                    title="Aprovar"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
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

      {pnlOpen && (
        <RevenueOverlayBar
          revenue={revenue}
          days={pnlDays}
          onDaysChange={(d) => { setPnlDays(d); localStorage.setItem("hub:pnlDays", String(d)); }}
          liveCount={liveActivity.count}
          onClose={() => { setPnlOpen(false); localStorage.setItem("hub:pnlOpen", "0"); }}
        />
      )}

      {liveFeedOpen && liveActivity.recent.length > 0 && (
        <LiveActivityFeed
          recent={liveActivity.recent}
          onClose={() => { setLiveFeedOpen(false); localStorage.setItem("hub:liveFeed", "0"); }}
        />
      )}

      {!currentProduct && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-sm text-muted-foreground">Adicione produtos no Briefing deste projeto.</p>
        </div>
      )}

      <AssetDetailDrawer
        open={!!drawerAsset}
        onClose={() => setDrawerAsset(null)}
        asset={drawerAsset}
        product={
          drawerAsset?.linked_product_nome
            ? products.find((p: any) => (p?.nome || p?.name) === drawerAsset.linked_product_nome) || currentProduct
            : currentProduct
        }
        products={products}
        projectId={projectId}
        onSaveOutput={handleSaveOutput}
        onLinkProduct={handleLinkProduct}
        onOpenBlueprint={(id) => { reloadBlueprints(); setOpenBlueprintId(id); }}
      />

      <HubAuditPanel
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        projectId={projectId}
        product={currentProduct}
        existingAssets={assets.map(a => ({ catId: a.catId, itemId: a.itemId, status: a.status }))}
        onAddAsset={handleAddSuggested}
      />

      <FlowGeneratorDialog
        open={flowGenOpen}
        onClose={() => { setFlowGenOpen(false); setFlowGenPreset(null); }}
        projectId={projectId}
        produtoNome={currentProduct?.nome || currentProduct?.name}
        onCreated={(id) => { reloadBlueprints(); setOpenBlueprintId(id); }}
        initialObjetivo={flowGenPreset?.objetivo}
        initialCanal={flowGenPreset?.canal}
        initialTom={flowGenPreset?.tom}
        titleOverride={flowGenPreset?.title}
      />

      <SalesScriptAutopilotDialog
        open={autopilotOpen}
        onClose={() => setAutopilotOpen(false)}
        projectId={projectId}
        produtoNome={currentProduct?.nome || currentProduct?.name}
        produtoId={currentProduct?.id}
        onCreated={(id) => { reloadBlueprints(); setOpenBlueprintId(id); }}
      />

      {openBlueprintId && (
        <FlowBlueprintCanvas
          blueprintId={openBlueprintId}
          onClose={() => { setOpenBlueprintId(null); reloadBlueprints(); }}
        />
      )}

      <ImportProductDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        projectId={projectId}
        onImported={handleImportedProduct}
      />

      <EcosystemDrawer
        open={ecosystemOpen}
        onOpenChange={setEcosystemOpen}
        projectId={projectId}
        projectName={currentProject?.name}
        produto={currentProduct}
        briefing={currentProject?.briefing}
        onProjectReload={onProjectsReload}
      />

      {checklistBoxVisible && projectId && (
        <ChecklistFloatingBox
          projectId={projectId}
          products={products}
          currentProductName={currentProduct?.nome || currentProduct?.name}
          onSwitchProduct={(idx) => setProductIdx(idx)}
          onOpenFull={() => setProductChecklistOpen(true)}
          onClose={() => {
            setChecklistBoxVisible(false);
            localStorage.setItem("hub:checklistBoxVisible", "0");
          }}
        />
      )}

      <ProductChecklistDrawer
        open={productChecklistOpen}
        onOpenChange={setProductChecklistOpen}
        projectId={projectId}
        products={products}
        currentProductName={currentProduct?.nome || currentProduct?.name}
        onSwitchProduct={(idx) => setProductIdx(idx)}
      />




      {linkDialog && (() => {
        const role = PRODUCT_LINKED_ASSETS[`${linkDialog.catId}:${linkDialog.itemId}`];
        const meta = findItem(linkDialog.catId, linkDialog.itemId);
        return (
          <LinkProductDialog
            open={true}
            onClose={() => setLinkDialog(null)}
            products={products}
            currentProductNome={currentProduct?.nome || currentProduct?.name}
            assetLabel={meta?.item.label || "ativo"}
            roleHint={role?.role}
            onPick={(nome) => handleLinkProduct(linkDialog.assetId, nome)}
          />
        );
      })()}
    </div>
  );
}

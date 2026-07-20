import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  Handle, Position, type Node, type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Loader2, ExternalLink, Building2 } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANN_PREFIX = "ann-";

function PublicNodeCard({ data }: { data: any }) {
  const color = data.color || "#c9922a";
  return (
    <div
      className="rounded-xl border-2 bg-card/95 backdrop-blur px-3 py-2 shadow-lg overflow-hidden"
      style={{ borderColor: color, minWidth: 180, maxWidth: 320, width: "100%", height: "100%" }}
    >
      {[Position.Top, Position.Right, Position.Bottom, Position.Left].map((pos) => (
        <Handle key={pos} type="source" position={pos} isConnectable={false} style={{ opacity: 0, pointerEvents: "none" }} />
      ))}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{data.kind || "nó"}</span>
      </div>
      <p className="text-sm font-medium leading-snug">{data.label}</p>
      {data.image_url && (
        <img src={data.image_url} alt={data.label} className="mt-2 w-full max-h-64 rounded border border-border/30 object-cover" draggable={false} />
      )}
      {data.description && <p className="text-[10px] text-muted-foreground mt-1 line-clamp-3">{data.description}</p>}
      {data.url && (
        <a href={data.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[10px] text-primary hover:underline truncate max-w-full">
          <ExternalLink className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{String(data.url).replace(/^https?:\/\//, "")}</span>
        </a>
      )}
      {data.checklist_total > 0 && (
        <div className="mt-2 pt-2 border-t border-border/40 text-[10px] text-muted-foreground">
          Checklist: {data.checklist_done}/{data.checklist_total}
        </div>
      )}
    </div>
  );
}

function PublicAnnotationNode({ data }: { data: any }) {
  const style = data.style || {};
  const isFrame = data.kind === "frame";
  const isNote = data.kind === "note";
  const bg = isNote ? (style.bgColor || "#fef3c7") : "transparent";
  const borderColor = style.borderColor || "#c9922a";
  return (
    <div
      className="w-full h-full rounded-lg p-2 text-xs"
      style={{
        background: isFrame ? "rgba(201,146,42,0.04)" : bg,
        border: isFrame ? `2px dashed ${borderColor}` : isNote ? "none" : `1px solid ${borderColor}`,
        color: isNote ? "#1f2937" : undefined,
      }}
    >
      {isFrame && style.heading && (
        <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: borderColor }}>
          {style.heading}
        </div>
      )}
      {style.thumb && (
        <img src={style.thumb} alt="" className="w-full max-h-48 rounded object-cover mb-1" draggable={false} />
      )}
      <div className="whitespace-pre-wrap break-words">{data.text}</div>
    </div>
  );
}

const nodeTypes = {
  mapnode: PublicNodeCard,
  annotation_frame: PublicAnnotationNode,
  annotation_note: PublicAnnotationNode,
  annotation_label: PublicAnnotationNode,
  annotation_arrow: PublicAnnotationNode,
  annotation_reel: PublicAnnotationNode,
  annotation_script: PublicAnnotationNode,
  annotation_copy: PublicAnnotationNode,
  annotation_ad_asset: PublicAnnotationNode,
  annotation_schedule: PublicAnnotationNode,
  annotation_account: PublicAnnotationNode,
} as any;

const ANN_KIND_TO_TYPE: Record<string, string> = {
  frame: "annotation_frame", note: "annotation_note", label: "annotation_label",
  arrow: "annotation_arrow", reel: "annotation_reel", script: "annotation_script",
  copy: "annotation_copy", ad_asset: "annotation_ad_asset",
  schedule: "annotation_schedule", account: "annotation_account",
};

export default function MapaPublico() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<any>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/company-map-public?token=${encodeURIComponent(token)}`);
        const d = await res.json();
        if (!res.ok) { setError(d?.error || "Erro ao carregar mapa"); return; }
        setPayload(d);
      } catch (e: any) {
        setError(e?.message || "Erro ao carregar mapa");
      } finally { setLoading(false); }
    })();
  }, [token]);

  const { nodes, edges } = useMemo(() => {
    if (!payload) return { nodes: [] as Node[], edges: [] as Edge[] };
    const mapNodes: Node[] = (payload.nodes || []).map((n: any) => ({
      id: n.id,
      type: "mapnode",
      position: n.position || { x: 0, y: 0 },
      ...(n.width && n.height ? { width: n.width, height: n.height, style: { width: n.width, height: n.height } } : {}),
      data: n,
      draggable: false,
      selectable: false,
      connectable: false,
    }));
    const annNodes: Node[] = (payload.annotations || []).map((a: any) => ({
      id: `${ANN_PREFIX}${a.id}`,
      type: ANN_KIND_TO_TYPE[a.kind] || "annotation_note",
      position: { x: a.x, y: a.y },
      width: a.width, height: a.height,
      style: { width: a.width, height: a.height },
      zIndex: a.z_index ?? 0,
      data: { kind: a.kind, text: a.text || "", style: a.style || {} },
      draggable: false,
      selectable: false,
      connectable: false,
    }));
    const edgs: Edge[] = (payload.edges || []).map((e: any) => ({
      id: e.id,
      source: e.source_kind === "annotation" ? `${ANN_PREFIX}${e.source_id}` : e.source_id,
      target: e.target_kind === "annotation" ? `${ANN_PREFIX}${e.target_id}` : e.target_id,
      animated: e.style !== "dashed",
      label: e.label || undefined,
      style: { stroke: "#c9922a", strokeWidth: 2, strokeDasharray: e.style === "dashed" ? "6 4" : undefined },
    }));
    return { nodes: [...annNodes, ...mapNodes], edges: edgs };
  }, [payload]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080607] text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080607] text-foreground">
        <div className="text-center max-w-md p-6">
          <h1 className="text-xl font-semibold mb-2">Não foi possível carregar</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080607] text-foreground">
      <header className="h-12 flex items-center justify-between px-4 border-b border-border/40 bg-card/50 backdrop-blur">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{payload?.map?.name || "Mapa da Empresa"}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground ml-2 px-1.5 py-0.5 rounded bg-muted/40">
            Somente leitura
          </span>
        </div>
        <a href="/" className="text-xs text-primary hover:underline flex items-center gap-1">
          ImpérioHQ <ExternalLink className="h-3 w-3" />
        </a>
      </header>
      <div className="h-[calc(100vh-3rem)]">
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnDrag
            zoomOnScroll
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#1a1a1a" gap={24} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable nodeColor={(n: any) => n?.data?.color || "#c9922a"} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </div>
  );
}

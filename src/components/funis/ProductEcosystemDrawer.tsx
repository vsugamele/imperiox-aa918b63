import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Radar, ShieldCheck, Save, ExternalLink, Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";

type NodeKind = string;
interface EcoNode {
  id: string; kind: NodeKind; label: string;
  status: "ok" | "faltando" | "fraco";
  count?: number; meta?: any; x: number; y: number;
}
interface EcoEdge { from: string; to: string; label?: string }
interface Gap { node_id: string; kind: string; label: string; action: string }
interface ScanResult {
  nodes: EcoNode[]; edges: EcoEdge[]; gaps: Gap[]; score: number;
  project_name?: string; briefing_produtos?: string[];
  counts: Record<string, number>;
  current_blueprint?: any;
}

const KIND_COLOR: Record<string, string> = {
  avatar: "#c9922a", vsl: "#a855f7", lp: "#38bdf8", checkout: "#22c55e",
  orderbump: "#fbbf24", upsell: "#f97316", downsell: "#ef4444",
  whatsapp: "#25D366", instagram: "#e1306c", email: "#818cf8",
  flow: "#06b6d4", creative: "#f472b6", site: "#94a3b8",
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projects: Array<{ id: string; name: string; data?: any }>;
  initialProjectId?: string;
  initialProduct?: string;
}

export function ProductEcosystemDrawer({ open, onOpenChange, projects, initialProjectId, initialProduct }: Props) {
  const [projectId, setProjectId] = useState(initialProjectId || "");
  const [produto, setProduto] = useState(initialProduct || "");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scan, setScan] = useState<ScanResult | null>(null);

  const currentProject = projects.find((p) => p.id === projectId);
  const produtos: string[] = useMemo(() => {
    const data = currentProject?.data as any;
    const list = data?.briefing?.produtos || data?.produtos || [];
    return list.map((p: any) => p.nome || p.name).filter(Boolean);
  }, [currentProject]);

  useEffect(() => {
    if (produtos.length && !produto) setProduto(produtos[0]);
  }, [produtos.join("|")]);

  const runScan = async () => {
    if (!projectId) return toast.error("Escolha um projeto");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("product-ecosystem-scan", {
        body: { action: "scan", project_id: projectId, produto_nome: produto || null },
      });
      if (error) throw error;
      setScan(data as ScanResult);
    } catch (e: any) {
      toast.error(e.message || "Erro ao escanear");
    } finally {
      setLoading(false);
    }
  };

  const saveBlueprint = async (approve: boolean) => {
    if (!scan) return;
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("product-ecosystem-scan", {
        body: {
          action: approve ? "approve" : "save",
          project_id: projectId, produto_nome: produto,
          snapshot: { nodes: scan.nodes, edges: scan.edges, counts: scan.counts },
          gaps: scan.gaps, score: scan.score,
        },
      });
      if (error) throw error;
      toast.success(approve ? "Blueprint aprovado ✓" : "Snapshot salvo");
      runScan();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (open && projectId) runScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId, produto]);

  // canvas bounds
  const bounds = useMemo(() => {
    if (!scan) return { w: 1400, h: 640 };
    const maxX = Math.max(...scan.nodes.map((n) => n.x + 200), 1200);
    const maxY = Math.max(...scan.nodes.map((n) => n.y + 100), 600);
    return { w: maxX + 60, h: maxY + 60 };
  }, [scan]);

  const nodeById = (id: string) => scan?.nodes.find((n) => n.id === id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[92vh] p-0 bg-[#080607] border-border/60 overflow-hidden">
        <DialogHeader className="px-5 py-3 border-b border-border/40">
          <DialogTitle className="flex items-center gap-2 font-display text-lg">
            <Radar className="h-5 w-5 text-amber-400" />
            Ecossistema do Produto
            {scan?.current_blueprint?.approved_at && (
              <Badge className="ml-2 bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                v{scan.current_blueprint.versao} aprovada
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 px-5 py-2 border-b border-border/40 bg-secondary/20">
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="h-8 w-[220px] text-xs"><SelectValue placeholder="Projeto" /></SelectTrigger>
            <SelectContent>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={produto} onValueChange={setProduto} disabled={!produtos.length}>
            <SelectTrigger className="h-8 w-[240px] text-xs"><SelectValue placeholder="Produto" /></SelectTrigger>
            <SelectContent>
              {produtos.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>

          <Button size="sm" onClick={runScan} disabled={loading || !projectId} className="h-8 gap-1">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Radar className="h-3 w-3" />}
            Escanear
          </Button>

          <div className="ml-auto flex items-center gap-2">
            {scan && (
              <>
                <Badge variant="outline" className="text-xs">Score: {scan.score}%</Badge>
                <Badge variant="outline" className="text-xs text-emerald-400">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> {scan.nodes.filter(n=>n.status==="ok").length} conectados
                </Badge>
                <Badge variant="outline" className="text-xs text-rose-400">
                  <AlertTriangle className="h-3 w-3 mr-1" /> {scan.gaps.length} gaps
                </Badge>
                <Button size="sm" variant="outline" onClick={() => saveBlueprint(false)} disabled={saving} className="h-8 gap-1">
                  <Save className="h-3 w-3" /> Salvar
                </Button>
                <Button size="sm" onClick={() => saveBlueprint(true)} disabled={saving} className="h-8 gap-1 bg-amber-500 hover:bg-amber-600 text-black">
                  <ShieldCheck className="h-3 w-3" /> Aprovar
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 grid grid-cols-[1fr_320px] overflow-hidden h-[calc(92vh-104px)]">
          {/* Canvas */}
          <div className="relative overflow-auto bg-[#0b0a0d]">
            {!scan && !loading && (
              <div className="p-10 text-center text-muted-foreground text-sm">Escolha projeto + produto e clique em Escanear.</div>
            )}
            {loading && (
              <div className="p-10 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Escaneando ecossistema...
              </div>
            )}
            {scan && (
              <div className="relative" style={{ width: bounds.w, height: bounds.h }}>
                <svg className="absolute inset-0 pointer-events-none" width={bounds.w} height={bounds.h}>
                  <defs>
                    <marker id="ecoArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#c9922a" />
                    </marker>
                  </defs>
                  {scan.edges.map((e, i) => {
                    const a = nodeById(e.from); const b = nodeById(e.to);
                    if (!a || !b) return null;
                    const x1 = a.x + 100, y1 = a.y + 30;
                    const x2 = b.x, y2 = b.y + 30;
                    const midX = (x1 + x2) / 2;
                    const d = `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`;
                    return (
                      <g key={i}>
                        <path d={d} stroke="#c9922a" strokeWidth="1.5" fill="none" opacity="0.6" markerEnd="url(#ecoArrow)" />
                        {e.label && (
                          <text x={midX} y={(y1 + y2) / 2 - 4} fill="#c9922a" fontSize="9" textAnchor="middle" opacity="0.8">{e.label}</text>
                        )}
                      </g>
                    );
                  })}
                </svg>
                {scan.nodes.map((n) => {
                  const color = KIND_COLOR[n.kind] || "#94a3b8";
                  const isMissing = n.status === "faltando";
                  return (
                    <div key={n.id}
                      className={`absolute rounded-lg border p-2 w-[200px] ${isMissing ? "border-dashed border-rose-500/60 bg-rose-500/5" : "border-border/60 bg-secondary/40"}`}
                      style={{ left: n.x, top: n.y }}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{n.kind}</span>
                        {n.meta?.url && (
                          <a href={n.meta.url} target="_blank" rel="noreferrer" className="ml-auto text-muted-foreground hover:text-foreground">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      <div className={`text-xs font-medium leading-tight ${isMissing ? "text-rose-300" : "text-foreground/90"}`}>
                        {n.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Rail direita — gaps */}
          <div className="border-l border-border/40 bg-secondary/10 flex flex-col">
            <div className="px-4 py-3 border-b border-border/40">
              <h3 className="text-sm font-semibold">Gaps a preencher</h3>
              <p className="text-xs text-muted-foreground">Ative para completar o funil.</p>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {scan?.gaps.length === 0 && (
                  <div className="text-xs text-emerald-400 flex items-center gap-1.5 p-3">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Funil completo — nada faltando.
                  </div>
                )}
                {scan?.gaps.map((g) => (
                  <div key={g.node_id} className="rounded-lg border border-border/60 bg-secondary/40 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="h-2 w-2 rounded-full" style={{ background: KIND_COLOR[g.kind] }} />
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{g.kind}</span>
                    </div>
                    <div className="text-xs font-medium mb-2">{g.label}</div>
                    <Button size="sm" variant="outline" className="w-full h-7 text-[11px] gap-1"
                      onClick={() => toast.info(`Use o One Click ou o Hub pra gerar: ${g.label}`)}>
                      <Sparkles className="h-3 w-3" /> Gerar
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

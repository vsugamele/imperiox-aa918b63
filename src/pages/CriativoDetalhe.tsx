import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Download, FolderInput, Heart, History, Link2, Link2Off, Loader2, Package, Pencil, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";

interface Batch {
  id: string;
  nome: string;
  status: string;
  total_gerado: number;
  total_planejado: number;
  error_message: string | null;
  source_swipe_ids?: string[] | null;
}

interface Asset {
  id: string;
  angulo: string;
  image_url: string;
  headline_copy: string | null;
  favorito: boolean;
  reprovado: boolean;
  formato: string;
  parent_asset_id: string | null;
  version: number;
  edit_instruction: string | null;
  exported_to_midia: boolean;
  created_at: string;
  image_provider?: string | null;
  card_id?: string | null;
}

type ImgProvider = "lovable-gemini" | "openai-image";
const providerLabel = (p?: string | null) =>
  p === "openai-image" ? "OpenAI" : "Gemini";

export default function CriativoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [sourceSwipes, setSourceSwipes] = useState<Array<{ id: string; title: string }>>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [editTarget, setEditTarget] = useState<Asset | null>(null);
  const [editInstruction, setEditInstruction] = useState("");
  const [editProvider, setEditProvider] = useState<ImgProvider>("lovable-gemini");
  const [editing, setEditing] = useState(false);
  const [viewer, setViewer] = useState<Asset | null>(null);
  const [historyTarget, setHistoryTarget] = useState<Asset | null>(null);
  const [exporting, setExporting] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [linkTarget, setLinkTarget] = useState<Asset | null>(null);
  const [cardOptions, setCardOptions] = useState<Array<{ id: string; titulo: string; board_id: string | null }>>([]);
  const [cardSearch, setCardSearch] = useState("");

  async function openLinkDialog(a: Asset) {
    setLinkTarget(a);
    setCardSearch("");
    const { data } = await supabase
      .from("imphq_kanban_cards")
      .select("id, titulo, board_id")
      .order("created_at", { ascending: false })
      .limit(200);
    setCardOptions((data as any) || []);
  }

  async function linkToCard(cardId: string | null) {
    if (!linkTarget) return;
    const { error } = await supabase
      .from("imphq_creative_assets")
      .update({ card_id: cardId } as any)
      .eq("id", linkTarget.id);
    if (error) { toast.error(error.message); return; }
    setAssets((prev) => prev.map((x) => x.id === linkTarget.id ? { ...x, card_id: cardId } : x));
    toast.success(cardId ? "Criativo vinculado ao card" : "Vínculo removido");
    setLinkTarget(null);
  }


  async function load() {
    if (!id) return;
    const [bRes, aRes] = await Promise.all([
      supabase.from("imphq_creative_batches").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("imphq_creative_assets")
        .select("*")
        .eq("batch_id", id)
        .neq("image_url", "pending")
        .order("created_at", { ascending: true }),
    ]);
    if (bRes.data) {
      setBatch(bRes.data as any);
      const ids: string[] = (bRes.data as any)?.source_swipe_ids || [];
      if (ids.length) {
        const { data: sws } = await supabase
          .from("imphq_swipes" as any)
          .select("id, title")
          .in("id", ids);
        setSourceSwipes((sws as any) || []);
      } else {
        setSourceSwipes([]);
      }
    }
    if (aRes.data) setAssets(aRes.data as any);
  }

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      if (batch?.status === "processing" || batch?.status === "pending" || !batch) load();
    }, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, batch?.status]);

  // Mostra apenas a versão mais recente de cada cadeia (latest leaf por raiz)
  const visibleAssets = useMemo(() => {
    const byId = new Map(assets.map((a) => [a.id, a]));
    const hasChild = new Set<string>();
    for (const a of assets) if (a.parent_asset_id) hasChild.add(a.parent_asset_id);
    return assets.filter((a) => !hasChild.has(a.id));
  }, [assets]);

  function getHistory(asset: Asset): Asset[] {
    const chain: Asset[] = [asset];
    let cur: Asset | undefined = asset;
    const byId = new Map(assets.map((a) => [a.id, a]));
    while (cur?.parent_asset_id) {
      const parent = byId.get(cur.parent_asset_id);
      if (!parent) break;
      chain.unshift(parent);
      cur = parent;
    }
    return chain;
  }

  async function toggleFavorito(a: Asset) {
    await supabase.from("imphq_creative_assets").update({ favorito: !a.favorito }).eq("id", a.id);
    load();
  }

  async function reprovar(a: Asset) {
    await supabase.from("imphq_creative_assets").update({ reprovado: !a.reprovado }).eq("id", a.id);
    load();
  }

  async function handleEdit() {
    if (!editTarget || !editInstruction.trim()) return;
    setEditing(true);
    try {
      const { data, error } = await supabase.functions.invoke("creative-factory", {
        body: {
          action: "edit_asset",
          asset_id: editTarget.id,
          instruction: editInstruction,
          image_provider: editProvider,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Nova versão gerada (${providerLabel(editProvider)})`);
      setEditTarget(null);
      setEditInstruction("");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Falha na edição");
    } finally {
      setEditing(false);
    }
  }

  function openEditor(a: Asset) {
    setEditTarget(a);
    setEditInstruction("");
    setEditProvider(a.image_provider === "openai-image" ? "openai-image" : "lovable-gemini");
  }

  async function exportarParaMidia(asset: Asset) {
    setExporting(true);
    try {
      const { error } = await supabase.functions.invoke("creative-factory", {
        body: { action: "export_to_midia", asset_ids: [asset.id] },
      });
      if (error) throw error;
      toast.success("Enviado pra biblioteca de mídias");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao exportar");
    } finally {
      setExporting(false);
    }
  }

  async function exportarAprovados() {
    const aprovados = visibleAssets.filter((a) => !a.reprovado && !a.exported_to_midia);
    if (aprovados.length === 0) {
      toast.info("Nenhum criativo aprovado novo pra exportar");
      return;
    }
    setExporting(true);
    try {
      const { error } = await supabase.functions.invoke("creative-factory", {
        body: { action: "export_to_midia", asset_ids: aprovados.map((a) => a.id) },
      });
      if (error) throw error;
      toast.success(`${aprovados.length} criativo(s) enviado(s) pra mídias`);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao exportar");
    } finally {
      setExporting(false);
    }
  }

  async function downloadZip() {
    const aprovados = visibleAssets.filter((a) => !a.reprovado);
    if (aprovados.length === 0) {
      toast.info("Nenhum criativo aprovado");
      return;
    }
    setZipping(true);
    try {
      const zip = new JSZip();
      let i = 0;
      for (const a of aprovados) {
        try {
          const res = await fetch(a.image_url);
          const blob = await res.blob();
          const ext = (blob.type.split("/")[1] || "png").split(";")[0];
          zip.file(`${String(++i).padStart(2, "0")}-${a.angulo}-v${a.version}.${ext}`, blob);
        } catch (e) {
          console.error("zip fetch fail", a.id, e);
        }
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${batch?.nome || "criativos"}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success(`${i} criativo(s) baixado(s)`);
    } catch (e: any) {
      toast.error(e?.message || "Falha no ZIP");
    } finally {
      setZipping(false);
    }
  }

  const pct = batch && batch.total_planejado > 0
    ? Math.round((batch.total_gerado / batch.total_planejado) * 100) : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/criativos"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
          </Button>
          <div>
            <h1 className="font-serif text-2xl text-primary">{batch?.nome || "..."}</h1>
            <div className="text-sm text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
              <Badge variant={batch?.status === "completed" ? "default" : "secondary"}>
                {batch?.status === "processing" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                {batch?.status || "..."}
              </Badge>
              <span>{batch?.total_gerado || 0}/{batch?.total_planejado || 0} ({pct}%)</span>
              {sourceSwipes.map((s) => (
                <Badge key={s.id} variant="outline" className="text-[10px] border-amber-500/40 text-amber-400 gap-1">
                  <Sparkles className="h-3 w-3" /> Inspirado em VSL: {s.title}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {visibleAssets.length > 0 && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={exportarAprovados} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderInput className="h-4 w-4" />}
              Enviar aprovados pra Mídias
            </Button>
            <Button size="sm" onClick={downloadZip} disabled={zipping}>
              {zipping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
              Baixar ZIP
            </Button>
          </div>
        )}
      </div>

      {batch?.error_message && (
        <Card className="p-3 border-destructive bg-destructive/10 text-sm">{batch.error_message}</Card>
      )}

      {visibleAssets.length === 0 ? (
        <Card className="p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-3" />
          <p className="text-muted-foreground">Gerando seus criativos... Isso pode levar alguns minutos.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {visibleAssets.map((a) => (
            <Card key={a.id} className={`overflow-hidden group relative ${a.reprovado ? "opacity-40" : ""}`}>
              <button className="block w-full" onClick={() => setViewer(a)}>
                <div className="relative aspect-square bg-muted">
                  <img src={a.image_url} alt={a.angulo} className="w-full h-full object-cover" />
                  {a.headline_copy && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <p className="text-white text-xs font-medium line-clamp-2">{a.headline_copy}</p>
                    </div>
                  )}
                  {a.version > 1 && (
                    <Badge className="absolute top-2 right-2 text-[10px]" variant="secondary">v{a.version}</Badge>
                  )}
                  {a.exported_to_midia && (
                    <Badge className="absolute top-2 left-2 text-[10px]" variant="default">
                      <FolderInput className="h-3 w-3 mr-1" />Exportado
                    </Badge>
                  )}
                </div>
              </button>
              <div className="p-2 flex items-center justify-between gap-1">
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="text-[10px] capitalize">{a.angulo}</Badge>
                  <Badge
                    variant="outline"
                    className={`text-[9px] ${a.image_provider === "openai-image" ? "border-primary/60 text-primary" : "text-muted-foreground"}`}
                    title={a.image_provider === "openai-image" ? "Gerado por OpenAI gpt-image-1" : "Gerado por Gemini Nano Banana"}
                  >
                    {providerLabel(a.image_provider)}
                  </Badge>
                </div>
                <div className="flex gap-0.5">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleFavorito(a)} title="Favoritar">
                    <Heart className={`h-4 w-4 ${a.favorito ? "fill-primary text-primary" : ""}`} />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditor(a)} title="Editar com IA">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {a.version > 1 && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setHistoryTarget(a)} title="Histórico">
                      <History className="h-4 w-4" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => exportarParaMidia(a)} disabled={a.exported_to_midia || exporting} title="Enviar pra Mídias">
                    <FolderInput className={`h-4 w-4 ${a.exported_to_midia ? "text-primary" : ""}`} />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" asChild title="Download">
                    <a href={a.image_url} download target="_blank" rel="noreferrer">
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => reprovar(a)} title="Reprovar">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Viewer */}
      <Dialog open={!!viewer} onOpenChange={(o) => !o && setViewer(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="capitalize">{viewer?.angulo} {viewer && viewer.version > 1 && `· v${viewer.version}`}</DialogTitle>
          </DialogHeader>
          {viewer && (
            <div className="space-y-3">
              <img src={viewer.image_url} alt="" className="w-full rounded" />
              {viewer.headline_copy && (
                <div className="p-3 bg-muted rounded">
                  <div className="text-xs text-muted-foreground mb-1">Headline sugerida</div>
                  <div className="font-medium">{viewer.headline_copy}</div>
                </div>
              )}
              {viewer.edit_instruction && (
                <div className="p-3 bg-muted rounded">
                  <div className="text-xs text-muted-foreground mb-1">Edição aplicada</div>
                  <div className="text-sm italic">"{viewer.edit_instruction}"</div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* History */}
      <Dialog open={!!historyTarget} onOpenChange={(o) => !o && setHistoryTarget(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" /> Histórico de versões
            </DialogTitle>
          </DialogHeader>
          {historyTarget && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {getHistory(historyTarget).map((v) => (
                <Card key={v.id} className="overflow-hidden">
                  <div className="aspect-square bg-muted">
                    <img src={v.image_url} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="p-2 space-y-1">
                    <Badge variant="outline" className="text-[10px]">v{v.version}</Badge>
                    {v.edit_instruction && (
                      <p className="text-xs text-muted-foreground italic line-clamp-2">"{v.edit_instruction}"</p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" /> Editar criativo
            </DialogTitle>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-3">
              <img src={editTarget.image_url} alt="" className="w-full rounded max-h-60 object-contain bg-muted" />
              <div>
                <label className="text-sm font-medium">O que você quer mudar?</label>
                <Input
                  value={editInstruction}
                  onChange={(e) => setEditInstruction(e.target.value)}
                  placeholder="Ex: fundo azul, remover texto, mais luz..."
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Editar com</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={editProvider === "lovable-gemini" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setEditProvider("lovable-gemini")}
                  >
                    Gemini (rápido)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={editProvider === "openai-image" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setEditProvider("openai-image")}
                  >
                    OpenAI gpt-image-1
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5 leading-5">
                  {editProvider === "openai-image"
                    ? "OpenAI cobra ~$0.04–0.19/imagem direto na sua conta OpenAI (fora do billing Lovable). Excelente para foto-realismo e texto legível."
                    : "Gemini Nano Banana é gratuito via Lovable AI Gateway. Edição multimodal rápida."}
                </p>
              </div>
              <Button onClick={handleEdit} disabled={editing || !editInstruction.trim()} className="w-full">
                {editing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Gerar variação editada
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

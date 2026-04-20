import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Download, Heart, Loader2, Pencil, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

interface Batch {
  id: string;
  nome: string;
  status: string;
  total_gerado: number;
  total_planejado: number;
  error_message: string | null;
}

interface Asset {
  id: string;
  angulo: string;
  image_url: string;
  headline_copy: string | null;
  favorito: boolean;
  reprovado: boolean;
  formato: string;
}

export default function CriativoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [editTarget, setEditTarget] = useState<Asset | null>(null);
  const [editInstruction, setEditInstruction] = useState("");
  const [editing, setEditing] = useState(false);
  const [viewer, setViewer] = useState<Asset | null>(null);

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
    if (bRes.data) setBatch(bRes.data as any);
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
      const { error } = await supabase.functions.invoke("creative-factory?action=edit_asset", {
        body: { asset_id: editTarget.id, instruction: editInstruction },
      });
      if (error) throw error;
      toast.success("Nova variação gerada!");
      setEditTarget(null);
      setEditInstruction("");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Falha na edição");
    } finally {
      setEditing(false);
    }
  }

  const pct = batch && batch.total_planejado > 0
    ? Math.round((batch.total_gerado / batch.total_planejado) * 100)
    : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/criativos">
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Link>
          </Button>
          <div>
            <h1 className="font-serif text-2xl text-primary">{batch?.nome || "..."}</h1>
            <div className="text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
              <Badge variant={batch?.status === "completed" ? "default" : "secondary"}>
                {batch?.status === "processing" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                {batch?.status || "..."}
              </Badge>
              <span>
                {batch?.total_gerado || 0}/{batch?.total_planejado || 0} ({pct}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {batch?.error_message && (
        <Card className="p-3 border-destructive bg-destructive/10 text-sm">{batch.error_message}</Card>
      )}

      {assets.length === 0 ? (
        <Card className="p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-3" />
          <p className="text-muted-foreground">Gerando seus criativos... Isso pode levar alguns minutos.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {assets.map((a) => (
            <Card
              key={a.id}
              className={`overflow-hidden group relative ${a.reprovado ? "opacity-40" : ""}`}
            >
              <button className="block w-full" onClick={() => setViewer(a)}>
                <div className="relative aspect-square bg-muted">
                  <img src={a.image_url} alt={a.angulo} className="w-full h-full object-cover" />
                  {a.headline_copy && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <p className="text-white text-xs font-medium line-clamp-2">{a.headline_copy}</p>
                    </div>
                  )}
                </div>
              </button>
              <div className="p-2 flex items-center justify-between gap-1">
                <Badge variant="outline" className="text-[10px] capitalize">
                  {a.angulo}
                </Badge>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleFavorito(a)}>
                    <Heart className={`h-4 w-4 ${a.favorito ? "fill-primary text-primary" : ""}`} />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditTarget(a)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
                    <a href={a.image_url} download target="_blank" rel="noreferrer">
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => reprovar(a)}>
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
            <DialogTitle className="capitalize">{viewer?.angulo}</DialogTitle>
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

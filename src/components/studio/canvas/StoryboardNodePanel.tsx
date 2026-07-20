import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Zap, Film } from "lucide-react";
import { toast } from "sonner";

type Model = {
  id: string;
  title: string | null;
  ficha: any;
  storyboard: any;
};

interface Props {
  nodeId: string;
  modelId: string | null;
  targetKind: "image" | "video";
  onChangeConfig: (patch: any) => void;
  onExplode: (opts: {
    sourceNodeId: string;
    scenes: any[];
    ficha: any;
    targetKind: "image" | "video";
  }) => Promise<void>;
}

export function StoryboardNodePanel({ nodeId, modelId, targetKind, onChangeConfig, onExplode }: Props) {
  const [models, setModels] = useState<Model[]>([]);
  const [active, setActive] = useState<Model | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase.from("imphq_studio_reference_models" as any) as any)
        .select("id,title,ficha,storyboard").order("created_at", { ascending: false }).limit(40);
      const rows = (data ?? []) as Model[];
      setModels(rows.filter((m) => Array.isArray(m.storyboard) && m.storyboard.length > 0));
      if (modelId) {
        const f = rows.find((m) => m.id === modelId);
        if (f) setActive(f);
      }
    })();
  }, [modelId]);

  const pick = (id: string) => {
    const m = models.find((x) => x.id === id);
    setActive(m || null);
    onChangeConfig({ model_id: id });
  };

  const explode = async () => {
    if (!active) { toast.error("Escolha uma modelagem com storyboard"); return; }
    const scenes = Array.isArray(active.storyboard) ? active.storyboard : [];
    if (scenes.length === 0) { toast.error("Storyboard vazio"); return; }
    setBusy(true);
    try {
      await onExplode({ sourceNodeId: nodeId, scenes, ficha: active.ficha || {}, targetKind });
      toast.success(`${scenes.length} cenas plantadas`);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao explodir");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Modelagem (com storyboard)</Label>
        <Select value={modelId ?? ""} onValueChange={pick}>
          <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="Escolha uma modelagem" /></SelectTrigger>
          <SelectContent>
            {models.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma modelagem com storyboard</div>}
            {models.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.title ?? "Modelo"} · {m.storyboard?.length || 0} cenas
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs">Tipo de nós a gerar</Label>
        <Select value={targetKind} onValueChange={(v) => onChangeConfig({ target_kind: v })}>
          <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="image">🖼️ Imagem por cena</SelectItem>
            <SelectItem value="video">🎬 Vídeo por cena</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {active?.storyboard && Array.isArray(active.storyboard) && (
        <div className="rounded-lg border border-cyan-500/40 bg-cyan-500/5 p-2.5 space-y-1.5 max-h-64 overflow-auto">
          <div className="flex items-center gap-1 text-xs font-semibold text-cyan-300">
            <Film className="h-3 w-3" /> {active.storyboard.length} cenas
          </div>
          <ol className="space-y-1 text-[11px] leading-5 list-decimal list-inside">
            {active.storyboard.slice(0, 8).map((s: any, i: number) => (
              <li key={i} className="text-muted-foreground">
                <span className="text-foreground">{s.titulo || s.title || `Cena ${i + 1}`}</span>
                {s.prompt && <div className="ml-4 text-[10px] line-clamp-2">{s.prompt}</div>}
              </li>
            ))}
            {active.storyboard.length > 8 && <li className="text-[10px]">+{active.storyboard.length - 8} cenas…</li>}
          </ol>
        </div>
      )}

      <Button size="sm" className="w-full h-9 gap-1.5" onClick={explode} disabled={busy || !active}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
        Explodir cenas no canvas
      </Button>
      <p className="text-[10px] text-muted-foreground">
        Cria um nó de {targetKind === "image" ? "imagem" : "vídeo"} por cena, já conectado a este storyboard.
      </p>
    </div>
  );
}

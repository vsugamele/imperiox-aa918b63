import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, Library, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { ReferenciasPicker, type PickerSelection } from "@/components/funis/ReferenciasPicker";

type Model = {
  id: string;
  title: string | null;
  status: string;
  output_type: string | null;
  ficha: any;
  storyboard: any;
  source_assets: any;
  created_at: string;
};

interface Props {
  modelId: string | null;
  contexto?: string;
  onChange: (modelId: string | null, ficha?: any) => void;
}

export function ModelingNodePanel({ modelId, contexto, onChange }: Props) {
  const [models, setModels] = useState<Model[]>([]);
  const [active, setActive] = useState<Model | null>(null);
  const [picker, setPicker] = useState(false);
  const [external, setExternal] = useState<PickerSelection[]>([]);
  const [analyzing, setAnalyzing] = useState(false);

  const load = async () => {
    const { data } = await (supabase.from("imphq_studio_reference_models" as any) as any)
      .select("*").order("created_at", { ascending: false }).limit(40);
    setModels((data ?? []) as any);
    if (modelId) {
      const found = (data ?? []).find((m: any) => m.id === modelId);
      if (found) setActive(found as any);
    }
  };
  useEffect(() => { load(); }, [modelId]);

  const pick = (id: string) => {
    const m = models.find((x) => x.id === id);
    if (!m) return;
    setActive(m);
    onChange(m.id, m.ficha);
  };

  const analyze = async () => {
    if (external.length === 0) { toast.error("Escolha ao menos 1 referência"); return; }
    setAnalyzing(true);
    try {
      const assets = external.map((e) => ({
        url: e.thumbnail ?? e.url,
        title: e.title,
        kind: e.kind === "site" ? "image" : e.kind,
      }));
      const { data, error } = await supabase.functions.invoke("studio-analyze-references", {
        body: { assets, contexto },
      });
      if (error) throw error;
      toast.success("Modelagem criada");
      await load();
      const created = (await (supabase.from("imphq_studio_reference_models" as any) as any)
        .select("*").eq("id", (data as any).id).single()).data as any;
      if (created) {
        setActive(created);
        setExternal([]);
        onChange(created.id, created.ficha);
      }
    } catch (e: any) { toast.error(e.message); }
    finally { setAnalyzing(false); }
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Modelagem salva</Label>
        <Select value={modelId ?? ""} onValueChange={pick}>
          <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="Escolha uma modelagem" /></SelectTrigger>
          <SelectContent>
            {models.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma ainda</div>}
            {models.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.title ?? m.ficha?.estilo_visual ?? "Modelo"} · {(m.source_assets?.length ?? 0)} refs
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border/60 bg-background/40 p-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">…ou criar nova modelagem</Label>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setPicker(true)}>
            <Library className="h-3 w-3" /> Biblioteca
          </Button>
        </div>
        {external.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {external.map((e, i) => (
              <div key={i} className="flex items-center gap-1 bg-background/60 border border-border/60 rounded px-1.5 py-0.5 text-[10px]">
                <img src={e.thumbnail ?? e.url} className="w-4 h-4 object-cover rounded" alt="" />
                <span className="truncate max-w-[80px]">{e.title}</span>
                <button onClick={() => setExternal((p) => p.filter((_, x) => x !== i))}>
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <Button size="sm" className="w-full h-8 gap-1" disabled={analyzing || external.length === 0} onClick={analyze}>
          {analyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          Analisar {external.length > 0 && `(${external.length})`}
        </Button>
      </div>

      {active?.ficha && (
        <div className="rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/5 p-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-fuchsia-300">Ficha ativa</div>
            <a href="#" onClick={(e) => { e.preventDefault(); window.open("/studio?tab=modelagem", "_blank"); }}
              className="text-[10px] text-primary flex items-center gap-0.5"><ExternalLink className="h-2.5 w-2.5" /> ver</a>
          </div>
          <div className="text-[11px] leading-5 space-y-0.5">
            {active.ficha.estilo_visual && <div><b>Estilo:</b> {active.ficha.estilo_visual}</div>}
            {active.ficha.ritmo && <div><b>Ritmo:</b> {active.ficha.ritmo}</div>}
            {active.ficha.iluminação && <div><b>Luz:</b> {active.ficha.iluminação}</div>}
            {active.ficha.hook_pattern && <div><b>Hook:</b> {active.ficha.hook_pattern}</div>}
            {active.ficha.cta_pattern && <div><b>CTA:</b> {active.ficha.cta_pattern}</div>}
          </div>
          {active.ficha.paleta && Array.isArray(active.ficha.paleta) && (
            <div className="flex gap-1 mt-1">
              {active.ficha.paleta.slice(0, 6).map((c: string, i: number) => (
                <div key={i} className="w-4 h-4 rounded border border-border/60" style={{ background: c }} title={c} />
              ))}
            </div>
          )}
        </div>
      )}

      <ReferenciasPicker
        open={picker}
        onClose={() => setPicker(false)}
        multi
        onConfirm={(items) => { setExternal(items); setPicker(false); }}
      />
    </div>
  );
}

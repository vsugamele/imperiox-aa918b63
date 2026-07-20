import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, Film, Wand2, FolderOpen, CheckCircle2, Library, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ReferenciasPicker, type PickerSelection } from "@/components/funis/ReferenciasPicker";

type Ref = { id: string; url: string; titulo: string | null; thumbnail_url: string | null; tipo: string | null };
type Model = {
  id: string; title: string | null; status: string; output_type: string | null;
  source_assets: any; ficha: any; storyboard: any; created_at: string;
};

const OUTPUT_TYPES = [
  { v: "reels", label: "Reels/Short" },
  { v: "vsl", label: "VSL" },
  { v: "carrossel", label: "Carrossel" },
  { v: "imagem", label: "Imagem única" },
];

export function ModelagemTab() {
  const [refs, setRefs] = useState<Ref[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [folder, setFolder] = useState<string>("__all__");
  const [query, setQuery] = useState("");
  const [briefing, setBriefing] = useState("");
  const [outputType, setOutputType] = useState<string>("reels");
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState<Model | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [external, setExternal] = useState<PickerSelection[]>([]);

  const load = async () => {
    const [{ data: r }, { data: m }] = await Promise.all([
      supabase.from("imphq_referencias").select("id, url, titulo, thumbnail_url, tipo").order("created_at", { ascending: false }).limit(300),
      supabase.from("imphq_studio_reference_models" as any).select("*").order("created_at", { ascending: false }).limit(40),
    ]);
    setRefs((r ?? []) as any);
    setModels((m ?? []) as any);
  };
  useEffect(() => { load(); }, []);

  const folders = useMemo(() => {
    const s = new Set<string>();
    refs.forEach((r) => { if (r.tipo) s.add(r.tipo); });
    return Array.from(s);
  }, [refs]);

  const visible = useMemo(() => refs.filter((r) => {
    if (folder !== "__all__" && r.tipo !== folder) return false;
    if (query && !(r.titulo ?? "").toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  }), [refs, folder, query]);

  const toggle = (id: string) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };

  const selectFolder = () => {
    const n = new Set(selected);
    visible.forEach((r) => n.add(r.id));
    setSelected(n);
  };

  const analyze = async () => {
    if (selected.size === 0) { toast.error("Selecione pelo menos 1 referência"); return; }
    setLoading(true);
    try {
      const assets = refs.filter((r) => selected.has(r.id)).map((r) => ({
        url: r.thumbnail_url ?? r.url, title: r.titulo ?? "", kind: "image",
      }));
      const { data, error } = await supabase.functions.invoke("studio-analyze-references", {
        body: { assets, contexto: briefing },
      });
      if (error) throw error;
      toast.success("Modelagem criada");
      await load();
      const created = (await supabase.from("imphq_studio_reference_models" as any).select("*").eq("id", (data as any).id).single()).data as any;
      if (created) setActive(created);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const storyboard = async (m: Model) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("studio-storyboard-from-model", {
        body: { model_id: m.id, output_type: outputType, briefing },
      });
      if (error) throw error;
      toast.success("Storyboard gerado");
      await load();
      const updated = (await supabase.from("imphq_studio_reference_models" as any).select("*").eq("id", m.id).single()).data as any;
      if (updated) setActive(updated);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderOpen className="h-4 w-4" /> Escolha referências (pasta ou fotos)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              <Select value={folder} onValueChange={setFolder}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas as pastas</SelectItem>
                  {folders.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="Buscar" value={query} onChange={(e) => setQuery(e.target.value)} className="w-56" />
              <Button variant="outline" size="sm" onClick={selectFolder}>Selecionar visíveis</Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Limpar ({selected.size})</Button>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-2 max-h-[420px] overflow-y-auto p-1">
              {visible.map((r) => {
                const on = selected.has(r.id);
                const src = r.thumbnail_url ?? r.url;
                return (
                  <button key={r.id} onClick={() => toggle(r.id)}
                    className={cn("relative aspect-square rounded-lg overflow-hidden border-2 transition",
                      on ? "border-primary ring-2 ring-primary/40" : "border-border/40 hover:border-border")}>
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    {on && <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5"><CheckCircle2 className="h-4 w-4 text-primary-foreground" /></div>}
                  </button>
                );
              })}
              {visible.length === 0 && <div className="col-span-full text-sm text-muted-foreground py-8 text-center">Nenhuma referência</div>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Briefing / contexto (opcional)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Textarea rows={3} value={briefing} onChange={(e) => setBriefing(e.target.value)}
              placeholder="Ex.: produto X, oferta Y, tom Z. Ou deixe em branco para IA seguir a estética." />
            <div className="flex flex-wrap gap-2 items-center">
              <Button onClick={analyze} disabled={loading || selected.size === 0}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Analisar modelagem ({selected.size})
              </Button>
              <Select value={outputType} onValueChange={setOutputType}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>{OUTPUT_TYPES.map((o) => <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">Depois use "Gerar storyboard" no modelo</span>
            </div>
          </CardContent>
        </Card>

        {active && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Film className="h-4 w-4" /> {active.title ?? "Modelo"} — {active.status}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {active.ficha && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Ficha de modelagem</div>
                  <div className="text-xs bg-muted/40 rounded p-3 whitespace-pre-wrap font-mono">
                    {JSON.stringify(active.ficha, null, 2)}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => storyboard(active)} disabled={loading}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wand2 className="h-4 w-4 mr-2" />}
                      Gerar storyboard
                    </Button>
                  </div>
                </div>
              )}
              {active.storyboard?.cenas && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Storyboard ({active.storyboard.cenas.length} cenas)</div>
                  <div className="space-y-2">
                    {active.storyboard.cenas.map((c: any, i: number) => (
                      <div key={i} className="border border-border/50 rounded p-3 space-y-1">
                        <div className="flex justify-between text-xs">
                          <Badge variant="outline">Cena {c.n ?? i + 1}</Badge>
                          <span className="text-muted-foreground">{c.duracao_seg ?? "?"}s</span>
                        </div>
                        {c.prompt_imagem && <div className="text-xs"><b>Visual:</b> {c.prompt_imagem}</div>}
                        {c.narracao && <div className="text-xs"><b>Voz:</b> {c.narracao}</div>}
                        {c.on_screen_text && <div className="text-xs"><b>Texto:</b> {c.on_screen_text}</div>}
                        {c.acao && <div className="text-xs text-muted-foreground">{c.acao}</div>}
                      </div>
                    ))}
                    {active.storyboard.cta_final && <div className="text-xs pt-2"><b>CTA:</b> {active.storyboard.cta_final}</div>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-3">
        <div className="text-sm font-medium text-muted-foreground">Modelos salvos</div>
        {models.length === 0 && <div className="text-xs text-muted-foreground">Nenhum ainda</div>}
        {models.map((m) => (
          <button key={m.id} onClick={() => setActive(m)}
            className={cn("w-full text-left border rounded-lg p-3 hover:border-primary/50 transition",
              active?.id === m.id ? "border-primary bg-primary/5" : "border-border/40")}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium truncate">{m.title ?? m.ficha?.estilo_visual ?? "Modelo"}</div>
              <Badge variant="outline" className="text-[10px]">{m.status}</Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {m.output_type ?? "-"} · {(m.source_assets?.length ?? 0)} refs
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Trophy, Trash2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Variant {
  id: string;
  variant_key: string;
  copy: string | null;
  weight: number;
  status: string;
  impressions: number;
  conversions: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  blueprintId: string;
  nodeId: string;
  nodeTitle?: string;
  originalCopy?: string;
}

export function FlowVariantsPanel({ open, onClose, blueprintId, nodeId, nodeTitle, originalCopy }: Props) {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("imphq_flow_node_variants")
      .select("*")
      .eq("blueprint_id", blueprintId)
      .eq("node_id", nodeId)
      .order("variant_key");
    setVariants((data as any) || []);
  };

  useEffect(() => { if (open) load(); /* eslint-disable-next-line */ }, [open, nodeId]);

  const addVariant = async () => {
    const nextKey = String.fromCharCode(65 + variants.length);
    if (variants.length === 0 && originalCopy) {
      await supabase.from("imphq_flow_node_variants").insert({
        blueprint_id: blueprintId, node_id: nodeId, variant_key: "A",
        copy: originalCopy, weight: 50, status: "testing",
      });
      await supabase.from("imphq_flow_node_variants").insert({
        blueprint_id: blueprintId, node_id: nodeId, variant_key: "B",
        copy: "", weight: 50, status: "testing",
      });
    } else {
      await supabase.from("imphq_flow_node_variants").insert({
        blueprint_id: blueprintId, node_id: nodeId, variant_key: nextKey,
        copy: "", weight: 0, status: "testing",
      });
    }
    await load();
  };

  const update = async (id: string, patch: Partial<Variant>) => {
    await supabase.from("imphq_flow_node_variants").update(patch).eq("id", id);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("imphq_flow_node_variants").delete().eq("id", id);
    load();
  };

  const evaluate = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("flow-ab-evaluator", { body: {} });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Avaliados. ${data?.promoted || 0} promovidos.`);
    load();
  };

  const autoFix = async (framework: string) => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("flow-bottleneck-fix", {
      body: { blueprint_id: blueprintId, framework, create_variant: false },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    const suggestion = (data as any)?.suggestion;
    if (!suggestion) { toast.error("Sem sugestão gerada"); return; }
    // injeta como nova variante neste nó
    const nextKey = String.fromCharCode(65 + variants.length);
    await supabase.from("imphq_flow_node_variants").insert({
      blueprint_id: blueprintId, node_id: nodeId, variant_key: nextKey,
      copy: suggestion, weight: 50, status: "testing",
    });
    if (variants.length === 0 && originalCopy) {
      await supabase.from("imphq_flow_node_variants").insert({
        blueprint_id: blueprintId, node_id: nodeId, variant_key: "A",
        copy: originalCopy, weight: 50, status: "testing",
      });
    }
    toast.success(`Variante ${nextKey} gerada (${framework})`);
    load();
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[520px] sm:max-w-[520px] overflow-y-auto bg-secondary/40">
        <SheetHeader>
          <SheetTitle className="leading-7">A/B Variantes · {nodeTitle || nodeId.slice(0, 8)}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={addVariant}>
              <Plus className="h-3 w-3 mr-1" /> Nova variante
            </Button>
            <Button size="sm" variant="outline" onClick={evaluate} disabled={loading}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trophy className="h-3 w-3 mr-1" />}
              Avaliar agora
            </Button>
            <Button size="sm" variant="outline" onClick={() => autoFix("schwartz")} disabled={loading}>
              ⚡ Schwartz
            </Button>
            <Button size="sm" variant="outline" onClick={() => autoFix("bencivenga")} disabled={loading}>
              🛡 Bencivenga
            </Button>
            <Button size="sm" variant="outline" onClick={() => autoFix("filemon")} disabled={loading}>
              🎯 Filemon E3
            </Button>
          </div>

          {variants.length === 0 && (
            <p className="text-xs text-muted-foreground leading-7">
              Sem variantes. Crie a primeira para iniciar o teste — a IA aloca tráfego pelo peso e promove o vencedor automaticamente quando atinge significância (n≥100 + Wilson 95%).
            </p>
          )}

          {variants.map((v) => {
            const rate = v.impressions > 0 ? (v.conversions / v.impressions) * 100 : 0;
            return (
              <div key={v.id} className="rounded border border-border/40 bg-background/40 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">Variante {v.variant_key}</Badge>
                    {v.status === "winner" && <Badge className="bg-emerald-500/20 text-emerald-300 text-[10px]"><Trophy className="h-3 w-3 mr-1" />Vencedora</Badge>}
                    {v.status === "loser" && <Badge variant="outline" className="text-[10px] opacity-60">Perdedora</Badge>}
                  </div>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => remove(v.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <Textarea
                  value={v.copy || ""}
                  rows={4}
                  className="text-xs leading-7"
                  onChange={(e) => setVariants((prev) => prev.map((x) => x.id === v.id ? { ...x, copy: e.target.value } : x))}
                  onBlur={() => update(v.id, { copy: v.copy })}
                />
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <label className="flex items-center gap-1">
                    Peso
                    <Input
                      type="number" min={0} max={100}
                      value={v.weight}
                      className="h-6 w-14 text-[10px]"
                      onChange={(e) => setVariants((prev) => prev.map((x) => x.id === v.id ? { ...x, weight: Number(e.target.value) } : x))}
                      onBlur={() => update(v.id, { weight: v.weight })}
                    />
                  </label>
                  <span>· {v.impressions} imp · {v.conversions} conv</span>
                  <span className="font-mono text-emerald-300">{rate.toFixed(1)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}

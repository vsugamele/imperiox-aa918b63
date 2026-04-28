import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Handshake, Save } from "lucide-react";
import { toast } from "sonner";

interface Props {
  projectId: string;
  produtos?: { nome: string }[];
}

interface SplitConfig {
  default_share: number; // 0..1 (sua parte)
  per_product?: Record<string, number>;
}

/**
 * Editor visual de divisão de receita com Expert.
 * Persiste em imphq_projects.settings.revenue_splits.
 * Usado como fallback quando a plataforma (Hotmart/Ticto/Kiwify) não envia comissao_produtor.
 */
export function RevenueSplitSettings({ projectId, produtos = [] }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [defaultShare, setDefaultShare] = useState(100);
  const [perProduct, setPerProduct] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("imphq_projects")
        .select("settings")
        .eq("id", projectId)
        .maybeSingle();
      const cfg = (data?.settings as any)?.revenue_splits as SplitConfig | undefined;
      setDefaultShare(Math.round((cfg?.default_share ?? 1) * 100));
      const pp: Record<string, number> = {};
      Object.entries(cfg?.per_product || {}).forEach(([k, v]) => { pp[k] = Math.round((v as number) * 100); });
      setPerProduct(pp);
      setLoading(false);
    })();
  }, [projectId]);

  const save = async () => {
    setSaving(true);
    const { data: cur } = await supabase
      .from("imphq_projects")
      .select("settings")
      .eq("id", projectId)
      .maybeSingle();
    const settings = (cur?.settings as any) || {};
    const cleanedPerProduct: Record<string, number> = {};
    Object.entries(perProduct).forEach(([k, v]) => {
      if (v >= 0 && v <= 100) cleanedPerProduct[k] = v / 100;
    });
    settings.revenue_splits = {
      default_share: Math.max(0, Math.min(100, defaultShare)) / 100,
      per_product: cleanedPerProduct,
    };
    const { error } = await supabase
      .from("imphq_projects")
      .update({ settings } as any)
      .eq("id", projectId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Divisão salva! Novas vendas usarão esses %.");
  };

  if (loading) return null;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Handshake className="h-4 w-4 text-primary" />
          Divisão de Receita com Expert
          <Badge variant="outline" className="ml-auto text-[10px]">Fallback</Badge>
        </CardTitle>
        <p className="text-[11px] text-muted-foreground leading-6">
          Quando a plataforma já envia <code>comissao_produtor</code> ou <code>valor_liquido</code>, esses valores são usados. Os % abaixo entram só como fallback.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 items-end">
          <div>
            <Label className="text-xs">Sua parte padrão (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={defaultShare}
              onChange={(e) => setDefaultShare(Number(e.target.value) || 0)}
            />
          </div>
          <div className="text-xs text-muted-foreground leading-6">
            Expert recebe <span className="font-mono text-amber-400">{Math.max(0, 100 - defaultShare)}%</span>
          </div>
        </div>

        {produtos.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Por produto (opcional)</Label>
            <div className="space-y-2 max-h-[260px] overflow-auto pr-2">
              {produtos.map((p) => (
                <div key={p.nome} className="flex items-center gap-2">
                  <span className="flex-1 text-sm truncate">{p.nome}</span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    placeholder={String(defaultShare)}
                    className="w-24"
                    value={perProduct[p.nome] ?? ""}
                    onChange={(e) => {
                      const v = e.target.value === "" ? undefined : Number(e.target.value);
                      setPerProduct((prev) => {
                        const next = { ...prev };
                        if (v === undefined || isNaN(v)) delete next[p.nome];
                        else next[p.nome] = v;
                        return next;
                      });
                    }}
                  />
                  <span className="text-xs text-muted-foreground w-6">%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button onClick={save} disabled={saving} size="sm" className="w-full">
          <Save className="h-3 w-3 mr-2" />
          {saving ? "Salvando…" : "Salvar divisão"}
        </Button>
      </CardContent>
    </Card>
  );
}

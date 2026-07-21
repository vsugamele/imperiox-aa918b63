import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Trophy, Loader2, Crown, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface VariantRow {
  id: string;
  variant_label: string | null;
  variant_angulo: string | null;
  status: string;
  variant_score: number | null;
  variant_score_data: any;
  is_variant_winner: boolean;
  output: any;
  config: any;
  titulo: string | null;
}

interface Props {
  node: any;
  onPromote: (winnerId: string, baseId: string) => Promise<void>;
  onFocusNode?: (id: string) => void;
}

export function BatchVariationsPanel({ node, onPromote, onFocusNode }: Props) {
  const [count, setCount] = useState(3);
  const [strategy, setStrategy] = useState<"hooks" | "styles" | "generic">("hooks");
  const [loading, setLoading] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [rows, setRows] = useState<VariantRow[]>([]);
  const groupId: string | null = node?.data?.batch_group_id || null;
  const baseId: string = node?.id;

  const load = async () => {
    if (!groupId) { setRows([]); return; }
    const { data } = await supabase
      .from("imphq_studio_canvas_nodes")
      .select("id,variant_label,variant_angulo,status,variant_score,variant_score_data,is_variant_winner,output,config,titulo,variant_of")
      .eq("batch_group_id", groupId)
      .order("variant_label");
    setRows((data as any) || []);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [groupId, node?.data?.status]);

  const generate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("studio-batch-variations", {
        body: { node_id: baseId, count, strategy },
      });
      if (error) throw error;
      toast.success(`${(data as any)?.created || count} variantes criadas · rode o fluxo para gerar`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "erro ao gerar variantes");
    } finally { setLoading(false); }
  };

  const scoreAll = async () => {
    if (!groupId) return;
    setScoring(true);
    try {
      const { data, error } = await supabase.functions.invoke("studio-variant-score", {
        body: { batch_group_id: groupId },
      });
      if (error) throw error;
      const winnerLabel = ((data as any)?.results || []).find((r: any) => r.id === (data as any)?.winner_id)?.label;
      toast.success(`Vencedora: ${winnerLabel || "definida"}`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "erro ao avaliar");
    } finally { setScoring(false); }
  };

  const promote = async (winnerId: string) => {
    if (winnerId === baseId) { toast.info("A base já é a vencedora"); return; }
    await onPromote(winnerId, baseId);
    toast.success("Vencedora promovida · downstream reconectado");
  };

  const removeVariant = async (id: string) => {
    if (id === baseId) { toast.error("Não pode remover a base pelo painel"); return; }
    await supabase.from("imphq_studio_canvas_nodes").delete().eq("id", id);
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const hasBatch = !!groupId && rows.length > 0;
  const allDone = hasBatch && rows.every(r => r.status === "gerado" || r.status === "erro");
  const anyScored = rows.some(r => r.variant_score != null);

  return (
    <div className="rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/5 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-fuchsia-300" />
        <Label className="text-xs text-fuchsia-200">Variações em lote (A/B/C)</Label>
      </div>

      {!hasBatch && (
        <>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Label className="text-[10px] text-muted-foreground">Quantas</Label>
              <Select value={String(count)} onValueChange={(v) => setCount(Number(v))}>
                <SelectTrigger className="h-8 mt-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2,3,4,5,6].map(n => <SelectItem key={n} value={String(n)}>{n} variações</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label className="text-[10px] text-muted-foreground">Estratégia</Label>
              <Select value={strategy} onValueChange={(v) => setStrategy(v as any)}>
                <SelectTrigger className="h-8 mt-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hooks">Hooks / ângulos</SelectItem>
                  <SelectItem value="styles">Estilos visuais</SelectItem>
                  <SelectItem value="generic">Genérico</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={generate} disabled={loading} size="sm" className="w-full gap-1.5 bg-fuchsia-600 hover:bg-fuchsia-500">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Gerar {count} variações
          </Button>
          <p className="text-[10px] text-muted-foreground leading-5">
            Cria N nós irmãos com prompts distintos, conectados aos mesmos upstream. Depois rode o fluxo e clique em "Avaliar" para escolher a vencedora automaticamente.
          </p>
        </>
      )}

      {hasBatch && (
        <>
          <div className="flex gap-2">
            <Button onClick={scoreAll} disabled={!allDone || scoring} size="sm" variant="outline" className="flex-1 gap-1.5 h-8">
              {scoring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trophy className="h-3.5 w-3.5" />}
              {allDone ? "Avaliar & escolher vencedora" : "Aguardando gerações…"}
            </Button>
          </div>

          <div className="space-y-2">
            {rows.map(r => {
              const isBase = r.id === baseId;
              const preview = r.output?.url;
              const kind = r.output?.kind;
              const scoreData = r.variant_score_data || {};
              return (
                <div
                  key={r.id}
                  className={cn(
                    "rounded border p-2 space-y-1.5 cursor-pointer transition",
                    r.is_variant_winner ? "border-amber-400/70 bg-amber-500/10 shadow shadow-amber-500/20" : "border-border/40 bg-background/40 hover:border-fuchsia-500/40",
                  )}
                  onClick={() => onFocusNode?.(r.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase text-fuchsia-200">Variante {r.variant_label || "?"}</span>
                      {isBase && <span className="text-[9px] text-muted-foreground">(base)</span>}
                      {r.variant_angulo && <span className="text-[9px] text-fuchsia-300/80">· {r.variant_angulo}</span>}
                      {r.is_variant_winner && <Crown className="h-3 w-3 text-amber-400" />}
                    </div>
                    <div className="flex items-center gap-1">
                      {r.variant_score != null && (
                        <span className={cn(
                          "text-[10px] font-bold px-1.5 py-0.5 rounded",
                          r.variant_score >= 75 ? "bg-emerald-500/20 text-emerald-300" :
                          r.variant_score >= 50 ? "bg-amber-500/20 text-amber-300" :
                          "bg-rose-500/20 text-rose-300",
                        )}>{r.variant_score}</span>
                      )}
                      <span className="text-[9px] text-muted-foreground">{r.status}</span>
                    </div>
                  </div>

                  {preview && kind === "image" && <img src={preview} className="w-full h-20 object-cover rounded" alt="" />}
                  {preview && kind === "video" && <video src={preview} className="w-full h-20 object-cover rounded" muted />}

                  {scoreData?.veredito && (
                    <p className="text-[10px] text-foreground/80 leading-4">{scoreData.veredito}</p>
                  )}
                  {scoreData?.diagnostico && (
                    <p className="text-[9px] text-muted-foreground leading-4 line-clamp-2">{scoreData.diagnostico}</p>
                  )}

                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    {anyScored && !isBase && (
                      <Button size="sm" variant="outline" className="h-6 text-[10px] flex-1"
                        onClick={() => promote(r.id)}>
                        <Crown className="h-3 w-3 mr-1" /> Promover
                      </Button>
                    )}
                    {!isBase && (
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-rose-400"
                        onClick={() => removeVariant(r.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

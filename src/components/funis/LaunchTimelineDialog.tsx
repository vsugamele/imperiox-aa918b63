import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Calendar, Trash2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TimelineItem {
  id: string;
  projeto_id: string;
  funil_id?: string | null;
  peca_tipo: string;
  title: string;
  description?: string | null;
  scheduled_at: string;
  duration_min?: number;
  status: string;
  is_milestone?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  funilId?: string;
}

const TIPO_COLORS: Record<string, string> = {
  criativo: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  live: "bg-violet-500/20 text-violet-300 border-violet-500/40",
  email: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  wa: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  cpl: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
  abertura: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  fechamento: "bg-red-500/20 text-red-300 border-red-500/40",
  lembrete: "bg-slate-500/20 text-slate-300 border-slate-500/40",
};

export function LaunchTimelineDialog({ open, onClose, projectId, funilId }: Props) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [modelo, setModelo] = useState("lancamento");
  const [dataCarrinho, setDataCarrinho] = useState("");
  const [diasPre, setDiasPre] = useState(7);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("imphq_launch_timeline")
      .select("*")
      .eq("projeto_id", projectId)
      .order("scheduled_at", { ascending: true });
    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId]);

  const generate = async () => {
    if (!dataCarrinho) {
      toast.error("Defina a data de abertura do carrinho");
      return;
    }
    setGenerating(true);
    try {
      const { error } = await supabase.functions.invoke("launch-timeline-generate", {
        body: {
          project_id: projectId,
          funil_id: funilId,
          modelo,
          data_carrinho_aberto: new Date(dataCarrinho).toISOString(),
          dias_pre_lancamento: diasPre,
        },
      });
      if (error) throw error;
      toast.success("Cronograma gerado!");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar");
    } finally {
      setGenerating(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("imphq_launch_timeline").update({ status }).eq("id", id);
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status } : it)));
  };

  const remove = async (id: string) => {
    await supabase.from("imphq_launch_timeline").delete().eq("id", id);
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const grouped = items.reduce((acc, it) => {
    const d = it.scheduled_at.slice(0, 10);
    (acc[d] = acc[d] || []).push(it);
    return acc;
  }, {} as Record<string, TimelineItem[]>);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl bg-secondary/40 border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Calendar className="h-4 w-4 text-pink-400" />
            Orquestrador de Lançamento
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 rounded-lg bg-background/40 border border-border/40">
          <div>
            <Label className="text-xs">Modelo</Label>
            <Select value={modelo} onValueChange={setModelo}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lancamento">Lançamento</SelectItem>
                <SelectItem value="perpetuo">Perpétuo</SelectItem>
                <SelectItem value="webinar">Webinar</SelectItem>
                <SelectItem value="x1">X1</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Carrinho abre</Label>
            <Input type="date" value={dataCarrinho} onChange={(e) => setDataCarrinho(e.target.value)} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-xs">Dias pré-lanç.</Label>
            <Input type="number" value={diasPre} onChange={(e) => setDiasPre(Number(e.target.value))} className="h-8 text-xs" min={1} max={30} />
          </div>
          <div className="flex items-end">
            <Button size="sm" className="w-full bg-pink-600 hover:bg-pink-500" onClick={generate} disabled={generating}>
              {generating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
              Gerar com IA
            </Button>
          </div>
        </div>

        <div className="space-y-3 mt-2">
          {loading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-pink-400" /></div>}
          {!loading && items.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-8">
              Nenhum item ainda. Defina o modelo e a data e gere o cronograma com IA.
            </p>
          )}
          {Object.entries(grouped).map(([date, list]) => (
            <div key={date}>
              <p className="text-[10px] uppercase tracking-wider text-pink-400 font-semibold mb-1.5">
                {new Date(date).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
              </p>
              <div className="space-y-1.5">
                {list.map((it) => (
                  <div
                    key={it.id}
                    className={cn(
                      "rounded-lg border bg-background/40 p-2.5 flex items-start gap-2",
                      it.is_milestone && "border-pink-500/50 bg-pink-500/5",
                      it.status === "done" && "opacity-60"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn("text-[9px] px-1.5 py-0.5 rounded border uppercase font-semibold", TIPO_COLORS[it.peca_tipo] || "bg-muted/30 text-muted-foreground border-muted")}>
                          {it.peca_tipo}
                        </span>
                        {it.is_milestone && <Badge className="bg-pink-500/30 text-pink-200 text-[9px] px-1 py-0">milestone</Badge>}
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(it.scheduled_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-foreground leading-tight mt-1">{it.title}</p>
                      {it.description && <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">{it.description}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => updateStatus(it.id, it.status === "done" ? "pending" : "done")}
                      >
                        <CheckCircle2 className={cn("h-3.5 w-3.5", it.status === "done" ? "text-emerald-400" : "text-muted-foreground")} />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400 hover:text-red-300" onClick={() => remove(it.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

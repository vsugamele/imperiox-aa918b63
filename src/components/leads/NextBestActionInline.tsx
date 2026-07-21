import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Brain, Target, MessageCircle, Phone, Copy, Zap, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { onlyDigits } from "@/lib/phoneVariants";

interface Prediction {
  id: string;
  conversion_probability: number;
  churn_risk: string;
  predicted_value: number;
  recommended_actions: string[];
  next_best_action: string;
  ai_summary: string;
}

interface Props {
  lead: any;
}

export default function NextBestActionInline({ lead }: Props) {
  const [pred, setPred] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const load = async () => {
    if (!lead?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("imphq_lead_predictions")
      .select("*")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setPred((data as any) || null);
    setLoading(false);
  };

  useEffect(() => { load(); }, [lead?.id]);

  const analyze = async () => {
    if (!lead?.id) return;
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("lead-predict", { body: { lead_ids: [lead.id] } });
      if (error) throw error;
      if (data?.ok) { toast.success("Predição gerada"); await load(); }
      else toast.error(data?.error || "Erro");
    } catch (e: any) {
      toast.error(e?.message || "Erro");
    } finally { setAnalyzing(false); }
  };

  const nba = pred?.next_best_action || "";
  const phone = onlyDigits(lead?.phone || lead?.data?.phone || "");
  const isWhatsApp = /whats|zap|mensag/i.test(nba);
  const isCall = /ligar|liga|telefon/i.test(nba);

  const openWhatsApp = () => {
    if (!phone) { toast.error("Sem telefone"); return; }
    const msg = encodeURIComponent(pred?.recommended_actions?.[0] || "");
    window.open(`https://wa.me/${phone}${msg ? `?text=${msg}` : ""}`, "_blank");
  };

  const copyAction = () => {
    navigator.clipboard.writeText([nba, ...(pred?.recommended_actions || [])].filter(Boolean).join("\n• "));
    toast.success("Copiado");
  };

  if (loading) return null;

  if (!pred) {
    return (
      <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <p className="text-xs text-muted-foreground">Sem predição para este lead</p>
        </div>
        <Button size="sm" onClick={analyze} disabled={analyzing} className="h-7 text-xs gap-1">
          {analyzing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
          Analisar
        </Button>
      </div>
    );
  }

  const prob = pred.conversion_probability;
  const probColor = prob >= 70 ? "text-emerald-400" : prob >= 40 ? "text-amber-400" : "text-destructive";

  return (
    <div className="rounded-lg border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold">Next Best Action</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("text-lg font-bold leading-none", probColor)}>{prob}%</span>
          <Button size="icon" variant="ghost" onClick={analyze} disabled={analyzing} className="h-6 w-6">
            <RefreshCw className={cn("h-3 w-3", analyzing && "animate-spin")} />
          </Button>
        </div>
      </div>

      <Progress value={prob} className="h-1" />

      {nba && (
        <div className="flex items-start gap-2">
          <Target className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-foreground leading-6">{nba}</p>
        </div>
      )}

      {pred.ai_summary && <p className="text-[11px] text-muted-foreground leading-5">{pred.ai_summary}</p>}

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="text-[9px]">Churn: {pred.churn_risk}</Badge>
        {pred.predicted_value > 0 && (
          <Badge variant="outline" className="text-[9px] text-emerald-400 border-emerald-500/30">
            R$ {pred.predicted_value.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        {(isWhatsApp || phone) && (
          <Button size="sm" onClick={openWhatsApp} className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-500">
            <MessageCircle className="h-3 w-3" /> WhatsApp
          </Button>
        )}
        {isCall && phone && (
          <Button size="sm" variant="outline" asChild className="h-7 text-xs gap-1">
            <a href={`tel:${phone}`}><Phone className="h-3 w-3" /> Ligar</a>
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={copyAction} className="h-7 text-xs gap-1">
          <Copy className="h-3 w-3" /> Copiar
        </Button>
      </div>
    </div>
  );
}

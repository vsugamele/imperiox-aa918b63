import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, Flame, AlertTriangle, Sparkles, TrendingDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FocoItem {
  icon: any;
  tone: "danger" | "warn" | "info" | "good";
  title: string;
  detail: string;
  cta?: { label: string; kind: string; payload?: any };
}

interface Props {
  projectId: string;
  signals: {
    healthScore: number;
    roas: number;
    leadsToday: number;
    salesToday: number;
    pendingTotal: number;
    vendas7d: number;
    conteudos14d: number;
    adsHojeTotal: number;
    receitaHoje: number;
  };
}

const toneClass: Record<string, string> = {
  danger: "border-red-500/30 bg-red-500/5",
  warn: "border-amber-500/30 bg-amber-500/5",
  info: "border-blue-500/30 bg-blue-500/5",
  good: "border-emerald-500/30 bg-emerald-500/5",
};

export function FocoDoDia({ projectId, signals }: Props) {
  const [enqueueing, setEnqueueing] = useState<string | null>(null);

  const items = useMemo<FocoItem[]>(() => {
    const list: FocoItem[] = [];
    const { healthScore, roas, salesToday, pendingTotal, vendas7d, conteudos14d, adsHojeTotal, receitaHoje } = signals;

    if (pendingTotal >= 3) {
      list.push({
        icon: Flame, tone: "danger",
        title: `${pendingTotal} PIX/boletos pendentes`,
        detail: "Recupere agora — janela de conversão fechando.",
        cta: { label: "Disparar recuperação", kind: "recover_pending", payload: { count: pendingTotal } },
      });
    }
    if (adsHojeTotal > 50 && receitaHoje === 0) {
      list.push({
        icon: TrendingDown, tone: "danger",
        title: `R$ ${adsHojeTotal.toFixed(0)} em ads hoje, 0 vendas`,
        detail: "Auditar campanhas: criativo, oferta ou tracking quebrado.",
        cta: { label: "Auditar ads", kind: "audit_ads_today", payload: { gasto: adsHojeTotal } },
      });
    }
    if (vendas7d === 0 && healthScore < 60) {
      list.push({
        icon: AlertTriangle, tone: "warn",
        title: "Sem vendas nos últimos 7 dias",
        detail: "Aciona Imperius para diagnóstico completo do funil.",
        cta: { label: "Plano de recuperação", kind: "health_recovery", payload: { health: healthScore } },
      });
    }
    if (conteudos14d === 0) {
      list.push({
        icon: Sparkles, tone: "warn",
        title: "Nenhum conteúdo nos últimos 14 dias",
        detail: "Produza 2-3 peças para reaquecer o avatar.",
        cta: { label: "Gerar pauta", kind: "content_plan", payload: {} },
      });
    }
    if (roas > 0 && roas < 1) {
      list.push({
        icon: TrendingDown, tone: "warn",
        title: `ROAS ${roas.toFixed(2)} no mês`,
        detail: "Você está perdendo dinheiro com ads. Pausar piores criativos.",
        cta: { label: "Pausar piores", kind: "pause_low_roas", payload: { roas } },
      });
    }
    if (list.length === 0 && healthScore >= 80 && salesToday > 0) {
      list.push({
        icon: Target, tone: "good",
        title: "Tudo no eixo hoje.",
        detail: `Health ${healthScore}/100. Foque em escalar o que já está vendendo.`,
      });
    }
    return list.slice(0, 3);
  }, [signals]);

  if (items.length === 0) return null;

  const enqueue = async (it: FocoItem) => {
    if (!it.cta) return;
    setEnqueueing(it.cta.kind);
    try {
      const { error } = await supabase.from("imphq_ai_actions").insert({
        projeto_id: projectId,
        kind: it.cta.kind,
        risk_level: "low",
        status: "pending",
        title: it.title,
        reason: it.detail,
        source: "foco_do_dia",
        payload: it.cta.payload || {},
      } as any);
      if (error) throw error;
      toast.success("Ação enviada para o Imperius");
    } catch (e: any) {
      toast.error(e.message || "Falha ao enviar");
    } finally {
      setEnqueueing(null);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-3.5 w-3.5 text-gold" />
          <h3 className="text-xs uppercase tracking-wider font-semibold">Foco do dia</h3>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {items.map((it, i) => {
            const Icon = it.icon;
            return (
              <div key={i} className={`rounded-md border px-3 py-2.5 ${toneClass[it.tone]}`}>
                <div className="flex items-start gap-2 mb-1.5">
                  <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <p className="text-xs font-semibold leading-tight">{it.title}</p>
                </div>
                <p className="text-[11px] text-muted-foreground leading-5 mb-2">{it.detail}</p>
                {it.cta && (
                  <Button
                    size="sm" variant="outline"
                    className="h-6 px-2 text-[10px] gap-1"
                    onClick={() => enqueue(it)}
                    disabled={enqueueing === it.cta.kind}
                  >
                    {enqueueing === it.cta.kind ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                    {it.cta.label}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

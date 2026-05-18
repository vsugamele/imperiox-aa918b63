import { useState } from "react";
import { AlertTriangle, Flame, EyeOff, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  ads: any[];
  onFilter?: (term: string) => void;
  projectId?: string;
}

interface Alert {
  icon: any;
  text: string;
  tone: "danger" | "warn" | "info";
  filter?: string;
  imperius?: { kind: string; payload: any };
}

const toneClass = {
  danger: "bg-red-500/10 border-red-500/20 text-red-300 hover:bg-red-500/15",
  warn:   "bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/15",
  info:   "bg-blue-500/10 border-blue-500/20 text-blue-300 hover:bg-blue-500/15",
};

export function AlertsHeader({ ads, onFilter, projectId }: Props) {
  const [enq, setEnq] = useState<number | null>(null);
  // Agrupa por campanha
  const byCamp = new Map<string, any[]>();
  for (const a of ads) {
    const k = a.campanha || "Sem nome";
    if (!byCamp.has(k)) byCamp.set(k, []);
    byCamp.get(k)!.push(a);
  }

  const alerts: Alert[] = [];

  // 1. Campanhas com gasto > 200 sem compras
  const burning: { name: string; valor: number }[] = [];
  byCamp.forEach((items, name) => {
    const valor = items.reduce((s, a) => s + Number(a.valor || 0), 0);
    const compras = items.reduce((s, a) => s + Number(a.compras || 0), 0);
    if (valor >= 200 && compras === 0) burning.push({ name, valor });
  });
  if (burning.length > 0) {
    alerts.push({
      icon: Flame,
      tone: "danger",
      text: `${burning.length} campanha(s) gastaram >R$200 sem nenhuma compra`,
      filter: burning[0].name,
      imperius: { kind: "ads_burning_no_sales", payload: { campanhas: burning } },
    });
  }

  // 2. Frequência alta (saturação)
  const saturated: { name: string; freq: number }[] = [];
  byCamp.forEach((items, name) => {
    const freqs = items.filter(a => a.frequencia && a.frequencia > 0).map(a => Number(a.frequencia));
    if (!freqs.length) return;
    const avg = freqs.reduce((a, b) => a + b, 0) / freqs.length;
    if (avg > 4) saturated.push({ name, freq: avg });
  });
  if (saturated.length > 0) {
    alerts.push({
      icon: AlertTriangle,
      tone: "warn",
      text: `Saturação detectada: ${saturated.slice(0, 2).map(s => `${s.name} (${s.freq.toFixed(1)})`).join(", ")}${saturated.length > 2 ? ` +${saturated.length - 2}` : ""}`,
      imperius: { kind: "ads_saturation", payload: { campanhas: saturated } },
    });
  }

  // 3. Sem dados nas últimas 24h
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const recent = ads.filter(a => a.data_ref >= yest);
  if (ads.length > 0 && recent.length === 0) {
    alerts.push({
      icon: EyeOff,
      tone: "info",
      text: "Sem dados das últimas 24h. Sincronize a conta de anúncios.",
    });
  }

  if (alerts.length === 0) return null;

  const enqueue = async (i: number, a: Alert) => {
    if (!a.imperius) return;
    setEnq(i);
    try {
      const { error } = await supabase.from("imphq_ai_actions").insert({
        projeto_id: projectId || null,
        kind: a.imperius.kind,
        risk_level: "low",
        status: "pending",
        title: a.text,
        reason: "Alerta crítico detectado no Gerenciador.",
        source: "gerenciador_alerts",
        payload: a.imperius.payload,
      } as any);
      if (error) throw error;
      toast.success("Ação enviada ao Imperius");
    } catch (e: any) {
      toast.error(e.message || "Falha ao enviar");
    } finally {
      setEnq(null);
    }
  };

  return (
    <div className="space-y-1.5">
      {alerts.slice(0, 3).map((a, i) => {
        const Icon = a.icon;
        const clickable = !!a.filter && !!onFilter;
        return (
          <div
            key={i}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-md border text-xs transition-colors",
              toneClass[a.tone]
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <button
              disabled={!clickable}
              onClick={() => clickable && onFilter!(a.filter!)}
              className={cn("flex-1 text-left", clickable ? "cursor-pointer hover:underline" : "cursor-default")}
            >
              {a.text}
            </button>
            {clickable && <span className="text-[10px] opacity-60">filtrar</span>}
            {a.imperius && (
              <button
                onClick={() => enqueue(i, a)}
                disabled={enq === i}
                className="text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-current/30 hover:bg-current/10"
              >
                {enq === i ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Imperius
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

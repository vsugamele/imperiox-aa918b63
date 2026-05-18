import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Flame, AlertTriangle, Clock, ArrowRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TodayItem {
  key: string;
  level: "ok" | "warn" | "alert";
  icon: React.ReactNode;
  title: string;
  count: number;
  detail: string;
  href: string;
  action: string;
}

/**
 * Card "Hoje" — 3 coisas que precisam de atenção agora.
 * 1. Hot leads sem resposta há >10min
 * 2. Ads com CPA 2x acima da meta nas últimas 24h
 * 3. Vendas Pix/Boleto não pagas em >30min
 */
export default function TodayCard({ projectId }: { projectId?: string }) {
  const [items, setItems] = useState<TodayItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const now = Date.now();
      const tenMinAgo = new Date(now - 10 * 60 * 1000).toISOString();
      const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString();
      const thirtyMinAgo = new Date(now - 30 * 60 * 1000).toISOString();
      const yesterday = new Date(now - 24 * 60 * 60 * 1000).toISOString();

      // 1) Hot leads: last_intent_at nas últimas 2h, sem resposta há >10min
      let hotQ = supabase
        .from("imphq_leads")
        .select("id", { count: "exact", head: true })
        .gte("data->>last_intent_at", twoHoursAgo)
        .or(`data->>last_outgoing_at.is.null,data->>last_outgoing_at.lte.${tenMinAgo}`);
      if (projectId && projectId !== "all") hotQ = hotQ.eq("project_id", projectId);
      const { count: hotCount } = await hotQ;

      // 2) Pix/Boleto pendentes >30min (últimas 24h)
      let pixQ = supabase
        .from("imphq_vendas")
        .select("id", { count: "exact", head: true })
        .in("status", ["pendente", "aguardando_pagamento", "pix_gerado", "boleto_gerado"])
        .gte("data_venda", yesterday)
        .lte("data_venda", thirtyMinAgo);
      if (projectId && projectId !== "all") pixQ = pixQ.eq("project_id", projectId);
      const { count: pixCount } = await pixQ;

      // 3) Ads com alerta nas últimas 24h (usa imphq_ads_actions categoria 'alert' ou CPA ruim em imphq_ads)
      let adsCount = 0;
      try {
        let adsQ = supabase
          .from("imphq_ads")
          .select("id", { count: "exact", head: true })
          .gte("data", new Date(now - 86400000).toISOString().slice(0, 10))
          .eq("status", "ACTIVE")
          .gt("spend", 50)
          .or("purchases.is.null,purchases.eq.0");
        const { count } = await adsQ;
        adsCount = count || 0;
      } catch {
        adsCount = 0;
      }

      const list: TodayItem[] = [
        {
          key: "hot",
          level: (hotCount || 0) > 0 ? "alert" : "ok",
          icon: <Flame className="h-5 w-5" />,
          title: "Leads quentes esperando",
          count: hotCount || 0,
          detail: "Pix/Boleto nas últimas 2h sem resposta há +10min",
          href: projectId && projectId !== "all" ? `/leads?projeto=${projectId}&filter=hot` : "/leads?filter=hot",
          action: "Responder",
        },
        {
          key: "pix",
          level: (pixCount || 0) > 0 ? "warn" : "ok",
          icon: <Clock className="h-5 w-5" />,
          title: "Pix/Boleto pendentes",
          count: pixCount || 0,
          detail: "Gerados há mais de 30min e ainda não pagos",
          href: projectId && projectId !== "all" ? `/recuperacao?projeto=${projectId}` : "/recuperacao",
          action: "Recuperar",
        },
        {
          key: "ads",
          level: adsCount > 3 ? "alert" : adsCount > 0 ? "warn" : "ok",
          icon: <AlertTriangle className="h-5 w-5" />,
          title: "Anúncios sem conversão",
          count: adsCount,
          detail: "Ativos com >R$50 gastos hoje e zero compras",
          href: "/gerenciador",
          action: "Auditar",
        },
      ];
      setItems(list);
      setLoading(false);
    };
    load();
    const t = setInterval(load, 2 * 60 * 1000);
    return () => clearInterval(t);
  }, [projectId]);

  const allClear = !loading && items.every((i) => i.level === "ok");

  if (allClear) {
    return (
      <Card className="bg-emerald-500/5 border-emerald-500/30 px-5 py-4 flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        <div>
          <div className="font-medium text-foreground">Tudo sob controle</div>
          <div className="text-xs text-muted-foreground">Nenhuma ação urgente requer sua atenção agora.</div>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {items.map((it) => {
        const tone =
          it.level === "alert"
            ? "border-red-500/40 bg-red-500/5"
            : it.level === "warn"
              ? "border-amber-500/40 bg-amber-500/5"
              : "border-border bg-secondary/30";
        const iconTone =
          it.level === "alert" ? "text-red-500" : it.level === "warn" ? "text-amber-500" : "text-muted-foreground";
        return (
          <Link
            key={it.key}
            to={it.href}
            className={cn(
              "group rounded-lg border px-4 py-3 transition-all hover:scale-[1.01] hover:shadow-lg flex flex-col gap-2",
              tone,
            )}
          >
            <div className="flex items-center justify-between">
              <div className={cn("flex items-center gap-2", iconTone)}>
                {it.icon}
                <span className="text-xs uppercase tracking-wider font-medium">{it.title}</span>
              </div>
              <span className="text-[10px] text-muted-foreground group-hover:text-primary inline-flex items-center gap-1">
                {it.action} <ArrowRight className="h-3 w-3" />
              </span>
            </div>
            <div className="flex items-end justify-between gap-3">
              <div className="font-display text-3xl font-bold text-foreground tabular-nums">{it.count}</div>
              <div className="text-[11px] text-muted-foreground text-right leading-tight">{it.detail}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

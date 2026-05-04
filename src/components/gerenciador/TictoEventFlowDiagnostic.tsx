import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const REQUIRED_EVENTS: { key: string; label: string; helpUrl?: string }[] = [
  { key: "compra_aprovada", label: "Compra aprovada (authorized)" },
  { key: "pix_gerado", label: "PIX gerado (pix_created)" },
  { key: "boleto_gerado", label: "Boleto gerado (bank_slip_created)" },
  { key: "inicio_checkout", label: "Início de checkout (started)" },
  { key: "carrinho_abandonado", label: "Carrinho abandonado (abandoned_cart)" },
  { key: "pagamento_expirado", label: "Pagamento expirado (expired/pix_expired)" },
  { key: "pagamento_recusado", label: "Pagamento recusado (refused)" },
  { key: "reembolso", label: "Reembolso (refunded)" },
];

export function TictoEventFlowDiagnostic({ projectId }: { projectId?: string | null }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      let q = supabase
        .from("imphq_webhooks")
        .select("evento")
        .eq("plataforma", "Ticto")
        .gte("created_at", since)
        .limit(5000);
      if (projectId && projectId !== "all") q = q.eq("project_id", projectId);
      const { data } = await q;
      if (cancelled) return;
      const map: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        map[r.evento] = (map[r.evento] || 0) + 1;
      });
      setCounts(map);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const missing = useMemo(
    () => REQUIRED_EVENTS.filter((e) => !counts[e.key]),
    [counts],
  );

  if (loading) return null;

  // If we have NO Ticto events at all, hide (probably user doesn't use Ticto)
  const totalEvents = Object.values(counts).reduce((s, n) => s + n, 0);
  if (totalEvents === 0) return null;

  if (missing.length === 0) {
    return (
      <Card className="border border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="p-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <p className="text-xs text-foreground leading-5">
            <span className="font-bold">Postbacks Ticto OK.</span> Todos os eventos
            críticos foram recebidos nos últimos 30 dias.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-amber-500/40 bg-amber-500/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-foreground">
                Postbacks Ticto incompletos
              </span>
              <Badge variant="outline" className="text-[10px]">
                {missing.length}/{REQUIRED_EVENTS.length} faltando
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-5">
              Sem estes eventos a Recuperação não captura PIX expirado, carrinho
              abandonado e checkout iniciado. Ative na Ticto: <strong>Configurações
              do produto → Postbacks → Eventos</strong>.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 pl-6">
          {REQUIRED_EVENTS.map((e) => {
            const ok = !!counts[e.key];
            return (
              <div
                key={e.key}
                className="flex items-center justify-between text-[11px] py-1 px-2 rounded bg-secondary/30"
              >
                <span className={ok ? "text-foreground" : "text-muted-foreground"}>
                  {ok ? "✅" : "⚠️"} {e.label}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {counts[e.key] || 0}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-1">
          <Button asChild variant="outline" size="sm" className="h-7 text-[11px]">
            <a
              href="https://ajuda.ticto.com.br/pt-BR/articles/4429842"
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="h-3 w-3 mr-1" /> Ajuda Ticto
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, AlertTriangle, XCircle, Loader2, Facebook, MessageCircle, Webhook, Zap } from "lucide-react";
import { Link } from "react-router-dom";

type Health = {
  meta: { ok: number; total: number; loading: boolean };
  wa: { active: number; stale: number; total: number; loading: boolean };
  webhooks: { errors24h: number; loading: boolean };
  zernio: { configured: boolean; projectsWithToken: number; projectsSyncingData: number; loading: boolean };
};

export function IntegrationsHealthStrip() {
  const [h, setH] = useState<Health>({
    meta: { ok: 0, total: 0, loading: true },
    wa: { active: 0, stale: 0, total: 0, loading: true },
    webhooks: { errors24h: 0, loading: true },
    zernio: { configured: false, projectsWithToken: 0, projectsSyncingData: 0, loading: true },
  });

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const staleAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();

      const [ad, wa, errs, zernioRes] = await Promise.all([
        supabase.from("imphq_ad_accounts").select("id, status").eq("plataforma", "meta"),
        supabase.from("imphq_wa_providers").select("id, is_active, last_seen_at"),
        supabase.from("imphq_webhook_errors").select("id", { count: "exact", head: true }).eq("reprocessado", false).gte("created_at", since),
        supabase.from("imphq_integration_credentials").select("project_id, credentials").eq("provider", "instagram"),
      ] as PromiseLike<any>[]);

      const adRows = (ad.data || []) as any[];
      const waRows = (wa.data || []) as any[];
      const zernioRows = (zernioRes.data || []) as any[];
      const withToken = zernioRows.filter((r: any) => r.credentials?.zernio_api_key);
      const syncing = withToken.filter((r: any) => {
        const stats = r.credentials?.zernio_ads_last_sync_stats;
        return stats && (stats.imported > 0 || stats.ads > 0);
      });

      setH({
        meta: {
          ok: adRows.filter((r) => (r.status || "ativo") === "ativo").length,
          total: adRows.length,
          loading: false,
        },
        wa: {
          active: waRows.filter((r) => r.is_active).length,
          stale: waRows.filter((r) => r.is_active && r.last_seen_at && r.last_seen_at < staleAt).length,
          total: waRows.length,
          loading: false,
        },
        webhooks: { errors24h: errs.count || 0, loading: false },
        zernio: {
          configured: withToken.length > 0,
          projectsWithToken: withToken.length,
          projectsSyncingData: syncing.length,
          loading: false,
        },
      });
    })();
  }, []);

  const zernioOk = h.zernio.projectsWithToken > 0 && h.zernio.projectsSyncingData === h.zernio.projectsWithToken;
  const zernioWarn = h.zernio.projectsWithToken > 0 && h.zernio.projectsSyncingData < h.zernio.projectsWithToken;
  const zernioMsg = h.zernio.projectsWithToken === 0
    ? "Nenhum projeto com token"
    : zernioOk
      ? `${h.zernio.projectsSyncingData}/${h.zernio.projectsWithToken} projetos sincronizando`
      : `${h.zernio.projectsSyncingData}/${h.zernio.projectsWithToken} c/ dados · resto sem retorno`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      <HealthCell
        icon={<Facebook className="h-3.5 w-3.5" />}
        label="Meta Ads"
        loading={h.meta.loading}
        ok={h.meta.total > 0 && h.meta.ok === h.meta.total}
        warn={h.meta.total > 0 && h.meta.ok > 0 && h.meta.ok < h.meta.total}
        message={h.meta.total === 0 ? "Nenhuma conta conectada" : `${h.meta.ok}/${h.meta.total} contas ativas`}
        href="/empresa"
      />
      <HealthCell
        icon={<Zap className="h-3.5 w-3.5" />}
        label="Zernio"
        loading={h.zernio.loading}
        ok={zernioOk}
        warn={zernioWarn}
        message={zernioMsg}
        href="/projetos"
      />

      <HealthCell
        icon={<MessageCircle className="h-3.5 w-3.5" />}
        label="WhatsApp"
        loading={h.wa.loading}
        ok={h.wa.total > 0 && h.wa.stale === 0 && h.wa.active > 0}
        warn={h.wa.stale > 0}
        message={
          h.wa.total === 0
            ? "Nenhum chip configurado"
            : `${h.wa.active}/${h.wa.total} chips ativos${h.wa.stale ? ` · ${h.wa.stale} sem sinal 30min` : ""}`
        }
        href="/openflow"
      />
      <HealthCell
        icon={<Webhook className="h-3.5 w-3.5" />}
        label="Webhooks pagamento"
        loading={h.webhooks.loading}
        ok={h.webhooks.errors24h === 0}
        warn={h.webhooks.errors24h > 0 && h.webhooks.errors24h < 5}
        message={h.webhooks.errors24h === 0 ? "Sem erros 24h" : `${h.webhooks.errors24h} erro(s) pendente(s) 24h`}
        href="/configuracoes"
      />
    </div>
  );
}

function HealthCell({
  icon, label, loading, ok, warn, message, href,
}: {
  icon: React.ReactNode;
  label: string;
  loading: boolean;
  ok: boolean;
  warn: boolean;
  message: string;
  href: string;
}) {
  const StatusIcon = loading ? Loader2 : ok ? CheckCircle2 : warn ? AlertTriangle : XCircle;
  const color = loading
    ? "text-muted-foreground"
    : ok
    ? "text-emerald-400"
    : warn
    ? "text-amber-400"
    : "text-red-400";

  return (
    <Link
      to={href}
      className="flex items-center gap-3 rounded-md border border-border/40 bg-secondary/30 px-3 py-2 hover:bg-secondary/50 transition"
    >
      <div className="text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-xs leading-5 truncate">{message}</p>
      </div>
      <StatusIcon className={`h-4 w-4 ${color} ${loading ? "animate-spin" : ""}`} />
    </Link>
  );
}

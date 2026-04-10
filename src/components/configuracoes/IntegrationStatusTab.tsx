import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface ServiceStatus {
  name: string;
  icon: string;
  status: "online" | "offline" | "warning" | "unconfigured" | "checking";
  message: string;
  lastSync?: string;
}

export function IntegrationStatusTab() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [checking, setChecking] = useState(false);

  const checkAll = useCallback(async () => {
    setChecking(true);
    const results: ServiceStatus[] = [];

    // 1. Evolution API (WhatsApp)
    try {
      const { data: providers } = await supabase
        .from("imphq_wa_providers")
        .select("*")
        .eq("is_active", true)
        .limit(5);

      if (!providers || providers.length === 0) {
        results.push({ name: "WhatsApp (Evolution API)", icon: "💬", status: "unconfigured", message: "Nenhum provider configurado" });
      } else {
        for (const p of providers) {
          try {
            const res = await fetch(`${p.api_url}/instance/connectionState/${p.instance_name}`, {
              headers: { apikey: p.api_key },
            });
            if (res.ok) {
              const data = await res.json();
              const state = data?.instance?.state || data?.state || "unknown";
              results.push({
                name: `WhatsApp · ${p.instance_name}`,
                icon: "💬",
                status: state === "open" ? "online" : "warning",
                message: state === "open" ? "Conectado" : `Estado: ${state}`,
              });
            } else {
              results.push({ name: `WhatsApp · ${p.instance_name}`, icon: "💬", status: "offline", message: `HTTP ${res.status}` });
            }
          } catch {
            results.push({ name: `WhatsApp · ${p.instance_name}`, icon: "💬", status: "offline", message: "API inacessível" });
          }
        }
      }
    } catch {
      results.push({ name: "WhatsApp (Evolution API)", icon: "💬", status: "offline", message: "Erro ao consultar providers" });
    }

    // 2. Facebook Ads — check if any project has token configured
    try {
      const { data: projects } = await supabase
        .from("imphq_projects")
        .select("id, name, data")
        .not("data", "is", null)
        .limit(20);

      const fbProjects = (projects || []).filter((p: any) => p.data?.facebook_access_token && p.data?.facebook_pixel_id);
      if (fbProjects.length === 0) {
        results.push({ name: "Facebook Ads / CAPI", icon: "🟦", status: "unconfigured", message: "Nenhum projeto com token configurado" });
      } else {
        // Check last successful sync
        const { data: lastSync } = await supabase
          .from("imphq_ad_accounts")
          .select("last_sync")
          .order("last_sync", { ascending: false })
          .limit(1)
          .maybeSingle();

        const lastSyncDate = lastSync?.last_sync;
        const hoursSince = lastSyncDate ? (Date.now() - new Date(lastSyncDate).getTime()) / 3600000 : 999;

        results.push({
          name: "Facebook Ads / CAPI",
          icon: "🟦",
          status: hoursSince < 24 ? "online" : hoursSince < 72 ? "warning" : "offline",
          message: `${fbProjects.length} projeto(s) configurado(s)`,
          lastSync: lastSyncDate || undefined,
        });
      }
    } catch {
      results.push({ name: "Facebook Ads / CAPI", icon: "🟦", status: "offline", message: "Erro ao verificar" });
    }

    // 3. Google Calendar — global secrets (can't ping from frontend, check last event sync)
    try {
      const { data: lastEvent } = await supabase
        .from("imphq_calendar_events")
        .select("created_at")
        .not("google_event_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastEvent) {
        results.push({
          name: "Google Calendar",
          icon: "📅",
          status: "online",
          message: "Eventos sincronizados",
          lastSync: lastEvent.created_at,
        });
      } else {
        results.push({ name: "Google Calendar", icon: "📅", status: "unconfigured", message: "Nenhum evento sincronizado ainda" });
      }
    } catch {
      results.push({ name: "Google Calendar", icon: "📅", status: "unconfigured", message: "Sem dados de sync" });
    }

    // 4. Webhooks de Pagamento — check recent webhooks
    try {
      const { data: recent, count } = await supabase
        .from("imphq_webhooks")
        .select("created_at, processado", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { count: errorCount } = await supabase
        .from("imphq_webhook_errors")
        .select("id", { count: "exact", head: true })
        .eq("reprocessado", false);

      if (!recent) {
        results.push({ name: "Webhooks de Pagamento", icon: "🔔", status: "unconfigured", message: "Nenhum webhook recebido" });
      } else {
        const hasErrors = (errorCount || 0) > 0;
        results.push({
          name: "Webhooks de Pagamento",
          icon: "🔔",
          status: hasErrors ? "warning" : "online",
          message: hasErrors ? `${errorCount} erro(s) pendente(s)` : `${count || 0} webhooks recebidos`,
          lastSync: recent.created_at,
        });
      }
    } catch {
      results.push({ name: "Webhooks de Pagamento", icon: "🔔", status: "offline", message: "Erro ao verificar" });
    }

    // 5. Resend (Email) — check last email event
    try {
      const { data: lastEmail } = await supabase
        .from("imphq_events")
        .select("created_at")
        .eq("event_name", "email_sent")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      results.push({
        name: "Resend (Email)",
        icon: "📧",
        status: lastEmail ? "online" : "unconfigured",
        message: lastEmail ? "Emails enviados recentemente" : "Nenhum envio registrado",
        lastSync: lastEmail?.created_at,
      });
    } catch {
      results.push({ name: "Resend (Email)", icon: "📧", status: "unconfigured", message: "Sem dados" });
    }

    setServices(results);
    setChecking(false);
    toast.success("Status atualizado");
  }, []);

  useEffect(() => {
    checkAll();
  }, [checkAll]);

  const statusIcon = (s: ServiceStatus["status"]) => {
    switch (s) {
      case "online": return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case "offline": return <XCircle className="h-4 w-4 text-destructive" />;
      case "warning": return <AlertTriangle className="h-4 w-4 text-amber-400" />;
      case "unconfigured": return <Clock className="h-4 w-4 text-muted-foreground" />;
      case "checking": return <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />;
    }
  };

  const statusBadge = (s: ServiceStatus["status"]) => {
    const map = {
      online: { label: "Online", cls: "bg-emerald-500/20 text-emerald-400" },
      offline: { label: "Offline", cls: "bg-destructive/20 text-destructive" },
      warning: { label: "Atenção", cls: "bg-amber-500/20 text-amber-400" },
      unconfigured: { label: "Não configurado", cls: "bg-muted text-muted-foreground" },
      checking: { label: "Verificando...", cls: "bg-muted text-muted-foreground" },
    };
    const m = map[s];
    return <Badge className={`text-[9px] ${m.cls}`}>{m.label}</Badge>;
  };

  const onlineCount = services.filter(s => s.status === "online").length;
  const totalCount = services.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Status das Integrações</h2>
          <p className="text-xs text-muted-foreground">
            {totalCount > 0 ? `${onlineCount}/${totalCount} serviços online` : "Verificando..."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={checkAll} disabled={checking}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${checking ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="space-y-2">
        {services.map((svc, i) => (
          <Card key={i} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {statusIcon(svc.status)}
                  <span className="text-lg">{svc.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{svc.name}</p>
                    <p className="text-[10px] text-muted-foreground">{svc.message}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {svc.lastSync && (
                    <span className="text-[9px] text-muted-foreground">
                      Sync: {new Date(svc.lastSync).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                  {statusBadge(svc.status)}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

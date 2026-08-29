import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all active WhatsApp providers
    const { data: providers, error: provErr } = await supabase
      .from("imphq_wa_providers")
      .select("id, instance_name, api_url, api_key, project_id, health_alerts_enabled, health_alerts_muted_until")
      .eq("is_active", true);

    if (provErr) {
      console.error("[wa-health-monitor] Error fetching providers:", provErr);
      return new Response(JSON.stringify({ error: provErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!providers || providers.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "Nenhum provider ativo", results: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[wa-health-monitor] Checking ${providers.length} providers`);

    const results: any[] = [];
    const failures: any[] = [];

    const nowMs = Date.now();
    for (const p of providers) {
      const alertsEnabled = p.health_alerts_enabled !== false;
      const mutedUntil = p.health_alerts_muted_until ? new Date(p.health_alerts_muted_until).getTime() : 0;
      const isMuted = !alertsEnabled || mutedUntil > nowMs;

      const instanceResult: any = {
        id: p.id,
        instance_name: p.instance_name,
        project_id: p.project_id,
        status: "unknown",
        alerts_muted: isMuted,
      };

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const res = await fetch(
          `${p.api_url}/instance/connectionState/${p.instance_name}`,
          {
            headers: { apikey: p.api_key },
            signal: controller.signal,
          }
        );
        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json();
          const state = data?.instance?.state || data?.state || "unknown";
          instanceResult.status = state;
          instanceResult.ok = state === "open";

          if (state !== "open") {
            instanceResult.warning = `Estado: ${state}`;

            // Auto-reconnect proativo (sempre roda, mesmo com alertas mutados)
            const reconnected = await tryAutoReconnect(supabase, p, state);
            instanceResult.auto_reconnect_attempted = reconnected.attempted;
            instanceResult.auto_reconnect_result = reconnected.result;

            failures.push({
              instance: p.instance_name,
              project_id: p.project_id,
              reason: `Estado da conexão: ${state}${reconnected.attempted ? ` (auto-reconnect: ${reconnected.result})` : ""}`,
              severity: state === "close" ? "critical" : "warning",
              alerts_muted: isMuted,
            });
          }
        } else {
          const errorText = await res.text().catch(() => "");
          instanceResult.status = "http_error";
          instanceResult.ok = false;
          instanceResult.error = `HTTP ${res.status}: ${errorText.slice(0, 200)}`;

          failures.push({
            instance: p.instance_name,
            project_id: p.project_id,
            reason: `API retornou HTTP ${res.status}`,
            severity: "critical",
            alerts_muted: isMuted,
          });
        }
      } catch (e: any) {
        const isTimeout = e.name === "AbortError";
        instanceResult.status = isTimeout ? "timeout" : "unreachable";
        instanceResult.ok = false;
        instanceResult.error = isTimeout ? "Timeout (10s)" : e.message;

        failures.push({
          instance: p.instance_name,
          project_id: p.project_id,
          reason: isTimeout ? "API não respondeu em 10s" : `API inacessível: ${e.message}`,
          severity: "critical",
          alerts_muted: isMuted,
        });
      }

      results.push(instanceResult);
    }

    // If there are failures, log them and send email alert
    if (failures.length > 0) {
      console.warn(`[wa-health-monitor] ${failures.length} instance(s) com problema!`);

      // Log the health check failure in imphq_events (sempre, sem e-mail)
      await supabase.from("imphq_events").insert({
        project_id: failures[0].project_id || "system",
        event_name: "wa_health_check_failed",
        page_url: "",
        event_data: { failures, checked_at: new Date().toISOString(), total_providers: providers.length },
      });

      // Filtra só falhas com alertas ativos
      const alertable = failures.filter((f) => !f.alerts_muted);
      if (alertable.length === 0) {
        console.log("[wa-health-monitor] Todas as falhas estão com alertas silenciados, pulando e-mail");
      } else {
        // Throttle POR INSTÂNCIA: 6h entre e-mails da mesma instância
        const sixHoursAgo = new Date(nowMs - 6 * 60 * 60 * 1000).toISOString();
        const toAlert: any[] = [];
        for (const f of alertable) {
          const { data: recent } = await supabase
            .from("imphq_events")
            .select("id")
            .eq("event_name", "wa_health_alert_sent")
            .gte("created_at", sixHoursAgo)
            .filter("data->>instance_name", "eq", f.instance)
            .limit(1)
            .maybeSingle();
          if (!recent) toAlert.push(f);
        }

        if (toAlert.length === 0) {
          console.log("[wa-health-monitor] Todas as instâncias já alertadas nas últimas 6h, pulando");
        } else {
          const alertSent = await sendAlertEmail(supabase, toAlert, providers.length);
          if (alertSent) {
            // Registra um evento por instância p/ throttle granular
            await supabase.from("imphq_events").insert(
              toAlert.map((f) => ({
                project_id: f.project_id || "system",
                event_name: "wa_health_alert_sent",
                page_url: "",
                event_data: { instance_name: f.instance, severity: f.severity, sent_to: "ipcompanidigital@gmail.com" },
              }))
            );
          }
        }
      }
    } else {
      console.log("[wa-health-monitor] All instances healthy ✅");
    }

    return new Response(JSON.stringify({
      ok: failures.length === 0,
      total: providers.length,
      healthy: providers.length - failures.length,
      failures: failures.length,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[wa-health-monitor] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Auto-reconnect proativo (SEGURO — não aumenta risco de ban):
 * - Apenas chama /instance/connect para reativar sessão JÁ pareada
 * - Throttle de 10min por instância para evitar loops
 * - Não força novo QR, não envia mensagens, não cria sessão nova
 */
async function tryAutoReconnect(
  supabase: any,
  provider: any,
  state: string
): Promise<{ attempted: boolean; result: string }> {
  if (state !== "close" && state !== "connecting") {
    return { attempted: false, result: "skipped" };
  }

  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("imphq_events")
    .select("id")
    .eq("event_name", "wa_auto_reconnect_attempt")
    .gte("created_at", tenMinAgo)
    .filter("data->>instance_name", "eq", provider.instance_name)
    .limit(1)
    .maybeSingle();

  if (recent) return { attempted: false, result: "throttled (<10min)" };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(
      `${provider.api_url}/instance/connect/${provider.instance_name}`,
      { headers: { apikey: provider.api_key }, signal: controller.signal }
    );
    clearTimeout(timeout);

    const result = res.ok ? "success" : `http_${res.status}`;
    console.log(`[wa-health-monitor] Auto-reconnect ${provider.instance_name}: ${result}`);

    await supabase.from("imphq_events").insert({
      project_id: provider.project_id || "system",
      event_name: "wa_auto_reconnect_attempt",
      page_url: "",
      event_data: { instance_name: provider.instance_name, previous_state: state, result, ok: res.ok },
    });

    return { attempted: true, result };
  } catch (e: any) {
    return { attempted: true, result: `error: ${e.message}` };
  }
}

async function sendAlertEmail(
  supabase: any,
  failures: any[],
  totalProviders: number
): Promise<boolean> {
  try {
    // Try to find a Resend API key from any project's credentials
    const { data: creds } = await supabase
      .from("imphq_integration_credentials")
      .select("credentials")
      .eq("provider", "resend")
      .limit(1)
      .maybeSingle();

    let resendApiKey = creds?.credentials?.api_key || "";
    let fromEmail = creds?.credentials?.from_email || "";
    let fromName = creds?.credentials?.from_name || "Imperio HQ";

    // Fallback: try from project data
    if (!resendApiKey) {
      const { data: projects } = await supabase
        .from("imphq_projects")
        .select("data")
        .not("data", "is", null)
        .limit(10);

      for (const p of projects || []) {
        const ec = (p.data as any)?.email_config || {};
        const br = (p.data as any)?.checklist?.resend || {};
        const key = ec.resend_api_key || br.resend_api_key;
        if (key) {
          resendApiKey = key;
          fromEmail = fromEmail || ec.from_email || br.from_email || "";
          fromName = fromName || ec.from_name || br.from_name || "Imperio HQ";
          break;
        }
      }
    }

    if (!resendApiKey) {
      console.warn("[wa-health-monitor] No Resend API key found, cannot send email alert");
      return false;
    }

    const failureLines = failures.map(
      (f: any) => `• <b>${f.instance}</b> — ${f.reason} (${f.severity})`
    ).join("<br>");

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1a1a1a; color: #c9922a; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 22px;">⚠️ Alerta: WhatsApp Comprometido</h1>
        </div>
        <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e5e5;">
          <p style="color: #333; font-size: 14px; margin-top: 0;">
            O monitor de saúde detectou <b>${failures.length} de ${totalProviders}</b> instância(s) com problema:
          </p>
          <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #333;">
            ${failureLines}
          </div>
          <p style="color: #666; font-size: 13px;">
            <b>Ação recomendada:</b> Acesse o painel da Evolution API e reconecte as instâncias afetadas.
            Se o problema persistir, verifique se o servidor da Evolution está operacional.
          </p>
          <p style="color: #999; font-size: 11px; margin-bottom: 0;">
            Verificação realizada em: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
          </p>
        </div>
        <div style="background: #f5f5f5; padding: 12px; text-align: center; border-radius: 0 0 8px 8px;">
          <p style="color: #999; font-size: 10px; margin: 0;">Imperio HQ — Monitor Automatizado</p>
        </div>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
        to: ["ipcompanidigital@gmail.com"],
        subject: `⚠️ WhatsApp Comprometido — ${failures.length} instância(s) offline`,
        html: htmlBody,
      }),
    });

    const resData = await res.json();
    console.log("[wa-health-monitor] Email alert sent:", res.ok, resData);
    return res.ok;
  } catch (e: any) {
    console.error("[wa-health-monitor] Failed to send email alert:", e);
    return false;
  }
}

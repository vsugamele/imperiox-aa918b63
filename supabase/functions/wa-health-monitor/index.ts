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
      .select("id, instance_name, api_url, api_key, project_id")
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

    for (const p of providers) {
      const instanceResult: any = {
        id: p.id,
        instance_name: p.instance_name,
        project_id: p.project_id,
        status: "unknown",
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
            failures.push({
              instance: p.instance_name,
              project_id: p.project_id,
              reason: `Estado da conexão: ${state}`,
              severity: state === "close" ? "critical" : "warning",
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
        });
      }

      results.push(instanceResult);
    }

    // If there are failures, log them and send email alert
    if (failures.length > 0) {
      console.warn(`[wa-health-monitor] ${failures.length} instance(s) com problema!`);

      // Log the health check failure in imphq_events
      await supabase.from("imphq_events").insert({
        project_id: failures[0].project_id || "system",
        event_name: "wa_health_check_failed",
        page_url: "",
        data: { failures, checked_at: new Date().toISOString(), total_providers: providers.length },
      });

      // Check if we already sent an alert in the last 30 minutes (avoid spam)
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: recentAlert } = await supabase
        .from("imphq_events")
        .select("id")
        .eq("event_name", "wa_health_alert_sent")
        .gte("created_at", thirtyMinAgo)
        .limit(1)
        .maybeSingle();

      if (!recentAlert) {
        // Send email alert via Resend (try to find any project with Resend configured)
        const alertSent = await sendAlertEmail(supabase, failures, providers.length);

        if (alertSent) {
          await supabase.from("imphq_events").insert({
            project_id: failures[0].project_id || "system",
            event_name: "wa_health_alert_sent",
            page_url: "",
            data: { failures_count: failures.length, sent_to: "imperiocompanidigital@gmail.com" },
          });
        }
      } else {
        console.log("[wa-health-monitor] Alert already sent in the last 30 min, skipping email");
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
        to: ["imperiocompanidigital@gmail.com"],
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

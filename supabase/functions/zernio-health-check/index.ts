// Health-check Zernio — valida API key e checa último webhook recebido por projeto.
// Marca status 'degraded' em imphq_ig_accounts e cria notificação se silencioso > 1h.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(d: any, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    // Lista todos os projetos com auth_method zernio
    const { data: rows } = await supa
      .from("imphq_integration_credentials")
      .select("project_id, credentials")
      .eq("provider", "instagram");

    const zernioProjects = (rows || []).filter((r: any) => r.credentials?.auth_method === "zernio");
    const results: any[] = [];

    for (const row of zernioProjects) {
      const project_id = row.project_id;
      const creds = row.credentials;
      let apiOk = false;
      let apiErr: string | null = null;

      try {
        const r = await fetch("https://zernio.com/api/v1/accounts", {
          headers: { "Authorization": `Bearer ${creds.zernio_api_key}` },
        });
        apiOk = r.ok;
        if (!r.ok) apiErr = `HTTP ${r.status}`;
      } catch (e: any) {
        apiErr = e.message;
      }

      // Último webhook zernio_* recebido
      const { data: lastLog } = await supa
        .from("imphq_ig_webhook_logs")
        .select("created_at, event_type")
        .like("event_type", "zernio_%")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastWebhookAt = lastLog?.created_at ? new Date(lastLog.created_at) : null;
      const silentMinutes = lastWebhookAt ? (Date.now() - lastWebhookAt.getTime()) / 60000 : null;
      const silentTooLong = silentMinutes !== null && silentMinutes > 60;

      let newStatus = "active";
      if (!apiOk) newStatus = "degraded";
      else if (silentTooLong) newStatus = "silent";

      await supa
        .from("imphq_ig_accounts")
        .update({ status: newStatus, last_refresh_at: new Date().toISOString() })
        .eq("project_id", project_id)
        .eq("ig_user_id", creds.ig_user_id);

      // Atualiza creds com health snapshot
      const updated = {
        ...creds,
        zernio_last_health_at: new Date().toISOString(),
        zernio_health_ok: apiOk,
        zernio_health_error: apiErr,
        zernio_last_webhook_at: lastWebhookAt?.toISOString() || null,
      };
      await supa
        .from("imphq_integration_credentials")
        .update({ credentials: updated, updated_at: new Date().toISOString() })
        .eq("project_id", project_id)
        .eq("provider", "instagram");

      // Notificação se ficou degraded ou silent agora (e antes estava ativo)
      if (newStatus !== "active" && creds.zernio_health_ok !== false) {
        try {
          await supa.from("imphq_notifications").insert({
            title: newStatus === "degraded" ? `Zernio inacessível — ${project_id}` : `Zernio silencioso > 1h — ${project_id}`,
            message: apiErr || `Sem eventos há ${Math.round(silentMinutes!)}min`,
            type: "warning",
            entity_type: "integration",
            entity_id: project_id,
          });
        } catch { /* ignore */ }
      }

      results.push({ project_id, status: newStatus, apiOk, apiErr, silentMinutes });
    }

    return json({ success: true, checked: results.length, results });
  } catch (e: any) {
    console.error("[zernio-health-check]", e);
    return json({ error: e.message }, 500);
  }
});

// Leitura do painel ao vivo a cada 15 min (LIVE1.2): grava imphq_live_snapshots por projeto ativo e avisa o grupo
// Imperio X quando o CPA sai/volta ao alvo ou o pixel diverge do checkout. Regras em _shared/live-panel.ts.
// Anti-spam: só mudança de estado vira alerta, intervalo mínimo por tipo (2 h / 12 h) e para após 3 falhas seguidas de envio.
// dry_run=true: calcula tudo e devolve os textos sem gravar nem enviar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { liveAlerts, type LiveAlertKind, type LiveSnapshotLite } from "../_shared/live-panel.ts";
import { liveProjects, loadProjectLivePanel, snapshotRow } from "../_shared/live-panel-load.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const IMPERIO_X_JID = "120363409438175766@g.us";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const dryRun = url.searchParams.get("dry_run") === "true" || body?.dry_run === true;
    const onlyProject: string | undefined = body?.project_id || url.searchParams.get("project_id") || undefined;
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const now = new Date();

    const projects = (await liveProjects(sb, now)).filter((p) => !onlyProject || p.id === onlyProject);
    const { data: provider } = await sb.from("imphq_wa_providers").select("api_url, api_key, instance_name").eq("is_active", true)
      .order("last_seen_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();

    const results: Array<Record<string, unknown>> = [];
    let falhas = 0;
    for (const project of projects) {
      try {
        const [panel, prevRes, sentRes] = await Promise.all([
          loadProjectLivePanel(sb, project.id, now),
          sb.from("imphq_live_snapshots").select("zona, vendas, cpa, taken_at").eq("project_id", project.id)
            .eq("dia", new Date(now.getTime() - 3 * 3600000).toISOString().slice(0, 10)).order("taken_at", { ascending: false }).limit(1).maybeSingle(),
          sb.from("imphq_activity_log").select("details, created_at").eq("action", "live_alert").eq("project_id", project.id)
            .gte("created_at", new Date(now.getTime() - 24 * 3600000).toISOString()).order("created_at", { ascending: false }).limit(50),
        ]);
        const lastSent: Partial<Record<LiveAlertKind, string>> = {};
        for (const row of sentRes.data ?? []) {
          const tipo = (row.details as { tipo?: LiveAlertKind } | null)?.tipo;
          if (tipo && !lastSent[tipo]) lastSent[tipo] = row.created_at as string;
        }
        const alerts = liveAlerts({ projectName: project.name, panel, previous: (prevRes.data ?? null) as LiveSnapshotLite | null, lastSent, now: now.getTime() });

        if (dryRun) { results.push({ project_id: project.id, parcial: panel.parcial, alertas: alerts }); continue; }

        const { error: insErr } = await sb.from("imphq_live_snapshots").insert(snapshotRow(project.id, panel, now));
        if (insErr) throw insErr;

        const enviados: string[] = [];
        for (const alert of alerts) {
          if (falhas >= 3) break;
          if (!provider?.instance_name) { falhas++; break; }
          const res = await fetch(`${String(provider.api_url).replace(/\/$/, "")}/message/sendText/${provider.instance_name}`, {
            method: "POST", headers: { "Content-Type": "application/json", apikey: String(provider.api_key) },
            body: JSON.stringify({ number: IMPERIO_X_JID, text: alert.texto }),
          }).catch(() => null);
          if (!res?.ok) { falhas++; continue; }
          falhas = 0;
          enviados.push(alert.tipo);
          await sb.from("imphq_activity_log").insert({
            action: "live_alert", entity_type: "project", entity_id: project.id, entity_name: project.name, project_id: project.id,
            actor: "sistema", source: "live-snapshot", details: { tipo: alert.tipo, texto: alert.texto, destino: "Imperio X" },
          });
        }
        results.push({ project_id: project.id, gravado: true, alertas: enviados });
      } catch (e) {
        results.push({ project_id: project.id, erro: e instanceof Error ? e.message : String(e) });
      }
    }
    if (!dryRun && now.getUTCHours() === 6 && now.getUTCMinutes() < 15) await sb.rpc("imphq_prune_live_snapshots");
    return json({ ok: true, dry_run: dryRun, projetos: projects.length, falhas_de_envio: falhas, results });
  } catch (e) {
    console.error("[live-snapshot]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

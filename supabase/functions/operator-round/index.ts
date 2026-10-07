// Operador diário (OPR1.1): rodada 3x ao dia (09:30, 14:00 e 19:30 BRT pelo pg_cron). Lê cada projeto ativo pelo
// próprio project-mcp (get_briefing + get_live_panel), monta a rodada em _shared/operator.ts e envia ao grupo Imperio X.
// Não executa decisões (v1). Anti-spam: projeto sem novidade fica de fora; rodada igual à anterior não é enviada;
// um único envio por rodada. dry_run=true devolve o texto sem enviar nem registrar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { planOperatorRound, type OperatorBriefing, type OperatorLive, type OperatorProject } from "../_shared/operator.ts";
import { liveProjects, type LiveDb } from "../_shared/live-panel-load.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MCP_KEY = (Deno.env.get("MCP_API_KEYS") ?? "").split(",").map((k) => k.trim()).find((k) => k.length >= 24) ?? "";
const APP_URL = Deno.env.get("IMPERIO_APP_URL") || "https://imperiox.vercel.app";
const IMPERIO_X_JID = "120363409438175766@g.us";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** Chama uma ferramenta do project-mcp e devolve o JSON do resultado (ou null se falhar). */
async function mcp<T>(tool: string, args: Record<string, unknown>): Promise<T | null> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/project-mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-mcp-key": MCP_KEY, "x-imperio-actor": "operador" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: tool, arguments: args } }),
  }).catch(() => null);
  if (!res?.ok) return null;
  const env = await res.json().catch(() => null) as { result?: { content?: Array<{ text?: string }> } } | null;
  const text = env?.result?.content?.[0]?.text;
  if (!text) return null;
  try { return JSON.parse(text) as T; } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const dryRun = url.searchParams.get("dry_run") === "true" || body?.dry_run === true;
    const force = body?.force === true;
    if (!MCP_KEY) return json({ error: "MCP_API_KEYS não configurado" }, 503);
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const now = new Date();
    const label = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

    const { data: last } = await sb.from("imphq_activity_log").select("created_at, details").eq("action", "operator_round")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const since = (last?.created_at as string | undefined) ?? new Date(now.getTime() - 8 * 3600_000).toISOString();

    const active = await liveProjects(sb as unknown as LiveDb, now);
    const projects: OperatorProject[] = [];
    for (const p of active) {
      const [briefing, live] = await Promise.all([
        mcp<OperatorBriefing>("get_briefing", { project_id: p.id }),
        mcp<OperatorLive>("get_live_panel", { project_id: p.id }),
      ]);
      projects.push({ id: p.id, name: p.name, briefing, live });
    }
    const round = planOperatorRound(projects, { since, label, appUrl: APP_URL });
    const lidos = projects.map((p) => ({ id: p.id, resumo: !!p.briefing, painel: !!p.live }));

    if (dryRun) return json({ ok: true, dry_run: true, projetos: lidos, itens: round.itens, texto: round.texto });
    if (!round.texto) return json({ ok: true, enviado: false, motivo: "nada a dizer", projetos: lidos });
    const lastSig = (last?.details as { assinatura?: string } | null)?.assinatura;
    if (!force && lastSig === round.assinatura) return json({ ok: true, enviado: false, motivo: "igual à rodada anterior", projetos: lidos });

    const { data: provider } = await sb.from("imphq_wa_providers").select("api_url, api_key, instance_name").eq("is_active", true)
      .order("last_seen_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
    if (!provider?.instance_name) return json({ ok: false, enviado: false, erro: "Nenhum provider WA ativo" }, 503);
    const res = await fetch(`${String(provider.api_url).replace(/\/$/, "")}/message/sendText/${provider.instance_name}`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: String(provider.api_key) },
      body: JSON.stringify({ number: IMPERIO_X_JID, text: round.texto }),
    }).catch(() => null);
    if (!res?.ok) return json({ ok: false, enviado: false, erro: `envio ${res?.status ?? "falhou"}` }, 502);

    // O registro guarda as decisões numeradas: é o que o OPR1.2 usa para executar "ok 1" respondido no grupo.
    await sb.from("imphq_activity_log").insert({
      action: "operator_round", entity_type: "operator", entity_id: label, entity_name: `Rodada ${label}`,
      actor: "operador", source: "operator-round",
      details: { assinatura: round.assinatura, itens: round.itens, feitos_pela_ia: round.feitos_pela_ia, destino: "Imperio X" },
    });
    return json({ ok: true, enviado: true, itens: round.itens.length, projetos: lidos });
  } catch (e) {
    console.error("[operator-round]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

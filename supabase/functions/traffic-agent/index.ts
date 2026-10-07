// Agente de tráfego (TRF1.1): substitui o ads-ai-optimizer. Uma vez por dia (09:00 BRT, antes da rodada do operador),
// para cada projeto com parâmetros na Esteira (payout e CPA alvo em imphq_scale_rounds) e gasto por anúncio no
// Zernio nos últimos 7 dias: liga as vendas REAIS do checkout a cada anúncio pela UTM (sem bump; o pixel duplica),
// decide pela Esteira (_shared/traffic-agent.ts) e:
//   - pausa sozinho só prejuízo claro (autonomia trafego:pausar_prejuizo_claro), passando pelo imperius-executor
//     para ficar no histórico e dar para desfazer;
//   - coloca as outras pausas na fila (imphq_ai_actions "proposed", via Zernio) — viram "ok N" na rodada do operador;
//   - avisa no grupo Imperio X: pausas, escalar, observar, ofensores e alternativas.
// Anti-repetição: um anúncio com ação do agente nas últimas 24 h não ganha outra. dry_run=true só devolve o plano.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { adStats, trafficMessage, trafficPlan, unattributedSales, type AdDayRow, type AdSale } from "../_shared/traffic-agent.ts";
import { effectiveAutonomy } from "../_shared/autonomy.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("IMPERIO_APP_URL") || "https://imperiox.vercel.app";
const IMPERIO_X_JID = "120363409438175766@g.us";
const SOURCE = "traffic-agent";
const AUTONOMY_KEY = "trafego:pausar_prejuizo_claro";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const brtDay = (d: Date) => new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 10);

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const dryRun = url.searchParams.get("dry_run") === "true" || body?.dry_run === true;
    const onlyProject: string | null = typeof body?.project_id === "string" ? body.project_id : url.searchParams.get("project_id");
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const now = new Date();
    const today = brtDay(now);
    const since = brtDay(new Date(now.getTime() - 6 * 86400_000));
    const sinceIso = `${since}T03:00:00Z`;

    const { data: policy } = await sb.from("imphq_ai_policy").select("autonomy").eq("scope", "mcp").eq("kind", AUTONOMY_KEY).maybeSingle();
    const autoPause = effectiveAutonomy(AUTONOMY_KEY, policy?.autonomy as string | null | undefined) === "auto";

    const { data: rounds, error: rErr } = await sb.from("imphq_scale_rounds").select("project_id, params, updated_at").order("updated_at", { ascending: false });
    if (rErr) throw rErr;
    const params = new Map<string, { payout: number; cpaAlvo: number }>();
    for (const r of rounds ?? []) {
      const p = r.params as { payout?: unknown; cpa_alvo?: unknown } | null;
      const payout = Number(p?.payout), cpaAlvo = Number(p?.cpa_alvo);
      if (!params.has(r.project_id) && payout > 0 && cpaAlvo > 0) params.set(r.project_id, { payout, cpaAlvo });
    }

    const report: Array<Record<string, unknown>> = [];
    for (const [projectId, p] of params) {
      if (onlyProject && projectId !== onlyProject) continue;
      const [{ data: rows, error: aErr }, { data: sales, error: sErr }, { data: proj }] = await Promise.all([
        sb.from("imphq_ads_spend").select("ad_id, anuncio, campaign_id, campanha, valor, compras, init_checkout, link_clicks, effective_status, data_ref, moeda")
          .eq("project_id", projectId).eq("source", "zernio").gte("data_ref", since).not("ad_id", "is", null).limit(5000),
        sb.from("imphq_vendas").select("utm_campaign, utm_content, status, tipo_venda")
          .eq("project_id", projectId).gte("created_at", sinceIso).not("utm_content", "is", null).limit(5000),
        sb.from("imphq_projects").select("name").eq("id", projectId).maybeSingle(),
      ]);
      if (aErr) throw aErr;
      if (sErr) throw sErr;
      if (!rows?.length) { report.push({ projeto: projectId, pulado: "sem gasto por anúncio no Zernio em 7 dias" }); continue; }
      const currency = String(rows.find((r) => r.moeda)?.moeda ?? "BRL");
      const stats = adStats(rows as AdDayRow[], (sales ?? []) as AdSale[], today);
      const plan = trafficPlan(stats, p, currency);
      const semAnuncio = unattributedSales(stats, (sales ?? []) as AdSale[]);
      const nome = String(proj?.name ?? projectId);

      if (dryRun) { report.push({ projeto: projectId, params: p, auto_pausa: autoPause, sem_anuncio: semAnuncio, plano: plan, texto: trafficMessage({ projeto: nome, plan, currency, semAnuncio, pausados: [], falhas: [], propostas: 0, appUrl: APP_URL }) }); continue; }

      // Anúncios que já tiveram ação do agente nas últimas 24 h ficam de fora.
      const { data: recent } = await sb.from("imphq_ai_actions").select("payload").eq("source", SOURCE).eq("projeto_id", projectId)
        .gte("created_at", new Date(now.getTime() - 86400_000).toISOString());
      const touched = new Set((recent ?? []).map((r) => String((r.payload as { entity_id?: unknown } | null)?.entity_id ?? "")));

      const pausados: Array<{ nome: string; motivo: string }> = [];
      const falhas: Array<{ nome: string; erro: string }> = [];
      let propostas = 0;
      for (const d of plan.decisoes) {
        if (d.acao !== "pausar_auto" && d.acao !== "pausar") continue;
        if (touched.has(d.ad_id)) continue;
        const auto = d.acao === "pausar_auto" && autoPause;
        const { data: action, error: iErr } = await sb.from("imphq_ai_actions").insert({
          kind: "pauseAd", risk_level: auto ? "low" : "medium", status: auto ? "approved" : "proposed", confidence: auto ? 0.95 : 0.8,
          title: `Pausar anúncio "${d.nome}"`, reason: d.motivo,
          payload: { via: "zernio", entity_id: d.ad_id, entity_type: "ad", entity_name: d.nome, project_id: projectId, zona: d.zona, cpa: d.cpa, regra: d.acao },
          projeto_id: projectId, source: SOURCE,
        }).select("id").single();
        if (iErr || !action) { falhas.push({ nome: d.nome, erro: iErr?.message ?? "não registrou" }); continue; }
        if (!auto) { propostas += 1; continue; }
        const res = await fetch(`${SUPABASE_URL}/functions/v1/imperius-executor`, {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({ action_id: action.id }),
        }).catch((e) => ({ ok: false, status: 0, json: async () => ({ error: String(e) }) }) as unknown as Response);
        const out = await res.json().catch(() => ({})) as { ok?: boolean; error?: unknown };
        if (res.ok && out.ok) pausados.push({ nome: d.nome, motivo: d.motivo });
        else falhas.push({ nome: d.nome, erro: String((out.error as { message?: string } | undefined)?.message ?? out.error ?? `HTTP ${res.status}`) });
      }

      const texto = trafficMessage({ projeto: nome, plan, currency, semAnuncio, pausados, falhas, propostas, appUrl: APP_URL });
      let enviado = false;
      if (texto) {
        const { data: provider } = await sb.from("imphq_wa_providers").select("api_url, api_key, instance_name").eq("is_active", true)
          .order("last_seen_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
        if (provider?.instance_name) {
          const r = await fetch(`${String(provider.api_url).replace(/\/$/, "")}/message/sendText/${provider.instance_name}`, {
            method: "POST", headers: { "Content-Type": "application/json", apikey: String(provider.api_key) },
            body: JSON.stringify({ number: IMPERIO_X_JID, text: texto }),
          }).catch(() => null);
          enviado = !!r?.ok;
        }
      }
      await sb.from("imphq_activity_log").insert({
        action: "traffic_agent_run", entity_type: "project", entity_id: projectId, entity_name: nome, actor: "ia (agente de tráfego)", source: SOURCE,
        details: { resumo: plan.resumo, pausados, falhas, propostas, ofensores: plan.ofensores, alternativas: plan.alternativas, sem_anuncio: semAnuncio, enviado },
      });
      report.push({ projeto: projectId, resumo: plan.resumo, pausados: pausados.length, falhas: falhas.length, propostas, enviado });
    }
    return json({ ok: true, dry_run: dryRun, auto_pausa: autoPause, projetos: report });
  } catch (e) {
    console.error("[traffic-agent]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

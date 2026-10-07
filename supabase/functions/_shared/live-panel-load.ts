// Carrega o painel ao vivo de um projeto com o cliente do servidor (service role): mesmas fontes e regra da tela
// (src/hooks/useLivePanel.ts). Usado pela rotina live-snapshot (a cada 15 min) e pelo project-mcp (get_live_panel).
import { adsSyncHealth, buildLivePanel, dayFraction, type AdRow, type AdsSyncHealthRow, type LivePanel, type SaleRow } from "./live-panel.ts";
import { paramsFrom } from "./scale-ladder.ts";

type Result = { data: unknown; count?: number | null; error: unknown };
/**
 * O mínimo do cliente Supabase que este carregador usa. Tipo estrutural (em vez do import por URL do Deno) para
 * o arquivo compilar também no front, onde os testes do MCP o importam. Quem chama passa `cliente as unknown as LiveDb`.
 */
export interface LiveQuery extends PromiseLike<Result> {
  select(columns: string, options?: { count?: "exact"; head?: boolean }): LiveQuery;
  eq(column: string, value: unknown): LiveQuery;
  gt(column: string, value: unknown): LiveQuery;
  gte(column: string, value: unknown): LiveQuery;
  not(column: string, operator: string, value: unknown): LiveQuery;
  or(filters: string): LiveQuery;
  order(column: string, options?: { ascending?: boolean }): LiveQuery;
  limit(count: number): LiveQuery;
  maybeSingle(): PromiseLike<Result>;
}
export interface LiveDb { from(table: string): LiveQuery }

/** Dia de Brasília (UTC-3): data AAAA-MM-DD e início em ISO. */
export function brtDay(now: Date = new Date()) {
  const day = new Date(now.getTime() - 3 * 3600000).toISOString().slice(0, 10);
  return { day, start: `${day}T03:00:00.000Z` };
}

export async function loadProjectLivePanel(sb: LiveDb, projectId: string, now: Date = new Date()): Promise<LivePanel> {
  const { day, start } = brtDay(now);
  const month = new Date(now.getTime() - 30 * 86400000).toISOString();
  const count = (event: string) => sb.from("imphq_events").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("event_name", event).gte("created_at", start);
  const [pv, ic, salesRes, adsRes, webhookRes, paramsRes, healthRes] = await Promise.all([
    count("PageView"),
    count("InitiateCheckout"),
    sb.from("imphq_vendas").select("status, valor, data, tipo_venda").eq("project_id", projectId).gte("created_at", start).limit(5000),
    sb.from("imphq_ads_spend").select("valor, landing_page_views, checkouts_iniciados, init_checkout, compras, valor_conversao, moeda").eq("project_id", projectId).eq("data_ref", day).limit(5000),
    sb.from("imphq_vendas").select("id", { count: "exact", head: true }).eq("project_id", projectId).gte("created_at", month),
    sb.from("imphq_scale_rounds").select("params").eq("project_id", projectId).order("updated_at", { ascending: false }).limit(1),
    sb.from("imphq_v_ads_sync_health").select("*").eq("project_id", projectId).maybeSingle(),
  ]);
  for (const res of [pv, ic, salesRes, adsRes, webhookRes, paramsRes]) if (res.error) throw res.error;
  const first = (paramsRes.data as Array<{ params: unknown }> | null)?.[0];
  const params = first ? paramsFrom(first.params) : null;
  return buildLivePanel({
    trackerEvents: { PageView: pv.count ?? 0, InitiateCheckout: ic.count ?? 0 },
    sales: (salesRes.data ?? []) as SaleRow[],
    ads: (adsRes.data ?? []) as AdRow[],
    webhookConnected: (webhookRes.count ?? 0) > 0,
    params: params && params.payout > 0 && params.cpaAlvo > 0 ? params : null,
    dayFraction: dayFraction(now),
    syncHealth: healthRes.error ? null : adsSyncHealth(healthRes.data as AdsSyncHealthRow | null, now.getTime()),
  });
}

/** Linha para imphq_live_snapshots a partir do painel. */
export function snapshotRow(projectId: string, panel: LivePanel, now: Date = new Date()) {
  const p = panel.parcial;
  return {
    project_id: projectId, taken_at: now.toISOString(), dia: brtDay(now).day, moeda: panel.moeda,
    gasto: p.gasto.valor, faturamento: p.faturamento.valor, vendas: p.vendas.valor, cpa: p.cpa.valor, zona: p.cpa.zona,
    roas: p.roas.valor, lucro: p.lucro.valor, painel: panel,
  };
}

/** Projeto entra na leitura quando tem fonte viva: venda no checkout (30 d), gasto (7 d) ou tracker (7 d). */
export async function liveProjects(sb: LiveDb, now: Date = new Date()): Promise<Array<{ id: string; name: string }>> {
  const week = new Date(now.getTime() - 7 * 86400000);
  const month = new Date(now.getTime() - 30 * 86400000).toISOString();
  const [projects, sales, ads, events] = await Promise.all([
    sb.from("imphq_projects").select("id, name").or("is_archived.eq.false,is_archived.is.null"),
    sb.from("imphq_vendas").select("project_id").gte("created_at", month).not("project_id", "is", null).limit(10000),
    sb.from("imphq_ads_spend").select("project_id").gte("data_ref", week.toISOString().slice(0, 10)).gt("valor", 0).limit(10000),
    sb.from("imphq_events").select("project_id").gte("created_at", week.toISOString()).not("project_id", "is", null).limit(10000),
  ]);
  for (const res of [projects, sales, ads, events]) if (res.error) throw res.error;
  const ids = (res: Result) => ((res.data ?? []) as Array<{ project_id: unknown }>).map((r) => String(r.project_id));
  const active = new Set([...ids(sales), ...ids(ads), ...ids(events)]);
  return ((projects.data ?? []) as Array<{ id: string; name: string }>).filter((p) => active.has(p.id));
}

import { supabase } from "@/integrations/supabase/client";
import type { Row } from "@/lib/marketing-consolidation";
interface PageResult { data: unknown; error: unknown }
interface PageQuery extends PromiseLike<PageResult> { order(column: string, options?: { ascending: boolean }): PageQuery; range(from: number, to: number): PageQuery }
// Deliberately widened: generated Supabase query parser exceeds TS instantiation depth on this JSON projection.
// Result is validated by the pure consolidator; no names, contacts or raw webhook payloads are fetched.
const saleColumns: string = "id,project_id,plataforma,external_transaction_id,produto_id_ext,produto_nome,tipo_venda,status,data_venda,created_at,valor,valor_liquido,currency:data->>moeda,bump_product_id:data->>bump_product_id,bump_offer_code:data->>bump_offer_code";
export async function readPages(create: () => PageQuery) {
  const rows: Row[] = [];
  for (let page = 0; page < 20; page++) {
    const res = await create().order("id", { ascending: true }).range(page * 1000, page * 1000 + 999);
    if (res.error) return { rows: [] as Row[], error: true, truncated: false };
    const data = (res.data ?? []) as Row[];
    rows.push(...data);
    if (data.length < 1000) return { rows, error: false, truncated: false };
  }
  return { rows, error: false, truncated: true };
}
export async function loadMarketing(project: string, since: string, until: string) {
  const [sales, ads, events, funnel, leads, health] = await Promise.all([
    // Read current statuses across history before period filtering, including late refunds.
    readPages(() => supabase.from("imphq_vendas").select(saleColumns).eq("project_id", project)),
    readPages(() => supabase.from("imphq_ads_spend").select("id,source,plataforma,ad_id,campaign_id,data_ref,valor,moeda,landing_page_views,init_checkout,created_at").eq("project_id", project).gte("data_ref", since.slice(0, 10)).lt("data_ref", until.slice(0, 10))),
    readPages(() => supabase.from("imphq_events").select("id,event_name,session_id,metadata,event_data,utm_source,created_at").eq("project_id", project).gte("created_at", since).lt("created_at", until)),
    readPages(() => supabase.from("imphq_funnel_events").select("id,event_id,step,session_id,meta,utm_source,event_at,created_at").eq("project_id", project).or(`and(event_at.gte.${since},event_at.lt.${until}),and(event_at.is.null,created_at.gte.${since},created_at.lt.${until})`)),
    readPages(() => supabase.from("imphq_leads").select("id,created_at").eq("project_id", project).gte("created_at", since).lt("created_at", until)),
    supabase.from("imphq_v_ads_sync_health").select("meta_ultimo_sync,zernio_ultimo_sync,meta_status,zernio_status").eq("project_id", project).maybeSingle(),
  ]);
  return { sales, ads, events, funnel, leads, health: health.error ? null : health.data };
}

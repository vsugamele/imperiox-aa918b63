// Estrategista (OPS1.3): monta a próxima leva de criativos de um projeto cruzando a biblioteca de ângulos, o mercado
// minerado (ângulo e formato das referências), o que já foi testado (leitura ao vivo dos testes) e as réguas do Método
// H&W. Sem cron e sem IA: só lê o banco. Nada é gerado aqui — a leva salva fica "planejado" até alguém aprovar, e
// gerar arte é outro passo (fábrica).
// Body: { modo: "plano" | "salvar" | "aprovar" | "descartar", project_id, tamanho?, so_imagem?, leva_id? }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { planLeva, type LibraryAngle, type MarketRef, type TestedAd } from "../_shared/batch-strategist.ts";
import { liveReadings, type LiveOrder, type LiveVariant, type SaleRow, type SpendRow } from "../_shared/test-live.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const makeClient = () => createClient(SUPABASE_URL, SERVICE_KEY);
type Sb = ReturnType<typeof makeClient>;

async function testedAds(sb: Sb, projectId: string): Promise<TestedAd[]> {
  const { data: orders } = await sb.from("imphq_test_orders").select("*").eq("project_id", projectId).neq("status", "cancelado");
  if (!orders?.length) return [];
  const { data: variants } = await sb.from("imphq_test_variants")
    .select("order_id, ordem, angulo, hipotese, status, utm_content, meta_ad_id, copy_lib_id, formato, porta")
    .in("order_id", orders.map((o: { id: string }) => o.id));
  const adIds = (variants ?? []).map((v: { meta_ad_id: string | null }) => v.meta_ad_id).filter(Boolean) as string[];
  const [{ data: spend }, { data: sales }] = await Promise.all([
    adIds.length ? sb.from("imphq_ads_spend").select("ad_id, spend, init_checkout, link_clicks, impressoes, purchases, effective_status, created_at, date").in("ad_id", adIds) : Promise.resolve({ data: [] }),
    sb.from("imphq_vendas").select("utm_campaign, utm_content, status, valor, valor_liquido, tipo_venda").in("utm_campaign", orders.map((o: { utm_campaign: string }) => o.utm_campaign)),
  ]);
  const out: TestedAd[] = [];
  for (const o of orders) {
    const vs = (variants ?? []).filter((v: { order_id: string }) => v.order_id === o.id) as Array<LiveVariant & { copy_lib_id: string | null; formato: string | null; porta: string | null }>;
    const since = String(o.ativado_em ?? o.created_at).slice(0, 10);
    const sp = ((spend ?? []) as Array<SpendRow & { date: string | null }>).filter((r) => String(r.date ?? "") >= since);
    const readings = liveReadings(o as LiveOrder, vs, sp, (sales ?? []) as SaleRow[]);
    for (const v of vs) {
      const r = readings.find((x) => x.ordem === v.ordem);
      out.push({ copy_lib_id: v.copy_lib_id, formato: v.formato, porta: v.porta, angulo: v.angulo, gasto: r?.gasto ?? 0, vendas: r?.vendas ?? 0, status: v.status });
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const modo = String(body?.modo ?? "plano");
    const sb = makeClient();

    if (modo === "aprovar" || modo === "descartar") {
      if (!body?.leva_id) return json({ error: "leva_id é obrigatório" }, 400);
      const status = modo === "aprovar" ? "aprovado" : "descartado";
      const { data, error } = await sb.from("imphq_creative_batches").update({ status, updated_at: new Date().toISOString() })
        .eq("id", String(body.leva_id)).eq("briefing->>tipo", "leva").select("id, status").maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "leva não encontrada" }, 404);
      return json({ ok: true, leva: data });
    }

    const projectId = String(body?.project_id ?? "");
    if (!projectId) return json({ error: "project_id é obrigatório" }, 400);
    const [{ data: lib }, { data: refs }, { data: round }, tested] = await Promise.all([
      sb.from("imphq_copy_library").select("id, numero, nome, categoria").eq("biblioteca", "angulo"),
      sb.from("imphq_referencias").select("id, titulo, copy_lib_id, copy_lib_status, formato").eq("project_id", projectId).limit(2000),
      sb.from("imphq_scale_rounds").select("params").eq("project_id", projectId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      testedAds(sb, projectId),
    ]);
    // Do mercado, só o ângulo com decisão firme ou revisada conta; o formato vale sempre que foi lido.
    const market: MarketRef[] = (refs ?? []).map((r: { id: string; titulo: string | null; copy_lib_id: string | null; copy_lib_status: string | null; formato: string | null }) => ({
      id: r.id, titulo: r.titulo, formato: r.formato,
      copy_lib_id: r.copy_lib_id && (r.copy_lib_status === "firme" || r.copy_lib_status === "revisado") ? r.copy_lib_id : null,
    }));
    const payout = Number((round?.params as { payout?: unknown } | null)?.payout) || null;
    const plan = planLeva({ library: (lib ?? []) as LibraryAngle[], market, tested, payout, tamanho: Number(body?.tamanho) || 20, soImagem: body?.so_imagem !== false });
    const contexto = { referencias: market.length, testados: tested.length, payout };

    if (modo === "plano") return json({ ok: true, projeto: projectId, contexto, ...plan });

    if (modo === "salvar") {
      const { data: proj } = await sb.from("imphq_projects").select("user_id, name").eq("id", projectId).maybeSingle();
      const owner = (proj as { user_id?: string | null } | null)?.user_id;
      if (!owner) return json({ error: "projeto sem dono: não dá para salvar a leva" }, 400);
      const nome = `Leva ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} · ${plan.tamanho} criativos`;
      const { data, error } = await sb.from("imphq_creative_batches").insert({
        project_id: projectId, user_id: owner, nome, status: "planejado",
        angulos: [...new Set(plan.itens.map((i) => i.angulo))],
        briefing: { tipo: "leva", composicao: plan.composicao, itens: plan.itens, avisos: plan.avisos, contexto },
        total_planejado: plan.tamanho, total_gerado: 0,
      }).select("id").single();
      if (error) throw new Error(error.message);
      return json({ ok: true, leva_id: data.id, nome, ...plan });
    }

    return json({ error: "modo deve ser plano, salvar, aprovar ou descartar" }, 400);
  } catch (e) {
    console.error("[batch-strategist]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

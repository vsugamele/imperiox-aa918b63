// Molde Vencedor do Método H&W (MHW1.5). Sem cron: roda quando alguém chama (MCP, Claude ou painel).
//   modo "desmontar" { variant_id }: V00 do campeão — script palavra por palavra (texto do anúncio ou transcrição da
//     referência), quem fala, onde e tom visual (lidos da imagem). Guarda em imphq_creative_batches (briefing.tipo =
//     "molde", status "molde") e marca a variante como V00 do próprio molde.
//   modo "onda" { order_id? | project_id? }: lê os campeões com V00 e devolve a próxima onda (a mesma variação para
//     todos que podem fazê-la) com o brief de cada uma — script travado, uma dimensão solta. Não gera nada: quem gera
//     é a fábrica, quando alguém mandar. `salvar_briefs: true` só registra os briefs como lotes "planejado".
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { nextWave, variationBrief, type ChampionState, type MoldV00, type Variacao, type VariationStatus } from "../_shared/winner-mold.ts";
import { castFromRows, moldAvatar, type CastRow } from "../_shared/cast.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const makeClient = () => createClient(SUPABASE_URL, SERVICE_KEY);
type Sb = ReturnType<typeof makeClient>;

/** Quem fala, onde e tom visual, lidos da imagem do campeão. */
async function readVisual(imageUrl: string | null): Promise<{ quem_fala: string; onde: string; tom_visual: string }> {
  const vazio = { quem_fala: "não identificado", onde: "não identificado", tom_visual: "não identificado" };
  if (!OPENROUTER_API_KEY || !imageUrl || !/^https?:\/\//.test(imageUrl)) return vazio;
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json", "X-Title": "Imperio HQ winner-mold" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: [
        { type: "text", text: "Descreva este criativo de anúncio em JSON com três chaves, em português: quem_fala (tipo de pessoa, idade aproximada, roupa; 'ninguém' se não houver pessoa), onde (cenário), tom_visual (luz, cor, contraste). Frases curtas, sem opinião." },
        { type: "image_url", image_url: { url: imageUrl } },
      ] }],
      max_tokens: 250,
    }),
  });
  if (!r.ok) return vazio;
  const d = await r.json().catch(() => null) as { choices?: Array<{ message?: { content?: string } }> } | null;
  try {
    const o = JSON.parse(d?.choices?.[0]?.message?.content ?? "{}") as Record<string, unknown>;
    return { quem_fala: String(o.quem_fala ?? vazio.quem_fala), onde: String(o.onde ?? vazio.onde), tom_visual: String(o.tom_visual ?? vazio.tom_visual) };
  } catch { return vazio; }
}

/** Dono do projeto: os lotes exigem um usuário do time (como na fábrica). */
async function projectOwner(sb: Sb, projectId: string | null | undefined): Promise<string | null> {
  if (!projectId) return null;
  const { data } = await sb.from("imphq_projects").select("user_id").eq("id", projectId).maybeSingle();
  return (data as { user_id?: string | null } | null)?.user_id ?? null;
}

const STATUS_TO_RESULT: Record<string, VariationStatus> = { vencedor: "vendeu", morto: "morreu" };

async function champions(sb: Sb, filter: { order_id?: string; project_id?: string }): Promise<Array<{ state: ChampionState; mold: MoldV00 | null; nome: string; order_id: string; avatar_id: string | null }>> {
  let q = sb.from("imphq_test_variants").select("id, order_id, angulo, avatar_id").eq("molde_variacao", "V00");
  if (filter.order_id) q = q.eq("order_id", filter.order_id);
  const { data: base, error } = await q.limit(50);
  if (error) throw error;
  let list = base ?? [];
  if (filter.project_id && list.length) {
    const { data: ords } = await sb.from("imphq_test_orders").select("id").eq("project_id", filter.project_id).in("id", list.map((v) => v.order_id));
    const ok = new Set((ords ?? []).map((o: { id: string }) => o.id));
    list = list.filter((v) => ok.has(v.order_id));
  }
  if (!list.length) return [];
  const ids = list.map((v) => v.id);
  const [{ data: kids }, { data: molds }] = await Promise.all([
    sb.from("imphq_test_variants").select("molde_campeao_id, molde_variacao, status").in("molde_campeao_id", ids).neq("molde_variacao", "V00"),
    sb.from("imphq_creative_batches").select("briefing").eq("status", "molde").limit(200),
  ]);
  const moldBy = new Map<string, MoldV00>();
  for (const m of molds ?? []) {
    const b = (m as { briefing: { tipo?: string; v00?: MoldV00 } | null }).briefing;
    if (b?.tipo === "molde" && b.v00?.campeao_id) moldBy.set(b.v00.campeao_id, b.v00);
  }
  return list.map((v) => {
    const feitas: ChampionState["feitas"] = {};
    for (const k of (kids ?? []).filter((x: { molde_campeao_id: string | null }) => x.molde_campeao_id === v.id)) {
      const variacao = k.molde_variacao as Exclude<Variacao, "V00"> | null;
      if (variacao) feitas[variacao] = STATUS_TO_RESULT[k.status] ?? "no_ar";
    }
    return { state: { campeao_id: v.id, feitas, tem_v00: moldBy.has(v.id) }, mold: moldBy.get(v.id) ?? null, nome: v.angulo, order_id: v.order_id, avatar_id: (v as { avatar_id?: string | null }).avatar_id ?? null };
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const modo = String(body?.modo ?? "onda");
    const sb = makeClient();

    if (modo === "desmontar") {
      if (!body?.variant_id) return json({ error: "variant_id é obrigatório" }, 400);
      const { data: v, error } = await sb.from("imphq_test_variants").select("id, order_id, angulo, texto, headline, image_url, referencia_id").eq("id", String(body.variant_id)).maybeSingle();
      if (error) throw error;
      if (!v) return json({ error: "variante não encontrada" }, 404);
      const { data: order } = await sb.from("imphq_test_orders").select("project_id, nome").eq("id", v.order_id).maybeSingle();
      let script = [v.headline, v.texto].filter(Boolean).join("\n").trim();
      let formato: "imagem" | "video" = "imagem";
      if (v.referencia_id) {
        const { data: ref } = await sb.from("imphq_referencias").select("transcricao, tipo").eq("id", v.referencia_id).maybeSingle();
        if (ref?.transcricao) { script = String(ref.transcricao).trim(); formato = "video"; }
      }
      if (!script) return json({ error: "campeão sem texto nem transcrição: não dá para travar o script" }, 400);
      const owner = await projectOwner(sb, order?.project_id);
      if (!order?.project_id || !owner) return json({ error: "teste sem projeto/dono: não dá para guardar o molde" }, 400);
      const visual = await readVisual(v.image_url);
      const v00: MoldV00 = { script, ...visual, formato, campeao_id: v.id, campeao_nome: v.angulo };
      const { data: batch, error: bErr } = await sb.from("imphq_creative_batches").insert({
        project_id: order.project_id, user_id: owner, nome: `Molde · ${v.angulo}`, status: "molde",
        angulos: [v.angulo], briefing: { tipo: "molde", v00, origem: { order_id: v.order_id, teste: order?.nome ?? null } },
        total_planejado: 0, total_gerado: 0,
      }).select("id").single();
      if (bErr) throw new Error(bErr.message);
      await sb.from("imphq_test_variants").update({ molde_campeao_id: v.id, molde_variacao: "V00" }).eq("id", v.id);
      return json({ ok: true, molde_id: batch.id, v00 });
    }

    if (modo === "onda") {
      const list = await champions(sb, { order_id: body?.order_id ? String(body.order_id) : undefined, project_id: body?.project_id ? String(body.project_id) : undefined });
      if (!list.length) return json({ ok: true, onda: null, motivo: "Nenhum campeão desmontado ainda (V00). Use modo \"desmontar\" num criativo com 3 vendas." });
      const plan = nextWave(list.map((c) => c.state));
      // Elenco (OPS1.5): V01 sugere outro avatar do mesmo tipo, V02/V04 o tipo oposto.
      const orderIds = [...new Set(list.map((c) => c.order_id))];
      const { data: ords } = await sb.from("imphq_test_orders").select("id, project_id").in("id", orderIds);
      const projectIds = [...new Set((ords ?? []).map((o: { project_id: string }) => o.project_id))];
      const { data: castRows } = projectIds.length ? await sb.from("imphq_avatar_studio_projects").select("id, nome, tipo, papel, ficha, avatar_photos, ativo, project_id").in("project_id", projectIds) : { data: [] };
      const projOfOrder = new Map((ords ?? []).map((o: { id: string; project_id: string }) => [o.id, o.project_id]));
      const briefs = plan.itens.flatMap((i) => {
        const c = list.find((x) => x.state.campeao_id === i.campeao_id);
        if (!c?.mold || i.variacao === "V00") return [];
        const cast = castFromRows(((castRows ?? []) as Array<CastRow & { project_id: string }>).filter((r) => r.project_id === projOfOrder.get(c.order_id)));
        const sugestao = moldAvatar(i.variacao, c.avatar_id, cast);
        return [{ campeao_id: i.campeao_id, campeao: c.nome, ...variationBrief(c.mold, i.variacao), avatar_sugerido: sugestao ? { id: sugestao.id, nome: sugestao.nome, tipo: sugestao.tipo } : null }];
      });
      let salvos = 0;
      if (body?.salvar_briefs === true && briefs.length) {
        const orderIds = [...new Set(list.map((c) => c.order_id))];
        const { data: ords } = await sb.from("imphq_test_orders").select("id, project_id").in("id", orderIds);
        const projectOf = new Map((ords ?? []).map((o: { id: string; project_id: string }) => [o.id, o.project_id]));
        for (const b of briefs) {
          const c = list.find((x) => x.state.campeao_id === b.campeao_id);
          const projectId = c ? projectOf.get(c.order_id) : null;
          const owner = await projectOwner(sb, projectId);
          if (!projectId || !owner) continue;
          const { error: insErr } = await sb.from("imphq_creative_batches").insert({
            project_id: projectId, user_id: owner, nome: `${b.variacao} · ${b.campeao}`, status: "planejado",
            angulos: [b.campeao], briefing: { tipo: "variacao_molde", ...b }, total_planejado: 1, total_gerado: 0,
          });
          if (!insErr) salvos++;
        }
      }
      return json({ ok: true, onda: plan.onda, aguardando_leitura: plan.aguardando, briefs, briefs_salvos: salvos });
    }

    return json({ error: "modo deve ser desmontar ou onda" }, 400);
  } catch (e) {
    console.error("[winner-mold]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

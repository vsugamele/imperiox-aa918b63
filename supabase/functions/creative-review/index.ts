// Revisor do Método H&W (MHW1.1 + MHW1.2): classifica (ponto da rota, porta, pouso, carga) e revisa (teste do print,
// abertura, cartão de bolso, compliance) criativos de teste ou peças soltas. Sem cron: roda quando alguém chama
// (painel, MCP ou Claude). Grava só etiquetas firmes e nunca sobrescreve etiqueta já posta por alguém.
// Body: { variant_ids?: string[], order_id?: string, texto?, headline?, image_url?, pagina?, publico?, salvar?: boolean }
// Anti-loop: até 10 itens por chamada, para após 3 falhas seguidas.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { parseTaxonomyAnswer, taxonomyRequest } from "../_shared/hw-taxonomy.ts";
import { reviewRequest, reviewVerdict, type ReviewSubject } from "../_shared/hw-review.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TYPESAFE_API_KEY = Deno.env.get("TYPESAFE_API_KEY");
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const MAX_ITEMS = 10;
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const makeClient = () => createClient(SUPABASE_URL, SERVICE_KEY);

async function askJev(body: unknown): Promise<{ answers?: Record<string, unknown> }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST", headers: { Authorization: `Bearer ${TYPESAFE_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (r.status === 429) { await new Promise((res) => setTimeout(res, 1500 * (attempt + 1))); continue; }
    if (!r.ok) throw new Error(`TypeSafe ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return await r.json();
  }
  throw new Error("TypeSafe 429 depois de 3 tentativas");
}

/** Descreve o primeiro quadro como alguém rolando o feed sem som (o Jev lê texto; a visão fica com o Gemini). */
async function describeFirstFrame(imageUrl: string): Promise<string | null> {
  if (!OPENROUTER_API_KEY || !/^https?:\/\//.test(imageUrl)) return null;
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json", "X-Title": "Imperio HQ creative-review" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: [
        { type: "text", text: "Descreva em 2 frases, em português, o que alguém vê nesta imagem de anúncio no primeiro segundo, rolando o feed sem som: quem aparece (idade, expressão), o objeto ou cena principal, e se há produto, preço ou logo em destaque. Sem opinião." },
        { type: "image_url", image_url: { url: imageUrl } },
      ] }],
      max_tokens: 200,
    }),
  });
  if (!r.ok) return null;
  const d = await r.json().catch(() => null) as { choices?: Array<{ message?: { content?: string } }> } | null;
  return d?.choices?.[0]?.message?.content?.trim() || null;
}

interface Item { variant_id: string | null; subject: ReviewSubject; image_url: string | null; atual: { ponto_rota: number | null; porta: string | null; pouso: string | null; carga: string | null; formato: string | null } }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!TYPESAFE_API_KEY) return json({ error: "TYPESAFE_API_KEY ausente" }, 500);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const salvar = body?.salvar !== false;
    const sb = makeClient();
    const items: Item[] = [];

    if (Array.isArray(body?.variant_ids) || body?.order_id) {
      let q = sb.from("imphq_test_variants").select("id, order_id, texto, headline, image_url, ponto_rota, porta, pouso, carga, formato").order("ordem").limit(MAX_ITEMS);
      if (Array.isArray(body.variant_ids)) q = q.in("id", body.variant_ids.map(String));
      if (body.order_id) q = q.eq("order_id", String(body.order_id));
      const { data, error } = await q;
      if (error) throw error;
      const orderIds = [...new Set((data ?? []).map((v) => v.order_id))];
      const { data: orders } = orderIds.length ? await sb.from("imphq_test_orders").select("id, oferta").in("id", orderIds) : { data: [] };
      const oferta = new Map((orders ?? []).map((o: { id: string; oferta: string | null }) => [o.id, o.oferta]));
      for (const v of data ?? []) {
        items.push({
          variant_id: v.id, image_url: v.image_url,
          subject: { texto: v.texto ?? "", headline: v.headline, pagina: body.pagina ?? oferta.get(v.order_id) ?? null, publico: body.publico ?? null },
          atual: { ponto_rota: v.ponto_rota, porta: v.porta, pouso: v.pouso, carga: v.carga, formato: v.formato },
        });
      }
    } else if (body?.texto) {
      items.push({ variant_id: null, image_url: body.image_url ?? null, subject: { texto: String(body.texto), headline: body.headline ?? null, pagina: body.pagina ?? null, publico: body.publico ?? null, primeiro_quadro: body.primeiro_quadro ?? null }, atual: { ponto_rota: null, porta: null, pouso: null, carga: null, formato: null } });
    } else {
      return json({ error: "Informe variant_ids, order_id ou texto" }, 400);
    }

    const out: Array<Record<string, unknown>> = [];
    let falhas = 0;
    for (const it of items.slice(0, MAX_ITEMS)) {
      if (falhas >= 3) { out.push({ parou: "3 falhas seguidas" }); break; }
      try {
        if (!it.subject.primeiro_quadro && it.image_url) it.subject.primeiro_quadro = await describeFirstFrame(it.image_url);
        const [tax, rev] = await Promise.all([
          askJev(taxonomyRequest({ texto: it.subject.texto, headline: it.subject.headline, primeiro_quadro: it.subject.primeiro_quadro })),
          askJev(reviewRequest(it.subject)),
        ]);
        const taxonomia = parseTaxonomyAnswer(tax as { answers?: Record<string, { choice?: string; confidence?: number }> });
        const revisao = reviewVerdict(it.subject, rev as { answers?: Record<string, { noul?: number }> });
        if (salvar && it.variant_id) {
          // Etiqueta firme só preenche campo vazio: o que alguém já etiquetou fica.
          const patch: Record<string, unknown> = {
            revisao: { ...revisao, primeiro_quadro: it.subject.primeiro_quadro ?? null, em: new Date().toISOString() },
            taxonomia: { fonte: "jev", confianca: taxonomia.confianca, sugerido: { ponto_rota: taxonomia.ponto_rota, porta: taxonomia.porta, pouso: taxonomia.pouso, carga: taxonomia.carga, formato: taxonomia.formato }, em: new Date().toISOString() },
          };
          for (const [k, v] of Object.entries(taxonomia.firmes)) if (it.atual[k as keyof Item["atual"]] == null) patch[k] = v;
          const { error } = await sb.from("imphq_test_variants").update(patch).eq("id", it.variant_id);
          if (error) throw new Error(error.message);
        }
        out.push({ variant_id: it.variant_id, aprovado: revisao.aprovado, nota: revisao.nota, reprovacoes: revisao.reprovacoes, avisos: revisao.avisos, correcoes_permitidas: revisao.correcoes_permitidas, taxonomia: { ponto_rota: taxonomia.ponto_rota, porta: taxonomia.porta, pouso: taxonomia.pouso, carga: taxonomia.carga, formato: taxonomia.formato, confianca: taxonomia.confianca }, primeiro_quadro: it.subject.primeiro_quadro ?? null });
        falhas = 0;
      } catch (e) {
        falhas++;
        out.push({ variant_id: it.variant_id, erro: e instanceof Error ? e.message : String(e) });
      }
    }
    return json({ ok: true, salvo: salvar, itens: out.length, resultados: out });
  } catch (e) {
    console.error("[creative-review]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

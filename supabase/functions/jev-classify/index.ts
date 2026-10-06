// Classifica textos de anúncio nos ângulos da biblioteca de copy com o Jev (TypeSafe), CPY1.2.
// modo "variants": variantes de um teste; "references": referências com transcrição; "auto" (cron): variantes sem etiqueta
// dos testes ativos + referências ainda não classificadas, gravando. Fora do auto, só grava com gravar=true.
// Variante recebe só etiqueta firme e nunca sobrescreve; referência grava firme e dúvida (dúvida vai para revisão).
// Anti-loop: no máximo 30 itens por chamada e para após 3 falhas seguidas da API.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { angleRequest, parseAngleAnswer, type AngleLibraryItem, type AngleSubject, type AngleVerdict } from "../_shared/angle-classifier.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TYPESAFE_API_KEY = Deno.env.get("TYPESAFE_API_KEY");
const MAX_ITEMS = 30;

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function askJev(body: unknown): Promise<{ answers?: Record<string, unknown>; usage?: { input_tokens?: number } }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: { Authorization: `Bearer ${TYPESAFE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.status === 429) { await new Promise((res) => setTimeout(res, 1500 * (attempt + 1))); continue; }
    if (!r.ok) throw new Error(`TypeSafe ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return await r.json();
  }
  throw new Error("TypeSafe 429 depois de 3 tentativas");
}

type Kind = "variant" | "reference";
interface Item { kind: Kind; id: string; atual: string | null; subject: AngleSubject }

const makeClient = () => createClient(SUPABASE_URL, SERVICE_KEY);
type Sb = ReturnType<typeof makeClient>;

async function variantItems(sb: Sb, filter: { order_id?: string; untaggedActive?: boolean }, limit: number): Promise<Item[]> {
  let q = sb.from("imphq_test_variants").select("id, order_id, ordem, angulo, hipotese, texto, headline, copy_lib_id").order("ordem").limit(limit);
  if (filter.order_id) q = q.eq("order_id", filter.order_id);
  if (filter.untaggedActive) {
    const { data: orders } = await sb.from("imphq_test_orders").select("id").neq("status", "cancelado");
    const ids = (orders ?? []).map((o: { id: string }) => o.id);
    if (!ids.length) return [];
    q = q.in("order_id", ids).is("copy_lib_id", null);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((v: { id: string; ordem: number; angulo: string; hipotese: string | null; texto: string | null; headline: string | null; copy_lib_id: string | null }) => ({
    kind: "variant" as const, id: v.id, atual: v.copy_lib_id,
    subject: { titulo: `${String(v.ordem).padStart(2, "0")} ${v.angulo}${v.headline ? ` — ${v.headline}` : ""}`, texto: v.texto || v.angulo, contexto: v.hipotese },
  }));
}

async function referenceItems(sb: Sb, opts: { project_id?: string; pendentes: boolean }, limit: number): Promise<Item[]> {
  let q = sb.from("imphq_referencias").select("id, titulo, transcricao, notas, copy_lib_id").not("transcricao", "is", null).neq("transcricao", "").order("created_at", { ascending: false }).limit(limit);
  if (opts.project_id) q = q.eq("project_id", opts.project_id);
  if (opts.pendentes) q = q.is("copy_lib_at", null);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r: { id: string; titulo: string | null; transcricao: string | null; notas: string | null; copy_lib_id: string | null }) => ({
    kind: "reference" as const, id: r.id, atual: r.copy_lib_id, subject: { titulo: r.titulo, texto: r.transcricao ?? "", contexto: r.notas },
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!TYPESAFE_API_KEY) return json({ error: "TYPESAFE_API_KEY ausente" }, 500);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const modo = ["references", "variants", "auto"].includes(body?.modo) ? String(body.modo) : "variants";
    // "auto" (cron) sempre grava; nos outros modos só com gravar=true.
    const gravar = modo === "auto" || body?.gravar === true;
    const limit = Math.min(MAX_ITEMS, Math.max(1, Number(body?.limit) || (modo === "auto" ? MAX_ITEMS : 10)));
    const sb = makeClient();

    const { data: lib, error: libErr } = await sb.from("imphq_copy_library").select("id, numero, nome, categoria, explicacao").eq("biblioteca", "angulo").order("ordem");
    if (libErr) throw libErr;
    const library = (lib ?? []) as AngleLibraryItem[];

    let items: Item[] = [];
    if (modo === "variants") {
      if (!body?.order_id) return json({ error: "order_id é obrigatório no modo variants" }, 400);
      items = await variantItems(sb, { order_id: String(body.order_id) }, limit);
    } else if (modo === "references") {
      items = await referenceItems(sb, { project_id: body?.project_id ? String(body.project_id) : undefined, pendentes: gravar }, limit);
    } else {
      const vs = await variantItems(sb, { untaggedActive: true }, limit);
      items = [...vs, ...(await referenceItems(sb, { pendentes: true }, limit - vs.length))].slice(0, limit);
    }

    const results: Array<Record<string, unknown>> = [];
    const verdicts = new Map<string, AngleVerdict>();
    let tokens = 0;
    let falhas = 0;
    const nome = (id: string | null) => library.find((l) => l.id === id)?.nome ?? null;
    for (let i = 0; i < items.length; i += 5) {
      if (falhas >= 3) { results.push({ erro: "parou após 3 falhas seguidas da API" }); break; }
      const chunk = items.slice(i, i + 5);
      const settled = await Promise.allSettled(chunk.map((it) => askJev(angleRequest(it.subject, library))));
      settled.forEach((s, k) => {
        const it = chunk[k];
        if (s.status === "rejected") { falhas++; results.push({ tipo: it.kind, id: it.id, titulo: it.subject.titulo, erro: String(s.reason).slice(0, 200) }); return; }
        falhas = 0;
        tokens += Number(s.value.usage?.input_tokens ?? 0);
        const v = parseAngleAnswer(s.value as Parameters<typeof parseAngleAnswer>[0]);
        verdicts.set(it.id, v);
        results.push({ tipo: it.kind, id: it.id, titulo: it.subject.titulo, atual: it.atual, atual_nome: nome(it.atual), jev: v.copy_lib_id, jev_nome: nome(v.copy_lib_id), confianca: v.confianca, decisao: v.decisao, camada: v.camada, alternativas: v.alternativas.map((a) => ({ ...a, nome: nome(a.id) })) });
      });
    }

    let gravados = 0;
    if (gravar) {
      const now = new Date().toISOString();
      for (const it of items) {
        const v = verdicts.get(it.id);
        if (!v) continue;
        if (it.kind === "variant") {
          // Variante só recebe etiqueta firme e nunca sobrescreve a de alguém.
          if (v.decisao !== "firme" || it.atual || !v.copy_lib_id) continue;
          const { error } = await sb.from("imphq_test_variants").update({ copy_lib_id: v.copy_lib_id }).eq("id", it.id).is("copy_lib_id", null);
          if (!error) gravados++;
        } else {
          // Referência grava sempre: firme vale, dúvida fica na fila de revisão com as alternativas.
          const { error } = await sb.from("imphq_referencias").update({
            copy_lib_id: v.copy_lib_id, copy_lib_status: v.decisao, copy_lib_conf: v.confianca, copy_lib_camada: v.camada,
            copy_lib_alt: v.alternativas, copy_lib_at: now,
          }).eq("id", it.id).is("copy_lib_at", null);
          if (!error) gravados++;
        }
      }
    }
    return json({ ok: true, modo, itens: results.length, gravados, tokens, custo_usd: Math.round(tokens * 0.042e-6 * 1e6) / 1e6, results });
  } catch (e) {
    console.error("[jev-classify]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

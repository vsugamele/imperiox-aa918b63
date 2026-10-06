// Classifica textos de anúncio nos ângulos da biblioteca de copy com o Jev (TypeSafe), CPY1.2.
// modo "variants": variantes de um teste (compara com a etiqueta atual); modo "references": referências com transcrição.
// Por padrão só devolve o resultado (dry_run). Gravar exige gravar=true e só preenche etiquetas vazias com decisão firme.
// Anti-loop: no máximo 30 itens por chamada e para após 3 falhas seguidas da API.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { angleRequest, parseAngleAnswer, type AngleLibraryItem, type AngleSubject } from "../_shared/angle-classifier.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!TYPESAFE_API_KEY) return json({ error: "TYPESAFE_API_KEY ausente" }, 500);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const modo = body?.modo === "references" ? "references" : "variants";
    const gravar = body?.gravar === true;
    const limit = Math.min(MAX_ITEMS, Math.max(1, Number(body?.limit) || 10));
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: lib, error: libErr } = await sb.from("imphq_copy_library").select("id, numero, nome, categoria, explicacao").eq("biblioteca", "angulo").order("ordem");
    if (libErr) throw libErr;
    const library = (lib ?? []) as AngleLibraryItem[];

    let items: Array<{ id: string; atual: string | null; subject: AngleSubject }> = [];
    if (modo === "variants") {
      if (!body?.order_id) return json({ error: "order_id é obrigatório no modo variants" }, 400);
      const { data, error } = await sb.from("imphq_test_variants").select("id, ordem, angulo, hipotese, texto, headline, copy_lib_id").eq("order_id", String(body.order_id)).order("ordem").limit(limit);
      if (error) throw error;
      items = (data ?? []).map((v) => ({
        id: v.id, atual: v.copy_lib_id,
        subject: { titulo: `${String(v.ordem).padStart(2, "0")} ${v.angulo}${v.headline ? ` — ${v.headline}` : ""}`, texto: v.texto || v.angulo, contexto: v.hipotese },
      }));
    } else {
      let q = sb.from("imphq_referencias").select("id, titulo, transcricao, notas, project_id").not("transcricao", "is", null).neq("transcricao", "").order("created_at", { ascending: false }).limit(limit);
      if (body?.project_id) q = q.eq("project_id", String(body.project_id));
      const { data, error } = await q;
      if (error) throw error;
      items = (data ?? []).map((r) => ({ id: r.id, atual: null, subject: { titulo: r.titulo, texto: r.transcricao ?? "", contexto: r.notas } }));
    }

    const results: Array<Record<string, unknown>> = [];
    let tokens = 0;
    let falhas = 0;
    for (let i = 0; i < items.length; i += 5) {
      if (falhas >= 3) { results.push({ erro: "parou após 3 falhas seguidas da API" }); break; }
      const chunk = items.slice(i, i + 5);
      const settled = await Promise.allSettled(chunk.map((it) => askJev(angleRequest(it.subject, library))));
      settled.forEach((s, k) => {
        const it = chunk[k];
        if (s.status === "rejected") { falhas++; results.push({ id: it.id, titulo: it.subject.titulo, erro: String(s.reason).slice(0, 200) }); return; }
        falhas = 0;
        tokens += Number(s.value.usage?.input_tokens ?? 0);
        const v = parseAngleAnswer(s.value as Parameters<typeof parseAngleAnswer>[0]);
        const nome = (id: string | null) => library.find((l) => l.id === id)?.nome ?? null;
        results.push({ id: it.id, titulo: it.subject.titulo, atual: it.atual, atual_nome: nome(it.atual), jev: v.copy_lib_id, jev_nome: nome(v.copy_lib_id), confianca: v.confianca, decisao: v.decisao, camada: v.camada, alternativas: v.alternativas.map((a) => ({ ...a, nome: nome(a.id) })) });
      });
    }

    let gravados = 0;
    if (gravar && modo === "variants") {
      for (const r of results) {
        if (r.decisao !== "firme" || r.atual || !r.jev) continue;
        const { error } = await sb.from("imphq_test_variants").update({ copy_lib_id: r.jev }).eq("id", String(r.id)).is("copy_lib_id", null);
        if (!error) gravados++;
      }
    }
    return json({ ok: true, modo, itens: results.length, gravados, tokens, custo_usd: Math.round(tokens * 0.042e-6 * 1e6) / 1e6, results });
  } catch (e) {
    console.error("[jev-classify]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

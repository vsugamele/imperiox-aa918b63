// Mineração diária de referências (REF2.2): Biblioteca de Anúncios da Meta via Apify (apify/facebook-ads-scraper).
// Para cada fonte ativa (palavra, página ou URL), pega os anúncios há mais tempo no ar e com mais variações, baixa a
// mídia para o Storage (o link do Facebook expira) e grava na biblioteca já com o projeto. O ref-pipeline faz o resto.
// Modos: "run" (cron diário), "source" (uma fonte agora), "probe" (formato cru, sem gravar).
// Anti-loop e custo: até 6 fontes por rodada, até 50 anúncios por fonte, para após 3 falhas seguidas do Apify.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { libraryUrl, mapAd, pickAds, refNotes, type MinedAd } from "../_shared/ad-mining.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APIFY_TOKEN = Deno.env.get("APIFY_TOKEN");
const ACTOR = "apify~facebook-ads-scraper";
const MAX_SOURCES = 6;
const MAX_IMAGE = 8 * 1024 * 1024;
const MAX_VIDEO = 20 * 1024 * 1024;

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const makeClient = () => createClient(SUPABASE_URL, SERVICE_KEY);
type Sb = ReturnType<typeof makeClient>;

interface Source { id: string; project_id: string; tipo: string; valor: string; pais: string; limite: number; min_dias: number }

async function runActor(url: string, limit: number): Promise<unknown[]> {
  const r = await fetch(`https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&timeout=110`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ startUrls: [{ url }], resultsLimit: limit }),
  });
  if (!r.ok) throw new Error(`apify ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  return Array.isArray(d) ? d : [];
}

/** Baixa a mídia e guarda em project-media/referencias (link permanente). */
async function store(sb: Sb, url: string, path: string, max: number): Promise<string | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const type = r.headers.get("content-type") || "application/octet-stream";
    const size = Number(r.headers.get("content-length") || 0);
    if (size > max) return null;
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (bytes.length > max) return null;
    const ext = type.includes("mp4") || type.includes("video") ? "mp4" : type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
    const { error } = await sb.storage.from("project-media").upload(`${path}.${ext}`, bytes, { contentType: type, upsert: true });
    if (error) return null;
    return sb.storage.from("project-media").getPublicUrl(`${path}.${ext}`).data.publicUrl;
  } catch { return null; }
}

async function saveAd(sb: Sb, ad: MinedAd, src: Source, lote: string) {
  const base = `referencias/meta-${ad.external_id}`;
  const isVideo = !!ad.video_url;
  const media = isVideo ? await store(sb, String(ad.video_url), base, MAX_VIDEO) : null;
  const image = ad.imagem_url ? await store(sb, ad.imagem_url, `${base}-img`, MAX_IMAGE) : ad.preview_url ? await store(sb, ad.preview_url, `${base}-capa`, MAX_IMAGE) : null;
  if (!media && !image) return { ok: false, motivo: "mídia não baixou" };
  const row = {
    id: `meta-${ad.external_id}`,
    project_id: src.project_id,
    tipo: media ? "video" : "criativo",
    titulo: `${ad.pagina} — ${(ad.titulo || ad.copy || "anúncio").slice(0, 90)}`,
    url: media ?? ad.biblioteca_url,
    image_url: image,
    notas: refNotes(ad),
    plataforma: "Meta Ads",
    fonte: "meta-ads-library",
    external_id: ad.external_id,
    lote,
    transcribe_status: "idle",
    pipeline: { mineracao: { fonte_id: src.id, busca: `${src.tipo}:${src.valor}`, pais: src.pais, pagina: ad.pagina, pagina_id: ad.pagina_id, inicio: ad.inicio, dias_no_ar: ad.dias_no_ar, variacoes: ad.variacoes, ativo: ad.ativo, biblioteca_url: ad.biblioteca_url, destino: ad.link } },
  };
  const { error } = await sb.from("imphq_referencias").insert(row);
  if (error) return { ok: false, motivo: error.code === "23505" ? "já existia" : error.message };
  return { ok: true, id: row.id, tipo: row.tipo, dias: ad.dias_no_ar, variacoes: ad.variacoes };
}

async function mineSource(sb: Sb, src: Source) {
  const url = libraryUrl(src.tipo, src.valor, src.pais);
  const ads = (await runActor(url, Math.min(50, Math.max(src.limite * 2, 10)))).map((i) => mapAd(i)).filter((a): a is MinedAd => !!a);
  const { data: have } = await sb.from("imphq_referencias").select("external_id").in("external_id", ads.map((a) => a.external_id));
  const picked = pickAds(ads, new Set((have ?? []).map((h: { external_id: string }) => h.external_id)), src.limite, src.min_dias);
  const lote = `mineracao-${new Date().toISOString().slice(0, 10)}`;
  const salvos = [];
  for (const ad of picked) salvos.push(await saveAd(sb, ad, src, lote));
  const resultado = { em: new Date().toISOString(), encontrados: ads.length, escolhidos: picked.length, gravados: salvos.filter((s) => s.ok).length, falhas: salvos.filter((s) => !s.ok).map((s) => s.motivo).slice(0, 5) };
  await sb.from("imphq_mining_sources").update({ ultima_execucao: resultado.em, ultimo_resultado: resultado }).eq("id", src.id);
  return { fonte: `${src.tipo}:${src.valor}`, ...resultado };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!APIFY_TOKEN) return json({ error: "APIFY_TOKEN ausente" }, 500);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const modo = String(body?.modo ?? "run");
    const sb = makeClient();

    if (modo === "probe") {
      const url = libraryUrl(String(body.tipo ?? "palavra"), String(body.valor ?? "detox"), String(body.pais ?? "BR"));
      const ads = (await runActor(url, Math.min(5, Number(body.limite) || 2))).map((i) => mapAd(i)).filter(Boolean);
      return json({ ok: true, url, anuncios: ads });
    }

    let q = sb.from("imphq_mining_sources").select("id, project_id, tipo, valor, pais, limite, min_dias").eq("ativo", true);
    if (modo === "source") {
      if (!body?.source_id) return json({ error: "source_id é obrigatório" }, 400);
      q = q.eq("id", String(body.source_id));
    } else {
      // Rodada diária: as fontes que não rodaram nas últimas 20h, as mais antigas primeiro.
      q = q.or(`ultima_execucao.is.null,ultima_execucao.lt.${new Date(Date.now() - 20 * 3_600_000).toISOString()}`).order("ultima_execucao", { ascending: true, nullsFirst: true });
    }
    const { data: sources, error } = await q.limit(MAX_SOURCES);
    if (error) throw error;

    const out: Array<Record<string, unknown>> = [];
    let falhas = 0;
    for (const src of (sources ?? []) as Source[]) {
      if (falhas >= 3) { out.push({ parou: "3 falhas seguidas do Apify" }); break; }
      try { out.push(await mineSource(sb, src)); falhas = 0; } catch (e) {
        falhas++;
        const msg = e instanceof Error ? e.message : String(e);
        await sb.from("imphq_mining_sources").update({ ultima_execucao: new Date().toISOString(), ultimo_resultado: { erro: msg } }).eq("id", src.id);
        out.push({ fonte: `${src.tipo}:${src.valor}`, erro: msg });
      }
    }
    return json({ ok: true, modo, fontes: out.length, resultados: out });
  } catch (e) {
    console.error("[ref-mining]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

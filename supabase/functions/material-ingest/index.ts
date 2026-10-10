// material-ingest — porta única Telegram/WhatsApp → bibliotecas do HQ + RAG.
// Classifica o material, descarta lixo (1 linha) e persiste o restante:
//   site URL  → imphq_sites (print + branding + copy) + swipe (blocos) + RAG
//   vídeo     → imphq_swipes (transcrição + engenharia reversa) + referência
//   imagem    → imphq_referencias
//   documento → RAG se útil
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireUser } from "../_shared/require-auth.ts";
import { callAiChat } from "../_shared/ai-call.ts";
import { getCachedEmbedding } from "../_shared/embeddings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-ingest-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
const INGEST_SECRET = Deno.env.get("MATERIAL_INGEST_SECRET") || "";
const INGEST_USER_ID = Deno.env.get("MATERIAL_INGEST_USER_ID") || "";
const SIGNED_TTL = 60 * 60 * 24 * 365;
const MAX_VIDEO_BYTES = 24 * 1024 * 1024;

const SOCIAL_HOST = /(instagram\.com|tiktok\.com|facebook\.com|fb\.watch|youtube\.com|youtu\.be|x\.com|twitter\.com|vimeo\.com)/i;
const VIDEO_EXT = /\.(mp4|mov|webm|m4v)(\?|$)/i;
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp)(\?|$)/i;
const DOC_EXT = /\.(pdf|docx?|txt|md|rtf)(\?|$)/i;

type Kind = "site" | "video" | "video_social" | "image" | "document" | "copy" | "junk";

interface IngestBody {
  url?: string;
  text?: string;
  title?: string;
  media_type?: string;
  media_url?: string;
  mime?: string;
  filename?: string;
  project_id?: string | null;
  source?: string;
  user_id?: string;
  force_kind?: Kind;
  action?: string;
  transcript?: string;
  thumbs?: string[];
  thumb_paths?: string[];
  storage_path?: string;
  upload_bucket?: string;
  upload_ext?: string;
  referencia_id?: string;
  duracao?: number;
  plataforma?: string;
  caption?: string;
  analise?: Record<string, unknown>;
  quadros?: Array<{ seconds?: number; path?: string; url?: string }>;
}

interface Verdict {
  useful: boolean;
  score: number;
  kind: Kind;
  reason: string;
  site_tipo?: string;
  title?: string;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractUrls(text: string): string[] {
  return Array.from(text.matchAll(/https?:\/\/[^\s)\]>'"]+/gi)).map((m) => m[0].replace(/[.,;]+$/, ""));
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function guessKind(body: IngestBody): Kind {
  if (body.force_kind) return body.force_kind;
  const mime = (body.mime || "").toLowerCase();
  const mt = (body.media_type || "").toLowerCase();
  const name = (body.filename || body.media_url || body.url || "").toLowerCase();
  if (mt === "image" || mime.startsWith("image/") || IMAGE_EXT.test(name)) return "image";
  if (mt === "video" || mime.startsWith("video/") || VIDEO_EXT.test(name)) return "video";
  if (mt === "document" || mime.includes("pdf") || DOC_EXT.test(name)) return "document";
  const url = body.url || body.media_url || "";
  if (url && SOCIAL_HOST.test(hostOf(url))) {
    if (VIDEO_EXT.test(url)) return "video";
    return "video_social";
  }
  if (url) return "site";
  const text = (body.text || "").trim();
  if (text.length >= 400) return "copy";
  if (text.length < 40 && !url) return "junk";
  return text ? "document" : "junk";
}

async function resolveUserId(req: Request, body: IngestBody): Promise<{ ok: true; userId: string } | { ok: false; response: Response }> {
  const secret = req.headers.get("x-ingest-secret") || "";
  if (INGEST_SECRET && secret && secret === INGEST_SECRET) {
    const uid = body.user_id || INGEST_USER_ID;
    if (uid) return { ok: true, userId: uid };
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data } = await admin.from("imphq_sites").select("user_id").limit(1);
    const fallback = data?.[0]?.user_id;
    if (fallback) return { ok: true, userId: fallback };
    return { ok: false, response: json({ error: "user_id obrigatório no ingest por secret" }, 400) };
  }
  const auth = await requireUser(req);
  if (!auth.ok) return auth;
  return { ok: true, userId: auth.userId };
}

function chunkText(text: string, size = 1200, overlap = 150): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length < 80) return clean.length ? [clean] : [];
  if (clean.length <= size) return [clean];
  const out: string[] = [];
  let i = 0;
  while (i < clean.length) {
    const slice = clean.slice(i, i + size).trim();
    if (slice.length > 40) out.push(slice);
    i += size - overlap;
  }
  return out;
}

function decodeDataUrl(raw: string): { buf: Uint8Array; contentType: string; ext: string } | null {
  if (!raw.startsWith("data:")) return null;
  const comma = raw.indexOf(",");
  if (comma < 0) return null;
  const header = raw.slice(5, comma);
  const payload = raw.slice(comma + 1);
  const parts = header.split(";");
  const ct = parts[0] || "application/octet-stream";
  const isB64 = parts.some((p) => p.trim().toLowerCase() === "base64");
  let buf: Uint8Array;
  if (isB64) {
    const bin = atob(payload);
    buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  } else {
    buf = new TextEncoder().encode(decodeURIComponent(payload));
  }
  const ext = ct.includes("png")
    ? "png"
    : ct.includes("webp")
    ? "webp"
    : ct.includes("gif")
    ? "gif"
    : ct.includes("mp4")
    ? "mp4"
    : "jpg";
  return { buf, contentType: ct, ext };
}

async function persistBytes(
  admin: SupabaseClient,
  bucket: string,
  path: string,
  buf: Uint8Array,
  contentType: string,
): Promise<string | null> {
  const { error } = await admin.storage.from(bucket).upload(path, buf, { contentType, upsert: false });
  if (error) {
    console.error("[material-ingest] upload", bucket, error.message);
    return null;
  }
  const { data } = await admin.storage.from(bucket).createSignedUrl(path, SIGNED_TTL);
  return data?.signedUrl || null;
}

async function signedFor(admin: SupabaseClient, bucket: string, path: string): Promise<string | null> {
  const { data } = await admin.storage.from(bucket).createSignedUrl(path, SIGNED_TTL);
  return data?.signedUrl || null;
}

async function signQuadros(
  admin: SupabaseClient,
  raw: Array<{ seconds?: number; path?: string; url?: string }> | undefined,
  fallbackUrls: string[] = [],
): Promise<Array<{ seconds: number; url: string }>> {
  const out: Array<{ seconds: number; url: string }> = [];
  if (raw && raw.length) {
    for (let i = 0; i < raw.length; i++) {
      const q = raw[i];
      const url = q.url || (q.path ? await signedFor(admin, "site-thumbs", q.path) : null);
      if (!url) continue;
      out.push({ seconds: Number(q.seconds ?? i), url });
    }
    return out;
  }
  return fallbackUrls.map((url, i) => ({ seconds: i * 2, url }));
}

async function persistUserFile(
  admin: SupabaseClient,
  userId: string,
  rawUrl: string,
  bucket: string,
  fallbackExt: string,
): Promise<{ url: string; path: string } | null> {
  if (!rawUrl) return null;
  const decoded = decodeDataUrl(rawUrl);
  if (decoded) {
    const path = `${userId}/${crypto.randomUUID()}.${decoded.ext}`;
    const url = await persistBytes(admin, bucket, path, decoded.buf, decoded.contentType);
    return url ? { url, path } : null;
  }
  try {
    const resp = await fetch(rawUrl);
    if (!resp.ok) return null;
    const buf = new Uint8Array(await resp.arrayBuffer());
    const ct = resp.headers.get("content-type") || "application/octet-stream";
    const ext = ct.includes("mp4") ? "mp4" : ct.includes("webm") ? "webm" : ct.includes("jpeg") ? "jpg" : ct.includes("png") ? "png" : fallbackExt;
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const url = await persistBytes(admin, bucket, path, buf, ct);
    return url ? { url, path } : null;
  } catch {
    return null;
  }
}

async function persistRemoteFile(
  admin: SupabaseClient,
  userId: string,
  rawUrl: string,
  bucket: string,
  folder: string,
  fallbackExt: string,
): Promise<string | null> {
  if (!rawUrl) return null;
  const decoded = decodeDataUrl(rawUrl);
  if (decoded) {
    const path = `${folder}/${userId}/${crypto.randomUUID()}.${decoded.ext}`;
    return persistBytes(admin, bucket, path, decoded.buf, decoded.contentType);
  }
  try {
    const resp = await fetch(rawUrl);
    if (!resp.ok) return rawUrl;
    const buf = new Uint8Array(await resp.arrayBuffer());
    const ct = resp.headers.get("content-type") || "application/octet-stream";
    const ext = ct.includes("jpeg") ? "jpg" : ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : fallbackExt;
    const path = `${folder}/${userId}/${crypto.randomUUID()}.${ext}`;
    return (await persistBytes(admin, bucket, path, buf, ct)) || rawUrl;
  } catch {
    return rawUrl;
  }
}

async function scrapeSite(url: string, userId: string, admin: SupabaseClient) {
  if (!FIRECRAWL_KEY) throw new Error("Firecrawl não configurado");
  const formatted = url.startsWith("http") ? url : `https://${url}`;
  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url: formatted,
      formats: ["markdown", "screenshot", "branding", "summary"],
      onlyMainContent: true,
    }),
  });
  const jsonBody = await res.json();
  if (!res.ok) throw new Error(jsonBody.error || `Firecrawl ${res.status}`);
  const data = jsonBody.data || jsonBody;
  const shot = data?.screenshot
    ? await persistRemoteFile(admin, userId, data.screenshot, "site-thumbs", "sites", "png")
    : null;
  return {
    url: formatted,
    title: data?.metadata?.title || formatted,
    screenshot: shot,
    branding: data?.branding || null,
    summary: data?.summary || null,
    markdown: data?.markdown || null,
  };
}

async function evaluateUtility(kind: Kind, sample: string, url?: string): Promise<Verdict> {
  const heuristicJunk =
    kind === "junk" ||
    (!url && sample.trim().length < 40) ||
    /^ok+|teste+|kk+|haha+|👍+$/i.test(sample.trim());
  if (heuristicJunk && sample.trim().length < 40 && !url) {
    return { useful: false, score: 0, kind: "junk", reason: "sem conteúdo útil" };
  }
  try {
    const { content } = await callAiChat({
      model: "google/gemini-2.5-flash",
      json: true,
      tag: "material-ingest-eval",
      timeoutMs: 25_000,
      messages: [
        {
          role: "system",
          content:
            "Você avalia material de marketing (LP, VSL, criativo, copy, doc). JSON only: {useful:boolean, score:0-5, kind:site|video|video_social|image|document|copy|junk, reason:string curta PT-BR, site_tipo?:lp|vsl|checkout|captura|obrigado|outro, title?:string}. Lixo = print aleatório, link morto, meme, PDF vazio, conversa sem copy. useful=false se score<2.",
        },
        {
          role: "user",
          content: `kind_hint=${kind}\nurl=${url || ""}\n trecho:\n${sample.slice(0, 6000)}`,
        },
      ],
    });
    const parsed = JSON.parse(content || "{}");
    const k = (parsed.kind || kind) as Kind;
    const score = Number(parsed.score ?? 0);
    const useful = parsed.useful !== false && score >= 2 && k !== "junk";
    return {
      useful,
      score,
      kind: useful ? k : "junk",
      reason: parsed.reason || (useful ? "útil" : "sem valor de referência"),
      site_tipo: parsed.site_tipo,
      title: parsed.title,
    };
  } catch (e) {
    console.warn("[material-ingest] eval fallback", e);
    if (kind === "junk") return { useful: false, score: 0, kind: "junk", reason: "sem conteúdo útil" };
    return { useful: true, score: 3, kind, reason: "aceito por heurística (eval IA falhou)" };
  }
}

async function aiJson(system: string, user: string, tag: string) {
  const { content } = await callAiChat({
    model: "google/gemini-2.5-flash",
    json: true,
    tag,
    timeoutMs: 60_000,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return JSON.parse(content || "{}");
}

async function extractSwipe(rawText: string, titleHint: string) {
  const wc = rawText.trim().split(/\s+/).length;
  const vsl = wc >= 1200;
  const extracted = await aiJson(
    "Disseca copy de marketing direto. JSON only, sem markdown.",
    `Quebre a copy. Se VSL (${vsl}) use blocks.__schema=vsl7 com b1_gancho…b7_garantia_cta (texto literal). Senão short6: gancho, participacao_ativa, narrativa, reframe, cta_engajamento, cta_venda.
Campos: title, criador, plataforma, formato, mecanismo, gatilhos[], blocks{}.
Título hint: ${titleHint}
COPY:
"""${rawText.slice(0, vsl ? 28000 : 8000)}"""`,
    "material-ingest-swipe",
  );
  const blocks = extracted.blocks || {};
  if (!blocks.__schema) blocks.__schema = vsl ? "vsl7" : "short6";
  return {
    title: extracted.title || titleHint || "Copy importada",
    criador: extracted.criador || null,
    plataforma: extracted.plataforma || null,
    formato: extracted.formato || (vsl ? "VSL" : null),
    mecanismo: extracted.mecanismo || null,
    gatilhos: Array.isArray(extracted.gatilhos) ? extracted.gatilhos : [],
    blocks,
    raw_text: rawText.slice(0, 30000),
  };
}

async function reverseEngineer(swipe: { title: string; formato?: string | null; mecanismo?: string | null; plataforma?: string | null; blocks: any; raw_text?: string | null }) {
  const isVsl = swipe.blocks?.__schema === "vsl7" || (swipe.formato || "").toLowerCase() === "vsl";
  const reverse = await aiJson(
    "Engenheiro reverso de copy. JSON only, estruturas reutilizáveis.",
    `Schema ${isVsl ? "vsl7 (promessa_central, publico_alvo, mecanismo_unico, esqueleto_vsl7, gatilhos, tom_voz)" : "short6 (formula_nome, esqueleto{gancho,participacao_ativa,narrativa,reframe,cta_engajamento,cta_venda}, gatilhos, tom_voz)"}.
Título: ${swipe.title}
Mecanismo: ${swipe.mecanismo || "n/a"}
Blocos: ${JSON.stringify(swipe.blocks).slice(0, 12000)}
Amostra: ${(swipe.raw_text || "").slice(0, 8000)}`,
    "material-ingest-reverse",
  );
  reverse.__schema = isVsl ? "vsl7" : "short6";
  return reverse;
}

async function transcribeVideoUrl(videoUrl: string): Promise<string> {
  if (!LOVABLE_KEY) throw new Error("LOVABLE_API_KEY ausente");
  const dl = await fetch(videoUrl);
  if (!dl.ok) throw new Error(`download vídeo ${dl.status}`);
  const buf = new Uint8Array(await dl.arrayBuffer());
  if (buf.byteLength > MAX_VIDEO_BYTES) {
    throw new Error(`Arquivo ${(buf.byteLength / 1024 / 1024).toFixed(1)}MB excede 24MB`);
  }
  const ct = dl.headers.get("content-type") || "video/mp4";
  const file = new Blob([buf], { type: ct });
  const ext = (videoUrl.split("?")[0].split(".").pop() || "mp4").toLowerCase();
  const safeExt = ["mp3", "mp4", "wav", "webm", "m4a", "ogg"].includes(ext) ? ext : "mp4";
  const form = new FormData();
  form.append("model", "openai/gpt-4o-mini-transcribe");
  form.append("file", file, `recording.${safeExt}`);
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_KEY}` },
    body: form,
  });
  if (!resp.ok) throw new Error(`transcrição ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const j = await resp.json();
  return j.text || "";
}

async function indexRag(
  admin: SupabaseClient,
  opts: {
    project_id: string | null;
    source_type: string;
    source_id: string;
    content: string;
    metadata: Record<string, unknown>;
  },
) {
  const chunks = chunkText(opts.content);
  for (let i = 0; i < chunks.length; i++) {
    const embedding = await getCachedEmbedding(admin, chunks[i]);
    await admin.from("imphq_rag_chunks").delete()
      .eq("source_type", opts.source_type)
      .eq("source_id", opts.source_id)
      .eq("chunk_index", i);
    const { error } = await admin.from("imphq_rag_chunks").insert({
      project_id: opts.project_id,
      source_type: opts.source_type,
      source_id: opts.source_id,
      chunk_index: i,
      content: chunks[i],
      embedding: embedding as any,
      metadata: { ...opts.metadata, chunk: i },
    });
    if (error) console.error("[material-ingest] rag insert", error.message);
  }
  return chunks.length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json().catch(() => ({}))) as IngestBody;
    const auth = await resolveUserId(req, body);
    if (!auth.ok) return auth.response;
    const userId = auth.userId;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const projectId = body.project_id || null;
    const source = body.source || "channel";

    if (body.action === "signed-upload") {
      const bucket = body.upload_bucket === "site-thumbs" ? "site-thumbs" : "swipe-media";
      const ext = (body.upload_ext || "mp4").replace(/[^a-z0-9]/gi, "") || "mp4";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path);
      if (error) throw error;
      return json({ ok: true, bucket, path, token: data.token, signed_url: data.signedUrl });
    }

    if (body.action === "audit-bloat") {
      const { data, error } = await admin.from("imphq_referencias")
        .select("id,titulo,created_at,tipo")
        .or("image_url.like.data:%,url.like.data:%");
      if (error) throw error;
      return json({ ok: true, count: (data || []).length, rows: data || [] });
    }

    if (body.action === "patch-analise") {
      const id = body.referencia_id;
      if (!id) return json({ ok: false, error: "referencia_id" }, 400);
      const quadros = await signQuadros(admin, body.quadros);
      const patch: Record<string, unknown> = {};
      if (body.analise) patch.analise = body.analise;
      if (quadros.length) {
        patch.quadros = quadros;
        patch.image_url = quadros[0].url;
      }
      if (body.duracao != null) patch.duracao = body.duracao;
      if (body.plataforma) patch.plataforma = body.plataforma;
      if (body.transcript) {
        patch.transcricao = body.transcript;
        patch.transcribe_status = "done";
      }
      if (body.title) patch.titulo = body.title;
      if (body.caption) patch.notas = body.caption.slice(0, 2000);
      if (!Object.keys(patch).length) return json({ ok: false, error: "nada pra patch" }, 400);
      const { error } = await admin.from("imphq_referencias").update(patch).eq("id", id);
      if (error) throw error;
      return json({ ok: true, id, landed: ["Referências"], ids: { referencia_id: id }, frames: quadros.length });
    }

    if (body.action === "relink-image") {
      const id = body.referencia_id;
      const path = body.storage_path;
      if (!id || !path) return json({ ok: false, error: "referencia_id e storage_path" }, 400);
      if (path.includes("..") || path.startsWith("/")) return json({ ok: false, error: "path inválido" }, 400);
      const bucket = body.upload_bucket === "swipe-media" ? "swipe-media" : "site-thumbs";
      const signed = await signedFor(admin, bucket, path);
      if (!signed || signed.startsWith("data:")) throw new Error("signed url falhou");
      const { error } = await admin.from("imphq_referencias").update({
        image_url: signed,
        url: signed,
      }).eq("id", id);
      if (error) throw error;
      await admin.from("imphq_rag_chunks").update({
        metadata: { image_url: signed },
      }).eq("source_type", "referencia").eq("source_id", id);
      return json({ ok: true, id, stored: true });
    }

    let url = (body.url || "").trim();
    const text = (body.text || "").trim();
    if (!url) {
      const found = extractUrls(text);
      if (found[0]) url = found[0];
    }
    if (url && !url.startsWith("http")) url = `https://${url}`;

    const kindHint = guessKind({ ...body, url: url || body.media_url });
    const sample = [body.title, url, body.filename, text, body.media_url].filter(Boolean).join("\n");
    const skipEval = ["video", "video_social", "image"].includes(kindHint) || !!body.storage_path || !!body.transcript;
    const verdict = skipEval
      ? { useful: true, score: 4, kind: kindHint, reason: "mídia", title: body.title }
      : await evaluateUtility(kindHint, sample, url || body.media_url);
    if (!verdict.useful) {
      return json({
        discarded: true,
        reason: verdict.reason,
        notice: `Descartado: ${verdict.reason}`,
      });
    }

    let kind = verdict.kind === "junk" ? kindHint : verdict.kind;
    if (kind === "video_social" && (body.storage_path || body.transcript || (body.media_url && VIDEO_EXT.test(body.media_url)))) {
      kind = "video";
    }
    const landed: string[] = [];
    const ids: Record<string, string> = {};
    let needsFile = false;
    let title = verdict.title || body.title || url || body.filename || "Material";

    // ── SITE ──────────────────────────────────────────────────────────
    if (kind === "site" && url) {
      const scraped = await scrapeSite(url, userId, admin);
      title = scraped.title || title;
      const tipo = verdict.site_tipo || "lp";
      const { data: site, error } = await admin.from("imphq_sites").insert({
        user_id: userId,
        titulo: title,
        url: scraped.url,
        tipo,
        status: "ativo",
        thumbnail_url: scraped.screenshot,
        branding_json: scraped.branding,
        content_md: scraped.markdown,
        summary: scraped.summary,
        tags: [source, "ingest"],
        last_scraped_at: new Date().toISOString(),
      }).select("id").single();
      if (error) throw error;
      ids.site_id = site.id;
      landed.push("Sites");

      const md = (scraped.markdown || scraped.summary || "").trim();
      if (md.length >= 80) {
        const swipe = await extractSwipe(md, title);
        const reverse = await reverseEngineer(swipe);
        const { data: sw, error: sErr } = await admin.from("imphq_swipes").insert({
          user_id: userId,
          project_id: projectId,
          title: swipe.title,
          criador: swipe.criador,
          plataforma: swipe.plataforma || "LP",
          formato: swipe.formato || (tipo === "vsl" ? "VSL" : "LP"),
          mecanismo: swipe.mecanismo,
          gatilhos: swipe.gatilhos,
          blocks: swipe.blocks,
          raw_text: swipe.raw_text,
          source_url: scraped.url,
          reverse_engineering: reverse,
          media_type: "site",
          tags: [source, "site-template"],
        }).select("id").single();
        if (sErr) throw sErr;
        ids.swipe_id = sw.id;
        landed.push("Swipe");
        await indexRag(admin, {
          project_id: projectId,
          source_type: "site",
          source_id: site.id,
          content: `# ${title}\n${scraped.summary || ""}\n\n${md}`.slice(0, 20000),
          metadata: { url: scraped.url, tipo, swipe_id: sw.id },
        });
        landed.push("RAG");
      }
    }

    // ── VÍDEO (arquivo persistido + prints + transcrição) ─────────────
    else if (kind === "video") {
      const original = body.media_url || url;
      let storedVideo: string | null = null;
      let storedPath = body.storage_path || "";
      if (storedPath) {
        storedVideo = await signedFor(admin, "swipe-media", storedPath);
      } else if (original && (VIDEO_EXT.test(original) || (body.media_type || "").startsWith("video"))) {
        const saved = await persistUserFile(admin, userId, original, "swipe-media", "mp4");
        if (saved) {
          storedVideo = saved.url;
          storedPath = saved.path;
        }
      }
      const playUrl = storedVideo || original;
      if (!playUrl && !storedPath) {
        return json({ discarded: true, reason: "vídeo sem arquivo", notice: "Descartado: vídeo sem arquivo" });
      }

      const thumbUrls: string[] = [];
      for (const p of body.thumb_paths || []) {
        const u = await signedFor(admin, "site-thumbs", p);
        if (u) thumbUrls.push(u);
      }
      for (const t of body.thumbs || []) {
        const saved = await persistUserFile(admin, userId, t, "site-thumbs", "jpg");
        if (saved?.url && !saved.url.startsWith("data:")) thumbUrls.push(saved.url);
      }
      const cover = thumbUrls[0] || null;

      let transcript = (body.transcript || "").trim();
      let transcribe_status = transcript ? "done" : "pending";
      let transcribe_error: string | null = null;
      if (!transcript && playUrl) {
        try {
          transcript = await transcribeVideoUrl(playUrl);
          transcribe_status = transcript ? "done" : "error";
        } catch (e: any) {
          transcribe_error = e?.message || "transcribe failed";
          transcribe_status = "error";
        }
      }

      const swipeData = transcript.length >= 80
        ? await extractSwipe(transcript, title)
        : {
          title,
          criador: null,
          plataforma: null,
          formato: "Reel",
          mecanismo: null,
          gatilhos: [],
          blocks: { __schema: "short6", narrativa: transcript },
          raw_text: transcript,
        };
      const reverse = transcript.length >= 80 ? await reverseEngineer(swipeData) : {};
      const mediaUrls = [storedPath || playUrl, ...thumbUrls].filter(Boolean);
      const { data: sw, error } = await admin.from("imphq_swipes").insert({
        user_id: userId,
        project_id: projectId,
        title: swipeData.title,
        criador: swipeData.criador,
        plataforma: swipeData.plataforma,
        formato: swipeData.formato || "Reel",
        mecanismo: swipeData.mecanismo,
        gatilhos: swipeData.gatilhos,
        blocks: swipeData.blocks,
        raw_text: swipeData.raw_text,
        source_url: url || original || null,
        video_url: playUrl,
        thumb_url: cover,
        media_urls: mediaUrls,
        reverse_engineering: reverse,
        media_type: "video",
        transcribe_status,
        transcribe_error,
        tags: [source, "video"],
      }).select("id").single();
      if (error) throw error;
      ids.swipe_id = sw.id;
      landed.push("Swipe");

      const quadros = await signQuadros(admin, body.quadros, thumbUrls);
      const analise = body.analise || null;
      const { data: ref } = await admin.from("imphq_referencias").insert({
        id: crypto.randomUUID(),
        titulo: swipeData.title,
        tipo: "video",
        url: playUrl || original,
        image_url: cover || quadros[0]?.url || null,
        project_id: projectId,
        tags: [source, "ingest", "video"],
        plataforma: body.plataforma || swipeData.plataforma || null,
        duracao: body.duracao ?? null,
        quadros: quadros.length ? quadros : null,
        analise,
        fonte: analise ? "ingest" : null,
        notas: [
          body.caption ? String(body.caption).slice(0, 500) : null,
          transcript ? `transcrição ${transcript.length} chars` : transcribe_error,
          storedPath ? `vídeo salvo` : null,
          quadros.length ? `${quadros.length} prints` : null,
          analise ? "dissecado" : null,
        ].filter(Boolean).join(" · "),
        transcricao: transcript || null,
        transcribe_status,
        transcribe_error,
      }).select("id").single();
      if (ref) {
        ids.referencia_id = ref.id;
        landed.push("Referências");
      }
      if (transcript.length >= 80) {
        await indexRag(admin, {
          project_id: projectId,
          source_type: "swipe",
          source_id: sw.id,
          content: `# ${swipeData.title}\n${transcript}\n\n${JSON.stringify(reverse).slice(0, 4000)}`,
          metadata: { video_url: playUrl, thumbs: thumbUrls.length },
        });
        landed.push("RAG");
      }
    }

    // ── VÍDEO SOCIAL sem arquivo (fallback; o agente deve baixar antes) ─
    else if (kind === "video_social" && url) {
      needsFile = true;
      const { data: ref, error } = await admin.from("imphq_referencias").insert({
        id: crypto.randomUUID(),
        titulo: title,
        tipo: "video",
        url,
        project_id: projectId,
        tags: [source, "social", hostOf(url).replace("www.", "")],
        notas: "Link social salvo. Download local falhou — manda o arquivo do vídeo.",
        transcribe_status: "needs_file",
      }).select("id").single();
      if (error) throw error;
      ids.referencia_id = ref.id;
      landed.push("Referências");
    }

    // ── IMAGEM ────────────────────────────────────────────────────────
    else if (kind === "image") {
      const src = body.media_url || url;
      let stored: string | null = null;
      if (body.storage_path) {
        const bucket = body.upload_bucket === "swipe-media" ? "swipe-media" : "site-thumbs";
        stored = await signedFor(admin, bucket, body.storage_path);
      } else if (src) {
        stored = await persistRemoteFile(admin, userId, src, "site-thumbs", "referencias", "jpg");
      }
      if (!stored || stored.startsWith("data:")) {
        return json({
          discarded: true,
          reason: "falha ao gravar no Storage",
          notice: "Descartado: falha ao gravar imagem no Storage",
        });
      }
      const { data: ref, error } = await admin.from("imphq_referencias").insert({
        id: crypto.randomUUID(),
        titulo: title,
        tipo: "criativo",
        url: stored,
        image_url: stored,
        project_id: projectId,
        tags: [source, "imagem", "ingest"],
        notas: text || null,
      }).select("id").single();
      if (error) throw error;
      ids.referencia_id = ref.id;
      landed.push("Referências");
      const caption = [title, text, verdict.reason].filter(Boolean).join("\n");
      if (caption.length >= 40) {
        await indexRag(admin, {
          project_id: projectId,
          source_type: "referencia",
          source_id: ref.id,
          content: `Imagem/criativo: ${caption}`,
          metadata: { image_url: stored },
        });
        landed.push("RAG");
      }
    }

    // ── COPY COLADA / DOCUMENTO ───────────────────────────────────────
    else if (kind === "copy" || kind === "document") {
      const content = text || "";
      if (content.length < 80 && !url) {
        return json({ discarded: true, reason: "documento vazio", notice: "Descartado: documento vazio" });
      }
      let raw = content;
      if (!raw && url && FIRECRAWL_KEY) {
        try {
          const scraped = await scrapeSite(url, userId, admin);
          raw = scraped.markdown || scraped.summary || "";
          title = scraped.title || title;
        } catch { /* keep raw */ }
      }
      if (raw.length >= 400 || kind === "copy") {
        const swipe = await extractSwipe(raw || title, title);
        const reverse = await reverseEngineer(swipe);
        const { data: sw, error } = await admin.from("imphq_swipes").insert({
          user_id: userId,
          project_id: projectId,
          title: swipe.title,
          criador: swipe.criador,
          plataforma: swipe.plataforma,
          formato: swipe.formato,
          mecanismo: swipe.mecanismo,
          gatilhos: swipe.gatilhos,
          blocks: swipe.blocks,
          raw_text: swipe.raw_text || raw,
          source_url: url || null,
          reverse_engineering: reverse,
          media_type: kind,
          tags: [source, kind],
        }).select("id").single();
        if (error) throw error;
        ids.swipe_id = sw.id;
        landed.push("Swipe");
      }
      if (raw.length >= 80) {
        const sourceId = ids.swipe_id || crypto.randomUUID();
        await indexRag(admin, {
          project_id: projectId,
          source_type: ids.swipe_id ? "swipe" : "documento",
          source_id: sourceId,
          content: `# ${title}\n${raw}`.slice(0, 20000),
          metadata: { url: url || null, filename: body.filename || null },
        });
        landed.push("RAG");
      }
    } else {
      return json({ discarded: true, reason: verdict.reason, notice: `Descartado: ${verdict.reason}` });
    }

    return json({
      ok: true,
      discarded: false,
      kind,
      title,
      landed,
      ids,
      needs_file: needsFile,
      score: verdict.score,
      notice: needsFile
        ? `Salvo em ${landed.join(" + ")}. Manda o arquivo do vídeo (≤24MB) pra transcrever e modelar a copy.`
        : `Salvo em ${landed.join(" + ")}: ${title}`,
    });
  } catch (e: any) {
    console.error("[material-ingest]", e);
    return json({ error: e?.message || "erro" }, 500);
  }
});

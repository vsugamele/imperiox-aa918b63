import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const UA_BOT = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
const UA_BROWSER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

type Preview = { thumb?: string; title?: string; description?: string; author?: string };

// cache em memória (por instância) TTL 1h
const cache = new Map<string, { at: number; data: Preview }>();
const TTL = 60 * 60 * 1000;

function pickMeta(html: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return decodeHtml(m[1].trim());
  }
  return undefined;
}

function decodeHtml(s: string) {
  return s
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x2F;/g, "/");
}

async function fetchWithTimeout(url: string, ms = 6000, headers: Record<string, string> = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      headers: { "User-Agent": UA_BOT, "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8", ...headers },
      signal: ctrl.signal, redirect: "follow",
    });
  } finally { clearTimeout(t); }
}

async function tryOembed(url: string): Promise<Preview | null> {
  const u = url.toLowerCase();
  let endpoint: string | null = null;
  if (u.includes("tiktok.com")) endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
  else if (u.includes("youtube.com") || u.includes("youtu.be")) endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  if (!endpoint) return null;
  try {
    const r = await fetchWithTimeout(endpoint, 5000);
    if (!r.ok) return null;
    const j = await r.json();
    return { thumb: j.thumbnail_url, title: j.title, author: j.author_name ? `@${j.author_name}` : undefined };
  } catch { return null; }
}

async function tryInstagramOembed(url: string): Promise<Preview | null> {
  try {
    const r = await fetchWithTimeout(
      `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(url)}`,
      5000,
      { "User-Agent": UA_BROWSER, "X-IG-App-ID": "936619743392459" },
    );
    if (!r.ok) return null;
    const j = await r.json();
    return {
      thumb: j.thumbnail_url,
      title: j.title,
      author: j.author_name ? `@${j.author_name}` : undefined,
    };
  } catch { return null; }
}

async function tryMicrolink(url: string): Promise<Preview | null> {
  try {
    const r = await fetchWithTimeout(
      `https://api.microlink.io/?url=${encodeURIComponent(url)}&audio=false&video=false&iframe=false`,
      7000,
      { "User-Agent": UA_BROWSER },
    );
    if (!r.ok) return null;
    const j = await r.json();
    if (j.status !== "success") return null;
    const d = j.data || {};
    return {
      thumb: d.image?.url || d.logo?.url,
      title: d.title,
      description: d.description,
      author: d.author,
    };
  } catch { return null; }
}

async function scrapeOg(url: string): Promise<Preview | null> {
  try {
    const r = await fetchWithTimeout(url, 6000);
    if (!r.ok) return null;
    const html = await r.text();
    const thumb = pickMeta(html, [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    ]);
    const title = pickMeta(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
      /<title[^>]*>([^<]+)<\/title>/i,
    ]);
    const description = pickMeta(html, [
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    ]);
    if (!thumb && !title) return null;
    return { thumb, title, description };
  } catch { return null; }
}

function merge(a: Preview, b: Preview | null): Preview {
  if (!b) return a;
  return {
    thumb: a.thumb || b.thumb,
    title: a.title || b.title,
    description: a.description || b.description,
    author: a.author || b.author,
  };
}

async function buildPreview(url: string): Promise<Preview> {
  const isIG = /instagram\.com/i.test(url);
  let out: Preview = {};

  if (isIG) {
    out = merge(out, await tryInstagramOembed(url));
  } else {
    out = merge(out, await tryOembed(url));
  }

  if (!out.thumb) out = merge(out, await scrapeOg(url));
  if (!out.thumb) out = merge(out, await tryMicrolink(url));

  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { url } = req.method === "POST" ? await req.json() : { url: new URL(req.url).searchParams.get("url") };
    if (!url || !/^https?:\/\//i.test(url)) {
      return new Response(JSON.stringify({ error: "invalid url" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const cached = cache.get(url);
    if (cached && Date.now() - cached.at < TTL) {
      return new Response(JSON.stringify(cached.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "HIT" },
      });
    }

    const data = await buildPreview(url);
    cache.set(url, { at: Date.now(), data });

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
    });
  } catch (e: any) {
    console.error("link-preview error", e?.message);
    return new Response(JSON.stringify({ error: e?.message || "failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

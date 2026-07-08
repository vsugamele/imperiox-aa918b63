import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const UA = "Mozilla/5.0 (compatible; WhatsApp/2.23; +https://whatsapp.com)";

function pickMeta(html: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return decodeHtml(m[1].trim());
  }
  return undefined;
}

function decodeHtml(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/g, "/");
}

async function fetchWithTimeout(url: string, ms = 6000, headers: Record<string, string> = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8", ...headers }, signal: ctrl.signal, redirect: "follow" });
  } finally {
    clearTimeout(t);
  }
}

async function tryOembed(url: string): Promise<{ thumb?: string; title?: string; author?: string } | null> {
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

async function scrapeOg(url: string) {
  const r = await fetchWithTimeout(url, 6000);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
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
  return { thumb, title, description };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { url } = req.method === "POST" ? await req.json() : { url: new URL(req.url).searchParams.get("url") };
    if (!url || !/^https?:\/\//i.test(url)) {
      return new Response(JSON.stringify({ error: "invalid url" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. oEmbed (TikTok / YouTube)
    const oe = await tryOembed(url);
    let thumb = oe?.thumb, title = oe?.title, author = oe?.author, description: string | undefined;

    // 2. og scrape (Instagram e outros / complementa)
    if (!thumb || !title) {
      try {
        const og = await scrapeOg(url);
        thumb ||= og.thumb;
        title ||= og.title;
        description = og.description;
      } catch (e) {
        console.log("scrape failed", url, (e as Error).message);
      }
    }

    return new Response(JSON.stringify({ thumb, title, description, author }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
    });
  } catch (e: any) {
    console.error("link-preview error", e?.message);
    return new Response(JSON.stringify({ error: e?.message || "failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

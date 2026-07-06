// Fetches OG/oEmbed preview for a URL. Public endpoint (verify_jwt=false).
// Always returns 200. On failure: { fallback: true, error }.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Preview = {
  title?: string;
  image?: string;
  video?: string;
  site?: string;
  description?: string;
  author?: string;
  fallback?: boolean;
  error?: string;
};

const UA_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const UA_FACEBOOK = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

function pickMeta(html: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return decodeHtml(m[1].trim());
  }
  return undefined;
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/\\u0026/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function metaRegex(prop: string, attr: "property" | "name" = "property"): RegExp {
  return new RegExp(
    `<meta[^>]+${attr}=["']${prop}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
}

async function fetchHtml(url: string, ua = UA_CHROME): Promise<string | null> {
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": ua,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,pt;q=0.8",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Dest": "document",
        "Cache-Control": "no-cache",
      },
      redirect: "follow",
    });
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    const slice = buf.slice(0, 512 * 1024);
    return new TextDecoder("utf-8", { fatal: false }).decode(slice);
  } catch {
    return null;
  }
}

async function tryOembed(oembedUrl: string, extraHeaders: Record<string, string> = {}): Promise<Preview | null> {
  try {
    const r = await fetch(oembedUrl, {
      headers: { "User-Agent": UA_CHROME, Accept: "application/json", ...extraHeaders },
    });
    if (!r.ok) return null;
    const j = await r.json();
    return {
      title: j.title,
      image: j.thumbnail_url,
      site: j.provider_name,
      author: j.author_name,
    };
  } catch {
    return null;
  }
}

function parseOg(html: string): Preview {
  const title =
    pickMeta(html, [metaRegex("og:title"), metaRegex("twitter:title", "name")]) ||
    (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim());
  const image = pickMeta(html, [
    metaRegex("og:image:secure_url"),
    metaRegex("og:image"),
    metaRegex("twitter:image", "name"),
    metaRegex("twitter:image:src", "name"),
  ]);
  const video = pickMeta(html, [
    metaRegex("og:video:secure_url"),
    metaRegex("og:video:url"),
    metaRegex("og:video"),
    metaRegex("twitter:player:stream", "name"),
  ]);
  const description = pickMeta(html, [
    metaRegex("og:description"),
    metaRegex("description", "name"),
    metaRegex("twitter:description", "name"),
  ]);
  const site = pickMeta(html, [metaRegex("og:site_name")]);
  return { title, image, video, description, site };
}

// Extract image from Instagram embedded JSON when og:image is missing
function extractIgImageFromJson(html: string): string | undefined {
  const patterns = [
    /"display_url":"([^"]+)"/,
    /"thumbnail_src":"([^"]+)"/,
    /"thumbnail_url":"([^"]+)"/,
    /"image_versions2":\{"candidates":\[\{"url":"([^"]+)"/,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) {
      const url = decodeHtml(m[1]).replace(/\\\//g, "/").replace(/\\u([0-9a-fA-F]{4})/g, (_, c) => String.fromCharCode(parseInt(c, 16)));
      return url;
    }
  }
  return undefined;
}

async function resolveInstagram(rawUrl: string): Promise<Preview> {
  // Attempt 1: Chrome UA
  let html = await fetchHtml(rawUrl, UA_CHROME);
  if (html) {
    const og = parseOg(html);
    if (og.image || og.video) return og;
    const igImg = extractIgImageFromJson(html);
    if (igImg) return { ...og, image: igImg };
  }
  // Attempt 2: Facebook crawler UA
  html = await fetchHtml(rawUrl, UA_FACEBOOK);
  if (html) {
    const og = parseOg(html);
    if (og.image || og.video) return og;
    const igImg = extractIgImageFromJson(html);
    if (igImg) return { ...og, image: igImg };
  }
  // Attempt 3: Instagram public oEmbed via App-ID
  try {
    const r = await fetch(
      `https://i.instagram.com/api/v1/oembed/?url=${encodeURIComponent(rawUrl)}`,
      {
        headers: {
          "User-Agent": UA_CHROME,
          "X-IG-App-ID": "936619743392459",
          Accept: "application/json",
        },
      },
    );
    if (r.ok) {
      const j = await r.json();
      if (j?.thumbnail_url) {
        return {
          image: j.thumbnail_url,
          title: j.title,
          author: j.author_name,
          site: "Instagram",
        };
      }
    }
  } catch { /* ignore */ }
  return { fallback: true, error: "Instagram bloqueou o preview automático" };
}

async function resolvePreview(rawUrl: string): Promise<Preview> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { fallback: true, error: "URL inválida" };
  }
  const host = url.hostname.replace(/^www\./, "");

  try {
    if (host.endsWith("youtube.com") || host === "youtu.be") {
      const p = await tryOembed(
        `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(rawUrl)}`,
      );
      if (p?.image) return p;
    }
    if (host.endsWith("vimeo.com")) {
      const p = await tryOembed(
        `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(rawUrl)}`,
      );
      if (p?.image) return p;
    }
    if (host.endsWith("tiktok.com")) {
      const p = await tryOembed(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(rawUrl)}`,
      );
      if (p?.image) return p;
    }
    if (host.endsWith("instagram.com") || host === "instagr.am") {
      return await resolveInstagram(rawUrl);
    }
  } catch { /* fallthrough */ }

  const html = await fetchHtml(rawUrl);
  if (!html) return { fallback: true, error: "Não foi possível carregar a página" };
  const og = parseOg(html);
  if (!og.image && !og.video && !og.title) {
    return { fallback: true, error: "Sem metadados no HTML" };
  }
  return og;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { url } = await req.json().catch(() => ({ url: null }));
    if (!url || typeof url !== "string") {
      return new Response(
        JSON.stringify({ fallback: true, error: "URL obrigatória" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const preview = await resolvePreview(url);
    return new Response(JSON.stringify(preview), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ fallback: true, error: String((e as Error)?.message ?? e) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

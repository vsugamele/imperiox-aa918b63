// Link do teste A/B/C de página (FUN1.2): /functions/v1/split/<slug> → página da variante, preservando UTMs e fbclid.
// Público (o anúncio aponta para cá). A pessoa volta sempre para a mesma variante (cookie de 30 dias).
// Teste encerrado com vencedor manda tudo para a vencedora; sem teste, responde 404 sem expor nada.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { normalizeVariants, pickVariant, targetUrl } from "../_shared/page-split.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function cookieValue(header: string | null, name: string): string | null {
  for (const part of (header ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const slug = (url.pathname.split("/split/")[1] ?? url.searchParams.get("s") ?? "").split("/")[0].trim().toLowerCase();
  if (!slug || !/^[a-z0-9-]{1,60}$/.test(slug)) return new Response("Link não encontrado", { status: 404 });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: split } = await sb.from("imphq_page_splits").select("id, variantes, status, vencedor").eq("slug", slug).maybeSingle();
  const variants = normalizeVariants(split?.variantes);
  if (!split || !variants.length) return new Response("Link não encontrado", { status: 404 });

  const cookieName = `imps_${slug}`;
  const sticky = cookieValue(req.headers.get("cookie"), cookieName);
  let chosen = variants.find((v) => v.key === (split.status === "encerrado" && split.vencedor ? split.vencedor : sticky));
  const nova = !chosen || split.status === "encerrado";
  if (!chosen) chosen = pickVariant(variants, crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32);

  if (split.status === "ativo") {
    // Registro não bloqueia o redirecionamento.
    const hit = Promise.resolve(sb.from("imphq_split_hits").insert({
      split_id: split.id, variante: chosen.key, nova_visita: !sticky,
      utm_source: url.searchParams.get("utm_source"), utm_campaign: url.searchParams.get("utm_campaign"), utm_content: url.searchParams.get("utm_content"),
    }).then(({ error }) => { if (error) console.error("[split] hit", error.message); }));
    const rt = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
    if (rt?.waitUntil) rt.waitUntil(hit); else await hit;
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: targetUrl(chosen.url, url.searchParams, slug, chosen.key),
      "Cache-Control": "no-store",
      ...(nova ? { "Set-Cookie": `${cookieName}=${encodeURIComponent(chosen.key)}; Max-Age=2592000; Path=/; Secure; SameSite=Lax` } : {}),
    },
  });
});

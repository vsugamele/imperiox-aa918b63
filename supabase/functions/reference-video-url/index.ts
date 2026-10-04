// Link temporário (15 min) do vídeo de uma referência da biblioteca (Story REF1.1).
// Os vídeos das referências trazidas do Centro de Comando ficam no bucket privado do Centro; este endpoint assina o link
// com a chave de serviço do Centro (secrets CENTRO_SUPABASE_URL / CENTRO_SERVICE_ROLE_KEY). Só para usuário logado.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const url = Deno.env.get("SUPABASE_URL")!;
  const auth = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return json({ error: "login obrigatório" }, 401);

  const { referencia_id } = await req.json().catch(() => ({}));
  if (typeof referencia_id !== "string" || !referencia_id) return json({ error: "referencia_id obrigatório" }, 400);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: ref, error } = await admin.from("imphq_referencias").select("video_ref").eq("id", referencia_id).maybeSingle();
  if (error) return json({ error: error.message }, 500);
  const video = ref?.video_ref as { origem?: string; bucket?: string; key?: string } | null;
  if (!video?.bucket || !video.key || video.origem !== "centro") return json({ error: "referência sem vídeo" }, 404);

  const centroUrl = Deno.env.get("CENTRO_SUPABASE_URL")?.replace(/\/$/, "");
  const centroKey = Deno.env.get("CENTRO_SERVICE_ROLE_KEY");
  if (!centroUrl || !centroKey) return json({ error: "vídeo do Centro indisponível: CENTRO_SUPABASE_URL / CENTRO_SERVICE_ROLE_KEY não configurados" }, 503);

  const res = await fetch(`${centroUrl}/storage/v1/object/sign/${video.bucket}/${video.key}`, {
    method: "POST",
    headers: { apikey: centroKey, Authorization: `Bearer ${centroKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 900 }),
  });
  const body = await res.json().catch(() => ({}));
  const signed = (body as { signedURL?: string }).signedURL;
  if (!res.ok || !signed) return json({ error: `Centro recusou o link (${res.status})` }, 502);
  return json({ url: `${centroUrl}/storage/v1${signed}`, expira_em_segundos: 900 });
});

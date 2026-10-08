// Login sem senha da área de membros JP (link /auth/verify?token=... emitido pelo crm-bridge).
// 08/10: a versão anterior embutia `auth.users(email)` no select do PostgREST, que não expõe o schema auth:
// a consulta falhava e TODO token voltava "inválido" (0 de 26 links usados em 60 dias). Agora o e-mail vem da
// Admin API e a sessão é criada aqui (verifyOtp), devolvida no hash do action_link que a página já sabe ler.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const makeClient = () => createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { token } = await req.json().catch(() => ({ token: null }));
    if (!token || typeof token !== "string") return json({ error: "Token não fornecido" }, 400);

    const admin = makeClient();
    const { data: tokenData, error: tokenError } = await admin
      .from("areamembrojp_tenant_magic_tokens")
      .select("id, user_id, tenant_origin, redirect_path")
      .eq("token_hash", token)
      .gt("expires_at", new Date().toISOString())
      .is("used_at", null)
      .maybeSingle();
    if (tokenError) console.error("[magic-verify] token lookup failed:", tokenError.message);
    if (tokenError || !tokenData) return json({ error: "Token inválido, expirado ou já utilizado" }, 401);

    const { data: userData, error: userError } = await admin.auth.admin.getUserById(tokenData.user_id);
    const email = userData?.user?.email;
    if (userError || !email) return json({ error: "Usuário não encontrado" }, 404);

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    const hashed = linkData?.properties?.hashed_token;
    if (linkError || !hashed) return json({ error: `Falha ao gerar sessão: ${linkError?.message ?? "sem token"}` }, 500);

    // Troca o token do Supabase por uma sessão aqui mesmo: não depende do redirect configurado no Auth.
    const { data: otp, error: otpError } = await makeClient().auth.verifyOtp({ type: "magiclink", token_hash: hashed });
    const session = otp?.session;
    if (otpError || !session) return json({ error: `Falha ao criar sessão: ${otpError?.message ?? "sem sessão"}` }, 500);

    // Só marca como usado depois que a sessão existe: se algo falhar antes, o link continua valendo.
    await admin.from("areamembrojp_tenant_magic_tokens").update({ used_at: new Date().toISOString() }).eq("id", tokenData.id);

    const redirectPath = tokenData.redirect_path || "/home";
    const origin = String(tokenData.tenant_origin || "").replace(/\/$/, "");
    const fragment = new URLSearchParams({ access_token: session.access_token, refresh_token: session.refresh_token, token_type: "bearer" });
    return json({ ok: true, action_link: `${origin}${redirectPath}#${fragment.toString()}`, redirect_path: redirectPath });
  } catch (e) {
    console.error("[magic-verify]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

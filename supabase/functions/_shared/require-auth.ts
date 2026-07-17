// Shared auth helper for AI proxy edge functions.
// Blocks unauthenticated callers so open proxies can't burn credits.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function requireUser(req: Request): Promise<
  | { ok: true; userId: string; token: string }
  | { ok: false; response: Response }
> {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors }),
    };
  }
  const token = authHeader.replace("Bearer ", "");
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data, error } = await sb.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors }),
    };
  }
  return { ok: true, userId: data.claims.sub as string, token };
}

// For endpoints that must accept both a signed-in user OR a trusted server call
// (e.g. pg_cron using the service role key in the Authorization header).
export async function requireUserOrServiceRole(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceRole && token && token === serviceRole) {
    return { ok: true as const, userId: "service_role", token };
  }
  return requireUser(req);
}

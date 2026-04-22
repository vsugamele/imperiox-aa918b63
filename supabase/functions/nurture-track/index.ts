import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

// 1x1 transparent GIF
const PIXEL = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), c => c.charCodeAt(0));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const eid = url.searchParams.get("eid");
    const type = url.searchParams.get("type"); // "open" | "click"
    const target = url.searchParams.get("url");

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (eid) {
      const field = type === "click" ? "clicado_em" : "aberto_em";
      // only update if not already set (first hit wins)
      await admin
        .from("imphq_nurture_emails")
        .update({ [field]: new Date().toISOString() } as any)
        .eq("id", eid)
        .is(field, null);
    }

    if (type === "click" && target) {
      return new Response(null, {
        status: 302,
        headers: { Location: target, "Cache-Control": "no-store", ...corsHeaders },
      });
    }

    return new Response(PIXEL, {
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        ...corsHeaders,
      },
    });
  } catch (err: any) {
    console.error("nurture-track error:", err);
    return new Response(PIXEL, {
      headers: { "Content-Type": "image/gif", "Cache-Control": "no-store", ...corsHeaders },
    });
  }
});

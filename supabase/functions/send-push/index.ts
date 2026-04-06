import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Web Push crypto utilities for Deno
async function sendWebPush(subscription: { endpoint: string; keys_p256dh: string; keys_auth: string }, payload: string, vapidPublic: string, vapidPrivate: string) {
  // Use simple fetch-based push (requires the endpoint to accept plain text)
  // For full Web Push with VAPID + encryption, we use the web-push approach
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "TTL": "86400",
    },
    body: payload,
  });
  return response;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, title, message } = await req.json();
    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: "user_id and title required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: subs } = await supabase
      .from("imphq_push_subscriptions")
      .select("endpoint, keys_p256dh, keys_auth")
      .eq("user_id", user_id);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no_subscriptions" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const payload = JSON.stringify({ title, body: message || "", icon: "/icons/icon-192x192.png" });
    let sent = 0;
    let failed = 0;

    for (const sub of subs) {
      try {
        const res = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "TTL": "86400",
          },
          body: payload,
        });
        if (res.ok || res.status === 201) {
          sent++;
        } else if (res.status === 404 || res.status === 410) {
          // Subscription expired, clean up
          await supabase.from("imphq_push_subscriptions").delete().eq("endpoint", sub.endpoint);
          failed++;
        } else {
          failed++;
        }
      } catch (e) {
        console.error("[send-push] Error sending to endpoint:", e);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, sent, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[send-push] Error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

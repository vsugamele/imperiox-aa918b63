import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date().toISOString();
  const { data: due, error } = await supabase
    .from("imphq_wa_scheduled")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sent = 0, failed = 0;
  for (const row of due || []) {
    // claim
    const { data: claimed } = await supabase
      .from("imphq_wa_scheduled")
      .update({ status: "processing" })
      .eq("id", row.id).eq("status", "pending").select("id").maybeSingle();
    if (!claimed) continue;

    try {
      const { data, error: sendErr } = await supabase.functions.invoke("whatsapp-api?action=send_message", {
        body: {
          provider_id: row.provider_id, phone: row.phone, content: row.content,
          conversation_id: row.conversation_id, project_id: row.project_id,
          ...(row.media_url ? { media_url: row.media_url, media_type: row.media_type || "image" } : {}),
          sent_by: "scheduled",
        },
      });
      if (sendErr || data?.success === false) {
        throw new Error(sendErr?.message || data?.error || "send failed");
      }
      await supabase.from("imphq_wa_scheduled")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", row.id);
      sent++;
    } catch (e: any) {
      await supabase.from("imphq_wa_scheduled")
        .update({ status: "failed", error: String(e?.message || e) })
        .eq("id", row.id);
      failed++;
    }
  }

  return new Response(JSON.stringify({ processed: due?.length || 0, sent, failed }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

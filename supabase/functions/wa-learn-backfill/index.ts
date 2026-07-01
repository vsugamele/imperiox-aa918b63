// wa-learn-backfill — varre mensagens humanas dos últimos N dias e indexa pares (lead → humano)
// em imphq_wa_knowledge via wa-learn-from-human.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { project_id, days = 30, limit = 500 } = await req.json();
    if (!project_id) {
      return new Response(JSON.stringify({ ok: false, error: "missing_project_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const since = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000).toISOString();
    const { data: msgs, error } = await supabase
      .from("imphq_wa_messages")
      .select("id, conversation_id, content, created_at")
      .eq("project_id", project_id)
      .eq("sent_by", "human")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(Number(limit));

    if (error) throw error;

    let aprendidas = 0, dedupadas = 0, puladas = 0, erros = 0;
    for (const m of msgs || []) {
      if (!m.content || m.content.length < 15) { puladas++; continue; }
      try {
        const r = await supabase.functions.invoke("wa-learn-from-human", {
          body: { conversation_id: m.conversation_id, message_id: m.id, project_id },
        });
        const data: any = r.data || {};
        if (data.id) aprendidas++;
        else if (data.deduped) dedupadas++;
        else puladas++;
      } catch (_) { erros++; }
      // Throttle leve pra não estourar rate-limit do embedding
      await new Promise(res => setTimeout(res, 80));
    }

    return new Response(JSON.stringify({
      ok: true, total: msgs?.length || 0, aprendidas, dedupadas, puladas, erros,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[wa-learn-backfill] fatal:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

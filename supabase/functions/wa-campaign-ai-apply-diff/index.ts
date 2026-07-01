// Aplica atualizações aprovadas de um diff gerado por wa-campaign-ai-generate (mode=adjust)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { campaign_id, updates } = await req.json();
    if (!campaign_id || !Array.isArray(updates) || updates.length === 0) {
      return new Response(JSON.stringify({ error: "campaign_id e updates[] são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    let applied = 0;
    const errors: string[] = [];

    for (const u of updates) {
      if (!u?.id) continue;
      const patch: Record<string, any> = {};
      if (typeof u.content === "string") patch.content = u.content.slice(0, 4000);
      if (Number.isInteger(u.days_offset)) patch.days_offset = u.days_offset;
      if (typeof u.send_time === "string" && /^\d{2}:\d{2}/.test(u.send_time)) patch.send_time = u.send_time.slice(0, 5);
      if (Object.keys(patch).length === 0) continue;

      const { error } = await supabase
        .from("imphq_wa_campaign_steps")
        .update(patch)
        .eq("id", u.id)
        .eq("campaign_id", campaign_id);
      if (error) errors.push(`${u.id}: ${error.message}`);
      else applied++;
    }

    return new Response(JSON.stringify({ ok: true, applied, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

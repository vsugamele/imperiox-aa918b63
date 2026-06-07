// ig-to-wa-bridge — When an IG lead reaches "quente" stage, create a WA lead + trigger OpenFlow
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { ig_conversation_id, project_id, trigger_tipo = "lead_novo" } = await req.json();
    if (!ig_conversation_id || !project_id) {
      return new Response(JSON.stringify({ error: "ig_conversation_id e project_id obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load IG conversation
    const { data: igConv } = await supabase
      .from("imphq_ig_conversations")
      .select("participant_id, participant_username, participant_name, participant_phone, triage_fit_score")
      .eq("id", ig_conversation_id)
      .maybeSingle();

    if (!igConv) {
      return new Response(JSON.stringify({ error: "Conversa IG não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nome = igConv.participant_name || igConv.participant_username || "Lead Instagram";
    const phone = igConv.participant_phone || null;
    const igUsername = igConv.participant_username || igConv.participant_id;

    // Upsert lead into imphq_leads
    const leadId = `ig_${igConv.participant_id}`;
    const { data: existingLead } = await supabase
      .from("imphq_leads")
      .select("id, tags")
      .eq("id", leadId)
      .maybeSingle();

    const baseTags = existingLead?.tags || [];
    const newTags = [...new Set([...baseTags, "📸 Instagram", "🔥 Hot Lead"])];

    await supabase.from("imphq_leads").upsert({
      id: leadId,
      project_id,
      nome,
      phone: phone || null,
      score: Math.max(igConv.triage_fit_score || 70, 70),
      status: "quente",
      tags: newTags,
      data: { origem: "instagram", ig_username: igUsername, ig_conversation_id },
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });

    console.log(`[ig-to-wa-bridge] Upserted lead ${leadId} (${nome}) from IG conversation ${ig_conversation_id}`);

    // Tag history
    await supabase.from("imphq_lead_tag_history").insert([
      { lead_id: leadId, project_id, tag: "📸 Instagram", action: "added", source: "ig_to_wa_bridge" },
      { lead_id: leadId, project_id, tag: "🔥 Hot Lead", action: "added", source: "ig_to_wa_bridge" },
    ]).catch(() => {});

    // Trigger OpenFlow if phone is available
    let flowResult = null;
    if (phone) {
      try {
        const flowRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/openflow-executor`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            trigger_tipo,
            project_id,
            lead_data: {
              lead_id: leadId,
              nome,
              telefone: phone,
              phone,
              email: "",
              tags: newTags,
            },
          }),
        });
        flowResult = await flowRes.json().catch(() => null);
        console.log(`[ig-to-wa-bridge] OpenFlow triggered: ${JSON.stringify(flowResult)}`);
      } catch (fe: any) {
        console.warn(`[ig-to-wa-bridge] OpenFlow trigger failed: ${fe.message}`);
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      lead_id: leadId,
      phone_available: !!phone,
      flow_triggered: !!flowResult,
      flow_result: flowResult,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    console.error(`[ig-to-wa-bridge] Fatal: ${e.message}`);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

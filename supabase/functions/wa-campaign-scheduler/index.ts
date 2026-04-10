import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get current time in Brazil timezone (UTC-3)
    const now = new Date();
    const brTime = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const currentTime = brTime.toISOString().slice(11, 16); // "HH:MM"
    const currentHour = parseInt(currentTime.split(":")[0]);
    const currentMinute = parseInt(currentTime.split(":")[1]);

    console.log(`[Campaign Scheduler] Running at ${currentTime} (BR time)`);

    // Fetch active campaigns with their steps
    const { data: campaigns, error: campError } = await supabase
      .from("imphq_wa_campaigns")
      .select(`
        *,
        imphq_wa_campaign_steps(*)
      `)
      .eq("status", "active");

    if (campError) throw campError;
    if (!campaigns || campaigns.length === 0) {
      console.log("[Campaign Scheduler] No active campaigns found");
      return new Response(JSON.stringify({ ok: true, message: "No active campaigns" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalSent = 0;
    let totalFailed = 0;

    for (const campaign of campaigns) {
      const groups: string[] = Array.isArray(campaign.groups) ? campaign.groups : [];
      if (groups.length === 0) continue;

      // Calculate days since campaign start
      const startDate = campaign.start_date ? new Date(campaign.start_date) : new Date(campaign.created_at);
      const today = new Date(brTime.toISOString().slice(0, 10));
      const start = new Date(startDate.toISOString().slice(0, 10));
      const daysSinceStart = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      // Filter steps that should run now
      const steps = (campaign.imphq_wa_campaign_steps || []).filter((step: any) => {
        if (!step.is_active) return false;
        if (step.days_offset !== daysSinceStart) return false;

        // Check time match (±1 min tolerance)
        const [stepH, stepM] = step.send_time.split(":").map(Number);
        const diffMin = Math.abs((stepH * 60 + stepM) - (currentHour * 60 + currentMinute));
        return diffMin <= 1;
      });

      if (steps.length === 0) continue;

      // Get provider for this campaign
      let provider = null;
      if (campaign.provider_id) {
        const { data } = await supabase
          .from("imphq_wa_providers")
          .select("*")
          .eq("id", campaign.provider_id)
          .single();
        provider = data;
      }

      if (!provider) {
        console.log(`[Campaign ${campaign.name}] No provider found, skipping`);
        continue;
      }

      const apiUrl = (provider.api_url || "").replace(/\/+$/, "");
      const apiKey = provider.api_key || "";
      const instanceName = provider.instance_name || "";

      for (const step of steps) {
        // Check if already sent today
        const todayStr = brTime.toISOString().slice(0, 10);
        const { data: existingLogs } = await supabase
          .from("imphq_wa_campaign_logs")
          .select("id")
          .eq("step_id", step.id)
          .gte("executed_at", todayStr + "T00:00:00")
          .lte("executed_at", todayStr + "T23:59:59")
          .limit(1);

        if (existingLogs && existingLogs.length > 0) {
          console.log(`[Campaign ${campaign.name}] Step ${step.step_order} already sent today`);
          continue;
        }

        for (let i = 0; i < groups.length; i++) {
          const groupJid = groups[i];

          try {
            // Rate limiting: 3s delay between groups
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, 3000));
            }

            // Send message based on media_type
            let endpoint: string;
            let body: any;

            if (step.media_type === "text" || !step.media_url) {
              endpoint = `${apiUrl}/message/sendText/${encodeURIComponent(instanceName)}`;
              body = {
                number: groupJid,
                text: step.content || "",
              };
            } else if (step.media_type === "image") {
              endpoint = `${apiUrl}/message/sendMedia/${encodeURIComponent(instanceName)}`;
              body = {
                number: groupJid,
                mediatype: "image",
                media: step.media_url,
                caption: step.content || "",
              };
            } else if (step.media_type === "audio") {
              endpoint = `${apiUrl}/message/sendWhatsAppAudio/${encodeURIComponent(instanceName)}`;
              body = {
                number: groupJid,
                audio: step.media_url,
              };
            } else if (step.media_type === "video") {
              endpoint = `${apiUrl}/message/sendMedia/${encodeURIComponent(instanceName)}`;
              body = {
                number: groupJid,
                mediatype: "video",
                media: step.media_url,
                caption: step.content || "",
              };
            } else if (step.media_type === "document") {
              endpoint = `${apiUrl}/message/sendMedia/${encodeURIComponent(instanceName)}`;
              body = {
                number: groupJid,
                mediatype: "document",
                media: step.media_url,
                caption: step.content || "",
                fileName: "document",
              };
            } else {
              endpoint = `${apiUrl}/message/sendText/${encodeURIComponent(instanceName)}`;
              body = { number: groupJid, text: step.content || "" };
            }

            const response = await fetch(endpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: apiKey,
              },
              body: JSON.stringify(body),
            });

            const result = await response.json();

            if (!response.ok) {
              throw new Error(JSON.stringify(result));
            }

            // Log success
            await supabase.from("imphq_wa_campaign_logs").insert({
              step_id: step.id,
              campaign_id: campaign.id,
              group_jid: groupJid,
              status: "sent",
            });

            totalSent++;
            console.log(`[Campaign ${campaign.name}] Sent step ${step.step_order} to ${groupJid}`);
          } catch (err: any) {
            // Log failure
            await supabase.from("imphq_wa_campaign_logs").insert({
              step_id: step.id,
              campaign_id: campaign.id,
              group_jid: groupJid,
              status: "failed",
              error: err.message?.slice(0, 500),
            });

            totalFailed++;
            console.error(`[Campaign ${campaign.name}] Failed step ${step.step_order} to ${groupJid}: ${err.message}`);
          }
        }
      }
    }

    console.log(`[Campaign Scheduler] Done. Sent: ${totalSent}, Failed: ${totalFailed}`);

    return new Response(
      JSON.stringify({ ok: true, sent: totalSent, failed: totalFailed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[Campaign Scheduler] Error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TZ = "America/Sao_Paulo";

function nowInBR(): { dateStr: string; timeStr: string; hour: number; minute: number } {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "00";
  const dateStr = `${get("year")}-${get("month")}-${get("day")}`;
  const hour = parseInt(get("hour"));
  const minute = parseInt(get("minute"));
  const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return { dateStr, timeStr, hour, minute };
}

function timeInWindow(currentMin: number, startTime: string, endTime: string): boolean {
  const [sh, sm] = (startTime || "08:00").split(":").map(Number);
  const [eh, em] = (endTime || "22:00").split(":").map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  if (startMin <= endMin) return currentMin >= startMin && currentMin <= endMin;
  // window crosses midnight
  return currentMin >= startMin || currentMin <= endMin;
}

function renderVariables(text: string, vars: Record<string, string>): string {
  if (!text) return text;
  return text.replace(/\{(\w+)\}/g, (_m, key) => vars[key] ?? `{${key}}`);
}

function withMentions(payload: any, campaign: any, jid: string): any {
  if (campaign?.mention_all && typeof jid === "string" && jid.endsWith("@g.us")) {
    payload.mentionsEveryOne = true;
    payload.options = { ...(payload.options || {}), mentionsEveryOne: true };
  }
  return payload;
}

// 6C: stable hash → 0/1 for deterministic A/B split per group
function hashAB(input: string): 0 | 1 {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0;
  return (Math.abs(h) % 2) as 0 | 1;
}

function jitterMs(): number {
  // 3000–8000 ms
  return 3000 + Math.floor(Math.random() * 5000);
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function sendWithRetry(endpoint: string, headers: any, body: any, maxRetries = 2): Promise<any> {
  let lastErr: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(JSON.stringify(json).slice(0, 400));
      return json;
    } catch (err: any) {
      lastErr = err;
      if (attempt < maxRetries) {
        // exponential backoff: 1s, 2s
        await sleep(1000 * Math.pow(2, attempt));
      }
    }
  }
  throw lastErr;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 6B: Test send action — fires a single step to a single group on demand
  try {
    let action = new URL(req.url).searchParams.get("action");
    let body: any = null;
    if (req.method === "POST") {
      try { body = await req.clone().json(); } catch { /* ignore */ }
      if (body?.action) action = body.action;
    }

    if (action === "test_send") {
      const { step_id, group_jid } = body || {};
      if (!step_id || !group_jid) {
        return new Response(JSON.stringify({ error: "step_id and group_jid required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: step } = await supabase
        .from("imphq_wa_campaign_steps")
        .select("*, imphq_wa_campaigns(*)")
        .eq("id", step_id)
        .single();

      if (!step) {
        return new Response(JSON.stringify({ error: "step not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const campaign: any = (step as any).imphq_wa_campaigns;
      let provider: any = null;
      if (campaign?.provider_id) {
        const { data } = await supabase.from("imphq_wa_providers").select("*").eq("id", campaign.provider_id).single();
        provider = data;
      }
      if (!provider) {
        return new Response(JSON.stringify({ error: "no provider configured" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const apiUrl = (provider.api_url || "").replace(/\/+$/, "");
      const apiKey = provider.api_key || "";
      const instanceName = provider.instance_name || "";
      const vars: Record<string, string> = {
        produto: campaign?.produto || "",
        campanha: campaign?.name || "",
        grupo: "", grupo_nome: "", nome: "Teste",
      };

      // Resolve the groups to send
      let groupsToSend: string[] = [];
      if (Array.isArray(group_jid)) {
        groupsToSend = group_jid;
      } else if (typeof group_jid === "string") {
        groupsToSend = group_jid.split(",").map(g => g.trim()).filter(Boolean);
      }

      if (groupsToSend.length === 0) {
        return new Response(JSON.stringify({ error: "no valid group JIDs found" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let sentCount = 0;
      let failedCount = 0;
      let lastError = "";

      for (let idx = 0; idx < groupsToSend.length; idx++) {
        const currentGroupJid = groupsToSend[idx];
        if (idx > 0) {
          // add a tiny sleep between manual tests to avoid rate limits
          await sleep(2000);
        }

        const rendered = renderVariables((step as any).content || "", vars);
        const mt = (step as any).media_type;
        const mediaUrl = (step as any).media_url;

        let endpoint: string; let payload: any;
        if (mt === "text" || !mediaUrl) {
          endpoint = `${apiUrl}/message/sendText/${encodeURIComponent(instanceName)}`;
          payload = { number: currentGroupJid, text: rendered };
        } else if (mt === "image") {
          endpoint = `${apiUrl}/message/sendMedia/${encodeURIComponent(instanceName)}`;
          payload = { number: currentGroupJid, mediatype: "image", media: mediaUrl, caption: rendered };
        } else if (mt === "audio") {
          endpoint = `${apiUrl}/message/sendWhatsAppAudio/${encodeURIComponent(instanceName)}`;
          payload = { number: currentGroupJid, audio: mediaUrl };
        } else if (mt === "video") {
          endpoint = `${apiUrl}/message/sendMedia/${encodeURIComponent(instanceName)}`;
          payload = { number: currentGroupJid, mediatype: "video", media: mediaUrl, caption: rendered };
        } else {
          endpoint = `${apiUrl}/message/sendMedia/${encodeURIComponent(instanceName)}`;
          payload = { number: currentGroupJid, mediatype: "document", media: mediaUrl, caption: rendered, fileName: "document" };
        }

        withMentions(payload, campaign, currentGroupJid);

        try {
          await sendWithRetry(endpoint, { "Content-Type": "application/json", apikey: apiKey }, payload, 1);
          await supabase.from("imphq_wa_campaign_logs").insert({
            step_id, campaign_id: campaign.id, group_jid: currentGroupJid, status: "sent", error: "MANUAL_SEND",
          });
          sentCount++;
        } catch (err: any) {
          lastError = err.message || "";
          await supabase.from("imphq_wa_campaign_logs").insert({
            step_id, campaign_id: campaign.id, group_jid: currentGroupJid, status: "failed", error: "MANUAL_SEND: " + (err.message || "").slice(0, 400),
          });
          failedCount++;
        }
      }

      if (failedCount > 0 && sentCount === 0) {
        return new Response(JSON.stringify({ error: lastError }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ ok: true, sent: sentCount, failed: failedCount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { dateStr: todayStr, timeStr: currentTime, hour: currentHour, minute: currentMinute } = nowInBR();
    const currentTotalMin = currentHour * 60 + currentMinute;

    console.log(`[Campaign Scheduler] Running at ${currentTime} (${TZ})`);

    const { data: campaigns, error: campError } = await supabase
      .from("imphq_wa_campaigns")
      .select(`*, imphq_wa_campaign_steps(*)`)
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
      const allGroups: string[] = Array.isArray(campaign.groups) ? campaign.groups : [];
      // 6C: Skip individually paused groups
      const pausedSet = new Set<string>(Array.isArray((campaign as any).paused_groups) ? (campaign as any).paused_groups : []);
      const groups = allGroups.filter((g) => !pausedSet.has(g));
      if (groups.length === 0) continue;

      // 6A: Sending window — skip campaign if outside its window
      const winStart = (campaign as any).send_window_start || "08:00";
      const winEnd = (campaign as any).send_window_end || "22:00";
      if (!timeInWindow(currentTotalMin, winStart, winEnd)) {
        console.log(`[Campaign ${campaign.name}] Outside send window ${winStart}-${winEnd}, skipping`);
        continue;
      }
      if (pausedSet.size > 0) {
        console.log(`[Campaign ${campaign.name}] ${pausedSet.size} grupos pausados (skip)`);
      }

      // Days since start (in BR tz)
      const startDateStr = (campaign.start_date || campaign.created_at || "").slice(0, 10);
      const start = new Date(startDateStr + "T00:00:00");
      const today = new Date(todayStr + "T00:00:00");
      const daysSinceStart = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      const steps = (campaign.imphq_wa_campaign_steps || []).filter((step: any) => {
        if (!step.is_active) return false;
        if (step.send_date) {
          if (step.send_date !== todayStr) return false;
        } else {
          if (step.days_offset !== daysSinceStart) return false;
        }
        const [stepH, stepM] = (step.send_time || "09:00").split(":").map(Number);
        const diffMin = Math.abs((stepH * 60 + stepM) - currentTotalMin);
        return diffMin <= 1;
      });

      if (steps.length === 0) continue;

      let provider = null;
      let fallbackProvider: any = null;
      if (campaign.provider_id) {
        const { data } = await supabase
          .from("imphq_wa_providers")
          .select("*")
          .eq("id", campaign.provider_id)
          .single();
        provider = data;
      }
      if ((campaign as any).fallback_provider_id && (campaign as any).auto_fallback !== false) {
        const { data: fb } = await supabase
          .from("imphq_wa_providers")
          .select("*")
          .eq("id", (campaign as any).fallback_provider_id)
          .single();
        fallbackProvider = fb;
      }

      if (!provider) {
        console.log(`[Campaign ${campaign.name}] No provider, skipping`);
        continue;
      }

      const apiUrl = (provider.api_url || "").replace(/\/+$/, "");
      const apiKey = provider.api_key || "";
      const instanceName = provider.instance_name || "";

      let consecutiveFailures = 0;
      let bothFailed = false;

      for (const step of steps) {
        // Already sent today?
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
            // 6A: human jitter 3–8s + extra pause every 10 groups
            if (i > 0) {
              await sleep(jitterMs());
              if (i % 10 === 0) {
                console.log(`[Campaign ${campaign.name}] Long pause (30s) after ${i} groups`);
                await sleep(30000);
              }
            }

            // 6B: dynamic variables
            const vars: Record<string, string> = {
              produto: campaign.produto || "",
              campanha: campaign.name || "",
              grupo: "",
              grupo_nome: "",
              nome: "",
            };
            // 6C: A/B split — if content_b is set, 50/50 by deterministic group hash
            const contentB = (step as any).content_b as string | null | undefined;
            const useVariantB = !!(contentB && contentB.trim()) && hashAB(`${step.id}:${groupJid}`) === 1;
            const baseContent = useVariantB ? (contentB as string) : (step.content || "");
            const renderedContent = renderVariables(baseContent, vars);

            let endpoint: string;
            let body: any;

            if (step.media_type === "text" || !step.media_url) {
              endpoint = `${apiUrl}/message/sendText/${encodeURIComponent(instanceName)}`;
              body = { number: groupJid, text: renderedContent };
            } else if (step.media_type === "image") {
              endpoint = `${apiUrl}/message/sendMedia/${encodeURIComponent(instanceName)}`;
              body = { number: groupJid, mediatype: "image", media: step.media_url, caption: renderedContent };
            } else if (step.media_type === "audio") {
              endpoint = `${apiUrl}/message/sendWhatsAppAudio/${encodeURIComponent(instanceName)}`;
              body = { number: groupJid, audio: step.media_url };
            } else if (step.media_type === "video") {
              endpoint = `${apiUrl}/message/sendMedia/${encodeURIComponent(instanceName)}`;
              body = { number: groupJid, mediatype: "video", media: step.media_url, caption: renderedContent };
            } else if (step.media_type === "document") {
              endpoint = `${apiUrl}/message/sendMedia/${encodeURIComponent(instanceName)}`;
              body = { number: groupJid, mediatype: "document", media: step.media_url, caption: renderedContent, fileName: "document" };
            } else {
              endpoint = `${apiUrl}/message/sendText/${encodeURIComponent(instanceName)}`;
              body = { number: groupJid, text: renderedContent };
            }

            withMentions(body, campaign, groupJid);
            await sendWithRetry(endpoint, { "Content-Type": "application/json", apikey: apiKey }, body, 2);

            await supabase.from("imphq_wa_campaign_logs").insert({
              step_id: step.id,
              campaign_id: campaign.id,
              group_jid: groupJid,
              status: "sent",
              error: useVariantB ? "VARIANT_B" : null,
            });

            totalSent++;
            consecutiveFailures = 0;
            console.log(`[Campaign ${campaign.name}] Sent step ${step.step_order} to ${groupJid}`);
          } catch (err: any) {
            consecutiveFailures++;
            let fallbackOk = false;

            // Try fallback after 2 consecutive failures on primary
            if (fallbackProvider && consecutiveFailures >= 2) {
              try {
                const fbUrl = (fallbackProvider.api_url || "").replace(/\/+$/, "");
                const fbKey = fallbackProvider.api_key || "";
                const fbInst = fallbackProvider.instance_name || "";
                const fbEndpoint = (step.media_type === "text" || !step.media_url)
                  ? `${fbUrl}/message/sendText/${encodeURIComponent(fbInst)}`
                  : step.media_type === "audio"
                  ? `${fbUrl}/message/sendWhatsAppAudio/${encodeURIComponent(fbInst)}`
                  : `${fbUrl}/message/sendMedia/${encodeURIComponent(fbInst)}`;
                const fbBody = (step.media_type === "text" || !step.media_url)
                  ? { number: groupJid, text: renderVariables(step.content || "", { produto: campaign.produto || "", campanha: campaign.name || "", grupo: "", grupo_nome: "", nome: "" }) }
                  : step.media_type === "audio"
                  ? { number: groupJid, audio: step.media_url }
                  : { number: groupJid, mediatype: step.media_type, media: step.media_url, caption: renderVariables(step.content || "", { produto: campaign.produto || "", campanha: campaign.name || "", grupo: "", grupo_nome: "", nome: "" }), fileName: "document" };
                withMentions(fbBody, campaign, groupJid);
                await sendWithRetry(fbEndpoint, { "Content-Type": "application/json", apikey: fbKey }, fbBody, 1);
                await supabase.from("imphq_wa_campaign_logs").insert({
                  step_id: step.id, campaign_id: campaign.id, group_jid: groupJid, status: "sent", error: "FALLBACK_USED",
                });
                totalSent++;
                fallbackOk = true;
                console.log(`[Campaign ${campaign.name}] FALLBACK sent to ${groupJid}`);
              } catch (fbErr: any) {
                bothFailed = true;
                console.error(`[Campaign ${campaign.name}] FALLBACK also failed: ${fbErr.message}`);
              }
            }

            if (!fallbackOk) {
              await supabase.from("imphq_wa_campaign_logs").insert({
                step_id: step.id,
                campaign_id: campaign.id,
                group_jid: groupJid,
                status: "failed",
                error: ((bothFailed ? "BOTH_FAILED: " : "") + (err.message || "")).slice(0, 500),
              });
              totalFailed++;
              console.error(`[Campaign ${campaign.name}] Failed step ${step.step_order} to ${groupJid}: ${err.message}`);
            }
          }
        }
      }

      // Pause campaign if both providers failed and toggle is on
      if (bothFailed && (campaign as any).pause_on_failure) {
        await supabase.from("imphq_wa_campaigns").update({ status: "paused" } as any).eq("id", campaign.id);
        console.warn(`[Campaign ${campaign.name}] PAUSED (both providers failed)`);
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

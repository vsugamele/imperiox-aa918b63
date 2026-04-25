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

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");

    if (!slug) {
      return new Response(JSON.stringify({ error: "slug required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch distributor
    const { data: dist, error: distErr } = await supabase
      .from("imphq_wa_group_distributors")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

    if (distErr || !dist) {
      return new Response(JSON.stringify({ error: "Link não encontrado ou inativo" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const groups: string[] = dist.redirect_order || [];
    if (groups.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum grupo configurado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const maxPerGroup = dist.max_per_group || 250;
    const weights: Record<string, number> = (dist.weights && typeof dist.weights === "object") ? dist.weights : {};

    // Count clicks per group to find the least full
    const { data: clickCounts } = await supabase
      .from("imphq_wa_distributor_clicks")
      .select("group_jid")
      .eq("distributor_id", dist.id);

    const countMap: Record<string, number> = {};
    for (const jid of groups) countMap[jid] = 0;
    for (const click of clickCounts || []) {
      if (countMap[click.group_jid] !== undefined) {
        countMap[click.group_jid]++;
      }
    }

    // 6C: skip full groups, then pick by weighted rotation among non-full
    const available = groups.filter((jid) => countMap[jid] < maxPerGroup);
    let targetGroup = groups[0];

    if (available.length > 0) {
      const hasWeights = Object.keys(weights).length > 0;
      if (hasWeights) {
        // Weighted random among available: weight default = 1
        const pool = available.map((jid) => ({ jid, w: Math.max(0, Number(weights[jid] ?? 1)) }));
        const total = pool.reduce((s, p) => s + p.w, 0);
        if (total > 0) {
          let r = Math.random() * total;
          for (const p of pool) {
            r -= p.w;
            if (r <= 0) { targetGroup = p.jid; break; }
          }
        } else {
          targetGroup = available[0];
        }
      } else {
        // Sequential fill: first non-full
        targetGroup = available[0];
      }
    }

    // Hash IP for anti-fraud (simple hash)
    const forwarded = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const ip = forwarded.split(",")[0].trim();
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(ip + slug));
    const ipHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);

    const userAgent = req.headers.get("user-agent") || "";

    // Record click
    await supabase.from("imphq_wa_distributor_clicks").insert({
      distributor_id: dist.id,
      group_jid: targetGroup,
      ip_hash: ipHash,
      user_agent: userAgent.slice(0, 500),
    });

    // Increment click count
    await supabase
      .from("imphq_wa_group_distributors")
      .update({ click_count: (dist.click_count || 0) + 1 })
      .eq("id", dist.id);

    // Build WhatsApp group invite link from JID
    // JID format: 123456789@g.us → https://chat.whatsapp.com/invite/<code>
    // We can't generate invite links from JID alone, so we redirect to a stored invite URL
    // For now, return the target group info for the frontend to handle
    // OR if the group JID contains an invite code stored in redirect_order metadata

    // Return redirect info
    return new Response(JSON.stringify({
      success: true,
      target_group: targetGroup,
      click_count: (dist.click_count || 0) + 1,
      group_counts: countMap,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("wa-group-distributor error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

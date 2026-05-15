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

    // Hash IP cedo (necessário para cohort)
    const forwardedEarly = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const ipEarly = forwardedEarly.split(",")[0].trim();
    const encEarly = new TextEncoder();
    const hashEarly = await crypto.subtle.digest("SHA-256", encEarly.encode(ipEarly + slug));
    const ipHashEarly = Array.from(new Uint8Array(hashEarly)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);

    // === ROTAÇÃO SEMANAL ===
    if (dist.rotation_mode && dist.rotation_mode !== "none") {
      let targetWeekIndex = dist.current_week || 1;

      if (dist.rotation_mode === "weekly_cohort") {
        const { data: cohort } = await supabase
          .from("imphq_wa_distributor_cohorts")
          .select("week_index")
          .eq("distributor_id", dist.id)
          .eq("ip_hash", ipHashEarly)
          .maybeSingle();
        if (cohort) {
          targetWeekIndex = cohort.week_index;
        } else {
          await supabase.from("imphq_wa_distributor_cohorts").insert({
            distributor_id: dist.id,
            ip_hash: ipHashEarly,
            week_index: targetWeekIndex,
          });
        }
      }

      const { data: week } = await supabase
        .from("imphq_wa_distributor_weeks")
        .select("group_jid, invite_url")
        .eq("distributor_id", dist.id)
        .eq("week_index", targetWeekIndex)
        .maybeSingle();

      if (week) {
        // Registra clique
        await supabase.from("imphq_wa_distributor_clicks").insert({
          distributor_id: dist.id,
          group_jid: week.group_jid,
          ip_hash: ipHashEarly,
          user_agent: (req.headers.get("user-agent") || "").slice(0, 500),
        });
        await supabase.rpc("increment_distributor_click", { _dist_id: dist.id });

        if (week.invite_url && /^https?:\/\//i.test(week.invite_url)) {
          return new Response(null, {
            status: 302,
            headers: { ...corsHeaders, Location: week.invite_url },
          });
        }
        return new Response(JSON.stringify({
          success: true,
          mode: dist.rotation_mode,
          week_index: targetWeekIndex,
          target_group: week.group_jid,
          hint: "Configure invite_url na semana para redirect 302.",
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // sem semana configurada: cai no fluxo legado
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

    // Count clicks per group via parallel HEAD requests (avoids 1000-row select limit)
    const countMap: Record<string, number> = {};
    await Promise.all(
      groups.map(async (jid) => {
        const { count } = await supabase
          .from("imphq_wa_distributor_clicks")
          .select("group_jid", { count: "exact", head: true })
          .eq("distributor_id", dist.id)
          .eq("group_jid", jid);
        countMap[jid] = count || 0;
      })
    );

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

    // Anti-fraud: rate-limit per IP hash (max 3 clicks / hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentByIp } = await supabase
      .from("imphq_wa_distributor_clicks")
      .select("id", { count: "exact", head: true })
      .eq("distributor_id", dist.id)
      .eq("ip_hash", ipHash)
      .gte("created_at", oneHourAgo);

    if ((recentByIp || 0) >= 3) {
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Record click
    await supabase.from("imphq_wa_distributor_clicks").insert({
      distributor_id: dist.id,
      group_jid: targetGroup,
      ip_hash: ipHash,
      user_agent: userAgent.slice(0, 500),
    });

    // Atomic increment via RPC (avoids race condition)
    await supabase.rpc("increment_distributor_click", { _dist_id: dist.id });

    // 302 redirect when invite URL is configured for the chosen group
    const invites: Record<string, string> = (dist.group_invites && typeof dist.group_invites === "object") ? dist.group_invites : {};
    const inviteUrl = invites[targetGroup];
    if (inviteUrl && /^https?:\/\//i.test(inviteUrl)) {
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: inviteUrl },
      });
    }

    // Fallback JSON (no invite URL configured)
    return new Response(JSON.stringify({
      success: true,
      target_group: targetGroup,
      click_count: (dist.click_count || 0) + 1,
      group_counts: countMap,
      hint: "Configure group_invites no distribuidor para redirect 302 direto ao WhatsApp.",
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

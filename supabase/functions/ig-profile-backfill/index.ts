// ig-profile-backfill — Busca nome+foto para conversas do IG sem participant_username
// Roda on-demand pelo UI ou como cron semanal
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json().catch(() => ({}));
    const accountId = body?.account_id || null; // optional filter

    // 1. Get all IG accounts
    let accountsQuery = supa.from("imphq_ig_accounts").select("id, ig_user_id, project_id");
    if (accountId) accountsQuery = accountsQuery.eq("id", accountId);
    const { data: accounts } = await accountsQuery;
    if (!accounts || accounts.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "No accounts found" }), { headers: corsHeaders });
    }

    let totalUpdated = 0;
    let totalFailed = 0;

    for (const account of accounts) {
      // 2. Get page access token
      const { data: credsData } = await supa
        .from("imphq_integration_credentials")
        .select("credentials")
        .eq("project_id", account.project_id)
        .eq("provider", "instagram")
        .maybeSingle();

      const pageAccessToken = credsData?.credentials?.page_access_token;
      if (!pageAccessToken) {
        console.warn(`[backfill] No token for account ${account.id}`);
        continue;
      }

      // 3. Get conversations without username/name (limit 50 per run to respect rate limits)
      const { data: convs } = await supa
        .from("imphq_ig_conversations")
        .select("id, participant_id, participant_username, participant_name, participant_avatar")
        .eq("account_id", account.id)
        .or("participant_username.is.null,participant_name.is.null")
        .limit(50);

      if (!convs || convs.length === 0) continue;
      console.log(`[backfill] Found ${convs.length} conversations without profile for account ${account.id}`);

      for (const conv of convs) {
        try {
          // Try Instagram Graph API to get user info
          const profileRes = await fetch(
            `https://graph.facebook.com/v21.0/${conv.participant_id}?fields=name,username,profile_pic&access_token=${pageAccessToken}`
          );

          if (!profileRes.ok) {
            // If 400 (user not accessible due to privacy), set a clean fallback so we don't retry forever
            const errData = await profileRes.json().catch(() => ({}));
            const errCode = errData?.error?.code;
            if (errCode === 100 || errCode === 190 || profileRes.status === 400 || profileRes.status === 403) {
              // Privacy-restricted — store a short ID as username so UI shows something
              const shortId = conv.participant_id.slice(-6);
              await supa.from("imphq_ig_conversations").update({
                participant_username: `user_${shortId}`,
                participant_name: `Lead #${shortId}`,
              }).eq("id", conv.id);
              totalUpdated++;
            } else {
              totalFailed++;
            }
            continue;
          }

          const profile = await profileRes.json();
          const updateData: any = {};
          if (profile.username) updateData.participant_username = profile.username;
          if (profile.name) updateData.participant_name = profile.name;
          if (profile.profile_pic) updateData.participant_avatar = profile.profile_pic;

          // Fallback if API returns empty
          if (!profile.username && !profile.name) {
            const shortId = conv.participant_id.slice(-6);
            updateData.participant_username = updateData.participant_username || `user_${shortId}`;
            updateData.participant_name = updateData.participant_name || `Lead #${shortId}`;
          }

          if (Object.keys(updateData).length > 0) {
            await supa.from("imphq_ig_conversations").update(updateData).eq("id", conv.id);
            totalUpdated++;
            console.log(`[backfill] Updated ${conv.participant_id} → ${profile.username || profile.name}`);
          }

          // Rate limit: 1 req/200ms to stay well within 200/hour user token limits
          await new Promise(r => setTimeout(r, 200));

        } catch (e: any) {
          console.warn(`[backfill] Error for ${conv.participant_id}:`, e.message);
          totalFailed++;
        }
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      updated: totalUpdated,
      failed: totalFailed,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});

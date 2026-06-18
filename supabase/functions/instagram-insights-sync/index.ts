// Sincroniza posts + métricas do Instagram via Zernio API
// Salva em imphq_ig_media, imphq_ig_media_insights e imphq_ig_account_insights
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ZERNIO = "https://zernio.com/api/v1";

function json(d: any, s = 200) {
  return new Response(JSON.stringify(d), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function tryFetch(urls: string[], headers: Record<string, string>) {
  let lastErr = "";
  for (const u of urls) {
    try {
      const r = await fetch(u, { headers });
      if (r.ok) return { ok: true as const, data: await r.json(), url: u };
      lastErr = `${r.status} ${u}`;
    } catch (e: any) {
      lastErr = e?.message || String(e);
    }
  }
  return { ok: false as const, error: lastErr };
}

function pickNumber(...vals: any[]): number {
  for (const v of vals) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

async function syncAccount(supa: any, account: any, creds: any, limit = 50) {
  const apiKey = creds?.zernio_api_key;
  const zernioAccountId = creds?.zernio_account_id;
  if (!apiKey || !zernioAccountId) {
    return { ok: false, error: "missing zernio credentials" };
  }
  const auth = { Authorization: `Bearer ${apiKey}` };
  const result: any = {
    account_id: account.id,
    posts_synced: 0,
    insights_saved: 0,
    account_snapshot: false,
    errors: [] as string[],
  };

  // 1) posts
  const postsRes = await tryFetch(
    [
      `${ZERNIO}/posts?accountId=${zernioAccountId}&limit=${limit}`,
      `${ZERNIO}/media?accountId=${zernioAccountId}&limit=${limit}`,
      `${ZERNIO}/accounts/${zernioAccountId}/posts?limit=${limit}`,
      `${ZERNIO}/accounts/${zernioAccountId}/media?limit=${limit}`,
    ],
    auth,
  );

  if (!postsRes.ok) {
    result.errors.push(`posts: ${postsRes.error}`);
  } else {
    const list: any[] = postsRes.data?.posts || postsRes.data?.media || postsRes.data?.data || [];
    const today = new Date().toISOString().slice(0, 10);

    for (const p of list) {
      const igMediaId = p.ig_id || p.igMediaId || p.media_id || p.mediaId || p.id || p._id;
      if (!igMediaId) continue;

      const payload: any = {
        account_id: account.id,
        project_id: account.project_id,
        ig_media_id: String(igMediaId),
        zernio_post_id: p.id || p._id || null,
        media_type: p.mediaType || p.media_type || p.type || null,
        media_product_type: p.mediaProductType || p.media_product_type || null,
        caption: p.caption || p.text || null,
        permalink: p.permalink || p.link || p.url || null,
        thumbnail_url: p.thumbnailUrl || p.thumbnail_url || p.thumbnail || null,
        media_url: p.mediaUrl || p.media_url || null,
        posted_at: p.timestamp || p.publishedAt || p.created_at || p.createdAt || null,
        raw: p,
      };

      const { data: mediaRow, error: upErr } = await supa
        .from("imphq_ig_media")
        .upsert(payload, { onConflict: "account_id,ig_media_id" })
        .select("id")
        .single();

      if (upErr || !mediaRow) {
        result.errors.push(`media upsert ${igMediaId}: ${upErr?.message || "no row"}`);
        continue;
      }
      result.posts_synced++;

      // métricas vindas no próprio post
      const metrics = p.insights || p.metrics || p.stats || p;
      const likes = pickNumber(metrics.likes, metrics.likeCount, metrics.like_count, p.likes_count);
      const comments = pickNumber(metrics.comments, metrics.commentCount, metrics.comments_count, p.comments_count);
      const saves = pickNumber(metrics.saves, metrics.saved, metrics.saveCount);
      const shares = pickNumber(metrics.shares, metrics.shareCount);
      const reach = pickNumber(metrics.reach);
      const impressions = pickNumber(metrics.impressions, metrics.views);
      const videoViews = pickNumber(metrics.videoViews, metrics.video_views, metrics.plays);

      // se nenhum número veio embutido, tenta endpoint de insights
      const noEmbedded =
        likes + comments + saves + shares + reach + impressions + videoViews === 0;
      let extra: any = null;
      if (noEmbedded) {
        const insightsRes = await tryFetch(
          [
            `${ZERNIO}/posts/${payload.zernio_post_id || igMediaId}/insights`,
            `${ZERNIO}/media/${payload.zernio_post_id || igMediaId}/insights`,
            `${ZERNIO}/posts/${igMediaId}/metrics`,
          ],
          auth,
        );
        if (insightsRes.ok) extra = insightsRes.data;
      }

      const ex = extra?.insights || extra?.metrics || extra?.data || extra || {};
      const finalLikes = likes || pickNumber(ex.likes, ex.likeCount);
      const finalComments = comments || pickNumber(ex.comments, ex.commentCount);
      const finalSaves = saves || pickNumber(ex.saves, ex.saved);
      const finalShares = shares || pickNumber(ex.shares);
      const finalReach = reach || pickNumber(ex.reach);
      const finalImpr = impressions || pickNumber(ex.impressions, ex.views);
      const finalViews = videoViews || pickNumber(ex.videoViews, ex.video_views, ex.plays);
      const engagement = finalLikes + finalComments + finalSaves + finalShares;

      const { error: insErr } = await supa
        .from("imphq_ig_media_insights")
        .upsert(
          {
            media_id: mediaRow.id,
            snapshot_date: today,
            likes: finalLikes,
            comments: finalComments,
            saves: finalSaves,
            shares: finalShares,
            reach: finalReach,
            impressions: finalImpr,
            video_views: finalViews,
            engagement,
            raw: extra || metrics || null,
          },
          { onConflict: "media_id,snapshot_date" },
        );
      if (insErr) result.errors.push(`insight ${igMediaId}: ${insErr.message}`);
      else result.insights_saved++;
    }
  }

  // 2) account-level snapshot
  const accRes = await tryFetch(
    [
      `${ZERNIO}/accounts/${zernioAccountId}/insights`,
      `${ZERNIO}/accounts/${zernioAccountId}/metrics`,
      `${ZERNIO}/accounts/${zernioAccountId}`,
      `${ZERNIO}/insights?accountId=${zernioAccountId}`,
    ],
    auth,
  );
  if (accRes.ok) {
    const a = accRes.data?.account || accRes.data?.data || accRes.data || {};
    const m = a.insights || a.metrics || a.stats || a;
    const followers = pickNumber(m.followers, m.followersCount, m.followers_count, a.followers_count);
    const follows = pickNumber(m.follows, m.following, m.followsCount, m.follows_count);
    const mediaCount = pickNumber(m.mediaCount, m.media_count, a.media_count);
    const reach = pickNumber(m.reach);
    const impressions = pickNumber(m.impressions);
    const profileViews = pickNumber(m.profileViews, m.profile_views);
    const websiteClicks = pickNumber(m.websiteClicks, m.website_clicks);

    if (followers + reach + impressions + profileViews + mediaCount > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supa
        .from("imphq_ig_account_insights")
        .upsert(
          {
            account_id: account.id,
            project_id: account.project_id,
            snapshot_date: today,
            followers_count: followers,
            follows_count: follows,
            media_count: mediaCount,
            reach,
            impressions,
            profile_views: profileViews,
            website_clicks: websiteClicks,
            raw: accRes.data,
          },
          { onConflict: "account_id,snapshot_date" },
        );
      if (error) result.errors.push(`acc insight: ${error.message}`);
      else result.account_snapshot = true;
    }
  } else {
    result.errors.push(`account: ${accRes.error}`);
  }

  return { ok: true, ...result };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const projectId: string | undefined = body.project_id;
    const limit: number = Math.min(Number(body.limit) || 50, 100);

    // resolve contas alvo
    let accountsQuery = supa
      .from("imphq_ig_accounts")
      .select("id, project_id, ig_user_id, page_id, status")
      .eq("status", "active");
    if (projectId) accountsQuery = accountsQuery.eq("project_id", projectId);
    const { data: accounts, error: accErr } = await accountsQuery;
    if (accErr) return json({ error: accErr.message }, 500);
    if (!accounts?.length) return json({ ok: true, processed: 0, results: [] });

    const out: any[] = [];
    for (const acc of accounts) {
      const { data: credRow } = await supa
        .from("imphq_integration_credentials")
        .select("credentials")
        .eq("project_id", acc.project_id)
        .eq("provider", "instagram")
        .maybeSingle();
      const creds = credRow?.credentials;
      if (!creds?.zernio_api_key || !creds?.zernio_account_id) {
        out.push({ account_id: acc.id, skipped: "no zernio creds" });
        continue;
      }
      const r = await syncAccount(supa, acc, creds, limit);
      out.push(r);
    }

    return json({ ok: true, processed: out.length, results: out });
  } catch (e: any) {
    console.error("[instagram-insights-sync]", e);
    return json({ error: e?.message || "internal" }, 500);
  }
});

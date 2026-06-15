// Polling de comentários do Instagram via Meta Graph API.
// Rede de segurança: garante recuperação de comentários que o webhook da Meta tenha perdido.
// Varre os últimos N posts de cada conta IG conectada e faz upsert em imphq_ig_comments por comment_id.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GRAPH = "https://graph.facebook.com/v21.0";

function json(d: any, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function processAccount(supa: any, account: any, opts: { maxPosts: number; maxComments: number }) {
  const result = { account_id: account.id, project_id: account.project_id, posts_scanned: 0, comments_upserted: 0, errors: [] as string[] };

  const { data: credRow } = await supa
    .from("imphq_integration_credentials")
    .select("credentials")
    .eq("project_id", account.project_id)
    .eq("provider", "instagram")
    .maybeSingle();

  const token = credRow?.credentials?.page_access_token;
  if (!token) {
    result.errors.push("missing page_access_token");
    return result;
  }
  const igUserId = account.ig_user_id;
  if (!igUserId) {
    result.errors.push("missing ig_user_id");
    return result;
  }

  // 1) últimos N posts
  const mediaUrl = `${GRAPH}/${igUserId}/media?fields=id,timestamp&limit=${opts.maxPosts}&access_token=${encodeURIComponent(token)}`;
  const mediaRes = await fetch(mediaUrl);
  if (!mediaRes.ok) {
    result.errors.push(`media fetch ${mediaRes.status}: ${(await mediaRes.text()).slice(0, 200)}`);
    return result;
  }
  const mediaData = await mediaRes.json();
  const posts: any[] = mediaData.data || [];

  for (const post of posts) {
    result.posts_scanned++;
    const commentsUrl = `${GRAPH}/${post.id}/comments?fields=id,text,username,from,parent_id,timestamp&limit=${opts.maxComments}&access_token=${encodeURIComponent(token)}`;
    const commRes = await fetch(commentsUrl);
    if (!commRes.ok) {
      result.errors.push(`comments ${post.id} ${commRes.status}`);
      continue;
    }
    const commData = await commRes.json();
    const comments: any[] = commData.data || [];

    for (const c of comments) {
      const fromUserId = c.from?.id || null;
      const fromUsername = c.username || c.from?.username || null;
      // pula próprios
      if (fromUserId && fromUserId === igUserId) continue;

      const { error } = await supa.from("imphq_ig_comments").upsert({
        account_id: account.id,
        media_id: post.id,
        comment_id: c.id,
        parent_comment_id: c.parent_id || null,
        from_user_id: fromUserId,
        from_username: fromUsername,
        text: c.text || null,
        created_at: c.timestamp || new Date().toISOString(),
      }, { onConflict: "comment_id" });

      if (error) {
        result.errors.push(`upsert ${c.id}: ${error.message}`);
      } else {
        result.comments_upserted++;
      }
    }
  }

  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let body: any = {};
  try { body = await req.json(); } catch { /* sem body = cron */ }

  const projectId: string | undefined = body?.project_id;
  const maxPosts: number = Math.min(Number(body?.max_posts ?? 25), 100);
  const maxComments: number = Math.min(Number(body?.max_comments ?? 50), 200);

  // contas alvo
  let q = supa.from("imphq_ig_accounts").select("id, project_id, ig_user_id, status").eq("status", "active");
  if (projectId) q = q.eq("project_id", projectId);
  const { data: accounts, error } = await q;
  if (error) return json({ error: error.message }, 500);

  const results = [] as any[];
  for (const acc of accounts || []) {
    try {
      const r = await processAccount(supa, acc, { maxPosts, maxComments });
      results.push(r);
    } catch (e: any) {
      results.push({ account_id: acc.id, project_id: acc.project_id, error: e?.message || String(e) });
    }
  }

  const totals = results.reduce((acc, r) => ({
    posts_scanned: acc.posts_scanned + (r.posts_scanned || 0),
    comments_upserted: acc.comments_upserted + (r.comments_upserted || 0),
  }), { posts_scanned: 0, comments_upserted: 0 });

  console.log(`[ig-comments-poller] accounts=${accounts?.length ?? 0} posts=${totals.posts_scanned} comments=${totals.comments_upserted}`);

  return json({ success: true, accounts: accounts?.length ?? 0, ...totals, results });
});

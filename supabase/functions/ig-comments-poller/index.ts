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
const ZERNIO = "https://zernio.com/api/v1";

function json(d: any, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function upsertComment(supa: any, result: any, row: any) {
  const { error } = await supa.from("imphq_ig_comments").upsert(row, { onConflict: "comment_id" });
  if (error) result.errors.push(`upsert ${row.comment_id}: ${error.message}`);
  else result.comments_upserted++;
}

async function processViaMeta(supa: any, account: any, creds: any, opts: { maxPosts: number; maxComments: number }, result: any) {
  const token = creds?.page_access_token;
  if (!token) { result.errors.push("missing page_access_token"); return; }
  const igUserId = account.ig_user_id;
  if (!igUserId) { result.errors.push("missing ig_user_id"); return; }

  const mediaUrl = `${GRAPH}/${igUserId}/media?fields=id,timestamp&limit=${opts.maxPosts}&access_token=${encodeURIComponent(token)}`;
  const mediaRes = await fetch(mediaUrl);
  if (!mediaRes.ok) { result.errors.push(`media fetch ${mediaRes.status}: ${(await mediaRes.text()).slice(0, 200)}`); return; }
  const posts: any[] = (await mediaRes.json()).data || [];

  for (const post of posts) {
    result.posts_scanned++;
    const commRes = await fetch(`${GRAPH}/${post.id}/comments?fields=id,text,username,from,parent_id,timestamp&limit=${opts.maxComments}&access_token=${encodeURIComponent(token)}`);
    if (!commRes.ok) { result.errors.push(`comments ${post.id} ${commRes.status}`); continue; }
    const comments: any[] = (await commRes.json()).data || [];
    for (const c of comments) {
      const fromUserId = c.from?.id || null;
      if (fromUserId && fromUserId === igUserId) continue;
      await upsertComment(supa, result, {
        account_id: account.id,
        media_id: post.id,
        comment_id: c.id,
        parent_comment_id: c.parent_id || null,
        from_user_id: fromUserId,
        from_username: c.username || c.from?.username || null,
        text: c.text || null,
        created_at: c.timestamp || new Date().toISOString(),
      });
    }
  }
}

async function processViaZernio(supa: any, account: any, creds: any, opts: { maxPosts: number; maxComments: number }, result: any) {
  const apiKey = creds?.zernio_api_key;
  const zernioAccountId = creds?.zernio_account_id;
  if (!apiKey || !zernioAccountId) { result.errors.push("missing zernio credentials"); return; }

  const auth = { "Authorization": `Bearer ${apiKey}` };

  // Tenta múltiplos endpoints de posts (a API do Zernio pode variar)
  const postEndpoints = [
    `${ZERNIO}/posts?accountId=${zernioAccountId}&limit=${opts.maxPosts}`,
    `${ZERNIO}/media?accountId=${zernioAccountId}&limit=${opts.maxPosts}`,
    `${ZERNIO}/accounts/${zernioAccountId}/posts?limit=${opts.maxPosts}`,
  ];

  let posts: any[] = [];
  let lastErr = "";
  for (const url of postEndpoints) {
    try {
      const r = await fetch(url, { headers: auth });
      if (!r.ok) { lastErr = `${r.status} ${url}`; continue; }
      const d = await r.json();
      posts = d.posts || d.media || d.data || [];
      if (posts.length >= 0) { lastErr = ""; break; }
    } catch (e: any) { lastErr = e?.message || String(e); }
  }
  if (lastErr && posts.length === 0) {
    result.errors.push(`zernio posts fetch failed: ${lastErr}`);
    return;
  }

  for (const post of posts) {
    const postId = post.id || post._id || post.mediaId || post.postId;
    if (!postId) continue;
    result.posts_scanned++;

    const commentEndpoints = [
      `${ZERNIO}/posts/${postId}/comments?limit=${opts.maxComments}`,
      `${ZERNIO}/media/${postId}/comments?limit=${opts.maxComments}`,
      `${ZERNIO}/comments?postId=${postId}&limit=${opts.maxComments}`,
    ];
    let comments: any[] = [];
    let cErr = "";
    for (const url of commentEndpoints) {
      try {
        const r = await fetch(url, { headers: auth });
        if (!r.ok) { cErr = `${r.status}`; continue; }
        const d = await r.json();
        comments = d.comments || d.data || [];
        cErr = ""; break;
      } catch (e: any) { cErr = e?.message || String(e); }
    }
    if (cErr) { result.errors.push(`zernio comments ${postId}: ${cErr}`); continue; }

    for (const c of comments) {
      const rawId = c.id || c._id || c.commentId;
      if (!rawId) continue;
      const fromUserId = c.from?.id || c.user?.id || c.userId || c.authorId || null;
      // pula comentários da própria conta
      if (fromUserId && (fromUserId === account.ig_user_id || fromUserId === zernioAccountId)) continue;
      const fromUsername = c.from?.username || c.user?.username || c.username || c.author?.username || null;
      await upsertComment(supa, result, {
        account_id: account.id,
        media_id: String(postId),
        comment_id: `zernio-${rawId}`,
        parent_comment_id: c.parentId || c.parent_id || c.replyTo || null,
        from_user_id: fromUserId,
        from_username: fromUsername,
        text: c.text || c.message || c.body || null,
        created_at: c.createdAt || c.timestamp || c.created_at || new Date().toISOString(),
      });
    }
  }
}

async function processAccount(supa: any, account: any, opts: { maxPosts: number; maxComments: number }) {
  const result = { account_id: account.id, project_id: account.project_id, posts_scanned: 0, comments_upserted: 0, errors: [] as string[] };

  const { data: credRow } = await supa
    .from("imphq_integration_credentials")
    .select("credentials")
    .eq("project_id", account.project_id)
    .eq("provider", "instagram")
    .maybeSingle();

  const creds = credRow?.credentials;
  if (!creds) { result.errors.push("missing instagram credentials"); return result; }

  if (creds.auth_method === "zernio") {
    await processViaZernio(supa, account, creds, opts, result);
  } else {
    await processViaMeta(supa, account, creds, opts, result);
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

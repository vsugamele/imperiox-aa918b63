import { z } from "https://esm.sh/zod@3.25.76";
// Polling de comentários do Instagram via Meta Graph API.
// Rede de segurança: garante recuperação de comentários que o webhook da Meta tenha perdido.
// Varre os últimos N posts de cada conta IG conectada e faz upsert em imphq_ig_comments por comment_id.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { runCommentTrigger } from "../_shared/ig-trigger-match.ts";

function makeClient(url: string, key: string) { return createClient(url, key); }
function errorMessage(value: unknown): string | undefined { if (value && typeof value === "object" && "message" in value && typeof value.message === "string") return value.message; return undefined; }
interface IgAccount { id: string; project_id: string; ig_user_id: string | null }
interface IgCredentials { page_access_token?: string; zernio_api_key?: string; zernio_account_id?: string }
interface PollResult { account_id: string; project_id: string; posts_scanned: number; comments_upserted: number; errors: string[] }
interface CommentRow { account_id: string; media_id?: string | null; comment_id?: string | null; parent_comment_id: string | null; from_user_id: string | null; from_username: string | null; text: string | null; created_at: string }
const Text = z.string().nullish();
const Author = z.object({ id: Text, username: Text }).passthrough();
const Comment = z.object({ id: Text, commentId: Text, _id: Text, authorId: Text, from: Author.nullish(), user: Author.nullish(), author: Author.nullish(), userId: Text, authorUsername: Text, username: Text, parentId: Text, parent_id: Text, replyTo: Text, content: Text, text: Text, message: Text, body: Text, createdTime: Text, createdAt: Text, timestamp: Text, created_at: Text }).passthrough();
const Posts = z.array(z.object({ id: Text }).passthrough());

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GRAPH = "https://graph.facebook.com/v21.0";
const ZERNIO = "https://zernio.com/api/v1";

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function upsertComment(supa: ReturnType<typeof makeClient>, result: PollResult, row: CommentRow, ctx: { projectId: string; accountId: string }) {
  const { error } = await supa.from("imphq_ig_comments").upsert(row, { onConflict: "comment_id" });
  if (error) { result.errors.push(`upsert ${row.comment_id}: ${error.message}`); return; }
  result.comments_upserted++;
  // Dispara matcher (idempotente via imphq_ig_trigger_executions)
  if (row.text && row.from_user_id && row.comment_id) {
    try {
      await runCommentTrigger({
        supa,
        projectId: ctx.projectId,
        accountId: ctx.accountId,
        mediaId: row.media_id || null,
        commentId: row.comment_id,
        commentText: row.text,
        fromUsername: row.from_username || null,
      });
    } catch (e) {
      result.errors.push(`trigger ${row.comment_id}: ${errorMessage(e) || e}`);
    }
  }
}

async function processViaMeta(supa: ReturnType<typeof makeClient>, account: IgAccount, creds: IgCredentials, opts: { maxPosts: number; maxComments: number }, result: PollResult) {
  const token = creds?.page_access_token;
  if (!token) { result.errors.push("missing page_access_token"); return; }
  const igUserId = account.ig_user_id;
  if (!igUserId) { result.errors.push("missing ig_user_id"); return; }

  const mediaUrl = `${GRAPH}/${igUserId}/media?fields=id,timestamp&limit=${opts.maxPosts}&access_token=${encodeURIComponent(token)}`;
  const mediaRes = await fetch(mediaUrl);
  if (!mediaRes.ok) { result.errors.push(`media fetch ${mediaRes.status}: ${(await mediaRes.text()).slice(0, 200)}`); return; }
  const posts = Posts.parse((await mediaRes.json()).data || []);

  for (const post of posts) {
    result.posts_scanned++;
    const commRes = await fetch(`${GRAPH}/${post.id}/comments?fields=id,text,username,from,parent_id,timestamp&limit=${opts.maxComments}&access_token=${encodeURIComponent(token)}`);
    if (!commRes.ok) { result.errors.push(`comments ${post.id} ${commRes.status}`); continue; }
    const comments = z.array(Comment).parse((await commRes.json()).data || []);
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
      }, { projectId: account.project_id, accountId: account.id });
    }
  }
}

async function processViaZernio(supa: ReturnType<typeof makeClient>, account: IgAccount, creds: IgCredentials, opts: { maxPosts: number; maxComments: number }, result: PollResult) {
  const apiKey = creds?.zernio_api_key;
  const zernioAccountId = creds?.zernio_account_id;
  if (!apiKey || !zernioAccountId) { result.errors.push("missing zernio credentials"); return; }

  const auth = { "Authorization": `Bearer ${apiKey}`, "Accept": "application/json" };

  // 1) Listar posts com comentários — endpoint oficial: GET /v1/inbox/comments
  const listUrl = `${ZERNIO}/inbox/comments?accountId=${encodeURIComponent(zernioAccountId)}&platform=instagram&limit=${opts.maxPosts}&sortBy=date&sortOrder=desc`;
  const listRes = await fetch(listUrl, { headers: auth });
  if (!listRes.ok) {
    result.errors.push(`zernio list ${listRes.status}: ${(await listRes.text()).slice(0, 200)}`);
    return;
  }
  const listData = await listRes.json();
  const posts = Posts.parse(listData?.data || []);
  const failed = listData?.meta?.failedAccounts;
  if (Array.isArray(failed) && failed.length) {
    result.errors.push(`zernio failedAccounts: ${JSON.stringify(failed).slice(0, 300)}`);
  }

  for (const post of posts) {
    const postId = post.id;
    if (!postId) continue;
    result.posts_scanned++;

    // 2) Buscar comentários do post — GET /v1/inbox/comments/{postId}?accountId=...
    let cursor: string | undefined = undefined;
    let fetched = 0;
    let safety = 0;
    do {
      safety++;
      const remaining = opts.maxComments - fetched;
      if (remaining <= 0) break;
      const pageLimit = Math.min(remaining, 100);
      const qs = new URLSearchParams({
        accountId: zernioAccountId,
        limit: String(pageLimit),
      });
      if (cursor) qs.set("cursor", cursor);
      const cUrl = `${ZERNIO}/inbox/comments/${encodeURIComponent(postId)}?${qs.toString()}`;
      const cRes = await fetch(cUrl, { headers: auth });
      if (!cRes.ok) {
        result.errors.push(`zernio comments ${postId} ${cRes.status}: ${(await cRes.text()).slice(0, 200)}`);
        break;
      }
      const cData = await cRes.json();
      const comments = z.array(Comment).parse(cData?.data || cData?.comments || []);

      for (const c of comments) {
        const rawId = c.id || c.commentId || c._id;
        if (!rawId) continue;
        const fromUserId = c.authorId || c.from?.id || c.user?.id || c.userId || null;
        if (fromUserId && (fromUserId === account.ig_user_id || fromUserId === zernioAccountId)) continue;
        const fromUsername = c.authorUsername || c.from?.username || c.user?.username || c.username || c.author?.username || null;
        await upsertComment(supa, result, {
          account_id: account.id,
          media_id: String(postId),
          comment_id: `zernio-${rawId}`,
          parent_comment_id: c.parentId || c.parent_id || c.replyTo || null,
          from_user_id: fromUserId,
          from_username: fromUsername,
          text: c.content || c.text || c.message || c.body || null,
          created_at: c.createdTime || c.createdAt || c.timestamp || c.created_at || new Date().toISOString(),
        }, { projectId: account.project_id, accountId: account.id });
        fetched++;
      }

      cursor = cData?.pagination?.nextCursor;
      if (!cData?.pagination?.hasMore) cursor = undefined;
    } while (cursor && safety < 10);
  }
}

async function processAccount(supa: ReturnType<typeof makeClient>, account: IgAccount, opts: { maxPosts: number; maxComments: number }) {
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

  let body: { project_id?: string; max_posts?: unknown; max_comments?: unknown } = {};
  try { body = await req.json(); } catch { /* sem body = cron */ }

  const projectId: string | undefined = body?.project_id;
  const maxPosts: number = Math.min(Number(body?.max_posts ?? 25), 100);
  const maxComments: number = Math.min(Number(body?.max_comments ?? 50), 200);

  // contas alvo
  let q = supa.from("imphq_ig_accounts").select("id, project_id, ig_user_id, status").eq("status", "active");
  if (projectId) q = q.eq("project_id", projectId);
  const { data: accounts, error } = await q;
  if (error) return json({ error: error.message }, 500);

  const results = [] as (PollResult | { account_id: string; project_id: string; error: string })[];
  for (const acc of accounts || []) {
    try {
      const r = await processAccount(supa, acc, { maxPosts, maxComments });
      results.push(r);
    } catch (e) {
      results.push({ account_id: acc.id, project_id: acc.project_id, error: errorMessage(e) || String(e) });
    }
  }

  const totals = results.reduce((acc, r) => ({
    posts_scanned: acc.posts_scanned + ("posts_scanned" in r ? r.posts_scanned : 0),
    comments_upserted: acc.comments_upserted + ("comments_upserted" in r ? r.comments_upserted : 0),
  }), { posts_scanned: 0, comments_upserted: 0 });

  console.log(`[ig-comments-poller] accounts=${accounts?.length ?? 0} posts=${totals.posts_scanned} comments=${totals.comments_upserted}`);

  return json({ success: true, accounts: accounts?.length ?? 0, ...totals, results });
});

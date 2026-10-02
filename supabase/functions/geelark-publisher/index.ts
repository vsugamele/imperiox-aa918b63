// Worker da esteira de conteúdo (Story OP1.2): acompanha as tarefas em andamento no GeeLark e envia as postagens vencidas.
// Só posta peça aprovada, em conta ativa, até 3 tentativas. Lote pequeno por execução (limite da API do GeeLark).
// POST { dry_run?: boolean, limit?: number } — dry_run lista o que sairia sem chamar o GeeLark nem gravar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { dispatchBlocker, geelarkPublishRequest, geelarkTaskId, geelarkTaskOutcome, utmLink, type SocialPlatform } from "../_shared/content-pipeline.ts";
import { geelarkClient } from "../_shared/geelark.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d, null, 2), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

interface PostRow {
  id: string; status: string; attempts: number; scheduled_at: string; platform: string; provider_task_id: string | null; metadata: Record<string, unknown> | null;
  content: { id: string; title: string; caption: string | null; status: string; media_url: string | null } | null;
  account: { id: string; handle: string; status: string; provider: string; geelark_env_id: string | null; link_url: string | null; metadata: Record<string, unknown> | null } | null;
}

const SELECT = "id, status, attempts, scheduled_at, platform, provider_task_id, metadata, content:imphq_content_items(id, title, caption, status, media_url), account:imphq_social_accounts(id, handle, status, provider, geelark_env_id, link_url, metadata)";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dry_run === true;
  const limit = Math.min(Math.max(Number(body?.limit) || 10, 1), 25);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = Deno.env.get("GEELARK_API_TOKEN");
  if (!token && !dryRun) return json({ ok: false, reason: "GEELARK_API_TOKEN não configurado" }, 503);
  const gl = token ? geelarkClient(token) : null;
  const now = new Date();
  const report = { polled: [] as unknown[], dispatched: [] as unknown[], skipped: [] as unknown[], errors: [] as unknown[] };

  try {
    // 1. Tarefas em andamento: atualiza o status da postagem (e da conta, quando a falha é da conta).
    const { data: running, error: runErr } = await supabase.from("imphq_content_posts").select(SELECT).eq("status", "publicando").not("provider_task_id", "is", null).limit(100);
    if (runErr) throw runErr;
    const runningPosts = (running || []) as unknown as PostRow[];
    if (gl && !dryRun && runningPosts.length) {
      const tasks = await gl.queryTasks(runningPosts.map((p) => p.provider_task_id!));
      for (const post of runningPosts) {
        const task = tasks.find((t) => t.id === post.provider_task_id);
        if (!task) continue;
        const outcome = geelarkTaskOutcome(task, post.attempts);
        if (outcome.postStatus === "publicando") continue;
        await supabase.from("imphq_content_posts").update({
          status: outcome.postStatus,
          last_error: outcome.error ?? null,
          provider_task_id: outcome.retry ? null : post.provider_task_id,
          post_url: task.shareLink || null,
          published_at: outcome.postStatus === "publicado" ? now.toISOString() : null,
          updated_at: now.toISOString(),
        }).eq("id", post.id);
        if (outcome.accountStatus && post.account) {
          await supabase.from("imphq_social_accounts").update({ status: outcome.accountStatus, notes: outcome.error ?? null, updated_at: now.toISOString() }).eq("id", post.account.id);
        }
        report.polled.push({ post: post.id, status: outcome.postStatus, account: outcome.accountStatus ?? null, error: outcome.error ?? null });
      }
    } else if (runningPosts.length) {
      report.polled.push({ pending: runningPosts.length, note: dryRun ? "dry_run: não consultado" : "sem token" });
    }

    // 1b. Reserva órfã: "enviando" há mais de 15 min (worker caiu no meio) volta para a fila, ou falha se já gastou as 3 tentativas.
    if (!dryRun) {
      const stale = new Date(now.getTime() - 15 * 60_000).toISOString();
      const { data: stuck } = await supabase.from("imphq_content_posts").select("id, attempts").eq("status", "enviando").lt("updated_at", stale);
      for (const s of stuck || []) {
        await supabase.from("imphq_content_posts").update({ status: s.attempts >= 3 ? "falhou" : "agendado", last_error: "Envio interrompido (reserva expirou)", updated_at: now.toISOString() }).eq("id", s.id).eq("status", "enviando");
        report.polled.push({ post: s.id, status: s.attempts >= 3 ? "falhou" : "agendado", error: "reserva expirou" });
      }
    }

    // 2. Postagens vencidas.
    const { data: due, error: dueErr } = await supabase.from("imphq_content_posts").select(SELECT).eq("status", "agendado").lte("scheduled_at", now.toISOString()).order("scheduled_at").limit(limit);
    if (dueErr) throw dueErr;
    for (const post of (due || []) as unknown as PostRow[]) {
      if (!post.content || !post.account) { report.skipped.push({ post: post.id, why: "peça ou conta não encontrada" }); continue; }
      const blocker = dispatchBlocker({ post, content: post.content, account: post.account }, now);
      if (blocker) { report.skipped.push({ post: post.id, why: blocker }); continue; }

      const platform = post.platform as SocialPlatform;
      // Link clicável só na descrição do YouTube e do Facebook; no TikTok/IG o link fica na bio da conta.
      const link = post.account.link_url && (platform === "youtube" || platform === "facebook")
        ? utmLink(post.account.link_url, { platform, handle: post.account.handle, postId: post.id }) : null;
      const caption = [post.content.caption || post.content.title, link].filter(Boolean).join("\n\n");
      if (dryRun) { report.dispatched.push({ post: post.id, platform, account: post.account.handle, caption, dry_run: true }); continue; }

      // Reserva a postagem (evita dois workers na mesma) e conta a tentativa antes de chamar o GeeLark.
      const attempts = post.attempts + 1;
      const { data: claimed } = await supabase.from("imphq_content_posts")
        .update({ status: "enviando", attempts, updated_at: now.toISOString() })
        .eq("id", post.id).eq("status", "agendado").eq("attempts", post.attempts).select("id");
      if (!claimed?.length) { report.skipped.push({ post: post.id, why: "já reservada por outra execução" }); continue; }

      try {
        const fileType = (post.content.media_url!.split("?")[0].split(".").pop() || "mp4").toLowerCase();
        const videoUrl = await gl!.uploadFromUrl(post.content.media_url!, fileType);
        const page = typeof post.account.metadata?.facebook_page === "string" ? post.account.metadata.facebook_page : null;
        const request = geelarkPublishRequest({ platform, envId: post.account.geelark_env_id!, videoUrl, caption, title: post.content.title, scheduleAt: now, page, label: `imperio-${post.id.slice(0, 8)}` });
        const taskId = geelarkTaskId(await gl!.call(request.path, request.body));
        if (!taskId) throw new Error("GeeLark não devolveu o ID da tarefa");
        await supabase.from("imphq_content_posts").update({ status: "publicando", provider_task_id: taskId, provider_file_url: videoUrl, utm_content: post.id.slice(0, 8), last_error: null, updated_at: new Date().toISOString() }).eq("id", post.id);
        report.dispatched.push({ post: post.id, platform, account: post.account.handle, task: taskId, attempt: attempts });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        await supabase.from("imphq_content_posts").update({ status: attempts >= 3 ? "falhou" : "agendado", last_error: message, updated_at: new Date().toISOString() }).eq("id", post.id);
        report.errors.push({ post: post.id, attempt: attempts, error: message });
      }
    }

    return json({ ok: true, dry_run: dryRun, ...report });
  } catch (e) {
    console.error("geelark-publisher", e);
    return json({ ok: false, error: e instanceof Error ? e.message : String(e), ...report }, 500);
  }
});

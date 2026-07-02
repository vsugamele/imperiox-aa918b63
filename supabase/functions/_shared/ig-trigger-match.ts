// Shared matcher para automações IG (comentários + DM/story).
// Usado por instagram-webhook, zernio-webhook e ig-comments-poller.

type Supa = any;

const RETRY_BACKOFF_MS = [30_000, 2 * 60_000, 10 * 60_000, 60 * 60_000, 4 * 60 * 60_000];

function isMetaBlock(err: string | null | undefined) {
  const s = String(err || "").toLowerCase();
  return /window|24.?hour|7.?day|not allowed|permission|blocked|deleted|expired|closed|forbidden/.test(s);
}

async function incMatch(supa: Supa, t: any) {
  await supa.rpc("increment_trigger_matches", { trigger_id: t.id }).catch(async () => {
    try { await supa.from("imphq_ig_comment_triggers").update({ match_count: (t.match_count || 0) + 1 }).eq("id", t.id); } catch (_) {}
  });
}

async function incDmSent(supa: Supa, t: any) {
  await supa.rpc("increment_trigger_dms", { trigger_id: t.id }).catch(async () => {
    try { await supa.from("imphq_ig_comment_triggers").update({ dm_sent_count: (t.dm_sent_count || 0) + 1 }).eq("id", t.id); } catch (_) {}
  });
}

async function respectsCooldown(supa: Supa, triggerId: string, authorKey: string | null, cooldownHours: number): Promise<boolean> {
  if (!cooldownHours || !authorKey) return true;
  const since = new Date(Date.now() - cooldownHours * 3600 * 1000).toISOString();
  const { data } = await supa
    .from("imphq_ig_trigger_executions")
    .select("id")
    .eq("trigger_id", triggerId)
    .eq("author_key", authorKey)
    .gte("created_at", since)
    .limit(1);
  return !data || data.length === 0;
}

async function underDailyCap(supa: Supa, triggerId: string, dailyCap: number | null): Promise<boolean> {
  if (!dailyCap) return true;
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await supa
    .from("imphq_ig_trigger_executions")
    .select("id", { count: "exact", head: true })
    .eq("trigger_id", triggerId)
    .gte("created_at", since);
  return (count || 0) < dailyCap;
}

function matchesFilters(t: any, content: string): boolean {
  const lc = content.toLowerCase().trim();
  // Negative keywords → bloqueia
  const negs: string[] = Array.isArray(t.negative_keywords) ? t.negative_keywords : [];
  if (negs.some((n) => n && lc.includes(String(n).toLowerCase()))) return false;
  // Regex opcional
  if (t.regex_pattern) {
    try { if (!new RegExp(t.regex_pattern, "i").test(content)) return false; } catch (_) { /* regex inválido → ignora filtro */ }
  }
  return true;
}

async function upsertExecution(supa: Supa, row: {
  dedup_key: string; trigger_id: string; event_type: string; project_id?: string;
  status: string; last_error?: string | null; attempts?: number; next_retry_at?: string | null;
  payload?: any; author_key?: string | null;
}) {
  try {
    await supa.from("imphq_ig_trigger_executions").upsert({
      comment_id: row.dedup_key,
      trigger_id: row.trigger_id,
      event_type: row.event_type,
      status: row.status,
      attempts: row.attempts ?? 1,
      next_retry_at: row.next_retry_at ?? null,
      last_error: row.last_error ?? null,
      idempotency_key: `${row.trigger_id}:${row.dedup_key}`,
      payload: row.payload ?? null,
    }, { onConflict: "comment_id" });
    // author_key só existe se coluna estiver aplicada; ignora se falhar
    if (row.author_key) {
      try { await supa.from("imphq_ig_trigger_executions").update({ author_key: row.author_key }).eq("comment_id", row.dedup_key); } catch (_) {}
    }
  } catch (e: any) {
    console.warn(`[ig-trigger] upsert exec err: ${e?.message || e}`);
  }
}

export type CommentTriggerInput = {
  supa: Supa;
  projectId: string;
  accountId: string;
  mediaId?: string | null;
  commentId: string;
  commentText: string;
  fromUsername?: string | null;
  fromUserId?: string | null;
  mediaProductType?: string | null; // 'FEED' | 'REELS' | 'STORY' | ...
};

export async function runCommentTrigger(input: CommentTriggerInput): Promise<{ matched: boolean; trigger_id?: string }> {
  const { supa, projectId, mediaId, commentId, commentText, fromUsername, fromUserId, mediaProductType } = input;
  if (!commentId || !commentText) return { matched: false };

  // Dedup absoluto: se já existe execução, retorna.
  const { data: dup } = await supa
    .from("imphq_ig_trigger_executions")
    .select("comment_id, status")
    .eq("comment_id", commentId)
    .maybeSingle();
  if (dup && dup.status !== "dead") {
    return { matched: true };
  }

  const { data: triggers } = await supa
    .from("imphq_ig_comment_triggers")
    .select("*")
    .eq("project_id", projectId)
    .eq("is_active", true);

  if (!triggers || triggers.length === 0) return { matched: false };

  const lc = commentText.toLowerCase().trim();
  const authorKey = fromUserId || fromUsername || null;

  for (const t of triggers) {
    const kw = (t.trigger_keyword || "").toLowerCase().trim();
    if (!kw) continue;

    const postMatch = !t.post_id || t.post_id === "all" || t.post_id === "*" || (mediaId && t.post_id === mediaId);
    if (!postMatch) continue;

    const kwMatch = kw === "all" || kw === "*" || lc.includes(kw);
    if (!kwMatch) continue;

    if (t.media_type_filter && mediaProductType && String(t.media_type_filter).toUpperCase() !== String(mediaProductType).toUpperCase()) continue;
    if (!matchesFilters(t, commentText)) continue;
    if (!(await respectsCooldown(supa, t.id, authorKey, t.cooldown_hours || 0))) {
      console.log(`[ig-trigger] cooldown ativo trigger=${t.id} author=${authorKey}`);
      continue;
    }
    if (!(await underDailyCap(supa, t.id, t.daily_cap || null))) {
      console.log(`[ig-trigger] daily_cap atingido trigger=${t.id}`);
      continue;
    }

    console.log(`[ig-trigger] match comment="${commentText.slice(0, 60)}" trigger="${t.trigger_keyword}" post=${mediaId}`);
    await incMatch(supa, t);

    const payload: any = {
      kind: "comment",
      project_id: projectId,
      comment_id: commentId,
      like_enabled: t.like_comment !== false,
      reply_template: t.reply_comment_template || null,
      dm_template: t.send_dm_template || null,
      from_username: fromUsername || null,
      like_done: false,
      reply_done: !t.reply_comment_template,
      dm_done: !t.send_dm_template,
    };

    let anyFailed = false;
    let lastErr: string | null = null;

    // 1) Curtir comentário (opcional, não bloqueia demais passos)
    if (payload.like_enabled) {
      try {
        const rl = await supa.functions.invoke("instagram-api", {
          body: { action: "like_comment", project_id: projectId, comment_id: commentId },
        });
        if (rl.error || (rl.data && rl.data.error)) {
          console.warn(`[ig-trigger] like falhou: ${rl.data?.error || rl.error?.message}`);
        } else {
          payload.like_done = true;
        }
      } catch (e: any) { console.warn(`[ig-trigger] like exception: ${e?.message || e}`); }
    } else {
      payload.like_done = true;
    }

    // 2) Reply público
    if (t.reply_comment_template) {
      const replyText = t.reply_comment_template.replace("{{nome}}", fromUsername || "você");
      try {
        const r = await supa.functions.invoke("instagram-api", {
          body: { action: "reply_comment", project_id: projectId, comment_id: commentId, message: replyText },
        });
        if (r.error || (r.data && r.data.error)) { anyFailed = true; lastErr = r.data?.error || r.error?.message || "reply_comment failed"; }
        else payload.reply_done = true;
      } catch (e: any) { anyFailed = true; lastErr = e?.message || String(e); }
    }

    // 3) DM privada
    if (t.send_dm_template) {
      const dmText = t.send_dm_template.replace("{{nome}}", fromUsername || "você");
      try {
        const res = await supa.functions.invoke("instagram-api", {
          body: { action: "private_reply", project_id: projectId, comment_id: commentId, message: dmText },
        });
        if (res.error || (res.data && res.data.error)) { anyFailed = true; lastErr = res.data?.error || res.error?.message || "private_reply failed"; }
        else { payload.dm_done = true; await incDmSent(supa, t); }
      } catch (e: any) { anyFailed = true; lastErr = e?.message || String(e); }
    }

    const status = anyFailed ? (isMetaBlock(lastErr) ? "dead" : "retrying") : "sent";
    const nextRetry = status === "retrying" ? new Date(Date.now() + RETRY_BACKOFF_MS[0]).toISOString() : null;
    await upsertExecution(supa, {
      dedup_key: commentId, trigger_id: t.id, event_type: "comment", project_id: projectId,
      status, last_error: lastErr, attempts: 1, next_retry_at: nextRetry, payload, author_key: authorKey,
    });

    return { matched: true, trigger_id: t.id };

  }

  return { matched: false };
}

export type DmTriggerInput = {
  supa: Supa;
  projectId: string;
  accountId: string;
  participantId: string;
  content: string;
  eventType: "dm" | "story" | "story_mention";
  dedupKey: string;
  username?: string | null;
};

export async function runDmTrigger(input: DmTriggerInput): Promise<{ matched: boolean; trigger_id?: string }> {
  const { supa, projectId, participantId, content, eventType, dedupKey, username } = input;

  const { data: triggers } = await supa
    .from("imphq_ig_comment_triggers")
    .select("*")
    .eq("project_id", projectId)
    .eq("is_active", true)
    .in("post_id", [eventType, "all", "*", "dm_or_story"]);

  if (!triggers || triggers.length === 0) return { matched: false };

  const lc = (content || "").toLowerCase().trim();
  const authorKey = participantId || username || null;

  for (const t of triggers) {
    const kw = (t.trigger_keyword || "").toLowerCase().trim();
    const kwMatch = !kw || kw === "all" || kw === "*" || lc.includes(kw);
    if (!kwMatch) continue;
    if (!matchesFilters(t, content || "")) continue;
    if (!(await respectsCooldown(supa, t.id, authorKey, t.cooldown_hours || 0))) continue;
    if (!(await underDailyCap(supa, t.id, t.daily_cap || null))) continue;

    if (dedupKey) {
      const { data: dup } = await supa
        .from("imphq_ig_trigger_executions").select("comment_id, status").eq("comment_id", dedupKey).maybeSingle();
      if (dup && dup.status !== "dead") return { matched: true, trigger_id: t.id };
    }

    console.log(`[ig-trigger] match ${eventType} content="${content?.slice(0, 60)}" trigger="${t.trigger_keyword}"`);
    await incMatch(supa, t);

    let anyFailed = false; let lastErr: string | null = null;
    if (t.send_dm_template) {
      const dmText = t.send_dm_template.replace("{{nome}}", username || "você");
      try {
        const res = await supa.functions.invoke("instagram-api", {
          body: { action: "send_text", project_id: projectId, recipient_id: participantId, text: dmText },
        });
        if (res.error || (res.data && res.data.error)) { anyFailed = true; lastErr = res.data?.error || res.error?.message || "send_text failed"; }
        else if (res.data?.success) await incDmSent(supa, t);
      } catch (e: any) { anyFailed = true; lastErr = e?.message || String(e); }
    }

    const status = anyFailed ? (isMetaBlock(lastErr) ? "dead" : "retrying") : "sent";
    const nextRetry = status === "retrying" ? new Date(Date.now() + RETRY_BACKOFF_MS[0]).toISOString() : null;
    await upsertExecution(supa, {
      dedup_key: dedupKey, trigger_id: t.id, event_type: eventType, project_id: projectId,
      status, last_error: lastErr, attempts: 1, next_retry_at: nextRetry,
      payload: { kind: "dm", project_id: projectId, participant_id: participantId, dm_template: t.send_dm_template, username },
      author_key: authorKey,
    });

    return { matched: true, trigger_id: t.id };
  }

  return { matched: false };
}

// ============ Retry worker helper ============
export async function retryPendingExecutions(supa: Supa, batchSize = 25): Promise<{ processed: number; recovered: number; dead: number }> {
  const nowIso = new Date().toISOString();
  const { data: rows } = await supa
    .from("imphq_ig_trigger_executions")
    .select("*")
    .eq("status", "retrying")
    .lte("next_retry_at", nowIso)
    .order("next_retry_at", { ascending: true })
    .limit(batchSize);

  if (!rows || rows.length === 0) return { processed: 0, recovered: 0, dead: 0 };

  let recovered = 0, dead = 0;
  for (const row of rows) {
    const p = row.payload || {};
    const attempt = (row.attempts || 1) + 1;
    let ok = false; let lastErr: string | null = null;

    try {
      if (p.kind === "comment") {
        if (p.reply_template) {
          const rr = await supa.functions.invoke("instagram-api", {
            body: { action: "reply_comment", project_id: p.project_id, comment_id: p.comment_id, message: p.reply_template.replace("{{nome}}", p.from_username || "você") },
          });
          if (rr.error || rr.data?.error) lastErr = rr.data?.error || rr.error?.message || "reply failed";
        }
        if (p.dm_template) {
          const rd = await supa.functions.invoke("instagram-api", {
            body: { action: "private_reply", project_id: p.project_id, comment_id: p.comment_id, message: p.dm_template.replace("{{nome}}", p.from_username || "você") },
          });
          if (rd.error || rd.data?.error) lastErr = rd.data?.error || rd.error?.message || "private_reply failed";
          else ok = true;
        } else if (!lastErr) ok = true;
      } else if (p.kind === "dm") {
        const rd = await supa.functions.invoke("instagram-api", {
          body: { action: "send_text", project_id: p.project_id, recipient_id: p.participant_id, text: (p.dm_template || "").replace("{{nome}}", p.username || "você") },
        });
        if (rd.error || rd.data?.error) lastErr = rd.data?.error || rd.error?.message || "send_text failed";
        else ok = true;
      } else {
        lastErr = "payload sem kind";
      }
    } catch (e: any) { lastErr = e?.message || String(e); }

    if (ok) {
      await supa.from("imphq_ig_trigger_executions").update({ status: "sent", attempts: attempt, last_error: null, next_retry_at: null }).eq("comment_id", row.comment_id);
      recovered++;
    } else {
      const idx = Math.min(attempt - 1, RETRY_BACKOFF_MS.length - 1);
      const willDie = attempt >= RETRY_BACKOFF_MS.length + 1 || isMetaBlock(lastErr);
      await supa.from("imphq_ig_trigger_executions").update({
        status: willDie ? "dead" : "retrying",
        attempts: attempt,
        last_error: lastErr,
        next_retry_at: willDie ? null : new Date(Date.now() + RETRY_BACKOFF_MS[idx]).toISOString(),
      }).eq("comment_id", row.comment_id);
      if (willDie) dead++;
    }
  }

  return { processed: rows.length, recovered, dead };
}

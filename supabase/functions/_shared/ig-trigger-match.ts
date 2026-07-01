// Shared matcher para automações IG (comentários + DM/story).
// Usado por instagram-webhook, zernio-webhook e ig-comments-poller.

type Supa = any;

async function alreadyExecuted(supa: Supa, commentId: string, triggerId: string): Promise<boolean> {
  if (!commentId) return false;
  const { data } = await supa
    .from("imphq_ig_trigger_executions")
    .select("comment_id")
    .eq("comment_id", commentId)
    .maybeSingle();
  if (!data) return false;
  return data.trigger_id === triggerId || true; // qualquer execução prévia bloqueia
}

async function markExecuted(supa: Supa, commentId: string, triggerId: string, eventType: string) {
  if (!commentId) return;
  await supa.from("imphq_ig_trigger_executions").upsert({
    comment_id: commentId,
    trigger_id: triggerId,
    event_type: eventType,
  }, { onConflict: "comment_id" }).catch(() => {});
}

async function incMatch(supa: Supa, t: any) {
  await supa.rpc("increment_trigger_matches", { trigger_id: t.id }).catch(async () => {
    await supa.from("imphq_ig_comment_triggers")
      .update({ match_count: (t.match_count || 0) + 1 })
      .eq("id", t.id);
  });
}

async function incDmSent(supa: Supa, t: any) {
  await supa.rpc("increment_trigger_dms", { trigger_id: t.id }).catch(async () => {
    await supa.from("imphq_ig_comment_triggers")
      .update({ dm_sent_count: (t.dm_sent_count || 0) + 1 })
      .eq("id", t.id);
  });
}

export type CommentTriggerInput = {
  supa: Supa;
  projectId: string;
  accountId: string;
  mediaId?: string | null;
  commentId: string;
  commentText: string;
  fromUsername?: string | null;
};

/**
 * Tenta casar um comentário recém-chegado contra os gatilhos ativos.
 * Faz: reply público no comentário + DM privado.
 * Idempotente por comment_id.
 */
export async function runCommentTrigger(input: CommentTriggerInput): Promise<{ matched: boolean; trigger_id?: string }> {
  const { supa, projectId, accountId, mediaId, commentId, commentText, fromUsername } = input;
  if (!commentId || !commentText) return { matched: false };

  const { data: triggers } = await supa
    .from("imphq_ig_comment_triggers")
    .select("*")
    .eq("project_id", projectId)
    .eq("is_active", true);

  if (!triggers || triggers.length === 0) return { matched: false };

  const lc = commentText.toLowerCase().trim();
  // Prioriza match por post_id específico; depois "all"; depois sem post_id
  const matched = triggers.find((t: any) => {
    const kw = (t.trigger_keyword || "").toLowerCase().trim();
    if (!kw) return false;
    const postMatch =
      !t.post_id ||
      t.post_id === "all" ||
      t.post_id === "*" ||
      (mediaId && t.post_id === mediaId);
    if (!postMatch) return false;
    return kw === "all" || kw === "*" || lc.includes(kw);
  });

  if (!matched) return { matched: false };

  // Dedup
  const { data: dup } = await supa
    .from("imphq_ig_trigger_executions")
    .select("comment_id")
    .eq("comment_id", commentId)
    .maybeSingle();
  if (dup) {
    console.log(`[ig-trigger] dedup: comment ${commentId} já disparou`);
    return { matched: true, trigger_id: matched.id };
  }

  console.log(`[ig-trigger] match comment="${commentText.slice(0, 60)}" trigger="${matched.trigger_keyword}" post=${mediaId}`);
  await incMatch(supa, matched);
  await markExecuted(supa, commentId, matched.id, "comment");

  // 1) Reply público
  if (matched.reply_comment_template) {
    const replyText = matched.reply_comment_template.replace("{{nome}}", fromUsername || "você");
    try {
      await supa.functions.invoke("instagram-api", {
        body: {
          action: "reply_comment",
          project_id: projectId,
          comment_id: commentId,
          message: replyText,
        },
      });
    } catch (e: any) {
      console.warn(`[ig-trigger] reply_comment err: ${e?.message || e}`);
    }
  }

  // 2) DM privado
  if (matched.send_dm_template) {
    const dmText = matched.send_dm_template.replace("{{nome}}", fromUsername || "você");
    try {
      const res = await supa.functions.invoke("instagram-api", {
        body: {
          action: "private_reply",
          project_id: projectId,
          comment_id: commentId,
          message: dmText,
        },
      });
      if (res.data?.success) await incDmSent(supa, matched);
    } catch (e: any) {
      console.warn(`[ig-trigger] private_reply err: ${e?.message || e}`);
    }
  }

  return { matched: true, trigger_id: matched.id };
}

export type DmTriggerInput = {
  supa: Supa;
  projectId: string;
  accountId: string;
  participantId: string;
  content: string;
  eventType: "dm" | "story" | "story_mention";
  dedupKey: string; // ex: message mid
  username?: string | null;
};

/**
 * Casa DM/story_reply/story_mention contra gatilhos cujo post_id == eventType
 * (convenção atual do banco para diferenciar DM x Story).
 */
export async function runDmTrigger(input: DmTriggerInput): Promise<{ matched: boolean; trigger_id?: string }> {
  const { supa, projectId, participantId, content, eventType, dedupKey, username } = input;

  const { data: triggers } = await supa
    .from("imphq_ig_comment_triggers")
    .select("*")
    .eq("project_id", projectId)
    .eq("is_active", true)
    .in("post_id", [eventType, "all", "*", "dm_or_story"]);

  if (!triggers || triggers.length === 0) {
    console.log(`[ig-trigger] ${eventType}: nenhum gatilho ativo para project=${projectId} (post_id="${eventType}"|all|*)`);
    return { matched: false };
  }

  const lc = (content || "").toLowerCase().trim();
  const matched = triggers.find((t: any) => {
    const kw = (t.trigger_keyword || "").toLowerCase().trim();
    if (kw === "all" || kw === "*" || !kw) return true;
    return lc.includes(kw);
  });
  if (!matched) {
    console.log(`[ig-trigger] ${eventType}: ${triggers.length} gatilho(s) ativos mas keyword não bateu. content="${(content || "").slice(0,80)}"`);
    return { matched: false };
  }

  // Dedup por mid
  if (dedupKey) {
    const { data: dup } = await supa
      .from("imphq_ig_trigger_executions")
      .select("comment_id")
      .eq("comment_id", dedupKey)
      .maybeSingle();
    if (dup) {
      console.log(`[ig-trigger] dedup DM: ${dedupKey} já disparou`);
      return { matched: true, trigger_id: matched.id };
    }
  }

  console.log(`[ig-trigger] match ${eventType} content="${content?.slice(0, 60)}" trigger="${matched.trigger_keyword}"`);
  await incMatch(supa, matched);
  await markExecuted(supa, dedupKey, matched.id, eventType);

  if (matched.send_dm_template) {
    const dmText = matched.send_dm_template.replace("{{nome}}", username || "você");
    try {
      const res = await supa.functions.invoke("instagram-api", {
        body: {
          action: "send_text",
          project_id: projectId,
          recipient_id: participantId,
          text: dmText,
        },
      });
      if (res.data?.success) await incDmSent(supa, matched);
    } catch (e: any) {
      console.warn(`[ig-trigger] send_text err: ${e?.message || e}`);
    }
  }

  return { matched: true, trigger_id: matched.id };
}

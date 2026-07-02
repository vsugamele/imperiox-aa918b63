// Instagram API proxy — token e configs por projeto, em imphq_integration_credentials
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const GRAPH = "https://graph.facebook.com/v21.0";

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ============ Zernio API helper — sanitized logging + cascade support ============
function sanitizePayload(payload: any): any {
  if (!payload || typeof payload !== "object") return payload;
  const clone: any = Array.isArray(payload) ? [...payload] : { ...payload };
  const REDACT = ["accountId", "access_token", "apiKey", "api_key", "token", "authorization"];
  for (const k of Object.keys(clone)) {
    if (REDACT.some((r) => k.toLowerCase().includes(r.toLowerCase()))) clone[k] = "[REDACTED]";
    else if (typeof clone[k] === "object") clone[k] = sanitizePayload(clone[k]);
  }
  if ("message" in clone && typeof clone.message === "string") clone.message = `[len=${clone.message.length}]`;
  if ("content" in clone && typeof clone.content === "string") clone.content = `[len=${clone.content.length}]`;
  return clone;
}

async function callZernio(supa: any, opts: {
  project_id?: string;
  action: string;
  endpoint: string; // path starting with /api/v1/...
  method?: string;
  apiKey: string;
  body?: any;
  attempt?: number;
}) {
  const method = opts.method || "POST";
  const url = `https://zernio.com${opts.endpoint}`;
  let status = 0;
  let responseBody: any = null;
  let requestId: string | null = null;
  let errorSummary: string | null = null;
  try {
    const r = await fetch(url, {
      method,
      headers: {
        "Authorization": `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    status = r.status;
    requestId = r.headers.get("x-request-id") || r.headers.get("x-correlation-id");
    const text = await r.text();
    try { responseBody = text ? JSON.parse(text) : null; } catch { responseBody = { raw: text.slice(0, 1000) }; }
    if (!r.ok) errorSummary = (typeof responseBody === "object" ? (responseBody?.error?.message || responseBody?.message || responseBody?.error || JSON.stringify(responseBody).slice(0, 200)) : String(responseBody)).slice(0, 300);
    return { ok: r.ok, status, data: responseBody, requestId, errorSummary };
  } catch (e: any) {
    errorSummary = `network: ${e?.message || String(e)}`.slice(0, 300);
    return { ok: false, status, data: null, requestId, errorSummary };
  } finally {
    try {
      await supa.from("imphq_zernio_api_calls").insert({
        project_id: opts.project_id || null,
        action: opts.action,
        endpoint: opts.endpoint,
        method,
        status,
        attempt: opts.attempt || 1,
        request_payload: sanitizePayload(opts.body || {}),
        response_body: responseBody,
        request_id: requestId,
        success: status >= 200 && status < 300,
        error_summary: errorSummary,
      });
    } catch (_) { /* log-only, never break flow */ }
  }
}


async function getCreds(supa: any, project_id: string) {
  const { data } = await supa
    .from("imphq_integration_credentials")
    .select("credentials")
    .eq("project_id", project_id)
    .eq("provider", "instagram")
    .maybeSingle();
  return data?.credentials || null;
}

async function saveCreds(supa: any, project_id: string, credentials: any) {
  const { data: existing } = await supa
    .from("imphq_integration_credentials")
    .select("id")
    .eq("project_id", project_id)
    .eq("provider", "instagram")
    .maybeSingle();
  if (existing) {
    await supa.from("imphq_integration_credentials").update({ credentials, updated_at: new Date().toISOString() }).eq("id", existing.id);
  } else {
    await supa.from("imphq_integration_credentials").insert({ project_id, provider: "instagram", credentials });
  }
}

// Descobre IG Business Account a partir do user access token (Page-based flow)
async function discoverIgAccount(accessToken: string) {
  const pagesRes = await fetch(`${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}&access_token=${accessToken}`);
  const pages = await pagesRes.json();
  if (pages.error) throw new Error(`Graph: ${pages.error.message}`);
  const page = (pages.data || []).find((p: any) => p.instagram_business_account);
  if (!page) throw new Error("Nenhuma Página do Facebook conectada a uma conta Instagram Business foi encontrada");
  return {
    page_id: page.id,
    page_name: page.name,
    page_access_token: page.access_token,
    ig_user_id: page.instagram_business_account.id,
    username: page.instagram_business_account.username,
    display_name: page.instagram_business_account.name,
    avatar_url: page.instagram_business_account.profile_picture_url,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const url = new URL(req.url);
  let body: any = {};
  try { body = req.method === "POST" ? await req.json() : {}; } catch {}
  const action = url.searchParams.get("action") || body.action;

  try {
    // ============ SAVE_TOKEN ============
    if (action === "save_token") {
      const { project_id, access_token, app_id, app_secret, auth_method, zernio_api_key, zernio_account_id, ig_user_id, username, display_name, avatar_url } = body;
      
      if (auth_method === "zernio") {
        if (!project_id || !zernio_api_key || !zernio_account_id || !ig_user_id) {
          return json({ error: "Campos obrigatórios do Zernio ausentes" }, 400);
        }
        
        const credentials = {
          auth_method: "zernio",
          zernio_api_key,
          zernio_account_id,
          ig_user_id,
          username,
          saved_at: new Date().toISOString()
        };
        
        await saveCreds(supa, project_id, credentials);
        
        // Upsert account row
        const { data: existing } = await supa
          .from("imphq_ig_accounts")
          .select("id")
          .eq("project_id", project_id)
          .or(`ig_user_id.eq.${ig_user_id},username.eq.${username}`)
          .maybeSingle();

        const payload = {
          project_id,
          ig_user_id,
          username,
          page_id: zernio_account_id,
          display_name: display_name || username,
          avatar_url: avatar_url || null,
          status: "active",
          auth_method: "zernio",
          last_refresh_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        };

        if (existing) {
          await supa.from("imphq_ig_accounts").update(payload).eq("id", existing.id);
        } else {
          await supa.from("imphq_ig_accounts").insert(payload);
        }

        return json({ success: true, account: payload });
      }

      if (!project_id || !access_token) return json({ error: "project_id e access_token obrigatórios" }, 400);

      // Descobre conta IG
      const info = await discoverIgAccount(access_token);

      // Salva credenciais
      await saveCreds(supa, project_id, {
        access_token,
        page_access_token: info.page_access_token,
        ig_user_id: info.ig_user_id,
        page_id: info.page_id,
        app_id: app_id || null,
        app_secret: app_secret || null,
        saved_at: new Date().toISOString(),
      });

      // Upsert account row
      const { data: existing } = await supa
        .from("imphq_ig_accounts")
        .select("id")
        .eq("project_id", project_id)
        .eq("ig_user_id", info.ig_user_id)
        .maybeSingle();

      const payload = {
        project_id,
        ig_user_id: info.ig_user_id,
        username: info.username,
        page_id: info.page_id,
        display_name: info.display_name,
        avatar_url: info.avatar_url,
        status: "active",
        auth_method: "manual",
        last_refresh_at: new Date().toISOString(),
        // Token long-lived dura ~60 dias
        expires_at: new Date(Date.now() + 55 * 24 * 60 * 60 * 1000).toISOString(),
      };

      if (existing) {
        await supa.from("imphq_ig_accounts").update(payload).eq("id", existing.id);
      } else {
        await supa.from("imphq_ig_accounts").insert(payload);
      }

      return json({ success: true, account: payload });
    }

    // ============ ZERNIO_LIST_ACCOUNTS ============
    if (action === "zernio_list_accounts") {
      const { zernio_api_key } = body;
      if (!zernio_api_key) return json({ error: "zernio_api_key obrigatório" }, 400);

      const r = await fetch("https://zernio.com/api/v1/accounts", {
        headers: {
          "Authorization": `Bearer ${zernio_api_key}`,
        },
      });
      if (!r.ok) {
        const errBody = await r.text();
        return json({ error: `Zernio error (${r.status}): ${errBody}` }, 400);
      }
      const data = await r.json();
      const igAccounts = (data.accounts || []).filter((acc: any) => acc.platform === "instagram");
      return json({ success: true, accounts: igAccounts });
    }

    // ============ REFRESH_TOKEN ============
    if (action === "refresh_token") {
      const { project_id } = body;
      if (!project_id) return json({ error: "project_id obrigatório" }, 400);
      const creds = await getCreds(supa, project_id);
      if (!creds?.access_token) return json({ error: "Token não encontrado" }, 404);
      if (!creds?.app_id || !creds?.app_secret) {
        return json({ error: "App ID e App Secret necessários para refresh. Cole-os nas credenciais." }, 400);
      }
      const refRes = await fetch(`${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${creds.app_id}&client_secret=${creds.app_secret}&fb_exchange_token=${creds.access_token}`);
      const refData = await refRes.json();
      if (refData.error) return json({ error: refData.error.message }, 400);
      creds.access_token = refData.access_token;
      creds.saved_at = new Date().toISOString();
      await saveCreds(supa, project_id, creds);
      await supa.from("imphq_ig_accounts")
        .update({ last_refresh_at: new Date().toISOString(), expires_at: new Date(Date.now() + 55 * 24 * 60 * 60 * 1000).toISOString(), status: "active" })
        .eq("project_id", project_id);
      return json({ success: true });
    }

    // ============ SEND_TEXT (com fallback Zernio→Meta) ============
    if (action === "send_text") {
      const { project_id, recipient_id, text, metadata } = body;
      if (!project_id || !recipient_id || !text) return json({ error: "Faltam campos" }, 400);
      const creds = await getCreds(supa, project_id);
      if (!creds) return json({ error: "Conta IG não conectada", not_connected: true }, 200);

      let messageId = "";
      let provider = "";
      let zernioErr: string | null = null;

      // 1) Tenta Zernio primeiro se for o método configurado
      if (creds.auth_method === "zernio" && creds.zernio_api_key && creds.zernio_account_id) {
        try {
          const { data: convZ } = await supa
            .from("imphq_ig_conversations")
            .select("id, ig_thread_id")
            .eq("participant_id", recipient_id)
            .maybeSingle();
          const threadId = convZ?.ig_thread_id || recipient_id;
          console.log(`[instagram-api] Sending text via Zernio. Conv: ${threadId}`);
          const zRes = await fetch(`https://zernio.com/api/v1/inbox/conversations/${threadId}/messages`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${creds.zernio_api_key}`, "Content-Type": "application/json" },
            body: JSON.stringify({ accountId: creds.zernio_account_id, message: text }),
          });
          if (!zRes.ok) throw new Error(`Zernio ${zRes.status}: ${(await zRes.text()).slice(0, 200)}`);
          const zData = await zRes.json();
          messageId = zData.messageId || zData.id || "zernio-" + Date.now();
          provider = "zernio";
        } catch (e: any) {
          zernioErr = e.message || String(e);
          console.warn(`[instagram-api] Zernio falhou, tentando fallback Meta: ${zernioErr}`);
        }
      }

      // 2) Fallback / caminho Meta + n8n
      if (!messageId) {
        try {
          if (creds?.n8n_webhook_url) {
            console.log(`[instagram-api] Forwarding send_text to N8N webhook`);
            const nr = await fetch(creds.n8n_webhook_url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ recipient_id, text }),
            });
            if (!nr.ok) throw new Error(`N8N ${nr.status}: ${(await nr.text()).slice(0, 200)}`);
            const resText = await nr.text();
            try {
              const ndata = resText.trim() ? JSON.parse(resText) : {};
              messageId = ndata.message_id || ndata.id || "n8n-" + Date.now();
            } catch { messageId = "n8n-" + Date.now(); }
            provider = zernioErr ? "n8n_fallback" : "n8n";
          } else if (creds?.page_access_token && creds?.ig_user_id) {
            const r = await fetch(`${GRAPH}/me/messages`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                recipient: { id: recipient_id },
                message: { text },
                access_token: creds.page_access_token,
              }),
            });
            const data = await r.json();
            if (data.error) throw new Error(data.error.message);
            messageId = data.message_id;
            provider = zernioErr ? "meta_fallback" : "meta";
          } else {
            if (zernioErr && /outside of allowed window|outside the allowed window|24[- ]?hour/i.test(zernioErr)) {
              return json({
                error: "OUTSIDE_24H_WINDOW",
                code: "OUTSIDE_24H_WINDOW",
                message: "O Instagram só permite enviar mensagens até 24h após a última resposta do usuário. Aguarde o lead responder novamente.",
                fallback: true,
              }, 200);
            }
            return json({ error: zernioErr || "Sem método de envio configurado (Zernio/Meta/n8n)" }, 400);
          }

          // Loga fallback bem-sucedido
          if (zernioErr && provider.includes("fallback")) {
            console.log(`[instagram-api] ✅ Fallback Zernio→${provider} OK`);
            await supa.from("imphq_ig_webhook_logs").insert({
              event_type: "zernio_fallback_send",
              payload: { project_id, recipient_id, provider, zernio_error: zernioErr },
              processed: true,
              error: zernioErr,
            }).then(() => {}, () => {});
            const updatedCreds = { ...creds, last_fallback_at: new Date().toISOString(), last_fallback_reason: zernioErr.slice(0, 300) };
            await saveCreds(supa, project_id, updatedCreds);
          }
        } catch (metaErr: any) {
          const combined = zernioErr ? `Zernio: ${zernioErr} | Fallback: ${metaErr.message}` : metaErr.message;
          // Janela de 24h do Instagram — não é bug, é regra da Meta. Responde 200 com código amigável.
          if (/outside of allowed window|outside the allowed window|24[- ]?hour/i.test(combined)) {
            return json({
              error: "OUTSIDE_24H_WINDOW",
              code: "OUTSIDE_24H_WINDOW",
              message: "O Instagram só permite enviar mensagens até 24h após a última resposta do usuário. Aguarde o lead responder novamente.",
              fallback: true,
            }, 200);
          }
          return json({ error: combined }, 400);
        }
      }

      // Grava mensagem outbound
      const { data: conv } = await supa.from("imphq_ig_conversations").select("id").eq("participant_id", recipient_id).maybeSingle();
      if (conv) {
        await supa.from("imphq_ig_messages").insert({
          conversation_id: conv.id,
          direction: "out",
          type: "text",
          content: text,
          mid: messageId,
          status: "sent",
          metadata: { ...(metadata || {}), provider, zernio_error: zernioErr || undefined },
        });
      }
      return json({ success: true, message_id: messageId, provider, fallback: !!zernioErr });
    }

    // ============ ZERNIO_MESSAGE_STATUS (polling delivered/read) ============
    if (action === "zernio_message_status") {
      const { project_id, limit = 50 } = body;
      if (!project_id) return json({ error: "project_id obrigatório" }, 400);
      const creds = await getCreds(supa, project_id);
      if (creds?.auth_method !== "zernio" || !creds?.zernio_api_key) {
        return json({ error: "Projeto não usa Zernio" }, 400);
      }

      // Busca msgs out enviadas via zernio, status=sent, últimas 24h
      const { data: pendingMsgs } = await supa
        .from("imphq_ig_messages")
        .select("id, mid, conversation_id, created_at, imphq_ig_conversations!inner(ig_thread_id, account_id, imphq_ig_accounts!inner(project_id))")
        .eq("direction", "out")
        .eq("status", "sent")
        .like("mid", "zernio-%")
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .lte("created_at", new Date(Date.now() - 5000).toISOString())
        .eq("imphq_ig_conversations.imphq_ig_accounts.project_id", project_id)
        .limit(limit);

      let updated = 0;
      for (const m of (pendingMsgs as any[]) || []) {
        const threadId = m.imphq_ig_conversations?.ig_thread_id;
        if (!threadId) continue;
        const mid = (m.mid || "").replace(/^zernio-/, "");
        try {
          const r = await fetch(`https://zernio.com/api/v1/inbox/conversations/${threadId}/messages/${mid}`, {
            headers: { "Authorization": `Bearer ${creds.zernio_api_key}` },
          });
          if (!r.ok) continue;
          const data = await r.json();
          const newStatus = data.read ? "read" : (data.delivered ? "delivered" : null);
          if (newStatus) {
            await supa.from("imphq_ig_messages").update({ status: newStatus }).eq("id", m.id);
            updated++;
          }
        } catch (_e) { /* skip */ }
      }
      return json({ success: true, checked: pendingMsgs?.length || 0, updated });
    }

    // ============ SET_ICEBREAKERS ============
    if (action === "set_icebreakers") {
      const { project_id, icebreakers } = body;
      if (!project_id || !Array.isArray(icebreakers)) {
        return json({ error: "project_id e array de icebreakers são obrigatórios" }, 400);
      }
      const creds = await getCreds(supa, project_id);
      if (!creds) return json({ error: "Conta IG não conectada", not_connected: true }, 200);
      if (!creds.page_access_token) return json({ error: "Esta ação requer conexão via Meta/Facebook. Sua conta está conectada apenas via Zernio.", needs_meta: true }, 200);

      // format for Meta API
      const metaIcebreakers = icebreakers
        .filter((q: string) => q && q.trim())
        .map((q: string, idx: number) => ({
          question: q.trim().slice(0, 80), // Meta limit is 80 chars
          payload: `ICEBREAKER_${idx + 1}`
        }));

      if (metaIcebreakers.length === 0) {
        const r = await fetch(`${GRAPH}/me/messenger_profile?access_token=${creds.page_access_token}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform: "instagram",
            fields: ["ice_breakers"]
          })
        });
        const data = await r.json();
        if (data.error) return json({ error: data.error.message }, 400);
        // Persist to DB
        creds.icebreakers = [];
        await saveCreds(supa, project_id, creds);
        return json({ success: true, deleted: true });
      } else {
        const r = await fetch(`${GRAPH}/me/messenger_profile?access_token=${creds.page_access_token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform: "instagram",
            ice_breakers: metaIcebreakers
          })
        });
        const data = await r.json();
        if (data.error) return json({ error: data.error.message }, 400);
        // Persist to DB
        creds.icebreakers = metaIcebreakers.map((i: any) => i.question);
        await saveCreds(supa, project_id, creds);
        return json({ success: true, ice_breakers: metaIcebreakers });
      }
    }

    // ============ REPLY_COMMENT ============
    if (action === "reply_comment") {
      const { project_id, comment_id, message } = body;
      if (!project_id || !comment_id || !message) return json({ error: "Faltam campos" }, 400);
      const creds = await getCreds(supa, project_id);
      if (!creds) return json({ error: "Conta IG não conectada", not_connected: true }, 200);

      if (creds.auth_method === "zernio") {
        if (!creds.zernio_api_key || !creds.zernio_account_id) return json({ error: "Credenciais do Zernio incompletas" }, 400);
        const { data: row } = await supa.from("imphq_ig_comments").select("media_id").eq("comment_id", comment_id).maybeSingle();
        if (!row?.media_id) return json({ error: "Post não encontrado para esse comentário" }, 400);
        const rawCid = comment_id.startsWith("zernio-") ? comment_id.slice(7) : comment_id;
        const r = await callZernio(supa, {
          project_id, action: "reply_comment",
          endpoint: `/api/v1/inbox/comments/${encodeURIComponent(row.media_id)}`,
          apiKey: creds.zernio_api_key,
          body: { accountId: creds.zernio_account_id, content: message, parentCommentId: rawCid },
        });
        if (!r.ok) {
          console.warn(`[instagram-api] Zernio reply_comment ${r.status}: ${r.errorSummary} (media=${row.media_id} parent=${rawCid} reqId=${r.requestId})`);
          return json({ error: `Zernio reply ${r.status}: ${r.errorSummary}`, request_id: r.requestId, response: r.data }, 400);
        }
        await supa.from("imphq_ig_comments").update({ replied: true, reply_text: message }).eq("comment_id", comment_id);
        return json({ success: true, id: (r.data as any)?.id || (r.data as any)?.commentId || null });
      }


      if (!creds.page_access_token) return json({ error: "Esta ação requer conexão via Meta/Facebook.", needs_meta: true }, 200);
      const r = await fetch(`${GRAPH}/${comment_id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, access_token: creds.page_access_token }),
      });
      const data = await r.json();
      if (data.error) return json({ error: data.error.message }, 400);
      await supa.from("imphq_ig_comments").update({ replied: true, reply_text: message }).eq("comment_id", comment_id);
      return json({ success: true, id: data.id });
    }

    // ============ LIKE_COMMENT ============
    if (action === "like_comment") {
      const { project_id, comment_id } = body;
      if (!project_id || !comment_id) return json({ error: "Faltam campos" }, 400);
      const creds = await getCreds(supa, project_id);
      if (!creds) return json({ error: "Conta IG não conectada", not_connected: true }, 200);

      if (creds.auth_method === "zernio") {
        if (!creds.zernio_api_key || !creds.zernio_account_id) return json({ error: "Credenciais do Zernio incompletas" }, 400);
        const { data: row } = await supa.from("imphq_ig_comments").select("media_id").eq("comment_id", comment_id).maybeSingle();
        const rawCid = comment_id.startsWith("zernio-") ? comment_id.slice(7) : comment_id;
        const mediaId = row?.media_id || null;
        // Cascata de endpoints — para no primeiro 2xx; avança em 400/404/405.
        const endpoints: Array<{ endpoint: string; method?: string; body?: any }> = [];
        if (mediaId) {
          endpoints.push({ endpoint: `/api/v1/inbox/comments/${encodeURIComponent(mediaId)}/${encodeURIComponent(rawCid)}/like`, body: { accountId: creds.zernio_account_id } });
          endpoints.push({ endpoint: `/api/v1/inbox/comments/${encodeURIComponent(mediaId)}/like`, body: { accountId: creds.zernio_account_id, commentId: rawCid } });
        }
        endpoints.push({ endpoint: `/api/v1/inbox/comments/${encodeURIComponent(rawCid)}/like`, body: { accountId: creds.zernio_account_id } });
        endpoints.push({ endpoint: `/api/v1/instagram/comments/${encodeURIComponent(rawCid)}/like`, body: { accountId: creds.zernio_account_id } });

        let last: any = null;
        for (let i = 0; i < endpoints.length; i++) {
          const ep = endpoints[i];
          const r = await callZernio(supa, {
            project_id, action: "like_comment",
            endpoint: ep.endpoint, method: ep.method || "POST",
            apiKey: creds.zernio_api_key, body: ep.body, attempt: i + 1,
          });
          last = r;
          if (r.ok) {
            await supa.from("imphq_ig_comments").update({ liked: true }).eq("comment_id", comment_id).then(()=>{}, ()=>{});
            return json({ success: true, endpoint: ep.endpoint });
          }
          // Erros permanentes → interrompe cascata
          if (r.status === 401 || r.status === 403) break;
          const es = String(r.errorSummary || "").toLowerCase();
          if (/window|24.?hour|7.?day|not allowed|permission|blocked|deleted|expired/.test(es)) break;
          // 400/404/405 → tenta próximo
        }
        return json({ error: `Zernio like ${last?.status}: ${last?.errorSummary || "falha"}`, request_id: last?.requestId }, 400);
      }

      // Meta Graph API não expõe like de comentário para IG Business — retorna no-op silencioso.
      return json({ success: true, skipped: true, reason: "meta_graph_unsupported" });
    }



    // ============ HIDE/UNHIDE_COMMENT ============
    if (action === "hide_comment" || action === "unhide_comment") {
      const { project_id, comment_id } = body;
      const hide = action === "hide_comment";
      const creds = await getCreds(supa, project_id);
      if (!creds) return json({ error: "Conta IG não conectada", not_connected: true }, 200);

      if (creds.auth_method === "zernio") {
        if (!creds.zernio_api_key) return json({ error: "Credenciais do Zernio incompletas" }, 400);
        const { data: row } = await supa.from("imphq_ig_comments").select("media_id").eq("comment_id", comment_id).maybeSingle();
        if (!row?.media_id) return json({ error: "Post não encontrado para esse comentário" }, 400);
        const rawCid = comment_id.startsWith("zernio-") ? comment_id.slice(7) : comment_id;
        const url = `https://zernio.com/api/v1/inbox/comments/${encodeURIComponent(row.media_id)}/${encodeURIComponent(rawCid)}/hide`;
        const r = await fetch(url, {
          method: hide ? "POST" : "DELETE",
          headers: { "Authorization": `Bearer ${creds.zernio_api_key}`, "Content-Type": "application/json" },
          body: hide ? JSON.stringify({ accountId: creds.zernio_account_id }) : undefined,
        });
        if (!r.ok) return json({ error: `Zernio hide ${r.status}: ${(await r.text()).slice(0, 200)}` }, 400);
        await supa.from("imphq_ig_comments").update({ is_hidden: hide }).eq("comment_id", comment_id);
        return json({ success: true });
      }

      if (!creds.page_access_token) return json({ error: "Esta ação requer conexão via Meta/Facebook.", needs_meta: true }, 200);
      const r = await fetch(`${GRAPH}/${comment_id}?hide=${hide}&access_token=${creds.page_access_token}`, { method: "POST" });
      const data = await r.json();
      if (data.error) return json({ error: data.error.message }, 400);
      await supa.from("imphq_ig_comments").update({ is_hidden: hide }).eq("comment_id", comment_id);
      return json({ success: true });
    }

    // ============ DELETE_COMMENT ============
    if (action === "delete_comment") {
      const { project_id, comment_id } = body;
      const creds = await getCreds(supa, project_id);
      if (!creds) return json({ error: "Conta IG não conectada", not_connected: true }, 200);

      if (creds.auth_method === "zernio") {
        if (!creds.zernio_api_key) return json({ error: "Credenciais do Zernio incompletas" }, 400);
        const { data: row } = await supa.from("imphq_ig_comments").select("media_id").eq("comment_id", comment_id).maybeSingle();
        if (!row?.media_id) return json({ error: "Post não encontrado para esse comentário" }, 400);
        const rawCid = comment_id.startsWith("zernio-") ? comment_id.slice(7) : comment_id;
        const url = `https://zernio.com/api/v1/inbox/comments/${encodeURIComponent(row.media_id)}?commentId=${encodeURIComponent(rawCid)}&accountId=${encodeURIComponent(creds.zernio_account_id || "")}`;
        const r = await fetch(url, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${creds.zernio_api_key}` },
        });
        if (!r.ok) return json({ error: `Zernio delete ${r.status}: ${(await r.text()).slice(0, 200)}` }, 400);
        await supa.from("imphq_ig_comments").delete().eq("comment_id", comment_id);
        return json({ success: true });
      }

      if (!creds.page_access_token) return json({ error: "Esta ação requer conexão via Meta/Facebook.", needs_meta: true }, 200);
      const r = await fetch(`${GRAPH}/${comment_id}?access_token=${creds.page_access_token}`, { method: "DELETE" });
      const data = await r.json();
      if (data.error) return json({ error: data.error.message }, 400);
      await supa.from("imphq_ig_comments").delete().eq("comment_id", comment_id);
      return json({ success: true });
    }

    // ============ PRIVATE_REPLY (DM a partir de comentário) ============
    if (action === "private_reply") {
      const { project_id, comment_id, message } = body;
      const creds = await getCreds(supa, project_id);
      if (!creds) return json({ error: "Conta IG não conectada", not_connected: true }, 200);

      let messageId = "";

      if (creds.auth_method === "zernio") {
        if (!creds.zernio_api_key || !creds.zernio_account_id) {
          return json({ error: "Credenciais do Zernio incompletas" }, 400);
        }

        // Busca o autor real do comentário (colunas corretas)
        const rawCid = (comment_id || "").startsWith("zernio-") ? comment_id.slice(7) : comment_id;
        const { data: commentData } = await supa
          .from("imphq_ig_comments")
          .select("from_username, from_user_id, media_id")
          .or(`comment_id.eq.${comment_id},comment_id.eq.zernio-${rawCid}`)
          .maybeSingle();

        const authorUsername = commentData?.from_username || null;
        const authorUserId = commentData?.from_user_id || null;
        const mediaId = commentData?.media_id || null;

        // Tenta achar conversa existente
        let conv: any = null;
        if (authorUsername) {
          const { data } = await supa
            .from("imphq_ig_conversations")
            .select("id, ig_thread_id, participant_id")
            .eq("participant_username", authorUsername)
            .maybeSingle();
          conv = data;
        }
        if (!conv && authorUserId) {
          const { data } = await supa
            .from("imphq_ig_conversations")
            .select("id, ig_thread_id, participant_id")
            .eq("participant_id", authorUserId)
            .maybeSingle();
          conv = data;
        }

        const threadId = conv?.ig_thread_id || conv?.participant_id || authorUserId;
        console.log(`[instagram-api] private_reply zernio: comment=${comment_id} author=@${authorUsername || "?"} thread=${threadId || "-"} media=${mediaId || "-"}`);

        // Estratégia 1: se temos conversa/participante existente, tenta DM direta
        const attempts: Array<{ label: string; endpoint: string; body: any }> = [];
        if (threadId) {
          attempts.push({
            label: "inbox/conversations/messages",
            endpoint: `/api/v1/inbox/conversations/${encodeURIComponent(threadId)}/messages`,
            body: { accountId: creds.zernio_account_id, message },
          });
        }
        // Cascata para private_reply ancorado no comentário (não depende de thread)
        if (mediaId && rawCid) {
          attempts.push({
            label: "inbox/comments/{media}/{comment}/private-reply",
            endpoint: `/api/v1/inbox/comments/${encodeURIComponent(mediaId)}/${encodeURIComponent(rawCid)}/private-reply`,
            body: { accountId: creds.zernio_account_id, message },
          });
          attempts.push({
            label: "comments/{comment}/private_reply",
            endpoint: `/api/v1/comments/${encodeURIComponent(rawCid)}/private_reply`,
            body: { accountId: creds.zernio_account_id, text: message },
          });
          attempts.push({
            label: "comments/private_replies",
            endpoint: `/api/v1/comments/private_replies`,
            body: { accountId: creds.zernio_account_id, comment_id: rawCid, text: message },
          });
        }

        let lastErr: any = null;
        let lastStatus = 0;
        let lastReqId: string | null = null;
        for (let i = 0; i < attempts.length; i++) {
          const a = attempts[i];
          const r = await callZernio(supa, {
            project_id, action: `private_reply:${a.label}`,
            endpoint: a.endpoint, apiKey: creds.zernio_api_key, body: a.body,
            attempt: i + 1,
          });
          if (r.ok) {
            messageId = (r.data as any)?.messageId || (r.data as any)?.id || `zernio-pr-${Date.now()}`;
            break;
          }
          lastErr = r.errorSummary; lastStatus = r.status; lastReqId = r.requestId;
          // Heurística: 400 com msg de janela/permissão da Meta → parar cascata
          const msg = String(r.errorSummary || "").toLowerCase();
          const metaBlock = /window|24.?hour|7.?day|not allowed|permission|blocked|deleted|expired|closed/i.test(msg);
          if (metaBlock) {
            console.warn(`[instagram-api] Zernio meta-block detectado, cancelando cascata: ${r.errorSummary}`);
            break;
          }
          // Só avança na cascata se for 404 (path) ou 400 de schema
          if (r.status !== 404 && r.status !== 400 && r.status !== 405) break;
        }

        if (!messageId) {
          return json({
            error: `Zernio private_reply falhou após ${attempts.length} tentativa(s): ${lastErr || "sem detalhes"}`,
            status: lastStatus, request_id: lastReqId,
          }, 400);
        }

      } else {
        if (!creds?.page_access_token || !creds?.ig_user_id) return json({ error: "Esta ação requer conexão via Meta/Facebook. Sua conta está conectada apenas via Zernio.", needs_meta: true }, 200);
        if (creds?.n8n_webhook_url) {
          console.log(`[instagram-api] Forwarding private_reply to N8N webhook: ${creds.n8n_webhook_url}`);
          const nr = await fetch(creds.n8n_webhook_url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ comment_id, text: message }),
          });
          if (!nr.ok) {
            const errBody = await nr.text();
            return json({ error: `N8N error (${nr.status}): ${errBody}` }, 400);
          }
          const resText = await nr.text();
          if (resText.trim()) {
            try {
              const ndata = JSON.parse(resText);
              messageId = ndata.message_id || ndata.id || "n8n-" + Date.now();
            } catch {
              messageId = "n8n-" + Date.now();
            }
          } else {
            messageId = "n8n-" + Date.now();
          }
        } else {
          const r = await fetch(`${GRAPH}/me/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipient: { comment_id },
              message: { text: message },
              access_token: creds.page_access_token,
            }),
          });
          const data = await r.json();
          if (data.error) return json({ error: data.error.message }, 400);
          messageId = data.message_id;
        }
      }
      return json({ success: true, message_id: messageId });
    }

    // ============ FETCH_ACCOUNT (info da conta) ============
    if (action === "fetch_account") {
      const project_id = url.searchParams.get("project_id") || body.project_id;
      const creds = await getCreds(supa, project_id);
      if (!creds?.access_token && !creds?.zernio_api_key) return json({ has_token: false });

      if (creds.auth_method === "zernio") {
        let freshAvatar = null;
        let freshDisplayName = null;
        
        try {
          const r = await fetch("https://zernio.com/api/v1/accounts", {
            headers: {
              "Authorization": `Bearer ${creds.zernio_api_key}`,
            },
          });
          if (r.ok) {
            const zdata = await r.json();
            const zAcc = (zdata.accounts || []).find((acc: any) => (acc.id || acc._id) === creds.zernio_account_id);
            if (zAcc) {
              freshAvatar = zAcc.avatarUrl || zAcc.avatar || zAcc.profilePicture || null;
              freshDisplayName = zAcc.name || zAcc.displayName || null;
            }
          }
        } catch (err) {
          console.error("[instagram-api] Failed to refresh zernio account details:", err);
        }

        const updates: any = {};
        if (freshAvatar) updates.avatar_url = freshAvatar;
        if (freshDisplayName) updates.display_name = freshDisplayName;

        if (Object.keys(updates).length > 0) {
          await supa
            .from("imphq_ig_accounts")
            .update(updates)
            .eq("project_id", project_id)
            .eq("ig_user_id", creds.ig_user_id);
        }

        const { data: localAcc } = await supa
          .from("imphq_ig_accounts")
          .select("*")
          .eq("project_id", project_id)
          .eq("ig_user_id", creds.ig_user_id)
          .maybeSingle();

        return json({
          has_token: true,
          account: localAcc || {
            username: creds.username || "zernio_account",
            display_name: creds.username || "Zernio Account",
            ig_user_id: creds.ig_user_id,
            status: "active",
            auth_method: "zernio"
          }
        });
      }

      try {
        const info = await discoverIgAccount(creds.access_token);
        return json({ has_token: true, account: info });
      } catch (e: any) {
        return json({ has_token: true, error: e.message });
      }
    }

    // ============ GET_MEDIA (info do post) ============
    if (action === "get_media") {
      const project_id = url.searchParams.get("project_id") || body.project_id;
      const media_id = url.searchParams.get("media_id") || body.media_id;
      if (!project_id || !media_id) return json({ error: "Faltam campos" }, 400);
      const creds = await getCreds(supa, project_id);
      if (!creds) return json({ error: "Conta IG não conectada", not_connected: true }, 200);
      if (!creds.page_access_token) return json({ error: "Esta ação requer conexão via Meta/Facebook. Sua conta está conectada apenas via Zernio.", needs_meta: true }, 200);
      const r = await fetch(`${GRAPH}/${media_id}?fields=permalink,shortcode,caption&access_token=${creds.page_access_token}`);
      const data = await r.json();
      if (data.error) return json({ error: data.error.message }, 400);
      return json({ success: true, media: data });
    }

    return json({ error: "Action desconhecida" }, 400);
  } catch (err: any) {
    console.error("instagram-api error:", err);
    return json({ error: err.message || "Erro interno" }, 500);
  }
});

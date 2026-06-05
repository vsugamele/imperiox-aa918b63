// Instagram API proxy — token e configs por projeto, em imphq_integration_credentials
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      const { project_id, access_token, app_id, app_secret } = body;
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

    // ============ SEND_TEXT ============
    if (action === "send_text") {
      const { project_id, recipient_id, text, metadata } = body;
      if (!project_id || !recipient_id || !text) return json({ error: "Faltam campos" }, 400);
      const creds = await getCreds(supa, project_id);
      if (!creds?.page_access_token || !creds?.ig_user_id) return json({ error: "Conta IG não conectada" }, 404);
      const r = await fetch(`${GRAPH}/${creds.ig_user_id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: recipient_id },
          message: { text },
          access_token: creds.page_access_token,
        }),
      });
      const data = await r.json();
      if (data.error) return json({ error: data.error.message }, 400);
      // Grava mensagem outbound
      const { data: conv } = await supa.from("imphq_ig_conversations").select("id").eq("participant_id", recipient_id).maybeSingle();
      if (conv) {
        await supa.from("imphq_ig_messages").insert({
          conversation_id: conv.id,
          direction: "out",
          type: "text",
          content: text,
          mid: data.message_id,
          status: "sent",
          metadata: metadata || null,
        });
      }
      return json({ success: true, message_id: data.message_id });
    }

    // ============ REPLY_COMMENT ============
    if (action === "reply_comment") {
      const { project_id, comment_id, message } = body;
      if (!project_id || !comment_id || !message) return json({ error: "Faltam campos" }, 400);
      const creds = await getCreds(supa, project_id);
      if (!creds?.page_access_token) return json({ error: "Conta IG não conectada" }, 404);
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

    // ============ HIDE/UNHIDE_COMMENT ============
    if (action === "hide_comment" || action === "unhide_comment") {
      const { project_id, comment_id } = body;
      const hide = action === "hide_comment";
      const creds = await getCreds(supa, project_id);
      if (!creds?.page_access_token) return json({ error: "Conta IG não conectada" }, 404);
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
      if (!creds?.page_access_token) return json({ error: "Conta IG não conectada" }, 404);
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
      if (!creds?.page_access_token || !creds?.ig_user_id) return json({ error: "Conta IG não conectada" }, 404);
      const r = await fetch(`${GRAPH}/${creds.ig_user_id}/messages`, {
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
      return json({ success: true });
    }

    // ============ FETCH_ACCOUNT (info da conta) ============
    if (action === "fetch_account") {
      const project_id = url.searchParams.get("project_id") || body.project_id;
      const creds = await getCreds(supa, project_id);
      if (!creds?.access_token) return json({ has_token: false });
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
      if (!creds?.page_access_token) return json({ error: "Conta IG não conectada" }, 404);
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

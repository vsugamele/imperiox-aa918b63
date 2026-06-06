// ig-profile-backfill — Sincroniza nome/foto de todos os leads do Instagram
// usando a API do Zernio (muito mais confiável que chamar o Graph API direto)
// Endpoint: GET https://zernio.com/api/v1/inbox/conversations?platform=instagram&accountId=X
// Campos retornados: participants[].name, participants[].username, participants[].profilePicture
//                   participantName, participantUsername, participantPicture (flat fields)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ZERNIO_BASE = "https://zernio.com/api/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json().catch(() => ({}));
    const filterAccountId = body?.account_id || null;

    // 1. Busca contas IG com credenciais Zernio
    let q = supa
      .from("imphq_ig_accounts")
      .select("id, ig_user_id, project_id, username");
    if (filterAccountId) q = q.eq("id", filterAccountId);
    const { data: accounts, error: acErr } = await q;

    if (acErr || !accounts?.length) {
      return new Response(JSON.stringify({ ok: true, message: "Nenhuma conta encontrada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalFailed  = 0;

    for (const account of accounts) {
      // 2. Busca credenciais Zernio do projeto
      const { data: credsData } = await supa
        .from("imphq_integration_credentials")
        .select("credentials")
        .eq("project_id", account.project_id)
        .eq("provider", "instagram")
        .maybeSingle();

      const creds = credsData?.credentials;
      const zernioApiKey     = creds?.zernio_api_key;
      const zernioAccountId  = creds?.zernio_account_id;

      if (!zernioApiKey || !zernioAccountId) {
        console.warn(`[backfill] Sem credenciais Zernio para conta ${account.id} — tentando Graph API como fallback`);
        // Fallback para Graph API
        await fallbackGraphApi(supa, account, creds);
        continue;
      }

      console.log(`[backfill] Usando Zernio para conta @${account.username}`);

      // 3. Busca conversas do Zernio (paginado)
      let page = 1;
      let hasMore = true;
      const pageSize = 50;

      while (hasMore) {
        const url = `${ZERNIO_BASE}/inbox/conversations?platform=instagram&accountId=${zernioAccountId}&limit=${pageSize}&page=${page}`;
        const resp = await fetch(url, {
          headers: { "Authorization": `Bearer ${zernioApiKey}` },
        });

        if (!resp.ok) {
          const errText = await resp.text();
          console.error(`[backfill] Zernio error ${resp.status}: ${errText}`);
          totalFailed++;
          break;
        }

        const data = await resp.json();
        // Zernio retorna: { conversations: [...], total, page, limit }
        // Cada conversa tem: { _id, participantName, participantUsername, participantPicture,
        //                      participants: [{ id, name, username, profilePicture, instagramProfile }] }
        const conversations: any[] = data.conversations || data.data || [];

        if (conversations.length === 0) { hasMore = false; break; }

        for (const conv of conversations) {
          // Extrai dados do participante (lado do cliente, não nosso)
          const participant = conv.participants?.find((p: any) => p.id !== account.ig_user_id)
            || conv.participants?.[0];

          const name     = conv.participantName     || participant?.name     || null;
          const username = conv.participantUsername || participant?.username || null;
          const avatar   = conv.participantPicture  || participant?.profilePicture || null;

          // PSID (platform-scoped user ID) — identificador único do lead
          const participantId = conv.participantId
            || participant?.id
            || participant?.platformId
            || null;

          if (!participantId) {
            console.warn(`[backfill] Conversa sem participantId:`, conv._id);
            totalSkipped++;
            continue;
          }

          // Monta fallback limpo para leads sem perfil público
          const shortId   = String(participantId).slice(-6);
          const cleanName = name     || `Lead #${shortId}`;
          const cleanUser = username || `user_${shortId}`;

          // 4. Atualiza no banco (match por participant_id)
          const { error: upErr } = await supa
            .from("imphq_ig_conversations")
            .update({
              participant_name:     cleanName,
              participant_username: cleanUser,
              ...(avatar ? { participant_avatar: avatar } : {}),
            })
            .eq("account_id", account.id)
            .eq("participant_id", participantId);

          if (upErr) {
            console.warn(`[backfill] Erro ao atualizar ${participantId}:`, upErr.message);
            totalFailed++;
          } else {
            totalUpdated++;
            console.log(`[backfill] ✓ ${participantId} → ${cleanName} (@${cleanUser})`);
          }

          // Rate limit gentil
          await new Promise(r => setTimeout(r, 50));
        }

        // Verifica se tem próxima página
        const totalPages = Math.ceil((data.total || conversations.length) / pageSize);
        hasMore = page < totalPages && conversations.length === pageSize;
        page++;
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      updated: totalUpdated,
      skipped: totalSkipped,
      failed: totalFailed,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("[backfill] Erro geral:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Fallback: usa Graph API para projetos sem Zernio
async function fallbackGraphApi(supa: any, account: any, creds: any) {
  const pageAccessToken = creds?.page_access_token;
  if (!pageAccessToken) return;

  const { data: convs } = await supa
    .from("imphq_ig_conversations")
    .select("id, participant_id, participant_username, participant_name")
    .eq("account_id", account.id)
    .or("participant_username.is.null,participant_name.is.null")
    .limit(50);

  if (!convs?.length) return;

  for (const conv of convs) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${conv.participant_id}?fields=name,username,profile_pic&access_token=${pageAccessToken}`
      );
      if (!res.ok) {
        const shortId = conv.participant_id.slice(-6);
        await supa.from("imphq_ig_conversations").update({
          participant_username: `user_${shortId}`,
          participant_name:     `Lead #${shortId}`,
        }).eq("id", conv.id);
        continue;
      }
      const profile = await res.json();
      const updateData: any = {};
      if (profile.username) updateData.participant_username = profile.username;
      if (profile.name)     updateData.participant_name     = profile.name;
      if (profile.profile_pic) updateData.participant_avatar = profile.profile_pic;
      if (!profile.username && !profile.name) {
        const shortId = conv.participant_id.slice(-6);
        updateData.participant_username = updateData.participant_username || `user_${shortId}`;
        updateData.participant_name     = updateData.participant_name     || `Lead #${shortId}`;
      }
      if (Object.keys(updateData).length) {
        await supa.from("imphq_ig_conversations").update(updateData).eq("id", conv.id);
      }
      await new Promise(r => setTimeout(r, 250));
    } catch (e: any) {
      console.warn(`[backfill-graph] Erro ${conv.participant_id}:`, e.message);
    }
  }
}

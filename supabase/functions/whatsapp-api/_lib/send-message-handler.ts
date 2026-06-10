// send-message-handler.ts — handler completo da action="send_message"
// Atribuição automática + dispatch para Evolution/Twilio/Meta Cloud + auto failover +
// save mensagem + update conversa + fire-and-forget learn-from-human.

import {
  sendEvolution,
  sendEvolutionButtons,
  sendEvolutionList,
  sendEvolutionMedia,
  sendMetaCloud,
  sendTwilio,
  isTransientConnError,
} from "./senders.ts";
import { attributeOutgoing } from "../../_shared/attribution.ts";

export type SendMessageDeps = {
  supabase: any;
  corsHeaders: Record<string, string>;
  getProvider: (id: string) => Promise<any>;
  findOrCreateConversation: (
    phone: string,
    projectId: string,
    providerId: string | null,
    contactName?: string,
    jidSuffix?: string,
  ) => Promise<any>;
  updateConversationAfterMessage: (
    conversationId: string,
    content: string,
    currentCount: number,
    incrementUnread?: boolean,
    pauseAI?: boolean,
  ) => Promise<void>;
  normalizePhone: (raw: string) => { phone: string | null; cc: string | null; reason?: string };
};

export async function handleSendMessage(req: Request, deps: SendMessageDeps): Promise<Response> {
  const { supabase, corsHeaders, getProvider, findOrCreateConversation, updateConversationAfterMessage, normalizePhone } = deps;

  const body = await req.json();
  const {
    provider_id,
    phone: rawPhone,
    content: rawContent,
    conversation_id,
    project_id,
    media_url,
    media_type,
    _no_failover,
    sent_by: rawSentBy,
    buttons,
    list_data,
    attribution_context,
  } = body;

  const sent_by = rawSentBy || "campaign";
  console.log(`[send_message] sent_by=${sent_by} (raw=${rawSentBy ?? "<unset>"})`);

  // ── ATRIBUIÇÃO ──
  let content = rawContent;
  let attribution_id: string | null = null;
  if (project_id && rawContent && typeof rawContent === "string") {
    try {
      const result = await attributeOutgoing(supabase, rawContent, {
        project_id,
        conversation_id: conversation_id || null,
        phone: rawPhone || null,
        source: sent_by === "human" ? "chat_manual" : sent_by === "ai" ? "ai_reply" : (attribution_context?.source || "send_message"),
        source_detail: attribution_context?.source_detail,
        template_name: attribution_context?.template_name,
        campaign_id: attribution_context?.campaign_id,
        produto_nome: attribution_context?.produto_nome,
        metadata: { sent_by, ...(attribution_context?.metadata || {}) },
      });
      content = result.text;
      attribution_id = result.attribution_id;
    } catch (e: any) {
      console.warn(`[send_message] attribution failed: ${e?.message}`);
    }
  }

  // ── Sufixo JID ──
  let jidSuffix = "s.whatsapp.net";
  if (conversation_id) {
    const { data: convRow } = await supabase
      .from("imphq_wa_conversations")
      .select("jid_suffix")
      .eq("id", conversation_id)
      .maybeSingle();
    if (convRow?.jid_suffix) jidSuffix = convRow.jid_suffix;
  }

  let phone: string;
  let detectedCC: string | null = null;

  if (jidSuffix === "lid") {
    const digits = String(rawPhone || "").replace(/\D/g, "");
    if (!digits) {
      return new Response(JSON.stringify({ success: false, error: "ID do contato vazio." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }
    phone = `${digits}@lid`;
    detectedCC = "lid";
  } else {
    const normalized = normalizePhone(rawPhone || "");
    if (!normalized.phone) {
      const digits = String(rawPhone || "").replace(/\D/g, "");
      if (digits.length >= 13 && normalized.reason === "DDI desconhecido") {
        console.log("[send_message] fallback @lid auto-detectado para:", digits);
        phone = `${digits}@lid`;
        detectedCC = "lid";
        jidSuffix = "lid";
        if (conversation_id) {
          await supabase.from("imphq_wa_conversations")
            .update({ jid_suffix: "lid" }).eq("id", conversation_id);
        }
      } else {
        console.warn("[send_message] número inválido:", rawPhone, "motivo:", normalized.reason);
        return new Response(JSON.stringify({
          success: false,
          error: `Número fora do padrão internacional (${normalized.reason}). Verifique DDI + DDD + número.`,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
      }
    } else {
      phone = normalized.phone;
      detectedCC = normalized.cc;
    }
  }

  let provider = await getProvider(provider_id);
  let usedFailover = false;
  let originalProviderName: string | null = null;

  async function attemptSend(p: any) {
    if (p.provider === "evolution") {
      if (buttons && Array.isArray(buttons) && buttons.length > 0) {
        return await sendEvolutionButtons(p, phone, content || "", buttons);
      } else if (list_data && typeof list_data === "object" && Array.isArray(list_data.rows)) {
        return await sendEvolutionList(p, phone, content || "", list_data);
      } else if (media_url) {
        return await sendEvolutionMedia(p, phone, media_url, media_type || "image", content || undefined);
      } else {
        return await sendEvolution(p, phone, content);
      }
    } else if (p.provider === "meta_cloud") {
      return await sendMetaCloud(p, phone, content);
    } else {
      return await sendTwilio(p, phone, content);
    }
  }

  let result: any;
  try {
    result = await attemptSend(provider);
  } catch (sendErr: any) {
    console.error("[send_message] provider error:", sendErr.message);
    const isConnectionClosed = isTransientConnError(sendErr.message || "");

    if (!_no_failover && project_id) {
      const { data: siblings } = await supabase
        .from("imphq_wa_providers")
        .select("*")
        .eq("project_id", project_id || provider.project_id)
        .eq("is_active", true)
        .neq("id", provider.id)
        .order("last_seen_at", { ascending: false, nullsFirst: false });

      for (const sib of (siblings || [])) {
        try {
          if (sib.api_url) sib.api_url = sib.api_url.replace(/\/+$/, "");
          const r = await attemptSend(sib);
          if (r && r.ok !== false) {
            console.log(`[send_message] failover success: ${provider.instance_name} → ${sib.instance_name}`);
            originalProviderName = provider.instance_name || provider.id;
            provider = sib;
            result = r;
            usedFailover = true;
            break;
          }
        } catch (e: any) {
          console.warn(`[send_message] failover attempt failed on ${sib.instance_name}:`, e.message);
        }
      }
    }

    if (!result) {
      if (isConnectionClosed) {
        await supabase.from("imphq_events").insert({
          type: "wa_session_disconnected",
          entity_type: "wa_provider",
          entity_id: provider.id,
          metadata: { instance: provider.instance_name, error: sendErr.message?.slice(0, 300) },
        }).then(() => {}, () => {});
      }
      return new Response(JSON.stringify({
        success: false,
        error: isConnectionClosed
          ? "Sessão WhatsApp desconectada e nenhum chip alternativo disponível. Reconecte via QR Code."
          : `Falha ao enviar: ${sendErr.message}`,
        fallback: true,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  if (result?.ok === false && result?.error === "invalid_number") {
    return new Response(JSON.stringify({
      success: false,
      error: `Número (+${detectedCC}) não existe no WhatsApp ou é um ID de grupo.`,
      details: result.details,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await supabase.from("imphq_wa_providers")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", provider.id).then(() => {}, () => {});

  const conv = conversation_id
    ? (await supabase.from("imphq_wa_conversations").select("*").eq("id", conversation_id).single()).data
    : await findOrCreateConversation(phone, project_id || provider.project_id, provider.id);

  if (!conv) throw new Error("Conversa não encontrada nem criada");

  const msgPayload: any = {
    conversation_id: conv.id,
    direction: "outgoing",
    phone,
    content: content || (media_url ? "Mídia" : ""),
    project_id: project_id || provider.project_id,
    provider: provider.provider,
    provider_message_id: result?.key?.id || result?.sid || null,
    status: "sent",
    sent_by,
  };
  if (attribution_id) msgPayload.attribution_id = attribution_id;
  if (media_url) {
    msgPayload.message_type = media_type || "image";
    msgPayload.media_url = media_url;
  }
  if (usedFailover) {
    msgPayload.metadata = { failover_from: originalProviderName, sent_via: provider.instance_name };
  }

  const { data: savedMsg, error: msgError } = await supabase.from("imphq_wa_messages").insert(msgPayload).select("id").maybeSingle();

  if (attribution_id && savedMsg?.id) {
    supabase.from("imphq_wa_attribution")
      .update({ message_id: savedMsg.id })
      .eq("attribution_id", attribution_id)
      .then(() => {}, () => {});
  }

  if (msgError) {
    console.error("[send_message] DB save error:", msgError.message);
    throw new Error("Mensagem enviada mas falhou ao salvar: " + msgError.message);
  }

  await updateConversationAfterMessage(conv.id, content || "📎 Mídia", conv.message_count || 0, false, sent_by === "human");

  if (sent_by === "human" && content && content.length > 15) {
    supabase.functions.invoke("wa-learn-from-human", {
      body: { conversation_id: conv.id, message_id: savedMsg?.id, project_id: project_id || provider.project_id },
    }).catch((e: any) => console.warn("[send_message] learn invoke skip:", e?.message));
  }

  return new Response(JSON.stringify({
    success: true,
    result,
    conversation_id: conv.id,
    failover: usedFailover,
    sent_via: usedFailover ? provider.instance_name : undefined,
    original_provider: usedFailover ? originalProviderName : undefined,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

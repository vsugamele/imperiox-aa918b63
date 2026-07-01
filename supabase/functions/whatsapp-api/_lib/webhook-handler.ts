// webhook-handler.ts — handler completo da action="webhook"
// Recebe deps via factory para evitar closure.
// Lida com Evolution (MESSAGES_UPSERT, MESSAGES_UPDATE, CONNECTION_UPDATE,
// GROUP_PARTICIPANTS_UPDATE, SEND_MESSAGE) + Twilio inbound.

import { sendMetaCloud, sendTwilio } from "./senders.ts";

export type WebhookDeps = {
  supabase: any;
  corsHeaders: Record<string, string>;
  evolutionEventFromPath: string | null;
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
};

async function runWhatsAppAutoresponder(
  deps: WebhookDeps,
  conv: any,
  phone: string,
  content: string,
  messageType: string,
  _providerMsgId: string,
  pushName: string,
  providerId: string,
  projectId: string,
  _providerType: string,
  jidSuffix: string,
  _incomingAt: number,
  mediaUrl?: string | null,
) {
  const { supabase, updateConversationAfterMessage } = deps;
  await updateConversationAfterMessage(conv.id, content, conv.message_count || 0, true);

  const isGroup = jidSuffix === "g.us" || jidSuffix === "broadcast" || jidSuffix.includes("g.us") || jidSuffix.includes("broadcast");

  if (!isGroup) {
    try {
      const { data: leadRow } = await supabase
        .from("imphq_leads")
        .select("id, score, tags, data")
        .eq("phone", phone)
        .eq("project_id", projectId)
        .maybeSingle();
      supabase.functions.invoke("wa-ai-triage", {
        body: {
          message: content,
          conversation_id: conv.id,
          lead_id: leadRow?.id || null,
          projeto_id: projectId,
        },
      }).catch((e: any) => console.warn("[webhook] triagem invoke error:", e?.message));
    } catch (tErr: any) {
      console.warn("[webhook] triagem skip:", tErr?.message);
    }
  }

  // Command matching
  let matched: any = null;
  try {
    const lowerContent = content.toLowerCase().trim();
    const { data: commands } = await supabase
      .from("imphq_wa_commands")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_active", true);

    if (commands && commands.length > 0) {
      matched = commands.find((cmd: any) =>
        lowerContent === cmd.trigger_word.toLowerCase() ||
        lowerContent.startsWith(cmd.trigger_word.toLowerCase() + " "),
      );
      if (matched && providerId) {
        const { data: provCmd } = await supabase
          .from("imphq_wa_providers")
          .select("id, api_url, api_key, instance_name, provider, phone_number_id, access_token, twilio_sid, twilio_token, twilio_from")
          .eq("id", providerId)
          .single();
        if (provCmd) {
          const firstName = (conv.contact_name || pushName || "").trim().split(/\s+/)[0] || "amigo(a)";
          const replyText = String(matched.response_text || "")
            .replace(/\{\{\s*nome\s*\}\}/gi, firstName)
            .replace(/\{\s*nome\s*\}/gi, firstName)
            .replace(/\{\{\s*name\s*\}\}/gi, firstName)
            .replace(/\{\s*name\s*\}/gi, firstName);

          let sendSuccess = false;
          let outMsgId: string | null = null;
          if (provCmd.provider === "evolution") {
            const cmdApiBase = provCmd.api_url.replace(/\/+$/, "");
            const cmdInst = encodeURIComponent(provCmd.instance_name);
            const sendRes = await fetch(`${cmdApiBase}/message/sendText/${cmdInst}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: provCmd.api_key },
              body: JSON.stringify({ number: phone + "@s.whatsapp.net", text: replyText }),
            });
            if (sendRes.ok) {
              sendSuccess = true;
              const sendJson = await sendRes.json();
              outMsgId = sendJson?.key?.id || null;
            }
          } else if (provCmd.provider === "meta_cloud") {
            const resMeta = await sendMetaCloud(provCmd, phone, replyText);
            if (resMeta) {
              sendSuccess = true;
              outMsgId = resMeta.key?.id || null;
            }
          } else if (provCmd.provider === "twilio") {
            const resTwilio = await sendTwilio(provCmd, phone, replyText);
            if (resTwilio) {
              sendSuccess = true;
              outMsgId = resTwilio.sid || null;
            }
          }

          if (sendSuccess) {
            await supabase.from("imphq_wa_messages").insert({
              conversation_id: conv.id,
              direction: "outgoing",
              phone,
              content: replyText,
              message_type: "text",
              project_id: projectId,
              provider: provCmd.provider,
              provider_message_id: outMsgId,
              status: "sent",
              sent_by: "command",
              metadata: { source: "command", trigger: matched.trigger_word },
            });
            await updateConversationAfterMessage(conv.id, replyText, (conv.message_count || 0) + 1);
            console.log(`[webhook] Command auto-reply: "${matched.trigger_word}" → ${phone} via ${provCmd.provider}`);
          }
        }
      }
    }
  } catch (cmdErr: any) {
    console.warn("[webhook] Command auto-reply error:", cmdErr.message);
  }

  // AI autoresponder: delega para wa-ai-reply
  try {
    if (!matched && phone && content && projectId && providerId) {
      supabase.functions.invoke("wa-ai-reply", {
        body: {
          conversation_id: conv.id,
          project_id: projectId,
          provider_id: providerId,
          phone,
          message: content,
          push_name: pushName,
          media_url: mediaUrl || undefined,
          media_type: messageType || undefined,
        },
      }).catch((e: any) => console.warn("[webhook] wa-ai-reply invoke error:", e?.message));
      console.log("[webhook] wa-ai-reply invocado conv=" + conv.id + " media=" + !!mediaUrl);
    }
  } catch (aiErr: any) {
    console.error("[webhook] AI delegate error:", aiErr.message);
  }
}

export async function handleWebhook(req: Request, url: URL, deps: WebhookDeps): Promise<Response> {
  const { supabase, corsHeaders, evolutionEventFromPath, findOrCreateConversation, updateConversationAfterMessage } = deps;

  const body = await req.json();
  const rawProvider = url.searchParams.get("provider") || "evolution";
  const providerType = rawProvider.split("/")[0].toLowerCase();

  const rawEventType = evolutionEventFromPath || body?.event || "MESSAGES_UPSERT";
  const eventType = rawEventType.toUpperCase().replace(/[.\-]/g, "_");
  const instanceName = body?.instance || "";

  console.log(`[webhook] event=${eventType} instance=${instanceName} provider=${providerType}`);

  // ── MESSAGES_UPSERT — incoming message ──
  if (providerType === "evolution" && (eventType === "MESSAGES_UPSERT" || eventType === "SEND_MESSAGE")) {
    const incomingAt = Date.now();
    const key = body?.data?.key;
    const msg = body?.data?.message;
    const pushName = body?.data?.pushName || "";

    if (eventType === "SEND_MESSAGE") {
      console.log("[webhook] Skipping SEND_MESSAGE (own outbound echo)");
      return new Response(JSON.stringify({ success: true, skipped: "send_message_echo" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawJid = key?.remoteJid || "";
    const jidSuffix = (rawJid.split("@")[1] || "s.whatsapp.net").toLowerCase();
    const phone = rawJid.split("@")[0].replace(/\D/g, "");
    const providerMsgId = key?.id || "";

    const isFromMe =
      key?.fromMe === true ||
      body?.data?.fromMe === true ||
      body?.data?.key?.fromMe === true ||
      body?.fromMe === true;

    if (isFromMe) {
      if (providerMsgId) {
        const { data: existingMsg } = await supabase
          .from("imphq_wa_messages")
          .select("id")
          .eq("provider_message_id", providerMsgId)
          .maybeSingle();

        if (existingMsg) {
          console.log(`[webhook] Outgoing message ${providerMsgId} already exists in DB. Skipping duplicate.`);
          return new Response(JSON.stringify({ success: true, skipped: "fromMe_duplicate" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.log(`[webhook] Outgoing message ${providerMsgId} not in DB. Processing as operator external reply.`);
      } else {
        console.log("[webhook] Skipping fromMe message due to missing provider_message_id");
        return new Response(JSON.stringify({ success: true, skipped: "fromMe_no_id" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let content = "";
    let messageType = "text";

    if (msg?.conversation) {
      content = msg.conversation;
    } else if (msg?.extendedTextMessage?.text) {
      content = msg.extendedTextMessage.text;
    } else if (msg?.imageMessage) {
      content = msg.imageMessage.caption ? `📷 ${msg.imageMessage.caption}` : "📷 Imagem";
      messageType = "image";
    } else if (msg?.audioMessage) {
      const duration = msg.audioMessage.seconds ? ` (${msg.audioMessage.seconds}s)` : "";
      content = msg.audioMessage.ptt ? `🎤 Áudio${duration}` : `🔊 Áudio${duration}`;
      messageType = "audio";
    } else if (msg?.videoMessage) {
      content = msg.videoMessage.caption ? `🎬 ${msg.videoMessage.caption}` : "🎬 Vídeo";
      messageType = "video";
    } else if (msg?.documentMessage) {
      const fileName = msg.documentMessage.fileName || "arquivo";
      content = `📎 ${fileName}`;
      messageType = "document";
    } else if (msg?.stickerMessage) {
      content = "🏷️ Sticker";
      messageType = "sticker";
    } else if (msg?.contactMessage) {
      content = `👤 Contato: ${msg.contactMessage.displayName || ""}`;
      messageType = "contact";
    } else if (msg?.locationMessage) {
      content = `📍 Localização`;
      messageType = "location";
    }

    const { data: prov } = await supabase
      .from("imphq_wa_providers")
      .select("id, project_id")
      .eq("instance_name", instanceName)
      .single();
    const projectId = prov?.project_id || "";
    const providerId = prov?.id || null;

    if (phone && content && projectId) {
      const conv = await findOrCreateConversation(phone, projectId, providerId, pushName || undefined, jidSuffix);

      let mediaUrl: string | null = null;
      if (messageType !== "text" && messageType !== "contact" && messageType !== "location" && messageType !== "sticker") {
        try {
          const { data: provData } = await supabase
            .from("imphq_wa_providers")
            .select("api_url, api_key, instance_name")
            .eq("id", providerId)
            .single();

          if (provData?.api_url && provData?.api_key) {
            const apiBase = provData.api_url.replace(/\/+$/, "");
            const inst = encodeURIComponent(provData.instance_name);
            const mediaRes = await fetch(`${apiBase}/chat/getBase64FromMediaMessage/${inst}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: provData.api_key },
              body: JSON.stringify({ message: { key, message: msg } }),
            });

            if (mediaRes.ok) {
              const mediaData = await mediaRes.json();
              const base64 = mediaData?.base64 || mediaData?.data;
              const mimetype = mediaData?.mimetype || "application/octet-stream";

              if (base64) {
                const cleanMimetype = mimetype.split(";")[0].trim().toLowerCase();
                const extMap: Record<string, string> = {
                  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
                  "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a",
                  "video/mp4": "mp4", "application/pdf": "pdf",
                };
                const ext = extMap[cleanMimetype] || cleanMimetype.split("/")[1] || "bin";
                const filePath = `${projectId}/${conv.id}/${providerMsgId || Date.now()}.${ext}`;

                const binaryStr = atob(base64);
                const bytes = new Uint8Array(binaryStr.length);
                for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

                const { error: uploadError } = await supabase.storage
                  .from("whatsapp-media")
                  .upload(filePath, bytes, { contentType: mimetype, upsert: true });

                if (!uploadError) {
                  const { data: urlData } = supabase.storage.from("whatsapp-media").getPublicUrl(filePath);
                  mediaUrl = urlData?.publicUrl || null;
                  console.log(`[webhook] Media uploaded: ${mediaUrl}`);
                } else {
                  console.warn("[webhook] Media upload error:", uploadError.message);
                }
              }
            } else {
              console.warn("[webhook] Failed to fetch media base64:", mediaRes.status);
            }
          }
        } catch (mediaErr: any) {
          console.warn("[webhook] Media download error:", mediaErr.message);
        }
      }

      // Echo dedupe
      const echoCutoff = new Date(Date.now() - 15000).toISOString();
      const { data: echoRows } = await supabase
        .from("imphq_wa_messages")
        .select("id")
        .eq("conversation_id", conv.id)
        .eq("direction", "outgoing")
        .eq("content", content)
        .gte("created_at", echoCutoff)
        .limit(1);
      if (echoRows && echoRows.length > 0) {
        console.log(`[webhook] Skipping echo of our own outgoing message`);
        return new Response(JSON.stringify({ success: true, skipped: "echo" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: savedMsg, error: msgError } = await supabase.from("imphq_wa_messages").insert({
        conversation_id: conv.id,
        direction: isFromMe ? "outgoing" : "incoming",
        phone,
        content,
        message_type: messageType,
        media_url: mediaUrl,
        project_id: projectId,
        provider: providerType,
        provider_message_id: providerMsgId,
        status: isFromMe ? "sent" : "received",
        sent_by: isFromMe ? "human" : "lead",
      }).select("id").maybeSingle();

      if (msgError) {
        console.error("[webhook] DB save error:", msgError.message);
      } else {
        console.log(`[webhook] Saved ${messageType} from ${phone} (conv=${conv.id}) media=${!!mediaUrl}`);
      }

      if (isFromMe) {
        await updateConversationAfterMessage(conv.id, content, conv.message_count || 0, false, true);
        // Aprendizado a partir de respostas enviadas pelo celular (fora do painel)
        if (content && content.length > 15 && projectId) {
          supabase.functions.invoke("wa-learn-from-human", {
            body: { conversation_id: conv.id, message_id: savedMsg?.id, project_id: projectId },
          }).catch((e: any) => console.warn("[webhook] learn invoke skip:", e?.message));
        }
      } else {
        await runWhatsAppAutoresponder(
          deps,
          conv,
          phone,
          content,
          messageType,
          providerMsgId,
          pushName,
          providerId,
          projectId,
          "evolution",
          jidSuffix,
          incomingAt,
          mediaUrl,
        );
      }
    } else {
      console.log(`[webhook] Skipped: phone=${phone} content=${!!content} project=${projectId}`);
    }

    return new Response(JSON.stringify({ success: true, event: eventType }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── MESSAGES_UPDATE — delivery/read status ──
  if (providerType === "evolution" && eventType === "MESSAGES_UPDATE") {
    const msgId = body?.data?.key?.id || body?.data?.keyId || "";
    const status = body?.data?.status || "";

    const statusMap: Record<string, string> = {
      "0": "error", "1": "pending", "2": "sent", "3": "delivered", "4": "read", "5": "played",
      "ERROR": "error", "PENDING": "pending", "SERVER_ACK": "sent",
      "DELIVERY_ACK": "delivered", "READ": "read", "PLAYED": "played",
    };
    const mappedStatus = statusMap[String(status)] || String(status);

    if (msgId && mappedStatus) {
      const { error, count } = await supabase
        .from("imphq_wa_messages")
        .update({ status: mappedStatus })
        .eq("provider_message_id", msgId);

      console.log(`[webhook] MESSAGES_UPDATE msgId=${msgId} status=${mappedStatus} updated=${count ?? "?"} err=${error?.message || "none"}`);
    }

    return new Response(JSON.stringify({ success: true, event: "MESSAGES_UPDATE" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── CONNECTION_UPDATE ──
  if (providerType === "evolution" && eventType === "CONNECTION_UPDATE") {
    const state = body?.data?.state || body?.data?.status || "";

    if (instanceName && state) {
      const dbStatus = state === "open" ? "connected" : state === "close" ? "disconnected" : state;

      const { error } = await supabase
        .from("imphq_wa_providers")
        .update({ status: dbStatus, updated_at: new Date().toISOString() })
        .eq("instance_name", instanceName);

      console.log(`[webhook] CONNECTION_UPDATE instance=${instanceName} state=${state} dbStatus=${dbStatus} err=${error?.message || "none"}`);
    }

    return new Response(JSON.stringify({ success: true, event: "CONNECTION_UPDATE" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Twilio inbound ──
  if (providerType === "twilio") {
    const phone = (body?.From || "").replace("whatsapp:+", "");
    const content = body?.Body || "";

    if (phone && content) {
      console.log(`[webhook] Twilio inbound from ${phone}`);
    }

    return new Response(JSON.stringify({ success: true, event: "twilio_inbound" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── GROUP_PARTICIPANTS_UPDATE ──
  if (providerType === "evolution" && eventType === "GROUP_PARTICIPANTS_UPDATE") {
    const participants = body?.data?.participants || body?.data?.affect || [];
    const action2 = body?.data?.action || "";
    const groupJid = body?.data?.id || body?.data?.jid || "";

    if (action2 === "remove" && groupJid && Array.isArray(participants)) {
      for (const p of participants) {
        const exitPhone = String(p).replace("@s.whatsapp.net", "").replace(/\D/g, "");
        if (!exitPhone) continue;

        await supabase.from("imphq_wa_group_exits").insert({
          group_jid: groupJid,
          phone: exitPhone,
          provider_id: null,
        });

        const { data: exitCampaigns } = await supabase
          .from("imphq_wa_campaigns")
          .select("id, exit_message, provider_id")
          .eq("status", "active")
          .not("exit_message", "is", null);

        if (exitCampaigns) {
          for (const ec of exitCampaigns) {
            const groups: string[] = (ec as any).groups || [];
            if (!groups.includes(groupJid)) continue;
            if (!ec.exit_message || !ec.provider_id) continue;

            const { data: exitProv } = await supabase
              .from("imphq_wa_providers")
              .select("api_url, api_key, instance_name")
              .eq("id", ec.provider_id)
              .single();

            if (exitProv) {
              const exitApi = exitProv.api_url.replace(/\/+$/, "");
              const exitInst = encodeURIComponent(exitProv.instance_name);
              try {
                await fetch(`${exitApi}/message/sendText/${exitInst}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", apikey: exitProv.api_key },
                  body: JSON.stringify({ number: exitPhone + "@s.whatsapp.net", text: ec.exit_message }),
                });
                await supabase.from("imphq_wa_group_exits")
                  .update({ message_sent: true, campaign_id: ec.id })
                  .eq("phone", exitPhone)
                  .eq("group_jid", groupJid)
                  .eq("message_sent", false);
                console.log(`[webhook] Exit DM sent to ${exitPhone} from campaign ${ec.id}`);
              } catch (dmErr: any) {
                console.warn(`[webhook] Exit DM error: ${dmErr.message}`);
              }
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, event: "GROUP_PARTICIPANTS_UPDATE" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`[webhook] Unhandled event=${eventType} instance=${instanceName}`);
  return new Response(JSON.stringify({ success: true, event: eventType, handled: false }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

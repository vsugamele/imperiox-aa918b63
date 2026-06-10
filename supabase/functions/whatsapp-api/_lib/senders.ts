// Senders puros para Evolution, Twilio e Meta Cloud.
// Sem closure de supabase — funções stateless que recebem o provider e fazem fetch.
//
// Extraído de whatsapp-api/index.ts para reduzir o índice de 2544 → ~2150 linhas
// e isolar a parte que toca APIs externas (fácil de testar/mockar/trocar).

const TWILIO_GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export function isTransientConnError(payload: string): boolean {
  const s = payload.toLowerCase();
  return s.includes("connection closed") || s.includes("connection lost")
    || s.includes("connection replaced") || s.includes("timed out")
    || s.includes("timeout") || s.includes("socket") || s.includes("econnreset");
}

export async function tryReconnectInstance(provider: any): Promise<boolean> {
  try {
    const inst = encodeURIComponent(provider.instance_name);
    const url = `${provider.api_url}/instance/connect/${inst}`;
    const res = await fetch(url, { method: "GET", headers: { apikey: provider.api_key } });
    console.log("[tryReconnectInstance] status:", res.status);
    return res.ok;
  } catch (e) {
    console.warn("[tryReconnectInstance] failed:", (e as Error).message);
    return false;
  }
}

export async function sendEvolutionButtons(provider: any, phone: string, text: string, buttons: any[]) {
  const inst = encodeURIComponent(provider.instance_name);
  const apiUrl = `${provider.api_url}/message/sendButtons/${inst}`;
  console.log("[sendEvolutionButtons] URL:", apiUrl, "phone:", phone, "buttons:", buttons.length);
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: provider.api_key },
    body: JSON.stringify({
      number: phone,
      title: text,
      description: "Imperio HQ",
      footer: "Imperio HQ",
      buttons: buttons.map((b: any, index: number) => ({
        buttonId: b.id || `btn_${index}`,
        buttonText: { displayText: b.text },
        type: 1,
      })),
    }),
  });
  return await res.json().catch(() => ({}));
}

export async function sendEvolutionList(provider: any, phone: string, text: string, listData: any) {
  const inst = encodeURIComponent(provider.instance_name);
  const apiUrl = `${provider.api_url}/message/sendList/${inst}`;
  console.log("[sendEvolutionList] URL:", apiUrl, "phone:", phone, "title:", listData.title);
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: provider.api_key },
    body: JSON.stringify({
      number: phone,
      title: listData.title || "Menu de Opções",
      description: text,
      buttonText: listData.buttonText || "Clique para ver",
      footer: "Imperio HQ",
      sections: [
        {
          title: listData.sectionTitle || "Opções",
          rows: listData.rows.map((r: any, index: number) => ({
            rowId: r.id || `row_${index}`,
            title: r.title,
            description: r.description || "",
          })),
        },
      ],
    }),
  });
  return await res.json().catch(() => ({}));
}

export async function sendEvolution(provider: any, phone: string, text: string) {
  const inst = encodeURIComponent(provider.instance_name);
  const apiUrl = `${provider.api_url}/message/sendText/${inst}`;
  console.log("[sendEvolution] URL:", apiUrl, "phone:", phone, "textLen:", text.length);

  const MAX_ATTEMPTS = 3;
  let lastErr = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: provider.api_key },
      body: JSON.stringify({ number: phone, text }),
    });
    const data = await res.json().catch(() => ({}));
    console.log(`[sendEvolution] attempt=${attempt} status=${res.status}`, JSON.stringify(data).slice(0, 300));

    if (res.ok) return data;

    const msgs = data?.response?.message;
    if (res.status === 400 && Array.isArray(msgs) && msgs.some((m: any) => m.exists === false)) {
      return { ok: false, error: "invalid_number", details: msgs };
    }

    const payload = JSON.stringify(data);
    lastErr = `Evolution error [${res.status}]: ${payload}`;

    if (!isTransientConnError(payload) && res.status !== 408 && res.status !== 502 && res.status !== 503 && res.status !== 504) {
      throw new Error(lastErr);
    }

    if (attempt < MAX_ATTEMPTS) {
      await tryReconnectInstance(provider);
      await sleep(800 * attempt);
    }
  }
  throw new Error(lastErr || "Evolution: falha após múltiplas tentativas");
}

export async function sendEvolutionMedia(provider: any, phone: string, mediaUrl: string, mediaType: string, caption?: string) {
  const inst = encodeURIComponent(provider.instance_name);
  const endpoint = mediaType === "audio" ? "sendWhatsAppAudio" : "sendMedia";
  const apiUrl = `${provider.api_url}/message/${endpoint}/${inst}`;
  console.log("[sendEvolutionMedia] URL:", apiUrl, "phone:", phone, "mediaType:", mediaType);

  const body: any = { number: phone, mediatype: mediaType, media: mediaUrl };
  if (caption) body.caption = caption;
  if (mediaType === "document") body.fileName = caption || "document";

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: provider.api_key },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  console.log("[sendEvolutionMedia] status:", res.status, "response:", JSON.stringify(data).slice(0, 500));
  if (!res.ok) {
    const msgs = data?.response?.message;
    if (res.status === 400 && Array.isArray(msgs) && msgs.some((m: any) => m.exists === false)) {
      return { ok: false, error: "invalid_number", details: msgs };
    }
    throw new Error(`Evolution media error [${res.status}]: ${JSON.stringify(data)}`);
  }
  return data;
}

export async function sendTwilio(provider: any, phone: string, text: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
  if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY not configured");

  const fromNumber = provider.twilio_from || "";
  const res = await fetch(`${TWILIO_GATEWAY_URL}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TWILIO_API_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: `whatsapp:+${phone.replace(/\D/g, "")}`,
      From: `whatsapp:${fromNumber}`,
      Body: text,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Twilio error [${res.status}]: ${JSON.stringify(data)}`);
  return data;
}

export async function sendMetaCloud(provider: any, phone: string, text: string) {
  const phoneNumberId = provider.phone_number_id;
  const accessToken = provider.access_token;
  if (!phoneNumberId) throw new Error("phone_number_id não configurado no provider Meta Cloud");
  if (!accessToken) throw new Error("access_token não configurado no provider Meta Cloud");

  const apiUrl = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phone.replace(/\D/g, ""),
      type: "text",
      text: { body: text, preview_url: true },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Meta Cloud error [${res.status}]: ${JSON.stringify(data)}`);
  const msgId = data?.messages?.[0]?.id;
  return { ...data, key: { id: msgId } };
}

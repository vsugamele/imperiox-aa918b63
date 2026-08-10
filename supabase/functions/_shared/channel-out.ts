// Envio de mensagens para canais não-WhatsApp do OpenFlow (Messenger via Zernio, Webchat do site).
// Mantém um registro em imphq_channel_messages para histórico e para o widget fazer polling.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export interface ChannelSession {
  id: string;
  canal: string;
  external_id: string;
  project_id: string | null;
  meta?: Record<string, any> | null;
}

/** Chama o bridge zernio-mcp desta instância. */
async function zernioMcp(projectId: string, body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/zernio-mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({ project_id: projectId, ...body }),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok && json?.ok !== false, status: res.status, json };
}

let cachedTool: Record<string, string> = {};

/** Descobre dinamicamente a tool de envio de mensagem do Messenger no MCP do Zernio. */
async function resolveMessengerTool(projectId: string): Promise<string | null> {
  if (cachedTool[projectId]) return cachedTool[projectId];
  const r = await zernioMcp(projectId, { op: "tools/list" });
  const tools: any[] = r.json?.result?.tools || r.json?.result || [];
  const names: string[] = Array.isArray(tools)
    ? tools.map((t) => (typeof t === "string" ? t : t?.name)).filter(Boolean)
    : [];
  const score = (n: string) => {
    const s = n.toLowerCase();
    let v = 0;
    if (s.includes("send")) v += 3;
    if (s.includes("messenger")) v += 3;
    if (s.includes("message") || s.includes("dm")) v += 2;
    if (s.includes("reply")) v += 1;
    return v;
  };
  const best = names.filter((n) => score(n) >= 5).sort((a, b) => score(b) - score(a))[0]
    || names.filter((n) => score(n) >= 3).sort((a, b) => score(b) - score(a))[0];
  if (best) cachedTool[projectId] = best;
  return best || null;
}

async function sendMessenger(session: ChannelSession, text: string, mediaUrl?: string | null) {
  const projectId = session.project_id;
  if (!projectId) return { success: false, error: "Sessão sem project_id" };
  const tool = await resolveMessengerTool(projectId);
  if (!tool) return { success: false, error: "Nenhuma tool de envio Messenger encontrada no MCP do Zernio" };

  const accountId = session.meta?.zernio_account_id || session.meta?.page_id || undefined;
  const args: Record<string, unknown> = {
    // Zernio aceita variações de nome — enviamos os aliases mais comuns.
    recipientId: session.external_id,
    userId: session.external_id,
    psid: session.external_id,
    conversationId: session.meta?.conversation_id || undefined,
    message: text,
    text,
    platform: "messenger",
    ...(accountId ? { accountId } : {}),
    ...(mediaUrl ? { mediaUrl, attachmentUrl: mediaUrl } : {}),
  };
  const r = await zernioMcp(projectId, { op: "tools/call", tool, args });
  if (!r.ok) return { success: false, error: JSON.stringify(r.json?.error || r.json).slice(0, 400) };
  return { success: true, response: r.json?.result ?? r.json };
}

/** Envia texto (e mídia opcional) para uma sessão de canal. Retorna { success, error? }. */
export async function sendToChannel(
  supa: any,
  session: ChannelSession,
  text: string,
  mediaUrl?: string | null,
): Promise<{ success: boolean; error?: string; response?: unknown }> {
  let result: { success: boolean; error?: string; response?: unknown } = { success: true };

  if (session.canal === "messenger") {
    result = await sendMessenger(session, text, mediaUrl);
  }
  // webchat: a entrega acontece pelo polling do widget, então basta persistir.

  await supa.from("imphq_channel_messages").insert({
    session_id: session.id,
    direction: "out",
    texto: text,
    media_url: mediaUrl || null,
    meta: result.success ? {} : { error: result.error },
  });
  await supa
    .from("imphq_channel_sessions")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", session.id);

  return result;
}

/** Cria/recupera a sessão de canal por external_id. */
export async function upsertSession(
  supa: any,
  input: {
    canal: string;
    external_id: string;
    project_id?: string | null;
    nome?: string | null;
    avatar_url?: string | null;
    origin?: string | null;
    widget_id?: string | null;
    meta?: Record<string, any>;
  },
): Promise<ChannelSession> {
  const { data: existing } = await supa
    .from("imphq_channel_sessions")
    .select("*")
    .eq("canal", input.canal)
    .eq("external_id", input.external_id)
    .maybeSingle();

  if (existing) {
    const patch: Record<string, unknown> = { last_message_at: new Date().toISOString() };
    if (input.nome && !existing.nome) patch.nome = input.nome;
    if (input.avatar_url && !existing.avatar_url) patch.avatar_url = input.avatar_url;
    if (input.meta) patch.meta = { ...(existing.meta || {}), ...input.meta };
    await supa.from("imphq_channel_sessions").update(patch).eq("id", existing.id);
    return { ...existing, ...patch } as ChannelSession;
  }

  const { data, error } = await supa
    .from("imphq_channel_sessions")
    .insert({
      canal: input.canal,
      external_id: input.external_id,
      project_id: input.project_id || null,
      nome: input.nome || null,
      avatar_url: input.avatar_url || null,
      origin: input.origin || null,
      widget_id: input.widget_id || null,
      meta: input.meta || {},
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ChannelSession;
}

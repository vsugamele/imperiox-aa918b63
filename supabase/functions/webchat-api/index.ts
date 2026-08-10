// API pública do chat do site (webchat) — usada pelo widget embed.
// Ações: init | send | poll
// Público (verify_jwt = false). CORS liberado, com validação opcional de origens por widget.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { upsertSession } from "../_shared/channel-out.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function originAllowed(widget: any, origin: string | null) {
  const list: string[] = widget.allowed_origins || [];
  if (!list.length) return true;
  if (!origin) return false;
  return list.some((o) => {
    const clean = o.trim().replace(/\/$/, "");
    if (!clean) return false;
    if (clean === "*") return true;
    return origin.replace(/\/$/, "").endsWith(clean.replace(/^https?:\/\//, ""));
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supa = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const publicKey = String(body.public_key || "");
    if (!publicKey) return json({ error: "public_key obrigatório" }, 400);

    const { data: widget } = await supa
      .from("imphq_webchat_widgets")
      .select("*")
      .eq("public_key", publicKey)
      .eq("ativo", true)
      .maybeSingle();
    if (!widget) return json({ error: "widget não encontrado ou inativo" }, 404);

    const origin = req.headers.get("Origin");
    if (!originAllowed(widget, origin)) return json({ error: "origem não autorizada" }, 403);

    if (action === "init") {
      return json({
        ok: true,
        widget: {
          nome: widget.nome,
          titulo: widget.titulo,
          cor: widget.cor,
          saudacao: widget.saudacao,
          tema: widget.tema || "padrao",
          avatar_url: widget.avatar_url || null,
          subtitulo: widget.subtitulo ?? "online",
          som: widget.som !== false,
          texto_digitando: widget.texto_digitando || "digitando...",
          texto_gravando: widget.texto_gravando || "gravando audio...",
        },
      });
    }


    const visitorId = String(body.visitor_id || "");
    if (!visitorId || visitorId.length < 8) return json({ error: "visitor_id inválido" }, 400);
    const externalId = `${widget.id}:${visitorId}`;

    if (action === "poll") {
      const since = body.since ? String(body.since) : null;
      const { data: session } = await supa
        .from("imphq_channel_sessions")
        .select("id")
        .eq("canal", "webchat")
        .eq("external_id", externalId)
        .maybeSingle();
      if (!session) return json({ ok: true, messages: [] });
      let q = supa
        .from("imphq_channel_messages")
        .select("id, direction, texto, media_url, created_at")
        .eq("session_id", session.id)
        .order("created_at", { ascending: true })
        .limit(100);
      if (since) q = q.gt("created_at", since);
      const { data: msgs } = await q;
      return json({ ok: true, messages: msgs || [] });
    }

    if (action === "send") {
      const text = String(body.content || "").trim().slice(0, 4000);
      if (!text) return json({ error: "content obrigatório" }, 400);

      const session = await upsertSession(supa, {
        canal: "webchat",
        external_id: externalId,
        project_id: widget.project_id,
        nome: String(body.nome || "").slice(0, 120) || null,
        origin: origin,
        widget_id: widget.id,
        meta: { page_url: String(body.page_url || "").slice(0, 500) || undefined },
      });

      await supa.from("imphq_channel_messages").insert({
        session_id: session.id,
        direction: "in",
        texto: text,
        meta: { page_url: body.page_url || null },
      });

      // Dispara o fluxo vinculado (ou fluxos de canal webchat do projeto)
      fetch(`${SUPABASE_URL}/functions/v1/openflow-executor`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({
          trigger_tipo: "webchat_mensagem_recebida",
          project_id: widget.project_id,
          automacao_id: widget.automacao_id || undefined,
          lead_data: {
            canal: "webchat",
            channel_session_id: session.id,
            nome: session.nome || "Visitante do site",
            message_content: text,
            mensagem_recebida: text,
          },
        }),
      }).catch((e) => console.warn("[webchat-api] executor err", e?.message));

      return json({ ok: true, session_id: session.id });
    }

    return json({ error: "action inválida" }, 400);
  } catch (e) {
    console.error("[webchat-api]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

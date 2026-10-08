// JP2.1: resolve quem está esperando o suporte de acesso do JP (Instagram ou WhatsApp), sem passar pela equipe.
// Para cada conversa: acha o e-mail (mensagens ou telefone), confere a área de membros, libera o vitalício quando a pessoa
// diz que tem (regra de 08/10), gera o link de entrada sem senha e responde no mesmo canal. Tudo entra em "A IA fez".
// Body: { modo: "dry" | "run", conversas: [{ canal: "instagram" | "whatsapp", id }] }.
// Anti-loop: no máximo 20 conversas por chamada, uma resposta por conversa a cada 12h, para após 3 falhas seguidas.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { COMMUNITY_PATH, decideSupport, lastEmail, supportMessage, wantsCommunity, type ActiveEntitlement, type SupportAction } from "../_shared/jp-support-resolve.ts";
import { hasLifetimePlan, JP_LIFETIME_PLAN, LIFETIME_CLAIM_REF } from "../_shared/jp-verified-grant.ts";
import { phoneTail } from "../_shared/jp-verified-grant.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PROJECT = "jp_freitas";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const makeClient = () => createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
type Sb = ReturnType<typeof makeClient>;

interface Conv { canal: "instagram" | "whatsapp"; id: string; inbound: string[]; phone: string | null; participantId: string | null; providerId: string | null }

async function loadConv(sb: Sb, canal: string, id: string): Promise<Conv | null> {
  if (canal === "instagram") {
    const { data: c } = await sb.from("imphq_ig_conversations").select("id, participant_id").eq("id", id).maybeSingle();
    if (!c) return null;
    const { data: msgs } = await sb.from("imphq_ig_messages").select("content").eq("conversation_id", id).eq("direction", "in").order("created_at", { ascending: true }).limit(40);
    return { canal, id, inbound: (msgs ?? []).map((m: { content: string | null }) => m.content ?? ""), phone: null, participantId: c.participant_id, providerId: null };
  }
  const { data: c } = await sb.from("imphq_wa_conversations").select("id, phone, provider_id, project_id").eq("id", id).maybeSingle();
  if (!c || c.project_id !== PROJECT) return null;
  const { data: msgs } = await sb.from("imphq_wa_messages").select("content, direction").eq("conversation_id", id).order("created_at", { ascending: true }).limit(80);
  const inbound = (msgs ?? []).filter((m: { direction: string | null }) => !/^out/.test(String(m.direction ?? ""))).map((m: { content: string | null }) => m.content ?? "");
  return { canal: "whatsapp", id, inbound, phone: c.phone, participantId: null, providerId: c.provider_id };
}

async function emailByPhone(sb: Sb, phone: string | null): Promise<string> {
  const tail = phoneTail(phone);
  if (!tail) return "";
  const { data } = await sb.from("imphq_leads").select("email").eq("project_id", PROJECT).ilike("phone", `%${tail}%`).not("email", "is", null).order("created_at", { ascending: false }).limit(1);
  return String(data?.[0]?.email ?? "").toLowerCase().trim();
}

async function findUserId(sb: Sb, email: string): Promise<string | null> {
  const { data: prof } = await sb.from("areamembrojp_profiles").select("id").ilike("email", email).limit(1);
  if (prof?.[0]?.id) return prof[0].id;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === email);
    if (u) return u.id;
    if (data.users.length < 1000) break;
  }
  return null;
}

async function activeEnts(sb: Sb, userId: string | null): Promise<ActiveEntitlement[]> {
  if (!userId) return [];
  const { data } = await sb.from("areamembrojp_user_entitlements").select("scope, plan_id, program_id, expires_at").eq("user_id", userId).eq("is_active", true);
  return (data ?? []) as ActiveEntitlement[];
}

async function magicLink(sb: Sb, userId: string, path = "/home"): Promise<string> {
  const { data: t } = await sb.from("areamembrojp_tenant_settings").select("site_url").maybeSingle();
  const origin = String(t?.site_url ?? "https://www.jphaireducation.com.br").replace(/\/$/, "");
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const { error } = await sb.from("areamembrojp_tenant_magic_tokens").insert({ user_id: userId, token_hash: token, tenant_origin: origin, redirect_path: path, expires_at: new Date(Date.now() + 86_400_000).toISOString() });
  if (error) throw new Error(`link: ${error.message}`);
  return `${origin}/auth/verify?token=${token}`;
}

async function grantLifetime(sb: Sb, email: string, userId: string | null): Promise<string> {
  let uid = userId;
  if (!uid) {
    const { data, error } = await sb.auth.admin.createUser({ email, email_confirm: true, user_metadata: { source: "imperio-support" } });
    if (error || !data.user) throw new Error(`conta: ${error?.message ?? "sem usuário"}`);
    uid = data.user.id;
    await sb.from("areamembrojp_profiles").upsert({ id: uid, email, updated_at: new Date().toISOString() }, { onConflict: "id" });
  }
  const { error } = await sb.from("areamembrojp_user_entitlements").insert({ user_id: uid, scope: "plan", plan_id: JP_LIFETIME_PLAN.plan_id, source: "imperio-support", source_ref: LIFETIME_CLAIM_REF, is_active: true, expires_at: null });
  if (error) throw new Error(`acesso: ${error.message}`);
  if (!hasLifetimePlan(await activeEnts(sb, uid))) throw new Error("acesso não confirmado");
  return uid;
}

/** O que a varredura liberou para este e-mail nos últimos 3 dias (bumps que tinham ficado de fora). */
async function sweptProducts(sb: Sb, email: string): Promise<string[]> {
  const { data } = await sb.from("imphq_ai_actions").select("payload").eq("source", "jp-access-sweep").gte("created_at", new Date(Date.now() - 3 * 86_400_000).toISOString());
  return [...new Set((data ?? []).map((a: { payload: Record<string, unknown> | null }) => a.payload ?? {}).filter((p) => String(p.email ?? "").toLowerCase() === email).map((p) => String(p.produto ?? "")).filter(Boolean))];
}

async function send(sb: Sb, conv: Conv, text: string): Promise<void> {
  if (conv.canal === "instagram") {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/instagram-api`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
      body: JSON.stringify({ action: "send_text", project_id: PROJECT, recipient_id: conv.participantId, text, ai_generated: true, metadata: { source: "jp-support-resolve" } }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d?.error) throw new Error(d?.code === "OUTSIDE_24H_WINDOW" ? "fora da janela de 24h do Instagram" : `instagram: ${String(d?.error ?? r.status).slice(0, 200)}`);
    return;
  }
  const { data: p } = await sb.from("imphq_wa_providers").select("api_url, api_key, instance_name, provider").eq("id", conv.providerId).maybeSingle();
  if (!p?.api_url || !p.instance_name) throw new Error("whatsapp: provedor não encontrado");
  const phone = String(conv.phone ?? "").replace(/\D/g, "");
  const r = await fetch(`${String(p.api_url).replace(/\/+$/, "")}/message/sendText/${encodeURIComponent(p.instance_name)}`, {
    method: "POST", headers: { "Content-Type": "application/json", apikey: p.api_key },
    body: JSON.stringify({ number: `${phone}@s.whatsapp.net`, text, options: { delay: 1000, presence: "composing" } }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d?.error || d?.success === false) throw new Error(`whatsapp: ${r.status} ${JSON.stringify(d).slice(0, 160)}`);
  await sb.from("imphq_wa_messages").insert({ conversation_id: conv.id, direction: "outgoing", phone, content: text, message_type: "text", project_id: PROJECT, provider: p.provider, provider_message_id: d?.key?.id ?? null, status: "sent", sent_by: "ai", metadata: { source: "jp-support-resolve" } });
}

async function recentlyAnswered(sb: Sb, convId: string): Promise<boolean> {
  const { data } = await sb.from("imphq_ai_actions").select("id").eq("source", "jp-support-resolve").contains("payload", { conversation_id: convId }).gte("created_at", new Date(Date.now() - 12 * 3_600_000).toISOString()).limit(1);
  return !!data?.length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const modo = String(body?.modo ?? "dry");
    const lista = (Array.isArray(body?.conversas) ? body.conversas : []).slice(0, 20) as Array<{ canal: string; id: string }>;
    if (!lista.length) return json({ error: "conversas é obrigatório" }, 400);
    const sb = makeClient();
    const out: Array<Record<string, unknown>> = [];
    let falhas = 0;

    for (const item of lista) {
      if (falhas >= 3) { out.push({ parou: "3 falhas seguidas" }); break; }
      try {
        const conv = await loadConv(sb, item.canal, String(item.id));
        if (!conv) { out.push({ id: item.id, erro: "conversa não encontrada" }); continue; }
        if (modo === "run" && await recentlyAnswered(sb, conv.id)) { out.push({ id: conv.id, pulado: "já respondida nas últimas 12h" }); continue; }
        const email = lastEmail(conv.inbound) || await emailByPhone(sb, conv.phone);
        const userId = email ? await findUserId(sb, email) : null;
        const ents = await activeEnts(sb, userId);
        const action: SupportAction = decideSupport({ inboundTexts: conv.inbound, email, hasAccount: !!userId, ents, hasLifetime: hasLifetimePlan(ents) });
        const swept = email ? await sweptProducts(sb, email) : [];
        const comunidade = action.acao === "link" && wantsCommunity(conv.inbound);
        if (modo !== "run") { out.push({ id: conv.id, canal: conv.canal, email, acao: action.acao, comunidade, mensagem: supportMessage(action, "<link>", swept, comunidade) }); continue; }

        let uid = userId;
        if (action.acao === "vitalicio") uid = await grantLifetime(sb, email, userId);
        const link = (action.acao === "link" || action.acao === "vitalicio") && uid ? await magicLink(sb, uid, comunidade ? COMMUNITY_PATH : "/home") : "";
        const text = supportMessage(action, link, swept, comunidade);
        await send(sb, conv, text);

        const resolved = action.acao === "link" || action.acao === "vitalicio";
        await sb.from("imphq_jp_conversation_state").update({ support_status: resolved ? "awaiting_confirmation" : "pending", support_kind: "access", updated_at: new Date().toISOString() }).eq("channel", conv.canal).eq("conversation_id", conv.id);
        if (conv.canal === "instagram") await sb.from("imphq_ig_conversations").update({ ai_paused: false, ai_paused_reason: null }).eq("id", conv.id);
        await sb.from("imphq_ai_actions").insert({
          kind: action.acao === "vitalicio" ? "grantAccess" : "supportReply", risk_level: "low", status: "executed", confidence: 0.95, auto_executed: true, executed_at: new Date().toISOString(),
          title: action.acao === "vitalicio" ? `Liberei o vitalício de ${email} (${conv.canal})` : `Respondi o suporte de acesso de ${email || "contato sem e-mail"} (${conv.canal})`,
          reason: action.acao === "vitalicio" ? "Disse que tem o vitalício: entrou no plano da formação sem prazo (regra de 08/10). Confira se não for aluna." : `Estava esperando a equipe. Ação: ${action.acao}.`,
          payload: { conversation_id: conv.id, canal: conv.canal, email, acao: action.acao, mensagem: text.replace(/token=[a-f0-9]+/g, "token=…") },
          projeto_id: PROJECT, source: "jp-support-resolve",
        });
        out.push({ id: conv.id, canal: conv.canal, email, acao: action.acao, enviado: true });
        falhas = 0;
      } catch (e) {
        falhas++;
        out.push({ id: item.id, erro: e instanceof Error ? e.message : String(e) });
      }
    }
    return json({ ok: true, modo, resultados: out });
  } catch (e) {
    console.error("[jp-support-resolve]", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

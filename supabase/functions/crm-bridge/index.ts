// CRM Bridge — endpoint único para o sistema externo (CRM/WhatsApp bot)
// consultar e agir sobre alunos da Área de Membros.
//
// Auth: header `x-crm-secret` (segredo salvo em areamembrojp_settings.key='crm_bridge_secret')
// Body: { action: string, ...params }
//
// Ações: lookup_lead | check_purchases | create_account | issue_magic_link
//        | send_email | add_tags | grant_access | revoke_access | log_event
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.25.76";
import { record } from "../_shared/value.ts";

const paramsSchema = z.object({ action: z.string().optional(), email: z.string().nullish(), phone: z.string().nullish(), name: z.string().nullish(), source: z.string().nullish(), tenant_origin: z.string().nullish(), redirect_path: z.string().nullish(), create_if_missing: z.boolean().nullish(), html: z.string().nullish(), template: z.string().nullish(), subject: z.string().nullish(), tags: z.array(z.string()).nullish(), program_ids: z.array(z.string()).nullish(), plan_id: z.string().nullish(), expires_at: z.string().nullish(), source_ref: z.string().nullish(), event_type: z.string().nullish(), metadata: z.record(z.unknown()).nullish() }).passthrough();
type BridgeParams = z.infer<typeof paramsSchema>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-crm-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function isInternalService(req: Request): Promise<boolean> {
  const authorization = req.headers.get("authorization") || "";
  if (!SERVICE_ROLE || !authorization.startsWith("Bearer ")) return false;
  if (authorization === `Bearer ${SERVICE_ROLE}`) return true;
  // Legacy administrator JWTs can have different issuance timestamps. The role
  // claim is only a prefilter; PostgREST must validate the signature and expiry.
  try {
    const token = authorization.slice(7);
    const payload = token.split(".")[1] || "";
    const claims = record(JSON.parse(atob(payload.replace(/-/g,"+").replace(/_/g,"/"))));
    if (claims.role !== "service_role") return false;
    const response = await fetch(`${SUPABASE_URL}/rest/v1/areamembrojp_profiles?select=id&limit=0`, {
      headers: { apikey: SERVICE_ROLE, Authorization: authorization }, signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch { return false; }
}

// ---------- helpers ----------
async function getStoredSecret(): Promise<string | null> {
  const configured = Deno.env.get("JPFREITAS_CRM_BRIDGE_SECRET");
  if (configured) return configured;
  const { data } = await admin
    .from("areamembrojp_settings")
    .select("value")
    .eq("key", "crm_bridge_secret")
    .maybeSingle();
  const v: unknown = data?.value;
  if (typeof v === "string") return v;
  if (typeof record(v).secret === "string") return String(record(v).secret);
  return null;
}

async function findUserByEmail(email: string) {
  const e = email.toLowerCase().trim();
  // tenta via profiles (tem coluna email)
  const { data: prof } = await admin
    .from("areamembrojp_profiles")
    .select("id, name, email, last_seen_at, lifecycle_stage")
    .ilike("email", e)
    .maybeSingle();
  if (prof?.id) return { id: prof.id, name: prof.name, email: prof.email, last_seen_at: prof.last_seen_at, lifecycle_stage: prof.lifecycle_stage };

  // Supported Admin API; handles accounts whose profile email was not populated.
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const u = data.users.find(u => u.email?.toLowerCase() === e);
    if (u) return { id: u.id, name: record(u.user_metadata).name ?? null, email: u.email, last_seen_at: null, lifecycle_stage: null };
    if (data.users.length < 1000) break;
  }
  return null;
}

async function logCall(action: string, email: string | null, status: number, payload: Record<string, unknown>, response: unknown) {
  try {
    await admin.from("areamembrojp_webhook_logs").insert({
      provider: "crm-bridge",
      event_type: action,
      raw_payload: { email, ...payload },
      processed: status < 400,
      error: status >= 400 ? JSON.stringify(response).slice(0, 500) : null,
      user_email: email,
    });
  } catch (_) { /* swallow */ }
}

async function findUserByPhone(phone: string) {
  const normalizedPhone = (value: unknown): string => {
    const digits = typeof value === "string" ? value.replace(/\D/g, "") : "";
    return digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;
  };
  const target = normalizedPhone(phone);
  if (!/^\d{10,11}$/.test(target)) return null;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find(u => {
      const metadata = record(u.user_metadata);
      return [u.phone, metadata.phone, metadata.telefone, metadata.whatsapp].some(value => normalizedPhone(value) === target);
    });
    if (user) return { id: user.id, name: record(user.user_metadata).name ?? null, email: user.email, last_seen_at: null, lifecycle_stage: null };
    if (data.users.length < 1000) break;
  }
  return null;
}

// ---------- actions ----------
async function actLookupLead(p: BridgeParams) {
  const email = p.email?.toLowerCase?.().trim();
  if (!email && !p.phone) return { status: 400, body: { error: "email ou telefone obrigatório" } };

  const user = email ? await findUserByEmail(email) : await findUserByPhone(p.phone || "");
  if (!user) return { status: 200, body: { exists: false } };

  const { data: ents } = await admin
    .from("areamembrojp_user_entitlements")
    .select("scope, program_id, plan_id, source, is_active, expires_at")
    .eq("user_id", user.id)
    .eq("is_active", true);

  const active = (ents ?? []).filter((e: { scope?: string; plan_id?: string | null; expires_at?: string | null }) => !e.expires_at || new Date(e.expires_at) > new Date());
  const hasPremium = active.some((e: { scope?: string; plan_id?: string | null; expires_at?: string | null }) => e.scope === "all" || e.plan_id);

  return {
    status: 200,
    body: {
      exists: true,
      user_id: user.id,
      name: user.name,
      email: user.email,
      last_seen_at: user.last_seen_at,
      lifecycle_stage: user.lifecycle_stage,
      has_premium: hasPremium,
      entitlements: active,
    },
  };
}

async function actCheckPurchases(p: BridgeParams) {
  const email = p.email?.toLowerCase?.().trim();
  if (!email) return { status: 400, body: { error: "email obrigatório" } };

  const { data: webhooks } = await admin
    .from("areamembrojp_payment_webhooks")
    .select("provider, event_type, matched_program_id, processed, created_at")
    .ilike("user_email", email)
    .order("created_at", { ascending: false })
    .limit(50);

  const user = await findUserByEmail(email);
  let active_programs: Record<string, unknown>[] = [];
  if (user) {
    const { data: ents } = await admin
      .from("areamembrojp_user_entitlements")
      .select("program_id, scope, plan_id, expires_at")
      .eq("user_id", user.id)
      .eq("is_active", true);
    active_programs = ents ?? [];
  }

  return { status: 200, body: { purchases: webhooks ?? [], active_programs } };
}

async function actCreateAccount(p: BridgeParams) {
  const email = p.email?.toLowerCase?.().trim();
  if (!email) return { status: 400, body: { error: "email obrigatório" } };

  const existing = await findUserByEmail(email);
  if (existing) return { status: 200, body: { user_id: existing.id, created: false } };

  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { name: p.name, phone: p.phone, source: p.source ?? "crm-bridge" },
  });
  if (error) return { status: 500, body: { error: error.message } };

  const uid = data.user?.id;
  if (uid) {
    await admin.from("areamembrojp_profiles").upsert(
      { id: uid, name: p.name ?? null, email, updated_at: new Date().toISOString() },
      { onConflict: "id" },
    );
  }
  return { status: 200, body: { user_id: uid, created: true } };
}

async function actIssueMagicLink(p: BridgeParams, originHeader: string | null) {
  const email = p.email?.toLowerCase?.().trim();
  if (!email) return { status: 400, body: { error: "email obrigatório" } };

  // origem do tenant (frontend) — pega do settings ou do param
  let tenant_origin = p.tenant_origin;
  if (!tenant_origin) {
    const { data } = await admin
      .from("areamembrojp_tenant_settings")
      .select("site_url")
      .maybeSingle();
    tenant_origin = data?.site_url;
  }
  if (!tenant_origin) return { status: 400, body: { error: "tenant_origin não configurado" } };

  let user = await findUserByEmail(email);
  if (!user) {
    if (!p.create_if_missing) return { status: 404, body: { error: "Usuário não encontrado" } };
    const created = await actCreateAccount({ email, name: p.name, phone: p.phone });
    if (created.status >= 400) return created;
    user = await findUserByEmail(email);
    if (!user) return { status: 500, body: { error: "falha ao criar usuário" } };
  }

  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
  const cleanOrigin = String(tenant_origin).replace(/\/$/, "");

  const { error } = await admin.from("areamembrojp_tenant_magic_tokens").insert({
    user_id: user.id,
    token_hash: token,
    tenant_origin: cleanOrigin,
    redirect_path: p.redirect_path ?? "/home",
    expires_at: expiresAt.toISOString(),
  });
  if (error) return { status: 500, body: { error: error.message } };

  return {
    status: 200,
    body: {
      magic_link: `${cleanOrigin}/auth/verify?token=${token}`,
      expires_at: expiresAt.toISOString(),
      user_id: user.id,
    },
  };
}

async function actSendEmail(p: BridgeParams) {
  const email = p.email?.toLowerCase?.().trim();
  if (!email || (!p.html && !p.template)) {
    return { status: 400, body: { error: "email e (html|template) obrigatórios" } };
  }

  const subject = p.subject ?? "Mensagem da equipe";
  const html = p.html ?? `<p>Olá! ${p.template ?? ""}</p>`;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/areamembrojp-send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}` },
    body: JSON.stringify({ to: email, subject, html, source: "crm-bridge" }),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.ok ? 200 : 500, body: data };
}

async function actAddTags(p: BridgeParams) {
  const email = p.email?.toLowerCase?.().trim();
  const tags: string[] = Array.isArray(p.tags) ? p.tags : [];
  if (!email || tags.length === 0) return { status: 400, body: { error: "email e tags obrigatórios" } };

  const user = await findUserByEmail(email);
  if (!user) return { status: 404, body: { error: "Usuário não encontrado" } };

  // upsert tags + relações
  const applied: string[] = [];
  for (const name of tags) {
    const cleanName = String(name).trim();
    if (!cleanName) continue;
    let { data: tag } = await admin
      .from("areamembrojp_crm_tags")
      .select("id")
      .eq("name", cleanName)
      .maybeSingle();
    if (!tag) {
      const { data: inserted } = await admin
        .from("areamembrojp_crm_tags")
        .insert({ name: cleanName })
        .select("id")
        .single();
      tag = inserted;
    }
    if (tag?.id) {
      await admin
        .from("areamembrojp_crm_member_tags")
        .upsert({ user_id: user.id, tag_id: tag.id }, { onConflict: "user_id,tag_id" });
      applied.push(cleanName);
    }
  }
  return { status: 200, body: { ok: true, applied } };
}

async function actGrantAccess(p: BridgeParams) {
  const email = p.email?.toLowerCase?.().trim();
  if (!email) return { status: 400, body: { error: "email obrigatório" } };
  const user = await findUserByEmail(email);
  if (!user) return { status: 404, body: { error: "Usuário não encontrado" } };

  const rows: Record<string, unknown>[] = [];
  const programs: string[] = Array.isArray(p.program_ids) ? p.program_ids : [];
  const plan_id = p.plan_id ?? undefined;
  const expires_at = p.expires_at ?? undefined;

  if (plan_id) {
    rows.push({ user_id: user.id, scope: "plan", plan_id, source: "crm-bridge", source_ref: p.source_ref ?? null, is_active: true, expires_at: expires_at ?? null });
  }
  for (const pid of programs) {
    rows.push({ user_id: user.id, scope: "program", program_id: pid, source: "crm-bridge", source_ref: p.source_ref ?? null, is_active: true, expires_at: expires_at ?? null });
  }
  if (!plan_id && programs.length === 0) {
    rows.push({ user_id: user.id, scope: "all", source: "crm-bridge", source_ref: p.source_ref ?? null, is_active: true, expires_at: expires_at ?? null });
  }

  const { data, error } = await admin
    .from("areamembrojp_user_entitlements")
    .insert(rows)
    .select();
  if (error) return { status: 500, body: { error: error.message } };
  return { status: 200, body: { ok: true, entitlements: data } };
}

async function actRevokeAccess(p: BridgeParams) {
  const email = p.email?.toLowerCase?.().trim();
  if (!email) return { status: 400, body: { error: "email obrigatório" } };
  const user = await findUserByEmail(email);
  if (!user) return { status: 404, body: { error: "Usuário não encontrado" } };

  let q = admin
    .from("areamembrojp_user_entitlements")
    .update({ is_active: false })
    .eq("user_id", user.id);
  if (Array.isArray(p.program_ids) && p.program_ids.length) {
    q = q.in("program_id", p.program_ids);
  }
  const { error } = await q;
  if (error) return { status: 500, body: { error: error.message } };
  return { status: 200, body: { ok: true } };
}

async function actLogEvent(p: BridgeParams) {
  const email = p.email?.toLowerCase?.().trim();
  if (!email || !p.event_type) return { status: 400, body: { error: "email e event_type obrigatórios" } };
  const user = await findUserByEmail(email);
  await admin.from("areamembrojp_events").insert({
    user_id: user?.id ?? null,
    type: `crm:${p.event_type}`,
    payload: { email, ...(p.metadata ?? {}) },
  });
  return { status: 200, body: { ok: true } };
}

// ---------- router ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // auth
  const provided = req.headers.get("x-crm-secret") ?? "";
  // Same-project service role already has administrator access to these records.
  // External CRM clients continue to require the dedicated CRM secret.
  const internalService = await isInternalService(req);
  if (!internalService) {
    const expected = await getStoredSecret();
    if (!expected) return json({ error: "CRM bridge não configurado (segredo ausente)" }, 503);
    if (provided !== expected) return json({ error: "Unauthorized" }, 401);
  }

  let body: BridgeParams;
  try { body = paramsSchema.parse(await req.json()); } catch { return json({ error: "JSON inválido" }, 400); }

  const action = body?.action as string;
  if (!action) return json({ error: "action obrigatório" }, 400);

  const handlers: Record<string, (p: BridgeParams) => Promise<{ status: number; body: unknown }>> = {
    lookup_lead: actLookupLead,
    check_purchases: actCheckPurchases,
    create_account: actCreateAccount,
    issue_magic_link: (p) => actIssueMagicLink(p, req.headers.get("origin")),
    send_email: actSendEmail,
    add_tags: actAddTags,
    grant_access: actGrantAccess,
    revoke_access: actRevokeAccess,
    log_event: actLogEvent,
  };

  const fn = handlers[action];
  if (!fn) return json({ error: `action desconhecida: ${action}` }, 400);

  try {
    const result = await fn(body);
    await logCall(action, body?.email ?? null, result.status, body, result.body);
    return json(result.body, result.status);
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    await logCall(action, body?.email ?? null, 500, body, { error: msg });
    return json({ error: msg }, 500);
  }
});

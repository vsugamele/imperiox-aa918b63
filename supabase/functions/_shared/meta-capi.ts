// Meta Conversions API (CAPI): envio server-side com deduplicação por event_id.
// TS puro (sem imports de Deno): testável fora do runtime e usado por funnel-track e meta-offline-upload.
export const GRAPH_VERSION = "v21.0";

export type MetaEventName = "PageView" | "ViewContent" | "AddToCart" | "InitiateCheckout" | "Purchase" | "Lead" | "PitchReached" | "VideoComplete";

/** Etapa interna do tracker → evento Meta. Etapas fora daqui ficam só no nosso banco. */
export const STEP_TO_META: Record<string, MetaEventName> = {
  vsl_view: "PageView",
  advertorial_view: "PageView",
  pdp_view: "ViewContent",
  vsl_play: "ViewContent",
  vsl_pitch: "PitchReached",
  vsl_cta_visible: "PitchReached",
  vsl_complete: "VideoComplete",
  vsl_cta_click: "AddToCart",
  pdp_cta_click: "AddToCart",
  advertorial_cta_click: "AddToCart",
  add_to_cart: "AddToCart",
  checkout: "InitiateCheckout",
  quiz: "Lead",
};

export interface RawUser {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  externalId?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  fbclid?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface CapiEvent {
  event_name: string;
  event_time: number;
  event_id: string;
  action_source: "website" | "system_generated";
  event_source_url?: string;
  user_data: Record<string, unknown>;
  custom_data?: Record<string, unknown>;
}

const clean = (v: string | null | undefined) => (typeof v === "string" ? v.trim() : "");
const strip = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Telefone em E.164 sem "+": se vier só DDD+número brasileiro (10–11 dígitos), prefixa 55. */
export function normalizePhone(raw: string | null | undefined, country?: string | null): string {
  const d = clean(raw).replace(/\D+/g, "");
  if (!d) return "";
  const c = clean(country).toUpperCase();
  if ((c === "" || c === "BR") && (d.length === 10 || d.length === 11)) return "55" + d;
  if (c === "US" && d.length === 10) return "1" + d;
  return d;
}

/** fbc a partir do fbclid quando o cookie _fbc não existe (formato oficial fb.1.<ms>.<fbclid>). */
export function fbcFromClickId(fbclid: string | null | undefined, atMs = Date.now()): string | null {
  const id = clean(fbclid);
  return id ? `fb.1.${atMs}.${id}` : null;
}

const valid = (v: string | null | undefined, re: RegExp) => { const s = clean(v); return s && re.test(s) ? s : null; };

export async function buildUserData(u: RawUser, atMs?: number): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  const email = strip(clean(u.email));
  if (email.includes("@")) out.em = [await sha256(email)];
  const phone = normalizePhone(u.phone, u.country);
  if (phone.length >= 8) out.ph = [await sha256(phone)];
  const parts = strip(clean(u.name)).replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean);
  if (parts[0]) out.fn = [await sha256(parts[0])];
  if (parts.length > 1) out.ln = [await sha256(parts[parts.length - 1])];
  const city = strip(clean(u.city)).replace(/[^a-z]/g, "");
  if (city) out.ct = [await sha256(city)];
  const st = strip(clean(u.state)).replace(/[^a-z]/g, "");
  if (st) out.st = [await sha256(st)];
  const zip = strip(clean(u.zip)).replace(/[^a-z0-9]/g, "");
  if (zip) out.zp = [await sha256(zip)];
  const country = strip(clean(u.country)).replace(/[^a-z]/g, "");
  if (country.length === 2) out.country = [await sha256(country)];
  if (clean(u.externalId)) out.external_id = [await sha256(clean(u.externalId))];
  const fbp = valid(u.fbp, /^fb\.\d\.\d+\.\d+$/);
  if (fbp) out.fbp = fbp;
  const fbc = valid(u.fbc, /^fb\.\d\.\d+\..+$/) ?? fbcFromClickId(u.fbclid, atMs);
  if (fbc) out.fbc = fbc;
  if (clean(u.ip)) out.client_ip_address = clean(u.ip);
  if (clean(u.userAgent)) out.client_user_agent = clean(u.userAgent).slice(0, 500);
  return out;
}

/** Quais chaves de match saíram (sem os valores), para medir cobertura/EMQ. */
export function matchKeys(userData: Record<string, unknown>): string[] {
  return Object.keys(userData).filter((k) => userData[k] !== undefined && userData[k] !== null);
}

export interface SendResult { ok: boolean; status: number; received?: number; error?: string; fbtrace_id?: string }

export async function sendCapi(
  pixelId: string,
  accessToken: string,
  events: CapiEvent[],
  opts: { testEventCode?: string | null; fetchImpl?: typeof fetch } = {},
): Promise<SendResult> {
  if (!events.length) return { ok: true, status: 200, received: 0 };
  const body: Record<string, unknown> = { data: events };
  if (opts.testEventCode) body.test_event_code = opts.testEventCode;
  const f = opts.fetchImpl ?? fetch;
  try {
    const resp = await f(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(accessToken)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await resp.json().catch(() => ({})) as { events_received?: number; fbtrace_id?: string; error?: { message?: string } };
    if (!resp.ok || json.error) return { ok: false, status: resp.status, error: json.error?.message ?? `HTTP ${resp.status}`, fbtrace_id: json.fbtrace_id };
    return { ok: true, status: resp.status, received: json.events_received, fbtrace_id: json.fbtrace_id };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : "network_error" };
  }
}

/** Status de venda que contam como compra (inclui o "aprovado" que o webhook grava). */
export const PAID_STATUSES = ["aprovado", "aprovada", "approved", "paid", "completed", "finalizada", "complete"];

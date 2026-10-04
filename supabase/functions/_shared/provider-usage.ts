// Custo por automação (Story OP1.4): leitura do consumo na conta de cada provedor. TS puro (fetch injetável).
// Endpoints conferidos na doc oficial em 04/10/2026:
//   OpenRouter GET /api/v1/key        → usage_daily/weekly/monthly em créditos (1 crédito = US$ 1)
//   ElevenLabs GET /v1/user/subscription → character_count / character_limit do ciclo
//   Kie        GET /api/v1/chat/credit → saldo de créditos
// Sem API de consumo com a chave comum: gateway do Lovable e OpenAI (exige chave de admin).

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ProviderUsage {
  provider: "openrouter" | "elevenlabs" | "kie";
  spent_usd: number | null;
  units_used: number | null;
  unit: string | null;
  balance: number | null;
  details: Record<string, unknown>;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);

export function parseOpenRouterKey(body: unknown): ProviderUsage {
  const d = (body && typeof body === "object" ? (body as { data?: Record<string, unknown> }).data : null) ?? {};
  return {
    provider: "openrouter",
    spent_usd: num(d.usage_daily),
    units_used: null,
    unit: "usd",
    balance: num(d.limit_remaining),
    details: { usage_weekly: num(d.usage_weekly), usage_monthly: num(d.usage_monthly), usage_total: num(d.usage), limit_reset: d.limit_reset ?? null, is_free_tier: d.is_free_tier ?? null },
  };
}

export function parseElevenLabsSubscription(body: unknown): ProviderUsage {
  const d = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const reset = num(d.next_character_count_reset_unix);
  return {
    provider: "elevenlabs",
    spent_usd: null,
    units_used: num(d.character_count),
    unit: "caracteres_no_ciclo",
    balance: num(d.character_limit) !== null && num(d.character_count) !== null ? num(d.character_limit)! - num(d.character_count)! : null,
    details: { character_limit: num(d.character_limit), tier: d.tier ?? null, status: d.status ?? null, reset_em: reset ? new Date(reset * 1000).toISOString() : null },
  };
}

export function parseKieCredit(body: unknown): ProviderUsage {
  const d = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  return { provider: "kie", spent_usd: null, units_used: null, unit: "creditos", balance: num(d.data), details: { code: d.code ?? null } };
}

const PROVIDERS = [
  { env: "OPENROUTER_API_KEY", url: "https://openrouter.ai/api/v1/key", headers: (k: string) => ({ Authorization: `Bearer ${k}` }), parse: parseOpenRouterKey },
  { env: "ELEVENLABS_API_KEY", url: "https://api.elevenlabs.io/v1/user/subscription", headers: (k: string) => ({ "xi-api-key": k }), parse: parseElevenLabsSubscription },
  { env: "KIE_API_KEY", url: "https://api.kie.ai/api/v1/chat/credit", headers: (k: string) => ({ Authorization: `Bearer ${k}` }), parse: parseKieCredit },
] as const;

/** Lê todos os provedores com chave configurada. Falha de um não derruba os outros. */
export async function readProviderUsage(env: (name: string) => string | undefined, fetchImpl: FetchLike = fetch) {
  const results: ProviderUsage[] = [];
  const errors: Array<{ provider: string; error: string }> = [];
  for (const p of PROVIDERS) {
    const key = env(p.env);
    const provider = p.parse({}).provider;
    if (!key) { errors.push({ provider, error: `${p.env} não configurada` }); continue; }
    try {
      const res = await fetchImpl(p.url, { headers: p.headers(key) });
      if (!res.ok) { errors.push({ provider, error: `HTTP ${res.status}` }); continue; }
      results.push(p.parse(await res.json()));
    } catch (e) {
      errors.push({ provider, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { results, errors };
}

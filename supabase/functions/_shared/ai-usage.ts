// Custo por automação (Story OP1.4), parte 2: registro por chamada de IA.
// Uma linha no topo da function liga: `installAiUsageTracking("nome-da-function")`.
// Intercepta só chamadas aos provedores de IA, lê o consumo da resposta e grava em imphq_ai_usage sem atrasar a resposta.
// Nunca grava prompt, resposta nem chave: só provedor, modelo, tokens/caracteres e custo quando o provedor informa.

export interface AiUsageRow {
  function_name: string;
  provider: string;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  cost_usd: number | null;
  tag: string | null;
  project_id: string | null;
}

const HOSTS: Array<[RegExp, string]> = [
  [/(^|\.)openrouter\.ai$/, "openrouter"],
  [/^ai\.gateway\.lovable\.dev$/, "lovable"],
  [/^api\.openai\.com$/, "openai"],
  [/^api\.anthropic\.com$/, "anthropic"],
  [/^generativelanguage\.googleapis\.com$/, "google"],
  [/^api\.elevenlabs\.io$/, "elevenlabs"],
  [/^api\.kie\.ai$/, "kie"],
  [/(^|\.)lumalabs\.ai$/, "luma"],
];

export function providerOf(url: string): string | null {
  let host: string;
  try { host = new URL(url).hostname; } catch { return null; }
  return HOSTS.find(([re]) => re.test(host))?.[1] ?? null;
}

const n = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {});

/** Consumo de uma chamada pelo formato de cada provedor. `null` quando não é chamada de consumo (ex.: listar modelos). */
export function extractUsage(url: string, requestBody: unknown, responseBody: unknown, contentType: string | null): Omit<AiUsageRow, "function_name" | "project_id"> | null {
  const provider = providerOf(url);
  if (!provider) return null;
  const req = rec(requestBody);
  const res = rec(responseBody);
  const path = (() => { try { return new URL(url).pathname; } catch { return ""; } })();

  if (provider === "elevenlabs") {
    if (!/text-to-speech|speech-to-text/.test(path)) return null;
    const text = typeof req.text === "string" ? req.text : "";
    return { provider, model: typeof req.model_id === "string" ? req.model_id : null, prompt_tokens: null, completion_tokens: null, total_tokens: text ? text.length : null, cost_usd: null, tag: /speech-to-text/.test(path) ? "stt" : "tts_caracteres" };
  }
  if (provider === "kie" || provider === "luma") {
    if (/credit|record-info|status/i.test(path)) return null;
    return { provider, model: typeof req.model === "string" ? req.model : null, prompt_tokens: null, completion_tokens: null, total_tokens: null, cost_usd: null, tag: "midia" };
  }
  if (/\/models\/?$|\/key$|\/credits$/.test(path)) return null;
  if (contentType?.includes("text/event-stream")) {
    return { provider, model: typeof req.model === "string" ? req.model : null, prompt_tokens: null, completion_tokens: null, total_tokens: null, cost_usd: null, tag: "stream" };
  }
  if (provider === "google") {
    const meta = rec(res.usageMetadata);
    return { provider, model: path.match(/models\/([^:/]+)/)?.[1] ?? null, prompt_tokens: n(meta.promptTokenCount), completion_tokens: n(meta.candidatesTokenCount), total_tokens: n(meta.totalTokenCount), cost_usd: null, tag: null };
  }
  const usage = rec(res.usage);
  if (provider === "anthropic") {
    const pi = n(usage.input_tokens), po = n(usage.output_tokens);
    return { provider, model: typeof res.model === "string" ? res.model : typeof req.model === "string" ? req.model : null, prompt_tokens: pi, completion_tokens: po, total_tokens: pi !== null && po !== null ? pi + po : null, cost_usd: null, tag: null };
  }
  return {
    provider,
    model: typeof res.model === "string" ? res.model : typeof req.model === "string" ? req.model : null,
    prompt_tokens: n(usage.prompt_tokens),
    completion_tokens: n(usage.completion_tokens),
    total_tokens: n(usage.total_tokens),
    cost_usd: n(usage.cost),
    tag: path.includes("embeddings") ? "embedding" : null,
  };
}

let installed = false;
let currentProject: string | null = null;

/** Liga o projeto às próximas chamadas desta execução (opcional). */
export function setAiUsageProject(projectId: string | null) { currentProject = projectId; }

type FetchFn = typeof fetch;
type Waiter = { waitUntil?: (p: Promise<unknown>) => void };

/**
 * Envolve o fetch global uma vez por function. O registro vai pelo fetch original direto ao PostgREST
 * (service role), em segundo plano; falha ao registrar nunca afeta a chamada de IA.
 */
export function installAiUsageTracking(functionName: string, opts: { fetchImpl?: FetchFn; supabaseUrl?: string; serviceKey?: string; waitUntil?: (p: Promise<unknown>) => void } = {}) {
  if (installed && !opts.fetchImpl) return;
  installed = true;
  const original: FetchFn = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const env = (k: string) => (typeof Deno !== "undefined" ? Deno.env.get(k) : undefined);
  const supabaseUrl = opts.supabaseUrl ?? env("SUPABASE_URL");
  const serviceKey = opts.serviceKey ?? env("SUPABASE_SERVICE_ROLE_KEY");
  const runtime = (globalThis as unknown as { EdgeRuntime?: Waiter }).EdgeRuntime;
  const background = opts.waitUntil ?? ((p: Promise<unknown>) => (runtime?.waitUntil ? runtime.waitUntil(p) : void p));

  const tracked: FetchFn = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const response = await original(input as RequestInfo, init);
    if (!providerOf(url) || !supabaseUrl || !serviceKey) return response;
    background((async () => {
      try {
        let reqBody: unknown = null;
        if (typeof init?.body === "string") { try { reqBody = JSON.parse(init.body); } catch { reqBody = null; } }
        const contentType = response.headers.get("content-type");
        let resBody: unknown = null;
        if (contentType?.includes("application/json")) { try { resBody = await response.clone().json(); } catch { resBody = null; } }
        const usage = extractUsage(url, reqBody, resBody, contentType);
        if (!usage) return;
        const row: AiUsageRow = { ...usage, function_name: functionName, project_id: currentProject, tag: response.ok ? usage.tag : [usage.tag, `http_${response.status}`].filter(Boolean).join(",") };
        await original(`${supabaseUrl}/rest/v1/imphq_ai_usage`, {
          method: "POST",
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify(row),
        });
      } catch {
        // Registro de custo nunca derruba a function.
      }
    })());
    return response;
  };
  globalThis.fetch = tracked;
}

/** Só para testes: permite reinstalar. */
export function resetAiUsageTrackingForTests() { installed = false; currentProject = null; }

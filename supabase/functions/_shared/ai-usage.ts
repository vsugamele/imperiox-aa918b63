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
let projectFetch: ((projectId: string | null, input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) | null = null;

/** Contexto imutável por chamada, inclusive dentro de lotes de vários projetos. */
export function fetchWithAiUsage(projectId: string | null | undefined, input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return projectFetch ? projectFetch(projectId?.trim() || null, input, init) : globalThis.fetch(input, init);
}

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
  const deno = (globalThis as unknown as { Deno?: { env: { get: (key: string) => string | undefined } } }).Deno;
  const env = (k: string) => deno?.env.get(k);
  const supabaseUrl = opts.supabaseUrl ?? env("SUPABASE_URL");
  const serviceKey = opts.serviceKey ?? env("SUPABASE_SERVICE_ROLE_KEY");
  const runtime = (globalThis as unknown as { EdgeRuntime?: Waiter }).EdgeRuntime;
  const background = opts.waitUntil ?? ((p: Promise<unknown>) => (runtime?.waitUntil ? runtime.waitUntil(p) : void p));

  projectFetch = async (projectId, input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    let reqBody: unknown = null;
    if (typeof init?.body === "string") { try { reqBody = JSON.parse(init.body); } catch { /* corpo não JSON */ } }
    const response = await original(input as RequestInfo, init);
    if (!providerOf(url) || !supabaseUrl || !serviceKey) return response;
    const contentType = response.headers.get("content-type");
    // Clona antes de entregar a resposta ao consumidor, que pode ler o corpo imediatamente.
    let copy: Response | null = null;
    try { if (contentType?.includes("application/json")) copy = response.clone(); } catch { /* consumo desconhecido */ }
    const logging = (async () => {
      try {
        let resBody: unknown = null;
        if (copy) { try { resBody = await copy.json(); } catch { /* consumo desconhecido */ } }
        const usage = extractUsage(url, reqBody, resBody, contentType);
        if (!usage) return;
        const row: AiUsageRow = { ...usage, function_name: functionName, project_id: projectId, tag: response.ok ? usage.tag : [usage.tag, `http_${response.status}`].filter(Boolean).join(",") };
        const saved = await original(`${supabaseUrl}/rest/v1/imphq_ai_usage`, {
          method: "POST",
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify(row),
        });
        if (!saved.ok) console.warn("[ai-usage] registro rejeitado", functionName, saved.status);
      } catch {
        console.warn("[ai-usage] falha ao registrar consumo", functionName);
      }
    })();
    try { background(logging); } catch { console.warn("[ai-usage] tarefa de registro não vinculada", functionName); }
    return response;
  };
  const tracked = projectFetch;
  globalThis.fetch = (input, init) => tracked(null, input, init);
}

/** Só para testes: permite reinstalar. */
export function resetAiUsageTrackingForTests() { installed = false; projectFetch = null; }

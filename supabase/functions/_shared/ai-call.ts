import { record, text, errorText } from "./value.ts";
// Wrapper único para chamadas ao Lovable AI Gateway com retry exponencial,
// timeout e log estruturado. Trata só 429/5xx como retryable (regra do gateway).
//
// Uso:
//   import { callAiChat } from "../_shared/ai-call.ts";
//   const { content, model, raw } = await callAiChat({
//     model: "google/gemini-3-flash-preview",
//     messages: [{ role: "system", content: sys }, { role: "user", content: user }],
//     json: true, // opcional (response_format json_object)
//     timeoutMs: 60_000,
//     maxAttempts: 3,
//   });

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

export interface AiCallOptions {
  model: string;
  messages: Array<{ role: string; content: string }>;
  json?: boolean;
  jsonSchema?: Record<string, unknown>;
  temperature?: number;
  stream?: boolean;
  timeoutMs?: number;
  maxAttempts?: number;
  tag?: string;
  /** Projeto ao qual o gasto pertence (imphq_projects.id). */
  projectId?: string | null;
  /** Nome da edge function que originou a chamada. */
  functionName?: string;
}

export interface AiCallResult {
  content: string;
  model: string;
  raw: unknown;
  attempts: number;
}

function resolveProvider(model: string): { url: string; key: string } {
  const isLovable = /^(google|openai)\//.test(model);
  if (isLovable) {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
    return { url: "https://ai.gateway.lovable.dev/v1/chat/completions", key: LOVABLE_API_KEY };
  }
  if (!OPENROUTER_API_KEY) throw new Error(`OPENROUTER_API_KEY não configurada (modelo ${model})`);
  return { url: "https://openrouter.ai/api/v1/chat/completions", key: OPENROUTER_API_KEY };
}

export class AiCallError extends Error {
  status: number;
  body: string;
  retryable: boolean;
  constructor(status: number, body: string, retryable: boolean) {
    super(`AI ${status}: ${body.slice(0, 300)}`);
    this.status = status;
    this.body = body;
    this.retryable = retryable;
  }
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

/** Registra consumo de IA em imphq_ai_usage. Nunca lança. */
async function logUsage(
  opts: AiCallOptions,
  provider: string,
  raw: unknown,
): Promise<void> {
  try {
    if (!SUPABASE_URL || !SERVICE_KEY) return;
    const usage = record(record(raw).usage);
    const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : 0);
    const prompt = num(usage.prompt_tokens);
    const completion = num(usage.completion_tokens);
    const total = num(usage.total_tokens) || prompt + completion;
    const cost = num(usage.cost) || num(record(usage.cost_details).upstream_inference_cost);
    await fetch(`${SUPABASE_URL}/rest/v1/imphq_ai_usage`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        project_id: opts.projectId || null,
        function_name: opts.functionName || opts.tag || "desconhecida",
        provider,
        model: text(record(raw).model) || opts.model,
        prompt_tokens: prompt,
        completion_tokens: completion,
        total_tokens: total,
        cost_usd: cost,
        tag: opts.tag || null,
      }),
    });
  } catch {
    // custo é observabilidade — nunca quebra o fluxo
  }
}

export async function callAiChat(opts: AiCallOptions): Promise<AiCallResult> {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const maxAttempts = Math.max(1, opts.maxAttempts ?? 3);
  const tag = opts.tag || "ai-call";
  const { url, key } = resolveProvider(opts.model);
  const provider = url.includes("openrouter") ? "openrouter" : "lovable";
  const attribution: Record<string, string> = provider === "openrouter"
    ? {
        "HTTP-Referer": "https://imperiox.lovable.app",
        "X-Title": `imperiohq/${opts.projectId || "geral"}/${opts.functionName || tag}`,
      }
    : {};

  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    stream: opts.stream === true,
  };
  if (opts.temperature != null) body.temperature = opts.temperature;
  if (provider === "openrouter") body.usage = { include: true };
  if (opts.jsonSchema) {
    body.response_format = { type: "json_schema", json_schema: { name: "out", strict: true, schema: opts.jsonSchema } };
  } else if (opts.json) {
    body.response_format = { type: "json_object" };
  }

  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...attribution },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      const txt = await res.text();
      if (!res.ok) {
        const retryable = res.status === 429 || res.status >= 500;
        const err = new AiCallError(res.status, txt, retryable);
        if (!retryable || attempt === maxAttempts) throw err;
        console.warn(`[${tag}] ${res.status} tentativa ${attempt}/${maxAttempts} — aguardando...`);
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt - 1) + Math.random() * 250));
        lastErr = err;
        continue;
      }
      const data: unknown = JSON.parse(txt);
      const choices = record(data).choices;
      const content = text(record(record(Array.isArray(choices) ? choices[0] : null).message).content);
      if (opts.stream !== true) await logUsage(opts, provider, data);
      return { content, model: opts.model, raw: data, attempts: attempt };
    } catch (e: unknown) {
      clearTimeout(t);
      lastErr = e;
      const isAbort = record(e).name === "AbortError";
      const retryable = isAbort || (e instanceof AiCallError && e.retryable);
      if (!retryable || attempt === maxAttempts) throw e;
      console.warn(`[${tag}] erro tentativa ${attempt}/${maxAttempts}: ${errorText(e)}`);
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt - 1) + Math.random() * 250));
    }
  }
  throw lastErr || new Error("callAiChat: falha desconhecida");
}

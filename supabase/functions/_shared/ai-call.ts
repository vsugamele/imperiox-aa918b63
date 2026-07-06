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
  jsonSchema?: any;
  temperature?: number;
  stream?: boolean;
  timeoutMs?: number;
  maxAttempts?: number;
  tag?: string;
}

export interface AiCallResult {
  content: string;
  model: string;
  raw: any;
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

export async function callAiChat(opts: AiCallOptions): Promise<AiCallResult> {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const maxAttempts = Math.max(1, opts.maxAttempts ?? 3);
  const tag = opts.tag || "ai-call";
  const { url, key } = resolveProvider(opts.model);

  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    stream: opts.stream === true,
  };
  if (opts.temperature != null) body.temperature = opts.temperature;
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
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
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
      const data = JSON.parse(txt);
      const content = data.choices?.[0]?.message?.content ?? "";
      return { content, model: opts.model, raw: data, attempts: attempt };
    } catch (e: any) {
      clearTimeout(t);
      lastErr = e;
      const isAbort = e?.name === "AbortError";
      const retryable = isAbort || (e instanceof AiCallError && e.retryable);
      if (!retryable || attempt === maxAttempts) throw e;
      console.warn(`[${tag}] erro tentativa ${attempt}/${maxAttempts}: ${e?.message}`);
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt - 1) + Math.random() * 250));
    }
  }
  throw lastErr || new Error("callAiChat: falha desconhecida");
}

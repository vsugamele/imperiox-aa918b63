// Logger estruturado para edge functions. Silencia debug em produção,
// sanitiza payloads com chaves sensíveis antes de logar.
//
// Uso: import { createLogger } from "../_shared/logger.ts";
//      const log = createLogger("copy-engine");
//      log.info("ok", { intent, model });

const LEVEL = (Deno.env.get("LOG_LEVEL") || "info").toLowerCase();
const ORDER: Record<string, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const THRESHOLD = ORDER[LEVEL] ?? 20;

const SENSITIVE = [
  "token", "access_token", "refresh_token", "api_key", "apikey",
  "authorization", "password", "secret", "service_role",
];

function mask(v: unknown): unknown {
  if (typeof v !== "string") return "***";
  if (v.length <= 6) return "***";
  return `${v.slice(0, 2)}***${v.slice(-2)}`;
}

function redact(obj: unknown, depth = 0): unknown {
  if (depth > 5 || obj == null) return obj;
  if (Array.isArray(obj)) return obj.map((v) => redact(v, depth + 1));
  if (typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const kl = k.toLowerCase();
      if (SENSITIVE.some((s) => kl.includes(s))) out[k] = mask(v);
      else out[k] = redact(v, depth + 1);
    }
    return out;
  }
  return obj;
}

function emit(level: string, tag: string, msg: string, ctx?: unknown) {
  if ((ORDER[level] ?? 0) < THRESHOLD) return;
  const line = `[${tag}] ${msg}`;
  if (ctx !== undefined) {
    const safe = redact(ctx);
    if (level === "error") console.error(line, safe);
    else if (level === "warn") console.warn(line, safe);
    else console.log(line, safe);
  } else {
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  }
}

export function createLogger(tag: string) {
  return {
    debug: (msg: string, ctx?: unknown) => emit("debug", tag, msg, ctx),
    info:  (msg: string, ctx?: unknown) => emit("info",  tag, msg, ctx),
    warn:  (msg: string, ctx?: unknown) => emit("warn",  tag, msg, ctx),
    error: (msg: string, ctx?: unknown) => emit("error", tag, msg, ctx),
  };
}

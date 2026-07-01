// Mascara campos sensíveis antes de logar.
const SENSITIVE_KEYS = [
  "token",
  "access_token",
  "refresh_token",
  "api_key",
  "apikey",
  "authorization",
  "password",
  "secret",
  "service_role",
  "credit_card",
  "cvv",
  "cpf",
  "rg",
];

function mask(v: unknown): unknown {
  if (typeof v !== "string") return "***";
  if (v.length <= 4) return "***";
  return `${v.slice(0, 2)}***${v.slice(-2)}`;
}

export function redact(obj: unknown, depth = 0): unknown {
  if (depth > 4) return "[depth]";
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map((v) => redact(v, depth + 1));
  if (typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const key = k.toLowerCase();
      if (SENSITIVE_KEYS.some((s) => key.includes(s))) {
        out[k] = mask(v);
      } else if (key === "email" && typeof v === "string") {
        const [u, d] = v.split("@");
        out[k] = u && d ? `${u.slice(0, 2)}***@${d}` : "***";
      } else if (key === "phone" || key === "telefone" || key === "whatsapp") {
        out[k] = mask(v);
      } else {
        out[k] = redact(v, depth + 1);
      }
    }
    return out;
  }
  return obj;
}

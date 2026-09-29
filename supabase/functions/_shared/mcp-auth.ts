// Chave de acesso do MCP do Império. TS puro: testável fora do Deno.
// O segredo MCP_API_KEYS aceita várias chaves separadas por vírgula (uma por cliente), para revogar uma sem trocar as outras.
// Sem segredo configurado, nada passa (falha fechada).

export type McpAuthResult =
  | { ok: true; keyIndex: number }
  | { ok: false; status: 401 | 503; error: string };

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Lê a chave do cabeçalho `x-mcp-key` ou de `Authorization: Bearer <chave>`. */
export function presentedMcpKey(headers: Headers): string {
  const direct = headers.get("x-mcp-key")?.trim();
  if (direct) return direct;
  const auth = headers.get("authorization")?.trim() ?? "";
  return /^bearer\s+/i.test(auth) ? auth.replace(/^bearer\s+/i, "").trim() : "";
}

export function checkMcpKey(headers: Headers, configuredKeys: string | undefined | null): McpAuthResult {
  const keys = (configuredKeys ?? "").split(",").map((k) => k.trim()).filter((k) => k.length >= 24);
  if (keys.length === 0) return { ok: false, status: 503, error: "MCP sem chave configurada (segredo MCP_API_KEYS)." };
  const presented = presentedMcpKey(headers);
  if (!presented) return { ok: false, status: 401, error: "Chave do MCP ausente. Envie o cabeçalho x-mcp-key." };
  const keyIndex = keys.findIndex((k) => timingSafeEqual(k, presented));
  return keyIndex >= 0 ? { ok: true, keyIndex } : { ok: false, status: 401, error: "Chave do MCP inválida." };
}

// Helper compartilhado para mapear erros internos em respostas genéricas.
// Loga o detalhe completo no console do servidor, retorna mensagem segura ao cliente.

export type ErrorCode =
  | "validation_error"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "upstream_error"
  | "internal_error";

const CODE_TO_MESSAGE: Record<ErrorCode, string> = {
  validation_error: "Dados inválidos.",
  unauthorized: "Não autorizado.",
  forbidden: "Acesso negado.",
  not_found: "Recurso não encontrado.",
  upstream_error: "Falha ao comunicar com serviço externo.",
  internal_error: "Erro interno. Tente novamente.",
};

const CODE_TO_STATUS: Record<ErrorCode, number> = {
  validation_error: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  upstream_error: 502,
  internal_error: 500,
};

export interface SafeErrorOptions {
  code?: ErrorCode;
  context?: string;
  cors?: Record<string, string>;
  expose?: string; // mensagem segura customizada para o cliente
}

/**
 * Retorna uma Response genérica e loga o detalhe interno.
 * NUNCA retorna e.message cru ao cliente.
 */
export function safeError(e: unknown, opts: SafeErrorOptions = {}): Response {
  const code = opts.code || "internal_error";
  const ctx = opts.context || "edge_function";
  const detail =
    e instanceof Error
      ? { name: e.name, message: e.message, stack: e.stack }
      : { value: String(e) };

  // Log completo no servidor (visível em supabase logs)
  console.error(`[${ctx}][${code}]`, detail);

  const body = {
    error: opts.expose || CODE_TO_MESSAGE[code],
    code,
  };

  return new Response(JSON.stringify(body), {
    status: CODE_TO_STATUS[code],
    headers: { ...(opts.cors || {}), "Content-Type": "application/json" },
  });
}

/** Atalho para erros de validação Zod-like. */
export function validationError(fieldErrors: unknown, cors?: Record<string, string>) {
  console.error("[validation_error]", fieldErrors);
  return new Response(
    JSON.stringify({ error: "Dados inválidos.", code: "validation_error", details: fieldErrors }),
    { status: 400, headers: { ...(cors || {}), "Content-Type": "application/json" } },
  );
}

// Idempotência para webhooks: usa a tabela imphq_webhook_dedup com UNIQUE (source, event_id).
// Retorna true se o evento é novo (pode processar), false se já foi processado.
//
// Uso:
//   import { markWebhookProcessed } from "../_shared/webhook-dedup.ts";
//   const isNew = await markWebhookProcessed(sb, "kiwify", eventId);
//   if (!isNew) return json({ status: "duplicate" }, 200);

export async function markWebhookProcessed(
  sb: any,
  source: string,
  eventId: string | null | undefined,
): Promise<boolean> {
  if (!eventId) return true; // sem event_id não dá pra deduplicar; deixa passar
  const { error } = await sb.from("imphq_webhook_dedup").insert({
    source,
    event_id: String(eventId),
    processed_at: new Date().toISOString(),
  });
  if (!error) return true;
  // 23505 = unique_violation → já processado
  if ((error as any).code === "23505" || /duplicate|unique/i.test(String((error as any).message))) {
    console.log(`[webhook-dedup] evento duplicado ignorado: ${source}/${eventId}`);
    return false;
  }
  // Erro inesperado: loga e deixa passar (fail-open) pra não travar entrega
  console.warn(`[webhook-dedup] insert falhou (${source}/${eventId}):`, (error as any).message);
  return true;
}

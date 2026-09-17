// Helper para disparar webhooks de saída a partir de qualquer Edge Function.
// Uso: await dispatchOutboundWebhook(supabase, "lead.created", { ...payload }, projectId?);
//
// Não bloqueia o fluxo principal: erros internos são logados mas não propagados.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type OutboundEvent =
  | "lead.created"
  | "lead.hot"
  | "lead.estagio_mudou"
  | "venda.paga"
  | "venda.reembolsada"
  | "whatsapp.resposta_recebida"
  | "imperius.acao_executada"
  | "ads.alerta_critico"
  | "campanha.meta_batida"
  | "webhook.test";

export async function dispatchOutboundWebhook(
  supabase: SupabaseClient | null,
  event: OutboundEvent | string,
  payload: Record<string, unknown>,
  projectId?: string | null,
): Promise<void> {
  try {
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/outbound-webhook-dispatcher`;
    // Fire-and-forget: não aguarda resposta para não atrasar o caller.
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ event, payload, project_id: projectId ?? null }),
    }).catch((e) => console.warn("[outbound-webhook] dispatch failed", e));
  } catch (e) {
    console.warn("[outbound-webhook] helper error", e);
  }
}

// Auxiliar caso a função chamadora não tenha cliente, retorna um service client.
export function getServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

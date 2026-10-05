import type { Tables } from "@/integrations/supabase/types";

export type AdAccountHealth = { label: string; tone: "ok" | "warn" | "fail" | "unknown"; detail?: string };

type HealthInput = Pick<Tables<"imphq_ad_accounts">, "meta_account_status" | "meta_billing_status" | "meta_unusable_reason" | "ultima_checagem">;

// Saúde real da conta na Meta (via Zernio). accountStatus: 1 ativa, 2 desativada, 3 pendência de pagamento.
export function accountHealth(a: HealthInput): AdAccountHealth {
  if (a.meta_account_status == null) return { label: a.ultima_checagem ? "Não aparece na Zernio" : "Não checada", tone: "unknown" };
  if (a.meta_account_status === 2) return { label: "Desativada na Meta", tone: "fail", detail: a.meta_unusable_reason || undefined };
  if (a.meta_account_status === 3) return { label: "Pagamento pendente", tone: "fail" };
  if (a.meta_account_status !== 1) return { label: `Status ${a.meta_account_status}`, tone: "warn" };
  if (a.meta_billing_status === "missing") return { label: "Ativa · sem pagamento", tone: "warn", detail: "Cadastre cartão ou saldo antes de subir campanha." };
  return { label: "Ativa", tone: "ok" };
}

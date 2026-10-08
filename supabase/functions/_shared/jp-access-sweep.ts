// JP2.1: o que liberar para uma compra paga que não chegou à área de membros. TS puro (testado no front).
// Prazos iguais aos da entrega da própria área de membros (areamembrojp_plan_external_products):
// formação 2 anos, cursos 1 ano a partir da compra.
export const JP_PREMIUM_PLAN_ID = "001637d7-9b8a-4d2d-ba01-d7d00d27c33a";
const DAY = 86_400_000;

export interface AccessGap {
  venda_id: string; produto_nome: string; tipo_venda: string | null; data_venda: string;
  email: string; user_id: string | null; program_id: string | null; grants_all_premium: boolean;
}

export interface EntitlementRow {
  user_id: string; scope: "plan" | "program"; plan_id?: string; program_id?: string;
  source: string; source_ref: string; is_active: true; expires_at: string;
}

export function entitlementFor(gap: AccessGap, userId: string, now = Date.now()): EntitlementRow | null {
  const base = { user_id: userId, source: "imperio-sweep", source_ref: gap.venda_id, is_active: true as const };
  const from = Date.parse(gap.data_venda);
  if (!Number.isFinite(from)) return null;
  const days = gap.grants_all_premium ? 730 : 365;
  const expires = new Date(from + days * DAY);
  if (expires.getTime() <= now) return null; // já teria vencido: nada a liberar
  if (gap.grants_all_premium) return { ...base, scope: "plan", plan_id: JP_PREMIUM_PLAN_ID, expires_at: expires.toISOString() };
  if (!gap.program_id) return null;
  return { ...base, scope: "program", program_id: gap.program_id, expires_at: expires.toISOString() };
}

export function sweepActionTitle(gap: AccessGap): string {
  const bump = gap.tipo_venda === "orderbump" ? " (bump)" : "";
  return `Liberei ${gap.produto_nome}${bump} para ${gap.email}`;
}

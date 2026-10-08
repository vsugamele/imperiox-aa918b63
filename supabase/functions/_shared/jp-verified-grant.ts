// Liberação de acesso verificada na área de membros JP (IA2.2): quem comprou e ficou travado recebe o acesso sozinho,
// mas SÓ com venda aprovada no Império (webhook da plataforma) para um produto que tem programa conhecido.
// Pagamento alegado na conversa nunca libera nada. TS puro, com a consulta ao banco injetada.

export interface ProgramRef { program_id: string; programa: string }

/** Produto vendido → programa da área de membros. Só entram mapeamentos confirmados; o resto vai para a equipe. */
export const JP_PROGRAM_BY_PRODUCT: ReadonlyArray<{ match: RegExp } & ProgramRef> = [
  { match: /c[óo]digo dos cortes/i, program_id: "3c368b42-5b73-4d86-a1cd-35c3022b142d", programa: "O Código dos Cortes Perfeitos" },
  { match: /finaliza[çc][ãa]o express/i, program_id: "d2760367-8fd7-4538-8765-10ac0810fb72", programa: "Finalização Express" },
  { match: /corte express/i, program_id: "f93166f9-e72c-4b66-a4d0-bc4ef7f860b1", programa: "Corte Express" },
  { match: /segredo do corte/i, program_id: "164d66e6-8186-4d1a-8303-e2b88bf95f7f", programa: "O Segredo do Corte" },
];

export function programForProduct(produto: string | null | undefined): ProgramRef | null {
  const hit = JP_PROGRAM_BY_PRODUCT.find((p) => p.match.test(String(produto ?? "")));
  return hit ? { program_id: hit.program_id, programa: hit.programa } : null;
}

export interface SaleForGrant { id: string; produto_nome: string | null; status: string | null; data_venda: string | null; created_at: string }

export interface VerifiedPurchase extends ProgramRef { venda_id: string; produto_nome: string; data_venda: string; origem?: "compra" | "vitalicio" }

/**
 * Regra do Vinicius (08/10): quem diz no atendimento que tem o VITALÍCIO entra no plano da formação (Premium, todos os
 * programas) sem prazo. Compras antigas (2024) não estão no Império, então a palavra da aluna vale; tudo fica em "A IA fez".
 */
export const JP_LIFETIME_PLAN = { plan_id: "001637d7-9b8a-4d2d-ba01-d7d00d27c33a", programa: "Formação JP Hair Education (vitalício)" } as const;
export const LIFETIME_CLAIM_REF = "vitalicio-declarado";

export function claimsLifetime(text: string | null | undefined): boolean {
  return /vital[ií]ci/i.test(String(text ?? ""));
}

/** Já tem o plano da formação sem prazo: não há nada a liberar. */
export function hasLifetimePlan(entitlements: ReadonlyArray<unknown>): boolean {
  return entitlements.some((e) => {
    const r = e && typeof e === "object" ? e as Record<string, unknown> : {};
    return r.plan_id === JP_LIFETIME_PLAN.plan_id && !r.expires_at;
  });
}

export function lifetimeClaimPurchase(now = new Date()): VerifiedPurchase {
  return { program_id: "", programa: JP_LIFETIME_PLAN.programa, venda_id: LIFETIME_CLAIM_REF, produto_nome: JP_LIFETIME_PLAN.programa, data_venda: now.toISOString(), origem: "vitalicio" };
}

export function lifetimeReply(link: string): string {
  return `Liberei seu acesso vitalício à formação completa agora. Este é o link para entrar sem senha: ${link}

Me avisa se conseguiu entrar.`;
}

const PAID = new Set(["aprovado", "approved", "paid", "pago", "completed"]);

/** A compra aprovada mais recente cujo programa ainda não está ativo para a pessoa. */
export function pickVerifiedPurchase(sales: ReadonlyArray<SaleForGrant>, activeProgramIds: ReadonlyArray<string>): VerifiedPurchase | null {
  const active = new Set(activeProgramIds);
  const candidates = sales
    .filter((s) => PAID.has(String(s.status ?? "").toLowerCase()))
    .map((s) => ({ s, p: programForProduct(s.produto_nome) }))
    .filter((x): x is { s: SaleForGrant; p: ProgramRef } => !!x.p && !active.has(x.p.program_id))
    .sort((a, b) => String(b.s.data_venda ?? b.s.created_at).localeCompare(String(a.s.data_venda ?? a.s.created_at)));
  const hit = candidates[0];
  return hit ? { ...hit.p, venda_id: hit.s.id, produto_nome: hit.s.produto_nome ?? hit.p.programa, data_venda: String(hit.s.data_venda ?? hit.s.created_at) } : null;
}

/** Ids dos programas ativos no retorno do CRM (entitlements/active_programs). */
export function activeProgramIds(programs: ReadonlyArray<unknown>): string[] {
  return programs.map((p) => {
    const r = p && typeof p === "object" ? p as Record<string, unknown> : {};
    return String(r.program_id ?? r.id ?? "");
  }).filter(Boolean);
}

/** Últimos 8 dígitos do telefone: o jeito estável de casar números com e sem DDI/9. */
export function phoneTail(phone: string | null | undefined): string {
  const d = String(phone ?? "").replace(/\D/g, "");
  return d.length >= 8 ? d.slice(-8) : "";
}

export function grantedReply(programa: string, link: string): string {
  return `Encontrei sua compra do ${programa} e liberei seu acesso agora. Este é o link para entrar sem senha: ${link}\n\nMe avisa se conseguiu entrar.`;
}

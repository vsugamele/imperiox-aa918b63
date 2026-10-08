// JP2.1: decide o que fazer com quem está esperando o suporte de acesso do JP. TS puro (testado no front).
import { claimsLifetime } from "./jp-verified-grant.ts";

export const JP_FREE_PLAN_ID = "ba9419a5-583f-4346-a274-25a9d56129fa";

export interface ActiveEntitlement { scope: string | null; plan_id: string | null; program_id: string | null; expires_at: string | null }

export type SupportAction =
  | { acao: "link"; email: string }
  | { acao: "vitalicio"; email: string }
  | { acao: "pedir_email" }
  | { acao: "sem_compra"; email: string };

/** O último e-mail que a própria pessoa escreveu (o mais recente vale: ela pode ter corrigido). */
export function lastEmail(inboundTexts: ReadonlyArray<string>): string {
  for (let i = inboundTexts.length - 1; i >= 0; i--) {
    const m = String(inboundTexts[i] ?? "").match(/[\w.+-]+@[\w-]+\.[\w.-]+/g);
    if (m?.length) return m[m.length - 1].toLowerCase().replace(/\.+$/, "");
  }
  return "";
}

/** Acesso pago ativo: qualquer coisa além do plano gratuito. */
export function hasPaidAccess(ents: ReadonlyArray<ActiveEntitlement>, now = Date.now()): boolean {
  return ents.some((e) => e.plan_id !== JP_FREE_PLAN_ID && (!e.expires_at || Date.parse(e.expires_at) > now));
}

export function decideSupport(input: { inboundTexts: ReadonlyArray<string>; email: string; hasAccount: boolean; ents: ReadonlyArray<ActiveEntitlement>; hasLifetime: boolean }): SupportAction {
  const { email } = input;
  if (!email) return { acao: "pedir_email" };
  if (claimsLifetime(input.inboundTexts.join("\n")) && !input.hasLifetime) return { acao: "vitalicio", email };
  if (input.hasAccount && hasPaidAccess(input.ents)) return { acao: "link", email };
  return { acao: "sem_compra", email };
}

export function supportMessage(action: SupportAction, link = "", liberadoAgora: ReadonlyArray<string> = []): string {
  if (action.acao === "pedir_email") return "Oi! Pra eu liberar seu acesso agora, me manda o e-mail que você usou na compra?";
  if (action.acao === "sem_compra") return `Procurei pelo e-mail ${action.email} e não encontrei compra nele. Você pode ter usado outro e-mail na compra? Me manda o outro e-mail ou o comprovante que eu resolvo por aqui.`;
  if (action.acao === "vitalicio") return `Desculpa a demora! Liberei seu acesso vitalício à formação completa. Entra por este link, sem precisar de senha: ${link}\n\nMe avisa se conseguiu entrar.`;
  const extra = liberadoAgora.length ? ` Também liberei o ${liberadoAgora.join(" e o ")}, que tinha ficado de fora.` : "";
  return `Desculpa a demora! Resolvi aqui: seu acesso está liberado.${extra} Entra por este link, sem precisar de senha: ${link}\n\nSe um dia pedir senha, use "Esqueci minha senha" com o e-mail ${action.email}. Me avisa se conseguiu entrar.`;
}

import { record, text as stringValue, errorText } from "./value.ts";
import { jpAccessStatus, verifiedMagicLink } from "./conversation-policy.ts";
declare const Deno: { env: { get(name: string): string | undefined } };
// CRM Bridge JP Freitas — escopo isolado para project_id === 'jp_freitas'.
// Área de membros: https://jphaireducation.com.br
// Endpoint único: https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/crm-bridge
// NUNCA usar fora desse projeto.

const JP_PROJECT_ID = "jp_freitas";
const CRM_URL = "https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/crm-bridge";

export function isJPProject(project_id: string | null | undefined): boolean {
  return project_id === JP_PROJECT_ID;
}

function getSecret(): string | null {
  return Deno.env.get("JPFREITAS_CRM_BRIDGE_SECRET") || null;
}

async function callBridge(action: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const secret = getSecret();
  if (!secret) {
    console.warn("[crmBridgeJP] JPFREITAS_CRM_BRIDGE_SECRET not set");
    return { ok: false, error: "secret_missing" };
  }
  try {
    const res = await fetch(CRM_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-crm-secret": secret,
      },
      body: JSON.stringify({ action, ...payload }),
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try { json = text ? record(JSON.parse(text)) : {}; } catch { json = { raw: text }; }
    if (!res.ok) {
      console.warn(`[crmBridgeJP] ${action} HTTP ${res.status}`);
      return { ...json, ok: false, status: res.status };
    }
    return { ...json, ok: json.ok !== false && !json.error };
  } catch (e: unknown) {
    console.error(`[crmBridgeJP] ${action} fetch error: ${errorText(e)}`);
    return { ok: false, error: errorText(e) };
  }
}

export async function jpLookupLead(email: string) {
  if (!email) return null;
  return callBridge("lookup_lead", { email });
}

export async function jpLookupLeadByPhone(phone: string) {
  if (!phone) return null;
  const clean = String(phone).replace(/\D/g, "");
  if (!clean) return null;
  return callBridge("lookup_lead", { phone: clean });
}

/** Resolve lead trying email first then phone. Returns { lookup, source, emailFound }. */
export async function jpResolveLead(opts: { email?: string; phone?: string }): Promise<{ lookup: Record<string, unknown> | null; source: "email" | "phone" | "none"; emailFound: string }> {
  const email = (opts.email || "").trim().toLowerCase();
  if (email) {
    const r = await jpLookupLead(email);
    if (r && r.ok !== false) return { lookup: r, source: "email", emailFound: email };
  }
  if (opts.phone) {
    const r = await jpLookupLeadByPhone(opts.phone);
    if (r && r.ok !== false) {
      const data = record(r?.data || r);
      const found = (data?.email || record(data.user).email || "").toString().trim().toLowerCase();
      return { lookup: r, source: "phone", emailFound: found };
    }
  }
  return { lookup: null, source: "none", emailFound: email };
}

export async function jpIssueMagicLink(email: string, redirect_path = "/home", create_if_missing = false) {
  if (!email) return null;
  return callBridge("issue_magic_link", { email, redirect_path, create_if_missing });
}

export async function jpAddTags(email: string, tags: string[]) {
  if (!email || !tags?.length) return null;
  return callBridge("add_tags", { email, tags });
}

export async function jpLogEvent(email: string, event_type: string, metadata: Record<string, unknown> = {}) {
  if (!email || !event_type) return null;
  return callBridge("log_event", { email, event_type, metadata });
}

export async function jpGrantAccess(email: string, program_ids?: string[], expires_at?: string) {
  if (!email) return null;
  const payload: Record<string, unknown> = { email };
  if (program_ids?.length) payload.program_ids = program_ids;
  if (expires_at) payload.expires_at = expires_at;
  return callBridge("grant_access", payload);
}

/**
 * Bloco de contexto a injetar no system prompt quando o lead tem email conhecido.
 * Resume status do aluno na área de membros do JP Freitas.
 */
export function jpBuildContextBlock(lookup: Record<string, unknown> | null, email: string): string {
  if (!lookup || lookup.ok === false) return "";
  const data = record(lookup.data || lookup);
  const { hasAccount: has_account, hasAccess: has_premium, programs } = jpAccessStatus(lookup);
  const stage = data?.stage || data?.lead_stage || "";
  const lines = [
    `\n📚 STATUS NA ÁREA DE MEMBROS JP FREITAS (jphaireducation.com.br) — email do lead: ${email}`,
    `- Tem conta cadastrada: ${has_account ? "SIM" : "NÃO"}`,
    `- Tem acesso ativo (compra/cortesia): ${has_premium ? "SIM" : "NÃO"}`,
  ];
  if (stage) lines.push(`- Estágio: ${stage}`);
  if (programs.length) lines.push(`- Programas ativos: ${programs.slice(0, 5).map((p: unknown) => record(p).name || record(p).id || p).join(", ")}`);
  return lines.join("\n") + "\n";
}

/**
 * Instruções específicas (só injetadas para JP Freitas).
 * A IA emite tags que o pós-processamento converte em ações no CRM bridge.
 */
export function jpBuildInstructionsBlock(leadEmailKnown: boolean): string {
  return `
INTEGRAÇÃO REAL ÁREA DE MEMBROS JP FREITAS:
- ${leadEmailKnown ? "Email do lead conhecido; use o email confirmado no cadastro." : "Peça o email usado na compra antes de recuperar acesso."}
- Consulte o status do CRM. Uma conta cadastrada não significa compra/acesso ativo.
- [JP_MAGIC_LINK:email] solicita recuperação apenas para acesso já confirmado. A mensagem final depende do resultado real.
- [JP_TAG:email|tag] e [JP_LOG:email|evento] registram ações internas; não prometem notificação ao aluno.
- Não conceda acesso/cortesia nem use JP_GRANT. Pagamento alegado exige verificação operacional.
- Falha de consulta, aluno sem acesso confirmado ou erro ao gerar link: [TRANSICAO_HUMANA].
- Não anuncie que entrou sem senha usando o domínio comum. Não afirme que liberou acesso ou enviou email.
- Não peça qual curso comprou quando o CRM já identificou os acessos. Nunca anuncie nomes não retornados pelo CRM.
- NUNCA invente que o sistema está com "instabilidade", "fora do ar" ou "com erro ao gerar link" quando o aluno tiver acesso ativo no cadastro. Se ele reclamar de acesso negado após comprar Código dos Cortes Perfeitos (R$ 47), oriente que ele deve acessar o link direto do curso dele (/programs/3c368b42-5b73-4d86-a1cd-35c3022b142d) e não clicar no banner da Formação de R$ 797.
`;

}

/**
 * Processa as tags JP_* na resposta da IA: executa ações, substitui [JP_MAGIC_LINK:...] pelo link real,
 * remove as outras tags silenciosas. Retorna o texto final pronto para enviar.
 * Não-bloqueante para tags silenciosas (tags + log + grant rodam em background).
 *
 * `fallbackEmail`: usado quando a IA emite placeholder sem email válido (ex: [JP_MAGIC_LINK:EMAIL_DO_LEAD]).
 */
export async function jpProcessTags(reply: string, fallbackEmail = ""): Promise<string> {
  if (!reply) return reply;
  let out = reply;
  const fb = (fallbackEmail || "").trim().toLowerCase();

  // Normaliza placeholders inválidos para o fallback (sem @ válido)
  const resolveEmail = (raw: string): string => {
    const v = (raw || "").trim();
    if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(v)) return v.toLowerCase();
    return fb;
  };

  // Aceita qualquer conteúdo até `]` ou `|` para capturar placeholders inválidos também
  // 1. [JP_MAGIC_LINK:...]
  const magicRegex = /\[JP_MAGIC_LINK:\s*([^\]]+?)\s*\]/gi;
  for (const m of [...out.matchAll(magicRegex)]) {
    const email = resolveEmail(m[1]);
    if (!email || (fb && email !== fb)) throw new Error("JP_ACCESS_EMAIL_UNCONFIRMED");
    const lookup = await jpLookupLead(email);
    const status = jpAccessStatus(lookup);
    if (!status.hasAccess) throw new Error("JP_ACCESS_NOT_CONFIRMED");
    let redirectPath = "/home";
    const ent = status.programs[0] ? record(status.programs[0]) : null;
    const progId = ent?.program_id ? String(ent.program_id) : "";
    if (progId) redirectPath = `/programs/${progId}`;
    const res = await jpIssueMagicLink(email, redirectPath);
    const link = verifiedMagicLink(res);
    if (link) {
      out = out.replace(m[0], link);
      console.log("[crmBridgeJP] magic_link confirmado");
    } else {
      throw new Error("JP_MAGIC_LINK_FAILED");
    }
  }

  // 2. [JP_TAG:email|tag1,tag2]
  const tagRegex = /\[JP_TAG:\s*([^\]|]+?)\s*\|\s*([^\]]+)\]/gi;
  for (const m of [...out.matchAll(tagRegex)]) {
    const email = resolveEmail(m[1]);
    const tags = m[2].split(",").map((t) => t.trim()).filter(Boolean);
    if (email) jpAddTags(email, tags).catch(() => {});
    out = out.replace(m[0], "");
  }

  // 3. [JP_LOG:email|event_name]
  const logRegex = /\[JP_LOG:\s*([^\]|]+?)\s*\|\s*([^\]]+)\]/gi;
  for (const m of [...out.matchAll(logRegex)]) {
    const email = resolveEmail(m[1]);
    const event = m[2].trim();
    if (email) jpLogEvent(email, event, { source: "wa-ai-reply" }).catch(() => {});
    out = out.replace(m[0], "");
  }

  // 4. [JP_GRANT:email]
  const grantRegex = /\[JP_GRANT:\s*([^\]]+?)\s*\]/gi;
  for (const m of [...out.matchAll(grantRegex)]) {
    throw new Error("JP_GRANT_REQUIRES_VERIFIED_AUTHORIZATION");
  }

  return out.replace(/\n{3,}/g, "\n\n").trim();
}

/** Never announce account recovery until the CRM has verified access and issued a real token. */
export async function jpPrepareAccessReply(reply: string, email: string, incomingContext: string, currentMessage = incomingContext, previousLinkSent = false): Promise<{ text: string; needsHandoff: boolean }> {
  const accessPattern = /acess|login|senha|entrar.{0,30}(curso|aula|plataforma)|aulas.{0,30}(bloque|nao|não)/i;
  const continuation = /@|não (deu|funcion|entrou)|nao (deu|funcion|entrou)|continua|ainda (não|nao)|^sim[.!\s]*$/i.test(currentMessage);
  const accessIntent = accessPattern.test(currentMessage) || (continuation && accessPattern.test(incomingContext));
  if (previousLinkSent && /(?:não|nao) (?:deu|funcion|entrou|consigo|consegui)|continua.{0,20}(?:bloque|erro)|link.{0,20}(?:não|nao|erro)/i.test(currentMessage))
    return { text: "O link não resolveu o acesso. Preciso que a equipe verifique o cadastro para concluir isso.", needsHandoff: true };
  if (accessIntent && !email) return { text: "Qual é o email que você usou na compra? Vou consultar o cadastro para ajudar com o acesso.", needsHandoff: false };
  try {
    if (accessIntent) {
      const lookup = await jpLookupLead(email);
      const status = jpAccessStatus(lookup);
      if (!status.hasAccess) throw new Error("JP_ACCESS_NOT_CONFIRMED");
      let redirectPath = "/home";
      const ent = status.programs[0] ? record(status.programs[0]) : null;
      const progId = ent?.program_id ? String(ent.program_id) : "";
      if (progId) redirectPath = `/programs/${progId}`;
      const link = verifiedMagicLink(await jpIssueMagicLink(email, redirectPath));
      if (!link) throw new Error("JP_MAGIC_LINK_FAILED");
      return { text: `Seu acesso está ativo no cadastro. Este é o link para entrar sem senha: ${link}\n\nMe avisa se conseguiu entrar.`, needsHandoff: false };
    }
    return { text: await jpProcessTags(reply, email), needsHandoff: /\[(TRANSICAO_HUMANA|CHAMAR_HUMANO)\]/i.test(reply) };
  } catch (error: unknown) {
    console.warn("[crmBridgeJP] recovery failed:", errorText(error));
    return { text: "Não consegui concluir a recuperação do seu acesso agora.", needsHandoff: true };
  }
}

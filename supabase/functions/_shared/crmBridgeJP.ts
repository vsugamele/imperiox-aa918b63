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

async function callBridge(action: string, payload: Record<string, any>): Promise<any> {
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
    });
    const text = await res.text();
    let json: any = {};
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
    if (!res.ok) {
      console.warn(`[crmBridgeJP] ${action} HTTP ${res.status}: ${text.slice(0, 200)}`);
      return { ok: false, status: res.status, ...json };
    }
    return { ok: true, ...json };
  } catch (e: any) {
    console.error(`[crmBridgeJP] ${action} fetch error: ${e?.message}`);
    return { ok: false, error: e?.message };
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
export async function jpResolveLead(opts: { email?: string; phone?: string }): Promise<{ lookup: any; source: "email" | "phone" | "none"; emailFound: string }> {
  const email = (opts.email || "").trim().toLowerCase();
  if (email) {
    const r = await jpLookupLead(email);
    if (r && r.ok !== false) return { lookup: r, source: "email", emailFound: email };
  }
  if (opts.phone) {
    const r = await jpLookupLeadByPhone(opts.phone);
    if (r && r.ok !== false) {
      const data = r?.data || r;
      const found = (data?.email || data?.user?.email || "").toString().trim().toLowerCase();
      return { lookup: r, source: "phone", emailFound: found };
    }
  }
  return { lookup: null, source: "none", emailFound: email };
}

export async function jpIssueMagicLink(email: string, redirect_path = "/home", create_if_missing = true) {
  if (!email) return null;
  return callBridge("issue_magic_link", { email, redirect_path, create_if_missing });
}

export async function jpAddTags(email: string, tags: string[]) {
  if (!email || !tags?.length) return null;
  return callBridge("add_tags", { email, tags });
}

export async function jpLogEvent(email: string, event_type: string, metadata: Record<string, any> = {}) {
  if (!email || !event_type) return null;
  return callBridge("log_event", { email, event_type, metadata });
}

export async function jpGrantAccess(email: string, program_ids?: string[], expires_at?: string) {
  if (!email) return null;
  const payload: any = { email };
  if (program_ids?.length) payload.program_ids = program_ids;
  if (expires_at) payload.expires_at = expires_at;
  return callBridge("grant_access", payload);
}

/**
 * Bloco de contexto a injetar no system prompt quando o lead tem email conhecido.
 * Resume status do aluno na área de membros do JP Freitas.
 */
export function jpBuildContextBlock(lookup: any, email: string): string {
  if (!lookup || lookup.ok === false) return "";
  const data = lookup.data || lookup;
  const has_account = data?.has_account ?? data?.user_exists ?? false;
  const has_premium = data?.has_premium ?? data?.has_active_access ?? false;
  const stage = data?.stage || data?.lead_stage || "";
  const programs = Array.isArray(data?.active_programs) ? data.active_programs : (Array.isArray(data?.programs) ? data.programs : []);
  const lines = [
    `\n📚 STATUS NA ÁREA DE MEMBROS JP FREITAS (jphaireducation.com.br) — email do lead: ${email}`,
    `- Tem conta cadastrada: ${has_account ? "SIM" : "NÃO"}`,
    `- Tem acesso ativo (compra/cortesia): ${has_premium ? "SIM" : "NÃO"}`,
  ];
  if (stage) lines.push(`- Estágio: ${stage}`);
  if (programs.length) lines.push(`- Programas ativos: ${programs.slice(0, 5).map((p: any) => p?.name || p?.id || p).join(", ")}`);
  return lines.join("\n") + "\n";
}

/**
 * Instruções específicas (só injetadas para JP Freitas).
 * A IA emite tags que o pós-processamento converte em ações no CRM bridge.
 */
export function jpBuildInstructionsBlock(leadEmailKnown: boolean): string {
  return `

🎓 INTEGRAÇÃO ÁREA DE MEMBROS JP FREITAS — APENAS PARA ESTE PROJETO:
A escola/área de membros oficial é https://jphaireducation.com.br (JP Hair Education). NUNCA confunda com outras áreas de membros de outros projetos. Se o aluno mencionar "área de membros", "plataforma", "login", "entrar no curso", "acessar aulas", refira-se SEMPRE a https://jphaireducation.com.br.

VOCÊ TEM AÇÕES REAIS DISPONÍVEIS via tags secretas (o sistema executa e substitui antes de enviar ao lead):

1. [JP_MAGIC_LINK:email@dominio.com] — Gera link mágico de acesso (passwordless) para o aluno entrar na área de membros. Use quando o aluno: (a) pedir o link de acesso, (b) disser que não consegue logar, (c) confirmou pagamento e quer entrar, (d) você quer enviar link de cortesia. O sistema cria conta se ainda não existir. A tag é substituída pelo link real antes do envio — escreva naturalmente, ex: "Aqui está seu acesso: [JP_MAGIC_LINK:${leadEmailKnown ? "EMAIL_DO_LEAD" : "email@que.elerespondeu"}]".

2. [JP_TAG:email@dominio.com|tag1,tag2] — Marca o aluno com tags no CRM (ex: "interessado-curso-corte", "pediu-suporte-tecnico", "lead-quente-wpp"). Use silenciosamente após qualificar uma intenção — o lead não vê.

3. [JP_LOG:email@dominio.com|nome_do_evento] — Registra evento no histórico do CRM (ex: "wpp_pediu_acesso", "wpp_duvida_curso_x"). Silencioso. Use sempre que houver intenção relevante.

4. [JP_GRANT:email@dominio.com] — Libera acesso total como CORTESIA. USE APENAS quando explicitamente autorizado pela conversa/contexto (ex: aluno comprou e ficou sem acesso por erro, política de cortesia, etc). Em caso de dúvida, use [TRANSICAO_HUMANA] em vez disso.

REGRAS:
- ${leadEmailKnown ? "O email do lead JÁ É CONHECIDO (mostrado no STATUS acima). Use-o direto." : "Você AINDA NÃO TEM o email do lead. Antes de usar qualquer tag JP_*, peça o email gentilmente ('me passa o email que você usou pra eu te liberar o acesso?')."}
- Se o STATUS mostra "Tem acesso ativo: SIM" e o lead pede acesso → use [JP_MAGIC_LINK:email] (ele tem direito).
- Se "Tem acesso ativo: NÃO" e ele alega compra recente → peça comprovante OU adicione [TRANSICAO_HUMANA].
- Em todas as tags JP_*, use o email EXATO do lead, sem aspas, sem placeholders, sem espaços extras.
- Você pode incluir VÁRIAS tags na mesma resposta (ex: enviar link + tag + log).
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
    if (!email) { out = out.replace(m[0], "https://jphaireducation.com.br"); continue; }
    const res = await jpIssueMagicLink(email);
    const link = res?.magic_link || res?.link || res?.url || res?.data?.magic_link || res?.data?.link;
    if (link) {
      out = out.replace(m[0], link);
      console.log(`[crmBridgeJP] magic_link gerado para ${email}`);
    } else {
      out = out.replace(m[0], "https://jphaireducation.com.br");
      console.warn(`[crmBridgeJP] magic_link falhou para ${email} → fallback url`);
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
    const email = resolveEmail(m[1]);
    if (email) jpGrantAccess(email).catch(() => {});
    out = out.replace(m[0], "");
  }

  return out.replace(/\n{3,}/g, "\n\n").trim();
}

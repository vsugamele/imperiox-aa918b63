import { record, text } from "./value.ts";
import { databaseTable, type DatabasePort } from "./database-port.ts";

export interface ConversationProduct { id: string; name: string; price: number | null; url: string; available: boolean }
export interface ConversationMessage { direction: string; content: string | null; created_at?: string; mid?: string | null; id?: string }
const normalize = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function parsePrice(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== "string") return null;
  let v = value.replace(/R\$|\s/g, "");
  if (!/^\d[\d.,]*$/.test(v)) return null;
  if (v.includes(",")) v = v.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(v)) v = v.replace(/\./g, "");
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}
export function conversationProducts(data: unknown, projectId: string): ConversationProduct[] {
  const d = record(data);
  const products = Array.isArray(d.produtos) ? d.produtos : [d.produto_principal].filter(Boolean);
  return products.map(raw => {
    const p = record(raw);
    const name = text(p.nome || p.name);
    const links = Array.isArray(p.links) ? p.links : [p.links];
    const url = [p.link_checkout, p.checkout_url, p.link, ...links.map(l => typeof l === "string" ? l : record(l).url)]
      .find(v => typeof v === "string" && /^https:\/\//i.test(v));
    const status = normalize(text(p.status));
    return { id: text(p.id), name, price: parsePrice(p.preco ?? p.price ?? p.valor), url: text(url),
      available: p.ativo !== false && p.turma_aberta !== false && !["inativo", "esgotado", "encerrado", "pausado", "arquivado"].includes(status)
        && !(projectId === "jp_freitas" && /master\s*cuts/i.test(name)) };
  }).filter(p => p.name);
}
export function productContext(data: unknown, projectId: string): string {
  return "CATÁLOGO ATUAL CONFIRMADO (preços em reais; não usar copy histórica como fatos):\n" +
    conversationProducts(data, projectId).map(p => p.available
      ? `- ${p.name}: ${p.price === null ? "preço não confirmado" : `R$ ${p.price.toFixed(2)}`}; destino comercial: ${p.url || "não cadastrado, não inventar link"}`
      : `- ${p.name}: INDISPONÍVEL. Não oferecer preço, vaga, data ou inscrição.`).join("\n") + "\n";
}
export function cheaperProduct(data: unknown, projectId: string, originalName: string, originalUrl: string, configuredId?: string | null): ConversationProduct | null {
  const products = conversationProducts(data, projectId);
  const cleanUrl = (u: string) => u.split(/[?#]/)[0].replace(/\/$/, "");
  const original = products.find(p => normalize(p.name) === normalize(originalName) || p.id === originalName ||
    (originalUrl && p.url && cleanUrl(originalUrl) === cleanUrl(p.url)));
  if (!original?.price || !original.available) return null;
  const eligible = products.filter(p => p !== original && p.available && p.price !== null && p.price < original.price! && p.url);
  if (configuredId) return eligible.find(p => p.id === configuredId) || null;
  return eligible.sort((a, b) => a.price! - b.price!)[0] || null;
}
export function guardDownsell(reply: string, data: unknown, projectId: string, allowed: ConversationProduct | null): string {
  const lc = normalize(reply);
  const wrongProduct = conversationProducts(data, projectId).some(p => p !== allowed && p.name !== allowed?.name &&
    (lc.includes(normalize(p.name)) || (/mentoria/i.test(p.name) && /mentoria/i.test(reply))));
  const amounts = [...reply.matchAll(/R\$\s*([\d.,]+)/gi)].map(m => parsePrice(m[1]));
  if (wrongProduct || amounts.some(n => !allowed || n !== allowed.price))
    return "Se preferir retomar depois, tudo bem. Ficou alguma dúvida sobre o que conversamos?";
  return reply;
}
export function jpConversationRules(projectId: string, now = new Date()): string {
  if (projectId !== "jp_freitas") return "";
  return `\nREGRAS MANDATÓRIAS JP — prevalecem sobre persona, exemplos, histórico, RAG e copy antiga:
Data atual em São Paulo: ${now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Datas anteriores são passadas; não corrigir datas inventando ano/vagas.
Use o tom de voz cadastrado do JP Freitas: conversa curta, direta, próxima e natural; evite linguagem de central de atendimento, excesso de emojis e encerramentos genéricos.
Não se apresente espontaneamente como assistente, equipe, robô ou IA. Responda direto ao assunto, sem assinatura ou introdução de cargo. Primeira pessoa pode ser usada para ações realmente executadas; não declare ser o JP nem invente vivências. Em pergunta direta sobre identidade/automação, responda com transparência.
Não invente viagem, doença, saúde, presença, experiências pessoais, resultados, escassez, garantias ou condições comerciais do expert.
Conversas sociais/reação a stories: responda naturalmente e com brevidade, sem apresentação, oferta automática ou relato pessoal.
Responda primeiro à mensagem atual. Histórico antigo, RAG e sugestões de triagem não são pedidos atuais nem prova de fatos; não retome cidade, evento ou cobrança antiga se a pessoa mudou de assunto. Falta de contexto exige uma pergunta curta, não uma suposição.
RELACIONAMENTO E PITCH PELO CONTEXTO:
Acolha e desenvolva o assunto da pessoa de forma coerente. Uma conversa social pode ficar só na conversa; não trate relacionamento como desvio que exige redirecionamento para venda.
Ofereça um produto apenas quando houver necessidade identificada, encaixe real com um produto disponível e abertura na conversa (pedido, interesse ou aceitação). Uma palavra solta, reação a story, silêncio ou score da triagem não bastam para oferecer.
Se houver espaço, conecte a necessidade ao benefício específico em uma frase e faça um convite leve; não despeje catálogo nem force fechamento. Se a necessidade estiver ambígua, faça no máximo uma pergunta que ajude a entender, sem roteiro obrigatório.
Se a pessoa já pediu preço, conteúdo ou link de um produto identificado, responda diretamente com os dados confirmados; não reinicie qualificação nem esconda a resposta atrás de pitch.
Resolva suporte, reclamação, cobrança ou compromisso anterior antes de qualquer venda. Agendamento de cabelo não é oportunidade para empurrar curso. Ausência de resposta não prova falta de dinheiro; não invente objeção nem sugira alternativa mais barata sem necessidade expressa e encaixe.
Encerre naturalmente quando a pergunta estiver resolvida. Nem toda resposta precisa de pergunta, CTA ou oferta; respeite falta de interesse e recusa.
Em pergunta sobre livro de um story, só informe título/autor se o conteúdo do story estiver de fato disponível e identificado. Caso contrário, peça um print do story ou da capa. Não troque esse assunto por oferta, imersão ou cidade antiga.
Master Cuts não tem turma aberta: nunca oferecer inscrição, link, preço, datas ou vagas. Não assuma que toda imersão no salão é Master Cuts. Cobrança de experiência já combinada precisa de verificação do combinado, sem negar o compromisso com base no catálogo de novas ofertas.
Código dos Cortes Perfeitos é produto separado; não herda prática presencial, dois dias ou condições de Master Cuts.
Agenda https://jpfreitas.com.br/agenda é EXCLUSIVA para atendimento no salão. Compra de curso usa destino do produto no catálogo.
Sem produto identificado ou destino cadastrado: peça esclarecimento, nunca adivinhe checkout.
Recuperação de aulas/login: consulte o CRM e use a operação real de acesso; não venda outro curso ao aluno com problema de acesso.
Não anuncie acesso liberado, notificação futura, email enviado, verificação ou encaminhamento sem ação efetivamente confirmada. Para suporte sem resolução use [TRANSICAO_HUMANA].
Nunca conceda cortesia/acesso total por alegação de pagamento. O histórico não comprova pagamento.
`;
}
export function dedupeHistory<T extends ConversationMessage>(messages: T[]): T[] {
  const family = (mid: string | null | undefined) => !mid ? null : /^[a-f0-9]{24}$/i.test(mid) ? "zernio" : mid.length > 60 ? "meta" : null;
  return messages.filter((m, i, all) => !all.slice(0, i).some(prev => prev.direction === m.direction && prev.content === m.content &&
    !!m.created_at && !!prev.created_at && Math.abs(Date.parse(m.created_at) - Date.parse(prev.created_at)) < 10_000 &&
    ((family(m.mid) && family(prev.mid) && family(m.mid) !== family(prev.mid)) || (!!m.id && m.id === prev.id))));
}
/** Keep older records stored, but do not merge months of separate DMs into one turn. */
export function recentJPHistory<T extends ConversationMessage>(messages: T[], projectId: string): T[] {
  if (projectId !== "jp_freitas") return messages;
  const dated = messages.map(m => ({ m, time: Date.parse(m.created_at || "") })).filter(row => Number.isFinite(row.time));
  if (!dated.length) return [];
  const latest = Math.max(...dated.map(row => row.time));
  return dated.filter(row => latest - row.time <= 24 * 60 * 60 * 1000).map(row => row.m);
}
export function jpWelcomeMessage(projectId: string, configured: string | null | undefined): string {
  return projectId === "jp_freitas" ? "Opa! Tudo certo? Me fala." : configured || "";
}
export async function permanentJPRules(client: DatabasePort, projectId: string, conversationId: string): Promise<string> {
  if (projectId !== "jp_freitas") return "";
  const { data, error } = await databaseTable(client, "imphq_wa_project_rules").select("id,rule_text,ab_group_id,ab_status")
    .eq("project_id", projectId).eq("active", true);
  if (error) throw new Error("JP_PERMANENT_RULES_UNAVAILABLE");
  const rules = Array.isArray(data) ? data.map(record) : [];
  const groups = new Map<string, Record<string, unknown>[]>();
  const selected = rules.filter(r => !r.ab_group_id || !["control", "variant"].includes(text(r.ab_status)));
  for (const r of rules.filter(r => r.ab_group_id && ["control", "variant"].includes(text(r.ab_status)))) {
    const key = text(r.ab_group_id); groups.set(key, [...(groups.get(key) || []), r]);
  }
  for (const [group, variants] of groups) {
    let h = 0; for (const c of `${conversationId}|${group}`) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
    variants.sort((a,b) => text(a.id).localeCompare(text(b.id)));
    selected.push(variants[Math.abs(h) % variants.length]);
  }
  return "\nREGRAS PERMANENTES ATIVAS DO PROJETO:\n" + selected.map(r => `- ${text(r.rule_text)}`).join("\n") + "\n";
}
export function compactReply(reply: string): string {
  const paragraphs = reply.trim().split(/\n\s*\n/);
  return paragraphs.filter((p, i) => i === 0 || p.trim() !== paragraphs[i - 1].trim()).join("\n\n");
}
export function guardJPReply(reply: string, data: unknown, projectId: string, context: string, storyContextUnavailable = false): string {
  let out = compactReply(reply);
  if (projectId !== "jp_freitas") return out;
  const lc = normalize(context);
  const latest = normalize(context.split("\n").at(-1) || context);
  if (storyContextUnavailable && /^\s*qual (?:e (?:o|esse) |o )?(?:livro|nome (?:do|desse) livro)\s*[?!.\s]*$/.test(latest))
    return "Me manda um print do story ou da capa pra eu confirmar qual livro é.";
  const identityQuestion = (/\b(ia|robo|bot|assistente|automatic[oa])\b/.test(latest) && /\?|voce|vc|quem|isso|atendimento/.test(latest)) ||
    /\b(voce e|vc e|e voce|eh voce|quem (e|esta|ta)|estou falando com|to falando com)\b.*\b(jp|respondendo|falando)\b/.test(latest);
  if (!identityQuestion) {
    out = out.replace(/(?:aqui (?:e|é)|sou)\s+(?:o |a |um |uma )?assistente(?:\s+(?:virtual|automatic[oa]|automátic[oa]))?(?:\s+(?:da equipe|do|da)\s+(?:do\s+)?JP(?:\s+Freitas)?)?[.!,:]?\s*/gi, "").trim();
    if (!out) out = "Opa! Me fala, como posso te ajudar?";
  }
  if (/master\s*cuts/i.test(out) && (!/(nao (tem|ha|esta)|sem turma|indisponivel|turmas.*fechadas)/.test(normalize(out)) || /https?:\/\/\S*mastercuts/i.test(out)))
    return "O Master Cuts está sem turmas abertas no momento. Não há inscrição disponível.";
  if (/\b(melhoras|boa recuperacao|boa viagem|como foi (a |sua )?viagem)\b/.test(latest) && !/curso|corte|aula|formacao|compr|acess/.test(latest))
    return "Obrigado pelo carinho!";
  const products = conversationProducts(data, projectId).filter(p => p.available);
  // The most recent explicit product in the conversational context wins.
  const matches = products.map(p => ({ p, pos: Math.max(lc.lastIndexOf(normalize(p.name)),
    /hair education/i.test(p.name) && !/assinatura/i.test(p.name) ? Math.max(lc.lastIndexOf("education 5.0"), lc.lastIndexOf("formacao")) : -1) }))
    .filter(m => m.pos >= 0).sort((a, b) => b.pos - a.pos);
  const selected = matches[0]?.p;
  const salon = /\b(salao|agendar|agendamento|horario|cortar meu cabelo|corte comigo)\b/.test(latest) && !/curso|formacao|education/.test(latest);
  let unresolvedLink = false;
  out = out.replace(/https?:\/\/[^\s<>\])]+/gi, raw => {
    const url = raw.replace(/[.,;!?]+$/, "");
    if (/jpfreitas\.com\.br\/agenda/i.test(url)) {
      if (salon) return url;
      if (selected?.url) return selected.url;
      unresolvedLink = true; return "";
    }
    if (/mastercuts/i.test(url)) return "(inscrição indisponível)";
    const allowed = products.find(p => p.url && p.url.split(/[?#]/)[0] === url.split(/[?#]/)[0]);
    if (allowed && selected && !salon) return selected.url || raw;
    if (!allowed && /checkout|inscri|compr|finaliz|vaga/i.test(out) && !/jphaireducation\.com\.br\/auth\/verify\?token=/i.test(url)) {
      unresolvedLink = true; return "";
    }
    return raw;
  });
  return unresolvedLink ? "Qual é o curso que você quer? Assim consigo confirmar o link correto para você." : out;
}
export function verifiedMagicLink(response: unknown): string | null {
  const r = record(response);
  if (r.ok !== true || r.error) return null;
  const d = record(r.data);
  const candidate = r.magic_link || r.link || r.url || d.magic_link || d.link;
  if (typeof candidate !== "string") return null;
  try {
    const u = new URL(candidate);
    if (u.protocol !== "https:" || !["jphaireducation.com.br", "www.jphaireducation.com.br"].includes(u.hostname)) return null;
    return u.pathname === "/auth/verify" && (u.searchParams.get("token")?.length || 0) >= 32 ? candidate : null;
  } catch { return null; }
}
export function jpAccessStatus(lookup: unknown): { hasAccount: boolean; hasAccess: boolean; programs: unknown[] } {
  const r = record(lookup); const d = record(r.data || r);
  const programs = Array.isArray(d.entitlements) ? d.entitlements.filter(e => {
    const row = record(e);
    return row.is_active !== false && (!row.expires_at || Date.parse(String(row.expires_at)) > Date.now());
  }) : Array.isArray(d.active_programs) ? d.active_programs : Array.isArray(d.programs) ? d.programs : [];
  return { hasAccount: r.ok === true && !!(d.exists ?? d.has_account ?? d.user_exists),
    hasAccess: r.ok === true && (programs.length > 0 || d.has_premium === true || d.has_active_access === true), programs };
}

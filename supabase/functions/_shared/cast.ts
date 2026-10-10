// Elenco (OPS1.5): os avatares de um projeto nos dois sentidos — quem APARECE na arte (elenco visual) e para quem a
// copy FALA (persona do público). TS puro: atribuição de avatar às peças da leva, bloco de persona para a copy,
// descrição para a imagem, troca de avatar no Molde Vencedor e o roteiro para a IA sugerir o elenco e as fotos.
import type { LevaItem } from "./batch-strategist.ts";

export const TIPOS_AVATAR = {
  especialista: "Especialista (médica, nutricionista, técnica com autoridade)",
  profissional: "Profissional do ramo (quem trabalha com isso no dia a dia)",
  cliente: "Cliente comum / vizinha (gente como ela)",
  apresentadora: "Apresentadora / jornalista (tom de programa)",
  publico: "Persona do público (para quem a copy fala)",
} as const;
export type TipoAvatar = keyof typeof TIPOS_AVATAR;

/** Tipo oposto para o V02 do Molde (mesma frase, outra relação com quem assiste). */
export const OPOSTO: Record<Exclude<TipoAvatar, "publico">, Exclude<TipoAvatar, "publico">> = {
  especialista: "cliente",
  cliente: "especialista",
  profissional: "apresentadora",
  apresentadora: "profissional",
};

export interface Ficha {
  idade?: string | number | null;
  aparencia?: string | null;
  cenario?: string | null;
  frase?: string | null;
  dores?: string[];
  desejos?: string[];
  objecoes?: string[];
  linguagem?: string[];
}

export interface CastMember {
  id: string;
  nome: string;
  tipo: TipoAvatar | null;
  papel: "elenco" | "publico" | "ambos";
  ficha: Ficha;
  fotos: number;
  ativo: boolean;
}

/** Formatos em que ninguém aparece (o avatar não entra na arte). */
export const FORMATOS_SEM_ROSTO = new Set(["print_conversa", "infografico"]);

export const aparece = (m: CastMember) => m.ativo && (m.papel === "elenco" || m.papel === "ambos") && m.tipo !== "publico";
export const fala = (m: CastMember) => m.ativo && (m.papel === "publico" || m.papel === "ambos");

/**
 * Atribui um avatar do elenco a cada peça da leva: só onde alguém aparece; prefere quem já tem fotos (rosto
 * consistente); gira os tipos para a leva testar rostos diferentes; variações de um vencedor começam pelo avatar dele.
 * `overrides` (índice → avatar ou null) é a escolha manual de quem revisou a leva.
 */
export function assignAvatars(
  itens: ReadonlyArray<LevaItem>,
  cast: ReadonlyArray<CastMember>,
  opts: { vencedorAvatarId?: string | null; overrides?: Record<number, string | null> } = {},
): LevaItem[] {
  const pool = cast.filter(aparece).sort((a, b) => Number(b.fotos > 0) - Number(a.fotos > 0) || a.nome.localeCompare(b.nome));
  const byId = new Map(cast.map((m) => [m.id, m]));
  let k = 0;
  let variacao = 0;
  return itens.map((item, idx) => {
    const manual = opts.overrides && idx in opts.overrides ? opts.overrides[idx] : undefined;
    if (manual !== undefined) {
      const m = manual ? byId.get(manual) : undefined;
      return { ...item, avatar_id: m?.id ?? null, avatar_nome: m?.nome ?? null };
    }
    if (FORMATOS_SEM_ROSTO.has(item.formato) || !pool.length) return { ...item, avatar_id: null, avatar_nome: null };
    if (item.bloco === "variacao" && opts.vencedorAvatarId && variacao++ % 2 === 0 && byId.get(opts.vencedorAvatarId)) {
      const m = byId.get(opts.vencedorAvatarId)!;
      return { ...item, avatar_id: m.id, avatar_nome: m.nome };
    }
    const m = pool[k++ % pool.length];
    return { ...item, avatar_id: m.id, avatar_nome: m.nome };
  });
}

const lista = (xs?: string[]) => (xs ?? []).filter(Boolean).slice(0, 5).join("; ");

/** Bloco da persona do público para o prompt de copy: quem ela é, o que sente e as palavras dela. */
export function personaBlock(cast: ReadonlyArray<CastMember>): string {
  const ps = cast.filter(fala).slice(0, 2);
  if (!ps.length) return "";
  return ps.map((p) => {
    const f = p.ficha ?? {};
    return [
      `Persona do público: ${p.nome}${f.idade ? `, ${f.idade} anos` : ""}${f.cenario ? `, ${f.cenario}` : ""}.`,
      f.dores?.length ? `Dores: ${lista(f.dores)}.` : null,
      f.desejos?.length ? `Desejos: ${lista(f.desejos)}.` : null,
      f.objecoes?.length ? `Não acredita que: ${lista(f.objecoes)}.` : null,
      f.linguagem?.length ? `Palavras dela: "${(f.linguagem ?? []).slice(0, 4).join("\", \"")}".` : null,
      f.frase ? `Frase dela: "${f.frase}".` : null,
    ].filter(Boolean).join(" ");
  }).join("\n");
}

/** Descrição do avatar para a instrução de imagem (o rosto vem das fotos de referência). */
export function avatarImageLine(m: CastMember | null | undefined): string {
  if (!m) return "";
  const f = m.ficha ?? {};
  return [
    `Quem aparece: ${m.nome}${m.tipo ? ` (${TIPOS_AVATAR[m.tipo]})` : ""}${f.idade ? `, ${f.idade} anos` : ""}.`,
    f.aparencia ? `Aparência: ${f.aparencia}.` : null,
    f.cenario ? `Cenário típico: ${f.cenario}.` : null,
    m.fotos > 0 ? "Use as primeiras imagens anexas como referência do ROSTO desta pessoa: mesmo rosto, mesmos traços, sem deformar." : null,
  ].filter(Boolean).join(" ");
}

/** Avatar sugerido para o Molde: V01 = outro do mesmo tipo; V02 = tipo oposto. */
export function moldAvatar(variacao: string, atualId: string | null, cast: ReadonlyArray<CastMember>): CastMember | null {
  const atual = cast.find((m) => m.id === atualId);
  const pool = cast.filter((m) => aparece(m) && m.id !== atualId);
  if (!pool.length) return null;
  if (variacao === "V01") return pool.find((m) => m.tipo && m.tipo === atual?.tipo) ?? null;
  if (variacao === "V02" || variacao === "V04") {
    const alvo = atual?.tipo && atual.tipo !== "publico" ? OPOSTO[atual.tipo] : null;
    return pool.find((m) => m.tipo === alvo) ?? pool.find((m) => m.tipo !== atual?.tipo) ?? null;
  }
  return null;
}

// ─── Sugerir o elenco por IA ────────────────────────────────────────────────

export interface CastSuggestionInput { projeto: string; produto?: string | null; publico?: string | null; contexto?: string | null; quantidade?: number }

export function castSuggestPrompt(i: CastSuggestionInput): { system: string; user: string } {
  const n = Math.max(3, Math.min(6, i.quantidade ?? 5));
  return {
    system: [
      "Você monta o elenco de criativos de anúncio de resposta direta no Brasil.",
      "Responda SÓ JSON: {\"avatares\":[{\"nome\":string,\"tipo\":\"especialista\"|\"profissional\"|\"cliente\"|\"apresentadora\"|\"publico\",\"papel\":\"elenco\"|\"publico\"|\"ambos\",\"ficha\":{\"idade\":string,\"aparencia\":string,\"cenario\":string,\"frase\":string,\"dores\":[string],\"desejos\":[string],\"objecoes\":[string],\"linguagem\":[string]}}]}.",
      "Inclua 1 ou 2 avatares de papel \"publico\" (para quem a copy fala, tipo \"publico\") e o resto de papel \"elenco\" com tipos variados (especialista, profissional, cliente, apresentadora) para testar rostos diferentes.",
      "Pessoas fictícias e comuns, brasileiras, diversas em idade, tom de pele e cabelo; nenhuma parecida com famosos. Nome só o primeiro nome.",
      "aparencia: o suficiente para gerar uma foto realista (idade aparente, cabelo, roupa, expressão). linguagem: frases curtas como ela fala de verdade.",
    ].join(" "),
    user: [
      `Projeto: ${i.projeto}`,
      i.produto ? `Produto/oferta: ${i.produto}` : null,
      i.publico ? `Público: ${i.publico}` : null,
      i.contexto ? `Contexto: ${i.contexto.slice(0, 1500)}` : null,
      `Quantidade total de avatares: ${n}`,
    ].filter(Boolean).join("\n"),
  };
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const strs = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean).slice(0, 8) : []);

export interface SuggestedAvatar { nome: string; tipo: TipoAvatar; papel: CastMember["papel"]; ficha: Ficha }

export function parseCastSuggestion(raw: unknown): SuggestedAvatar[] {
  let o: Record<string, unknown>;
  try { o = typeof raw === "string" ? JSON.parse(raw.replace(/^```(json)?|```$/g, "").trim()) : (raw as Record<string, unknown>); } catch { return []; }
  const list = Array.isArray(o?.avatares) ? o.avatares as Array<Record<string, unknown>> : [];
  return list.flatMap((a) => {
    const nome = str(a.nome);
    const tipo = str(a.tipo) as TipoAvatar;
    const papel = (["elenco", "publico", "ambos"].includes(str(a.papel)) ? str(a.papel) : "elenco") as CastMember["papel"];
    if (!nome || !(tipo in TIPOS_AVATAR)) return [];
    const f = (a.ficha && typeof a.ficha === "object" ? a.ficha : {}) as Record<string, unknown>;
    return [{ nome: nome.slice(0, 40), tipo, papel: tipo === "publico" ? "publico" : papel, ficha: {
      idade: str(f.idade) || null, aparencia: str(f.aparencia) || null, cenario: str(f.cenario) || null, frase: str(f.frase) || null,
      dores: strs(f.dores), desejos: strs(f.desejos), objecoes: strs(f.objecoes), linguagem: strs(f.linguagem),
    } }];
  }).slice(0, 8);
}

/** Fotos de referência: um retrato base e variações da mesma pessoa (usam o retrato base como referência). */
export function portraitPrompts(m: Pick<CastMember, "nome" | "tipo" | "ficha">, quantidade = 4): { base: string; variacoes: string[] } {
  const f = m.ficha ?? {};
  const quem = `${m.nome}, ${f.idade ? `${f.idade} anos, ` : ""}${f.aparencia ?? "pessoa brasileira comum"}`;
  const base = [
    `Retrato fotográfico realista de ${quem}.`,
    `Enquadramento do peito para cima, olhando para a câmera, expressão natural, fundo neutro levemente desfocado, luz suave de janela.`,
    "Pele com textura real, sem filtro de beleza, mãos e rosto naturais. Sem texto, sem logo, sem marca d'água.",
  ].join(" ");
  const cenas = [
    `no cenário dela: ${f.cenario ?? "ambiente de trabalho do dia a dia"}, plano médio, olhando para a câmera`,
    "selfie de celular segurada com o braço, luz natural, sorriso leve",
    "de perfil três quartos, falando com alguém fora do quadro, expressão concentrada",
    "close do rosto com emoção (preocupação ou alívio), luz lateral",
    "de corpo inteiro em pé no cenário dela, roupa do dia a dia",
  ];
  return {
    base,
    variacoes: cenas.slice(0, Math.max(0, Math.min(5, quantidade - 1))).map((c) => `A MESMA pessoa da imagem de referência (mesmo rosto, cabelo e traços exatos), ${c}. Fotografia realista, sem texto, sem logo.`),
  };
}

export interface CastRow { id: string; nome: string; tipo: string | null; papel: string | null; ficha: unknown; avatar_photos: unknown; ativo: boolean | null }

/** Linha de imphq_avatar_studio_projects → membro do elenco (fotos = quantas referências de rosto existem). */
export function castFromRows(rows: ReadonlyArray<CastRow>): CastMember[] {
  return rows.map((r) => ({
    id: r.id,
    nome: r.nome,
    tipo: r.tipo && r.tipo in TIPOS_AVATAR ? (r.tipo as TipoAvatar) : null,
    papel: (["elenco", "publico", "ambos"].includes(String(r.papel)) ? r.papel : "elenco") as CastMember["papel"],
    ficha: (r.ficha && typeof r.ficha === "object" ? r.ficha : {}) as Ficha,
    fotos: Array.isArray(r.avatar_photos) ? r.avatar_photos.length : 0,
    ativo: r.ativo !== false,
  }));
}

/** Caminhos das fotos de referência (bucket privado avatar-refs) e links externos, na ordem gravada. */
export function photoRefs(avatarPhotos: unknown): Array<{ path: string; url: string }> {
  return Array.isArray(avatarPhotos)
    ? avatarPhotos.flatMap((p) => (p && typeof p === "object" && typeof (p as { path?: unknown }).path === "string" ? [{ path: String((p as { path: string }).path), url: String((p as { url?: unknown }).url ?? "") }] : []))
    : [];
}

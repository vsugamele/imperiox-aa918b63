// Guardrails de público-alvo compartilhados.
// Deriva público + palavras proibidas a partir do projeto (avatar/produto/branding)
// e gera bloco de sistema + validador determinístico.
//
// Uso: import { deriveAudienceGuardrails, buildGuardBlock, findForbiddenHits } from "../_shared/audience-guardrails.ts";

export interface DerivedGuardrails {
  publico: string;
  naoPublico: string;
  palavrasProibidas: string[];
}

/**
 * Deriva guardrails a partir dos dados do projeto e (opcionalmente) do produto.
 * Aceita `imphq_projects.data` (objeto) e slug/nome do produto.
 */
export function deriveAudienceGuardrails(
  projectData: any,
  productSlugOrName?: string,
  overrides?: Partial<DerivedGuardrails>,
): DerivedGuardrails {
  const d: any = projectData || {};
  const avatar = d.avatar || d.avatars_por_produto || {};
  const produtos: any[] = Array.isArray(d.produtos) ? d.produtos : [];
  const prod = productSlugOrName
    ? produtos.find((p) => p?.nome === productSlugOrName || p?.slug === productSlugOrName)
    : produtos[0];

  // Público: overrides > concat(avatar, produto.publico_alvo, nicho)
  let publico = (overrides?.publico || "").trim();
  if (!publico) {
    const parts = [
      typeof avatar === "string"
        ? avatar
        : (avatar?.descricao || avatar?.retrato || avatar?.perfil_psicologico?.retrato || ""),
      prod?.publico_alvo || prod?.avatar || "",
      d.nicho || "",
    ].filter(Boolean);
    publico = parts.join(" — ").slice(0, 600);
  }

  const naoPublico = (overrides?.naoPublico || d.nao_publico || "").trim();

  // Heurísticas de palavras proibidas baseadas em segmento detectado
  const blob = `${publico} ${prod?.nome || ""} ${prod?.descricao || ""} ${
    JSON.stringify(avatar).slice(0, 800)
  }`.toLowerCase();

  const auto: string[] = [];
  const hasCacheado = /cachead|crespo|ondulad|4[abc]|3[abc]/i.test(blob);
  const hasFeminino = /mulher|feminin|elas\b/i.test(blob);
  const hasLiso = /liso|smooth/i.test(blob) && !hasCacheado;
  const hasTatuagem = /tatuage|tattoo|tatuad/i.test(blob);
  const hasBarba = /barb[ea]/i.test(blob);
  const hasPetShop = /\bpet\b|c[ãa]es?|gatos?|cachorr/i.test(blob);

  if (hasCacheado || hasFeminino) {
    auto.push("barbeiro", "barbearia", "corte masculino", "barba");
    if (hasCacheado) auto.push("cabelo liso", "chapinha");
  }
  if (hasLiso) auto.push("cachead", "crespo");
  if (hasTatuagem) auto.push("barbeiro", "cabeleireiro");
  if (hasBarba && !hasCacheado && !hasFeminino) auto.push("cachead", "crespo", "feminin");
  if (hasPetShop) auto.push("humano", "pessoas", "clientes homens");

  // Sobrescritas manuais do projeto
  const manual: string[] = Array.isArray(d.palavras_proibidas)
    ? d.palavras_proibidas.map((s: any) => String(s).toLowerCase())
    : [];

  const override: string[] = Array.isArray(overrides?.palavrasProibidas)
    ? (overrides!.palavrasProibidas as string[]).map((s) => String(s).toLowerCase())
    : [];

  const palavrasProibidas = Array.from(
    new Set([...override, ...manual, ...auto].map((s) => s.trim()).filter(Boolean)),
  );

  return { publico, naoPublico, palavrasProibidas };
}

/** Bloco de sistema pronto para injetar no prompt. Vazio quando nada foi derivado. */
export function buildGuardBlock(g: DerivedGuardrails): string {
  if (!g.publico && !g.naoPublico && !g.palavrasProibidas.length) return "";
  return `

## REGRA CRÍTICA DE PÚBLICO (INVIOLÁVEL)
Você fala EXCLUSIVAMENTE com o público descrito abaixo. Qualquer headline, ângulo, exemplo ou linguagem que se dirija a outro público é INVÁLIDO e será rejeitado.
${g.publico ? `- PÚBLICO ALVO (do projeto): ${g.publico}` : ""}
${g.naoPublico ? `- PÚBLICO QUE NÃO É (proibido citar/aludir): ${g.naoPublico}` : ""}
${g.palavrasProibidas.length ? `- PALAVRAS/TERMOS PROIBIDOS (NUNCA use em headlines, corpo, CTA): ${g.palavrasProibidas.join(", ")}` : ""}
Se você não tiver certeza sobre um termo, prefira linguagem neutra que caiba no público-alvo. Nunca invente estereótipos.`;
}

/** Retorna a lista de palavras proibidas encontradas em um texto. */
export function findForbiddenHits(text: string, palavrasProibidas: string[]): string[] {
  const blob = (text || "").toLowerCase();
  return palavrasProibidas.filter((p) => p && blob.includes(p));
}

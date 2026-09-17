// Shared validators for openflow-ai wizard.
// Consumed by index.ts runtime and by wizard_contract_test.ts.

import { ALL_SLUGS, ANGLE_BY_SLUG, selectAnglesForBrief } from "../_shared/creativeAngles.ts";

export interface AngleOut {
  slug: string;
  headline: string;
  corpo: string;
  cta: string;
  nome?: string;
  gatilho?: string;
  emocao_dominante?: string;
  risk_warning?: string;
  [k: string]: unknown;
}

const RISKY_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /r\$\s?\d/i, label: "menciona valor monetário específico" },
  { re: /\b\d+\s?dias?\b/i, label: "prazo específico em dias" },
  { re: /\bgarantid[oa]s?\b/i, label: "usa 'garantido'" },
  { re: /\bcura\b/i, label: "usa 'cura'" },
  { re: /\b100\s?%/i, label: "usa '100%'" },
  { re: /\bsem esfor[çc]o\b/i, label: "'sem esforço'" },
];

export function detectRiskyClaim(text: string): string | undefined {
  const s = (text || "").toLowerCase();
  const hits = RISKY_PATTERNS.filter((p) => p.re.test(s)).map((p) => p.label);
  return hits.length ? `Claim arriscado: ${hits.join(", ")}` : undefined;
}

/**
 * Valida e higieniza a lista de ângulos:
 * - remove slugs inválidos
 * - deduplica emoção dominante (mantém o primeiro)
 * - dropa itens com headline/corpo/cta vazios
 * - sinaliza risk_warning
 * - completa com selectAnglesForBrief se sobrar < min
 */
export function validateAndFixAngles(
  raw: AngleOut[] | undefined | null,
  opts: { min?: number; seed?: string } = {},
): { angles: AngleOut[]; drops: string[] } {
  const min = opts.min ?? 3;
  const drops: string[] = [];
  const seenEmocao = new Set<string>();
  const out: AngleOut[] = [];

  for (const a of raw || []) {
    if (!a || typeof a !== "object") { drops.push("item não-objeto"); continue; }
    const cat = ANGLE_BY_SLUG[a.slug];
    if (!cat) { drops.push(`slug inválido: ${a.slug}`); continue; }
    if (!a.headline?.trim() || !a.corpo?.trim() || !a.cta?.trim()) {
      drops.push(`campos vazios em ${a.slug}`); continue;
    }
    if (seenEmocao.has(cat.emocaoDominante)) {
      drops.push(`emoção "${cat.emocaoDominante}" duplicada (slug ${a.slug})`);
      continue;
    }
    seenEmocao.add(cat.emocaoDominante);
    const risk = detectRiskyClaim(`${a.headline} ${a.corpo}`);
    out.push({
      ...a,
      nome: cat.nome,
      gatilho: cat.gatilho,
      emocao_dominante: cat.emocaoDominante,
      ...(risk ? { risk_warning: risk } : {}),
    });
  }

  // Auto-preenche lacunas com placeholders do catálogo
  if (out.length < min) {
    const usedSlugs = new Set(out.map((a) => a.slug));
    const usedEmocoes = new Set(out.map((a) => a.emocao_dominante));
    const pool = selectAnglesForBrief(ALL_SLUGS.length, opts.seed || "");
    for (const cat of pool) {
      if (out.length >= min) break;
      if (usedSlugs.has(cat.slug)) continue;
      if (usedEmocoes.has(cat.emocaoDominante)) continue;
      out.push({
        slug: cat.slug,
        headline: cat.exemploHook,
        corpo: cat.descricao,
        cta: "saiba mais",
        nome: cat.nome,
        gatilho: cat.gatilho,
        emocao_dominante: cat.emocaoDominante,
        risk_warning: "auto-preenchido do catálogo (revisar copy)",
      });
      usedSlugs.add(cat.slug);
      usedEmocoes.add(cat.emocaoDominante);
    }
  }

  return { angles: out, drops };
}

export async function withRetry<T>(fn: () => Promise<T>, tries = 2, backoffMs = 400): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      if (i < tries - 1) await new Promise((r) => setTimeout(r, backoffMs * (i + 1)));
    }
  }
  throw lastErr;
}

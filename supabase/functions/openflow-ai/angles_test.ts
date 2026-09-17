// Contract test — Fase 1 do openflow-ai deve retornar ângulos válidos do catálogo canônico
// com headline/corpo/cta preenchidos e sem repetir a mesma emoção dominante.

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ALL_SLUGS, ANGLE_BY_SLUG } from "../_shared/creativeAngles.ts";

// Simula a saída que a Fase 1 (intel_analysis) deve produzir
type AngleOut = { slug: string; headline: string; corpo: string; cta: string };

function validateAnglesContract(angles: AngleOut[]) {
  assert(Array.isArray(angles), "angles deve ser array");
  assert(angles.length >= 3, `esperado >=3 ângulos, veio ${angles.length}`);

  const emocoes = new Set<string>();
  for (const a of angles) {
    assert(ALL_SLUGS.includes(a.slug), `slug inválido: ${a.slug}`);
    assert(a.headline && a.headline.trim().length > 0, `headline vazia em ${a.slug}`);
    assert(a.corpo && a.corpo.trim().length > 0, `corpo vazio em ${a.slug}`);
    assert(a.cta && a.cta.trim().length > 0, `cta vazio em ${a.slug}`);
    const emocao = ANGLE_BY_SLUG[a.slug].emocaoDominante;
    assert(!emocoes.has(emocao), `emoção "${emocao}" repetida (slug ${a.slug})`);
    emocoes.add(emocao);
  }
}

Deno.test("contract: catálogo canônico tem 11 ângulos com metadados completos", () => {
  assertEquals(ALL_SLUGS.length, 11);
  for (const slug of ALL_SLUGS) {
    const a = ANGLE_BY_SLUG[slug];
    assert(a.nome && a.gatilho && a.emocaoDominante, `metadados incompletos em ${slug}`);
    assert(a.quandoUsar && a.estrutura, `documentação incompleta em ${slug}`);
    assert(a.errosComuns.length >= 2, `errosComuns insuficientes em ${slug}`);
  }
});

Deno.test("contract: Fase 1 output — payload válido passa", () => {
  const valid: AngleOut[] = [
    { slug: "curiosidade", headline: "Tem um detalhe que muda tudo…", corpo: "…", cta: "veja no vídeo" },
    { slug: "controversia", headline: "90% dos gurus estão errados", corpo: "…", cta: "descubra por quê" },
    { slug: "prova", headline: "1.847 pessoas em 90 dias", corpo: "…", cta: "entre na turma" },
    { slug: "promessa", headline: "30 dias ou devolvo cada centavo", corpo: "…", cta: "comece hoje" },
  ];
  validateAnglesContract(valid);
});

Deno.test("contract: rejeita slug inválido", () => {
  const bad: AngleOut[] = [
    { slug: "inventado", headline: "x", corpo: "y", cta: "z" },
    { slug: "prova", headline: "x", corpo: "y", cta: "z" },
    { slug: "promessa", headline: "x", corpo: "y", cta: "z" },
  ];
  let threw = false;
  try { validateAnglesContract(bad); } catch { threw = true; }
  assert(threw, "deveria ter rejeitado slug inventado");
});

Deno.test("contract: rejeita emoção duplicada", () => {
  // prova e objecao compartilham emoção 'alivio'
  const dup: AngleOut[] = [
    { slug: "prova", headline: "x", corpo: "y", cta: "z" },
    { slug: "objecao", headline: "x", corpo: "y", cta: "z" },
    { slug: "promessa", headline: "x", corpo: "y", cta: "z" },
  ];
  let threw = false;
  try { validateAnglesContract(dup); } catch { threw = true; }
  assert(threw, "deveria ter rejeitado emoção duplicada");
});

Deno.test("contract: rejeita headline/corpo/cta vazio", () => {
  const empty: AngleOut[] = [
    { slug: "curiosidade", headline: "", corpo: "y", cta: "z" },
    { slug: "prova", headline: "x", corpo: "y", cta: "z" },
    { slug: "promessa", headline: "x", corpo: "y", cta: "z" },
  ];
  let threw = false;
  try { validateAnglesContract(empty); } catch { threw = true; }
  assert(threw, "deveria ter rejeitado headline vazia");
});

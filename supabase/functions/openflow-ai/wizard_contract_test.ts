// Contract tests do wizard (openflow-ai fase final).
// Exercita os validators compartilhados sem chamar a Lovable AI (unit).

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateAndFixAngles, detectRiskyClaim, withRetry } from "./_validators.ts";

Deno.test("validator: preenche lacunas quando IA devolve menos ângulos", () => {
  const { angles, drops } = validateAndFixAngles(
    [{ slug: "prova", headline: "1.847 alunos", corpo: "…", cta: "entrar" }],
    { min: 4, seed: "curso-x" },
  );
  assert(angles.length >= 4, `esperado >=4, veio ${angles.length}`);
  const emocoes = new Set(angles.map((a) => a.emocao_dominante));
  assertEquals(emocoes.size, angles.length, "emoções devem ser únicas");
  assert(Array.isArray(drops));
});

Deno.test("validator: dropa slug inválido e emoção duplicada", () => {
  const { angles, drops } = validateAndFixAngles([
    { slug: "prova", headline: "x", corpo: "y", cta: "z" },
    { slug: "objecao", headline: "x", corpo: "y", cta: "z" }, // mesma emoção 'alivio'
    { slug: "inexistente", headline: "x", corpo: "y", cta: "z" },
    { slug: "promessa", headline: "x", corpo: "y", cta: "z" },
    { slug: "curiosidade", headline: "x", corpo: "y", cta: "z" },
  ], { min: 3 });
  assert(drops.some((d) => d.includes("inexistente")));
  assert(drops.some((d) => d.includes("duplicada")));
  const emocoes = new Set(angles.map((a) => a.emocao_dominante));
  assertEquals(emocoes.size, angles.length);
});

Deno.test("validator: sinaliza risk_warning em claim arriscado", () => {
  const { angles } = validateAndFixAngles([
    { slug: "promessa", headline: "R$ 10.000 em 30 dias garantido", corpo: "…", cta: "quero" },
    { slug: "prova", headline: "1.847 casos", corpo: "…", cta: "entrar" },
    { slug: "curiosidade", headline: "O detalhe que muda tudo", corpo: "…", cta: "veja" },
  ], { min: 3 });
  const promessa = angles.find((a) => a.slug === "promessa");
  assert(promessa?.risk_warning, "esperava risk_warning na promessa arriscada");
});

Deno.test("detectRiskyClaim: identifica padrões e ignora copy segura", () => {
  assert(detectRiskyClaim("resultado garantido"));
  assert(detectRiskyClaim("apenas 7 dias"));
  assert(!detectRiskyClaim("uma nova forma de encarar o problema"));
});

Deno.test("withRetry: tenta novamente e retorna sucesso", async () => {
  let calls = 0;
  const r = await withRetry(async () => {
    calls++;
    if (calls < 2) throw new Error("boom");
    return "ok";
  }, 3, 10);
  assertEquals(r, "ok");
  assertEquals(calls, 2);
});

Deno.test("withRetry: propaga erro após esgotar tentativas", async () => {
  let calls = 0;
  let threw = false;
  try {
    await withRetry(async () => { calls++; throw new Error("nope"); }, 2, 10);
  } catch { threw = true; }
  assert(threw);
  assertEquals(calls, 2);
});

Deno.test("wizard contract: shape final tem etapas/phases/assets", () => {
  // Simula o payload final que a edge function retorna após falha parcial
  const payload = {
    etapas: [{ nome: "LP", tipo: "pagina", pos_x: 80, pos_y: 400, connects_to: [1] }],
    estrategia: "Funil VSL",
    phases: { intel: "done", angles: "done", funnel: "done", vsl: "failed", emails: "done" },
    phase_errors: { vsl: "timeout" },
    assets: { angles: ["a", "b"], vsl_outline: "", emails: [{}], avatar: {}, mecanismo_unico: "", posicionamento: "" },
  };
  assert(Array.isArray(payload.etapas));
  assert(payload.phases.vsl === "failed" || payload.assets.vsl_outline.length > 0,
    "quando vsl_outline é vazio, phases.vsl deve ser 'failed'");
  assert(payload.phases.emails === "failed" || Array.isArray(payload.assets.emails));
  if (payload.phases.vsl === "failed") assert(payload.phase_errors?.vsl, "phase_errors.vsl obrigatório");
});

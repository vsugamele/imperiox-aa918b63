import { describe, expect, it } from "vitest";
import { parseAvatarHTML, getImportSummary } from "@/components/projeto/avatar/avatar-html-parser";

describe("avatar HTML imports", () => {
  it("preserves V2 desire tags and dynamically named sub-avatar fields", () => {
    const avatar = parseAvatarHTML(`<section id="desejos-b2"><div class="desire-card"><span class="desire-name">Rotina consistente</span><span class="desire-score-badge">8.5</span><div class="desire-body"><p>Uma rotina possível</p></div><div class="desire-meta"><span class="tag">cotidiano</span></div></div></section><div class="sub-card"><div class="sub-card-name">Perfil A</div><div class="sub-field"><span class="sub-field-label">Rotina semanal</span><span class="sub-field-value">Turnos alternados</span></div></div>`);
    expect(avatar.desejos_externos).toEqual([{ rank: "1", nome: "Rotina consistente", score: 8.5, justificativa: "", descricao: "Uma rotina possível", tags: ["cotidiano"] }]);
    expect(avatar.desejo_externo).toBe("Rotina consistente");
    expect(avatar.sub_avatares).toEqual([{ nome: "Perfil A", urgencia: 3, dinheiro: 3, rotina_semanal: "Turnos alternados" }]);
    expect(getImportSummary(avatar)).toContainEqual({ label: "Sub-Avatares", count: 1, emoji: "🧠" });
  });

  it("imports score columns without changing headers or including divider rows", () => {
    const avatar = parseAvatarHTML(`<table class="score-table"><thead><tr><th>Problema</th><th>Dor</th><th>Freq.</th><th>Total</th></tr></thead><tbody><tr><td colspan="4">Grupo</td></tr><tr><td><span class="rank-badge">#2</span>Falta de rotina</td><td><span class="sc-val">8</span></td><td>6</td><td>14</td></tr></tbody></table>`);
    expect(avatar.problemas).toEqual([{ rank: 2, nome: "Falta de rotina", total: 14, scores: { dor: 8, freq_: 6 } }]);
  });
});

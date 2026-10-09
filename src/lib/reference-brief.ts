// Transforma a dissecação de uma referência (imphq_referencias.analise) num briefing de modelagem
// para o copy-engine (intent "modelar_referencia"). Puro: sem React nem Supabase, para dar para testar.

export interface RefTranscriptLine { start: number; end: number; text: string }
export interface RefAnatomyBlock { kind: string; start: number; end: number; label: string; purpose: string }

export interface RefForBrief {
  titulo: string;
  transcricao?: string | null;
  duracao?: number | null;
  analise?: {
    editorial?: { primaryNiche?: string; topic?: string; format?: string; copyOperation?: string; payoff?: string; ctaObserved?: string; transfer?: string } | null;
    anatomy?: { intent?: string; cta_mode?: string; blocks?: RefAnatomyBlock[] } | null;
    transcript?: RefTranscriptLine[];
    awareness_level?: string | null;
    angle_family?: string | null;
    angle_lens?: string | null;
    belief_shift?: { from: string; to: string } | null;
    quality_score?: number | null;
    copy?: { gancho?: string | null; mecanismo?: string | null; vilao?: string | null; promessa?: string | null; prova?: string | null; cta?: string | null } | null;
    cenas?: Array<{ seconds: number; descricao: string }> | null;
  } | null;
}

export type FormatoRoteiro = "comment_dm" | "ugc" | "mini_vsl" | "estatico";

export const FORMATOS: Array<{ id: FormatoRoteiro; label: string; instrucao: string }> = [
  {
    id: "comment_dm",
    label: "Comment-to-DM (Reels/TikTok)",
    instrucao: `FORMATO: Reels/TikTok orgânico 9:16, 30–45s, framework Comment-to-DM.
- Batize um par de mecanismos: VILÃO (causa oculta) + SOLUÇÃO (nome curto e curioso).
- 3 ganchos alternativos para 0–3s.
- Roteiro segundo a segundo em tabela: Tempo | Fala | Tela/legenda.
- Ponto de tensão: entregue o problema por completo, segure a solução para a DM.
- CTA final: "comenta [PALAVRA] que eu te mando".
- Árvore da DM com 4 mensagens. Qualifique antes de oferecer; a oferta só entra na 4ª.`,
  },
  {
    id: "ugc",
    label: "UGC Talking Head (anúncio pago)",
    instrucao: `FORMATO: anúncio pago UGC talking-head 9:16, 20–35s, uma pessoa falando para a câmera.
- Tem que soar como pessoa real contando, nunca como anúncio.
- 3 ganchos alternativos para 0–3s.
- Roteiro em tabela: Tempo | Fala | Ação/enquadramento.
- Inclua: perfil do ator (idade, cenário, figurino) e o primeiro frame.`,
  },
  {
    id: "mini_vsl",
    label: "Mini VSL / Storytelling (60–120s)",
    instrucao: `FORMATO: mini VSL narrada, 60–120s.
- 3 ganchos alternativos.
- Roteiro em tabela: Tempo | Narração | B-roll/tela, seguindo os mesmos blocos da referência (história → virada → mecanismo → prova → CTA).`,
  },
  {
    id: "estatico",
    label: "Estático / Native (texto longo + imagem)",
    instrucao: `FORMATO: anúncio estático nativo.
- Texto principal longo (primary text) com o mesmo arco de blocos da referência.
- 3 primeiras linhas alternativas (scroll stoppers) e 3 headlines.
- Conceito da imagem: cena, enquadramento, texto na arte (se houver) e por que para o scroll.`,
  },
];

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** Dossiê legível da referência (o que o modelo precisa para entender POR QUE ela funciona). */
export function buildReferenceDossier(ref: RefForBrief): string {
  const a = ref.analise ?? {};
  const out: string[] = [`Título: ${ref.titulo}`];
  if (ref.duracao) out.push(`Duração: ${Math.round(ref.duracao)}s`);
  const e = a.editorial;
  if (e?.primaryNiche || e?.format) out.push(`Nicho/formato: ${[e?.primaryNiche, e?.format].filter(Boolean).join(" · ")}`);
  if (a.awareness_level) out.push(`Nível de consciência: ${a.awareness_level}`);
  if (a.angle_family || a.angle_lens) out.push(`Ângulo: ${[a.angle_family, a.angle_lens].filter(Boolean).join(" — ")}`);
  if (a.belief_shift?.from) out.push(`Virada de crença: "${a.belief_shift.from}" → "${a.belief_shift.to}"`);
  if (typeof a.quality_score === "number") out.push(`Nota de qualidade: ${a.quality_score}/10`);

  const c = a.copy;
  const copyRows = c ? ([["Gancho", c.gancho], ["Vilão", c.vilao], ["Mecanismo", c.mecanismo], ["Promessa", c.promessa], ["Prova", c.prova], ["CTA", c.cta]] as const).filter(([, v]) => v) : [];
  if (copyRows.length) out.push("", "## Dossiê da copy", ...copyRows.map(([k, v]) => `- ${k}: ${v}`));

  const blocks = a.anatomy?.blocks ?? [];
  if (blocks.length) {
    out.push("", `## Anatomia (${blocks.length} blocos${a.anatomy?.cta_mode ? `, CTA ${a.anatomy.cta_mode}` : ""})`);
    blocks.forEach((b) => out.push(`- [${fmt(b.start)}–${fmt(b.end)}] ${b.kind.toUpperCase()} · ${b.label}: ${b.purpose}`));
  }

  const cenas = a.cenas ?? [];
  if (cenas.length) {
    out.push("", "## Cenas (visual)");
    cenas.forEach((s) => out.push(`- ${fmt(s.seconds)} ${s.descricao}`));
  }

  if (e?.copyOperation || e?.transfer) {
    out.push("", "## Leitura editorial");
    if (e.copyOperation) out.push(`- Estrutura: ${e.copyOperation}`);
    if (e.transfer) out.push(`- O que aproveitar: ${e.transfer}`);
  }

  const lines = a.transcript ?? [];
  const transcript = lines.length ? lines.map((l) => `[${fmt(l.start)}] ${l.text}`).join("\n") : (ref.transcricao ?? "").trim();
  if (transcript) out.push("", "## Transcrição", transcript.slice(0, 6000));
  return out.join("\n");
}

/** Input completo para o copy-engine (intent modelar_referencia). */
export function buildModelingInput(ref: RefForBrief, formato: FormatoRoteiro, produto: string, extra?: string): string {
  const f = FORMATOS.find((x) => x.id === formato) ?? FORMATOS[0];
  return [
    `# PRODUTO DE DESTINO\n${produto}`,
    `# ${f.instrucao}`,
    extra?.trim() ? `# OBSERVAÇÕES DO USUÁRIO\n${extra.trim()}` : "",
    `# REFERÊNCIA VENCEDORA (dissecada)\n${buildReferenceDossier(ref)}`,
  ].filter(Boolean).join("\n\n");
}

export function hasDissection(ref: RefForBrief): boolean {
  const a = ref.analise;
  return !!a && ((a.anatomy?.blocks?.length ?? 0) > 0 || (a.transcript?.length ?? 0) > 0 || !!a.copy);
}

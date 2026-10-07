// Operador diário (OPR1.1): junta o que o MCP já sabe de cada projeto (get_briefing + get_live_panel) numa rodada
// priorizada para o grupo Imperio X. TS puro: a function operator-round só busca os dados e envia o texto.
// A v1 não executa decisão: quase tudo que mexe em algo real está no nível "aprovar" (autonomy.ts). Ela prioriza,
// cobra quem está devendo e numera as decisões para o time responder (OPR1.2: "ok 1" no grupo).

/** O que o operador lê do get_briefing (formato do MCP). */
export interface OperatorBriefing {
  alertas?: Array<{ nivel: "critico" | "atencao"; texto: string }>;
  aprovacoes?: { total: number; primeiras: Array<{ key: string; origem: string; titulo: string; esperando_ha: string; precisa_ok_de_alguem: string[]; decisao_pelo_mcp: string[]; link: string }> };
  etapas?: { lista_atrasadas: Array<{ etapa: string; responsavel: string | null; prazo: string | null; link: string }> } | null;
  diario?: Array<{ quando: string; acao: string; quem: string | null; o_que: string | null }>;
}

/** O que o operador lê do get_live_panel. */
export interface OperatorLive {
  moeda: string;
  parcial: {
    gasto: { valor: number | null };
    faturamento: { valor: number | null };
    vendas: { valor: number | null };
    cpa: { valor: number | null; zona: string | null; zona_label: string | null; alvo: number | null };
    roas: { valor: number | null };
  };
  alertas: string[];
}

export interface OperatorProject { id: string; name: string; briefing: OperatorBriefing | null; live: OperatorLive | null }

export type OperatorItemKind = "dinheiro" | "decisao" | "atraso";
export interface OperatorItem {
  /** Número para responder no grupo (só decisões). */
  n: number | null;
  projeto: string;
  tipo: OperatorItemKind;
  texto: string;
  /** Chave da fila (decide_approval) quando é decisão. */
  key: string | null;
}

export interface OperatorRound {
  itens: OperatorItem[];
  /** Texto pronto para o WhatsApp; vazio quando não há nada a dizer. */
  texto: string;
  /** Impressão digital do conteúdo, para não repetir a mesma rodada. */
  assinatura: string;
  feitos_pela_ia: number;
}

/** Atores que não são gente do time (registros feitos pela IA, pelo bot ou pelo sistema). */
const AI_ACTOR = /\b(ia|bot|sistema|ai|jev|imperius|operador)\b/i;
const MAX_DECISIONS = 3;
const MAX_LATE = 3;

function money(v: number | null, cur: string) {
  if (v === null) return "—";
  try { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: cur }).format(v); } catch { return `${cur} ${v.toFixed(2)}`; }
}

/** Itens de dinheiro em risco: CPA fora do alvo, rastreio divergente e alertas críticos do resumo. */
function moneyItems(p: OperatorProject): string[] {
  const out: string[] = [];
  const live = p.live;
  if (live) {
    const cpa = live.parcial.cpa;
    const vendas = live.parcial.vendas.valor ?? 0;
    if ((cpa.zona === "prejuizo" || cpa.zona === "magra") && vendas >= 3) {
      out.push(`CPA ${money(cpa.valor, live.moeda)} (${cpa.zona_label}) com ${vendas} vendas hoje${cpa.alvo ? `, alvo ${money(cpa.alvo, live.moeda)}` : ""} — rever verba e anúncios`);
    }
    const gasto = live.parcial.gasto.valor ?? 0;
    if (gasto > 0 && vendas === 0 && cpa.alvo && gasto >= cpa.alvo) {
      out.push(`Gasto ${money(gasto, live.moeda)} hoje e nenhuma venda (já passou do CPA alvo ${money(cpa.alvo, live.moeda)})`);
    }
    const divergencia = live.alertas.find((a) => a.startsWith("Pixel da Meta"));
    if (divergencia) out.push(divergencia);
  }
  for (const a of p.briefing?.alertas ?? []) {
    // Prazo vencido e fila parada já viram itens próprios (atraso e decisão); aqui só o que é dinheiro ou fonte.
    if (/prazo vencido|fila Aprovar/i.test(a.texto)) continue;
    out.push(a.texto);
  }
  return out;
}

/**
 * Monta a rodada: por projeto, dinheiro em risco → decisões numeradas (as que precisam de OK, mais antigas primeiro)
 * → atrasos por dono. Projeto sem nada fica de fora. `since` limita a contagem do que a IA fez desde a última rodada.
 */
export function planOperatorRound(projects: ReadonlyArray<OperatorProject>, opts: { since: string; label: string; appUrl: string }): OperatorRound {
  const itens: OperatorItem[] = [];
  const blocks: string[] = [];
  let n = 0;
  let feitosTotal = 0;

  for (const p of projects) {
    const lines: string[] = [];
    for (const t of moneyItems(p)) {
      itens.push({ n: null, projeto: p.id, tipo: "dinheiro", texto: t, key: null });
      lines.push(`🔴 ${t}`);
    }
    const decisions = (p.briefing?.aprovacoes?.primeiras ?? []).filter((a) => a.precisa_ok_de_alguem.length > 0).slice(0, MAX_DECISIONS);
    if (decisions.length) {
      const total = p.briefing?.aprovacoes?.total ?? decisions.length;
      lines.push(`🟠 Precisa de OK${total > decisions.length ? ` (${decisions.length} de ${total})` : ""}:`);
      for (const d of decisions) {
        n += 1;
        const texto = `${d.origem}: ${d.titulo} — espera ${d.esperando_ha}`;
        itens.push({ n, projeto: p.id, tipo: "decisao", texto, key: d.key });
        lines.push(`   *${n}.* ${texto}`);
      }
    }
    const late = (p.briefing?.etapas?.lista_atrasadas ?? []).slice(0, MAX_LATE);
    if (late.length) {
      const byOwner = new Map<string, string[]>();
      for (const s of late) {
        const owner = s.responsavel ?? "sem dono";
        byOwner.set(owner, [...(byOwner.get(owner) ?? []), s.etapa]);
        itens.push({ n: null, projeto: p.id, tipo: "atraso", texto: `${owner}: ${s.etapa}`, key: null });
      }
      lines.push(`🟡 Atrasadas: ${[...byOwner].map(([o, steps]) => `*${o}* — ${steps.join(", ")}`).join(" · ")}`);
    }
    const feitos = (p.briefing?.diario ?? []).filter((j) => j.quando >= opts.since && AI_ACTOR.test(j.quem ?? "")).length;
    feitosTotal += feitos;
    if (lines.length) blocks.push([`*${p.name}*`, ...lines].join("\n"));
  }

  const assinatura = itens.map((i) => `${i.projeto}|${i.tipo}|${i.key ?? i.texto}`).sort().join("\n");
  if (!blocks.length) return { itens, texto: "", assinatura, feitos_pela_ia: feitosTotal };
  const texto = [
    `🧭 *Operador — rodada ${opts.label}*`,
    "",
    blocks.join("\n\n"),
    "",
    feitosTotal ? `✅ A IA fez ${feitosTotal} ${feitosTotal === 1 ? "coisa" : "coisas"} sozinha desde a última rodada (revisar em ${opts.appUrl}/aprovar).` : null,
    n ? `Decidir: ${opts.appUrl}/aprovar` : null,
  ].filter((l): l is string => l !== null).join("\n").replace(/\n{3,}/g, "\n\n");
  return { itens, texto, assinatura, feitos_pela_ia: feitosTotal };
}

// ── Respostas no grupo (OPR1.2) ──────────────────────────────────────────────

export type OperatorDecision = "approve" | "reject" | "mark_paid";
export interface OperatorCommand { decisao: OperatorDecision; numeros: number[] }

const VERBS: Array<[RegExp, OperatorDecision]> = [
  [/^(ok|sim|aprova(r|do)?|pode)$/, "approve"],
  [/^(n[aã]o|nao|recusa(r)?|reprova(r)?|descarta(r)?)$/, "reject"],
  [/^pago$/, "mark_paid"],
];

/**
 * Lê uma mensagem do grupo como comando do operador: "ok 1", "ok 1 3", "sim 2", "não 2", "pago 4", "ok 1, 3 e 5".
 * Só a mensagem inteira no formato verbo + números vale; qualquer outra conversa do grupo devolve null.
 */
export function parseOperatorCommand(text: string | null | undefined): OperatorCommand | null {
  const t = (text ?? "").trim().toLowerCase().replace(/[.!]+$/, "");
  const m = /^([a-zà-ú]+)\s+([\d\s,e]+)$/.exec(t);
  if (!m) return null;
  const verb = VERBS.find(([re]) => re.test(m[1]));
  if (!verb) return null;
  const numeros = [...new Set((m[2].match(/\d+/g) ?? []).map(Number).filter((n) => n > 0 && n < 100))];
  return numeros.length ? { decisao: verb[1], numeros } : null;
}

/** Itens numerados da última rodada que o comando aponta; número sem item volta em `desconhecidos`. */
export function resolveOperatorCommand(cmd: OperatorCommand, itens: ReadonlyArray<OperatorItem>) {
  const alvo = cmd.numeros.map((n) => ({ n, item: itens.find((i) => i.n === n && i.key) ?? null }));
  return {
    decisoes: alvo.filter((a) => a.item).map((a) => ({ n: a.n, key: a.item!.key as string, texto: a.item!.texto, decisao: cmd.decisao })),
    desconhecidos: alvo.filter((a) => !a.item).map((a) => a.n),
  };
}

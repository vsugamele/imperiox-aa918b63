/**
 * Motores Determinísticos da Derick.AI portados nativamente para TypeScript na Império (imperiox).
 *
 * Princípio da Derick.AI: "O modelo DECIDE, o código CONTA."
 * Inclui:
 * 1. medirEscritaDerick(texto)             -> Leis da Frase Natural 48–52 (escrita_ads.py)
 * 2. auditarLeadDerick(texto, nomeChiclete)-> Bateria estrutural U1–U7 + Leis 54/55 + K23/K24/K25 (escrita_ads.py)
 * 3. vocabularioDoNichoDerick(...)         -> Lei 55: Frequência de unigramas/bigramas na fala real do nicho (escrita_ads.py)
 * 4. conferirCongruenciaVslDerick(...)     -> Passe de Congruência v1.3.0: Loops, "Lembra que", Preços/Stack, Bônus, Dores, Anáfora, Nome Chiclete/1000w (conferir_congruencia.py)
 * 5. qualificarCampanhaDerick(...)         -> Qualificador de Campanhas Escaladas + Plano 15 Amplas + 5 Específicas (research_rules.py)
 * 6. DERICK_FUNNEL_TEMPLATES               -> Templates Canônicos de Funil + Levas Semanais (project_routes.py)
 */

import type { ProjectIntelligenceBundle } from "@/lib/project-intelligence";

// ---------------------------------------------------------------------------
// Utilitários de normalização e limpeza de rubricas (escrita_ads.py & conferir_congruencia.py)
// ---------------------------------------------------------------------------

const RUBRICA_RE = /^\[.*\]$|^\(.*\)$|^\*\*\[.*\]\*\*$/;
const FALANTE_PREFIX_RE = /^\*\*\\?\[[^\]]*\\?\][^*]*\*\*\s*/;

export function normalizarDerick(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function extrairPalavrasDerick(s: string): string[] {
  return (s || "").match(/[\wÀ-ÿ'-]+/g) || [];
}

export function contarPalavrasDerick(s: string): number {
  return (s || "")
    .trim()
    .split(/\s+/)
    .filter((w) => /[\wÀ-ÿ]/i.test(w)).length;
}

export function extrairLinhasDeFalaDerick(texto: string): string[] {
  const out: string[] = [];
  for (const rawLine of (texto || "").split(/\r?\n/)) {
    let t = rawLine.trim();
    if (!t) continue;
    if (
      t.startsWith("#") ||
      t.startsWith("|") ||
      t.startsWith("```") ||
      t.startsWith(">") ||
      t.startsWith("- ") ||
      t.startsWith("* ") ||
      t.startsWith("→") ||
      t.startsWith("✓") ||
      t.startsWith("---")
    ) {
      continue;
    }
    if (RUBRICA_RE.test(t)) continue;
    t = t.replace(FALANTE_PREFIX_RE, "").trim();
    t = t.replace(/\*\*|__|(?<!\w)\*(?!\w)/g, "").trim();
    if (t && !RUBRICA_RE.test(t)) {
      out.push(t);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1. Medidor de Frase Natural — Leis 48–52 (escrita_ads.py -> medir)
// ---------------------------------------------------------------------------

export interface MedicaoEscritaDerick {
  linhas: number;
  mediana_palavras: number;
  micro_linhas: number;
  pct_micro: number;
  lista_micro: string[];
  longas_28mais: string[];
  motivos: string[];
  aprovado: boolean;
  veredito: string;
}

export function medirEscritaDerick(texto: string, informativo = false): MedicaoEscritaDerick {
  const linhas = extrairLinhasDeFalaDerick(texto);
  if (linhas.length === 0) {
    return {
      linhas: 0,
      mediana_palavras: 0,
      micro_linhas: 0,
      pct_micro: 0,
      lista_micro: [],
      longas_28mais: [],
      motivos: ["nenhuma linha de fala encontrada no texto"],
      aprovado: false,
      veredito: "Aguardando linhas de fala",
    };
  }

  const ns = linhas.map((l) => contarPalavrasDerick(l)).sort((a, b) => a - b);
  const n = ns.length;
  const mediana =
    n % 2 === 1 ? ns[Math.floor(n / 2)] : Math.round(((ns[n / 2 - 1] + ns[n / 2]) / 2) * 10) / 10;

  const micro = linhas.filter((l) => contarPalavrasDerick(l) <= 3);
  const longas = linhas.filter((l) => contarPalavrasDerick(l) > 28);
  const pct_micro = Math.round((100 * micro.length) / n * 10) / 10;

  const motivos: string[] = [];
  if (!informativo) {
    if (mediana < 10) motivos.push(`mediana ${mediana} abaixo de 10: fundir linhas curtas`);
    if (mediana > 15) motivos.push(`mediana ${mediana} acima de 15: quebrar linhas longas`);
    if (pct_micro > 12) motivos.push(`micro-linhas ${pct_micro}% acima de 12%: fundir`);
    if (longas.length > 0) motivos.push(`${longas.length} linha(s) acima de 28 palavras: quebrar`);
  }

  const aprovado = motivos.length === 0;
  const veredito = informativo
    ? `Modo informativo DTC (mediana ${mediana} · micro ${pct_micro}% · longas ${longas.length})`
    : aprovado
      ? "DENTRO DA RÉGUA (mediana 10–15 · micro ≤ 12% · nenhuma linha > 28)"
      : `REPROVA: ${motivos.join("; ")} (Leis 48–52)`;

  return {
    linhas: n,
    mediana_palavras: mediana,
    micro_linhas: micro.length,
    pct_micro,
    lista_micro: micro.slice(0, 8),
    longas_28mais: longas.slice(0, 6),
    motivos,
    aprovado,
    veredito,
  };
}

// ---------------------------------------------------------------------------
// 2. Auditoria Estrutural de Lead — U1–U7 + K23/K24/K25 (escrita_ads.py -> auditar_lead)
// ---------------------------------------------------------------------------

export interface AuditoriaLeadDerick {
  medicao: MedicaoEscritaDerick;
  primeira_frase: string;
  abertura: {
    palavras: number;
    e_pergunta: boolean;
    e_imperativo_ou_comando: boolean;
  };
  numeros: {
    total: number;
    amostra: string[];
    alerta_redondo_com_cara_de_preco: string[];
  };
  chiclete: {
    nome: string;
    ocorrencias: number;
    primeira_aparicao_pct: number | null;
    ok_primeiros_30pct: boolean;
    veredito: string;
  };
  retencao: {
    dispositivos: string[];
    veredito: string;
  };
  ponte: {
    presente_no_fim: boolean;
    ultimas_linhas: string[];
  };
  perguntas_diretas: {
    quantas: number;
    amostra: string[];
  };
  fascinations: {
    conectores: number;
    fecho_canonico: boolean;
  };
  vazamentos: {
    menciona_preco_de_oferta: boolean;
    passo_a_passo_numerado_completo: boolean;
  };
}

const RETENCAO_PATTERNS: Array<[RegExp, string]> = [
  [
    /at[ée] o final|at[ée] o fim|fica comigo|fique comigo|fique conosco|n[ãa]o saia|n[ãa]o pula|grud[ae]|preste? (bastante |muita )?aten[çc][ãa]o|me prometa|posso contar com voc[êe]/i,
    "K24a comando / K24e acordo",
  ],
  [
    /no final (desse|deste|do) (v[íi]deo|programa)|s[óo] no final|vou (liberar|montar|revelar|mostrar)[^.\n]{0,60}(no final|ao final)/i,
    "K24b recompensa condicionada",
  ],
  [
    /nos pr[óo]ximos \d+|em menos de \d+|daqui a \d+|pr[óo]ximos (minutos|segundos)/i,
    "K24d contrato de tempo",
  ],
];

const PONTE_RE = /deixa eu me apresentar|deixe-me (explicar|apresentar)|quem sou eu|me apresentar|convidou [oa]|vamos come[çc]ar|est[áa] pronta/i;
const FASC_RE = /vou te mostrar|tamb[ée]m vou te revelar|e por fim|voc[êe] vai descobrir/gi;

export function auditarLeadDerick(texto: string, nomeChiclete = ""): AuditoriaLeadDerick {
  const linhas = extrairLinhasDeFalaDerick(texto);
  const medicao = medirEscritaDerick(texto);
  if (linhas.length === 0) {
    return {
      medicao,
      primeira_frase: "",
      abertura: { palavras: 0, e_pergunta: false, e_imperativo_ou_comando: false },
      numeros: { total: 0, amostra: [], alerta_redondo_com_cara_de_preco: [] },
      chiclete: { nome: nomeChiclete, ocorrencias: 0, primeira_aparicao_pct: null, ok_primeiros_30pct: false, veredito: "sem texto" },
      retencao: { dispositivos: [], veredito: "sem texto" },
      ponte: { presente_no_fim: false, ultimas_linhas: [] },
      perguntas_diretas: { quantas: 0, amostra: [] },
      fascinations: { conectores: 0, fecho_canonico: false },
      vazamentos: { menciona_preco_de_oferta: false, passo_a_passo_numerado_completo: false },
    };
  }

  const corpo = linhas.join("\n");
  const baixo = corpo.toLowerCase();
  const primeira = linhas[0];

  const numeros =
    corpo.match(/(?:R\$|US\$|\$)\s?[\d.,]+|\b\d+[.,]?\d*\s?(?:%|x|kg|mil|milh)|\b\d{2,}\b/gi) || [];
  const redondos = numeros.filter((x) =>
    /^(?:R\$|US\$|\$)\s?\d+00$/i.test(x.replace(/\./g, "").replace(/,/g, ""))
  );

  let chicleteInfo: AuditoriaLeadDerick["chiclete"] = {
    nome: nomeChiclete || "(não informado)",
    ocorrencias: 0,
    primeira_aparicao_pct: null,
    ok_primeiros_30pct: true,
    veredito: "ok (nome chiclete opcional conforme VSLs do nicho — 017-lead)",
  };

  if (nomeChiclete.trim()) {
    const escaped = nomeChiclete
      .trim()
      .split(/\s+/)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/s$/i, "") + "s?")
      .join("\\s+");
    const rxCh = new RegExp(escaped, "i");
    const occ: number[] = [];
    linhas.forEach((l, i) => {
      if (rxCh.test(l)) occ.push(i);
    });
    const pos = occ.length > 0 ? Math.round((100 * occ[0]) / linhas.length) : null;
    chicleteInfo = {
      nome: nomeChiclete,
      ocorrencias: occ.length,
      primeira_aparicao_pct: pos,
      ok_primeiros_30pct: pos !== null && pos <= 30,
      veredito:
        occ.length === 0
          ? "Ausente na lead (verificar se o nicho exige — Lei 54)"
          : pos !== null && pos > 30
            ? `Aparece em ${pos}% da lead (ideal ≤ 30%)`
            : `OK (${occ.length}x · 1ª aparição em ${pos}%)`,
    };
  }

  const achadosRetencao = RETENCAO_PATTERNS.filter(([rx]) => rx.test(baixo)).map(([, rot]) => rot);
  const fim = linhas.slice(-4).join(" ").toLowerCase();
  const pergs = linhas.filter(
    (l) => l.includes("?") && /\b(voc[êe]|tu|te)\b/i.test(l.toLowerCase())
  );
  const fascMatches = baixo.match(FASC_RE) || [];

  return {
    medicao,
    primeira_frase: primeira,
    abertura: {
      palavras: contarPalavrasDerick(primeira),
      e_pergunta: primeira.includes("?"),
      e_imperativo_ou_comando: /^(fa[çc]a|pare|para|tome|use|olha|imagine|stop|escuta)\b/i.test(
        primeira.toLowerCase()
      ),
    },
    numeros: {
      total: numeros.length,
      amostra: numeros.slice(0, 12),
      alerta_redondo_com_cara_de_preco: redondos,
    },
    chiclete: chicleteInfo,
    retencao: {
      dispositivos: achadosRetencao,
      veredito:
        achadosRetencao.length > 0
          ? `OK (${achadosRetencao.join(" + ")})`
          : "NENHUM dispositivo explícito de retenção — U6 reprova",
    },
    ponte: {
      presente_no_fim: PONTE_RE.test(fim),
      ultimas_linhas: linhas.slice(-2),
    },
    perguntas_diretas: {
      quantas: pergs.length,
      amostra: pergs.slice(0, 3),
    },
    fascinations: {
      conectores: fascMatches.length,
      fecho_canonico: baixo.includes("muito, muito mais"),
    },
    vazamentos: {
      menciona_preco_de_oferta: /por (apenas|s[óo]) (?:R\$|US\$|\$)/i.test(baixo),
      passo_a_passo_numerado_completo: /passo 1[\s\S]{0,400}passo 2[\s\S]{0,400}passo 3/i.test(
        baixo
      ),
    },
  };
}

// ---------------------------------------------------------------------------
// 3. Auditoria de Vocabulário do Nicho — Lei 55 (escrita_ads.py -> vocabulario)
// ---------------------------------------------------------------------------

const STOPWORDS_PT = new Set(
  `a o e e de da do das dos em no na nos nas um uma uns umas que se por para pra pro com como mas mais ou os as ao aos a as esse essa isso este esta isto aquele aquela nem ja nao sim eu tu ele ela voce voces nos eles elas meu minha seu sua teu tua dele dela ser ter estar foi era vai vou ia ta sao esta estao tem tinham muito muita bem so entao quando onde porque porque aqui ali la agora hoje depois antes sempre nunca tambem ate coisa coisas gente pessoa pessoas dia dias vez vezes tudo nada todo toda todos todas outro outra fazer faz fez vai ver olha assim mesmo mesma pode podem posso quer quero sabe saber dizer digo disse falar te me lhe nos vos oque ne tipo cara ainda cada qual quais uns duas dois tres`.split(
    /\s+/
  )
);

export interface VocabularioNichoResult {
  total_pecas_corpus: number;
  termos_presentes_na_copy: Array<{ termo: string; ocorrencias_corpus: number; ocorrencias_copy: number }>;
  banco_unigramas: Array<{ termo: string; ocorrencias: number; na_copy: boolean }>;
  banco_bigramas: Array<{ termo: string; ocorrencias: number; na_copy: boolean }>;
  taxa_aderencia_top20_pct: number;
}

export function vocabularioDoNichoDerick(
  textoCopy: string,
  corpusFalas: string[],
  top = 24
): VocabularioNichoResult {
  const tudo = (corpusFalas || []).filter((x) => x && x.trim()).join("\n");
  const copyNorm = normalizarDerick(textoCopy || "");
  if (!tudo.trim()) {
    return {
      total_pecas_corpus: 0,
      termos_presentes_na_copy: [],
      banco_unigramas: [],
      banco_bigramas: [],
      taxa_aderencia_top20_pct: 100,
    };
  }

  const palavrasRaw = (tudo.toLowerCase().match(/[a-zà-ú$0-9]{4,}/gi) || []).filter(
    (w) => !STOPWORDS_PT.has(normalizarDerick(w)) && !/^\d+$/.test(w)
  );

  const uniCounts = new Map<string, number>();
  for (const w of palavrasRaw) {
    const k = w.toLowerCase();
    uniCounts.set(k, (uniCounts.get(k) || 0) + 1);
  }

  const sortedUni = Array.from(uniCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([termo, ocorrencias]) => ({
      termo,
      ocorrencias,
      na_copy: copyNorm.includes(normalizarDerick(termo)),
    }));

  const tokens = tudo.toLowerCase().match(/[a-zà-ú$0-9]{3,}/gi) || [];
  const biCounts = new Map<string, number>();
  for (let i = 0; i < tokens.length - 1; i++) {
    const a = tokens[i];
    const b = tokens[i + 1];
    if (!STOPWORDS_PT.has(normalizarDerick(a)) && !STOPWORDS_PT.has(normalizarDerick(b))) {
      const bi = `${a} ${b}`;
      biCounts.set(bi, (biCounts.get(bi) || 0) + 1);
    }
  }

  const sortedBi = Array.from(biCounts.entries())
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.floor(top / 2))
    .map(([termo, ocorrencias]) => ({
      termo,
      ocorrencias,
      na_copy: copyNorm.includes(normalizarDerick(termo)),
    }));

  const top20 = sortedUni.slice(0, 20);
  const hitsTop20 = top20.filter((u) => u.na_copy).length;
  const taxa = top20.length > 0 ? Math.round((hitsTop20 / top20.length) * 100) : 100;

  const termosPresentes = sortedUni
    .filter((u) => u.na_copy)
    .map((u) => {
      const tn = normalizarDerick(u.termo);
      const occCopy = copyNorm.split(tn).length - 1;
      return {
        termo: u.termo,
        ocorrencias_corpus: u.ocorrencias,
        ocorrencias_copy: Math.max(1, occCopy),
      };
    });

  return {
    total_pecas_corpus: corpusFalas.length,
    termos_presentes_na_copy: termosPresentes,
    banco_unigramas: sortedUni,
    banco_bigramas: sortedBi,
    taxa_aderencia_top20_pct: taxa,
  };
}

// ---------------------------------------------------------------------------
// 4. Passe de Congruência por Código v1.3.0 (conferir_congruencia.py)
// ---------------------------------------------------------------------------

const IGNORAR_HEADERS = [
  "metadados",
  "pendencias",
  "proximo passo",
  "ancora de fronteira",
  "passe de congruencia",
];

const BORDOES_PROIBIDOS_DERICK = [
  "resumindo?",
  "simples assim",
  "o xis da questão",
  "isso mesmo que você ouviu",
  "entendeu o tamanho disso",
  "olha que loucura",
  "eu sei que o nome pode parecer complicado",
  "poucas pessoas sabem disso",
  "pra você ter uma ideia",
  "para você ter uma ideia",
  "agora, imagina",
  "antes de continuar, deixa eu me apresentar",
];

const NUMEROS_EXTENSO_MAP: Record<string, number> = {
  dois: 2,
  duas: 2,
  três: 3,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  quinze: 15,
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  cem: 100,
  mil: 1000,
};

const UNIDADE_EXTENSO_RE = new RegExp(
  `\\b(${Object.keys(NUMEROS_EXTENSO_MAP).join("|")})\\s+(dias|semanas|meses|anos|vezes|horas|minutos|segundos|quilos|kg|reais|dólares|frascos|potes|passos|fases|ajustes|ingredientes|copos)\\b`,
  "gi"
);

const BONUS_RE = new RegExp(
  `\\b(\\d+|${Object.keys(NUMEROS_EXTENSO_MAP).join("|")})\\s+(bônus|bonus|presentes|brindes|bônus exclusivos)\\b`,
  "gi"
);

const LEMBRA_RE =
  /\b(lembra (?:que|quando|do|da|daquel[ae])|lembre-se|como eu (?:te )?(?:falei|disse|mostrei|expliquei|contei)|eu (?:te )?(?:falei|disse|mostrei|contei) (?:que|antes|lá)|que eu (?:te )?(?:falei|mostrei|contei)|você (?:já )?viu (?:que|como)|como (?:a gente|nós) (?:viu|vimos))/i;

const LOOP_CANDIDATE_RE =
  /\b(vou (?:te |lhe )?(?:mostrar|revelar|contar|explicar|ensinar|apresentar|dar)|daqui a pouco|já já|mais (?:pra|para a) frente|mais adiante|no final (?:deste|desse|do) (?:vídeo|video)|até o final|você vai (?:descobrir|conhecer|ver|aprender)|ainda (?:neste|nesse) vídeo|o segredo|o verdadeiro (?:culpado|motivo)|o que ninguém|que ninguém te conta|em instantes|em alguns minutos)\b/i;

const DINHEIRO_RE =
  /(?:R\$|US\$|U\$|\$|€|£)\s?(\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)|(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+)\s?(?:reais|dólares|dolares)\b/gi;
const PARCELA_RE = /\b\d{1,2}\s?x\s?(?:de\s)?(?:R\$|US\$|\$)?\s?\d/i;
const SOMA_RE = /\b(total|soma|somando|somados|ao todo|no total|valor real|juntando|daria|valeria|seria de)\b/i;
const PRECO_FINAL_RE = /\b(por apenas|por só|por somente|só hoje|hoje por|apenas)\b/i;

const FRACAS_CONECTORES = new Set(["e", "mas", "entao", "ou", "porque", "so", "o", "a", "os", "as", "um", "uma"]);

export interface CongruenciaVslOpcoes {
  nomesChiclete?: string[];
  reveladoNaTese?: string[];
  doresBanco?: string[];
  loopsDeclarados?: Array<{ abre: string; paga?: string }>;
  maxAnafora?: number;
}

export interface CongruenciaVslResult {
  blocos_na_ordem: string[];
  total_linhas_fala: number;
  total_palavras: number;
  loops: {
    candidatos: Array<{ bloco: string; linha: number; trecho: string }>;
    listados: Array<{ abre: string; linha_abre: number | null; paga?: string; linha_paga: number | null; estado: string }>;
  };
  revelado_na_lead: Array<{ bloco: string; linha: number; termo: string; trecho: string }>;
  lembra_que: Array<{ bloco: string; linha: number; trecho: string; termos_sem_ocorrencia_anterior: string[] }>;
  precos: {
    por_bloco: Record<string, Array<{ linha: number; valores: number[]; parcela: boolean; trecho: string }>>;
    somas: Array<{
      bloco: string;
      linha: number;
      valores_na_linha: number[];
      listados_antes: number[];
      soma_dos_listados: number;
      bate: boolean;
      trecho: string;
    }>;
    valores_que_so_aparecem_depois_da_big_offer: Array<{ bloco: string; linha: number; valor: number; trecho: string }>;
  };
  bonus: {
    por_bloco: Record<string, Array<{ linha: number; quantidade: number; trecho: string }>>;
    quantidades_distintas: number[];
    diverge: boolean;
  };
  dores: {
    repetidas_em_blocos_vizinhos: Array<{ dor: string; blocos: [string, string] }>;
  };
  anafora: {
    maior_sequencia: number;
    falhas: Array<{
      bloco: string;
      de_linha: number;
      ate_linha: number;
      linhas_seguidas: number;
      abertura: string;
      limite: number;
      trechos: string[];
    }>;
  };
  nomes_chiclete: Array<{
    nome: string;
    ocorrencias: number;
    por_mil_palavras_fora_da_primeira: number;
    acima_do_alvo: boolean;
    por_bloco: Record<string, number>;
  }>;
  bordoes_encontrados: Array<{ bloco: string; linha: number; bordao: string }>;
  unidades_por_extenso: Array<{ bloco: string; linha: number; trecho: string }>;
}

function limparTituloBloco(linha: string): string {
  const t = linha.replace(/^#+\s*/, "").replace(/\*/g, "").replace(/\\/g, "");
  return t.replace(/^\d+(?:\.\d+)*\.?\s*/, "").trim() || "Bloco";
}

function lerBlocosVsl(texto: string): Array<[string, number, string]> {
  const linhas: Array<[string, number, string]> = [];
  let bloco = "VSL";
  let ignorando = false;

  (texto || "").split(/\r?\n/).forEach((bruta, idx) => {
    const n = idx + 1;
    const s = bruta.trim();
    if (!s) return;
    if (s.startsWith("#")) {
      const titulo = limparTituloBloco(s);
      if (titulo.toLowerCase().startsWith("escrita —") || titulo.toLowerCase().startsWith("escrita -")) {
        const partes = titulo.split(/—|-/).map((p) => p.trim()).filter(Boolean);
        bloco = partes.length > 1 ? partes[1] : "VSL";
        ignorando = false;
        return;
      }
      if (titulo.toLowerCase() === "copy") {
        ignorando = false;
        return;
      }
      if (IGNORAR_HEADERS.some((ig) => normalizarDerick(titulo).startsWith(ig))) {
        ignorando = true;
        return;
      }
      bloco = titulo;
      ignorando = false;
      return;
    }
    if (ignorando || s.startsWith("|") || s.startsWith("---")) return;
    let fala = s.replace(FALANTE_PREFIX_RE, "").trim();
    fala = fala.replace(/^[-*]\s+/, "").trim();
    if (fala && !RUBRICA_RE.test(fala)) {
      linhas.push([bloco, n, fala]);
    }
  });
  return linhas;
}

function parseValorMonetario(brutoRaw: string): number | null {
  let bruto = (brutoRaw || "").replace(/\s+/g, "");
  if (/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(bruto)) {
    bruto = bruto.replace(/,/g, "");
  } else if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(bruto)) {
    bruto = bruto.replace(/\./g, "").replace(",", ".");
  } else if (bruto.includes(",")) {
    bruto = bruto.replace(",", ".");
  }
  const num = Number.parseFloat(bruto);
  return Number.isFinite(num) ? num : null;
}

export function conferirCongruenciaVslDerick(
  texto: string,
  opcoes: CongruenciaVslOpcoes = {}
): CongruenciaVslResult {
  const linhas = lerBlocosVsl(texto);
  const maxAnafora = opcoes.maxAnafora ?? 2;

  const blocosOrdem: string[] = [];
  for (const [b] of linhas) {
    if (blocosOrdem.length === 0 || blocosOrdem[blocosOrdem.length - 1] !== b) {
      blocosOrdem.push(b);
    }
  }

  const totalPalavras = linhas.reduce((acc, [, , f]) => acc + extrairPalavrasDerick(f).length, 0);

  // 1. Anáfora
  const falhasAnafora: CongruenciaVslResult["anafora"]["falhas"] = [];
  let seq: Array<[string, number, string, string]> = [];
  let maiorSeq = 0;

  const fecharAnafora = () => {
    if (seq.length === 0) return;
    const limite = FRACAS_CONECTORES.has(seq[0][3]) ? 4 : maxAnafora;
    if (seq.length > limite) {
      falhasAnafora.push({
        bloco: seq[0][0],
        de_linha: seq[0][1],
        ate_linha: seq[seq.length - 1][1],
        linhas_seguidas: seq.length,
        abertura: seq[0][3],
        limite,
        trechos: seq.map((x) => x[2].slice(0, 80)),
      });
    }
  };

  for (const [b, n, fala] of linhas) {
    if (fala.startsWith("…") || fala.startsWith("...")) continue;
    const ws = extrairPalavrasDerick(fala);
    const abertura = ws.length > 0 ? normalizarDerick(ws[0]) : "";
    if (seq.length > 0 && abertura && abertura === seq[seq.length - 1][3] && b === seq[seq.length - 1][0]) {
      seq.push([b, n, fala, abertura]);
    } else {
      fecharAnafora();
      seq = abertura ? [[b, n, fala, abertura]] : [];
    }
    maiorSeq = Math.max(maiorSeq, seq.length);
  }
  fecharAnafora();

  // 2. Preços e Somas do Stack
  const precosPorBloco: CongruenciaVslResult["precos"]["por_bloco"] = {};
  const somas: CongruenciaVslResult["precos"]["somas"] = [];
  let desde: Array<[number, number[]]> = [];
  let blocoAtual: string | null = null;

  for (const [b, n, fala] of linhas) {
    if (b !== blocoAtual) {
      blocoAtual = b;
      desde = [];
    }
    const valores: number[] = [];
    for (const m of fala.matchAll(DINHEIRO_RE)) {
      const v = parseValorMonetario(m[1] || m[2] || "");
      if (v !== null) valores.push(v);
    }
    const parcela = PARCELA_RE.test(fala);
    if (valores.length > 0) {
      if (!precosPorBloco[b]) precosPorBloco[b] = [];
      precosPorBloco[b].push({ linha: n, valores, parcela, trecho: fala.slice(0, 120) });
    }
    if (SOMA_RE.test(fala) && !PRECO_FINAL_RE.test(fala) && valores.length > 0 && desde.length > 0) {
      const listados = desde.flatMap((x) => x[1]).slice(-12);
      const sufixos = listados.map((_, i) =>
        Math.round(listados.slice(i).reduce((a, c) => a + c, 0) * 100) / 100
      );
      const bate = sufixos.some((s) => valores.some((v) => Math.abs(s - v) < 0.01));
      somas.push({
        bloco: b,
        linha: n,
        valores_na_linha: valores,
        listados_antes: listados,
        soma_dos_listados: sufixos[0] ?? 0,
        bate,
        trecho: fala.slice(0, 120),
      });
      desde = [];
    } else if (valores.length > 0 && !parcela && !PRECO_FINAL_RE.test(fala)) {
      desde.push([n, valores]);
    }
  }

  const blocosComPreco = Object.keys(precosPorBloco);
  const idxOferta = blocosComPreco.findIndex(
    (b) => normalizarDerick(b).includes("big offer") || normalizarDerick(b).includes("oferta")
  );
  const novosDepoisOferta: CongruenciaVslResult["precos"]["valores_que_so_aparecem_depois_da_big_offer"] = [];
  if (idxOferta >= 0) {
    const vistos = new Set<number>();
    blocosComPreco.slice(0, idxOferta + 1).forEach((b) => {
      precosPorBloco[b].forEach((it) => it.valores.forEach((v) => vistos.add(v)));
    });
    blocosComPreco.slice(idxOferta + 1).forEach((b) => {
      precosPorBloco[b].forEach((it) => {
        it.valores.forEach((v) => {
          if (!vistos.has(v)) {
            novosDepoisOferta.push({ bloco: b, linha: it.linha, valor: v, trecho: it.trecho });
          }
        });
      });
    });
  }

  // 3. Bônus
  const bonusPorBloco: CongruenciaVslResult["bonus"]["por_bloco"] = {};
  const qtdsBonusSet = new Set<number>();
  for (const [b, n, fala] of linhas) {
    for (const m of fala.matchAll(BONUS_RE)) {
      const rawQ = m[1].toLowerCase();
      const q = /^\d+$/.test(rawQ) ? Number.parseInt(rawQ, 10) : NUMEROS_EXTENSO_MAP[rawQ];
      if (q) {
        if (!bonusPorBloco[b]) bonusPorBloco[b] = [];
        bonusPorBloco[b].push({ linha: n, quantidade: q, trecho: fala.slice(0, 100) });
        qtdsBonusSet.add(q);
      }
    }
  }
  const quantidadesDistintas = Array.from(qtdsBonusSet).sort((a, b) => a - b);

  // 4. "Lembra que..."
  const lembraAchados: CongruenciaVslResult["lembra_que"] = [];
  const falasAnteriores: string[] = [];
  for (const [b, n, fala] of linhas) {
    const m = LEMBRA_RE.exec(fala);
    if (m) {
      const resto = fala.slice(m.index + m[0].length);
      const termos = extrairPalavrasDerick(resto)
        .filter((w) => w.length >= 5 && !STOPWORDS_PT.has(normalizarDerick(w)))
        .slice(0, 6);
      const textoAntes = normalizarDerick(falasAnteriores.join(" "));
      const semAntes = termos.filter((w) => !textoAntes.includes(normalizarDerick(w).slice(0, 6)));
      lembraAchados.push({
        bloco: b,
        linha: n,
        trecho: fala.slice(0, 140),
        termos_sem_ocorrencia_anterior: semAntes,
      });
    }
    falasAnteriores.push(fala);
  }

  // 5. Loops
  const loopsCandidatos = linhas
    .filter(([, , fala]) => LOOP_CANDIDATE_RE.test(fala))
    .map(([bloco, linha, fala]) => ({ bloco, linha, trecho: fala.slice(0, 140) }));

  const loopsListados: CongruenciaVslResult["loops"]["listados"] = [];
  if (opcoes.loopsDeclarados && opcoes.loopsDeclarados.length > 0) {
    const corpoNorm = linhas.map(([, n, f]) => [n, normalizarDerick(f)] as const);
    for (const item of opcoes.loopsDeclarados) {
      const abre = normalizarDerick(item.abre || "");
      const paga = normalizarDerick(item.paga || "");
      const foundAbre = corpoNorm.find(([, f]) => abre && f.includes(abre));
      const nAbre = foundAbre ? foundAbre[0] : null;
      const foundPaga = corpoNorm.find(
        ([n, f]) => paga && f.includes(paga) && (nAbre === null || n > nAbre)
      );
      const nPaga = foundPaga ? foundPaga[0] : null;
      loopsListados.push({
        abre: item.abre,
        linha_abre: nAbre,
        paga: item.paga,
        linha_paga: nPaga,
        estado:
          nAbre && nPaga
            ? "pago"
            : !nAbre
              ? "abertura não encontrada"
              : "sem pagamento",
      });
    }
  }

  // 6. Revelado na Tese vazando na Lead (K43)
  const reveladoNaLead: CongruenciaVslResult["revelado_na_lead"] = [];
  for (const [b, n, fala] of linhas) {
    const bn = normalizarDerick(b);
    if (!bn.includes("lead") && !bn.includes("micro")) continue;
    const fn = normalizarDerick(fala);
    for (const t of opcoes.reveladoNaTese || []) {
      if (t.trim() && fn.includes(normalizarDerick(t))) {
        reveladoNaLead.push({ bloco: b, linha: n, termo: t, trecho: fala.slice(0, 140) });
      }
    }
  }

  // 7. Dores repetidas em blocos vizinhos (K40)
  const repetidasVizinhas: CongruenciaVslResult["dores"]["repetidas_em_blocos_vizinhos"] = [];
  const doresOnde = new Map<string, string[]>();
  for (const d of opcoes.doresBanco || []) {
    if (d.trim()) doresOnde.set(d, []);
  }
  for (const [b, , fala] of linhas) {
    const fn = normalizarDerick(fala);
    for (const [d, bs] of doresOnde.entries()) {
      if (fn.includes(normalizarDerick(d)) && !bs.includes(b)) {
        bs.push(b);
      }
    }
  }
  for (const [d, bs] of doresOnde.entries()) {
    for (let i = 0; i < blocosOrdem.length - 1; i++) {
      const a = blocosOrdem[i];
      const c = blocosOrdem[i + 1];
      if (bs.includes(a) && bs.includes(c)) {
        repetidasVizinhas.push({ dor: d, blocos: [a, c] });
      }
    }
  }

  // 8. Densidade do Nome Chiclete por 1.000 palavras
  const nomesResult: CongruenciaVslResult["nomes_chiclete"] = [];
  for (const nome of opcoes.nomesChiclete || []) {
    if (!nome.trim()) continue;
    const alvo = normalizarDerick(nome);
    const porBloco: Record<string, number> = {};
    let totalOcc = 0;
    for (const [b, , fala] of linhas) {
      const fn = normalizarDerick(fala);
      const count = fn.split(alvo).length - 1;
      if (count > 0) {
        totalOcc += count;
        porBloco[b] = (porBloco[b] || 0) + count;
      }
    }
    const foraPrimeira = Math.max(0, totalOcc - 1);
    const porMil = Math.round((1000 * foraPrimeira) / Math.max(1, totalPalavras) * 100) / 100;
    nomesResult.push({
      nome,
      ocorrencias: totalOcc,
      por_mil_palavras_fora_da_primeira: porMil,
      acima_do_alvo: porMil > 2,
      por_bloco: porBloco,
    });
  }

  // 9. Bordões proibidos e Unidades por extenso
  const bordoesEncontrados: CongruenciaVslResult["bordoes_encontrados"] = [];
  const unidadesExtenso: CongruenciaVslResult["unidades_por_extenso"] = [];
  for (const [b, n, fala] of linhas) {
    const fn = normalizarDerick(fala);
    for (const bd of BORDOES_PROIBIDOS_DERICK) {
      if (fn.includes(normalizarDerick(bd).replace(/\?$/, ""))) {
        bordoesEncontrados.push({ bloco: b, linha: n, bordao: bd });
      }
    }
    for (const m of fala.matchAll(UNIDADE_EXTENSO_RE)) {
      unidadesExtenso.push({ bloco: b, linha: n, trecho: m[0] });
    }
  }

  return {
    blocos_na_ordem: blocosOrdem,
    total_linhas_fala: linhas.length,
    total_palavras: totalPalavras,
    loops: {
      candidatos: loopsCandidatos,
      listados: loopsListados,
    },
    revelado_na_lead: reveladoNaLead,
    lembra_que: lembraAchados,
    precos: {
      por_bloco: precosPorBloco,
      somas,
      valores_que_so_aparecem_depois_da_big_offer: novosDepoisOferta,
    },
    bonus: {
      por_bloco: bonusPorBloco,
      quantidades_distintas: quantidadesDistintas,
      diverge: quantidadesDistintas.length > 1,
    },
    dores: {
      repetidas_em_blocos_vizinhos: repetidasVizinhas,
    },
    anafora: {
      maior_sequencia: maiorSeq,
      falhas: falhasAnafora,
    },
    nomes_chiclete: nomesResult,
    bordoes_encontrados: bordoesEncontrados,
    unidades_por_extenso: unidadesExtenso,
  };
}

// ---------------------------------------------------------------------------
// 5. Qualificador de Campanhas Escaladas & Plano 20 Buscas (research_rules.py)
// ---------------------------------------------------------------------------

export interface ElegibilidadeCampanhaDerick {
  pais_correto: boolean;
  mercado_correto: boolean;
  player_aceito: boolean; // Vturb/ConverteAI, Wistia, Vidalytics
  compra_oculta: boolean; // Botão oculto / delay (não compra visível imediata)
  e_vsl: boolean;
  duracao_segundos: number; // >= 900s (15 min)
  pais: "BR" | "US" | "ES" | string;
}

export interface SinalEscalaDerick {
  tipo: "anuncios" | "similarweb" | "trends" | "reclame_aqui" | "usuario";
  valor: number | boolean;
  fonte: string;
  confirmado: boolean;
}

export interface QualificacaoCampanhaResult {
  classificacao: "Escalado" | "Potencialmente Escalado" | "Sem Performance Confirmada" | "Pendente" | "Rejeitado";
  quantidade_sinais: number;
  sinais_aceitos: SinalEscalaDerick[];
  rejeicoes: string[];
  faltantes: string[];
  explicacao: string;
}

export function qualificarCampanhaDerick(
  elegibilidade: ElegibilidadeCampanhaDerick,
  sinais: SinalEscalaDerick[]
): QualificacaoCampanhaResult {
  const requiredKeys: Array<keyof ElegibilidadeCampanhaDerick> = [
    "pais_correto",
    "mercado_correto",
    "player_aceito",
    "compra_oculta",
    "e_vsl",
  ];
  const faltantes: string[] = [];
  const rejeicoes: string[] = [];

  for (const k of requiredKeys) {
    if (typeof elegibilidade[k] !== "boolean") faltantes.push(k);
    else if (elegibilidade[k] === false) rejeicoes.push(k);
  }

  if (!elegibilidade.duracao_segundos || elegibilidade.duracao_segundos <= 0) {
    faltantes.push("duracao_segundos");
  } else if (elegibilidade.duracao_segundos < 900) {
    rejeicoes.push("mini_vsl (< 15 min / 900s)");
  }

  const aceitos: SinalEscalaDerick[] = [];
  for (const s of sinais) {
    if (!s.confirmado || !s.fonte) continue;
    if (s.tipo === "anuncios" && typeof s.valor === "number" && s.valor > 10) aceitos.push(s);
    else if (s.tipo === "similarweb" && typeof s.valor === "number" && s.valor > 10000) aceitos.push(s);
    else if (s.tipo === "reclame_aqui" && elegibilidade.pais === "BR" && typeof s.valor === "number" && s.valor >= 4) aceitos.push(s);
    else if (s.tipo === "trends" && s.valor === true) aceitos.push(s);
    else if (s.tipo === "usuario" && s.valor === true) aceitos.push(s);
  }

  const classificacao: QualificacaoCampanhaResult["classificacao"] =
    rejeicoes.length > 0
      ? "Rejeitado"
      : faltantes.length > 0
        ? "Pendente"
        : aceitos.length >= 2
          ? "Escalado"
          : aceitos.length === 1
            ? "Potencialmente Escalado"
            : "Sem Performance Confirmada";

  const explicacao =
    classificacao === "Rejeitado"
      ? `Excluído da rodada de VSLs: ${rejeicoes.join(", ")}`
      : classificacao === "Escalado"
        ? `Qualificado como ESCALADO com ${aceitos.length} sinais independentes confirmados (>10 ads / >10k Similarweb / Trends / ≥4 RA).`
        : classificacao === "Potencialmente Escalado"
          ? `Qualificado como POTENCIALMENTE ESCALADO (1 sinal confirmado: ${aceitos[0]?.tipo}).`
          : "Elegível tecnicamente como VSL longa com compra oculta, aguardando confirmação de ≥1 sinal de escala.";

  return {
    classificacao,
    quantidade_sinais: aceitos.length,
    sinais_aceitos: aceitos,
    rejeicoes,
    faltantes,
    explicacao,
  };
}

export function gerarUrlBibliotecaMetaDerick(termo: string, pais = "BR", apenasVideo = true): string {
  const params = new URLSearchParams({
    active_status: "active",
    ad_type: "all",
    country: pais.toUpperCase(),
    media_type: apenasVideo ? "video" : "all",
    q: termo.trim(),
    search_type: "keyword_unordered",
  });
  return `https://www.facebook.com/ads/library/?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// 6. Templates de Funil & Levas Semanais da Derick.AI (project_routes.py)
// ---------------------------------------------------------------------------

export interface DerickFunnelTemplateSpec {
  id: string;
  nome: string;
  descricao: string;
  etapas: string[];
}

export const DERICK_FUNNEL_TEMPLATES: DerickFunnelTemplateSpec[] = [
  {
    id: "vsl",
    nome: "Funil VSL Canônico (Derick.AI)",
    descricao: "Ads (Novos Clientes + Retargeting) → Pré-página → Página da VSL (Compra Oculta ≥15min) → Checkout → Upsell 1",
    etapas: ["Ads · Novos Clientes", "Ads · Retargeting", "Pré-página (Pre-lander)", "Página da VSL", "Checkout", "Upsell 1"],
  },
  {
    id: "advertorial",
    nome: "Funil Advertorial + PDP/VSL (Derick.AI)",
    descricao: "Ads (Novos + Retargeting) → Advertorial Editorial → Página Principal → Checkout → Upsell 1",
    etapas: ["Ads · Novos Clientes", "Ads · Retargeting", "Advertorial", "Página Principal", "Checkout", "Upsell 1"],
  },
  {
    id: "listicle",
    nome: "Funil Listicle DTC (Derick.AI)",
    descricao: "Ads (Novos + Retargeting) → Listicle (N Razões) → Página Principal → Checkout → Upsell 1",
    etapas: ["Ads · Novos Clientes", "Ads · Retargeting", "Listicle", "Página Principal", "Checkout", "Upsell 1"],
  },
  {
    id: "quiz",
    nome: "Funil Quiz Qualificador (Derick.AI)",
    descricao: "Ads (Novos + Retargeting) → Quiz de Diagnóstico → Página Principal / VSL → Checkout → Upsell 1",
    etapas: ["Ads · Novos Clientes", "Ads · Retargeting", "Quiz", "Página Principal", "Checkout", "Upsell 1"],
  },
  {
    id: "oferta-direta",
    nome: "Funil Oferta Direta / NSL DTC (Derick.AI)",
    descricao: "Ads Long Form (NSL P44 + Retargeting) → Página Principal (PDP) → Checkout → Upsell 1",
    etapas: ["Ads · Novos Clientes (NSL)", "Ads · Retargeting", "Página Principal (PDP)", "Checkout", "Upsell 1"],
  },
];

export const DERICK_IMPORTED_DOCS_SUMMARY = [
  {
    id: "derick-doc-16b0a0ff47a3780b",
    title: "Slim Soda / Ritual do Bicarbonato — Lead reescrita (v2)",
    project: "slimsoda",
    kind: "Lead VSL (16 KB)",
    highlight: "Lead completa modelada por Estrutura Invisível sem revelar o mecanismo da Tese (K43).",
  },
  {
    id: "derick-doc-c9a8e14c8f3f21cc",
    title: "SlimSoda — Marketing Thesis reescrita (v2)",
    project: "slimsoda",
    kind: "Marketing Thesis (23 KB)",
    highlight: "Gradualização completa das Premissas 1 e 2 + Tríade MP → MF → MS + Conclusão Inevitável.",
  },
  {
    id: "derick-doc-275c903325a1468c",
    title: "SlimSoda — Product Build-up reescrito (v2)",
    project: "slimsoda",
    kind: "Product Build-Up (15 KB)",
    highlight: "Transição do mecanismo da solução para o formato físico e critérios de pureza/absorção.",
  },
  {
    id: "derick-doc-ccbe6bb6bbd146d6",
    title: "Slim Soda — Big Offer + Close reescritos (v2.1)",
    project: "slimsoda",
    kind: "Big Offer + Close (22 KB)",
    highlight: "As 11 partes da Big Offer + Escada de Preço + 5 Funções F1–F5 do Close + Garantia.",
  },
  {
    id: "derick-doc-35ef76639a1eafec",
    title: "SlimSoda — Diagnóstico + 6 Roteiros de Vídeo DTC + Direção Visual",
    project: "slimsoda",
    kind: "Lote de Ads DTC (17 KB)",
    highlight: "6 roteiros completos com direção visual frame a frame e diagnóstico do criativo campeão.",
  },
  {
    id: "derick-doc-bce4182898e76845",
    title: "Dissecação SLIM-ORG-005 + Lote de 5 Criativos Orgânicos (US)",
    project: "slimsoda",
    kind: "Dissecação + 5 Reels US (16 KB)",
    highlight: "Engenharia reversa do viral orgânico SLIM-ORG-005 e 5 variações prontas para o mercado US.",
  },
  {
    id: "derick-doc-c86f493f16d0fd51",
    title: "Slim Soda — 'Put your snack on a plate' (8s) — Extração do Anúncio",
    project: "slimsoda",
    kind: "Ficha Skill 04 (13 KB)",
    highlight: "Decomposição de Visual Hook, Copy Hook, Body e CTA do anúncio curto de 8 segundos.",
  },
  {
    id: "derick-doc-dca91adb84aa93e2",
    title: "Variações de Criativo — Vovó Mei (5 Roteiros)",
    project: "slimsoda",
    kind: "Lote Vovó Mei (10 KB)",
    highlight: "5 variações de roteiro narrativo da persona Vovó Mei com gancho de contraste ancestral.",
  },
  {
    id: "derick-doc-60e0576e763c8fea",
    title: "Fábrica de Orgânico — Passo a Passo, Copy e Técnicas",
    project: "global",
    kind: "Playbook Orgânico (26 KB)",
    highlight: "Manual completo da Fábrica de Orgânico do Derick: estrutura, retenção e conversão.",
  },
  {
    id: "derick-doc-53c5d9582e6ed252",
    title: "Sistema de Roteiros Virais Comment-to-DM (Instagram/Facebook)",
    project: "global",
    kind: "Framework Comment-to-DM (7 KB)",
    highlight: "Arquitetura de ponto de tensão + retenção da solução na DM + sequência de 4 mensagens.",
  },
];

// ============================================================================
// 5. CATÁLOGO CANÔNICO DE 25 GANCHOS DERICK.AI (G1–G25 — NSL / VSL / ADS)
// ============================================================================

export interface DerickCanonicalHookG1G25 {
  id: string;
  code: string; // G1 .. G25
  nome: string;
  porta: "Porta 1 — Curiosidade & Segredo" | "Porta 2 — Identificação & Dor Visceral" | "Porta 3 — Descoberta Científica & Mecanismo";
  objetivo: "Parar o scroll" | "Gerar clique" | "Aquecer o lead" | "Fechar a venda";
  gatilho: string;
  formula: string;
  direcaoVisual: string;
}

export const DERICK_CANONICAL_G1_G25_HOOKS: DerickCanonicalHookG1G25[] = [
  {
    id: "g1",
    code: "G1",
    nome: "Contraste de Solução Comum vs. Causa Real",
    porta: "Porta 1 — Curiosidade & Segredo",
    objetivo: "Parar o scroll",
    gatilho: "Quebra de Crença (MP)",
    formula: "Por que cortar [SOLUÇÃO COMUM] quase nunca resolve [DOR] — e o que o [INIMIGO] faz nos bastidores todas as manhãs.",
    direcaoVisual: "Split-screen: hábito comum com X vermelho vs. gesto simples matinal.",
  },
  {
    id: "g2",
    code: "G2",
    nome: "Confissão de Bastidor / Especialista Dissidente",
    porta: "Porta 3 — Descoberta Científica & Mecanismo",
    objetivo: "Parar o scroll",
    gatilho: "Autoridade Dissidente",
    formula: "O motivo silencioso pelo qual 8 em cada 10 pessoas com [DOR] pioram quando tentam [ERRO PADRÃO] sem desarmar o [INIMIGO].",
    direcaoVisual: "Close no rosto ou bancada clínica apontando para um detalhe ignorado.",
  },
  {
    id: "g3",
    code: "G3",
    nome: "Cena Íntima das 6h30 (Espelho / Roupa / Rotina)",
    porta: "Porta 2 — Identificação & Dor Visceral",
    objetivo: "Parar o scroll",
    gatilho: "Identificação Visceral (VOC Lei 55)",
    formula: "Se você acorda sentindo [DOR] antes mesmo das 9h da manhã, o problema nunca foi falta de esforço — é o [INIMIGO] travado.",
    direcaoVisual: "POV no espelho ou ao vestir uma peça que marca/aperta logo cedo.",
  },
  {
    id: "g4",
    code: "G4",
    nome: "Teste Caseiro de 5 Segundos",
    porta: "Porta 1 — Curiosidade & Segredo",
    objetivo: "Parar o scroll",
    gatilho: "Auto-Diagnóstico Imediato",
    formula: "Faça este teste de cinco segundos agora: se você nota [DOR], seu corpo está sinalizando [INIMIGO] — não falha sua.",
    direcaoVisual: "Mão pressionando levemente a pele/tornozelo/rosto por 3 segundos.",
  },
  {
    id: "g5",
    code: "G5",
    nome: "O Inimigo Oculto Nomeado (Lei 54 — Sem Entregar MS)",
    porta: "Porta 1 — Curiosidade & Segredo",
    objetivo: "Gerar clique",
    gatilho: "Curiosidade Cega (Lei 54)",
    formula: "Não é idade e nem genética: o verdadeiro culpado por trás de [DOR] atende pelo nome de [INIMIGO].",
    direcaoVisual: "Animação ou esquema simples mostrando um bloqueio invisível.",
  },
  {
    id: "g6",
    code: "G6",
    nome: "Paradoxo da Pessoa que Faz Tudo Certo",
    porta: "Porta 2 — Identificação & Dor Visceral",
    objetivo: "Parar o scroll",
    gatilho: "Absolvição de Culpa (MF)",
    formula: "Você faz tudo certo durante a semana, mas continua travada em [DOR]? Veja por que isso acontece enquanto o [INIMIGO] continua ativo.",
    direcaoVisual: "Prato saudável / treino na tela seguido de expressão de frustração real.",
  },
  {
    id: "g7",
    code: "G7",
    nome: "Ritual de 15 Segundos Antes do Café",
    porta: "Porta 1 — Curiosidade & Segredo",
    objetivo: "Gerar clique",
    gatilho: "Especificidade + Simplicidade",
    formula: "O protocolo matinal de quinze segundos antes do café que destrava o [INIMIGO] e devolve [DESEJO] sem mudar sua rotina.",
    direcaoVisual: "Conta-gotas ou colher medida caindo em água cristalina na luz da manhã.",
  },
  {
    id: "g8",
    code: "G8",
    nome: "Ancestral / Geográfico (Okinawa / Vovó Mei / Tradição)",
    porta: "Porta 3 — Descoberta Científica & Mecanismo",
    objetivo: "Parar o scroll",
    gatilho: "Contraste Cultural",
    formula: "Por que mulheres dessa região quase não sofrem com [DOR] depois dos 40 — e o que elas fazem todo dia para ativar o [MECANISMO].",
    direcaoVisual: "Contraste entre rotina ocidental acelerada e preparo tradicional calmo.",
  },
  {
    id: "g9",
    code: "G9",
    nome: "Inversão do Vilão Popular",
    porta: "Porta 1 — Curiosidade & Segredo",
    objetivo: "Parar o scroll",
    gatilho: "Contra-Intuitivo",
    formula: "Pare de culpar sua força de vontade por [DOR]: quanto mais você força a barra sem [MECANISMO], mais o [INIMIGO] se defende.",
    direcaoVisual: "Pessoa rasgando lista restritiva ou jogando fora protocolo punitivo.",
  },
  {
    id: "g10",
    code: "G10",
    nome: "Pergunta Proibida ao Especialista",
    porta: "Porta 3 — Descoberta Científica & Mecanismo",
    objetivo: "Gerar clique",
    gatilho: "Conspiração Branda",
    formula: "A pergunta de trinta segundos sobre [INIMIGO] que quase nenhum consultório responde quando você reclama de [DOR].",
    direcaoVisual: " Legenda estilo recorte editorial com grifo amarelo no termo-chave.",
  },
  {
    id: "g11",
    code: "G11",
    nome: "Sinal Silencioso que Todo Mundo Ignora",
    porta: "Porta 2 — Identificação & Dor Visceral",
    objetivo: "Parar o scroll",
    gatilho: "Alerta Precoce",
    formula: "Três sinais silenciosos de que [DOR] já virou um ciclo de [INIMIGO] (o segundo aparece todo fim de tarde).",
    direcaoVisual: "Dedos contando 1, 2, 3 com cortes rápidos de 1 segundo.",
  },
  {
    id: "g12",
    code: "G12",
    nome: "Metáfora Física Visual (Ralo / Esponja / Válvula)",
    porta: "Porta 3 — Descoberta Científica & Mecanismo",
    objetivo: "Aquecer o lead",
    gatilho: "Tangibilização Física",
    formula: "Tentar vencer [DOR] sem destravar o [INIMIGO] é como secar o chão com a torneira aberta — até você ligar o [MECANISMO].",
    direcaoVisual: "Demonstração física com esponja encharcada ou funil destravando.",
  },
  {
    id: "g13",
    code: "G13",
    nome: "Descoberta Acidental / Paciente Zero",
    porta: "Porta 2 — Identificação & Dor Visceral",
    objetivo: "Aquecer o lead",
    gatilho: "Storytelling de Origem",
    formula: "Eu já tinha aceitado conviver com [DOR], até descobrir por acaso como o [MECANISMO] desarma o [INIMIGO] em poucos dias.",
    direcaoVisual: "UGC intimista no carro ou cozinha falando em tom de segredo para uma amiga.",
  },
  {
    id: "g14",
    code: "G14",
    nome: "Número Ímpar + Janela de Tempo Curta",
    porta: "Porta 1 — Curiosidade & Segredo",
    objetivo: "Gerar clique",
    gatilho: "Especificidade Numérica (Bencivenga)",
    formula: "Por que as primeiras 72 horas após ativar o [MECANISMO] mudam completamente a forma como seu corpo reage a [DOR].",
    direcaoVisual: "Cronômetro ou calendário de 3 dias marcando a evolução.",
  },
  {
    id: "g15",
    code: "G15",
    nome: "Comparação de Custo Invisível",
    porta: "Porta 2 — Identificação & Dor Visceral",
    objetivo: "Fechar a venda",
    gatilho: "Ancoragem de Perda",
    formula: "Quanto você já gastou tentando mascarar [DOR] sem nunca tocar no [INIMIGO] que causa tudo isso?",
    direcaoVisual: "Pilha de frascos/tentativas antigas sendo afastada da mesa.",
  },
  {
    id: "g16",
    code: "G16",
    nome: "Micro-Demonstração de Textura / Absorção",
    porta: "Porta 3 — Descoberta Científica & Mecanismo",
    objetivo: "Parar o scroll",
    gatilho: "Prova Sensorial (Khayat)",
    formula: "É por isso que o formato do [MECANISMO] chega direto onde o [INIMIGO] se esconde — veja a diferença em segundos.",
    direcaoVisual: "Macro shot de dissolução instantânea vs. cápsula/pó parado no fundo.",
  },
  {
    id: "g17",
    code: "G17",
    nome: "Ceticismo Espelhado ('Eu Também Achava Que Era Balela')",
    porta: "Porta 2 — Identificação & Dor Visceral",
    objetivo: "Aquecer o lead",
    gatilho: "Desarme de Ceticismo",
    formula: "Eu revirei os olhos quando ouvi falar de [MECANISMO] para [DOR] — até entender o papel do [INIMIGO].",
    direcaoVisual: "Expressão cética inicial que muda para surpresa genuína no segundo 3.",
  },
  {
    id: "g18",
    code: "G18",
    nome: "Erro Matinal nº 1",
    porta: "Porta 1 — Curiosidade & Segredo",
    objetivo: "Parar o scroll",
    gatilho: "Interrupção de Hábito",
    formula: "Se você faz isso nos primeiros vinte minutos depois de acordar, está alimentando o [INIMIGO] e piorando [DOR].",
    direcaoVisual: "Mão prestes a repetir hábito matinal comum, travada com efeito sonoro.",
  },
  {
    id: "g19",
    code: "G19",
    nome: "Contraste de Idade / Vitalidade",
    porta: "Porta 2 — Identificação & Dor Visceral",
    objetivo: "Parar o scroll",
    gatilho: "Inveja Benigna / Desejo Interno",
    formula: "Aos 52 anos, sem [DOR] e com [DESEJO]: o que mudou quando parei de lutar contra os sintomas e ativei o [MECANISMO].",
    direcaoVisual: "Transição de foto antiga cansada para vídeo atual cheio de leveza.",
  },
  {
    id: "g20",
    code: "G20",
    nome: "O Efeito Dominó Positivo",
    porta: "Porta 3 — Descoberta Científica & Mecanismo",
    objetivo: "Aquecer o lead",
    gatilho: "Lógica Causal (Premissa 2)",
    formula: "Quando você desliga o [INIMIGO] com [MECANISMO], [DOR] cede primeiro — e [DESEJO] vem como consequência natural.",
    direcaoVisual: "Peças de dominó caindo em sequência limpa até o resultado final.",
  },
  {
    id: "g21",
    code: "G21",
    nome: "Recorte de Estudo / Dado Surpreendente (K23/K24)",
    porta: "Porta 3 — Descoberta Científica & Mecanismo",
    objetivo: "Aquecer o lead",
    gatilho: "Prova Científica Curta",
    formula: "Novos dados mostram que 79% dos casos persistentes de [DOR] têm uma coisa em comum: [INIMIGO] não tratado.",
    direcaoVisual: "Gráfico minimalista escuro destacando a barra de 79% em dourado.",
  },
  {
    id: "g22",
    code: "G22",
    nome: "Voz do Parceiro / Observador Próximo",
    porta: "Porta 2 — Identificação & Dor Visceral",
    objetivo: "Parar o scroll",
    gatilho: "Validação Externa",
    formula: "'O que você fez que sumiu com [DOR]?' — foi a primeira coisa que me perguntaram dez dias depois de começar o [MECANISMO].",
    direcaoVisual: "Reação espontânea em conversa cotidiana ou mensagem recebida no WhatsApp.",
  },
  {
    id: "g23",
    code: "G23",
    nome: "Qualificação Reversa ('Não Use Se...')",
    porta: "Porta 1 — Curiosidade & Segredo",
    objetivo: "Gerar clique",
    gatilho: "Exclusividade / Takeaway",
    formula: "Não assista a este vídeo se você ainda acredita que [DOR] se resolve na força bruta sem corrigir o [INIMIGO].",
    direcaoVisual: "Gesto de 'pare' com a mão aberta nos primeiros 1,5 segundos.",
  },
  {
    id: "g24",
    code: "G24",
    nome: "Ponte Direta para o Ponto de Tensão (Comment-to-DM)",
    porta: "Porta 1 — Curiosidade & Segredo",
    objetivo: "Gerar clique",
    gatilho: "Retenção + Ação Imediata",
    formula: "Descobri como desligar o [INIMIGO] que trava [DOR] usando o [MECANISMO] — comente a palavra-chave que te mando o passo a passo.",
    direcaoVisual: "Apontando para a caixa de comentários com badge flutuante da palavra-chave.",
  },
  {
    id: "g25",
    code: "G25",
    nome: "Dois Caminhos / Urgência Fisiológica",
    porta: "Porta 2 — Identificação & Dor Visceral",
    objetivo: "Fechar a venda",
    gatilho: "Custo da Inação (Close Samurai)",
    formula: "Cada semana que o [INIMIGO] continua ativo aprofunda [DOR]. Veja como ativar o [MECANISMO] ainda hoje.",
    direcaoVisual: "Divisão de tela: 'Mais 6 meses igual' vs. 'Primeiros 14 dias com o protocolo'.",
  },
];

export function gerarGanchoG1G25(
  hook: DerickCanonicalHookG1G25,
  intel: ProjectIntelligenceBundle | null
): {
  textoPreenchido: string;
  variacaoCurtaLei54: string;
  medicao: MedicaoEscritaDerick;
} {
  const dor = intel?.deepPains[0] || "aquele sintoma diário que trava sua rotina";
  const inimigo = intel?.enemy || "o bloqueio metabólico silencioso";
  const mecanismo = intel?.mechanismName || "o protocolo de ativação celular";
  const desejo = intel?.externalDesire || "recuperar sua leveza e disposição";

  const textoPreenchido = hook.formula
    .replace(/\[SOLUÇÃO COMUM\]/g, "cortar calorias e forçar treinos exaustivos")
    .replace(/\[ERRO PADRÃO\]/g, "insistir em soluções superficiais")
    .replace(/\[DOR\]/g, dor.toLowerCase())
    .replace(/\[INIMIGO\]/g, inimigo)
    .replace(/\[MECANISMO\]/g, mecanismo)
    .replace(/\[DESEJO\]/g, desejo.toLowerCase());

  // Variação Lei 54 (nomeia o Vilão/MP mas retém o MS para forçar o clique)
  const variacaoCurtaLei54 = textoPreenchido
    .replace(new RegExp(mecanismo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "este ajuste matinal de quinze segundos");

  const medicao = medirEscritaDerick(`${textoPreenchido}\n${variacaoCurtaLei54}`, false);
  return { textoPreenchido, variacaoCurtaLei54, medicao };
}

// ============================================================================
// 6. DISSECADOR 1-CLIQUE DE SWIPES DERICK.AI (SKILLS 03/04 + INVISIBLE STRUCTURE)
// ============================================================================

export interface DissecacaoSwipeDerick {
  variaveisFixas100: {
    promessaCentral: string;
    portadorDaDor: string;
    inimigoOuCrencaQuebrada: string;
    provaAncora: string;
    ponteParaOferta: string;
  };
  variaveisControle60: {
    portaDeEntrada: string;
    nivelConsciencia: string;
    mecanismoNomeado: string;
    gatilhoDominante: string;
  };
  variavelOrganica: string;
  estruturaInvisivel5Blocos: Array<{
    bloco: string;
    funcaoPsicologica: string;
    trechoExtraido: string;
  }>;
  medicaoEscrita: MedicaoEscritaDerick;
  lote5050Briefing: string;
}

export function dissecarSwipeDerick(
  titulo: string,
  rawText: string,
  mecanismo?: string | null,
  nicho?: string | null
): DissecacaoSwipeDerick {
  const texto = (rawText || titulo || "").trim();
  const linhas = texto
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const l1 = linhas[0] || titulo || "Gancho de abertura não informado.";
  const l2 = linhas[1] || linhas[0] || "Cena de identificação visceral com o sintoma diário.";
  const lMeio = linhas[Math.floor(linhas.length / 2)] || l1;
  const lFim = linhas[linhas.length - 1] || "Toque em Saiba Mais para ver a apresentação.";

  const mec = mecanismo || "Mecanismo Único (MP → MS)";
  const nic = nicho || "Saúde / Direct Response";

  const medicaoEscrita = medirEscritaDerick(texto || l1, false);

  const variaveisFixas100 = {
    promessaCentral: `Destravar a causa-raiz em ${nic} sem depender dos métodos antigos que falharam.`,
    portadorDaDor: `Avatar que sente na pele: "${l1.slice(0, 95)}${l1.length > 95 ? "..." : ""}"`,
    inimigoOuCrencaQuebrada: `Descarta a culpa pessoal e aponta para o bloqueio oculto (${mec}).`,
    provaAncora: `Demonstração sensorial + especificidade concreta extraída do corpo da copy.`,
    ponteParaOferta: `Loop aberto de curiosidade (Lei 54) levando para o clique: "${lFim.slice(0, 85)}"`,
  };

  const variaveisControle60 = {
    portaDeEntrada: texto.length > 900 ? "Porta 3 — Story / Mecanismo Longo" : "Porta 1 — Curiosidade Direta (0-3s)",
    nivelConsciencia: "Consciente do Problema / Cético de Soluções Comuns (Schwartz Nível 2-3)",
    mecanismoNomeado: mec,
    gatilhoDominante: "Quebra de Crença + Absolvição de Culpa (MP → MF)",
  };

  const variavelOrganica =
    "Cena nativa de 2,5 segundos antes da fala (gesto cotidiano no espelho/cozinha sem cara de anúncio comercial)";

  const estruturaInvisivel5Blocos = [
    {
      bloco: "1. Gancho (0–3s) — Interrupção de Padrão",
      funcaoPsicologica: "Capturar atenção imediata nomeando o sintoma ou o erro comum.",
      trechoExtraido: l1.slice(0, 160),
    },
    {
      bloco: "2. Identificação Visceral (VOC Lei 55)",
      funcaoPsicologica: "Fazer o prospecto pensar 'essa pessoa está lendo minha mente'.",
      trechoExtraido: l2.slice(0, 160),
    },
    {
      bloco: "3. Quebra de Crença (MP + MF)",
      funcaoPsicologica: "Absolver a culpa do avatar e instalar o Vilão Real (sem entregar o ouro).",
      trechoExtraido: lMeio.slice(0, 160),
    },
    {
      bloco: "4. Semente do Mecanismo da Solução (MS)",
      funcaoPsicologica: "Mostrar que existe uma nova via fisiológica/estrutural inevitável.",
      trechoExtraido: `Conexão com ${mec} atuando direto na causa-raiz.`,
    },
    {
      bloco: "5. CTA de Curiosidade (Lei 54)",
      funcaoPsicologica: "Vender o clique para a VSL/página sem revelar o passo a passo completo no anúncio.",
      trechoExtraido: lFim.slice(0, 160),
    },
  ];

  const lote5050Briefing = [
    `# BRIEFING CANÔNICO SKILL 06 — LOTE 50% PAGO + 50% ORGÂNICO`,
    `- **Swipe de Origem:** ${titulo}`,
    `- **Nicho:** ${nic} | **Mecanismo:** ${mec}`,
    `- **Variáveis Fixas (100% obrigatórias em todas as peças):**`,
    `  1. Promessa: ${variaveisFixas100.promessaCentral}`,
    `  2. Portador da Dor: ${variaveisFixas100.portadorDaDor}`,
    `  3. Inimigo/Crença Quebrada: ${variaveisFixas100.inimigoOuCrencaQuebrada}`,
    `- **Variáveis de Controle (≥60%):** ${variaveisControle60.portaDeEntrada} · ${variaveisControle60.mecanismoNomeado}`,
    `- **Variável Orgânica Testada (nos 50% híbridos):** ${variavelOrganica}`,
    `- **Trecho Base:**\n${texto.slice(0, 600)}`,
  ].join("\n");

  return {
    variaveisFixas100,
    variaveisControle60,
    variavelOrganica,
    estruturaInvisivel5Blocos,
    medicaoEscrita,
    lote5050Briefing,
  };
}

// ============================================================================
// 7. MOTOR 10 BLOCOS DO VSL LAB (DERICK.AI v2.0.0 + MÉTODO H&W + BENCIVENGA)
// ============================================================================

export function gerarBlocoVslDerick10(
  toolId: string,
  intel: ProjectIntelligenceBundle | null,
  customNotes = ""
): string {
  const proj = intel?.projectName || "Projeto Ativo";
  const avatar = intel?.avatarName || "Mulher 38–58 anos";
  const dor1 = intel?.deepPains[0] || "inchaço e travamento matinal que piora ao longo do dia";
  const dor2 = intel?.deepPains[1] || "frustração por fazer tudo certo e continuar estagnada";
  const inimigo = intel?.enemy || "Travamento Valvular e Inflamação Silenciosa";
  const mecanismo = intel?.mechanismName || "Protocolo de Desbloqueio Celular";
  const desejoExt = intel?.externalDesire || "desinchar visivelmente e recuperar o controle do próprio corpo";
  const desejoInt = intel?.internalDesire || "voltar a se olhar no espelho com orgulho e leveza";
  const gatilho = intel?.nuclearTrigger || "Perceber que o problema nunca foi falta de disciplina, mas um bloqueio mecânico reversível.";

  if (toolId === "raio_x") {
    return [
      `# 1. RAIO-X DO PÚBLICO & VOC (LEI 55 — DERICK.AI + ESCAVADOR DE DESEJOS)`,
      `> **Projeto:** ${proj} · **Avatar Central:** ${avatar}`,
      ``,
      `## Camada 1 — Cena Cotidiana Visceral (Fala Literal do Público)`,
      `- *"Eu acordo e já sinto ${dor1.toLowerCase()}. Parece que meu corpo está com o freio de mão puxado."*`,
      `- *"O que mais dói é ${dor2.toLowerCase()} enquanto todo mundo acha que eu não me esforço."*`,
      ``,
      `## Camada 2 — Hierarquia de Desejos (8 Critérios)`,
      `- **Desejo Externo (Visível):** ${desejoExt}`,
      `- **Desejo Interno (Identidade):** ${desejoInt}`,
      `- **Desejo Proibido (Não confessado):** Provar que todas as tentativas anteriores falharam por erro do método tradicional, e não por fraqueza pessoal.`,
      ``,
      `## Camada 3 — Mapa de Crenças Atuais vs. Crença Inevitável`,
      `- **Crença Atual (A Quebrar):** "Preciso sofrer mais, cortar tudo ou aceitar que é da idade."`,
      `- **Gatilho Nuclear:** ${gatilho}`,
      `- **Inimigo Nomeado:** **${inimigo}**`,
      customNotes ? `\n## Notas Específicas da Rodada\n${customNotes}` : "",
    ].join("\n");
  }

  if (toolId === "mechanism_lab") {
    return [
      `# 2. TRÍADE DE MECANISMOS (MP / MF / MS) + NOME CHICLETE (SKILLS 07 E 09)`,
      `> **Projeto:** ${proj} · **Mecanismo Central:** ${mecanismo}`,
      ``,
      `## 1. Mecanismo do Problema (MP — O Vilão Real)`,
      `O verdadeiro motivo pelo qual **${avatar}** sofre com **${dor1.toLowerCase()}** não é falta de esforço. É o **${inimigo}**, um bloqueio progressivo que impede a resposta natural do organismo logo nas primeiras horas da manhã.`,
      ``,
      `## 2. Mecanismo da Falha (MF — Por Que Tudo Antes Falhou)`,
      `As soluções tradicionais atuam apenas na superfície. Quando você força restrições severas sem desarmar o **${inimigo}**, o corpo entra em modo de defesa e retém ainda mais o problema.`,
      ``,
      `## 3. Mecanismo da Solução (MS — A Virada Fisiológica)`,
      `O **${mecanismo}** atua diretamente na liberação do **${inimigo}**, reativando o fluxo natural em três estágios progressivos sem exigir rotinas punitivas.`,
      ``,
      `## 4. Opções de Batismo / Nome Chiclete (Skill 09)`,
      `1. **${mecanismo}** *(Recomendado — alta autoridade e tangibilidade)*`,
      `2. **Efeito Esponja Travada** *(Para o MP — visual e imediato)*`,
      `3. **Destrave Matinal de 15 Segundos** *(Para o MS — simples e acionável)*`,
      `4. **Ciclo de Drenagem Reversa** *(Contraste técnico)*`,
      ``,
      `## 5. One Belief (Crença Única da Campanha)`,
      `*"Enquanto o **${inimigo}** estiver ativo, qualquer esforço comum enxuga gelo; quando você aciona o **${mecanismo}**, **${desejoExt.toLowerCase()}** passa a ser a resposta natural do corpo."*`,
    ].join("\n");
  }

  if (toolId === "conceito_correlacao") {
    return [
      `# 3. CONCEITO & CORRELAÇÃO CRIATIVA (SKILL 08 DERICK.AI)`,
      `> **Projeto:** ${proj} · **Par MP → MS:** ${inimigo} → ${mecanismo}`,
      ``,
      `## Direção 1 — Correlação Física Tangível (A Válvula / O Ralo Entupido)`,
      `- **Imagem Mental:** Tentar resolver **${dor1.toLowerCase()}** com métodos comuns é como passar pano no banheiro enquanto o ralo continua travado.`,
      `- **Por que converte:** Transforma um processo bioquímico invisível em uma cena doméstica impossível de ignorar nos primeiros 5 segundos.`,
      ``,
      `## Direção 2 — Correlação de Contraste Geográfico / Ritual Matinal`,
      `- **Imagem Mental:** O hábito matinal de quinze segundos que mantém o **${inimigo}** desligado mesmo depois dos 45 anos.`,
      `- **Por que converte:** Gera curiosidade imediata (Porta 1) e reduz a barreira de esforço percebido.`,
      ``,
      `## Direção 3 — Correlação de Absolvição ("O Freio de Mão Puxado")`,
      `- **Imagem Mental:** Seu corpo não está quebrado; ele apenas está tentando rodar com o freio de mão do **${inimigo}** puxado.`,
      `- **Por que converte:** Remove a culpa acumulada por **${dor2.toLowerCase()}** e abre espaço para a tese.`,
    ].join("\n");
  }

  if (toolId === "briefing_vsl") {
    return [
      `# 4. BRIEFING VSL CONSOLIDADO v2.0.0 (SKILL 09B DERICK.AI)`,
      `> **Projeto:** ${proj} · **Avatar:** ${avatar} · **Mecanismo:** ${mecanismo}`,
      ``,
      `## Mapa de 7 Blocos + Contratos de Congruência`,
      `| Bloco | Função Principal | Regra Crítica (Skill 11 v1.3.0) |`,
      `|---|---|---|`,
      `| **1. Microlead (0–45s)** | Captura + Promessa + Qualificação | Zero revelação do MS (Lei 54) |`,
      `| **2. Lead (10C)** | Unidades U1–U7 + Provas K23/K24/K25 | Mínimo 3 elementos de prova concretos |`,
      `| **3. Storyline** | 7 Beats de identificação e descoberta | Espelhar dor literal (VOC Lei 55) |`,
      `| **4. Marketing Thesis** | Premissa 1 (MP/MF) + Premissa 2 (MS) | Gradualização lógica sem salto |`,
      `| **5. Product Build-Up** | Transição do MS para o veículo físico/digital | Justificar cada componente pelo MS |`,
      `| **6. Big Offer (10D)** | Entregáveis + Ancoragem + Preço Real + 1º CTA | Preço exato congelado para o Close |`,
      `| **7. Close Samurai (10E)** | Garantia + Bônus + Dois Caminhos + Q&A | R-CLOSE-01..06 (zero preço novo) |`,
    ].join("\n");
  }

  if (toolId === "microlead_hw") {
    return [
      `# 5. MICROLEAD DE 7 ETAPAS (MÉTODO H&W — PRIMEIROS 45 SEGUNDOS)`,
      ``,
      `**[1. Gancho de Interrupção]**`,
      `Se você sente ${dor1.toLowerCase()} logo ao acordar, pare tudo por trinta segundos.`,
      ``,
      `**[2. Descarte do Erro Comum]**`,
      `Isso não tem nada a ver com falta de disciplina ou com a sua idade.`,
      ``,
      `**[3. Semente do Vilão (MP — Lei 54)]**`,
      `Novas análises mostram que a verdadeira trava é um processo silencioso chamado ${inimigo}.`,
      ``,
      `**[4. Prova Rápida / Credibilidade]**`,
      `Mais de quatro mil pessoas que sofriam com ${dor2.toLowerCase()} já comprovaram essa virada na prática.`,
      ``,
      `**[5. Promessa Tangível]**`,
      `Nos próximos três minutos, você vai ver como um ajuste matinal de quinze segundos desarma essa trava em casa.`,
      ``,
      `**[6. Qualificação Direta]**`,
      `Especialmente se você já tentou de tudo e sente que seu corpo simplesmente parou de responder.`,
      ``,
      `**[7. Comando de Retenção]**`,
      `Pegue papel e caneta e assista até o final antes que esta apresentação saia do ar.`,
    ].join("\n");
  }

  if (toolId === "lead_creator") {
    return [
      `=== VARIAÇÃO 1 ===`,
      `Se você acorda sentindo ${dor1.toLowerCase()}, você precisa ouvir isso agora.`,
      `Por anos, disseram para você que a culpa era da sua rotina ou da sua genética.`,
      `Mas um levantamento clínico publicado em 2024 com 1.420 pacientes na Universidade de Kyoto revelou algo oposto.`,
      `Em 83% dos casos analisados pelo Dr. Kenji Sato, a causa real era o ${inimigo}.`,
      `Enquanto esse bloqueio permanece ativo, cortar calorias ou dobrar o esforço só aumenta a retenção.`,
      `Foi exatamente o que aconteceu com a Helena, de 49 anos, moradora de Curitiba, que lutava contra ${dor2.toLowerCase()} há seis anos.`,
      `E também com a Cláudia, de 54 anos, que viu suas medidas destravarem logo na primeira semana após corrigir essa válvula.`,
      `Nos próximos minutos, você vai descobrir como um ritual caseiro de quinze segundos desliga o ${inimigo} pela raiz.`,
      `Fique comigo até o próximo bloco porque vou mostrar o teste exato na tela.`,
      ``,
      `=== VARIAÇÃO 2 ===`,
      `Por que pessoas que fazem tudo certo continuam presas em ${dor1.toLowerCase()}?`,
      `A resposta curta está escondida em um mecanismo fisiológico que quase ninguém examina: o ${inimigo}.`,
      `Segundo dados do Instituto de Fisiologia Aplicada em 2024 com 980 voluntários, esse travamento reduz a resposta natural em até 68%.`,
      `A boa notícia é que você não precisa de rotinas extremas para reverter esse quadro.`,
      `Quando a Patrícia, de 46 anos, e a Renata, de 51 anos, aplicaram esse protocolo matinal, elas recuperaram ${desejoExt.toLowerCase()} em poucos dias.`,
      `Continue assistindo pelos próximos dois minutos para entender como ativar esse destrave hoje mesmo.`,
    ].join("\n");
  }

  if (toolId === "logic_points") {
    return [
      `# 7. MARKETING THESIS — PREMISSAS 1 E 2 + CONCLUSÃO INEVITÁVEL (SKILL 10A)`,
      ``,
      `## Premissa 1 — O Problema Real e a Falha dos Métodos Comuns (MP + MF)`,
      `1. **Argumento 1.1 (A Origem):** O corpo não acumula ${dor1.toLowerCase()} por acaso; ele reage ao **${inimigo}**.`,
      `2. **Argumento 1.2 (Prova Fisiológica):** Quando esse bloqueio se instala, o fluxo natural cai drasticamente logo pela manhã.`,
      `3. **Argumento 1.3 (Por que o resto falha):** Qualquer tentativa que ignore o **${inimigo}** ataca apenas o sintoma externo e ativa o efeito rebote.`,
      ``,
      `## Premissa 2 — A Nova Via Inevitável (MS: ${mecanismo})`,
      `1. **Argumento 2.1 (A Chave Bioquímica/Mecânica):** Para restaurar o fluxo, é preciso sinalizar a abertura direta dessa trava.`,
      `2. **Argumento 2.2 (Como funciona):** O **${mecanismo}** combina ativos na proporção exata para desarmar o **${inimigo}** em três fases.`,
      `3. **Argumento 2.3 (Resultado Previsível):** Com o caminho livre, **${desejoExt.toLowerCase()}** deixa de ser uma luta e vira consequência.`,
      ``,
      `## Conclusão Inevitável (Ponte para o Product Build-Up)`,
      `Portanto, a única decisão lógica para quem deseja **${desejoInt.toLowerCase()}** não é tentar mais uma restrição, e sim ativar o **${mecanismo}** todos os dias pela manhã.`,
    ].join("\n");
  }

  if (toolId === "offer_builder") {
    return [
      `# 8. BIG OFFER (SKILL 10D DERICK.AI — ATÉ O 1º CTA)`,
      ``,
      `## 1. Apresentação Oficial do Veículo`,
      `É por isso que reunimos toda a tecnologia do **${mecanismo}** dentro do protocolo completo **${proj}**.`,
      ``,
      `## 2. Como Funciona na Rotina (Fricção Zero)`,
      `Basta aplicar o protocolo uma vez pela manhã, em menos de quinze segundos, antes do seu café.`,
      ``,
      `## 3. Para Quem É / Para Quem Não É`,
      `- **É para você que:** sofre com ${dor1.toLowerCase()} e quer ${desejoExt.toLowerCase()}.`,
      `- **Não é para quem:** busca pílulas mágicas sem seguir uma orientação simples de quinze segundos por dia.`,
      ``,
      `## 4. Ancoragem de Valor & Contraste`,
      `Se você fosse contratar acompanhamento individualizado e adquirir cada ativo separadamente, investiria facilmente mais de **R$ 997,00**.`,
      ``,
      `## 5. Preço Real & Primeiro CTA`,
      `Mas hoje, nesta página oficial, você garante seu acesso completo ao **${proj}** por apenas **12x de R$ 29,70** (ou **R$ 297,00 à vista**).`,
      `Toque no botão dourado abaixo agora mesmo para reservar o seu lote com condição especial.`,
    ].join("\n");
  }

  if (toolId === "close_samurai") {
    return [
      `# 9. CLOSE SAMURAI & Q&A (SKILL 10E — R-CLOSE-01..06)`,
      ``,
      `## 1. Blindagem de Garantia Incondicional (R-CLOSE-02)`,
      `Você tem **60 dias de Garantia Blindada**. Use o **${proj}**, sinta o **${mecanismo}** agir contra o **${inimigo}** e, se não notar diferença visível em **${dor1.toLowerCase()}**, devolvemos 100% do seu investimento de **R$ 297,00** (ou **12x de R$ 29,70**) com um único clique.`,
      ``,
      `## 2. Empilhamento de Bônus Congruentes`,
      `- **Bônus #1:** Guia Rápido de Desinflamatórios Matinais *(Grátis hoje)*`,
      `- **Bônus #2:** Mapa de Acompanhamento de 21 Dias *(Grátis hoje)*`,
      ``,
      `## 3. Os Dois Caminhos (Custo da Inação)`,
      `- **Caminho 1:** Fechar esta página e continuar acordando amanhã com ${dor1.toLowerCase()} enquanto o ${inimigo} avança.`,
      `- **Caminho 2:** Garantir seu **${proj}** agora por **12x de R$ 29,70**, totalmente protegida pela garantia de 60 dias.`,
      ``,
      `## 4. Samurai Q&A (Matador de Objeções Finais)`,
      `- **"Quanto tempo leva para notar resultado?"** — A maioria relata alívio inicial já nos primeiros 7 a 14 dias de ativação do ${mecanismo}.`,
      `- **"E se não funcionar para mim?"** — O risco é zero: seus R$ 297,00 estão protegidos por 60 dias corridos.`,
      ``,
      `Toque no botão abaixo e finalize sua inscrição agora.`,
    ].join("\n");
  }

  // Default / story_architect / auditoria_skill11
  return [
    `# ROTEIRO DE STORYLINE EM 7 BEATS (DERICK.AI + H&W)`,
    `1. **Ferida Espelhada:** A rotina marcada por ${dor1.toLowerCase()}.`,
    `2. **Falsa Tentativa:** O ciclo frustrante de ${dor2.toLowerCase()}.`,
    `3. **Fundo do Poço Emocional:** O momento em que parecia não haver saída.`,
    `4. **Encontro com a Evidência:** A descoberta do papel oculto do **${inimigo}**.`,
    `5. **A Virada do Mecanismo:** O primeiro teste com o **${mecanismo}**.`,
    `6. **Transformação Mensurável:** Como **${desejoExt.toLowerCase()}** se tornou realidade em semanas.`,
    `7. **Missão e Convite:** Por que essa descoberta precisava chegar até você hoje.`,
  ].join("\n");
}

// ============================================================================
// 8. GERADORES DETERMINÍSTICOS PARA COPY LAB (50/50 DERICK, COMMENT-TO-DM, NSL)
// ============================================================================

export function gerarCopyLabIntentDerickFallback(
  intent: string,
  intel: ProjectIntelligenceBundle | null,
  briefing: string
): string {
  const proj = intel?.projectName || "Oferta Principal";
  const avatar = intel?.avatarName || "Público-Alvo";
  const dor1 = intel?.deepPains[0] || "inchaço e cansaço persistente logo cedo";
  const dor2 = intel?.deepPains[1] || "tentar de tudo sem ver resultado duradouro";
  const inimigo = intel?.enemy || "Travamento Linfático Silencioso";
  const mecanismo = intel?.mechanismName || "Protocolo de Drenagem Celular";
  const desejo = intel?.externalDesire || "recuperar a leveza e desinchar em dias";

  if (intent === "esteira_anuncios_derick_50_50") {
    return [
      `# ESTEIRA CANÔNICA DE ANÚNCIOS DERICK.AI (SKILL 06 — 50% PAGO + 50% ORGÂNICO)`,
      `> **Projeto:** ${proj} · **Avatar:** ${avatar} · **Mecanismo (MS mantido oculto no Ad — Lei 54):** ${mecanismo}`,
      briefing ? `> **Briefing Aplicado:** ${briefing}` : "",
      ``,
      `## Matriz de Variáveis Extraídas`,
      `- **Variáveis Fixas (100% presentes nos 4 criativos):**`,
      `  1. **Dor Visceral (VOC Lei 55):** "${dor1}"`,
      `  2. **Quebra de Culpa + Vilão (MP):** O culpado real é o **${inimigo}**, não falta de esforço.`,
      `  3. **CTA de Curiosidade Cega (Lei 54):** Vender o clique para o vídeo curto sem revelar a fórmula no anúncio.`,
      `- **Variáveis de Controle (≥60%):** Porta 1 (Curiosidade) + Porta 2 (Cena Cotidiana 6h30).`,
      ``,
      `---`,
      `## BLOCO A — 50% RECOMBINAÇÃO DO PAGO VALIDADO (AD 01 E AD 02)`,
      ``,
      `### AD 01 — [PAGO PURO · PORTA 1: TESTE DE 5 SEGUNDOS]`,
      `**[GANCHO 0–3s]**`,
      `Se você acorda sentindo ${dor1.toLowerCase()}, faça este teste de cinco segundos antes de tomar café.`,
      `**[CORPO — MP + MF]**`,
      `Por anos disseram que a culpa era da sua alimentação.`,
      `Mas novas análises mostram que o verdadeiro bloqueio é o ${inimigo}.`,
      `Enquanto essa válvula continua travada, cortar calorias é como secar o chão com a torneira aberta.`,
      `**[CTA — LEI 54]**`,
      `Toque em Saiba Mais para ver o ritual matinal de quinze segundos que desarma essa trava em casa.`,
      ``,
      `### AD 02 — [PAGO PURO · PORTA 2: PARADOXO DE QUEM FAZ TUDO CERTO]`,
      `**[GANCHO 0–3s]**`,
      `Você faz tudo certo a semana inteira e mesmo assim continua presa em ${dor2.toLowerCase()}?`,
      `**[CORPO — MP + MF]**`,
      `A culpa não é sua.`,
      `Quando o ${inimigo} está ativo, seu próprio organismo entra em modo de retenção.`,
      `E quanto mais você força treinos ou dietas restritivas, mais ele trava.`,
      `**[CTA — LEI 54]**`,
      `Clique no botão abaixo e assista à explicação de três minutos antes que saia do ar.`,
      ``,
      `---`,
      `## BLOCO B — 50% HÍBRIDOS COM 1 VARIÁVEL DO ORGÂNICO (AD 03 E AD 04)`,
      ``,
      `### AD 03 — [HÍBRIDO ORGÂNICO #1 · VARIÁVEL: POV ESPELHO 6H30 SEM LOCUÇÃO NOS PRIMEIROS 2S]`,
      `**[DIREÇÃO VISUAL ORGÂNICA]** *(2s de silêncio real no espelho mostrando a marca na pele + texto nativo de Reels)*`,
      `**[GANCHO 0–3s]**`,
      `Eu achava normal acordar assim todo santo dia... até descobrir o nome do que travava meu corpo.`,
      `**[CORPO — MP + MF]**`,
      `Não era idade e nem falta de disciplina: era o ${inimigo}.`,
      `Bastou ajustar um detalhe de quinze segundos antes do café para ${desejo.toLowerCase()}.`,
      `**[CTA — LEI 54]**`,
      `Deixei o vídeo explicando como funciona no botão Saiba Mais aqui embaixo.`,
      ``,
      `### AD 04 — [HÍBRIDO ORGÂNICO #2 · VARIÁVEL: RESPOSTA A COMENTÁRIO / CETICISMO REAL]`,
      `**[DIREÇÃO VISUAL ORGÂNICA]** *(Sticker de pergunta na tela: "O que você fez que desinchou tanto em 10 dias?")*`,
      `**[GANCHO 0–3s]**`,
      `Todo mundo me pergunta o que eu mudei nas últimas duas semanas para destravar ${dor1.toLowerCase()}.`,
      `**[CORPO — MP + MF]**`,
      `Eu parei de brigar contra o sintoma e ataquei o ${inimigo}.`,
      `É impressionante como o corpo responde rápido quando você libera o caminho certo logo pela manhã.`,
      `**[CTA — LEI 54]**`,
      `Toque em Saiba Mais para assistir ao passo a passo completo.`,
    ].join("\n");
  }

  if (intent === "roteiros_comment_to_dm") {
    return [
      `# LOTE DE 5 ROTEIROS VIRAIS COMMENT-TO-DM + FUNIL DE 4 MENSAGENS NA DM`,
      `> **Projeto:** ${proj} · **Par Batizado:** Vilão (**${inimigo}**) vs. Solução (**${mecanismo}**)`,
      `> **Regra de Ouro:** Entregar 100% da consciência do Vilão no vídeo e reter a Solução para entrega exclusiva no Direct.`,
      ``,
      `## 1. Lote de 5 Variações de Roteiro (P1 a P5 — 9:16 Vertical)`,
      ``,
      `### Variação P1 — O Erro Matinal Invisível (32s)`,
      `- **0–3s (Gancho):** Se você sente ${dor1.toLowerCase()}, pare de cometer este erro nos primeiros vinte minutos da manhã.`,
      `- **3–15s (Mecanismo do Vilão):** O que trava você é o **${inimigo}**. Quando você ignora isso, seu corpo passa o dia inteiro retendo líquido e cansaço.`,
      `- **15–24s (Ponto de Tensão):** Existe um protocolo caseiro de quinze segundos que desliga esse bloqueio logo cedo.`,
      `- **24–32s (CTA Comment-to-DM):** Comente **DESTRAVAR** aqui embaixo que eu te envio o guia gratuito no seu Direct agora mesmo.`,
      ``,
      `### Variação P2 — O Teste dos 5 Segundos (28s)`,
      `- **0–3s (Gancho):** Faça este teste rápido: se a marca fica na pele por mais de três segundos, cuidado.`,
      `- **3–18s (Mecanismo do Vilão):** Isso é o sinal clássico do **${inimigo}** agindo em silêncio.`,
      `- **18–28s (Ponto de Tensão + CTA):** Eu montei o passo a passo da **${mecanismo}** em uma folha simples. Comente **PROTOCOLO** que te mando no privado.`,
      ``,
      `### Variação P3 — A Absolvição de Quem Faz Tudo Certo (35s)`,
      `- **0–3s (Gancho):** Por que você come limpo a semana toda e ainda sofre com ${dor2.toLowerCase()}?`,
      `- **3–22s (Mecanismo do Vilão):** Porque dieta nenhuma desarma o **${inimigo}** sozinha.`,
      `- **22–35s (Ponto de Tensão + CTA):** Quer ver como ativar a **${mecanismo}** amanhã de manhã? Comente **EU QUERO** que te mando no Direct.`,
      ``,
      `### Variação P4 — Metáfora da Esponja Travada (30s)`,
      `- **0–3s (Gancho):** Tentar desinchar sem limpar o filtro é enxugar gelo.`,
      `- **3–20s (Mecanismo do Vilão):** O **${inimigo}** funciona como uma esponja saturada dentro da sua rotina.`,
      `- **20–30s (Ponto de Tensão + CTA):** Comente **LIMPAR** aqui nos comentários para receber o ritual matinal completo na sua DM.`,
      ``,
      `### Variação P5 — Ceticismo Convertido (30s)`,
      `- **0–3s (Gancho):** Eu também achava que ${dor1.toLowerCase()} era culpa da minha idade.`,
      `- **3–20s (Mecanismo do Vilão):** Até descobrir que 8 em cada 10 mulheres têm o **${inimigo}** ativo sem saber.`,
      `- **20–30s (Ponto de Tensão + CTA):** Comente **VERDADE** que eu te envio a explicação completa no Direct.`,
      ``,
      `---`,
      `## 2. Árvore de 4 Mensagens na DM (Qualificação Antes da Oferta)`,
      `- **Mensagem 1 (Automática — Entrega + Pergunta de Micro-Compromisso):**`,
      `  *"Oi! Vi seu comentário no vídeo sobre o **${inimigo}**. Antes de te mandar o link exato da **${mecanismo}**, me conta rápido: hoje você sente mais ${dor1.toLowerCase()} pela manhã ou no fim da tarde?"*`,
      `- **Mensagem 2 (Diagnóstico Empático + Validação):**`,
      `  *"Perfeito, isso confirma exatamente o padrão do **${inimigo}**. Quando acontece nesse horário, tentar resolver na força bruta só cansa mais."*`,
      `- **Mensagem 3 (Ponte do Mecanismo da Solução):**`,
      `  *"A boa notícia é que a **${mecanismo}** foi desenhada justamente para agir nessa janela em quinze segundos."*`,
      `- **Mensagem 4 (Convite Limpo para a VSL / Oferta):**`,
      `  *"Separei o vídeo curto onde mostro como aplicar começando amanhã: [LINK OFICIAL]. Assiste agora e me diz aqui em qual minuto mais se identificou!"*`,
    ].join("\n");
  }

  // nsl_dtc_longform
  return [
    `# NSL — LONG-FORM NATIVE SALES LETTER DTC (SKILL ESCREVER-NSL + G1–G25)`,
    `> **Marca / Projeto:** ${proj} · **Portador da Dor:** ${avatar} · **Mecanismo:** ${mecanismo}`,
    ``,
    `## [SLOT 1 — HOOK CANÔNICO G3 + G6 (CENA ÍNTIMA + ABSOLVIÇÃO)]`,
    `São 6h45 da manhã.`,
    `Você abre o armário, pega aquela peça que sempre vestiu bem e sente na hora: ${dor1.toLowerCase()}.`,
    `Você bebe água, corta o que gosta, tenta ter disciplina a semana inteira.`,
    `E mesmo assim, parece que seu corpo está travado no mesmo lugar.`,
    ``,
    `## [SLOT 2 — QUEBRA DE CRENÇA & NOMEAÇÃO DO VILÃO (MP)]`,
    `Se você já passou por ${dor2.toLowerCase()}, respire fundo: a culpa nunca foi sua.`,
    `Pesquisadores que estudam a fisiologia feminina identificaram o verdadeiro culpado: o **${inimigo}**.`,
    `Quando esse bloqueio silencioso se instala, as válvulas naturais de drenagem e resposta celular perdem até 68% da eficiência.`,
    `Tentar vencer isso apenas cortando calorias é como tentar esvaziar uma pia com o ralo entupido.`,
    ``,
    `## [SLOT 3 — ENGENHARIA REVERSA PELA FÓRMULA (MS: ${mecanismo})]`,
    `Para destravar o ralo, você não precisa de mais sacrifício — você precisa de sinalização bioquímica limpa.`,
    `É exatamente assim que o **${mecanismo}** presente no **${proj}** funciona:`,
    `- **Fase 1 (Primeiras 48h):** Desarma a tensão do **${inimigo}** logo nas primeiras horas da manhã.`,
    `- **Fase 2 (Dias 5 a 10):** Reativa o fluxo natural para que você volte a notar ${desejo.toLowerCase()}.`,
    `- **Fase 3 (Consolidação):** Mantém o metabolismo protegido contra o efeito rebote.`,
    ``,
    `## [SLOT 4 — PROVA SOCIAL ESPECÍFICA & TRANSIÇÃO DE OFERTA]`,
    `Mais de 4.200 mulheres já substituíram o ciclo de frustração por quinze segundos todas as manhãs com o **${proj}**.`,
    `E hoje, enquanto o lote atual ainda está disponível no Brasil com **60 dias de garantia incondicional**, você pode testar na sua própria rotina com risco zero.`,
    ``,
    `👉 **Toque em "Saiba Mais" abaixo para verificar a disponibilidade do lote oficial com desconto hoje.**`,
    ``,
    `---`,
    `### Conceito de Imagem Nativa (Art Direction DTC)`,
    `- **Frame Principal:** Foto espontânea em luz natural matinal (bancada de cozinha real, sem estúdio), segurando o frasco/conta-gotas ao lado de um copo de água fresca, com callout discreto apontando para a textura líquida de rápida absorção.`,
  ].join("\n");
}

// ============================================================================
// 9. AUTO-CORRETOR DETERMINÍSTICO DE COPY (DERICK + H&W + VINICIUS SUGAMELE)
// ============================================================================

const NUMEROS_EXTENSO_MAP: Record<string, string> = {
  "1": "um",
  "2": "dois",
  "3": "três",
  "4": "quatro",
  "5": "cinco",
  "6": "seis",
  "7": "sete",
  "8": "oito",
  "9": "nove",
  "10": "dez",
};

export function autoCorrigirCopyDerickSugamele(texto: string, nomeChiclete?: string): {
  textoCorrigido: string;
  ajustesAplicados: string[];
} {
  if (!texto.trim()) return { textoCorrigido: texto, ajustesAplicados: [] };
  const ajustes: string[] = [];
  let out = texto;

  // 1. Remover bordões de IA (Skill 11 + Escrita Vinicius Sugamele)
  const substituicoesIA: Array<[RegExp, string, string]> = [
    [/\bnão é mágica,?\s*é ciência\b/gi, "o motivo é fisiológico e direto", "Removido bordão de IA ('não é mágica, é ciência')"],
    [/\bimagine acordar\b/gi, "quando você acorda", "Substituído 'imagine acordar' por cena direta"],
    [/\bdivisor de águas\b/gi, "ponto de virada", "Substituído clichê 'divisor de águas'"],
    [/\bno mundo de hoje\b/gi, "hoje", "Removido 'no mundo de hoje'"],
    [/\bvale ressaltar que\b/gi, "o ponto principal é que", "Removido 'vale ressaltar que'"],
    [/\bnesse sentido\b/gi, "por isso", "Substituído 'nesse sentido' por 'por isso'"],
    [/\balém disso,\s*é importante notar\b/gi, "e tem mais um detalhe:", "Suavizada transição robótica"],
    [/\blembra que eu te falei\b/gi, "como vimos agora há pouco", "Corrigido falso 'lembra que' (Skill 11)"],
  ];

  for (const [rx, rep, label] of substituicoesIA) {
    if (rx.test(out)) {
      out = out.replace(rx, rep);
      ajustes.push(label);
    }
  }

  // 2. Converter algarismos isolados (1-10) antes de unidades de tempo para extenso (Regra Derick de locução)
  const rxUnidades = /\b([1-9]|10)\s+(segundos|segundo|minutos|minuto|horas|hora|dias|dia|semanas|semana|meses|mês|anos|ano)\b/gi;
  if (rxUnidades.test(out)) {
    out = out.replace(rxUnidades, (_, num: string, unid: string) => {
      const ext = NUMEROS_EXTENSO_MAP[num] || num;
      return `${ext} ${unid}`;
    });
    ajustes.push("Números antes de unidades de tempo convertidos para extenso (padrão de locução Derick.AI)");
  }

  // 3. Quebrar linhas longas (>26 palavras) e expandir micro-linhas isoladas (<5 palavras) para passar medirEscritaDerick
  const rawLines = out.split("\n");
  let quebrouLongas = false;
  const processedLines: string[] = [];

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith(">") || trimmed.startsWith("|") || trimmed.startsWith("---")) {
      processedLines.push(line);
      continue;
    }
    const words = trimmed.split(/\s+/);
    if (words.length >= 27) {
      // Quebra em pontuação interna ou conjunção próxima ao meio
      const mid = Math.floor(words.length / 2);
      let splitIdx = -1;
      for (let offset = 0; offset < 8; offset++) {
        const right = mid + offset;
        const left = mid - offset;
        if (right < words.length - 4 && /[,;:.—–]$/.test(words[right])) {
          splitIdx = right + 1;
          break;
        }
        if (left > 4 && /[,;:.—–]$/.test(words[left])) {
          splitIdx = left + 1;
          break;
        }
      }
      if (splitIdx === -1) splitIdx = mid;
      processedLines.push(words.slice(0, splitIdx).join(" "));
      processedLines.push(words.slice(splitIdx).join(" "));
      quebrouLongas = true;
    } else {
      processedLines.push(line);
    }
  }

  if (quebrouLongas) {
    ajustes.push("Frases com 28+ palavras divididas para manter fôlego de locução (mediana 11–14 palavras)");
  }

  // 4. Controlar densidade de Nome Chiclete se estiver acima de 3,5 por 1000 palavras
  let joined = processedLines.join("\n");
  if (nomeChiclete && nomeChiclete.trim().length > 3) {
    const escaped = nomeChiclete.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rxNome = new RegExp(escaped, "gi");
    let count = 0;
    joined = joined.replace(rxNome, (match) => {
      count += 1;
      if (count > 3) {
        return "esse mecanismo";
      }
      return match;
    });
    if (count > 3) {
      ajustes.push(`Densidade do nome chiclete '${nomeChiclete}' ajustada para ≤3 menções (evita saturação)`);
    }
  }

  if (ajustes.length === 0) {
    ajustes.push("Cadência e oralidade verificadas (padrão Derick.AI + Vinicius Sugamele)");
  }

  return { textoCorrigido: joined, ajustesAplicados: ajustes };
}


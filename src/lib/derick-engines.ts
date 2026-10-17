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

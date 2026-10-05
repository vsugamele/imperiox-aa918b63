// Ordem de teste de criativos (TST1.1): planejar, lançar (passos para o operador com o MCP da Meta),
// avaliar pela Esteira de Escala (P1) e decidir o que pausar. TS puro e testável.
import { deriveParams, evaluateConcept, evaluateP1Round, type ConceptVerdict, type ScaleParams } from "./scale-ladder.ts";

export interface TestVariantInput {
  angulo: string;
  hipotese?: string | null;
  image_url: string;
  texto?: string | null;
  headline?: string | null;
  cta?: string | null;
  referencia_id?: string | null;
  creative_asset_id?: string | null;
}

export interface TestOrderInput {
  project_id: string;
  nome: string;
  oferta: string;
  tipo_pagina?: string;
  pagina_url: string;
  checkout_url?: string | null;
  ad_account_id: string;
  page_id?: string | null;
  pixel_id?: string | null;
  verba_dia_conjunto: number;
  payout: number;
  cpa_alvo: number;
  ics_por_venda?: number;
  utm_campaign?: string | null;
  variantes: TestVariantInput[];
}

export interface PlannedVariant extends TestVariantInput {
  ordem: number;
  utm_content: string;
  link_url: string;
  nome_conjunto: string;
  nome_anuncio: string;
  cta: string;
}

export interface TestPlan {
  utm_campaign: string;
  nome_campanha: string;
  verba_dia_total: number;
  variantes: PlannedVariant[];
  referencia_esteira: ReturnType<typeof deriveParams>;
  problemas: string[];   // impedem o lançamento
  avisos: string[];      // não impedem, mas merecem atenção
}

/** Texto curto e sem acento para UTM e nomes. */
export function slug(text: string, max = 40): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max).replace(/-+$/g, "");
}

/** Link da variante com a UTM do teste; preserva query que a página já tenha. {{ad.id}} é preenchido pela Meta. */
export function variantLink(paginaUrl: string, utmCampaign: string, utmContent: string): string {
  const url = new URL(paginaUrl);
  url.searchParams.set("utm_source", "facebook");
  url.searchParams.set("utm_medium", "paid");
  url.searchParams.set("utm_campaign", utmCampaign);
  url.searchParams.set("utm_content", utmContent);
  return `${url.toString()}&utm_term={{ad.id}}`;
}

export function planTestOrder(input: TestOrderInput, today: string): TestPlan {
  const problemas: string[] = [];
  const avisos: string[] = [];
  let paginaOk = true;
  try {
    const u = new URL(input.pagina_url);
    if (u.protocol !== "https:") problemas.push("A página precisa ser https.");
  } catch {
    paginaOk = false;
    problemas.push("pagina_url inválida.");
  }
  if (input.variantes.length < 2) problemas.push("Um teste precisa de pelo menos 2 variantes (ângulos).");
  if (input.variantes.length > 20) problemas.push("Máximo de 20 variantes por teste.");
  if (!input.pixel_id) avisos.push("Sem pixel: a Meta não otimiza para compra e o veredito fica só com as vendas do Império.");
  if (!input.page_id) problemas.push("Falta a página do Facebook (page_id) que assina os anúncios.");

  const utm_campaign = input.utm_campaign?.trim() || `${slug(input.nome, 30)}-${today.slice(8, 10)}${today.slice(5, 7)}`;
  const seen = new Set<string>();
  const variantes: PlannedVariant[] = input.variantes.map((v, i) => {
    const ordem = i + 1;
    const nn = String(ordem).padStart(2, "0");
    const angSlug = slug(v.angulo, 24) || `angulo-${nn}`;
    if (seen.has(angSlug)) avisos.push(`Ângulo repetido: "${v.angulo}". Variantes do mesmo ângulo confundem o placar de hipóteses.`);
    seen.add(angSlug);
    if (!v.image_url) problemas.push(`Variante ${nn} sem arte (image_url).`);
    if (!v.texto?.trim()) problemas.push(`Variante ${nn} (${v.angulo}) sem texto do anúncio.`);
    if (!v.hipotese?.trim()) avisos.push(`Variante ${nn} (${v.angulo}) sem hipótese: o placar não aprende com ela.`);
    const utm_content = `${nn}-${angSlug}`;
    return {
      ...v,
      ordem,
      cta: v.cta || "LEARN_MORE",
      utm_content,
      link_url: paginaOk ? variantLink(input.pagina_url, utm_campaign, utm_content) : "",
      nome_conjunto: `${nn} ${angSlug} — ${v.angulo}`.slice(0, 120),
      nome_anuncio: `${slug(input.oferta, 12).toUpperCase()} ${nn} ${angSlug}`.slice(0, 120),
    };
  });

  const params: ScaleParams = { payout: input.payout, cpaAlvo: input.cpa_alvo, icsPorVenda: input.ics_por_venda };
  const ref = deriveParams(params);
  const verba_dia_total = Math.round(input.verba_dia_conjunto * variantes.length * 100) / 100;
  if (input.cpa_alvo > input.payout) avisos.push("CPA alvo acima do payout: o teste só confirma ângulos que dão prejuízo.");
  if (input.verba_dia_conjunto < ref.teto_custo_ic_mais_textos * 2) avisos.push(`Verba por conjunto baixa: em 2 dias pode não gastar R$ ${ref.teto_custo_ic_mais_textos * 2} para a Esteira julgar.`);

  return {
    utm_campaign,
    nome_campanha: `[${input.project_id}] ${input.nome} — teste de ângulos ABO`.slice(0, 150),
    verba_dia_total,
    variantes,
    referencia_esteira: ref,
    problemas,
    avisos,
  };
}

/** Passos para o operador lançar na Meta (MCP da Meta ou Gerenciador). Tudo pausado; ativar só com OK. */
export function launchSteps(order: { ad_account_id: string; page_id?: string | null; pixel_id?: string | null; verba_dia_conjunto: number }, plan: Pick<TestPlan, "nome_campanha" | "variantes">): string[] {
  const cents = Math.round(order.verba_dia_conjunto * 100);
  return [
    `1. Campanha: ads_create_campaign na conta ${order.ad_account_id}, objetivo OUTCOME_SALES, nome "${plan.nome_campanha}", SEM verba na campanha (ABO).`,
    `2. Para cada variante, um conjunto: ads_create_ad_set com daily_budget=${cents}, optimization_goal=OFFSITE_CONVERSIONS, promoted_object={"pixel_id":"${order.pixel_id ?? "<pixel>"}","custom_event_type":"PURCHASE"}, destination_type=WEBSITE, público aberto do país, nome = nome_conjunto.`,
    `3. Para cada variante, o criativo: ads_create_creative com page_id=${order.page_id ?? "<página>"}, image_url, message=texto, headline, call_to_action_type=cta, link_url (já com UTM).`,
    "4. Para cada variante, o anúncio: ads_create_ad no conjunto dela com o creative_id.",
    "5. Grave os ids no Império: record_test_launch (campanha e, por variante, conjunto, criativo e anúncio). O teste passa para 'pronto'.",
    "6. Ativar (campanha → conjuntos → anúncios) SÓ com o OK de alguém do time nesta conversa; depois record_test_launch com ativado=true (status 'no_ar').",
    "7. Avaliação: a cada leitura, evaluate_test_order com gasto, checkouts iniciados (IC) e compras por conjunto. Pausar na Meta só as variantes com decisão 'pausar' e se o teste tiver corte autorizado.",
  ];
}

// ── Avaliação ────────────────────────────────────────────────────────────────

export interface VariantReading { ordem: number; gasto: number; ic: number; vendas: number; vendas_imperio?: number }

export interface VariantState { ordem: number; angulo: string; hipotese?: string | null; status: string }

export type VariantDecision = "pausar" | "manter" | "vencedor" | "ja_parado";

export interface VariantEvaluation {
  ordem: number;
  angulo: string;
  veredito: ConceptVerdict;
  rotulo: string;
  acao: string;
  custo_por_ic: number | null;
  vendas_consideradas: number;
  decisao: VariantDecision;
  motivo: string;
}

/**
 * Veredito de cada variante pela Esteira P1 (só decide pausar a partir do fim do dia 2 no ar). Vendas = o maior entre o pixel e o Império (UTM):
 * se o pixel perdeu a compra, o ângulo não morre por isso.
 */
export function evaluateTestOrder(
  order: { payout: number; cpa_alvo: number; ics_por_venda?: number | null },
  variants: ReadonlyArray<VariantState>,
  readings: ReadonlyArray<VariantReading>,
  diasNoAr = 2,
) {
  const params: ScaleParams = { payout: Number(order.payout), cpaAlvo: Number(order.cpa_alvo), icsPorVenda: order.ics_por_venda ?? undefined };
  const byOrdem = new Map(readings.map((r) => [r.ordem, r]));
  const avaliacoes: VariantEvaluation[] = variants.map((v) => {
    const r = byOrdem.get(v.ordem);
    const vendas = Math.max(r?.vendas ?? 0, r?.vendas_imperio ?? 0);
    const ev = evaluateConcept({ concept: v.angulo, hipotese: v.hipotese ?? undefined, gasto: r?.gasto ?? 0, ic: r?.ic ?? 0, vendas }, params);
    let decisao: VariantDecision = "manter";
    let motivo = ev.acao;
    if (v.status === "pausado" || v.status === "morto") { decisao = "ja_parado"; motivo = "Já está parada."; }
    // A Esteira julga no fim do dia 2: antes disso nada morre, só recebe o veredito parcial.
    else if (ev.veredito === "morto" && diasNoAr < 2) { decisao = "manter"; motivo = `Ainda no dia ${Math.max(1, Math.ceil(diasNoAr))}: a Esteira só julga no fim do dia 2 (parcial: ${ev.rotulo}).`; }
    else if (ev.veredito === "morto") decisao = "pausar";
    else if (ev.veredito === "qualificado") { decisao = "vencedor"; motivo = `${ev.acao} Vendas: ${vendas}.`; }
    if (decisao === "pausar" && (r?.vendas_imperio ?? 0) > (r?.vendas ?? 0)) { decisao = "manter"; motivo = "Império tem venda que o pixel não viu: mantém e confere o pixel."; }
    return { ordem: v.ordem, angulo: v.angulo, veredito: ev.veredito, rotulo: ev.rotulo, acao: ev.acao, custo_por_ic: ev.custo_por_ic, vendas_consideradas: vendas, decisao, motivo };
  });
  const rodada = evaluateP1Round(variants.map((v) => {
    const r = byOrdem.get(v.ordem);
    return { concept: v.angulo, hipotese: v.hipotese ?? undefined, gasto: r?.gasto ?? 0, ic: r?.ic ?? 0, vendas: Math.max(r?.vendas ?? 0, r?.vendas_imperio ?? 0) };
  }), params);
  const gasto = Math.round(readings.reduce((s, r) => s + r.gasto, 0) * 100) / 100;
  const vendas = avaliacoes.reduce((s, a) => s + a.vendas_consideradas, 0);
  return {
    avaliacoes,
    pausar: avaliacoes.filter((a) => a.decisao === "pausar").map((a) => a.ordem),
    vencedores: avaliacoes.filter((a) => a.decisao === "vencedor").map((a) => a.ordem),
    gasto_total: gasto,
    vendas_total: vendas,
    cpa_geral: vendas ? Math.round((gasto / vendas) * 100) / 100 : null,
    placar_hipoteses: rodada.placar_hipoteses,
    rodada_p1: { concepts: variants.map((v) => { const r = byOrdem.get(v.ordem); return { concept: v.angulo, hipotese: v.hipotese ?? "", gasto: r?.gasto ?? 0, ic: r?.ic ?? 0, vendas: Math.max(r?.vendas ?? 0, r?.vendas_imperio ?? 0) }; }) },
  };
}

/** Pode a IA pausar sozinha? Só com corte autorizado por alguém e dentro do prazo. */
export function cutAllowed(order: { corte_autorizado_por?: string | null; corte_ate?: string | null; status: string }, today: string): { ok: boolean; motivo: string } {
  if (order.status !== "no_ar") return { ok: false, motivo: `Teste não está no ar (status ${order.status}).` };
  if (!order.corte_autorizado_por) return { ok: false, motivo: "Corte automático não autorizado neste teste: recomende e peça OK." };
  if (order.corte_ate && today > order.corte_ate) return { ok: false, motivo: `Autorização de corte venceu em ${order.corte_ate}.` };
  return { ok: true, motivo: `Corte autorizado por ${order.corte_autorizado_por}.` };
}

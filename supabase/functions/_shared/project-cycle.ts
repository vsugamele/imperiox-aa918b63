/** Deterministic, evidence-bound planning. This module never executes tools or external actions. */
export interface CycleSource {
  key: string;
  status: "available" | "missing" | "stale" | "error";
  origin: string;
  observed_at: string;
  data: unknown;
  problem?: string;
}

export interface CycleInput {
  project_id: string;
  project_name: string;
  objective: string | null;
  sources: CycleSource[];
  now: string;
}

export interface CycleAction {
  id: string;
  priority: number;
  category: string;
  reason: string;
  tool: string | null;
  arguments: Record<string, unknown>;
  dependencies: string[];
  autonomy: "read_only" | "prepare" | "approval_required";
  verification: string;
}

const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
const rows = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value.map(record) : [];
const numeric = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
const meaningful = (value: unknown): boolean => {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(meaningful);
  if (value !== null && typeof value === "object") return Object.values(record(value)).some(meaningful);
  return false;
};

export function buildProjectCycle(input: CycleInput) {
  const nextActions: CycleAction[] = [];
  const source = (key: string) => input.sources.find((item) => item.key === key);
  const available = (key: string) => source(key)?.status === "available";
  const readable = (key: string) => available(key) || source(key)?.status === "missing";
  const data = (key: string) => available(key) ? source(key)?.data : undefined;
  const projectArgs = { project_id: input.project_id };
  const add = (id: string, priority: number, category: string, reason: string, tool: string | null,
    verification: string, dependencies: string[] = [], args: Record<string, unknown> = projectArgs,
    autonomy: CycleAction["autonomy"] = "prepare") => {
    nextActions.push({ id, priority, category, reason, tool, arguments: args, dependencies, autonomy, verification });
  };

  const objective = input.objective?.trim() || null;
  if (!objective) add("define_objective", 1, "strategy", "O projeto não tem objetivo operacional explícito para orientar prioridades.", null,
    "Objetivo registrado com indicador, prazo, limite de investimento e responsável; decisão humana.");

  const diagnosticTools: Record<string, string> = {
    map: "get_project_map", kit: "get_project_kit", briefing: "get_briefing", rounds: "get_scale_rounds",
    live: "get_project_kit", financial_evidence: "get_project_kit",
  };
  for (const item of input.sources) {
    if (item.status === "available" || ["cycle_history", "ads_currency", "sales_currency", "sites"].includes(item.key) && item.status === "missing") continue;
    const statusReason = item.status === "error" ? "Falha de consulta; não permite concluir que faltam ativos."
      : item.status === "stale" ? "Evidência desatualizada; revalidar antes de decidir." : "Fonte indisponível; obter evidência antes de decidir.";
    add(`refresh_${item.key}`, item.status === "error" || item.status === "stale" ? 2 : 3, "evidence",
      `${item.key}: ${statusReason}${item.problem ? ` ${item.problem}` : ""}`, diagnosticTools[item.key] ?? null,
      `Nova consulta a ${item.origin} concluída e datada, sem erro.`, [], projectArgs, "read_only");
  }

  const financial = record(data("financial_evidence"));
  const live = record(data("live"));
  const parcial = record(live.parcial);
  const revenue = record(parcial.faturamento);
  const spend = record(parcial.gasto);
  const cpaTarget = numeric(record(parcial.cpa).alvo);
  const currencies = Array.isArray(financial.currencies)
    ? [...new Set(financial.currencies.filter((value): value is string => typeof value === "string" && !!value.trim()).map((value) => value.trim().toUpperCase()))] : [];
  const sync = record(financial.sync_health);
  const periodEnd = typeof financial.period_end === "string" ? Date.parse(financial.period_end) : NaN;
  const now = Date.parse(input.now);
  const periodStart = typeof financial.period_start === "string" ? Date.parse(financial.period_start) : NaN;
  const freshPeriod = Number.isFinite(now) && Number.isFinite(periodEnd) && Number.isFinite(periodStart)
    && periodStart <= periodEnd && periodEnd <= now && now - periodEnd <= 60 * 60 * 1000;
  const financialGaps: string[] = [];
  if (!available("live")) financialGaps.push("Painel ao vivo indisponível ou sem leitura atual.");
  if (!available("financial_evidence")) financialGaps.push("Evidência de moeda, período e sincronização indisponível.");
  if (cpaTarget === null || cpaTarget <= 0) financialGaps.push("CPA alvo positivo não definido.");
  if (revenue.fonte !== "webhook" || numeric(revenue.valor) === null) financialGaps.push("Faturamento sem confirmação pelo webhook do checkout; fallback Meta não comprova receita.");
  if (spend.fonte !== "meta" || numeric(spend.valor) === null) financialGaps.push("Gasto de anúncios sem fonte sincronizada.");
  if (sync.estado !== "ok" || !freshPeriod) financialGaps.push("Sincronização e período atual não comprovados.");
  if (financial.currency_complete !== true || currencies.length !== 1) financialGaps.push("Moeda única de todas as vendas e gastos não comprovada; valores não podem ser combinados.");
  const financialReady = financialGaps.length === 0;
  if (!financialReady) add("repair_measurement", 4, "measurement", financialGaps.join(" "), "get_project_kit",
    "CPA alvo positivo, receita webhook, gasto atual sincronizado e moeda única comprovados no mesmo período.",
    nextActions.filter((action) => action.id === "refresh_live" || action.id === "refresh_financial_evidence").map((action) => action.id), projectArgs, "read_only");

  const strategyDeps = objective ? [] : ["define_objective"];
  const project = record(data("project"));
  const productCount = rows(record(project.data).produtos).length;
  const offerDeps = productCount > 1 ? ["confirm_offer_scope"] : [];
  if (productCount > 1) add("confirm_offer_scope", 5, "strategy",
    "O projeto reúne múltiplos produtos/kits; confirmar a oferta e as páginas correspondentes antes de transferir referências ou resultados entre variantes.", null,
    "Oferta/variante, kits e destino explicitados na estratégia; nenhuma evidência de outra variante usada como resultado local.", strategyDeps);
  if (available("project") && !meaningful(project.avatar)) add("prepare_avatar", 10, "foundation",
    "Avatar não documentado na fonte consultada; estruturar desejos, objeções e psicologias usando pesquisa rastreável.", "get_executable_steps",
    "Avatar e hipóteses revisados com referências, sem apresentar hipótese como fato.", strategyDeps);
  if (readable("competitors") && rows(data("competitors")).length === 0) add("research_competitors", 11, "research",
    "Não há concorrentes cadastrados nesta leitura; preparar pesquisa e comparação de ofertas e funis.", "get_executable_steps",
    "Concorrentes com URLs verificadas, data da pesquisa e diferenciais observados.", strategyDeps);
  if (readable("references") && rows(data("references")).length === 0) add("collect_references", 12, "research",
    "Não há referências cadastradas nesta leitura; selecionar uma página e um vídeo para validar o padrão antes de ampliar.", "get_executable_steps",
    "Primeira referência validada com URL, tipo, ângulo e relação com o projeto.", strategyDeps);
  if (readable("knowledge")) add("review_knowledge", 13, "knowledge",
    rows(data("knowledge")).length ? "Há metadados de conhecimento; recuperar e revisar o conteúdo antes de aplicar metodologias." : "Não há conhecimento vinculado nesta leitura; localizar skills existentes antes de criar material.",
    "get_capabilities", "Conteúdo e versão das metodologias consultados; metadados sozinhos não comprovam aplicação.", strategyDeps, {}, "read_only");
  const siteKey = available("pages") ? "pages" : "sites";
  if (readable(siteKey)) {
    const sites = rows(data(siteKey));
    add("verify_sites", 14, "pages", sites.length
      ? "Há sites cadastrados; status e URL não comprovam publicação, checkout funcional ou conversão. Auditar um primeiro."
      : "Não há sites cadastrados nesta leitura; preparar uma página piloto usando padrões existentes.", "get_executable_steps",
    "Uma página validada no navegador com URL pública, CTA, checkout e rastreio; publicação exige aprovação.", [...strategyDeps, ...offerDeps]);
  }
  const foundationIds = nextActions.filter((action) => ["foundation", "research", "pages"].includes(action.category)).map((action) => action.id);
  const uncertainFoundation = ["project", "competitors", "references", "sites", "knowledge"].filter((key) => !available(key));
  const uncertaintyDeps = uncertainFoundation.filter((key) => source(key)).map((key) => `refresh_${key}`);
  add("plan_creative_pilot", 20, "creative", "Preparar uma hipótese de ângulo, mensagem e formato antes de gerar volume; confirmar referências e oferta.",
    "plan_batch", "Plano em modo plano, primeira peça revisada e critério de sucesso definidos antes de produção em lote.",
    [...strategyDeps, ...offerDeps, ...foundationIds, ...uncertaintyDeps], { ...projectArgs, modo: "plano", tamanho: 5 });
  add("diagnose_funnel", 21, "optimization", "Confrontar desempenho dos criativos, chegada dos leads e vendas verificadas antes de recomendar trocas ou cortes.",
    "diagnose_ads", "Diagnóstico com período, fontes, amostra, atribuição e hipótese por etapa; nenhuma campanha alterada.",
    financialReady ? [] : ["repair_measurement"], { ...projectArgs, dias: 7 }, "read_only");
  add("review_page_behavior", 22, "optimization", "Métricas agregadas e ID do Clarity não equivalem a análise de mapa de calor ou gravações.",
    "get_page_splits", "Confrontar conversão por página com mapa de calor e gravações reais no mesmo período; registrar evidência.",
    available("sites") ? ["verify_sites"] : uncertaintyDeps.filter((id) => id === "refresh_sites"), projectArgs, "read_only");
  add("review_x1", 23, "x1", "Mapear chegada, qualificação, objeções e resolução no X1; validar um caminho e suas permissões antes de automatizar envios.",
    "get_project_map", "Um caminho com eventos, responsável, limite de tentativas, intervenção humana e resultado verificável.", strategyDeps, projectArgs, "read_only");
  add("review_learning", 30, "learning", "Revisar rodadas e resultados para propor a próxima hipótese; aprovação ou geração de ativo não comprova venda nem ganho incremental.",
    "get_scale_rounds", "Hipótese, controle, período e resultado documentados; atualizar regras permanentes somente após revisão.",
    [...strategyDeps, ...(financialReady ? [] : ["repair_measurement"])], projectArgs, "read_only");

  return {
    project: { id: input.project_id, name: input.project_name }, objective, observed_at: input.now,
    sources: input.sources,
    next_actions: nextActions.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id)),
    completed_actions: [] as string[], external_actions_executed: false as const,
    economics: {
      ready_for_decisions: financialReady, gaps: financialGaps, currency: currencies.length === 1 ? currencies[0] : null,
      revenue: financialReady ? numeric(revenue.valor) : null,
      ad_spend: financialReady ? numeric(spend.valor) : null,
      revenue_less_ad_spend: financialReady ? Math.round(((numeric(revenue.valor) ?? 0) - (numeric(spend.valor) ?? 0)) * 100) / 100 : null,
      net_profit: null,
      note: "Receita menos mídia não é lucro líquido: custos do produto, taxas, impostos e reembolsos precisam de conciliação.",
    },
    limitations: [
      "Este ciclo prepara recomendações e leituras; não executa ferramentas, publica páginas, envia mensagens ou altera anúncios.",
      "Fontes ausentes, com erro ou desatualizadas não comprovam ausência de ativos.",
      "Cadastro de site e URL não comprovam publicação ou funcionamento.",
      "Metadados de skills não comprovam leitura ou aplicação de seu conteúdo.",
      "Clarity agregado, scroll e ID não comprovam análise de mapas de calor ou gravações.",
      ...(uncertainFoundation.length ? [`Planejamento criativo condicionado à validação das fontes: ${uncertainFoundation.join(", ")}.`] : []),
    ],
  };
}

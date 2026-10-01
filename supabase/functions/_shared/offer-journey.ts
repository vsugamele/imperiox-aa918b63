// Leitura derivada dos cadastros; não é configuração de execução ou um novo mapa salvo.
export interface JourneyLink { url: string; label: string; role?: string; source?: string; imageUrl?: string; imageSource?: string }
export interface JourneyProduct {
  name: string; price: string; paused: boolean; source: string;
  pages: JourneyLink[]; checkout: JourneyLink[];
}
export interface JourneyNode { label?: string | null; kind?: string | null; url?: string | null; image_url?: string | null }
export interface OfferJourneyStep {
  key: string; label: string; kind: string;
  registration: "registered" | "not_located" | "to_verify";
  assets: JourneyLink[];
  verification: string;
  configuration: "not_checked" | "not_applicable";
  execution: "not_checked";
  guidance?: {
    status: "proposed";
    reviewGroup: "conversion" | "delivery" | "relationship";
    description: string; notes: string;
  };
}
export interface OfferJourney {
  key: string; name: string; price: string | null; paused: boolean; source: string;
  steps: OfferJourneyStep[];
  reviewTasks?: OfferReviewTask[];
}
export interface OfferReviewTask {
  stageKey: string; stageLabel: string;
  origin: "proposed";
  category: "locate_link" | "verification";
  applicability: "to_confirm" | "to_review";
  reason: string; nextAction: string; sources: string[]; linkedAssets: number;
}
export interface OfferJourneyReading {
  offers: OfferJourney[];
  projectAssets: JourneyNode[];
  interpretation: string;
}

/** Public asset projection only; reject credential-bearing links without rewriting source URLs. */
export function readPublicAssetUrl(value: unknown): string {
  if (typeof value !== "string" || !/^https?:\/\/\S+$/i.test(value)) return "";
  try {
    const url = new URL(value);
    if (url.username || url.password) return "";
    const sensitive = /token|secret|password|passwd|credential|authorization|api[-_]?key|email|e[-_]?mail|phone|telefone|cpf|click[-_]?id|fbclid|gclid/i;
    const params = [url.searchParams, new URLSearchParams(url.hash.slice(1).replace(/^.*?\?/, ""))];
    if (params.some(part => [...part.keys()].some(key => sensitive.test(key)))) return "";
    return value;
  } catch {
    return "";
  }
}

const STEPS = [
  { key: "sales", label: "Páginas da oferta", kind: "pagina_vendas", verification: "Conferir a função de cada página, promessa, preço e CTA; capturar print real e seguir até o checkout." },
  { key: "checkout", label: "Checkout", kind: "checkout", verification: "Conferir produto, preço, meios de pagamento e redirecionamento; URL cadastrada não prova checkout funcionando." },
  { key: "payment", label: "Compra aprovada", kind: "compra", verification: "Conciliar pedido único e evento de pagamento com esta oferta; testar idempotência, falha e regra de reembolso." },
  { key: "thanks", label: "Página de obrigado", kind: "obrigado", verification: "Confirmar se a oferta usa página de obrigado e localizar a URL após pagamento; conferir CTA de acesso ou convite. Se aplicável e a ausência for confirmada, preparar proposta da página sem publicar." },
  { key: "email", label: "E-mail de compra / acesso", kind: "email", verification: "Confirmar aplicabilidade e conferir provedor (Resend ou outro), remetente, gatilho, template e vínculo com a oferta. Separar tentativa, aceitação e entrega/falha por compra; não reenviar automaticamente." },
  { key: "members", label: "Área de membros", kind: "area_membros", verification: "Confirmar se esta entrega usa membros; quando aplicável, conferir URL, login e vínculo exato ao programa/plano. Área de membros do projeto não comprova acesso do comprador." },
  { key: "delivery", label: "Entrega do produto", kind: "processo", verification: "Conferir pacote esperado e saída real: cursos/planos e duração, ou entrega física/serviço, conforme a oferta. Permissão concedida não é consumo; revisar falha e reembolso." },
  { key: "group", label: "Grupo / relacionamento", kind: "grupo_whatsapp", verification: "Definir se a oferta usa grupo; conferir convite, entrada e rotina. Se não se aplicar, registrar essa decisão; não inferir grupo pelo projeto." },
  { key: "ascension", label: "Próxima oferta / ascensão", kind: "upsell", verification: "Confirmar se há estratégia de ascensão e, quando aplicável, destino, critérios comerciais, responsável e limite. Registrar proposta versus mensagem enviada e conversão; não iniciar contatos por esta leitura." },
] as const;

type StepKey = (typeof STEPS)[number]["key"];
interface GuideFields {
  reviewGroup: NonNullable<OfferJourneyStep["guidance"]>["reviewGroup"];
  inputs: string; output: string; dependencies: string; metrics: string; failure: string;
}
// Roteiros de conferência, não metas, métodos comerciais ou configuração de agentes.
const GUIDES: Record<StepKey, GuideFields> = {
  sales: {
    reviewGroup: "conversion",
    inputs: "Links desta oferta, contexto da campanha, preço/condição e pacote prometido; fontes com data.",
    output: "Ficha por página/variante com função observada, CTA, pacote, print real quando disponível e pendências.",
    dependencies: "Identidade exata da oferta e campanha; não herdar promessa ou bônus de outra página pelo checkout compartilhado.",
    metrics: "Sessões únicas, clique de checkout e erros por página/campanha/janela, somente quando instrumentados; metas e cobertura a conferir.",
    failure: "Registrar página indisponível, preço/pacote divergente ou origem perdida; preparar correção local sem publicar nem inventar print.",
  },
  checkout: {
    reviewGroup: "conversion",
    inputs: "Destino cadastrado e oferta/produto exatos, preço/condição e origem da sessão.",
    output: "Conferência de destino, oferta, preço e redirecionamento com evidência; compra não realizada por esta leitura.",
    dependencies: "Checkout e rastreio específicos da oferta; qualquer compra de teste exige autorização própria.",
    metrics: "Sessões de checkout, conversão e falhas por estado/período quando coletadas; URL não é prova de compra.",
    failure: "Registrar carregamento, oferta ou preço incorretos; não substituir checkout por aproximação nem iniciar pagamento.",
  },
  payment: {
    reviewGroup: "conversion",
    inputs: "Pedido/evento autorizado, estado confiável e vínculo exato à oferta, sem expor identificadores do comprador.",
    output: "Conciliação de compra única, vínculo ao evento e diagnóstico de deduplicação, pendência, falha e reembolso.",
    dependencies: "Integração/versão conferidas, identidade do produto externo e política de reembolso; sem alterar acesso por suposição.",
    metrics: "Compras únicas, divergências, recusas, pendências e receita líquida de reembolso por período/moeda; evento não equivale a pedido.",
    failure: "Registrar inconsistência e próximo ponto de investigação; reprocessamento exige fluxo autorizado e verificação de resultado anterior.",
  },
  thanks: {
    reviewGroup: "delivery",
    inputs: "Aplicabilidade do obrigado, compra confirmada, URL vinculada e orientação pós-compra esperada.",
    output: "Página/destino conferido com print real ou pendência; acesso e convite apresentados conforme estratégia confirmada.",
    dependencies: "Redirecionamento desta oferta, destino de entrega e grupo quando aplicável; não usar página de lançamento de outro contexto.",
    metrics: "Chegada após compra única, acesso, convite exibido e clique por variante/janela; clique não confirma entrada em grupo.",
    failure: "Marcar vínculo ausente ou destino falho; confirmar aplicabilidade e preparar alternativa sem fabricar URL ou publicar.",
  },
  email: {
    reviewGroup: "delivery",
    inputs: "Aplicabilidade da notificação, compra/concessão, provedor, remetente, gatilho e template vinculados.",
    output: "Vínculo entre compra, tentativa, aceitação do provedor e entrega/falha; conteúdo de acesso correto quando aplicável.",
    dependencies: "Integração e logs existentes, template e identidade da oferta; não tratar marcador sent como entrega confirmada.",
    metrics: "Tentativas, aceitação, entrega/falha e tempo de notificação, com janela e cobertura; custo conhecido ou não disponível.",
    failure: "Separar falha de envio, entrega e acesso; registrar diagnóstico, sem reenviar ou duplicar mensagem por esta leitura.",
  },
  members: {
    reviewGroup: "delivery",
    inputs: "Aplicabilidade da plataforma de membros, URL, conta e vínculo específico ao curso/programa/plano adquirido.",
    output: "Concessão e entrada verificadas quando aplicáveis, ou registro de que o produto usa outra forma de entrega.",
    dependencies: "Compra validada, regra específica e conteúdo real; plataforma compartilhada não concede todos os cursos automaticamente.",
    metrics: "Concessões, falhas, atraso e primeiro acesso por oferta/período; login na plataforma não comprova consumo da aula.",
    failure: "Registrar URL, permissão ou conteúdo faltante; encaminhar ao responsável sem unir, remover ou ampliar acessos.",
  },
  delivery: {
    reviewGroup: "delivery",
    inputs: "Pacote comercial desta campanha e tipo de entrega confirmado: curso/bônus, produto físico ou serviço.",
    output: "Checklist de cada item prometido ligado ao conteúdo/material, prazo/duração e evidência real de entrega ou pendência.",
    dependencies: "Conteúdo, concessão/logística/prestação aplicáveis; não usar número de permissões como quantidade de bônus nem copiar pacote entre ofertas.",
    metrics: "Itens entregues, prazo, falhas, divergências e consumo quando comprovável por janela; configuração não prova entrega.",
    failure: "Registrar divergência por item e responsável, preservando histórico; não inventar material, evento, resultado ou prazo.",
  },
  group: {
    reviewGroup: "relationship",
    inputs: "Decisão de usar ou não grupo, finalidade, link real, curso/campanha de origem e regras de convite.",
    output: "Aplicabilidade registrada e, se necessário, proposta de convite/cadência/método e verificação de entrada; nenhuma mensagem enviada.",
    dependencies: "Grupo e conector confirmados, limites de contato, responsável e medição; entrega do curso não depende de entrar no grupo.",
    metrics: "Convite exibido, clique, entrada confirmada, participação e dúvidas resolvidas por coorte/janela; sem integração medir só o que a fonte comprova.",
    failure: "Registrar link/conector/medição pendentes, ausência de aplicabilidade ou dúvida a encaminhar; não simular adesão ou atendimento.",
  },
  ascension: {
    reviewGroup: "relationship",
    inputs: "Decisão comercial de ascensão, interesse/contexto autorizado e próxima oferta confirmada, sem vincular pelo nome parecido.",
    output: "Hipótese de próximo passo com destino, método, critério de decisão e prova necessária; não oferta enviada por esta leitura.",
    dependencies: "Produto/destino/preço e responsável conferidos; webinar ou oferta direta são estratégias testáveis, não caminho universal.",
    metrics: "Interesse, resposta, presença quando aplicável e compras líquidas atribuídas por coorte/origem/janela; metas e amostra a cadastrar.",
    failure: "Registrar falta de estratégia, dados ou autoridade; não iniciar contatos nem declarar vencedor sem evidência.",
  },
};

function proposedGuidance(step: (typeof STEPS)[number]): NonNullable<OfferJourneyStep["guidance"]> {
  const guide = GUIDES[step.key];
  return {
    status: "proposed", reviewGroup: guide.reviewGroup,
    description: `OBJETIVO: Proposta de conferência da etapa — ${step.label}.`,
    notes: [
      `ENTRADAS: ${guide.inputs}`, `SAÍDA: ${guide.output}`,
      `PRONTO QUANDO: ${step.verification} Aplicabilidade, evidência datada e pendências registradas; isto não comprova funcionamento.`,
      "FREQUÊNCIA: Gatilho, cadência e responsável a configurar na fonte existente; esta leitura não agenda trabalho.",
      `DEPENDÊNCIAS: ${guide.dependencies}`, `MÉTRICAS: ${guide.metrics}`, `FALHA: ${guide.failure}`,
    ].join("\n"),
  };
}

/** Review order is not commercial priority, an execution queue or a confirmed blocker. */
export function readOfferReviewTasks(offer: OfferJourney): OfferReviewTask[] {
  return offer.steps.map(step => ({
    stageKey: step.key, stageLabel: step.label, origin: "proposed",
    category: step.registration === "not_located" ? "locate_link" : "verification",
    applicability: ["thanks", "email", "members", "group", "ascension"].includes(step.key) ? "to_confirm" : "to_review",
    reason: step.registration === "not_located"
      ? "Vínculo não localizado neste recorte; não comprova inexistência."
      : step.registration === "registered"
        ? "Link cadastrado; função e funcionamento não conferidos nesta leitura."
        : "Vínculo e execução não conferidos nesta leitura; não é falta confirmada.",
    nextAction: step.registration === "not_located" && step.key === "sales"
      ? "Localizar as páginas desta oferta e campanha e vincular as URLs na fonte existente; conferir promessa, pacote e CTA."
      : step.registration === "not_located" && step.key === "checkout"
        ? "Confirmar o caminho de compra desta oferta; localizar e vincular o checkout quando aplicável, sem iniciar pagamento."
        : step.verification,
    sources: [...new Set([offer.source, ...step.assets.map(asset => asset.source ?? offer.source)])],
    linkedAssets: step.assets.length,
  }));
}

/** Somente tipos explícitos vinculam um link a obrigado/membros; não usa nome ou URL parecida. */
export function readOfferJourneys(products: JourneyProduct[], nodes: ReadonlyArray<JourneyNode>): OfferJourneyReading {
  return {
    interpretation: "Grupos de conferência e contratos propostos, não conexões executadas ou agentes configurados. Verificar aplicabilidade de pós-compra, membros, grupo e ascensão por oferta; tarefas podem ocorrer em paralelo. Cadastros lidos nesta consulta; ausência neste recorte não prova inexistência. Elementos do projeto exigem vínculo explícito. Configuração e execução ainda não conferidas nesta leitura.",
    projectAssets: nodes.filter(node => ["area_membros", "obrigado", "email", "email_avulso", "grupo_whatsapp"].includes(node.kind ?? ""))
      .map(node => ({ label: node.label, kind: node.kind, url: readPublicAssetUrl(node.url) || null })),
    offers: products.map(product => {
      const role = (link: JourneyLink) => link.role?.toLowerCase().trim();
      const safePages = product.pages.filter(link => readPublicAssetUrl(link.url));
      const safeCheckout = product.checkout.filter(link => readPublicAssetUrl(link.url));
      const all = [...safePages, ...safeCheckout];
      const thanks = all.filter(link => role(link) === "obrigado");
      const members = all.filter(link => role(link) === "area_membros");
      const pages = safePages.filter(link => !["obrigado", "area_membros", "email", "email_avulso", "grupo_whatsapp"].includes(role(link) ?? ""));
      const checkout = safeCheckout.filter(link => !["obrigado", "area_membros", "email", "email_avulso", "grupo_whatsapp"].includes(role(link) ?? ""));
      const assets: Record<string, JourneyLink[]> = { sales: pages, checkout, thanks, members, email: all.filter(link => ["email", "email_avulso"].includes(role(link) ?? "")), group: all.filter(link => role(link) === "grupo_whatsapp") };
      const offer: OfferJourney = {
        key: product.source, name: product.name, price: product.price || null, paused: product.paused,
        source: `imphq_projects.${product.source}`,
        steps: STEPS.map(step => ({ ...step, guidance: proposedGuidance(step),
          assets: (assets[step.key] ?? []).map(link => {
            const node = nodes.find(node => node.url === link.url && readPublicAssetUrl(node.image_url));
            const registered: JourneyLink = { url: link.url, label: link.label, role: link.role, source: link.source };
            return node ? { ...registered, imageUrl: node.image_url ?? undefined, imageSource: "imphq_company_map_nodes.image_url · URL exata" } : registered;
          }),
          registration: assets[step.key]?.length ? "registered" : assets[step.key] ? "not_located" : "to_verify",
          configuration: ["sales", "thanks"].includes(step.key) ? "not_applicable" : "not_checked",
          execution: "not_checked",
        })),
      };
      offer.reviewTasks = readOfferReviewTasks(offer);
      return offer;
    }),
  };
}

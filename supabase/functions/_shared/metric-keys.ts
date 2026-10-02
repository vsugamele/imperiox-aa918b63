// Catálogo único de métricas: o que playbooks, etapas do mapa e o MCP podem medir, e de onde vem o dado.
// TS puro. `disponivel` = a fonte já recebe dados hoje; as outras ficam no mapa como "sem fonte" até ligar.

export type MetricScope = "etapa" | "projeto";
export type MetricUnit = "numero" | "moeda" | "percentual" | "posicao";

export interface MetricKey {
  key: string;
  label: string;
  unidade: MetricUnit;
  escopo: MetricScope;
  fonte: string;          // tabela/função de origem
  disponivel: boolean;
  descricao: string;
}

export const METRIC_KEYS: MetricKey[] = [
  // Páginas e funil (tracker do Império)
  { key: "sessoes_pagina", label: "Sessões na página", unidade: "numero", escopo: "etapa", fonte: "imphq_events (page_url da etapa)", disponivel: true, descricao: "Sessões distintas na URL da etapa, sem heartbeat." },
  { key: "cliques_checkout", label: "Cliques para o checkout", unidade: "numero", escopo: "etapa", fonte: "imphq_events InitiateCheckout", disponivel: true, descricao: "Cliques que levaram ao checkout a partir da página da etapa." },
  { key: "taxa_clique_checkout", label: "Taxa de clique para o checkout", unidade: "percentual", escopo: "etapa", fonte: "imphq_events", disponivel: true, descricao: "Cliques para o checkout ÷ sessões da página." },
  { key: "leads", label: "Leads", unidade: "numero", escopo: "projeto", fonte: "imphq_leads", disponivel: true, descricao: "Leads novos do projeto no período." },
  // Conversa (X1)
  { key: "conversas_x1", label: "Conversas 1 a 1 novas", unidade: "numero", escopo: "projeto", fonte: "imphq_wa_conversations (sem grupos)", disponivel: true, descricao: "Conversas individuais iniciadas no período." },
  { key: "respostas_ia", label: "Respostas da IA", unidade: "numero", escopo: "projeto", fonte: "imphq_wa_messages sent_by=ai", disponivel: true, descricao: "Mensagens enviadas pela IA de atendimento." },
  // Venda
  { key: "vendas", label: "Vendas aprovadas", unidade: "numero", escopo: "projeto", fonte: "imphq_vendas", disponivel: true, descricao: "Vendas aprovadas no período." },
  { key: "receita", label: "Receita", unidade: "moeda", escopo: "projeto", fonte: "imphq_vendas", disponivel: true, descricao: "Soma das vendas aprovadas (moeda da venda)." },
  { key: "vendas_com_origem", label: "Vendas com origem", unidade: "percentual", escopo: "projeto", fonte: "imphq_vendas utm_source", disponivel: true, descricao: "Vendas aprovadas com UTM ÷ vendas aprovadas." },
  { key: "recuperadas", label: "Vendas recuperadas", unidade: "numero", escopo: "projeto", fonte: "imphq_vendas + recuperação", disponivel: false, descricao: "Pagamentos fechados depois de abandono ou pendência." },
  // Anúncio
  { key: "gasto_ads", label: "Gasto em anúncios", unidade: "moeda", escopo: "projeto", fonte: "imphq_ads_spend", disponivel: true, descricao: "Gasto sincronizado das contas de anúncio." },
  { key: "cpa", label: "Custo por venda (CPA)", unidade: "moeda", escopo: "projeto", fonte: "imphq_ads_spend ÷ imphq_vendas", disponivel: true, descricao: "Gasto ÷ vendas aprovadas no período." },
  { key: "roas", label: "ROAS", unidade: "numero", escopo: "projeto", fonte: "imphq_vendas ÷ imphq_ads_spend", disponivel: true, descricao: "Receita ÷ gasto no período." },
  { key: "cpl", label: "Custo por lead (CPL)", unidade: "moeda", escopo: "projeto", fonte: "imphq_ads_spend ÷ imphq_leads", disponivel: true, descricao: "Gasto ÷ leads no período." },
  // Conteúdo orgânico (esteira GeeLark)
  { key: "posts_publicados", label: "Posts publicados", unidade: "numero", escopo: "projeto", fonte: "imphq_content_posts status=published", disponivel: true, descricao: "Posts publicados pela esteira no período." },
  { key: "views_conteudo", label: "Visualizações", unidade: "numero", escopo: "projeto", fonte: "imphq_content_metrics_daily", disponivel: true, descricao: "Visualizações somadas dos posts." },
  { key: "seguidores", label: "Seguidores", unidade: "numero", escopo: "projeto", fonte: "imphq_content_metrics_daily", disponivel: true, descricao: "Seguidores no último dia medido." },
  { key: "comentarios", label: "Comentários", unidade: "numero", escopo: "projeto", fonte: "imphq_content_metrics_daily", disponivel: true, descricao: "Comentários somados dos posts (inclui a palavra-gatilho)." },
  { key: "cliques_bio", label: "Cliques no link da bio", unidade: "numero", escopo: "etapa", fonte: "imphq_events utm_medium=bio", disponivel: true, descricao: "Sessões que chegaram pelo link da bio (UTM de bio)." },
  // Webinar / lançamento
  { key: "inscritos", label: "Inscritos", unidade: "numero", escopo: "projeto", fonte: "imphq_leads (captura do evento)", disponivel: true, descricao: "Cadastros na página de inscrição." },
  { key: "presenca_live", label: "Presença na live", unidade: "numero", escopo: "etapa", fonte: "registro manual da etapa", disponivel: false, descricao: "Pico de pessoas ao vivo (informado na etapa)." },
  // SEO
  { key: "seo_cliques", label: "Cliques orgânicos (Google)", unidade: "numero", escopo: "projeto", fonte: "Search Console", disponivel: false, descricao: "Cliques vindos da busca orgânica." },
  { key: "seo_impressoes", label: "Impressões orgânicas", unidade: "numero", escopo: "projeto", fonte: "Search Console", disponivel: false, descricao: "Vezes que o site apareceu na busca." },
  { key: "seo_posicao_media", label: "Posição média", unidade: "posicao", escopo: "projeto", fonte: "Search Console", disponivel: false, descricao: "Posição média nas buscas acompanhadas." },
  { key: "seo_saude", label: "Saúde técnica do site", unidade: "percentual", escopo: "etapa", fonte: "imphq_seo_audits", disponivel: false, descricao: "Itens técnicos de SEO aprovados na última auditoria." },
];

const BY_KEY = new Map(METRIC_KEYS.map((m) => [m.key, m]));

export function metricKey(key: string | null | undefined): MetricKey | null {
  return key ? BY_KEY.get(key) ?? null : null;
}

export function isMetricKey(key: string): boolean {
  return BY_KEY.has(key);
}

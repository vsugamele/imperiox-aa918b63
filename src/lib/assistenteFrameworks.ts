// Frameworks de boas práticas por área. Usado para checklist estrutural.
export type Area = "campanhas" | "lancamento" | "nutricao";

export interface FrameworkItem {
  key: string;
  label: string;
  hint: string;
  weight: number; // peso no score (0-100 total por área)
}

export const FRAMEWORKS: Record<Area, FrameworkItem[]> = {
  campanhas: [
    { key: "welcome", label: "Mensagem de boas-vindas", hint: "Primeiro toque define o ritmo", weight: 10 },
    { key: "aquecimento", label: "Sequência de aquecimento (3+ msgs)", hint: "Lead frio precisa de contexto antes do CTA", weight: 15 },
    { key: "cta_checkout", label: "CTA direto para checkout", hint: "Sem CTA, sem venda", weight: 15 },
    { key: "recovery", label: "Recuperação de PIX/boleto", hint: "20-40% do faturamento extra", weight: 15 },
    { key: "upsell", label: "Upsell pós-compra", hint: "AOV +30% sem mais tráfego", weight: 10 },
    { key: "delays", label: "Anti-spam (delays e janela de envio)", hint: "Evita ban e melhora deliverability", weight: 10 },
    { key: "provider", label: "Provider WhatsApp configurado", hint: "Sem chip, nada roda", weight: 15 },
    { key: "variacoes", label: "Variações A/B de copy", hint: "Aprende o que converte", weight: 10 },
  ],
  lancamento: [
    { key: "avatar", label: "Avatar definido", hint: "Sem avatar, copy genérica", weight: 10 },
    { key: "mecanismo", label: "Mecanismo único", hint: "O 'porquê funciona' diferente", weight: 10 },
    { key: "captura", label: "Página de captura", hint: "Funil precisa de entrada", weight: 10 },
    { key: "aquecimento", label: "Sequência de aquecimento", hint: "7-15 dias antes do carrinho", weight: 10 },
    { key: "cpl", label: "CPL / Webinar / Evento ao vivo", hint: "Momento de máxima atenção", weight: 10 },
    { key: "carta", label: "Carta de vendas", hint: "Página que vende sozinha", weight: 10 },
    { key: "carrinho", label: "Sequência de carrinho aberto", hint: "4-7 dias de pressão", weight: 10 },
    { key: "recovery", label: "Recovery de carrinho", hint: "5-15% de recuperação", weight: 10 },
    { key: "posvenda", label: "Pós-venda e ascensão", hint: "Cliente vira fã", weight: 10 },
    { key: "metas", label: "Meta diária definida", hint: "Mede progresso real", weight: 10 },
  ],
  nutricao: [
    { key: "ativa", label: "Sequência ativa", hint: "Pausada = lead esfriando", weight: 20 },
    { key: "cadencia", label: "Cadência definida", hint: "Frequência consistente", weight: 15 },
    { key: "minimo_emails", label: "Pelo menos 12 e-mails", hint: "1 ano de relacionamento", weight: 15 },
    { key: "tags", label: "Tags de filtro configuradas", hint: "Segmenta o público certo", weight: 10 },
    { key: "templates", label: "Templates por estágio", hint: "Topo, meio e fundo de funil", weight: 15 },
    { key: "tracking", label: "Tracking de conversão", hint: "Sabe o que está convertendo", weight: 15 },
    { key: "reativacao", label: "Reativação 90d", hint: "Resgata lead frio", weight: 10 },
  ],
};

export const AREA_LABEL: Record<Area, string> = {
  campanhas: "Campanhas WhatsApp",
  lancamento: "Lançamento",
  nutricao: "Nutrição",
};

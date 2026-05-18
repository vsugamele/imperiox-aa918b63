
# Semana 1 — Resto da entrega (Clareza & UX)

Continuação do roadmap. Sidebar e `PageHeader` já estão prontos. Falta aplicar nas páginas e entregar o card "Hoje" no Dashboard + simplificação das tabs do Leads + OpenFlow v2.

## 1. Aplicar `PageHeader` nas páginas top

Substituir o cabeçalho atual (cada página tem o seu) por `<PageHeader />` padronizado em:

- `Dashboard.tsx` — KPI hero = Receita hoje | ação = "Ver alertas"
- `Leads.tsx` — KPI = Leads quentes agora | ação = "Importar lead"
- `Financas.tsx` — KPI = Receita do mês | ação = "Importar venda/ads"
- `OpenFlow.tsx` — KPI = Fluxos ativos | ação = "Nova automação"
- `Gerenciador.tsx` — KPI = ROAS dia | ação = "Atualizar Meta Ads"
- `Imperius.tsx` — KPI = Ações pendentes | ação = "Rodar scout"
- `Projetos.tsx`, `WhatsAppPage.tsx`, `Recuperacao.tsx`, `Metas.tsx`, `Cohort.tsx`, `Funis.tsx` — header padrão sem KPI hero (só título + ação)

Resultado: todas as páginas com mesma altura de header, mesma posição de ação primária, mesma tipografia. Hoje cada uma reinventa.

## 2. Dashboard: card "Hoje" (3 coisas que precisam de você agora)

Novo componente `src/components/dashboard/TodayCard.tsx` no topo do Dashboard, acima de qualquer outro bloco.

Lógica (1 query consolidada via edge function nova `dashboard-today` ou query no front por enquanto):
1. **Hot leads sem resposta há >10min** — count + link "Responder" → `/leads?filter=hot`
2. **Ads com CPA 2x acima da meta nas últimas 24h** — count + link → `/gerenciador?filter=alert`
3. **Vendas Pix/Boleto geradas e não pagas em >30min** — count + link → `/recuperacao`

Visual: 3 cards horizontais com semáforo (vermelho/amarelo/verde), número grande, 1 botão de ação. Se tudo zerado: "Tudo sob controle ✓".

## 3. Leads: consolidar tabs (8 → 4)

Tabs atuais incluem duplicação Automações + Nutrição + Jornada. Consolidar em:

- **Visão** (resumo, predições, UTMs)
- **Conversas** (WhatsApp + email)
- **Jornada** (timeline + automações ativas + nutrição — tudo num só lugar)
- **Vendas** (vendas + recuperação)

Mover o que sobra para um menu "Mais" se necessário. Sem perder funcionalidade — só reagrupar.

## 4. OpenFlow v2 (layout 2 colunas)

Refatorar `OpenFlow.tsx`:
- **Coluna esquerda (280px)**: árvore Projeto → Campanha → Fluxo. Item selecionado destaca em ouro.
- **Coluna direita**: editor do item selecionado (campanha ou fluxo).
- **Topo**: filtro de projeto + botões "+ Campanha" / "+ Fluxo".
- **Drawer único "Como conectar"**: junta Webhook URL + Guia + Templates num só lugar acessível pelo botão de info no topo.

Componente novo: `src/components/openflow/CampanhaTree.tsx`. Reusa `CampanhasManager` e `FlowEditor` existentes.

## Detalhes técnicos

**Sem migrações nesta semana.** Tudo frontend.

**Arquivos novos:**
- `src/components/dashboard/TodayCard.tsx`
- `src/components/openflow/CampanhaTree.tsx`

**Arquivos editados:**
- `src/pages/Dashboard.tsx` (adiciona TodayCard + PageHeader)
- `src/pages/Leads.tsx` (consolida tabs + PageHeader)
- `src/pages/OpenFlow.tsx` (layout 2 colunas + PageHeader)
- `src/pages/Financas.tsx`, `Gerenciador.tsx`, `Imperius.tsx`, `Projetos.tsx`, `WhatsAppPage.tsx`, `Recuperacao.tsx`, `Metas.tsx`, `Cohort.tsx`, `Funis.tsx` (só PageHeader)

**O que NÃO muda:**
- Lógica de queries, dados, edge functions, schema
- Funcionalidades existentes — só layout/agrupamento

## Ordem de execução

1. PageHeader em todas as páginas (batch, baixo risco)
2. TodayCard no Dashboard
3. Consolidação de tabs no Leads
4. OpenFlow v2 (maior risco, deixar por último)

Ao terminar: Semana 1 fechada e seguimos para Semana 2 (Performance & Custo).

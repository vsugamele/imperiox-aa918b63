## Onde estamos hoje

**Gerenciador** já tem: KPI cards com Δ%, alertas, tabela com verdict (ESCALAR/MATAR/SATURADO), bulk toggle, edição de orçamento, sparkline e histórico de ações. Falta autonomia operacional, contexto de criativo e visão de regras.

**Market Intel** já tem: 3 modos de pesquisa IA (Discovery / Trend Scan / Deep Dive), 4 abas (Nichos, Ângulos, Fábrica, DB), favoritos e export CSV. Falta persistência de histórico de pesquisas, comparação entre nichos e ponte com projetos.

---

## Gerenciador — 6 melhorias prioritárias

### 1. Painel de Regras Ativas (visível)
Hoje o `ads-rules-engine` roda toda hora mas o usuário não enxerga **quais regras estão ativas** nem **o que disparou**. Criar card no topo:
- Lista de regras (auto-pause CPA > 1.5x, auto-pause CTR < 0.8%, propor escala ROAS ≥ 2.5x)
- Toggle on/off por regra (persistido em `imphq_ads_rules`)
- Última execução + nº de ações tomadas nas últimas 24h

### 2. Bulk Actions expandidos
Hoje só pausa/ativa/duplica em massa. Adicionar:
- **Ajuste de orçamento em massa** (já existe BulkBudgetDialog — só conectar ao bulk bar)
- **Aplicar regra customizada**: "para os selecionados, pausar se CPA > X"
- **Exportar seleção como playbook** (json com ad_id + budget + status para replicar)

### 3. Pré-visualização de criativo inline
Coluna `thumbnail_url` já existe em `Row` mas não é exibida. Adicionar no nível "ad":
- Thumbnail 40px à esquerda do nome
- HoverCard com creative_body + creative_title (ambos já carregados)

### 4. Comparador de Campanhas (lado a lado)
Selecionar 2-3 campanhas → drawer com tabela comparativa de todas as métricas + gráfico de evolução de gasto (já temos `dailySpendByCamp`).

### 5. Anomaly detection visual
Marcar com badge ⚠️ campanhas onde a métrica do dia diverge >2σ da média histórica (CPA explodiu, CTR despencou). Já temos a série diária — basta calcular σ no front.

### 6. Atalhos de WhatsApp/Imperius
Botão "Pedir análise IA" por linha → abre chat do Imperius pré-carregado com o contexto da campanha (gasto, CPA, vendas, criativo). Aproveita o `copilot-imperius` existente.

---

## Market Intel — 5 melhorias prioritárias

### 1. Histórico de Pesquisas
Hoje cada `Pesquisa Profunda` sobrescreve `data.ai_market_intel` do projeto. Criar tabela `imphq_mi_searches` (project_id, mode, query, result_md, intel_data, created_at) e listar últimas 10 no header. Permite voltar pra análise antiga e comparar.

### 2. Comparador de Nichos
Checkbox nas linhas de "Mapa de Nichos" → seleciona 2-4 ofertas → abre painel com:
- Score side-by-side
- Ticket / Bump / Upsell / dor / sem-rosto
- Ângulos sugeridos compatíveis (cross-tab com aba Ângulos)

### 3. Ponte com Vendas Reais
Cruzar `NICHE_OFFERS` com `imphq_vendas` (por nicho/produto) e mostrar coluna "Você já testou?":
- ✅ se já vendeu produto similar (>0 vendas em 30d)
- 📊 link pro Dashboard filtrado
Transforma o Market Intel de catálogo estático em recomendador contextual.

### 4. Geração de Avatar/Briefing direto da oferta
Botão por linha: "Criar projeto com esta oferta" → pré-preenche briefing, avatar, oferta no `imphq_projects` usando o template. Reduz o tempo "vi nicho legal → testar" de horas pra 1 clique.

### 5. Trend Scan agendado
Hoje Trend Scan roda manual. Adicionar cron semanal (segundas 06h) que escaneia os 3 nichos favoritados do usuário e salva alerta se aparecer nova oportunidade com score > 8. Notifica via `notify-scheduler`.

---

## Detalhes técnicos

**Novas tabelas (mínimo):**
```sql
imphq_ads_rules (id, user_id, rule_type, params jsonb, enabled, last_run_at, runs_24h)
imphq_mi_searches (id, user_id, project_id, mode, query, result_md, intel_data jsonb, created_at)
```

**Novos componentes:**
- `gerenciador/RulesPanel.tsx`, `gerenciador/CampaignComparator.tsx`, `gerenciador/AnomalyBadge.tsx`
- `market-intel/SearchHistory.tsx`, `market-intel/NicheComparator.tsx`, `market-intel/CreateProjectFromOffer.tsx`

**Edge functions:**
- estender `ads-rules-engine` para ler `imphq_ads_rules` (em vez de hardcode)
- novo `mi-trend-scan-cron` (semanal)

---

## Sequência sugerida

**Sprint 1 (Gerenciador):** Painel de Regras (1) + Anomaly badges (5) + Thumbnail inline (3) → ~1 dia.
**Sprint 2 (Market Intel):** Histórico de pesquisas (1) + Ponte com vendas (3) + Criar projeto da oferta (4) → ~1 dia.
**Sprint 3:** Comparadores (Gerenciador 4 + MI 2) + bulk avançado + atalho Imperius → ~1 dia.

Posso começar pelo **Sprint 1** ou priorizar diferente — qual frente te dá mais resultado agora?
## Sprint 3 — Comparadores (entregue)

- `gerenciador/CampaignComparator.tsx`: drawer com tabela métrica × campanha (vencedor destacado) + sparkline de gasto por campanha. Disparado por botão **Comparar** no `BulkActionsBar` (2-4 selecionadas).
- `marketintel/NicheComparator.tsx`: checkbox por linha em "Mapa de Nichos" → drawer side-by-side comparando dor, ticket, bump/upsell, sem-rosto, score (vencedor em ouro).

Restante do plano (próximas iterações): Imperius shortcut por linha, criativo inline thumbnail (item 3), Trend Scan agendado.

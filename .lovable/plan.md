

## Plano: Reorganização de UX (Insights/Ads, Branding+Briefing, Roteiros, Comando)

Quatro mudanças estruturais para reduzir abas, unificar dados e dar mais clareza.

---

### 1. Finanças → Reformular Ads + KPIs (página `/financas`)

**Problema atual**: KPIs genéricos no topo, aba "Ads" densa com tabela paginada e diagnóstico Yoshitani separado da visão geral. Dados de ads não conversam com vendas.

**Nova estrutura da aba "Ads"**:
```text
┌──────────────────────────────────────────────────┐
│ KPIs Hero (4 cards grandes com semáforo)         │
│  ROAS Real • CPA Médio • Investido • Lucro Ads   │
├──────────────────────────────────────────────────┤
│ Diagnóstico Yoshitani (badges coloridos no topo) │
├──────────────────────────────────────────────────┤
│ Sub-tabs: [Visão] [Campanhas] [Criativos] [Logs] │
└──────────────────────────────────────────────────┘
```

- **KPIs Hero**: substituir os números soltos por 4 cards com:
  - Valor grande + delta vs período anterior (↑/↓ %)
  - Semáforo (verde/amarelo/vermelho) por benchmark
  - Tooltip explicando cálculo
- **Aba Visão Geral (`/financas` overview)**: adicionar mini-funil compacto (Investido → Cliques → Vendas → Receita → Lucro) acima da tabela de projetos.
- **Cruzamento Ads × Vendas**: card "Eficiência por Campanha" mostrando campanha • gasto • vendas atribuídas (UTM) • ROAS real, ordenado por ROAS.

---

### 2. Insights de Ads (em `ProjetoInsights.tsx`)

Já tem o funil de 6 etapas. Adicionar:
- **KPIs reformulados** com mesmo padrão hero do Finanças (4 cards: ROAS, CPA, Hook Rate, Frequência) com semáforo e benchmark visível.
- **Tabela compacta** "Top 5 Campanhas" no fim da aba Tráfego com link "Ver tudo em Finanças → Ads".

---

### 3. Roteiros Reels → Mover para dentro de Conteúdo IA

**Atual**: Aba separada `🎬 Roteiros Reels` no projeto.
**Novo**: Sub-tab dentro de `✍️ Conteúdo IA` (ProjetoCentralConteudo).

- Renomear aba pai para `✍️ Conteúdo` (mais curto).
- Dentro: `[Gerador]` `[Biblioteca]` `[Roteiros Virais]` `[Histórico]`.
- Remove o `<TabsTrigger value="reels">` do `ProjetoDetalhe`.

---

### 4. Branding + Briefing → Aba unificada "Identidade"

**Atual**: 2 abas separadas (📋 Briefing e 🎨 Branding).
**Novo**: aba única `🎨 Identidade` com 3 sub-tabs internas:
- `[Briefing]` — produtos, posicionamento, oferta (atual ProjetoBriefing).
- `[Branding]` — cores, fontes, logo, tom de voz (atual ProjetoBranding).
- `[Resumo Visual]` — card consolidado com nome, logo, paleta + 1 linha de cada produto (visão de "1 página" da marca).

Reduz 2 abas para 1 e dá visão integrada de "quem é a marca + o que vende".

---

### 5. Comando → Mais dados estratégicos

**Atual**: cards de progresso, leads recentes, vendas pendentes do dia.
**Adicionar 4 blocos**:

1. **Pulso de Hoje** (linha hero no topo):
   - Receita hoje vs ontem (delta colorido)
   - Leads hoje vs média 7d
   - Vendas hoje vs meta diária (se houver)
   - Gasto em ads hoje
2. **Top 3 Produtos do mês** — receita + nº vendas + ticket médio (clica e abre drawer de insights do produto).
3. **Alertas Inteligentes** — reusa `DashboardAlerts` filtrado por projeto:
   - PIX/boleto pendentes >2h (hot leads)
   - Anomalias (queda 2σ em vendas/leads)
   - Campanhas com CPA piorando 7d
4. **Próximas Ações** — merge de:
   - Tarefas urgentes do Kanban deste projeto
   - Eventos do calendário próximas 48h
   - E-mails de nutrição agendados

Layout: grid 2 colunas em telas largas, stack em mobile.

---

### Arquivos
- `src/pages/ProjetoDetalhe.tsx` — remover tabs `branding`, `reels`; renomear `briefing`→`identidade`.
- `src/components/projeto/ProjetoBriefing.tsx` ou novo `ProjetoIdentidade.tsx` wrapper com sub-tabs Briefing/Branding/Resumo.
- `src/components/projeto/ProjetoCentralConteudo.tsx` — adicionar sub-tab "Roteiros Virais" reusando `RoteirosViraisLibrary`.
- `src/components/projeto/ProjetoComando.tsx` — adicionar 4 blocos novos (pulso, top produtos, alertas, próximas ações).
- `src/components/projeto/ProjetoInsights.tsx` — KPIs hero com semáforo + tabela Top Campanhas.
- `src/components/financas/FinancasAds.tsx` — KPIs hero + sub-tabs internas + diagnóstico no topo.
- `src/components/financas/FinancasOverview.tsx` — mini-funil compacto + card eficiência por campanha.

### Fora de escopo
- Mudar schema do banco.
- Persistir tab ativa na URL.
- Mover Branding pra fora do projeto (continua dentro da aba unificada).


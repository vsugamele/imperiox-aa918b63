# Plano de Melhorias: Leads, Finanças e Inteligência

## Contexto
Exploramos o estado atual das 3 áreas. Identificamos gaps de performance, UX e automação que têm impacto real no dia a dia do operador.

---

## 1. Leads

### 1.1 Performance na carga
- **Problema:** `Leads.tsx` faz query `imphq_leads` limit 20.000 só para contar por projeto (`allProjIdsRes`). Isso traz 20k IDs só para contagem.
- **Ação:** Trocar por `select('project_id', { count: 'exact' }).group('project_id')` via RPC ou contagem agregada.
- **Impacto:** Reduz de 20k rows para ~50 contadas no banco.

### 1.2 Bulk actions operacionais
- **Problema:** Existe seleção multipla (`selectedIds`) mas só bulk delete. Não dá trocar status, projeto ou tags em lote.
- **Ação:** Adicionar dropdown "Ações em massa" com: Alterar status, Mover projeto, Adicionar tag, Exportar selecionados.
- **Impacto:** Operador ganha velocidade na gestão de 50+ leads.

### 1.3 HotLeadsInbox — ação com 1 clique
- **Problema:** Cada lead quente exige 3+ cliques (abrir → copiar WhatsApp → colar msg). Sem sequência automática.
- **Ação:** Botão "Disparar sequência" que usa template pré-selecionado (`imphq_wa_templates`) + chip ativo, enviando mensagem direto do inbox. Loga em `imphq_activity_log`.
- **Impacto:** Lead quente vira ação imediata, não só visualização.

### 1.4 LeadPredictive — fila inteligente
- **Problema:** Só analisa 20 leads manualmente. Predições expiram em 7 dias (TTL) e não há re-análise automática.
- **Ação:** Adicionar toggle "Análise automática" que enfileira leads novos/sem predição para análise diária via `imphq_ai_actions` (fila existente do Imperius).
- **Impacto:** CRM preditivo fica sempre atualizado sem intervenção manual.

---

## 2. Finanças

### 2.1 Projeção de fluxo de caixa
- **Problema:** Projeção mensal só faz regra de 3 (receita/diasPassados * diasMes). Não considera custos recorrentes fixos nem sazonalidade.
- **Ação:** Adicionar card "Fluxo de Caixa" que cruza:
  - Receita projetada (com sazonalidade: comparar mesmo dia da semana)
  - Custos fixos do mês (SaaS, salários, infra)
  - Gasto Ads projetado (média dos últimos 7 dias)
  - Mostrar ponto de break-even e dias até zerar.
- **Impacto:** Visão realista de quanto sobra no fim do mês.

### 2.2 Alerta de ROAS em tempo real (mês)
- **Problema:** `DashboardAlerts` já detecta queda de ROAS, mas `Financas.tsx` não mostra alerta inline quando o mês atual está abaixo do break-even.
- **Ação:** Badge/alerta no topo de Finanças quando ROAS mês < 1x ou lucro projetado < 0. Com cor vermelha e CTA para Gerenciador.
- **Impacto:** Owner percebe problema antes do fim do mês.

### 2.3 Comparativo período
- **Problema:** Não há comparação mês a mês visual na tela de Finanças.
- **Ação:** Toggle "Comparar" que mostra variação % de cada KPI vs mesmo período anterior (mês passado, ou 30d vs 30d anteriores).
- **Impacto:** Entender se está crescendo ou decaindo.

### 2.4 Exportar relatório mensal (PDF-ready)
- **Problema:** CSV exportado é cru, não formatado.
- **Ação:** Exportar HTML formatado (estilo relatório) que pode ser impresso/PDF. Inclui: capa com período, KPIs, gráfico ads vs vendas, tabela por projeto.
- **Impacto:** Relatório para stakeholder/mentoria em 1 clique.

---

## 3. Inteligência / Dashboard

### 3.1 DashboardAlerts respeita filtro de projeto
- **Problema:** `DashboardAlerts.tsx` ignora `projectFilter` — carrega TODOS os dados de todos os projetos sempre.
- **Ação:** Passar `projectFilter` para as queries de alerta (costs, vendas, ads) e alertar só no contexto do projeto selecionado.
- **Impacto:** Alertas relevantes, não genéricos.

### 3.2 Growth Dashboard auto-populate
- **Problema:** `GrowthDashboard` é 100% manual. Nenhuma métrica real vem do banco (só o que o usuário digita).
- **Ação:** Auto-preencher métricas derivadas: Leads Gerados (`imphq_leads` count), Compras (`imphq_vendas` count), CPA (Ads/Leads), Taxa Rejeição (bounce rate via tracker). Mostrar "Calculado" badge quando auto-populado.
- **Impacto:** Growth deixa de ser planilha manual e vira painel real.

### 3.3 Resumo Executivo unificado
- **Problema:** O dashboard tem muitas seções mas não há 1 visão de "situação do negócio" consolidada.
- **Ação:** Card "Resumo Executivo" no topo (abaixo do hero) que sintetiza em 3-4 bullets:
  - Receita mês vs meta
  - ROAS atual e tendência
  - Leads quentes aguardando ação
  - Maior risco detectado (anomalia)
- **Impacto:** Owner vê tudo em 5 segundos.

### 3.4 PredictiveDashboard — cache e invalidação
- **Problema:** Recalcula regressão linear e anomalias a cada mudança de filtro. Lento com 90 dias de dados.
- **Ação:** Cache por `(period, projectFilter, productFilter)` com 5min TTL. Invalidar on-focus. Adicionar botão "↻ Recalcular".
- **Impacto:** Dashboard snappier, menos carga de processamento.

---

## Escopo e prioridade

| # | Item | Área | Esforço | Impacto |
|---|------|------|---------|---------|
| 1 | DashboardAlerts respeita projeto | Inteligência | Baixo | Alto |
| 2 | Bulk actions em Leads | Leads | Médio | Alto |
| 3 | HotLeadsInbox disparo 1-clique | Leads | Médio | Alto |
| 4 | Projeção fluxo de caixa | Finanças | Médio | Alto |
| 5 | Resumo Executivo unificado | Inteligência | Baixo | Alto |
| 6 | Growth auto-populate | Inteligência | Médio | Médio |
| 7 | Comparativo período Finanças | Finanças | Baixo | Médio |
| 8 | LeadPredictive fila automática | Leads | Médio | Médio |
| 9 | Cache PredictiveDashboard | Inteligência | Baixo | Médio |
| 10 | Relatório PDF-ready | Finanças | Médio | Baixo |
| 11 | Performance contagem leads | Leads | Baixo | Médio |

## Recomendação de execução

**Fase 1 (rápido, alto impacto):** 1, 5, 7, 9, 11  
**Fase 2 (médio, operacional):** 2, 3, 4  
**Fase 3 (avançado):** 6, 8, 10  

Sem mudanças de schema — tudo usa tabelas e edge functions existentes.
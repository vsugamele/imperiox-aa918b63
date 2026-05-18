
# Roadmap 30 dias — ImperioHQ

Diagnóstico rápido após revisar OpenFlow, Leads, Dashboard, Imperius, WhatsApp e Finanças: o sistema tem features demais para a navegação atual, telas misturam conceitos (KPI + ação + config na mesma view), há queries pesadas sem paginação consistente, integrações falham em silêncio e a IA ainda depende muito de clique do usuário. O plano abaixo ataca isso em 4 semanas, sem quebrar nada existente.

## Semana 1 — Clareza & Navegação (UX)

Objetivo: cada tela responde "o que faço aqui agora?" em 3 segundos.

- **Sidebar reorganizada por intenção** (não por feature): `Operar` (Dashboard, Leads, WhatsApp, OpenFlow, Recuperação), `Vender` (Funis, Criativos, Gerenciador, Cohort, Metas), `Inteligência` (Imperius, Mentes, MarketIntel, Studio), `Configurar` (Empresa, Equipe, Integrações, Cofre). Hoje são 30+ itens chapados.
- **Header de página padronizado**: título + 1 KPI hero + 1 ação primária + filtro de projeto. Hoje cada página inventa seu próprio cabeçalho.
- **OpenFlow v2 (já planejado)**: hierarquia Projeto → Campanha → Fluxo na sidebar esquerda, editor à direita, drawer "Como conectar" único.
- **Dashboard com modo "Hoje"**: card único no topo "3 coisas que precisam de você agora" (hot leads, ads ruins, leads parados) — resto vira tabs.
- **Leads: tabs reduzidas** de 8 para 4 (Visão, Conversas, Jornada, Predições). Eliminar duplicação Automações/Nutrição.

## Semana 2 — Performance & Custo (egress Supabase)

Objetivo: -50% no egress mensal e p95 < 800ms nas telas pesadas.

- **Paginação obrigatória via `fetchAll`** em Leads, Vendas, Ads (hoje várias queries trazem 1000+ linhas no client). Já existe helper em `src/lib/supabasePaginate.ts` mas é subusado.
- **Materialized views** para os KPIs do Dashboard, Finanças e Cohort (refresh a cada 5min via pg_cron) — hoje cada load recalcula tudo.
- **React Query com staleTime** padronizado (3min para listas, 30s para inboxes). Eliminar `refetchOnWindowFocus` indiscriminado.
- **Realtime só onde importa**: WhatsApp inbox e ActionInbox. Remover subscriptions em Dashboard/Finanças (já há polling 30s).
- **Índices faltantes**: `imphq_leads(project_id, created_at desc)`, `imphq_vendas(project_id, status, created_at desc)`, `imphq_automacao_logs(automacao_id, created_at desc)`.
- **Edge function `dashboard-kpis`** que devolve 1 JSON consolidado em vez de 6 queries paralelas do frontend.

## Semana 3 — Confiabilidade & Observabilidade

Objetivo: integração quebrada nunca mais passa despercebida >5min.

- **Health Center** (nova página `/saude`): semáforo por integração (WhatsApp providers, Meta Ads, webhooks de venda, OpenAI/Gemini, pg_cron jobs). Última execução, taxa de erro 24h, último erro.
- **Tabela `imphq_system_health`** + cron a cada 2min testando cada integração (ping leve). Falha 2x seguidas → cria `imphq_ai_action` notify com severidade alta.
- **Retry exponencial nas edge functions críticas** (`webhook-pagamento`, `whatsapp-api send_message`, `facebook-ads-toggle`): 3 tentativas com backoff, fallback para fila `imphq_failed_jobs` reprocessável.
- **Idempotência em webhooks**: dedup key por `event_id` em vendas (já existe em CAPI, expandir para todos os providers).
- **Alertas push** quando: provider WhatsApp cai, webhook de venda falha 3x, ROAS de campanha despenca >40% em 2h.
- **Logs estruturados** nas edge functions (level + context + project_id) e um viewer simples em `/saude/logs`.

## Semana 4 — Inteligência & Receita (Imperius autônomo de verdade)

Objetivo: IA agindo sozinha em decisões reversíveis e gerando receita mensurável.

- **Imperius Scout 24/7**: cron a cada 15min varrendo cada projeto ativo. Detecta padrões (hot lead sem resposta >10min, ad com CPA 2x acima da meta, lead que abandonou checkout) e enfileira ação. Hoje é manual.
- **Auto-execução por risco**: low (responder WhatsApp para hot lead, pausar ad com CPA 3x meta) executa direto; medium (mudar budget, criar campanha) vai para inbox; high (deletar, gastar >R$500) sempre humano.
- **Loop de aprendizado**: cada ação executada grava resultado 24/48h depois (`outcome_metric`). Scout usa histórico para ajustar confiança — ação que deu certo 5x vira low risk automaticamente.
- **Atribuição multi-touch**: hoje é last-click via UTM. Adicionar first-touch + linear no `/cohort` para ver o real ROAS por criativo.
- **Predições no Lead**: já existe `imphq_lead_predictions`. Expor probabilidade de compra direto na linha da tabela `/leads` com badge colorido, ordenação por score.
- **Recuperação automática**: lead com Pix gerado e não pago em 30min → Imperius dispara mensagem personalizada via OpenFlow (template do projeto). Hoje depende de campanha manual.
- **Painel `/imperius` com ROI**: "IA gerou R$ X em vendas recuperadas / economizou R$ Y em ads pausados este mês". Justifica o sistema.

## Detalhes técnicos

**Migrações novas:**
- `imphq_system_health` (integration_name, status, last_ok_at, last_error, project_id nullable)
- `imphq_failed_jobs` (function_name, payload jsonb, error, retry_count, next_retry_at)
- `imphq_ai_action_outcomes` (action_id, metric_name, value_before, value_after, measured_at)
- 3 materialized views: `mv_dashboard_kpis`, `mv_financas_overview`, `mv_cohort_matrix`
- Índices listados na Semana 2

**Edge functions novas:**
- `dashboard-kpis` (consolidador)
- `system-health-check` (cron 2min)
- `imperius-scout` (cron 15min) — expandir o atual
- `imperius-outcome-tracker` (cron 1h) — mede resultado de ações executadas

**Frontend:**
- Refactor `AppSidebar.tsx` em grupos
- Novo componente `PageHeader` reutilizável + aplicar em todas as páginas top
- Novo `src/pages/Saude.tsx` + `src/components/saude/HealthGrid.tsx`
- Refactor `Leads.tsx` consolidando tabs
- `imperius-autonomous` ganha tab "ROI" agregando outcomes

**O que NÃO muda:**
- Stack, schema dos `imphq_*` core (vendas, leads, projects), auth, design tokens, edge functions estáveis (webhook-pagamento, whatsapp-api). Tudo aditivo.

## Entregáveis ao fim dos 30 dias

1. Navegação 50% mais enxuta, padronizada
2. Egress -50%, telas críticas <800ms
3. Página `/saude` com semáforo vivo + alertas push
4. Imperius rodando sozinho com loop de aprendizado e ROI visível
5. Salvar este plano em `.lovable/plan.md` na aprovação

Posso começar pela Semana 1 (clareza/UX) ou você prefere ordem diferente?

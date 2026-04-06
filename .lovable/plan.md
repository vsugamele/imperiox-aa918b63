

# Avaliacao Completa: O que precisa na ferramenta

Apos analisar o codebase inteiro (30+ paginas, 20+ edge functions, 50+ tabelas), aqui esta minha avaliacao organizada por prioridade.

---

## PRIORIDADE ALTA — Problemas que afetam uso diario

### 1. Financas: Dados nao cruzam corretamente

- `FinancasProdutos` recebe props (`revenues`, `costs`, `ads`, `briefingProdutos`) mas o `Financas.tsx` ja foi corrigido parcialmente — ainda falta cruzar vendas com ads para ROAS real por produto
- Nao existe conciliacao automatica: vendas do webhook, receitas manuais e ads vivem isolados
- **Fix**: Criar uma view SQL `vw_financas_resumo` que cruza `imphq_vendas`, `imphq_ads_spend`, `imphq_project_revenue` e `imphq_project_costs` por projeto e periodo, eliminando calculos no frontend

### 2. Webhook de pagamento ainda fragil

- O `webhook-pagamento` ja foi corrigido varias vezes (Fernanda, Ingride), mas o padrao se repete: cada nova plataforma (Hotmart, Kiwify, Stripe) vai precisar de mapeamento manual
- Nao tem retry/dead-letter para webhooks que falharam
- **Fix**: Adicionar tabela `imphq_webhook_errors` para logar falhas com payload original + botao "Reprocessar" na UI

### 3. Leads: Arquivo gigante (1624 linhas)

- `Leads.tsx` com 1624 linhas e um unico componente monolitico — dificil de manter e lento para renderizar
- Filtros ja foram reportados como bugados (nao resetam paginacao)
- **Fix**: Quebrar em sub-componentes (`LeadTable`, `LeadDetail`, `LeadFilters`, `LeadFunnel`) e usar React.memo + virtualizacao para tabelas grandes

---

## PRIORIDADE MEDIA — Integracao e sincronia

### 4. Funis desconectados dos dados reais

- O builder visual de funis (`Funis.tsx`, 1155 linhas) permite criar etapas com visitantes/conversoes, mas esses numeros sao **manuais**
- Nao sincroniza com leads reais (`imphq_leads`), vendas (`imphq_vendas`) ou ads (`imphq_ads_spend`)
- **Fix**: Alimentar automaticamente metricas do funil a partir de eventos de lead (stage transitions) e ads spend, mostrando conversao real entre etapas

### 5. OpenFlow sem execucao real

- O `FlowEditor` permite montar automacoes (email, whatsapp, aguardar, condicao), mas a execucao depende de triggers manuais ou do `notify-scheduler`
- Nao existe um "engine" que processa a fila de acoes pendentes automaticamente
- **Fix**: Criar edge function `openflow-executor` com cron (via `pg_cron` ou scheduler externo) que processa acoes pendentes com delays

### 6. WhatsApp: envio e recebimento incompletos

- O sistema de chat (`ChatView.tsx`) faz polling mas nao tem realtime
- Bulk send existe mas nao registra log de envio por lead
- QR code acabou de ser corrigido mas a arquitetura Hub Local depende de worker externo sem health check
- **Fix**: Adicionar realtime subscription para mensagens + log de envio em `imphq_wa_messages` com status (enviado/entregue/lido/erro)

### 7. Calendar sem sync bidirecional

- `google-calendar-sync` edge function existe, mas o calendario do projeto (`ProjetoCalendario`) e standalone
- Nao puxa eventos reais do Google Calendar, apenas armazena localmente
- **Fix**: Ativar sync bidirecional com OAuth do Google Calendar (requer connector)

---

## PRIORIDADE EVOLUTIVA — Refinamentos que agregam valor

### 8. Skills/Mentes: falta orquestracao

- O catalogo de Skills (`imphq_skills`) e as Mentes IA (`MENTE_PROMPTS` hardcoded no backend) funcionam independentemente
- O `AIGenerateButton` suporta `showMenteSelector` mas so esta ativo em 1 de 12 instancias (CopyArsenal)
- Skills sao invocadas pontualmente mas nao existe "cadeia" (ex: rodar Avatar Architect → depois Devastador → depois LP Persuasiva em sequencia)
- **Fix**:
  - Ativar `showMenteSelector` em todos os AIGenerateButton
  - Criar "Workflow de Skills" no OpenFlow: nós especiais que executam skills em cadeia com output de um alimentando o input do proximo
  - Mover `MENTE_PROMPTS` para a tabela `imphq_skills` como tipo "mente" para serem editaveis

### 9. Dashboard: muitos states, nenhum cache

- `Dashboard.tsx` (898 linhas) faz 10+ queries ao Supabase no mount, sem cache nem stale-while-revalidate
- Cada mudanca de filtro recarrega tudo
- **Fix**: Migrar para `useQuery` do React Query com `staleTime` + separar KPIs financeiros em componente proprio

### 10. Projeto: 15 abas, UX sobrecarregada

- `ProjetoDetalhe` tem 15 tabs (Comando, Briefing, Expert, Avatar, Branding, KPIs, Pesquisa, Midia, Docs, Concorrentes, Calendario, Financas, Emails, Conteudo IA, Analytics)
- Muita informacao, dificil de navegar
- **Fix**: Agrupar em 4-5 secoes (Estrategia, Producao, Inteligencia, Financeiro, Automacao) com sub-abas, ou usar layout sidebar dentro do projeto

### 11. Tracker UTM sem integracao com Leads

- `imphq_clicks` registra cliques em tracking links, mas nao associa automaticamente ao lead quando ele converte
- **Fix**: No `capture-lead`, verificar cookie/utm e linkar o lead ao tracking link original

### 12. Exportacao e relatorios

- Nenhuma pagina tem botao "Exportar CSV/PDF"
- Nao existe relatorio consolidado semanal/mensal
- **Fix**: Adicionar exportacao em Leads, Financas e Dashboard + criar edge function `generate-report` que envia resumo semanal por email

---

## Resumo por impacto

| # | Area | Tipo | Esforco |
|---|---|---|---|
| 1 | Financas cruzamento | Refinamento | Medio |
| 2 | Webhook resilience | Integracao | Medio |
| 3 | Leads refactor | Refinamento | Grande |
| 4 | Funis + dados reais | Sincronia | Grande |
| 5 | OpenFlow executor | Integracao | Grande |
| 6 | WhatsApp realtime | Integracao | Medio |
| 7 | Google Calendar sync | Integracao | Medio |
| 8 | Skills orquestracao | Refinamento | Medio |
| 9 | Dashboard performance | Refinamento | Pequeno |
| 10 | Projeto UX abas | Refinamento | Medio |
| 11 | UTM → Lead linking | Sincronia | Pequeno |
| 12 | Exportacao/Relatorios | Feature nova | Medio |

Recomendo comecar pelos itens 1, 2, 8 e 9 — sao os que dao resultado mais rapido com menos risco. Os itens 4 e 5 sao os mais transformadores mas exigem mais trabalho.


## Diagnóstico atual do OpenFlow

Hoje uma automação é amarrada a `project_id` + `produto` (string solta). Não existe nível "campanha", então quando você troca um formulário (ex.: webinar do produto X), você precisa criar/duplicar tudo e perde o histórico. A tela também mistura conceitos (gatilho, ação, escopo, provider) sem hierarquia visual clara, e a conexão com `imphq_leads` é implícita — o lead dispara via webhook/inserção, e o executor cruza por `project_id` e (às vezes) `produto`, sem mostrar isso na UI.

## Melhorias propostas (em 3 frentes)

### 1. Clareza visual da página `/openflow`

- Substituir a lista plana por **agrupamento hierárquico**: Projeto → Campanha → Automação. Sidebar à esquerda com a árvore, editor à direita.
- Cabeçalho de cada automação mostra 4 chips fixos: **Quando** (trigger), **Para quem** (escopo: projeto/campanha/produto), **O que faz** (resumo das ações), **Por onde** (provider WhatsApp/Email).
- Renomear aba "Automações" → "Fluxos". Adicionar coluna "Última execução" e "Taxa 7d" em cada card.
- Mover "Webhook URL" e "Guia" para um único drawer lateral "Como conectar" — hoje compete com a lista.

### 2. Novo nível "Campanha"

Adicionar entidade **Campanha** entre Projeto e Automação. Uma campanha agrupa:
- Um formulário de captura (ou vários, versionados)
- As automações que devem disparar para leads daquela campanha
- Janela ativa (data início/fim) — útil para webinar
- Tags/UTM padrão aplicadas aos leads capturados

Fluxo do seu exemplo (webinar do produto X):
1. Cria campanha "Webinar X - Maio" dentro do projeto X
2. Vincula o formulário atual a ela
3. Cria automações de nutrição com escopo = essa campanha
4. Semana que vem: clica "Nova versão do formulário" — a campanha continua, o form antigo vira histórico, leads novos entram pelo novo form mas continuam respeitando as mesmas automações (ou você cria "Webinar X - Junho" e copia)

### 3. Conexão explícita com Leads

Hoje a ligação existe mas é invisível. Tornar visível:
- Cada lead em `/leads` mostra um painel **"Jornada"** com as automações ativas + próximo passo agendado + histórico de mensagens enviadas pelo OpenFlow
- Em cada automação do OpenFlow, contador "X leads ativos nesta jornada" clicável → abre lista filtrada em `/leads`
- Quando o lead chega pelo formulário de uma campanha, ele é automaticamente marcado com `campanha_id` e entra nas automações daquela campanha (sem precisar configurar trigger manual)

## Detalhes técnicos

**Banco (migração nova):**
- Tabela `imphq_campanhas`: `id, project_id, nome, slug, status (ativa/pausada/encerrada), data_inicio, data_fim, form_id_atual, utm_campaign, created_at`
- Tabela `imphq_campanha_form_versions`: histórico de forms (`campanha_id, form_id, vigente_de, vigente_ate`)
- Adicionar `campanha_id` (nullable) em `imphq_automacoes` e `imphq_leads`
- Trigger no insert de lead via form: se o form pertence a uma campanha vigente, popula `lead.campanha_id`

**Edge functions:**
- `openflow-executor`: além de filtrar por `project_id + produto`, passar a aceitar `campanha_id` e priorizar automações com escopo de campanha
- Webhook de form submission: já existe pipeline em `webhook-pagamento`/leads — adicionar lookup de campanha por `form_id`

**UI (`src/pages/OpenFlow.tsx` + componentes):**
- Refatorar layout em 2 colunas: `<CampanhaSidebar/>` + `<FluxoEditor/>`
- Novo componente `<CampaignSwitcher/>` no topo do editor (igual seletor de projeto atual, mas hierárquico)
- Em `src/pages/Leads.tsx`: novo painel `<LeadJourneyPanel/>` na `LeadsSidebar` consumindo `imphq_automacao_logs` + execuções pendentes
- Em cada card de automação: badge "N leads ativos" via count em `imphq_automacao_executions`

**Migração de dados existentes:**
- Automações atuais ficam com `campanha_id = null` (escopo "projeto inteiro") — continuam funcionando
- Banner sugere "Organize esta automação em uma campanha" para facilitar adoção

## O que NÃO muda

- Triggers existentes, FlowEditor, providers, templates de IA, KPIs, sistema de execuções/logs
- Compatibilidade total com automações sem campanha (campanha_id opcional)

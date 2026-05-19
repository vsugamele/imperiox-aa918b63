# Plano — Campanhas vivas + Painel + Loop com Ads/WhatsApp

Ordem por ROI. Cada fase entrega valor sozinha.

---

## Fase 1 — Campanhas como entidade (base de tudo)

**Objetivo:** parar de tratar `campaign_name` como string solta. Criar índice real para agregar leads, CPL, conversão.

- Migration: nova tabela `imphq_campaigns`
  - `id` (uuid), `project_id`, `nome`, `slug`, `produto`, `funil` (aquisicao/conversao/maximizacao/retencao), `form_type_default`, `status` (rascunho/ativa/pausada/arquivada), `created_at`, `data` (jsonb p/ metas, utm_campaign esperado, observações)
- `imphq_capture_forms.settings.campaign_id` passa a referenciar a campanha (mantém `campaign_name` como cache p/ retrocompat)
- `FormBuilder`: campo "Campanha" vira **Select + criar nova** (combobox) — lista campanhas do projeto, ao escolher já preenche produto/funil
- Migration de backfill: cria 1 campanha por `campaign_name` único existente e linka os forms
- `capture-lead`: propaga `campaign_id` para `lead.data.campaign_id`

## Fase 2 — Painel `/campanhas`

**Objetivo:** ver performance por campanha sem montar relatório.

- Nova rota `/campanhas` (e link no sidebar)
- Tabela com: campanha, status, produto, leads (7/30d), CPL real (cruza `imphq_ads_insights` por `utm_campaign` esperado), conversão para venda (cruza `imphq_vendas.utm_campaign`), receita, ROAS
- Drilldown por campanha: lista de forms vinculados, leads recentes, vendas atribuídas, gráfico de leads/dia
- Filtros: projeto, status, funil
- Botão "Pausar campanha" → marca status + opcionalmente pausa adsets vinculados (fase 3)

## Fase 3 — Loop com Ads & WhatsApp

**Objetivo:** o `form_type` deixar de ser etiqueta e virar gatilho.

- `capture-lead`: ao criar lead, se a campanha tem `form_type` mapeado, enfileira automação WhatsApp default:
  - `captura/lead_magnet` → mensagem de boas-vindas + entrega
  - `aplicacao` → triagem automática (já existe TriagemPanel)
  - `pesquisa` → agradecimento
  - `pos_compra` → pedir depoimento
- Disparar **CAPI `Lead`** do `capture-lead` com `custom_data.campaign_name` e `event_id` (dedup) — fecha loop de otimização do Ads sem depender do Pixel do navegador
- Form salvo gera **link curto + QR** via tracker existente (já temos `xcod`), exibe no card do form

## Fase 4 — IA mais inteligente (polish)

- **"Otimizar este form"**: botão que lê `imphq_lead_responses` + taxa de conversão e a IA sugere remover/reescrever campos fracos
- **Variantes A/B**: gera 2 versões com hipóteses diferentes em uma chamada
- IA recebe contexto de **formulários anteriores do projeto** para não repetir perguntas
- Validação no FormBuilder: avisa se IA gerou >3 campos num form tipo `captura`

---

## Detalhes técnicos

- **IDs**: `imphq_campaigns.id` UUID (não é projeto/lead/venda).
- **RLS**: `imphq_campaigns` espelha policy de `imphq_projects` (membros do projeto leem/escrevem).
- **Edge functions tocadas**: `capture-lead` (campaign_id + automação + CAPI), nova `campaign-optimize` (fase 4).
- **Frontend tocado**: `FormBuilder.tsx` (combobox campanha), nova page `Campanhas.tsx`, `AppSidebar.tsx` (link).
- **Sem breaking change**: forms antigos com `campaign_name` string continuam funcionando até o backfill.

## Fora do escopo
- Não mexe na timeline do lead nem no scoring atual
- Não automatiza pausa real de adset na fase 1-2 (só marca status)
- Variantes A/B não vão para teste automático, só geração

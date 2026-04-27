## Gerenciador Pro — Trazer o melhor dos dois mundos

Hoje o `/gerenciador` já tem busca, paginação, ordenação, checkboxes (visuais) e toggle ATIVO/PAUSADO real. Vamos evoluir para igualar (e superar) o gerenciador de referência, integrando os KPIs ricos que já existem no painel de Ads.

### O que será adicionado

**1. KPIs ricos do funil na tabela**
Adicionar colunas: `HOOK RATE`, `CPM`, `FREQ`, `ALCANCE`, `LP VIEWS`, `LP→CKT %`, `CKT→VENDA %`. Reutilizar dados já capturados em `imphq_ads_spend` (hook_rate, cpm, frequencia, alcance, lp_views — confirmar via memory `Ads Funnel Tracking`).
Densidade controlada via toggle "Colunas" (popover com checkboxes pra mostrar/esconder grupos: Básico / Funil / Performance).

**2. Edição inline de Orçamento Diário (real)**
Click no valor `Orç./Dia` → input editável → Enter salva via Meta Graph API.
Estender `facebook-ads-toggle` (renomear conceitualmente, mantendo o nome) para aceitar `action: "UPDATE_BUDGET"` com `daily_budget` (em centavos). Atualiza `imphq_ads_spend.daily_budget` local após sucesso e registra em `imphq_ads_actions` (acao: `editou_orcamento`, valor_anterior/valor_novo).

**3. Ações em massa via checkbox**
Barra flutuante aparece quando há linhas selecionadas:
- `Pausar selecionadas` / `Ativar selecionadas` → loop chamando edge function (com Promise.allSettled, toast de progresso)
- `Duplicar` → nova action `DUPLICATE_CAMPAIGN` na edge function (usa endpoint `/copies` do Meta), retorna nova campanha em PAUSED
- `Limpar seleção`

**4. Hierarquia Campanha → Conjunto → Anúncio (drilldown)**
Linha da campanha vira expansível (chevron à esquerda). Ao expandir:
- Subtabela com adsets daquela campanha (filtro local em `imphq_ads_spend` por `campaign_id`)
- Cada adset expansível para mostrar ads
- Cada nível tem seu próprio toggle ATIVO/PAUSADO (entity_type já suportado: campaign/adset/ad)
- Mostra `effective_status` real e CPA/ROAS por nível

**5. Status do projeto + Sync Manual no header**
Trazer da tela de Ads: badge "Facebook conectado/erro", botão "Sync Manual" (chama `facebook-ads-sync-all`), timestamp do último sync. Reusa `FacebookHealthAlert` se houver erro.

### Mudanças técnicas

**Backend (`supabase/functions/facebook-ads-toggle/index.ts`)**
- Aceitar novos `action`: `UPDATE_BUDGET` (body: `daily_budget` em reais → converte pra centavos), `DUPLICATE_CAMPAIGN`
- `UPDATE_BUDGET`: POST `${FB_BASE}/{entity_id}` com `{ daily_budget: X }` (X em centavos da moeda da conta)
- `DUPLICATE_CAMPAIGN`: POST `${FB_BASE}/{entity_id}/copies` com `{ deep_copy: true, status_option: "PAUSED" }`
- Log em `imphq_ads_actions` com tipos novos: `editou_orcamento`, `duplicou`

**Frontend (`src/components/gerenciador/`)**
- `CampanhasTable.tsx`: adicionar colunas do funil, expansão hierárquica, popover de visibilidade de colunas, callback de seleção pra exibir BulkActionsBar
- Novo: `BudgetEditor.tsx` — input inline com confirmação otimista
- Novo: `BulkActionsBar.tsx` — barra fixa no rodapé com contador e ações
- Novo: `CampaignDrilldown.tsx` — sub-rows recursivas (adsets/ads) reutilizando aggregate por nível
- `Gerenciador.tsx`: header com status Meta + Sync Manual, integrar `FacebookHealthAlert`

**Tipos** (`src/integrations/supabase/types.ts`): regenerado automaticamente após qualquer mudança de schema; nenhuma migration necessária pois reutilizamos colunas existentes.

### Fora do escopo (próxima rodada)
- Google Ads (mantém placeholder)
- Edição inline de nome/segmentação
- Gráficos por linha (sparklines)

### Referências
- Dados do funil já em `imphq_ads_spend` (memory: Ads Funnel Tracking)
- Toggle e log já implementados (memory: Gerenciador de Anúncios)
- Tratamento de erros Meta (memory: Facebook Error Handling) — reaproveitado nas novas actions

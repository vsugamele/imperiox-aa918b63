# Gerenciador de Anúncios — Estilo Meta Ads Manager

Replicar o gerenciador da referência dentro do Imperio HQ: tabela densa de campanhas com toggle ATIVO/PAUSADO funcional (sincroniza com a Meta), colunas de KPI ordenáveis, paginação, busca, exportação CSV e Histórico de Ações abaixo. Tudo na paleta Imperial Gold.

## O que vai existir

**Nova rota `/gerenciador`** (entrada no sidebar abaixo de Finanças) com:

1. **Header**: Título "Gerenciador" + botões `↓ CSV` e seletor de período (reaproveita `periodUtils`).
2. **Tabs**: `Meta Ads` | `Google Ads` (Google fica como placeholder "em breve" por enquanto).
3. **Tabela de Campanhas** (agregado por `campanha` no período):
   - Colunas: ☑ select · 🟢 toggle status · NOME · INVEST. · IMPR. · CLIQ. · CTR · CPC · IC (init checkout) · CPI · COMPRAS · **CPA** (vermelho se acima da meta) · **RECEITA** · **ROAS ▼** (badge colorida: verde >2x, amarelo 1-2x, vermelho <1x) · ORÇ./DIA
   - Busca por nome, paginação (10/20/50), ordenação clicando no header (ROAS default desc), seleção em massa.
   - Toggle real: chama nova Edge Function `facebook-ads-toggle` que faz `POST graph.facebook.com/{campaign_id}` com `status: PAUSED|ACTIVE` e grava log.
4. **Histórico de Ações**: tabela abaixo lendo `imphq_ads_actions` (nova tabela): QUANDO · AÇÃO · PLAT. · TIPO · ENTIDADE · MUDANÇA · RESULTADO · DURAÇÃO.

## Mudanças técnicas

**Banco — migration**:
- `imphq_ads_spend`: adicionar `campaign_id text`, `adset_id text`, `ad_id text`, `effective_status text`, `daily_budget numeric` (índices em `campaign_id`, `project_id+data_ref`).
- Nova tabela `imphq_ads_actions`: `id, project_id, plataforma, tipo (campaign|adset|ad), entidade_id, entidade_nome, acao (ativou|pausou|orcamento|etc), valor_anterior, valor_novo, resultado (ok|erro), erro_msg, duracao_ms, created_at, created_by`. RLS por projeto.

**Edge Functions**:
- `facebook-ads-sync-all` / `facebook-ads-sync`: passar a salvar `campaign_id`, `adset_id`, `ad_id`, `effective_status` e `daily_budget` (campos `id` e `daily_budget` no endpoint `/campaigns`).
- Nova `facebook-ads-toggle`: recebe `{ project_id, entity_type, entity_id, action: 'ACTIVE'|'PAUSED' }`, busca token em `imphq_integration_credentials`, faz `POST /{entity_id}` com `status`, mede latência, grava em `imphq_ads_actions`, atualiza `effective_status` local.

**Frontend**:
- `src/pages/Gerenciador.tsx` (nova página, rota em `App.tsx` + item no `AppSidebar`).
- `src/components/gerenciador/CampanhasTable.tsx`: tabela com sort/paginação/busca/toggle (otimista + rollback em erro).
- `src/components/gerenciador/AcoesHistorico.tsx`: lista do `imphq_ads_actions` (Realtime opcional).
- `src/components/gerenciador/RoasBadge.tsx`, `StatusToggle.tsx` (utilitários visuais).
- Reaproveita `DateRangePicker` de Finanças e a lógica de agregação por campanha de `FinancasAds.tsx`.

**Memória**:
- Atualizar `mem://features/ads/automation-tools` adicionando o Gerenciador (toggle real, histórico de ações).

## Layout (ASCII)

```text
┌─ Gerenciador ─────────────────── [↓CSV] [📅 25/03 → 24/04] ┐
│ [Meta Ads] Google Ads                                       │
│ Todas as Campanhas                                          │
│ 🔍 Buscar...    73 registros  Exibir 10 20 50    < 1/8 >    │
│ ☐ 🟢 Nome              INVEST  IMPR  CLIQ CTR CPC IC CPI ...│
│ ☐ 🟢 Campanha A        R$227   4.684  47  1%  4,84 1 227 ...│
│ ...                                                         │
├─ ⌁ Histórico de Ações ──────────────────────────────────────┤
│ QUANDO          AÇÃO    PLAT  TIPO  ENTIDADE  MUDANÇA  ...  │
│ 24/04 02:41:37  ▶Ativou META  ad    ad 06     →ACTIVE  ✓ok  │
└─────────────────────────────────────────────────────────────┘
```

## Fora do escopo (próxima iteração se quiser)
- Edição inline de orçamento diário (apenas leitura nesta versão).
- Aba Google Ads funcional (depende de outro connector).
- Toggle a nível de adset/ad (esta versão começa por campanha — a estrutura já suporta os outros).

Posso seguir com a implementação?

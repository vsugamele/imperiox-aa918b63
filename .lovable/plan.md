# Auto-detectar campanhas a partir dos leads

Hoje o modal "Nova Campanha" é 100% manual — você digita nome, produto e UTM na mão, mesmo quando esses dados já existem em `imphq_events` (tracker) e `imphq_vendas` (webhooks). Vamos virar o fluxo: o sistema sugere, você só confirma.

## O que muda no modal

Adicionar no topo do `Dialog` uma seção **"Detectadas nos últimos 30 dias"** que lista UTMs reais ainda não vinculadas a nenhuma campanha:

```text
┌─ Sugestões do tracker (não vinculadas) ──────────────────┐
│ ▸ 120243227741210296            681 eventos · JP Freitas │
│ ▸ [CBO] 1-1-1 [NOVA PAGINA]…    41 eventos  · JP Freitas │
│ ▸ webinar-maio-x                12 vendas   · Curso X    │
└──────────────────────────────────────────────────────────┘
        [+ Criar campanha em branco]
```

Clique numa linha → formulário já vem com:
- **Nome** = utm_campaign (editável, sugerimos versão "limpa" para CBO/IDs longos)
- **Projeto** = projeto com mais eventos/vendas naquele UTM
- **UTM campaign** = valor exato
- **Produto** = produto mais vendido naquele UTM (de `imphq_vendas`)
- **Início** = data do 1º evento; **Fim** = vazio

## Bônus rápido

- Botão **"Vincular leads existentes"** dentro da campanha já criada: roda `UPDATE imphq_leads SET campanha_id = X WHERE id IN (SELECT lead_id FROM imphq_events WHERE utm_campaign = Y)` — fecha o gap histórico de uma vez.
- Campo **UTM campaign** ganha um `<datalist>` com todos os UTMs já vistos (autocomplete), pra quem prefere digitar.
- Indicador no card: badge "🔗 N leads / M vendas" puxado da própria UTM (não só do `campanha_id`).

## Técnico

1. Nova RPC `get_unmatched_utm_campaigns(p_project_id uuid, p_days int)`:
   ```sql
   SELECT utm_campaign,
          count(*) FILTER (WHERE source='events')  AS eventos,
          count(*) FILTER (WHERE source='vendas')  AS vendas,
          min(project_id) AS project_id,
          mode() WITHIN GROUP (ORDER BY produto)   AS top_produto,
          min(created_at) AS first_seen
   FROM (
     SELECT utm_campaign, project_id, NULL::text as produto, created_at, 'events' as source FROM imphq_events
     UNION ALL
     SELECT utm_campaign, project_id, produto, created_at, 'vendas' FROM imphq_vendas
   ) t
   WHERE utm_campaign IS NOT NULL
     AND created_at > now() - (p_days || ' days')::interval
     AND utm_campaign NOT IN (SELECT utm_campaign FROM imphq_campanhas WHERE utm_campaign IS NOT NULL)
   GROUP BY utm_campaign
   ORDER BY eventos+vendas DESC LIMIT 20;
   ```
2. Edição em `src/components/openflow/CampanhasManager.tsx`:
   - novo bloco `SuggestionsList` no `Dialog open={showNew}`
   - função `applySuggestion(s)` que chama `setNewForm({...})`
   - botão "Vincular leads" no modal de edição → RPC `link_leads_by_utm(campanha_id)`
3. Datalist usa o mesmo RPC sem filtro de "não vinculadas".

## Fora de escopo

- Auto-criar campanhas sem confirmação (continua decisão sua).
- Renomear/limpar UTMs de IDs do Facebook automaticamente — só sugerimos.

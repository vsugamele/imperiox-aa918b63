

# Plano: Integração Facebook Marketing API + Bug Vendas Duplicadas

---

## 1. Integração automática com Facebook Marketing API

**Objetivo**: Ler campanhas, conjuntos de anúncios, criativos, métricas e enviar eventos de conversão (CAPI) — tudo automaticamente, sem CSV manual.

**Requisitos**: O Facebook Marketing API exige um **Access Token de longa duração** com permissões `ads_read`, `ads_management`, e o **Ad Account ID** (formato `act_XXXXXXX`). Esses dados já existem parcialmente no projeto (o `facebook_access_token` e `facebook_pixel_id` são salvos por projeto no briefing).

### Arquitetura

Nova Edge Function `facebook-ads-sync` que:

1. **Lê campanhas e métricas** do Facebook Marketing API:
   - `GET /act_{ad_account_id}/campaigns?fields=name,status,objective`
   - `GET /act_{ad_account_id}/insights?fields=campaign_name,adset_name,ad_name,spend,impressions,reach,clicks,actions&time_range={...}&level=ad&time_increment=1`
   - Mapeia `actions` do Facebook (onde `action_type=offsite_conversion.fb_pixel_purchase` conta como compras, `lead` como leads, etc.)
   - Insere/atualiza em `imphq_ads_spend` com os dados do dia

2. **Lê criativos**:
   - `GET /act_{ad_account_id}/adcreatives?fields=name,thumbnail_url,body,title,image_url,video_id`
   - Salva no JSONB do projeto ou em nova tabela

3. **Envia eventos CAPI** (já existe parcialmente no `webhook-pagamento`, apenas expor de forma mais acessível)

### Configuração por projeto

Adicionar campos no briefing do projeto (`ProjetoDetalhe.tsx`):
- `facebook_ad_account_id` (act_XXXXX) — novo campo
- `facebook_access_token` — já existe
- Botão "Sincronizar Ads Agora" que chama a Edge Function
- Toggle "Sincronização automática" (para futuro cron job)

### Novo secret necessário

O token do Facebook já é salvo por projeto no JSONB `data`. Para a Edge Function ler, ela busca o `facebook_access_token` e `facebook_ad_account_id` do projeto.

### Edge Function `facebook-ads-sync`

- Input: `{ project_id, date_from?, date_to? }`
- Busca o token e ad_account_id do projeto
- Chama a API do Facebook para insights diários
- Faz upsert em `imphq_ads_spend` (evita duplicatas por campanha+data)
- Retorna resumo do que foi importado

### UI no Frontend

- Em `ProjetoFinancas.tsx` (aba Ads): botão "Sincronizar Facebook" ao lado do "Importar CSV"
- Em `FinancasPerformance.tsx`: substituir o banner de "importar CSV" por "conectado ao Facebook" quando o token estiver configurado
- Em `ProjetoDetalhe.tsx`: campo `facebook_ad_account_id`

**Arquivos**: `supabase/functions/facebook-ads-sync/index.ts` (novo), `src/pages/ProjetoDetalhe.tsx`, `src/components/projeto/ProjetoFinancas.tsx`, `src/components/financas/FinancasPerformance.tsx`

---

## 2. Bug: Vendas contando mais do que deveria

**Causa raiz**: Dois problemas identificados:

**a) Status inconsistente**: O webhook insere vendas com `status: "aprovado"`, mas os KPIs em Leads.tsx filtram por `"Aprovada" || "aprovada" || "approved"` — nenhum bate com `"aprovado"`. Resultado: as conversões aparecem como 0 nos KPIs de analytics, mas o count total (sem filtro de status) mostra todas.

**b) `leadsByProduct` conta todas as vendas**: Na linha 563, o cálculo de "Leads por Produto" conta TODAS as vendas (incluindo pendentes, pix_gerado, etc.), não apenas aprovadas.

**Solução**:
- Normalizar o filtro de status para incluir `"aprovado"` em todos os cálculos de KPIs (adicionar ao array de checks)
- Em `leadsByProduct`, filtrar apenas vendas aprovadas
- No webhook, manter `"aprovado"` como padrão, mas adicionar ao array de verificação no frontend

**Arquivo**: `src/pages/Leads.tsx`

---

## Arquivos alterados/criados

| Arquivo | Ação |
|---|---|
| `supabase/functions/facebook-ads-sync/index.ts` | Nova Edge Function para ler campaigns/insights/criativos do Facebook |
| `src/pages/ProjetoDetalhe.tsx` | Campo `facebook_ad_account_id` no briefing |
| `src/components/projeto/ProjetoFinancas.tsx` | Botão "Sincronizar Facebook" na aba Ads |
| `src/components/financas/FinancasPerformance.tsx` | Atualizar banner quando Facebook conectado |
| `src/pages/Leads.tsx` | Fix status filter para incluir "aprovado" + filtrar vendas aprovadas em leadsByProduct |


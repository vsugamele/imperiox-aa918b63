
Vou analisar as duas perguntas:

**1. Métricas que podem não estar 100%:**
Olhando o screenshot e o `DashboardStats.tsx` + memórias:
- **Custo/Checkout: —** → Falta porque não temos `Initiate Checkout` vindo do Pixel/CAPI sincronizado em `imphq_ads_spend`
- **Init. Checkout: 0** → Mesmo problema, o sync do FB não captura `actions: initiate_checkout`
- **LP→Checkout: 0.0%** e **Checkout→Venda: 0.0%** → Dependem do Init Checkout
- **CPL: —** → Faltam leads atribuídos por campanha (precisaria mapear UTM→ads ou capturar `lead` action do Pixel)
- **Hook Rate: —** → Precisa de `video_3_sec_watched` / `video_thruplay_watched` (não fetcheamos esses fields)
- **CPM Médio** → Calculado, ok
- **Frequência: 1.46** → Ok

Causa raiz: a função `facebook-ads-sync-all` só busca `actions: lead, purchase`. Não pega: `initiate_checkout`, `video_view`, `video_3_sec_watched`, `add_to_cart`, `landing_page_view`.

**2. Horário BRT:**
Olhando `lib/periodUtils.ts` (não vi mas inferir das memórias) e o sync:
- `facebook-ads-sync-all` usa `new Date().toISOString().split("T")[0]` → isso é UTC, não BRT. Às 21h BRT já vira "amanhã" UTC.
- `data_ref: row.date_start` vem do FB que respeita o timezone da conta de anúncios
- Filtros do dashboard usam `getPeriodRange` — preciso verificar se converte para BRT

Vou apresentar o diagnóstico + plano de fix.

---

# Plano: Métricas faltantes + Timezone BRT

## Parte 1 — Métricas que estão "—" ou zeradas

**Causa**: A função `facebook-ads-sync-all` (e `facebook-ads-sync`) só extrai 2 ações do Pixel: `lead` e `purchase`. Não captura `initiate_checkout`, `add_to_cart`, `landing_page_view`, nem métricas de vídeo (`video_3_sec_watched`, `video_thruplay_watched`) — por isso **Hook Rate**, **Init Checkout**, **Custo/Checkout**, **LP→Checkout** e **Checkout→Venda** ficam zerados.

**Fix**:
1. Expandir o `fields` da chamada Insights do FB para incluir: `video_3_sec_watched_actions`, `video_thruplay_watched_actions`, `inline_link_clicks`.
2. Expandir o parser de `actions` para extrair: `initiate_checkout`, `offsite_conversion.fb_pixel_initiate_checkout`, `add_to_cart`, `landing_page_view`, `view_content`.
3. Adicionar colunas em `imphq_ads_spend`: `init_checkout`, `add_to_cart`, `landing_page_views`, `video_3s_views`, `video_thruplay`, `link_clicks`.
4. Atualizar o cálculo dos KPIs em `ProjetoFinancas.tsx`:
   - **Hook Rate** = `video_3s_views / impressoes * 100`
   - **Custo/Checkout** = `spend / init_checkout`
   - **LP→Checkout** = `init_checkout / landing_page_views * 100`
   - **Checkout→Venda** = `compras / init_checkout * 100`
   - **CPL real** = `spend / leads` (já temos leads, só não estava sendo dividido quando 0)

## Parte 2 — Timezone BRT

**Problema identificado**:
- `facebook-ads-sync-all` calcula `dfrom`/`dto` com `new Date().toISOString().split("T")[0]` → isso retorna **data UTC**. Às 22h BRT (01h UTC do dia seguinte), o range já pula 1 dia inteiro.
- Resultado: vendas/ads de "hoje BRT 21h-23h59" caem no balde do dia seguinte UTC.

**Fix**:
1. Criar helper `getBRTDateString()` que faz `new Date().toLocaleString("en-CA", { timeZone: "America/Sao_Paulo" })` para gerar `YYYY-MM-DD` em BRT.
2. Aplicar em: `facebook-ads-sync-all`, `facebook-ads-sync`, `daily-briefing`, `payment-recovery`, e qualquer função que calcule "hoje".
3. Verificar `src/lib/periodUtils.ts` — se usar `new Date()` direto para "hoje/ontem/semana", converter para BRT antes de cortar a string.
4. Passar `time_range` para o FB com `time_zone: "America/Sao_Paulo"` (a API aceita essa flag, garante alinhamento).

## Arquivos a editar
- `supabase/functions/facebook-ads-sync-all/index.ts` (campos + ações + BRT)
- `supabase/functions/facebook-ads-sync/index.ts` (mesma coisa)
- `src/lib/periodUtils.ts` (helper BRT)
- `src/components/projeto/ProjetoFinancas.tsx` (novos KPIs com fórmulas reais)
- Migration: ALTER TABLE `imphq_ads_spend` ADD COLUMN `init_checkout`, `add_to_cart`, `landing_page_views`, `video_3s_views`, `video_thruplay`, `link_clicks`

## Ordem de execução
1. Migration (colunas novas)
2. Edge functions FB sync (capturar dados + BRT)
3. periodUtils helper BRT
4. ProjetoFinancas KPIs reais
5. Re-sync manual para popular dados históricos

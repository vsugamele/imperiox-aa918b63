

# Plano: Google Calendar Sync + Funis com Métricas Reais

---

## 1. Google Calendar — Sincronização Bidirecional

### Situação
Não existe conector Google Calendar disponível nos connectors do Lovable. A integração precisa ser feita via **Google Calendar API** diretamente, usando OAuth ou Service Account.

### Abordagem: Edge Function com Google Calendar API

**Pré-requisito**: O usuário precisa criar credenciais no Google Cloud Console (OAuth 2.0) e fornecer `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_REFRESH_TOKEN` como secrets no Supabase.

**Implementação:**

1. **Nova edge function `google-calendar-sync/index.ts`**
   - Actions: `sync_to_google` (envia evento do Supabase → Google) e `sync_from_google` (puxa eventos Google → Supabase)
   - Usa refresh token para obter access token automaticamente
   - Mapeia campos: `title` → `summary`, `description`, `event_date` → `start`, `end_date` → `end`
   - Salva `google_event_id` no campo `color` (ou nova coluna) para rastreamento

2. **Migração: adicionar coluna `google_event_id`** na tabela `imphq_calendar_events`
   - `ALTER TABLE imphq_calendar_events ADD COLUMN google_event_id TEXT;`

3. **UI no `ProjetoCalendario.tsx`**
   - Botão "Sincronizar Google Calendar" no header do calendário
   - Toggle "Auto-sync" que envia para o Google ao criar/editar evento
   - Badge "🔗 Google" nos eventos sincronizados
   - Botão "Importar do Google" para puxar eventos do Google Calendar

---

## 2. Funis — Métricas Reais via Tracker/Leads/Vendas

### Situação atual
O funil já tem integração com `imphq_events` (pixel data) via toggle "Usar dados do Pixel". Porém falta:
- Cruzar com dados de **leads** (`imphq_leads`) e **vendas** (`imphq_vendas`) por URL/projeto
- Calcular **taxa de conversão real** entre etapas conectadas
- Mostrar **benchmarks** de mercado

### Implementação:

1. **Enriquecer dados no `Funis.tsx`** — ao ativar pixel data, também buscar:
   - `imphq_leads` filtrado por `project_id` → contar leads por `utm_source`/`utm_campaign` para mapear a etapas
   - `imphq_vendas` filtrado por `project_id` e `status = 'aprovado'` → mapear vendas às etapas de checkout/upsell
   - Cruzar URLs das etapas com `page_url` dos eventos para matching automático

2. **Calcular conversão entre etapas conectadas**
   - Para cada conexão `A → B`, calcular: `taxa = (visitantes_B / visitantes_A) * 100`
   - Exibir a taxa na linha SVG de conexão como label flutuante
   - Cor dinâmica: verde (>30%), amarelo (10-30%), vermelho (<10%)

3. **Painel de Métricas do Funil** — novo componente abaixo do canvas:
   - Tabela resumo: Etapa | Visitas | Conversões | Taxa | Benchmark
   - Conversão geral do funil (primeira etapa → última etapa)
   - CPL e CPA calculados se dados de ads estiverem disponíveis (`imphq_ads_data`)

4. **Benchmarks de mercado** — dados estáticos baseados em médias conhecidas:
   - Anúncio → LP: 1-3% CTR
   - LP → Checkout: 5-15%
   - Checkout → Compra: 30-60%
   - Upsell acceptance: 10-25%
   - Exibir como "Média do mercado" ao lado da taxa real, com seta indicando acima/abaixo

---

## Resumo de alterações

| Arquivo | Ação |
|---|---|
| `supabase/functions/google-calendar-sync/index.ts` | Nova edge function para sync bidirecional Google Calendar |
| Migração SQL | Adicionar `google_event_id` em `imphq_calendar_events` |
| `src/components/projeto/ProjetoCalendario.tsx` | Botões sync Google, badge, auto-sync toggle |
| `src/pages/Funis.tsx` | Buscar leads/vendas, taxa entre conexões, painel de métricas, benchmarks |

---

## Ordem de execução

1. Migração SQL (coluna `google_event_id`)
2. Edge function `google-calendar-sync`
3. UI do Google Calendar no `ProjetoCalendario`
4. Métricas reais + benchmarks no `Funis.tsx`

**Nota**: Para o Google Calendar funcionar, será necessário adicionar 3 secrets no Supabase: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`. Vou guiar o processo de obtenção após aprovação.


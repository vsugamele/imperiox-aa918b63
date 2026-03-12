

# Plano: Timeline de Leads + Eventos CAPI + Membros no Kanban

## 3 entregas

---

### 1. Timeline visual na pagina de Leads

Ao clicar em um lead (dialog de edicao), adicionar uma aba **"Jornada"** que mostra a timeline completa do visitante.

**Fonte de dados:** Buscar da tabela `imphq_events` pelo email do lead (cruzando com `visitor_id` via dados do lead) e da tabela `imphq_clicks` + `imphq_vendas` + `imphq_webhooks`.

**Implementacao:**
- No dialog de edicao do lead em `Leads.tsx`, adicionar `Tabs` com "Dados" e "Jornada"
- Na aba Jornada: query `imphq_events` filtrando por `visitor_id` (armazenado no campo `data.visitor_id` do lead) + vendas do lead
- Renderizar timeline vertical com icones por tipo de evento (PageView, LeadCapture, ViewContent, AddToCart, Purchase)
- Mostrar: timestamp, nome do evento, page_url, UTMs, dados customizados
- Estilo: linha vertical com dots coloridos por tipo

| Arquivo | Acao |
|---|---|
| `src/pages/Leads.tsx` | Adicionar aba Jornada no dialog de edicao com timeline visual |

---

### 2. Eventos Facebook Pixel + CAPI adicionais

**No script `imptrack.js` (gerado em `Tracker.tsx`):**
- Carregar o Facebook Pixel (`fbq`) dinamicamente se o projeto tiver `pixel_id` configurado
- Disparar `fbq('track', 'PageView')` automaticamente
- Adicionar helpers: `imptrack.trackViewContent(data)`, `imptrack.trackAddToCart(data)` que disparam tanto o `fbq` client-side quanto registram em `imphq_events`
- Incluir `event_id` (UUID) para deduplicacao Pixel ↔ CAPI

**No webhook `webhook-pagamento/index.ts`:**
- Adicionar suporte a novos tipos de evento via query param `?event=Lead` ou `?event=InitiateCheckout`
- Quando o evento nao for `compra_aprovada`, enviar evento CAPI correspondente (Lead, InitiateCheckout) com os mesmos dados hasheados
- Manter a logica existente de Purchase intacta

| Arquivo | Acao |
|---|---|
| `src/pages/Tracker.tsx` | Atualizar script gerado com fbq, ViewContent, AddToCart, event_id |
| `supabase/functions/webhook-pagamento/index.ts` | Adicionar eventos CAPI Lead e InitiateCheckout |

---

### 3. Campo de membro/responsavel nos cards do Kanban

A coluna `assignee_id` ja existe na tabela `imphq_kanban_cards`. A tabela `imphq_team_members` tem nome, avatar_url e id.

**Implementacao:**
- Carregar `imphq_team_members` no KanbanPage
- No card, mostrar avatar pequeno do membro atribuido (canto inferior direito)
- No dialog de criar/editar card, adicionar Select de "Responsavel" com lista de membros
- Adicionar filtro global por membro no header (ao lado do search)
- Salvar/atualizar `assignee_id` como o `id` do team_member (nao auth.users)

**Nota:** `assignee_id` tem FK para `auth.users`, mas os membros podem nao ter `user_id`. Vou usar o campo `assignee_id` armazenando o `id` do `imphq_team_members` como TEXT (o campo aceita UUID, e o id do team_members e UUID). Alternativa: criar nova coluna `member_id TEXT` se o FK causar problemas. Vou criar a migration para adicionar `member_id` para evitar conflitos com o FK existente.

| Arquivo | Acao |
|---|---|
| Migration SQL | Adicionar coluna `member_id TEXT` em `imphq_kanban_cards` |
| `src/pages/KanbanPage.tsx` | Carregar membros, mostrar avatar, filtro por membro, select no dialog |

---

## Resumo de arquivos

| Arquivo | Acao |
|---|---|
| `src/pages/Leads.tsx` | Aba Jornada com timeline de eventos |
| `src/pages/Tracker.tsx` | Script com fbq, ViewContent, AddToCart, event_id |
| `supabase/functions/webhook-pagamento/index.ts` | Eventos CAPI Lead + InitiateCheckout |
| `src/pages/KanbanPage.tsx` | Membros nos cards + filtro |
| Migration SQL | Coluna `member_id` em kanban_cards |


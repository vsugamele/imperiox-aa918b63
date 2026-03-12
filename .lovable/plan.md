

# Plano: Fix 409 Equipe + Kanban Drag&Color + Tracker Pixel Events

## 4 entregas

---

### 1. Fix erro 409 ao adicionar membro na Equipe

**Causa raiz:** A tabela `imphq_team_members` tem um UNIQUE INDEX em `user_id`. O codigo sempre insere `user_id: user?.id` (o ID do admin logado), entao o segundo membro inserido viola essa constraint.

**Solucao:** 
- Migration: remover o unique index de `user_id` (`DROP INDEX imphq_team_members_user_id_key`)
- No codigo `Equipe.tsx`, nao enviar `user_id` no insert (membros da equipe nao sao necessariamente usuarios autenticados). Ou manter como `created_by` semantics, mas sem unique.

| Arquivo | Acao |
|---|---|
| Migration SQL | `DROP INDEX imphq_team_members_user_id_key` |
| `src/pages/Equipe.tsx` | Manter insert sem alteracao (user_id como "quem criou") |

---

### 2. Kanban: corrigir duplicacao visual + adicionar cores + drag-and-drop

**Duplicacao:** Na aba "geral", o `filteredCards` busca cards por `colTitle` match, o que e correto. Porem cada board renderiza seu proprio `TabsContent` com `columns` (que na aba geral sao mergeadas). O problema e que TODOS os 5 `TabsContent` sao renderizados no DOM (Tabs do Radix monta todos), e quando `activeBoard === "geral"`, os outros tabs tambem calculam `filteredCards` com colunas vazias. Vou refatorar para renderizar apenas o tab ativo.

**Cores nos cards:** Adicionar borda lateral colorida por prioridade (urgent=vermelho, high=laranja, medium=verde, low=cinza).

**Drag-and-drop:** Implementar drag nativo com HTML5 Drag API (`draggable`, `onDragStart`, `onDragOver`, `onDrop`). Ao soltar um card em outra coluna, atualizar `column_id` no Supabase. Sem dependencia externa.

| Arquivo | Acao |
|---|---|
| `src/pages/KanbanPage.tsx` | Renderizar apenas tab ativo, adicionar drag-and-drop nativo, borda colorida por prioridade |

---

### 3. Tracker: eventos Facebook Pixel client-side

O script `imptrack.js` gerado em `Tracker.tsx` ja foi atualizado na sessao anterior com `fbq` e helpers `trackViewContent`/`trackAddToCart`. Vou verificar se o codigo atual ja reflete isso, e se nao, garantir que:

- O script carrega `fbq` dinamicamente se `<meta name="imp-pixel-id">` estiver presente
- Dispara `fbq('track', 'PageView')` automaticamente
- Expoe `imptrack.trackViewContent(data)` e `imptrack.trackAddToCart(data)`
- Inclui `event_id` para deduplicacao

### 4. Webhook: eventos CAPI adicionais

O webhook `webhook-pagamento/index.ts` ja foi atualizado na sessao anterior para suportar `Lead` e `InitiateCheckout` via query param `?event=Lead`. Vou verificar se o codigo atual ja reflete essas mudancas e confirmar que estao corretas.

---

## Resumo de arquivos

| Arquivo | Acao |
|---|---|
| Migration SQL | Remover unique index de user_id em imphq_team_members |
| `src/pages/Equipe.tsx` | Sem mudanca necessaria (ou ajuste menor) |
| `src/pages/KanbanPage.tsx` | Fix duplicacao, drag-and-drop, cores por prioridade |
| `src/pages/Tracker.tsx` | Verificar/garantir eventos Pixel no script gerado |
| `supabase/functions/webhook-pagamento/index.ts` | Verificar/garantir eventos CAPI adicionais |


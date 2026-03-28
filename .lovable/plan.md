

# Plano: 5 Correções e Melhorias

## 1. Analytics de Projeto -- incluir dados do Pixel/Events

**Problema**: O analytics dentro do projeto (`ProjetoFinancas` ou `ProjetoKPIs`) não puxa dados da tabela `imphq_events` (PageViews, ViewContent, AddToCart registrados pelo Pixel/imptrack.js).

**Solução**: No `ProjetoFinancas.tsx`, além de vendas e custos, buscar `imphq_events` filtrado pelo `project_id` do projeto. Exibir KPIs: Total PageViews, ViewContent, AddToCart, LeadCapture no período. Adicionar mini-gráfico de eventos/dia.

**Arquivo**: `src/components/projeto/ProjetoFinancas.tsx`

---

## 2. Webhook -- permitir múltiplos webhooks e tokens por projeto

**Problema**: Atualmente só tem 1 URL de webhook e 1 token por projeto. Projetos com múltiplas plataformas (Hotmart + Kiwify + Ticto) precisam de URLs/tokens separados.

**Solução**: No `ProjetoBriefing.tsx`, trocar o campo único de webhook por uma lista dinâmica. Cada webhook terá:
- Nome/plataforma (ex: "Hotmart", "Kiwify")
- URL gerada automaticamente com `?project={id}&source={nome}`
- Token de validação individual

Armazenar em `data.webhooks[]` (array). Manter compatibilidade com o campo antigo `webhook_secret`. No `webhook-pagamento/index.ts`, ler tanto o token do array quanto o legado.

**Arquivos**: `src/components/projeto/ProjetoBriefing.tsx`, `supabase/functions/webhook-pagamento/index.ts`

---

## 3. Chat -- corrigir atualização em tempo real

**Problema**: O chat realtime não está funcionando. O canal de realtime precisa de RLS habilitado com policy de SELECT para que `postgres_changes` funcione.

**Solução**: Verificar se a tabela `imphq_chat_messages` tem replica identity e RLS policies adequadas. No `Chat.tsx`, o subscribe já está correto. O problema provavelmente é que falta habilitar a replication na tabela. Criar migration para `ALTER TABLE imphq_chat_messages REPLICA IDENTITY FULL` e garantir RLS policy de SELECT para authenticated.

**Arquivo**: Migration SQL, `src/pages/Chat.tsx` (verificar se channel está correto)

---

## 4. Leads -- capturar horário (hora/minuto) e exibir na tabela

**Problema**: O `criado_em` já é timestamp, mas na tabela de leads só mostra a data sem hora.

**Solução**: Na tabela de leads e no detalhe, exibir `format(parseISO(l.criado_em), "dd/MM/yyyy HH:mm")` ao invés de só a data. No `capture-lead` e `webhook-pagamento`, garantir que `criado_em` salva com timezone (já faz via default do Supabase).

**Arquivo**: `src/pages/Leads.tsx`

---

## 5. Jornada do lead -- registrar eventos de transição de estágio

**Problema**: Quando o webhook muda o lead de "lead" para "pix_gerado" ou "carrinho_abandonado", isso não aparece na jornada/timeline do lead.

**Solução**: No `webhook-pagamento/index.ts`, após criar/atualizar o lead, inserir um registro em `imphq_events` com `event_name` correspondente ao evento (ex: "PixGerado", "CarrinhoAbandonado", "CompraAprovada") vinculado ao `lead_id`. Também atualizar o `data.ultimo_evento` do lead. No `Leads.tsx`, adicionar esses tipos no `EVENT_CONFIG` e na query de timeline buscar por `lead_id` em `imphq_events`.

**Arquivos**: `supabase/functions/webhook-pagamento/index.ts`, `src/pages/Leads.tsx`

---

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `src/components/projeto/ProjetoFinancas.tsx` | Buscar `imphq_events` do projeto, exibir KPIs de Pixel |
| `src/components/projeto/ProjetoBriefing.tsx` | Lista dinâmica de webhooks com tokens individuais |
| `supabase/functions/webhook-pagamento/index.ts` | Suportar múltiplos tokens, registrar eventos na jornada do lead, atualizar `data.ultimo_evento` |
| `src/pages/Leads.tsx` | Exibir horário (HH:mm), novos tipos de evento na timeline |
| Migration SQL | Replica identity para chat realtime |


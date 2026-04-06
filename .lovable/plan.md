

# Plano: Fix 4 Bugs na Jornada, Score, e Analise IA de Leads

## Bug 1: Jornada duplicada (2x Lead Capturado)

**Causa raiz**: A `loadTimeline` faz 3 queries paralelas que todas podem encontrar o mesmo evento LeadCapture:
- Query 1 (linha 263): busca por `visitor_id`
- Query 2 (linha 275): busca por `lead.id` 
- Query 3 (linha 289): busca por `email`

Como rodam em paralelo com `Promise.all`, o check de dedup `!events.find(ev => ev.id === e.id)` falha — quando a query 3 processa, os resultados da query 1 podem ainda nao estar no array.

**Fix**: Deduplicar DEPOIS de todas as promises resolverem, antes do sort final. Usar um `Map` por `id` para eliminar duplicatas.

```typescript
await Promise.all(promises);
// Dedup by id
const unique = new Map(events.map(e => [e.id, e]));
const deduped = Array.from(unique.values());
deduped.sort((a, b) => ...);
setTimeline(deduped);
```

## Bug 2: Score mostra "form_preenchido" mas respostas nao aparecem

O score e as respostas vem de tabelas diferentes. O score `form_preenchido` e inserido sempre que `body.form_id` existe no capture-lead. Mas as respostas so sao salvas se o formulario tiver campos preenchidos alem dos meta-fields. Se o lead preencheu um form simples (so nome/email/phone), as respostas foram salvas com o fix anterior — o problema pode ser que o lead em questao foi capturado ANTES do fix (sem form_id persistido). Nesse caso, basta mostrar uma mensagem explicativa na secao de respostas: "Este lead foi capturado antes do rastreamento de formularios".

## Bug 3: Botao "Analisar Lead com IA" nao faz nada

**Causa raiz**: O `AIGenerateButton` envia `action: "analyze_lead"` para `openflow-ai`, mas NAO EXISTE handler para essa action. O backend ignora e cai no handler default de automacao, que nao retorna `qualificacao`.

**Fix**: Adicionar handler `analyze_lead` no `openflow-ai/index.ts`:

```typescript
if (action === "analyze_lead") return await handleAnalyzeLead(body, projectContext, aiApiKey, model, aiBaseUrl, mentePrefix);
```

O handler envia os dados do lead (respostas, score, interacoes) para a IA com prompt pedindo analise estruturada retornando JSON com `qualificacao: { dor, nivel_consciencia, objecoes, notas }`.

## Bug 4: Botao de analise em massa

Adicionar um botao "Analisar Leads com IA" na toolbar principal da pagina de Leads (ao lado dos filtros), que permite:
- Analisar todos os leads filtrados de uma vez
- Ou selecionar leads especificos para analise

O botao dispara `analyze_lead` para cada lead selecionado em sequencia e atualiza os campos de qualificacao automaticamente.

---

## Arquivos

| Arquivo | Mudanca |
|---|---|
| `src/pages/Leads.tsx` | Dedup timeline com Map + botao "Analisar Leads" na toolbar + mensagem para leads antigos sem form |
| `supabase/functions/openflow-ai/index.ts` | Adicionar handler `analyze_lead` |

## Ordem

1. Fix dedup timeline (Leads.tsx)
2. Adicionar handler `analyze_lead` (openflow-ai)
3. Deploy edge function
4. Adicionar botao de analise em massa na toolbar


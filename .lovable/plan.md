

# Plano: Fix Lead Capturado Sem Dados na Jornada

## Diagnostico

Investiguei o banco e encontrei **3 bugs** que explicam tudo:

### Bug 1: Evento LeadCapture nao tem `visitor_id`
A edge function `capture-lead` insere o evento em `imphq_events` **sem** definir `visitor_id`. A timeline no frontend busca eventos **apenas** por `visitor_id`. Resultado: o evento existe no banco mas a timeline nunca o encontra.

Confirmacao: `imphq_events` tem 0 registros de LeadCapture (o insert provavelmente falhou pelo bug 2 abaixo, mas mesmo que tivesse dado certo, nao teria `visitor_id`).

### Bug 2: Tabela `imphq_lead_responses` tem schema diferente do esperado
A edge function tenta inserir com coluna `respostas` (JSONB), mas a tabela real tem colunas individuais: `question`, `answer`, `field_key`. O insert falha silenciosamente (erro SQL engolido pelo catch generico).

Schema real:
```text
id | lead_id | project_id | form_id | step | question | answer | field_key | created_at
```

A edge function tenta: `INSERT { respostas: {...} }` → coluna nao existe → falha.

### Bug 3: Timeline nao busca eventos por email
Mesmo se o evento existisse com `visitor_id = leadId`, a timeline so busca por `visitor_id` do campo `data.visitor_id` do lead. Para leads vindos de formulario (sem imptrack.js), esse campo e `null`.

---

## Correcoes

### 1. Edge Function `capture-lead` (deploy necessario)
- Definir `visitor_id: leadId` no insert do evento
- Corrigir insert em `imphq_lead_responses`: usar colunas reais (`question`, `answer`, `field_key`), inserindo uma linha por campo extra em vez de um JSONB unico
- Setar `data.visitor_id = leadId` no lead criado, para que a timeline funcione

### 2. Timeline no `Leads.tsx`
- Adicionar query adicional: buscar eventos `LeadCapture` por `event_data->email` quando `visitor_id` e null
- Isso garante que leads sem imptrack.js (formulario externo) ainda mostrem a captura na jornada

### 3. FormBuilder snippet (`FormBuilder.tsx`)
- Verificar que o snippet gerado envia todos os campos extras com nomes corretos para o mapeamento `field_key`

---

## Resumo de Arquivos

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/capture-lead/index.ts` | `visitor_id: leadId` no evento, `data.visitor_id` no lead, fix insert lead_responses para usar colunas reais |
| `src/pages/Leads.tsx` | Query adicional na timeline: buscar LeadCapture por email quando sem visitor_id |


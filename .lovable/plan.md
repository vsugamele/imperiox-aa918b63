

# Plano: Formulario Simplificado + Fix Ads Aparecendo R$0

---

## Problema 1: Formulario — snippet nao funciona end-to-end

O snippet gera HTML que envia `form_id` junto com os campos, mas a edge function `capture-lead` **ignora completamente** o `form_id`. Ela nao busca o formulario no banco, nao salva respostas em `imphq_lead_responses`, e retorna `{ ok: true }` enquanto o snippet espera `data.success`. O formulario **nunca funciona**.

### O que a pessoa que criar a LP precisa fazer:
Copiar o snippet HTML gerado e colar na pagina. O snippet ja contem todo o CSS (dark theme estilizado), os campos configurados, e o JS que envia os dados. Nao precisa saber nada tecnico — so colar e funciona.

### Correcoes:

**Edge function `capture-lead`:**
- Buscar o formulario pelo `form_id` recebido no body
- Extrair `project_id` e `step` do formulario (nao depender do query param)
- Separar campos padrao (email, nome, phone) dos campos extras
- Salvar respostas extras em `imphq_lead_responses` (form_id, lead_id, respostas como JSON)
- Retornar `{ success: true }` em vez de `{ ok: true }` para match com o snippet

**Snippet (FormBuilder.tsx):**
- Corrigir check de `data.success` (ja esta correto no snippet, o problema era so na edge function)
- Adicionar `page_url: location.href` automaticamente no body enviado

---

## Problema 2: Ads mostrando R$0 no filtro de data

Os dados de ads existem no banco (100 criativos, registros de spend), mas quando o filtro de data esta ativo (ex: "03/04 - 04/04"), o `inDateRange()` compara a string `data_ref` com as datas do filtro. Se os ads tem datas fora desse range (ex: marco), aparecem R$0.

**Causa provavel**: Na pagina global Financas, o filtro de data usa `filterDateFrom`/`filterDateTo` como strings ISO. Na ProjetoFinancas, usa `isWithinInterval` de date-fns. Ambos dependem de `data_ref` do registro de ads bater com o periodo.

### Correcoes:

**Financas.tsx (global):**
- Mostrar um aviso quando o filtro esta ativo e nao ha ads no periodo: "Nenhum dado de Ads neste periodo. Dados existem em [data mais antiga] - [data mais recente]."
- Adicionar botao "Ver todos" que reseta o filtro de data

**ProjetoFinancas.tsx (dentro do projeto):**
- Mesma logica: quando `fAds.length === 0` mas `ads.length > 0`, mostrar aviso com range de datas disponiveis
- O periodo default deveria ser "Todo periodo" para nao confundir

---

## Resumo de arquivos

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/capture-lead/index.ts` | Processar `form_id`, buscar formulario, salvar respostas em `imphq_lead_responses`, retornar `success` |
| `src/components/leads/FormBuilder.tsx` | Adicionar `page_url` no snippet JS |
| `src/pages/Financas.tsx` | Aviso quando filtro esconde ads existentes, botao "Ver todos" |
| `src/components/projeto/ProjetoFinancas.tsx` | Aviso de ads fora do periodo filtrado |

---

## Ordem de execucao

1. Fix edge function capture-lead (form_id + lead_responses + success)
2. Fix snippet (page_url)
3. Avisos de filtro vazio em Financas e ProjetoFinancas


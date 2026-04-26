## Contexto

1. **UTMs sumiram dos "Dados de Compra"**: o `LeadUtmsPanel` só lê `lead.data.utms` e `_vendas[0].data.utms`. Vendas Ticto (e outras) chegam sem UTM nativa, então o painel fica vazio mesmo quando o lead tem origem rastreada. A correção de fallback que fizemos só atingiu o módulo Cohort.
2. **Recuperação não aparece no `/dashboard`**: o `RecoveryKpiBlock` só existe dentro do `ProjetoComando` (tela do projeto). No dashboard global não há nem KPI nem atalho destacado.

---

## Mudanças

### A) `src/components/leads/LeadUtmsPanel.tsx` — fallback robusto
- Função `extractUtms(source)` que varre chaves alternativas em qualquer payload:
  - `data.utms` (objeto)
  - `data.utm_source/utm_medium/utm_campaign/utm_content/utm_term` (flat)
  - `data.tracking.utm_*`
  - `data.checkout.utm_*` (Ticto/Hotmart)
- Para a "Última venda": se a venda não tiver UTMs próprias, **herdar do `lead.data`** e marcar visualmente com badge âmbar `↳ herdado do lead`.
- Mantém os 3 blocos atuais (Captura, Última venda, Primeiro click) e adiciona o badge de origem na venda quando aplicável.

### B) `src/pages/Leads.tsx` — UTM compacta por venda no card de compra
- Linha ~630, dentro do `map` de `editLead._vendas`, adicionar uma linha discreta com `utm_campaign · utm_content` (quando existir, da própria venda OU herdado do `lead.data.utms`), padrão Meta-style com pipe-split.
- Badge `↳ lead` quando a UTM vier do fallback.

### C) `src/components/dashboard/RecoveryGlobalCard.tsx` — novo
- Card que agrega `imphq_vendas` + `imphq_leads` + `imphq_recovery_logs` de **todos os projetos** (sem filtro de `project_id`, respeitando RLS atual).
- Mostra: "Em risco agora" (R$) + "Recuperado este mês" (R$ e contagem) + botão `Ver detalhes` → `/recuperacao`.
- Reusa `buildRecoveryBuckets` e `formatCurrency` de `@/lib/recoveryBuckets`.

### D) `src/pages/Dashboard.tsx` — montagem
- Importar e renderizar `RecoveryGlobalCard` na grade de KPIs (após os cards principais, antes dos charts).
- Adicionar um **chip/atalho destacado** ao lado do título "Dashboard": `🛟 Recuperação` linkando pra `/recuperacao` com cor âmbar quando `currentRisk > 0` (passa um callback simples ou usa estado interno do card).

---

## Arquivos

- `src/components/leads/LeadUtmsPanel.tsx` (refactor extractUtms + fallback lead→venda)
- `src/pages/Leads.tsx` (UTM compacta por venda no card de compra)
- `src/components/dashboard/RecoveryGlobalCard.tsx` (novo)
- `src/pages/Dashboard.tsx` (importar card + chip de atalho)

## Sem mudanças de schema

Tudo lê tabelas existentes (`imphq_leads`, `imphq_vendas`, `imphq_recovery_logs`, `imphq_clicks`).



## Adicionar lista de leads com respostas no Form Insights

### Problema
Hoje a aba "Insights de Captura" mostra só agregados (gráficos/conversão). Pra entender o lead específico você precisa abrir o CRM separado e cruzar manualmente com o formulário. Confuso.

### Solução
Adicionar uma seção **"Respostas Recentes por Lead"** dentro do `FormInsights.tsx`, mostrando cada submissão expandível com nome, email, WhatsApp e todas as perguntas/respostas do form que ele preencheu.

### Mudanças

**`src/components/leads/FormInsights.tsx`**
1. No `load()`, expandir o select de `imphq_leads` pra trazer `nome, email, phone, status, project_id, total_gasto, created_at`.
2. Trazer também `imphq_lead_responses` no formato individual (já vem) — agrupar client-side por `lead_id + form_id + created_at`.
3. Nova seção abaixo dos gráficos: **Card "Respostas Recentes" (md:col-span-2)** com:
   - Lista paginada (20 por vez, botão "Carregar mais")
   - Cada item = `Collapsible` mostrando colapsado: avatar inicial + nome + email + WhatsApp + form name + data + badge status do lead
   - Expandido: lista de pergunta → resposta (usando `question` e `answer` que já existem em `imphq_lead_responses`), respeitando ordem original
   - Botão "Abrir no CRM" → navega `/leads?lead={id}`
4. Filtros existentes (projeto/form) continuam aplicando à nova seção.
5. Search por nome/email no topo da seção.

### Detalhes técnicos
- Tabela `imphq_lead_responses` já guarda `lead_id`, `form_id`, `field_key`, `question`, `answer`, `step`, `created_at` (vide `capture-lead/index.ts` linhas 130-150) → não precisa migration.
- Agrupamento: `Map<lead_id, { lead, form, responses[], submittedAt }>`.
- Performance: `responses` já limitado a 1000; suficiente. Lazy render via slice.
- Estilo: segue padrão Premium Dark (`bg-secondary/40`, `leading-7`, badges existentes).

### Fora de escopo
- Edição de respostas
- Export CSV (pode virar próxima fase se quiser)


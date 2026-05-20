## Fix: contagem global na sidebar de Leads

### Mudanças

1. **`src/pages/Leads.tsx` — `load()`**
   - Adicionar query agregada:
     ```ts
     supabase.from("imphq_leads").select("project_id").limit(20000)
     ```
   - Calcular `projectCounts = { totalAll, byProject: Record<id,count>, noProject }` e guardar em estado.
   - Passar `projectCounts` como prop pro `<LeadsSidebar>`.

2. **`src/components/leads/LeadsSidebar.tsx`**
   - Aceitar prop opcional `projectCounts`.
   - Badge "Todos os leads" usa `projectCounts.totalAll` em vez de `leads.length`.
   - `projectProductMap`: substituir `projectLeads.length` por `projectCounts.byProject[p.id]` quando disponível (lista projetos com count > 0).
   - "Sem projeto" usa `projectCounts.noProject`.

### Fora de escopo
- Vendas, paginação, RLS, tabela principal.

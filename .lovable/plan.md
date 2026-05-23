## Problema

Hoje o `topTags` em `src/pages/Leads.tsx` (linha 472) conta só os leads da **página atual** (`leads` paginado). Por isso o número aparece bem menor que o real. O hook `useLeadTags` existe mas também é limitado (puxa 5000 linhas e conta no cliente) e nem é usado na sidebar.

## Solução: agregar no banco

Criar uma **RPC** `get_lead_tag_counts` que faz `unnest(tags)` + `GROUP BY` direto no Postgres. Retorna `{ tag, count }` já ordenado. Custo de rede mínimo (uma linha por tag, não por lead) e zero limite de 1000.

### Migração

```sql
create or replace function public.get_lead_tag_counts(
  p_project_id text default null,
  p_limit int default 50
)
returns table(tag text, count bigint)
language sql stable security definer set search_path = public as $$
  select t.tag, count(*)::bigint
  from public.imphq_leads l, unnest(l.tags) as t(tag)
  where l.tags is not null
    and (p_project_id is null or l.project_id = p_project_id)
    and t.tag is not null and length(trim(t.tag)) > 0
  group by t.tag
  order by count(*) desc
  limit p_limit;
$$;
```

(RLS continua valendo via `security definer` + filtro por projeto; se preferir respeitar RLS do usuário, troco por `security invoker`.)

### Frontend

1. Reescrever `src/hooks/useLeadTags.ts` para chamar `supabase.rpc('get_lead_tag_counts', { p_project_id, p_limit: 50 })`, com cache em memória por `projectFilter` e TTL de 60s.
2. Em `src/pages/Leads.tsx`:
   - Remover o `topTags` baseado em `leads` (linhas 472–476).
   - Usar `const { tags: topTags } = useLeadTags(projectFilter === 'all' ? null : projectFilter)`.
   - Passar o mesmo array (já com `{ tag, count }`) para `LeadsSidebar` e para o `<Select>` de filtro.
3. Invalidar o cache do hook quando o usuário criar/editar tags (já há realtime de leads — opcional disparar refetch on insert).

## Fora do escopo
- Paginação dos leads em si (continua igual, é só a contagem que muda).
- Outros contadores da sidebar (`projectCounts` já é feito server-side).

## Resultado
Contagem real de tags em toda a base, com 1 round-trip leve, sem carregar 5k+ leads no cliente.

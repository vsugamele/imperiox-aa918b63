create or replace function public.get_lead_tag_counts(
  p_project_id text default null,
  p_limit int default 50
)
returns table(tag text, count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select t.tag::text, count(*)::bigint
  from public.imphq_leads l
  cross join lateral unnest(l.tags) as t(tag)
  where l.tags is not null
    and (p_project_id is null or l.project_id = p_project_id)
    and t.tag is not null
    and length(btrim(t.tag::text)) > 0
  group by t.tag
  order by count(*) desc
  limit p_limit;
$$;

grant execute on function public.get_lead_tag_counts(text, int) to anon, authenticated;
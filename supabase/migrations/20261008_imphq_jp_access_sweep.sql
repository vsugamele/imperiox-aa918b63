-- JP2.1: compra aprovada na Ticto (principal ou bump) que não virou acesso na área de membros.
-- A área de membros só entrega o produto principal pelo ID da Ticto; bumps chegam dentro da mesma compra e eram ignorados.
-- Usa o mapa de produtos da própria área de membros (areamembrojp_external_product_map, source 'ticto').
create or replace function public.imphq_jp_access_gaps(p_since date default '2026-03-27')
returns table (venda_id text, produto_nome text, tipo_venda text, data_venda timestamptz, email text, user_id uuid, program_id uuid, grants_all_premium boolean)
language sql stable security definer set search_path = public, auth as $$
  with vend as (
    select distinct on (lower(trim(l.email)), m.id)
      v.id as venda_id, v.produto_nome, v.tipo_venda, v.data_venda, lower(trim(l.email)) as email, m.program_id, m.grants_all_premium
    from imphq_vendas v
    join imphq_leads l on l.id = v.lead_id
    join areamembrojp_external_product_map m on m.source = 'ticto' and lower(m.external_product_name) = lower(v.produto_nome)
    where v.project_id = 'jp_freitas' and v.status = 'aprovado' and v.data_venda >= p_since
      and l.email like '%@%' and v.produto_nome !~* 'assinatura|recorrente'
    order by lower(trim(l.email)), m.id, v.data_venda desc
  ), withuser as (
    select vend.*, u.id as uid from vend left join auth.users u on lower(u.email) = vend.email
  )
  select w.venda_id, w.produto_nome, w.tipo_venda, w.data_venda, w.email, w.uid, w.program_id, w.grants_all_premium
  from withuser w
  where not exists (
    -- já liberado por esta varredura (mesmo que tenha vencido depois): não libera de novo
    select 1 from areamembrojp_user_entitlements e where e.source_ref = w.venda_id::text
  ) and not exists (
    select 1 from areamembrojp_user_entitlements e
    left join areamembrojp_plans pl on pl.id = e.plan_id
    where e.user_id = w.uid and e.is_active and (e.expires_at is null or e.expires_at > now())
      and (e.scope = 'all' or coalesce(pl.grants_all_programs, false)
           or (not w.grants_all_premium and (e.program_id = w.program_id
               or exists (select 1 from areamembrojp_plan_programs pp where pp.plan_id = e.plan_id and pp.program_id = w.program_id))))
  )
  order by w.data_venda;
$$;

revoke all on function public.imphq_jp_access_gaps(date) from public, anon, authenticated;
grant execute on function public.imphq_jp_access_gaps(date) to service_role;

-- Uma vez por dia, 07:40 BRT, e logo depois de cada rodada o que entrou aparece em "A IA fez".
do $$
declare k text := (select substring(command from '"apikey":"([^"]+)"') from cron.job where jobname = 'zernio-ads-sync-daily');
begin
  perform cron.unschedule(jobname) from cron.job where jobname = 'jp-access-sweep-daily';
  perform cron.schedule('jp-access-sweep-daily', '40 10 * * *', format($c$select net.http_post(url := 'https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/jp-access-sweep', headers := jsonb_build_object('Content-Type','application/json','apikey',%L,'Authorization','Bearer '||%L), body := '{"modo":"run"}'::jsonb, timeout_milliseconds := 120000)$c$, k, k));
end $$;

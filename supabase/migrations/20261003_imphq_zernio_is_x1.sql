-- Zernio é o X1 do Direct do Instagram, não fonte de anúncio (Vinicius, 03/10/2026).
-- 1) Desliga o cron que buscava anúncios pelo Zernio (falhava todo dia numa conta sem campanhas). Religar:
--    select cron.alter_job((select jobid from cron.job where jobname = 'zernio-ads-sync-daily'), active := true);
-- 2) A saúde do sync de anúncios passa a olhar só a Meta direta.
select cron.alter_job(jobid, active := false) from cron.job where jobname = 'zernio-ads-sync-daily';

drop view if exists public.imphq_v_ads_sync_health;
create view public.imphq_v_ads_sync_health as
select p.id as project_id,
       (p.data ? 'facebook_ad_account_id') as meta_configurado,
       p.data->>'facebook_sync_status' as meta_status,
       nullif(p.data->>'facebook_last_sync', '')::timestamptz as meta_ultimo_sync,
       p.data->'facebook_sync_error'->>'code' as meta_erro_codigo,
       left(p.data->'facebook_sync_error'->>'message', 300) as meta_erro,
       (select max(s.data_ref) from public.imphq_ads_spend s where s.project_id = p.id and s.valor > 0) as ultimo_dia_com_gasto
  from public.imphq_projects p
 where p.data ? 'facebook_ad_account_id';

revoke all on public.imphq_v_ads_sync_health from anon, public;
grant select on public.imphq_v_ads_sync_health to authenticated;

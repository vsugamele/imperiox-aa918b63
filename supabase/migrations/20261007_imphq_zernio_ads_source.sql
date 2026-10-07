-- Zernio volta a contar como fonte de gasto (Vinicius, 07/10: "Zernio mantém, o que tiver usando do Zernio tá tudo certo").
-- Desfaz a parte de anúncios de 20261003_imphq_zernio_is_x1.sql: cron de anúncios via Zernio ativo e saúde do sync com Meta e Zernio
-- (basta um caminho funcionando). O Zernio segue também como X1 do Direct.
select cron.alter_job(jobid, active := true) from cron.job where jobname = 'zernio-ads-sync-daily';

drop view if exists public.imphq_v_ads_sync_health;
create view public.imphq_v_ads_sync_health as
select p.id as project_id,
       (p.data ? 'facebook_ad_account_id') as meta_configurado,
       p.data->>'facebook_sync_status' as meta_status,
       nullif(p.data->>'facebook_last_sync', '')::timestamptz as meta_ultimo_sync,
       p.data->'facebook_sync_error'->>'code' as meta_erro_codigo,
       left(p.data->'facebook_sync_error'->>'message', 300) as meta_erro,
       (c.credentials ? 'zernio_ad_account_id') as zernio_configurado,
       c.credentials->>'zernio_ads_last_sync_status' as zernio_status,
       nullif(c.credentials->>'zernio_ads_last_sync', '')::timestamptz as zernio_ultimo_sync,
       left(c.credentials->>'zernio_ads_last_sync_error', 300) as zernio_erro,
       (select max(s.data_ref) from public.imphq_ads_spend s where s.project_id = p.id and s.valor > 0) as ultimo_dia_com_gasto
  from public.imphq_projects p
  left join public.imphq_integration_credentials c on c.project_id = p.id and c.provider = 'instagram' and c.credentials ? 'zernio_api_key'
 where p.data ? 'facebook_ad_account_id' or c.credentials ? 'zernio_ad_account_id';

revoke all on public.imphq_v_ads_sync_health from anon, public;
grant select on public.imphq_v_ads_sync_health to authenticated;

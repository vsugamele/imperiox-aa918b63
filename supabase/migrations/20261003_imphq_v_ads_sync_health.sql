-- Saúde do sync de anúncios por projeto (LIVE1.3): só status, data e mensagem de erro — nunca token ou chave.
-- Meta direto: imphq_projects.data.facebook_sync_* (gravado por facebook-ads-sync-all).
-- Zernio: imphq_integration_credentials.credentials.zernio_ads_last_sync_* (gravado por zernio-ads-sync).

create or replace view public.imphq_v_ads_sync_health as
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
 where p.data ? 'facebook_ad_account_id' or c.project_id is not null;

revoke all on public.imphq_v_ads_sync_health from anon, public;
grant select on public.imphq_v_ads_sync_health to authenticated;

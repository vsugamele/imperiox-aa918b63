-- Proposta da IA sem resposta expira (UX1.3). Nada é apagado: status 'expired' + expired_at.
-- Decisão do Vinicius (02/10): expirar as antigas (>7 dias) e, daqui pra frente, expirar sozinho após 7 dias,
-- para a fila "Aprovar" mostrar só o que ainda vale decidir.

alter table public.imphq_ai_actions add column if not exists expired_at timestamptz;

alter table public.imphq_ai_actions drop constraint if exists imphq_ai_actions_status_check;
alter table public.imphq_ai_actions add constraint imphq_ai_actions_status_check
  check (status = any (array['proposed', 'approved', 'rejected', 'executed', 'reverted', 'failed', 'expired']));

create or replace function public.imphq_expire_ai_actions(p_days integer default 7)
returns integer language sql security definer set search_path = public as $$
  with expired as (
    update imphq_ai_actions
       set status = 'expired', expired_at = now()
     where status = 'proposed' and created_at < now() - make_interval(days => p_days)
    returning 1
  )
  select count(*)::integer from expired;
$$;
revoke all on function public.imphq_expire_ai_actions(integer) from public, anon;
grant execute on function public.imphq_expire_ai_actions(integer) to authenticated;

-- Todo dia 03:15 BRT.
select cron.unschedule('imphq-expire-ai-actions') where exists (select 1 from cron.job where jobname = 'imphq-expire-ai-actions');
select cron.schedule('imphq-expire-ai-actions', '15 6 * * *', 'select public.imphq_expire_ai_actions(7)');

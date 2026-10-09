-- OF2.1: faxina de execuções do OpenFlow presas em "running".
-- Uma execução que morre no meio (tempo limite, erro de rede) fica em "running" para sempre: suja contagens/painel e
-- segura a trava entre fluxos do lead. Em 09/10 eram 365, de jun a set.
-- Fica de fora o que espera de propósito em "running": conversa de canal (Cinna/webchat, channel_session_id) e
-- execução aguardando evento (waiting_for).

create or replace function public.imphq_flow_sweep_stale(p_hours int default 24)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.imphq_flow_executions
     set status = 'failed',
         last_error_kind = 'stale_running',
         last_error_at = now(),
         error_message = coalesce(error_message || ' | ', '') || 'Parada em running há mais de ' || p_hours || 'h; encerrada pela faxina (OF2.1)'
   where status = 'running'
     and updated_at < now() - make_interval(hours => p_hours)
     and channel_session_id is null
     and waiting_for is null;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.imphq_flow_sweep_stale(int) from public, anon, authenticated;

select cron.unschedule('openflow-stale-sweep') where exists (select 1 from cron.job where jobname = 'openflow-stale-sweep');
select cron.schedule('openflow-stale-sweep', '23 * * * *', $$select public.imphq_flow_sweep_stale(24)$$);

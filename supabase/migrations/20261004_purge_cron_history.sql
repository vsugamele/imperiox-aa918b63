-- Limpeza do histórico do pg_cron (Story OP1.3, aprovada pelo Vinicius em 03/10/2026).
-- O histórico nunca era limpo e chegou a 1,2 GB de 3 GB do banco. Mantém 7 dias.
-- Limpeza inicial feita em 04/10: 1,26 milhão de execuções apagadas em lotes + VACUUM FULL (1.233 MB → 39 MB).
-- Desfazer o agendamento: select cron.unschedule('purge-cron-history-daily');
select cron.schedule(
  'purge-cron-history-daily',
  '30 4 * * *',
  $$delete from cron.job_run_details where start_time < now() - interval '7 days'$$
);

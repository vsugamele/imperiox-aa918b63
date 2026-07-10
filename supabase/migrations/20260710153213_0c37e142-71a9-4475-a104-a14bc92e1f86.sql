ALTER TABLE public.imphq_flow_executions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.imphq_flow_executions;
ALTER TABLE public.imphq_automacao_logs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.imphq_automacao_logs;
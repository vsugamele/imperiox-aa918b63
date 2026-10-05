-- Painel "O que está no ar": diagnóstico de frescor/saúde, só leitura.
-- Cada check: key, area, label, status (ok|warn|fail|unknown), last_at, detail, hint.
-- Reversível: DROP FUNCTION public.imphq_system_health();

CREATE OR REPLACE FUNCTION public.imphq_system_health()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'cron'
AS $function$
declare
  v_checks jsonb := '[]'::jsonb;
  v_ts timestamptz;
  v_n bigint;
  v_n2 bigint;
  v_n3 bigint;
  v_txt text;
  r record;
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'login obrigatório';
  end if;

  -- 1) Token da Meta por projeto configurado
  for r in
    select id, name,
           data->>'facebook_sync_status' as st,
           data->'facebook_sync_error'->>'message' as err,
           nullif(data->>'facebook_last_sync', '')::timestamptz as last_sync
      from imphq_projects
     where data ? 'facebook_ad_account_id'
       and (data ? 'facebook_access_token' or data ? 'facebook_marketing_token')
  loop
    v_checks := v_checks || jsonb_build_object(
      'key', 'meta_token:' || r.id,
      'area', 'Tráfego',
      'label', 'Conexão Meta Ads — ' || r.name,
      'status', case
        when r.st = 'error' then 'fail'
        when r.last_sync is null then 'unknown'
        when r.last_sync < now() - interval '2 days' then 'warn'
        else 'ok' end,
      'last_at', r.last_sync,
      'detail', case when r.st = 'error' then left(coalesce(r.err, 'erro sem mensagem'), 220)
                     else 'Último sync bem-sucedido' end,
      'hint', case when r.err ilike '%session has expired%' or r.err ilike '%access token%'
                   then 'Token da Meta expirou: gere um novo token e cole em Projeto → Integrações → Facebook.'
                   when r.st = 'error' then 'Abra o projeto e revise a integração do Facebook.'
                   else null end
    );
  end loop;

  -- 2) Gastos de ads chegando
  select max(coalesce(data_ref, date, data))::timestamptz into v_ts from imphq_ads_spend;
  v_checks := v_checks || jsonb_build_object(
    'key', 'ads_spend', 'area', 'Tráfego', 'label', 'Gastos de anúncios importados',
    'status', case when v_ts is null then 'unknown'
                   when v_ts < now() - interval '7 days' then 'fail'
                   when v_ts < now() - interval '2 days' then 'warn' else 'ok' end,
    'last_at', v_ts,
    'detail', 'Dia mais recente com gasto registrado',
    'hint', case when v_ts < now() - interval '2 days'
                 then 'Sem gasto novo: ROAS, semáforo e regras de ads estão cegos. Verifique a conexão Meta acima.' end
  );

  -- 3) Motor de regras de ads
  select max(created_at) into v_ts from imphq_ai_actions where source = 'ads-rules-engine';
  v_checks := v_checks || jsonb_build_object(
    'key', 'ads_rules_engine', 'area', 'Tráfego', 'label', 'Motor de regras de anúncios',
    'status', case when v_ts is null then 'unknown'
                   when v_ts < now() - interval '7 days' then 'fail'
                   when v_ts < now() - interval '2 days' then 'warn' else 'ok' end,
    'last_at', v_ts,
    'detail', 'Última proposta gerada (pausar/ajustar verba)',
    'hint', case when v_ts is null or v_ts < now() - interval '2 days'
                 then 'Depende dos gastos de anúncios; sem gasto novo ele não propõe nada.' end
  );

  -- 4) Vendas entrando (webhooks)
  select max(created_at) into v_ts from imphq_vendas where status = 'aprovado';
  select count(*) into v_n from imphq_vendas where status = 'aprovado' and created_at > now() - interval '24 hours';
  v_checks := v_checks || jsonb_build_object(
    'key', 'vendas', 'area', 'Vendas', 'label', 'Vendas aprovadas chegando (webhook)',
    'status', case when v_ts is null then 'unknown'
                   when v_ts < now() - interval '5 days' then 'fail'
                   when v_ts < now() - interval '2 days' then 'warn' else 'ok' end,
    'last_at', v_ts,
    'detail', v_n || ' venda(s) aprovada(s) nas últimas 24h',
    'hint', case when v_ts < now() - interval '2 days'
                 then 'Sem venda aprovada há mais de 2 dias: confira se o webhook da plataforma (Hotmart/Kiwify etc.) segue apontando pra cá.' end
  );

  -- 5) Erros de webhook
  select count(*) into v_n from imphq_webhook_errors where created_at > now() - interval '24 hours' and reprocessado_at is null;
  v_checks := v_checks || jsonb_build_object(
    'key', 'webhook_errors', 'area', 'Vendas', 'label', 'Erros de webhook (24h)',
    'status', case when v_n = 0 then 'ok' when v_n < 5 then 'warn' else 'fail' end,
    'last_at', (select max(created_at) from imphq_webhook_errors),
    'detail', v_n || ' erro(s) não reprocessado(s) nas últimas 24h',
    'hint', case when v_n > 0 then 'Abra Webhooks → erros e reprocesse.' end
  );

  -- 6) Bot de WhatsApp respondendo
  select max(created_at) into v_ts from imphq_wa_ai_logs;
  v_checks := v_checks || jsonb_build_object(
    'key', 'wa_ai', 'area', 'WhatsApp', 'label', 'Bot de WhatsApp (IA) respondendo',
    'status', case when v_ts is null then 'unknown'
                   when v_ts < now() - interval '3 days' then 'fail'
                   when v_ts < now() - interval '1 day' then 'warn' else 'ok' end,
    'last_at', v_ts,
    'detail', 'Última resposta registrada pela IA'
  );

  select max(created_at) into v_ts from imphq_wa_messages;
  v_checks := v_checks || jsonb_build_object(
    'key', 'wa_messages', 'area', 'WhatsApp', 'label', 'Mensagens de WhatsApp chegando',
    'status', case when v_ts is null then 'unknown'
                   when v_ts < now() - interval '1 day' then 'fail'
                   when v_ts < now() - interval '3 hours' then 'warn' else 'ok' end,
    'last_at', v_ts,
    'detail', 'Última mensagem registrada (entrada ou saída)',
    'hint', case when v_ts < now() - interval '3 hours' then 'Confira se a instância do WhatsApp está conectada.' end
  );

  -- 7) Recuperação de Pix/carrinho
  select count(*) filter (where status = 'failed'), count(*) filter (where status in ('executed', 'done', 'success'))
    into v_n, v_n2
    from imphq_ai_actions
   where kind = 'payment_recovery' and created_at > now() - interval '7 days';
  select max(created_at) into v_ts from imphq_recovery_logs;
  v_checks := v_checks || jsonb_build_object(
    'key', 'recovery', 'area', 'Vendas', 'label', 'Recuperação de Pix/carrinho',
    'status', case when v_n > 0 and v_n >= v_n2 then 'fail' when v_n > 0 then 'warn' else 'ok' end,
    'last_at', v_ts,
    'detail', 'Últimos 7 dias: ' || v_n2 || ' disparo(s) ok, ' || v_n || ' falha(s)',
    'hint', case when v_n > 0 then 'Há falhas de envio na recuperação: veja /recuperacao e a conexão do WhatsApp.' end
  );

  -- 8) Jobs agendados (pg_cron) falhando nas últimas 24h
  begin
    select count(*), count(distinct d.jobid) into v_n, v_n2
      from cron.job_run_details d
     where d.start_time > now() - interval '24 hours' and d.status <> 'succeeded';
    select count(*) into v_n3 from cron.job_run_details d
     where d.start_time > now() - interval '24 hours';
    v_checks := v_checks || jsonb_build_object(
      'key', 'pg_cron', 'area', 'Infra', 'label', 'Rotinas agendadas (cron)',
      'status', case when v_n = 0 then 'ok'
                     when v_n::numeric / greatest(v_n3, 1) > 0.05 then 'fail'
                     else 'warn' end,
      'last_at', (select max(start_time) from cron.job_run_details),
      'detail', v_n || ' falha(s) em ' || v_n2 || ' rotina(s) de ' || v_n3 || ' execuções nas últimas 24h',
      'hint', case when v_n > 0 then 'Falhas esporádicas de "connection failed" se recuperam sozinhas; se subir, revise a rotina.' end
    );
  exception when others then
    v_checks := v_checks || jsonb_build_object(
      'key', 'pg_cron', 'area', 'Infra', 'label', 'Rotinas agendadas (cron)',
      'status', 'unknown', 'detail', 'Sem acesso ao histórico do cron: ' || sqlerrm);
  end;

  -- 9) Jobs gerenciados (imphq_cron_jobs) com último status ruim
  select count(*), string_agg(job_key, ', ') into v_n, v_txt
    from imphq_cron_jobs where is_enabled and coalesce(last_status, '') not in ('success', '');
  v_checks := v_checks || jsonb_build_object(
    'key', 'managed_jobs', 'area', 'Infra', 'label', 'Automações do painel',
    'status', case when v_n = 0 then 'ok' else 'fail' end,
    'last_at', (select max(last_run_at) from imphq_cron_jobs where is_enabled),
    'detail', case when v_n = 0 then 'Todas as automações ativas rodaram com sucesso na última vez'
                   else 'Com erro: ' || v_txt end
  );

  -- 10) Cofre de senhas instalado
  select count(*) into v_n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('imphq_reveal_account_secret', 'imphq_set_account_secret');
  v_checks := v_checks || jsonb_build_object(
    'key', 'cofre', 'area', 'Infra', 'label', 'Cofre de senhas (funções no banco)',
    'status', case when v_n = 2 then 'ok' else 'fail' end,
    'detail', v_n || '/2 funções presentes'
  );

  return jsonb_build_object('generated_at', now(), 'checks', v_checks);
end;
$function$;

REVOKE ALL ON FUNCTION public.imphq_system_health() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.imphq_system_health() TO authenticated, service_role;

-- Sala de máquinas (Story OP1.3): retrato da saúde do Império numa leitura só — rotinas, ações automáticas,
-- webhooks, sync de anúncios, chips de WhatsApp, Instagram/Zernio, voz, custo de IA e frescor das fontes por projeto.
-- SECURITY DEFINER para ler o pg_cron; devolve só status e datas, nunca comandos, tokens ou payloads.
create or replace function public.imphq_machine_room()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'gerado_em', now(),
    'banco', jsonb_build_object('total_mb', round(pg_database_size(current_database()) / 1048576.0), 'historico_cron_mb', round(pg_total_relation_size('cron.job_run_details') / 1048576.0)),
    'rotinas', coalesce((
      -- Só as ~30 mil execuções mais recentes (2 a 3 dias), pela chave da tabela: o histórico do pg_cron não é indexado por data.
      with recent as (
        select d.jobid, d.status, d.start_time, d.return_message
        from cron.job_run_details d
        where d.runid > (select max(runid) - 30000 from cron.job_run_details)
      ),
      last_run as (
        select distinct on (jobid) jobid, status, start_time from recent order by jobid, start_time desc
      ),
      agg as (
        select jobid,
               count(*) filter (where start_time > now() - interval '24 hours') execucoes_24h,
               count(*) filter (where start_time > now() - interval '24 hours' and status = 'failed') falhas_24h,
               (array_agg(left(return_message, 160) order by start_time desc) filter (where status = 'failed'))[1] ultimo_erro
        from recent group by jobid
      )
      select jsonb_agg(jsonb_build_object(
        'jobid', j.jobid, 'nome', coalesce(j.jobname, 'job ' || j.jobid), 'agenda', j.schedule,
        'ultima', l.start_time, 'ultimo_status', l.status,
        'execucoes_24h', coalesce(a.execucoes_24h, 0), 'falhas_24h', coalesce(a.falhas_24h, 0), 'ultimo_erro', a.ultimo_erro
      ) order by coalesce(j.jobname, ''))
      from cron.job j left join last_run l on l.jobid = j.jobid left join agg a on a.jobid = j.jobid
      where j.active), '[]'::jsonb),
    'acoes', coalesce((
      select jsonb_agg(a order by (a->>'falhas_7d')::int desc) from (
        select jsonb_build_object(
          'origem', coalesce(source, '?'),
          'falhas_7d', count(*) filter (where status = 'failed' and created_at > now() - interval '7 days'),
          'executadas_7d', count(*) filter (where status in ('executed', 'approved') and created_at > now() - interval '7 days'),
          'expiradas_7d', count(*) filter (where status = 'expired' and created_at > now() - interval '7 days'),
          'abertas', count(*) filter (where status = 'proposed'),
          'ultima_falha', max(created_at) filter (where status = 'failed'),
          'ultimo_erro', (select left(b.error, 160) from imphq_ai_actions b where b.source = a0.source and b.status = 'failed' order by b.created_at desc limit 1)
        ) a
        from imphq_ai_actions a0
        where created_at > now() - interval '30 days'
        group by source
      ) x), '[]'::jsonb),
    'webhooks', coalesce((
      select jsonb_agg(w order by w->>'plataforma') from (
        select jsonb_build_object(
          'plataforma', p.plataforma,
          'ultimo_recebido', (select max(created_at) from imphq_webhooks h where h.plataforma = p.plataforma),
          'erros_24h', (select count(*) from imphq_webhook_errors e where e.plataforma = p.plataforma and e.created_at > now() - interval '24 hours'),
          'ultimo_erro', (select left(e.erro, 160) from imphq_webhook_errors e where e.plataforma = p.plataforma order by e.created_at desc limit 1),
          'ultimo_erro_em', (select max(e.created_at) from imphq_webhook_errors e where e.plataforma = p.plataforma)
        ) w
        from (select distinct plataforma from imphq_webhooks where created_at > now() - interval '120 days' and plataforma is not null) p
      ) x), '[]'::jsonb),
    'anuncios', coalesce((select jsonb_agg(to_jsonb(h)) from imphq_v_ads_sync_health h), '[]'::jsonb),
    'whatsapp', coalesce((
      select jsonb_agg(jsonb_build_object('projeto', project_id, 'instancia', coalesce(display_name, instance_name), 'ativo', is_active, 'status', status, 'visto', last_seen_at))
      from imphq_wa_providers), '[]'::jsonb),
    'instagram', coalesce((
      select jsonb_agg(jsonb_build_object(
        'projeto', project_id,
        'conta', credentials->>'username',
        'saude_ok', credentials->>'zernio_health_ok',
        'saude_em', credentials->>'zernio_last_health_at',
        'ultimo_webhook', credentials->>'zernio_last_webhook_at',
        'erro', left(credentials->>'zernio_health_error', 160)))
      from imphq_integration_credentials where provider = 'instagram'), '[]'::jsonb),
    'voz', jsonb_build_object(
      'ultimo_envio', (select max(created_at) from imphq_wa_voice_log where status = 'sent'),
      'ultima_falta_saldo', (select max(created_at) from imphq_wa_voice_log where reason ilike '%quota%'),
      'enviados_7d', (select count(*) from imphq_wa_voice_log where status = 'sent' and created_at > now() - interval '7 days')),
    'provedores', coalesce((
      select jsonb_agg(jsonb_build_object(
        'provedor', u.provider, 'lido_em', u.read_at, 'gasto_hoje_usd', u.spent_usd, 'unidades', u.units_used, 'unidade', u.unit, 'saldo', u.balance,
        'gasto_7d_usd', (select round(sum(x.spent_usd), 4) from imphq_provider_usage_daily x where x.provider = u.provider and x.usage_date > current_date - 7),
        'detalhes', u.details))
      from (select distinct on (provider) * from imphq_provider_usage_daily order by provider, usage_date desc) u), '[]'::jsonb),
    'custo_ia_7d', coalesce((
      select jsonb_agg(c order by (c->>'custo_usd')::numeric desc nulls last) from (
        select jsonb_build_object('origem', origem, 'projeto', project_id, 'chamadas', count(*), 'custo_usd', round(sum(cost_usd)::numeric, 4)) c
        from (
          select 'wa-ai-reply'::text origem, project_id, cost_usd from imphq_wa_ai_logs where created_at > now() - interval '7 days'
          union all
          select coalesce(function_name, '?'), project_id, cost_usd from imphq_ai_usage where created_at > now() - interval '7 days'
        ) u group by origem, project_id
      ) x), '[]'::jsonb),
    'fontes', coalesce((
      select jsonb_agg(f order by f->>'projeto') from (
        select jsonb_build_object(
          'projeto', p.id,
          'nome', p.name,
          'ultima_venda', (select max(created_at) from imphq_vendas v where v.project_id = p.id and v.status = 'aprovado'),
          'ultimo_evento', (select max(created_at) from imphq_events e where e.project_id = p.id),
          'ultima_msg_recebida', (select max(created_at) from imphq_wa_messages m where m.project_id = p.id and m.direction = 'incoming'),
          'ultimo_gasto', (select max(coalesce(data_ref, data)) from imphq_ads_spend s where s.project_id = p.id)
        ) f
        from imphq_projects p where coalesce(p.active, true) and not coalesce(p.is_archived, false)
      ) x), '[]'::jsonb)
  );
$$;

revoke all on function public.imphq_machine_room() from public, anon;
grant execute on function public.imphq_machine_room() to authenticated, service_role;

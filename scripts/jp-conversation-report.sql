-- Read-only. Run: supabase db query --linked --file scripts/jp-conversation-report.sql
-- Window defaults to the last 7 days. Conversations, turns and sales are different cohorts.
with period as (select now()-interval '7 days' since,now() until),
turns as (
  select e.* from public.imphq_jp_conversation_events e,period p
  where e.kind='turn' and e.source_message_at between p.since and p.until
),
payments as (
  select v.* from public.imphq_vendas v,period p
  where v.project_id='jp_freitas' and v.status in ('aprovado','aprovada','paga','approved','paid')
    and coalesce(v.data_venda,v.created_at) between p.since and p.until
),
rule_sales as (
  select distinct a.venda_id from public.imphq_wa_rule_applications a join public.imphq_vendas v on v.id=a.venda_id and v.project_id=a.project_id
  cross join period p where a.project_id='jp_freitas' and a.attribution_policy='JP1.5'
    and a.converted_at between p.since and p.until and v.status in ('aprovado','aprovada','paga','approved','paid')
)
select jsonb_build_object(
  'period', (select to_jsonb(p) from period p),
  'turns_by_channel_mode', (select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select channel,evidence->>'mode' mode,count(*) turns,count(distinct conversation_id) conversations from turns group by 1,2) t),
  'explicit_purchase_turns', (select count(*) from turns where evidence->>'purchase_signal'='explicit'),
  'qualification', jsonb_build_object('turns_with_declared_need',(select count(*) from turns where evidence->'facts' ? 'pain' or evidence->'facts' ? 'seeking'),'product_fit_confirmed','not_measured_without_explicit_evidence'),
  'support', (select jsonb_build_object('pending',count(*) filter(where support_status is not null and support_status<>'confirmed'),'confirmed_by_learner',count(*) filter(where support_status='confirmed'),
    'awaiting_confirmation',count(*) filter(where support_status='awaiting_confirmation'),'without_owner',count(*) filter(where support_status is not null and support_status<>'confirmed' and owner_id is null),
    'avg_hours_to_confirmation',avg(extract(epoch from(support_confirmed_at-support_opened_at))/3600) filter(where support_status='confirmed')) from public.imphq_jp_conversation_state),
  'same_access_issue_after_link', (select count(*) from turns t where t.evidence->>'support_kind'='access' and t.evidence->>'support_confirmed'='false' and exists(select 1 from public.imphq_jp_conversation_events e where e.channel=t.channel and e.conversation_id=t.conversation_id and e.kind='access_link_sent' and e.source_message_at<t.source_message_at)),
  'approved_payments', (select count(*) from payments),
  'approved_gross_value', (select coalesce(sum(valor),0) from payments),
  'approved_with_utm', (select count(*) from payments where nullif(utm_source,'') is not null),
  'approved_associated_with_rules_JP1_5', (select count(*) from rule_sales),
  'quality', jsonb_build_object('regression_gate','npm test -- src/test/jp-service-policy.test.ts src/test/conversation-policy.test.ts src/test/jp-access-recovery.test.ts','semantic_review_required_before_ab_promotion',true),
  'limits','Rule association within 7 days is not causal attribution or a conversion rate. Historical scores/counters were preserved. Support totals are current stock; confirmed means explicit learner reply, not independently verified login. Payment window uses payment date, not lead/message cohort.'
) as report;

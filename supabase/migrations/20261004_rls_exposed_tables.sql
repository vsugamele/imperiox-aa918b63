-- Segurança (Story SEC1.1, aprovada pelo Vinicius em 04/10/2026): 15 tabelas do Império estavam sem RLS e podiam ser lidas
-- com a chave pública do app (leads, vendas, memória de conversas, webhooks de compra e contas com senha).
-- Agora só usuário logado lê e grava; functions com a chave de servidor não passam pelo RLS e seguem iguais.
-- imphq_leads e imphq_clicks mantêm gravação anônima (sem leitura) caso alguma página externa grave direto.
-- Desfazer uma tabela: alter table public.<tabela> disable row level security;

alter table public.imphq_leads enable row level security;
drop policy if exists "auth manage imphq_leads" on public.imphq_leads;
create policy "auth manage imphq_leads" on public.imphq_leads for all to authenticated using (true) with check (true);
alter table public.imphq_wa_lead_memory enable row level security;
drop policy if exists "auth manage imphq_wa_lead_memory" on public.imphq_wa_lead_memory;
create policy "auth manage imphq_wa_lead_memory" on public.imphq_wa_lead_memory for all to authenticated using (true) with check (true);
alter table public.imphq_webhooks enable row level security;
drop policy if exists "auth manage imphq_webhooks" on public.imphq_webhooks;
create policy "auth manage imphq_webhooks" on public.imphq_webhooks for all to authenticated using (true) with check (true);
alter table public.imphq_vendas enable row level security;
drop policy if exists "auth manage imphq_vendas" on public.imphq_vendas;
create policy "auth manage imphq_vendas" on public.imphq_vendas for all to authenticated using (true) with check (true);
alter table public.imphq_referencias enable row level security;
drop policy if exists "auth manage imphq_referencias" on public.imphq_referencias;
create policy "auth manage imphq_referencias" on public.imphq_referencias for all to authenticated using (true) with check (true);
alter table public.imphq_empresa enable row level security;
drop policy if exists "auth manage imphq_empresa" on public.imphq_empresa;
create policy "auth manage imphq_empresa" on public.imphq_empresa for all to authenticated using (true) with check (true);
alter table public.imphq_automacoes enable row level security;
drop policy if exists "auth manage imphq_automacoes" on public.imphq_automacoes;
create policy "auth manage imphq_automacoes" on public.imphq_automacoes for all to authenticated using (true) with check (true);
alter table public.imphq_funis enable row level security;
drop policy if exists "auth manage imphq_funis" on public.imphq_funis;
create policy "auth manage imphq_funis" on public.imphq_funis for all to authenticated using (true) with check (true);
alter table public.imphq_clicks enable row level security;
drop policy if exists "auth manage imphq_clicks" on public.imphq_clicks;
create policy "auth manage imphq_clicks" on public.imphq_clicks for all to authenticated using (true) with check (true);
alter table public.imphq_quick_links enable row level security;
drop policy if exists "auth manage imphq_quick_links" on public.imphq_quick_links;
create policy "auth manage imphq_quick_links" on public.imphq_quick_links for all to authenticated using (true) with check (true);
alter table public.imphq_ig_sequences enable row level security;
drop policy if exists "auth manage imphq_ig_sequences" on public.imphq_ig_sequences;
create policy "auth manage imphq_ig_sequences" on public.imphq_ig_sequences for all to authenticated using (true) with check (true);
alter table public.imphq_sdr_coach_audits enable row level security;
drop policy if exists "auth manage imphq_sdr_coach_audits" on public.imphq_sdr_coach_audits;
create policy "auth manage imphq_sdr_coach_audits" on public.imphq_sdr_coach_audits for all to authenticated using (true) with check (true);
alter table public.imphq_kb enable row level security;
drop policy if exists "auth manage imphq_kb" on public.imphq_kb;
create policy "auth manage imphq_kb" on public.imphq_kb for all to authenticated using (true) with check (true);
alter table public.imphq_kanban enable row level security;
drop policy if exists "auth manage imphq_kanban" on public.imphq_kanban;
create policy "auth manage imphq_kanban" on public.imphq_kanban for all to authenticated using (true) with check (true);
alter table public.imphq_ig_sequence_enrollments enable row level security;
drop policy if exists "auth manage imphq_ig_sequence_enrollments" on public.imphq_ig_sequence_enrollments;
create policy "auth manage imphq_ig_sequence_enrollments" on public.imphq_ig_sequence_enrollments for all to authenticated using (true) with check (true);
drop policy if exists "anon insert imphq_leads" on public.imphq_leads;
create policy "anon insert imphq_leads" on public.imphq_leads for insert to anon with check (true);
drop policy if exists "anon insert imphq_clicks" on public.imphq_clicks;
create policy "anon insert imphq_clicks" on public.imphq_clicks for insert to anon with check (true);

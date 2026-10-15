-- UX1.3: suporte do JP parado (handoff/pending) entra na fila Aprovar.
-- A tabela tinha RLS ligada sem nenhuma política (só a chave de serviço lia). Admins do Império passam a ler e
-- fechar o suporte pela tela; inserir e apagar continua só com a chave de serviço (crm-bridge / jp-support-resolve).
drop policy if exists "Admins read jp conversation state" on public.imphq_jp_conversation_state;
create policy "Admins read jp conversation state" on public.imphq_jp_conversation_state
  for select to authenticated using (public.is_imphq_admin(auth.uid()));

drop policy if exists "Admins update jp conversation state" on public.imphq_jp_conversation_state;
create policy "Admins update jp conversation state" on public.imphq_jp_conversation_state
  for update to authenticated using (public.is_imphq_admin(auth.uid())) with check (public.is_imphq_admin(auth.uid()));

grant select, update on public.imphq_jp_conversation_state to authenticated;

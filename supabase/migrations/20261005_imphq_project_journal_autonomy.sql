-- IA1.1: diário do projeto e níveis de autonomia da IA.
--
-- Diário = imphq_activity_log (já usado na linha do tempo do lead) com projeto, autor e origem.
-- Preenchido por gatilhos: registra o que muda venha da tela, do MCP ou das automações.
-- Autor: cabeçalho x-imperio-actor (o MCP manda "ia (OK de Fulano)"), senão e-mail do login, senão "sistema".
-- Os gatilhos NUNCA bloqueiam a operação: qualquer erro do diário é engolido.
--
-- Autonomia = imphq_ai_policy (já usada pelo imperius-scout) com a coluna autonomy por ação (scope 'mcp').
-- O padrão e o teto de cada ação ficam em _shared/autonomy.ts; o banco só ajusta dentro do teto.

alter table public.imphq_activity_log
  add column if not exists project_id text,
  add column if not exists actor text,
  add column if not exists source text;
-- Entradas da IA e das automações não têm usuário logado.
alter table public.imphq_activity_log alter column user_id drop not null;
create index if not exists imphq_activity_log_project_idx on public.imphq_activity_log (project_id, created_at desc) where project_id is not null;

alter table public.imphq_ai_policy
  add column if not exists autonomy text check (autonomy in ('auto', 'aprovar', 'nunca')),
  add column if not exists descricao text;

-- Quem fez a mudança, a partir do pedido atual.
create or replace function public.imphq_journal_actor()
returns text language plpgsql stable as $$
declare
  v_headers json;
  v_claims json;
begin
  begin v_headers := nullif(current_setting('request.headers', true), '')::json; exception when others then v_headers := null; end;
  begin v_claims := nullif(current_setting('request.jwt.claims', true), '')::json; exception when others then v_claims := null; end;
  return coalesce(nullif(v_headers ->> 'x-imperio-actor', ''), nullif(v_claims ->> 'email', ''), 'sistema');
end;
$$;

create or replace function public.imphq_journal_write(p_project text, p_action text, p_entity_type text, p_entity_id text, p_entity_name text, p_details jsonb, p_source text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into imphq_activity_log (user_id, action, entity_type, entity_id, entity_name, details, project_id, actor, source)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, left(p_entity_name, 200), coalesce(p_details, '{}'::jsonb), p_project, public.imphq_journal_actor(), p_source);
exception when others then
  null; -- o diário nunca derruba a operação
end;
$$;
revoke all on function public.imphq_journal_write(text, text, text, text, text, jsonb, text) from public, anon;

-- Etapas do mapa: status, responsável e prazo.
create or replace function public.imphq_journal_map_node()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_project text;
begin
  begin
    v_project := coalesce(new.linked_project_id,
      (select n.linked_project_id from imphq_company_map_nodes n where n.map_id = new.map_id and n.linked_project_id is not null limit 1));
    if new.step_status is distinct from old.step_status then
      perform public.imphq_journal_write(v_project, 'etapa_status', 'etapa', new.id::text, new.label,
        jsonb_build_object('de', old.step_status, 'para', new.step_status), 'mapa');
    end if;
    if new.owner_member_id is distinct from old.owner_member_id then
      perform public.imphq_journal_write(v_project, 'etapa_responsavel', 'etapa', new.id::text, new.label,
        jsonb_build_object('de', (select name from imphq_team_members where id = old.owner_member_id),
                           'para', (select name from imphq_team_members where id = new.owner_member_id)), 'mapa');
    end if;
    if new.due_date is distinct from old.due_date then
      perform public.imphq_journal_write(v_project, 'etapa_prazo', 'etapa', new.id::text, new.label,
        jsonb_build_object('de', old.due_date, 'para', new.due_date), 'mapa');
    end if;
  exception when others then null;
  end;
  return new;
end;
$$;
drop trigger if exists trg_journal_map_node on public.imphq_company_map_nodes;
create trigger trg_journal_map_node after update of step_status, owner_member_id, due_date on public.imphq_company_map_nodes
  for each row execute function public.imphq_journal_map_node();

-- Ações da IA: decisões e resultados (expiração automática fica de fora para não poluir).
create or replace function public.imphq_journal_ai_action()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    if new.status is distinct from old.status and new.status in ('approved', 'rejected', 'executed', 'failed', 'reverted') then
      perform public.imphq_journal_write(new.projeto_id, 'acao_ia_' || new.status, 'acao_ia', new.id::text, new.title,
        jsonb_build_object('kind', new.kind, 'risco', new.risk_level, 'erro', left(new.error, 300)), 'ia');
    end if;
  exception when others then null;
  end;
  return new;
end;
$$;
drop trigger if exists trg_journal_ai_action on public.imphq_ai_actions;
create trigger trg_journal_ai_action after update of status on public.imphq_ai_actions
  for each row execute function public.imphq_journal_ai_action();

-- Vendas: aprovação (resultado) e recuperação descartada.
create or replace function public.imphq_journal_sale()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    if new.status in ('aprovado', 'recuperacao_descartada') and (tg_op = 'INSERT' or new.status is distinct from old.status) then
      perform public.imphq_journal_write(new.project_id,
        case when new.status = 'aprovado' then 'venda_aprovada' else 'recuperacao_descartada' end,
        'venda', new.id::text, coalesce(new.produto_nome, 'Venda'),
        jsonb_build_object('valor', new.valor, 'utm_source', new.utm_source), 'vendas');
    end if;
  exception when others then null;
  end;
  return new;
end;
$$;
drop trigger if exists trg_journal_sale on public.imphq_vendas;
create trigger trg_journal_sale after insert or update of status on public.imphq_vendas
  for each row execute function public.imphq_journal_sale();

-- Estratégia aplicada no mapa.
create or replace function public.imphq_journal_playbook()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    perform public.imphq_journal_write(new.project_id, 'estrategia_aplicada', 'playbook', new.playbook_id,
      (select nome from imphq_playbooks where id = new.playbook_id),
      jsonb_build_object('etapas', coalesce(array_length(new.node_ids, 1), 0), 'aplicado_por', new.aplicado_por), 'estrategias');
  exception when others then null;
  end;
  return new;
end;
$$;
drop trigger if exists trg_journal_playbook on public.imphq_playbook_applications;
create trigger trg_journal_playbook after insert on public.imphq_playbook_applications
  for each row execute function public.imphq_journal_playbook();

-- Conteúdo aprovado ou reprovado.
create or replace function public.imphq_journal_content()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    if new.status is distinct from old.status and new.status in ('aprovado', 'reprovado') then
      perform public.imphq_journal_write(new.project_id, 'conteudo_' || new.status, 'conteudo', new.id::text, new.title,
        jsonb_build_object('lote', new.batch), 'conteudo');
    end if;
  exception when others then null;
  end;
  return new;
end;
$$;
drop trigger if exists trg_journal_content on public.imphq_content_items;
create trigger trg_journal_content after update of status on public.imphq_content_items
  for each row execute function public.imphq_journal_content();

-- Resposta aprovada no acervo do bot.
create or replace function public.imphq_journal_knowledge()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    if new.aprovada is true and old.aprovada is distinct from true then
      perform public.imphq_journal_write(new.project_id, 'resposta_bot_aprovada', 'acervo', new.id::text, left(new.pergunta, 200),
        jsonb_build_object('resposta', left(new.resposta, 300)), 'acervo');
    end if;
  exception when others then null;
  end;
  return new;
end;
$$;
drop trigger if exists trg_journal_knowledge on public.imphq_wa_knowledge;
create trigger trg_journal_knowledge after update of aprovada on public.imphq_wa_knowledge
  for each row execute function public.imphq_journal_knowledge();

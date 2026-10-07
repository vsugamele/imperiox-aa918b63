-- Custo estimado de IA (OP1.4): quando o provedor não devolve o custo (gateway do Lovable, Google e OpenAI diretos),
-- o banco calcula pelo preço de lista do modelo. Vale para todas as functions sem republicar e para as linhas antigas.
-- Preços conferidos em 07/10/2026 contra o custo real informado pelo OpenRouter (gpt-4o-mini e gemini-3-flash-preview
-- bateram até a 6ª casa). O gateway do Lovable cobra em créditos próprios: para ele o valor é estimativa (tag custo_estimado).

create table if not exists public.imphq_ai_model_prices (
  model text primary key,          -- sem prefixo de provedor: 'gemini-2.5-flash', 'gpt-4o-mini'
  usd_por_m_entrada numeric not null,
  usd_por_m_saida numeric not null default 0,
  conferido_em date not null default current_date,
  fonte text
);
alter table public.imphq_ai_model_prices enable row level security;
drop policy if exists "auth manage ai model prices" on public.imphq_ai_model_prices;
create policy "auth manage ai model prices" on public.imphq_ai_model_prices for all to authenticated using (true) with check (true);

insert into public.imphq_ai_model_prices (model, usd_por_m_entrada, usd_por_m_saida, fonte) values
  ('gpt-4o-mini', 0.15, 0.60, 'preço de lista; conferido contra OpenRouter'),
  ('gpt-4o', 2.50, 10.00, 'preço de lista'),
  ('gpt-5', 1.25, 10.00, 'preço de lista'),
  ('gpt-5-mini', 0.25, 2.00, 'preço de lista'),
  ('gpt-5-nano', 0.05, 0.40, 'preço de lista'),
  ('gemini-3-flash-preview', 0.50, 3.00, 'preço de lista; conferido contra OpenRouter'),
  ('gemini-2.5-pro', 1.25, 10.00, 'preço de lista'),
  ('gemini-2.5-flash', 0.30, 2.50, 'preço de lista'),
  ('gemini-2.5-flash-lite', 0.10, 0.40, 'preço de lista'),
  ('gemini-2.0-flash', 0.10, 0.40, 'preço de lista'),
  ('gemini-embedding-001', 0.15, 0, 'preço de lista'),
  ('text-embedding-3-small', 0.02, 0, 'preço de lista'),
  ('text-embedding-3-large', 0.13, 0, 'preço de lista')
on conflict (model) do update set usd_por_m_entrada = excluded.usd_por_m_entrada, usd_por_m_saida = excluded.usd_por_m_saida, conferido_em = current_date, fonte = excluded.fonte;

/** Custo pelo preço de lista; null sem modelo conhecido ou sem tokens. */
create or replace function public.imphq_estimate_ai_cost(p_model text, p_in integer, p_out integer) returns numeric language sql stable as $$
  select round(((coalesce(p_in, 0) * pr.usd_por_m_entrada + coalesce(p_out, 0) * pr.usd_por_m_saida) / 1e6)::numeric, 8)
    from public.imphq_ai_model_prices pr
   where p_in is not null and pr.model = lower(regexp_replace(coalesce(p_model, ''), '^[a-z-]+/', ''))
$$;

create or replace function public.imphq_ai_usage_fill_cost() returns trigger language plpgsql as $$
declare est numeric;
begin
  if coalesce(new.cost_usd, 0) = 0 then
    est := public.imphq_estimate_ai_cost(new.model, new.prompt_tokens, new.completion_tokens);
    if est is not null and est > 0 then
      new.cost_usd := est;
      new.tag := concat_ws(',', nullif(new.tag, ''), 'custo_estimado');
    end if;
  end if;
  return new;
end $$;

drop trigger if exists imphq_ai_usage_fill_cost on public.imphq_ai_usage;
create trigger imphq_ai_usage_fill_cost before insert on public.imphq_ai_usage for each row execute function public.imphq_ai_usage_fill_cost();

-- Linhas antigas sem custo.
update public.imphq_ai_usage u
   set cost_usd = e.est, tag = concat_ws(',', nullif(u.tag, ''), 'custo_estimado')
  from (select id, public.imphq_estimate_ai_cost(model, prompt_tokens, completion_tokens) est from public.imphq_ai_usage where coalesce(cost_usd, 0) = 0) e
 where u.id = e.id and e.est > 0;

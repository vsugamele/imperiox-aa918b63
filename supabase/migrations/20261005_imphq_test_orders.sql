-- TST1.1: ordem de teste de criativos. Um registro amarra projeto, oferta, página, conta de anúncio,
-- variantes (ângulo + hipótese + arte + texto), ids na Meta, leituras e veredito.
-- O veredito é o da Esteira de Escala (P1, _shared/scale-ladder.ts) e cada avaliação grava uma rodada P1 em
-- imphq_scale_rounds, então o placar de hipóteses acumula entre testes.
-- Quem lança e pausa na Meta é o operador (IA com o MCP da Meta, ou pessoa); o Império guarda o plano e o resultado.

create table if not exists public.imphq_test_orders (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  nome text not null,
  oferta text not null,                         -- produto/oferta testada (ex.: Código dos Cortes Perfeitos R$ 47)
  tipo_pagina text not null default 'pagina_vendas' check (tipo_pagina in ('pagina_vendas', 'vsl', 'pdp', 'captura', 'quiz', 'advertorial', 'checkout', 'whatsapp')),
  pagina_url text not null,
  checkout_url text,
  plataforma text not null default 'meta' check (plataforma in ('meta')),
  ad_account_id text not null,
  page_id text,
  pixel_id text,
  verba_dia_conjunto numeric not null check (verba_dia_conjunto > 0),
  payout numeric not null check (payout > 0),    -- quanto entra por venda (breakeven do CPA)
  cpa_alvo numeric not null check (cpa_alvo > 0),
  ics_por_venda integer not null default 8,
  utm_campaign text not null,
  status text not null default 'rascunho' check (status in ('rascunho', 'pronto', 'no_ar', 'encerrado', 'cancelado')),
  meta_campaign_id text,
  ativado_em timestamptz,                       -- quando foi ao ar (a Esteira julga no fim do dia 2)
  corte_autorizado_por text,                     -- quem autorizou a IA a pausar variantes mortas sozinha
  corte_ate date,                                -- a autorização de corte vale até esta data
  scale_round_id uuid references public.imphq_scale_rounds(id) on delete set null,
  ultima_avaliacao jsonb,
  notas text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  encerrado_at timestamptz
);
create index if not exists imphq_test_orders_project_idx on public.imphq_test_orders (project_id, created_at desc);
create unique index if not exists imphq_test_orders_utm_idx on public.imphq_test_orders (project_id, utm_campaign);

create table if not exists public.imphq_test_variants (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.imphq_test_orders(id) on delete cascade,
  ordem integer not null,
  angulo text not null,
  hipotese text,
  referencia_id text,                            -- imphq_referencias.id (texto) da arte minerada
  creative_asset_id uuid,                        -- imphq_creative_assets (arte gerada pela fábrica)
  image_url text not null,
  texto text,                                    -- primary text
  headline text,
  cta text not null default 'LEARN_MORE',
  utm_content text not null,
  link_url text not null,
  meta_adset_id text,
  meta_creative_id text,
  meta_ad_id text,
  status text not null default 'planejado' check (status in ('planejado', 'no_ar', 'pausado', 'vencedor', 'morto')),
  ultima_leitura jsonb,                          -- { gasto, ic, vendas, vendas_imperio, lido_em }
  veredito text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, ordem)
);
create index if not exists imphq_test_variants_order_idx on public.imphq_test_variants (order_id, ordem);

alter table public.imphq_test_orders enable row level security;
alter table public.imphq_test_variants enable row level security;
drop policy if exists "auth manage test orders" on public.imphq_test_orders;
create policy "auth manage test orders" on public.imphq_test_orders for all to authenticated using (true) with check (true);
drop policy if exists "auth manage test variants" on public.imphq_test_variants;
create policy "auth manage test variants" on public.imphq_test_variants for all to authenticated using (true) with check (true);

-- Diário: mudança de status do teste e de cada variante (mesmo padrão da IA1.1, nunca bloqueia).
create or replace function public.imphq_journal_test_order()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    if tg_op = 'INSERT' or new.status is distinct from old.status then
      perform public.imphq_journal_write(new.project_id, 'teste_' || new.status, 'teste', new.id::text, new.nome,
        jsonb_build_object('verba_dia_conjunto', new.verba_dia_conjunto, 'campanha', new.meta_campaign_id), 'testes');
    end if;
  exception when others then null;
  end;
  return new;
end;
$$;
drop trigger if exists trg_journal_test_order on public.imphq_test_orders;
create trigger trg_journal_test_order after insert or update of status on public.imphq_test_orders
  for each row execute function public.imphq_journal_test_order();

create or replace function public.imphq_journal_test_variant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    if new.status is distinct from old.status and new.status in ('pausado', 'vencedor', 'morto') then
      perform public.imphq_journal_write((select project_id from imphq_test_orders where id = new.order_id),
        'teste_variante_' || new.status, 'teste_variante', new.id::text, new.angulo,
        jsonb_build_object('veredito', new.veredito, 'leitura', new.ultima_leitura), 'testes');
    end if;
  exception when others then null;
  end;
  return new;
end;
$$;
drop trigger if exists trg_journal_test_variant on public.imphq_test_variants;
create trigger trg_journal_test_variant after update of status on public.imphq_test_variants
  for each row execute function public.imphq_journal_test_variant();

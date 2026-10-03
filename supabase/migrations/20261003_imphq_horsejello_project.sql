-- HorseJello: oferta DTC da H&W que chegava sem projeto (decisão do Vinicius em 03/10/2026: criar projeto).
-- Evidência: 6 vendas H&W sem projeto (DTCHJ02FE 1+1 USD 89,50; DTCHJ06FE 3+3 USD 119,94; Express Shipping e Wellness Club do mesmo pedido)
-- e 169 eventos do domínio horse-jello.healiks.com sem projeto em 90 dias.
-- Desfazer:
--   update imphq_events set project_id = null, metadata = metadata - 'project_from_domain' where project_id = 'horsejello' and metadata ? 'project_from_domain';
--   update imphq_vendas set project_id = null where project_id = 'horsejello' and plataforma = 'H&W';
--   delete from imphq_project_domains where host = 'horse-jello.healiks.com';
--   update imphq_projects set active = false, is_archived = true where id = 'horsejello';

insert into public.imphq_projects (id, name, category, color, icon, description, active, is_archived, data)
values (
  'horsejello', 'HorseJello', 'DTC Nutra', '#f59e0b', 'Flame',
  'Oferta DTC da H&W (HorseJello). Criado a partir das vendas e do domínio que chegavam sem projeto.',
  true, false,
  jsonb_build_object('produtos', jsonb_build_array(
    jsonb_build_object('nome', 'HorseJello DTC 1 + 1 Bottle', 'preco', 89.50, 'moeda', 'USD', 'sku_hw', 'DTCHJ02FE'),
    jsonb_build_object('nome', 'HorseJello DTC 3 + 3 Bottles', 'preco', 119.94, 'moeda', 'USD', 'sku_hw', 'DTCHJ06FE')
  ))
)
on conflict (id) do nothing;

insert into public.imphq_project_domains (host, project_id, fonte)
values ('horse-jello.healiks.com', 'horsejello', 'manual')
on conflict (host) do nothing;

-- Vendas H&W sem projeto: todas são de pedidos HorseJello (os itens extras vêm no mesmo pedido).
update public.imphq_vendas
   set project_id = 'horsejello'
 where plataforma = 'H&W' and project_id is null;

-- Retroativo de 90 dias dos eventos do domínio, com a mesma marca do LIVE1.3.
update public.imphq_events
   set project_id = 'horsejello',
       metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('project_from_domain', true)
 where project_id is null
   and created_at > now() - interval '90 days'
   and public.imphq_resolve_project(page_url) = 'horsejello';

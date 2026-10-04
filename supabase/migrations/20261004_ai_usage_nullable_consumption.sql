-- OP1.5: ausência de consumo/custo não significa zero. Preserva todas as linhas existentes.
alter table public.imphq_ai_usage
  alter column model drop not null,
  alter column prompt_tokens drop not null,
  alter column prompt_tokens drop default,
  alter column completion_tokens drop not null,
  alter column completion_tokens drop default,
  alter column total_tokens drop not null,
  alter column total_tokens drop default,
  alter column cost_usd drop not null,
  alter column cost_usd drop default;

-- Reversão estrutural segura somente após verificar que não há linhas com consumo desconhecido.
-- Nunca converter null em zero para satisfazer o schema antigo; manter a migração nesse caso.

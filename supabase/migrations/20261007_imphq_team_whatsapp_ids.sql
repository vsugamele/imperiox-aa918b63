-- Operador no grupo (OPR1.2): quem respondeu "ok 1" no Imperio X é reconhecido pelo identificador do WhatsApp
-- (número e/ou @lid que a Evolution manda em key.participant / participantAlt). Só dígitos ou o id completo.
alter table public.imphq_team_members add column if not exists whatsapp_ids text[] not null default '{}';
create index if not exists imphq_team_members_whatsapp_ids_idx on public.imphq_team_members using gin (whatsapp_ids);

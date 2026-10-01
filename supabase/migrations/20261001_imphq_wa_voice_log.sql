-- Registro de cada geração, reaproveitamento, envio e falha de voz (TTS) e transcrição (STT) do WhatsApp.
-- Base das travas do wa-ai-reply: saldo esgotado, 3 falhas seguidas, limite por conversa e cache de áudio.
create table if not exists public.imphq_wa_voice_log (
  id uuid primary key default gen_random_uuid(),
  project_id text,
  conversation_id uuid,
  kind text not null check (kind in ('tts', 'stt')),
  status text not null check (status in ('generated', 'reused', 'sent', 'send_failed', 'tts_failed', 'quota_exceeded', 'skipped', 'transcribed', 'stt_failed')),
  provider text,
  voice_id text,
  text_hash text,
  chars integer,
  reason text,
  audio_url text,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists imphq_wa_voice_log_project_idx on public.imphq_wa_voice_log (project_id, created_at desc);
create index if not exists imphq_wa_voice_log_hash_idx on public.imphq_wa_voice_log (text_hash) where text_hash is not null;
alter table public.imphq_wa_voice_log enable row level security;
drop policy if exists "auth read voice log" on public.imphq_wa_voice_log;
create policy "auth read voice log" on public.imphq_wa_voice_log for select to authenticated using (true);
comment on table public.imphq_wa_voice_log is 'Gravado só pelas edge functions (service role). Leitura para o painel.';

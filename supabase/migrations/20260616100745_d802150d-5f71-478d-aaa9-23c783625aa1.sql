ALTER TABLE public.imphq_daily_routines
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS recurrence text NOT NULL DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS weekdays integer[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS time_of_day time;
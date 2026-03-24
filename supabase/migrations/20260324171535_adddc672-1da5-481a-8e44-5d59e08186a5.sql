-- Daily routines table
CREATE TABLE imphq_daily_routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'team',
  member_id UUID REFERENCES imphq_team_members(id) ON DELETE SET NULL,
  project_id TEXT REFERENCES imphq_projects(id) ON DELETE SET NULL,
  icon TEXT DEFAULT '✅',
  position INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Routine checks (completion log per day)
CREATE TABLE imphq_routine_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID REFERENCES imphq_daily_routines(id) ON DELETE CASCADE NOT NULL,
  check_date DATE NOT NULL DEFAULT CURRENT_DATE,
  checked_by UUID REFERENCES auth.users(id),
  checked_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(routine_id, check_date)
);

-- RLS
ALTER TABLE imphq_daily_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE imphq_routine_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own routines" ON imphq_daily_routines
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Team routines visible to all authenticated" ON imphq_daily_routines
  FOR SELECT TO authenticated USING (category = 'team');

CREATE POLICY "Users can manage routine checks" ON imphq_routine_checks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
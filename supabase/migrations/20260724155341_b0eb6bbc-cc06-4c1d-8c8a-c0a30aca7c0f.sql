CREATE TABLE public.imphq_kanban_boards (
  id text PRIMARY KEY,
  label text NOT NULL,
  emoji text,
  color text,
  position integer NOT NULL DEFAULT 0,
  is_pinned boolean NOT NULL DEFAULT false,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imphq_kanban_boards TO authenticated;
GRANT ALL ON public.imphq_kanban_boards TO service_role;

ALTER TABLE public.imphq_kanban_boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read boards" ON public.imphq_kanban_boards FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert boards" ON public.imphq_kanban_boards FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update boards" ON public.imphq_kanban_boards FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth delete boards" ON public.imphq_kanban_boards FOR DELETE TO authenticated USING (true);

INSERT INTO public.imphq_kanban_boards (id, label, emoji, color, position, is_pinned) VALUES
  ('geral',     'Geral',     '📋', '#71717a', 0, true),
  ('agentes',   'Agentes',   '🤖', '#8b5cf6', 1, false),
  ('humanas',   'Humanas',   '👥', '#3b82f6', 2, false),
  ('criativos', 'Criativos', '🎨', '#ec4899', 3, false),
  ('campanhas', 'Campanhas', '🚀', '#f0b100', 4, false),
  ('experts',   'Experts',   '⭐', '#22c55e', 5, false)
ON CONFLICT (id) DO NOTHING;
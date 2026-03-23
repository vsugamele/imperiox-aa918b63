
-- Checklists (subtarefas) dentro de cards
CREATE TABLE public.imphq_card_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.imphq_kanban_cards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT false,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.imphq_card_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage checklists"
  ON public.imphq_card_checklists
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Comentários / anotações nos cards
CREATE TABLE public.imphq_card_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.imphq_kanban_cards(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL DEFAULT 'Anônimo',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.imphq_card_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage comments"
  ON public.imphq_card_comments
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

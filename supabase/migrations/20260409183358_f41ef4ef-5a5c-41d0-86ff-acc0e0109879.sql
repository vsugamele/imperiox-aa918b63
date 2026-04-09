
-- Criar tabela de roles
CREATE TABLE public.imphq_user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_imphq_role(_user_id UUID, _role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.imphq_user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Helper: check if user is imphq admin
CREATE OR REPLACE FUNCTION public.is_imphq_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.imphq_user_roles
    WHERE user_id = _user_id AND role = 'admin'
  );
$$;

-- Enable RLS
ALTER TABLE public.imphq_user_roles ENABLE ROW LEVEL SECURITY;

-- Only admins can read roles
CREATE POLICY "Admins can view all roles"
ON public.imphq_user_roles FOR SELECT
TO authenticated
USING (public.is_imphq_admin(auth.uid()));

-- Only admins can insert roles
CREATE POLICY "Admins can insert roles"
ON public.imphq_user_roles FOR INSERT
TO authenticated
WITH CHECK (public.is_imphq_admin(auth.uid()));

-- Only admins can update roles
CREATE POLICY "Admins can update roles"
ON public.imphq_user_roles FOR UPDATE
TO authenticated
USING (public.is_imphq_admin(auth.uid()));

-- Only admins can delete roles
CREATE POLICY "Admins can delete roles"
ON public.imphq_user_roles FOR DELETE
TO authenticated
USING (public.is_imphq_admin(auth.uid()));

-- Seed existing admins
INSERT INTO public.imphq_user_roles (user_id, role) VALUES
  ('53441a4b-bc09-4c6e-b84d-c76ba5ee530e', 'admin'),
  ('bded734b-15c0-4db3-851b-5ad763ee33c8', 'admin'),
  ('9ae6d28f-8698-4128-915e-af8e08b6d388', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

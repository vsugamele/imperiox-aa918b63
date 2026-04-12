-- Add status column to imphq_user_roles
ALTER TABLE public.imphq_user_roles 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';

-- Update existing rows to approved
UPDATE public.imphq_user_roles SET status = 'approved' WHERE status = 'approved';

-- Create function to auto-insert pending role on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _team_member RECORD;
BEGIN
  -- Check if user already has a role (e.g. created by admin)
  IF EXISTS (SELECT 1 FROM public.imphq_user_roles WHERE user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Check if email matches a team member
  SELECT * INTO _team_member 
  FROM public.imphq_team_members 
  WHERE email = NEW.email 
  LIMIT 1;

  IF FOUND THEN
    -- Link team member and auto-approve
    UPDATE public.imphq_team_members SET user_id = NEW.id WHERE id = _team_member.id;
    INSERT INTO public.imphq_user_roles (user_id, role, status)
    VALUES (NEW.id, LOWER(COALESCE(_team_member.role, 'viewer')), 'approved');
  ELSE
    -- New unknown user → pending approval
    INSERT INTO public.imphq_user_roles (user_id, role, status)
    VALUES (NEW.id, 'viewer', 'pending');
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on auth.users (safe: uses AFTER INSERT)
DROP TRIGGER IF EXISTS on_auth_user_created_imphq ON auth.users;
CREATE TRIGGER on_auth_user_created_imphq
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_signup();
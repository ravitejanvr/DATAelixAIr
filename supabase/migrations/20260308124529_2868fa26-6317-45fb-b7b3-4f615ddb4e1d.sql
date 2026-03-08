
-- 1. Create clinic_members table for multi-clinic user membership
CREATE TABLE public.clinic_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'staff',
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, clinic_id)
);

-- Enable RLS
ALTER TABLE public.clinic_members ENABLE ROW LEVEL SECURITY;

-- Users can see their own memberships
CREATE POLICY "Users view own memberships"
  ON public.clinic_members FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Clinic admins can manage members of their clinic
CREATE POLICY "Clinic admins manage members"
  ON public.clinic_members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clinic_members cm
      WHERE cm.user_id = auth.uid() AND cm.clinic_id = clinic_members.clinic_id AND cm.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clinic_members cm
      WHERE cm.user_id = auth.uid() AND cm.clinic_id = clinic_members.clinic_id AND cm.role = 'admin'
    )
  );

-- Platform admins can manage all
CREATE POLICY "Platform admins manage all members"
  ON public.clinic_members FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

-- 2. Add clinic_id to audit_logs (nullable for platform-level events)
ALTER TABLE public.audit_logs ADD COLUMN clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL;

-- 3. Create a security definer function for clinic membership checks (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_clinic_member(_user_id uuid, _clinic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clinic_members
    WHERE user_id = _user_id AND clinic_id = _clinic_id
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND clinic_id = _clinic_id
  );
$$;

-- 4. Seed clinic_members from existing profiles.clinic_id data
INSERT INTO public.clinic_members (user_id, clinic_id, role, is_primary)
SELECT p.user_id, p.clinic_id, COALESCE(ur.role::text, 'staff'), true
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id
WHERE p.clinic_id IS NOT NULL
ON CONFLICT (user_id, clinic_id) DO NOTHING;

-- 5. Add updated_at trigger for clinic_members
CREATE TRIGGER update_clinic_members_updated_at
  BEFORE UPDATE ON public.clinic_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

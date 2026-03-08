
-- Add account_status to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'pending';

-- Update the handle_new_user trigger to set account_status = 'pending'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, role_subtype, account_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role_subtype', ''),
    'pending'
  );
  RETURN NEW;
END;
$$;

-- Allow platform_admins to read all profiles for approval
CREATE POLICY "Platform admins view all profiles"
ON public.profiles FOR SELECT
USING (has_role(auth.uid(), 'platform_admin'::app_role));

-- Allow platform_admins to update profiles (approve/reject, assign clinic)
CREATE POLICY "Platform admins update profiles"
ON public.profiles FOR UPDATE
USING (has_role(auth.uid(), 'platform_admin'::app_role));

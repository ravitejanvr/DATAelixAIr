
-- Add role_subtype column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role_subtype text DEFAULT '';

-- Update handle_new_user_role trigger to default to 'patient' instead of 'doctor'
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'patient'));
  RETURN NEW;
END;
$function$;

-- Update handle_new_user to also store role_subtype
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, role_subtype)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role_subtype', '')
  );
  RETURN NEW;
END;
$function$;

-- Clinical staff can view patients (same clinic scope - to be refined later with care_team table)
CREATE POLICY "Clinical staff see assigned patients"
ON public.patients
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'nurse') OR
  public.has_role(auth.uid(), 'allied_health') OR
  public.has_role(auth.uid(), 'pharmacist') OR
  public.has_role(auth.uid(), 'lab') OR
  public.has_role(auth.uid(), 'care_coordinator')
);

-- Clinical staff can view consultations
CREATE POLICY "Clinical staff see consultations"
ON public.consultations
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'nurse') OR
  public.has_role(auth.uid(), 'allied_health') OR
  public.has_role(auth.uid(), 'pharmacist') OR
  public.has_role(auth.uid(), 'lab') OR
  public.has_role(auth.uid(), 'care_coordinator')
);

-- Pharmacists can view prescriptions
CREATE POLICY "Pharmacists see prescriptions"
ON public.prescriptions
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'pharmacist')
);

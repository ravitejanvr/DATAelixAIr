
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('doctor', 'patient');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS: users can see their own roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- RLS: users can insert their own role (on signup)
CREATE POLICY "Users can insert own role"
  ON public.user_roles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add patient_user_id to patients table so patients can link to their auth account
ALTER TABLE public.patients ADD COLUMN patient_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Allow patients to see their own records
CREATE POLICY "Patients see own records"
  ON public.patients FOR SELECT
  USING (auth.uid() = patient_user_id);

-- Allow patients to see their own consultations
CREATE POLICY "Patients see own consultations"
  ON public.consultations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.patients
      WHERE patients.id = consultations.patient_id
      AND patients.patient_user_id = auth.uid()
    )
  );

-- Allow patients to see their own prescriptions
CREATE POLICY "Patients see own prescriptions"
  ON public.prescriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.patients
      WHERE patients.id = prescriptions.patient_id
      AND patients.patient_user_id = auth.uid()
    )
  );

-- Auto-assign role on signup via trigger
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'doctor'));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

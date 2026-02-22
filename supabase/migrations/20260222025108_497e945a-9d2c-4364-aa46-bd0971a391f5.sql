
-- Profiles table for doctor information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  specialization TEXT DEFAULT '',
  license_number TEXT DEFAULT '',
  clinic_name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Patients table
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age INTEGER,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  abha_id TEXT DEFAULT '',
  aadhaar_hash TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  medical_history JSONB DEFAULT '[]'::jsonb,
  allergies TEXT[] DEFAULT '{}',
  current_medications TEXT[] DEFAULT '{}',
  language_preference TEXT DEFAULT 'english',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctors see own patients" ON public.patients FOR SELECT USING (auth.uid() = doctor_id);
CREATE POLICY "Doctors create patients" ON public.patients FOR INSERT WITH CHECK (auth.uid() = doctor_id);
CREATE POLICY "Doctors update own patients" ON public.patients FOR UPDATE USING (auth.uid() = doctor_id);
CREATE POLICY "Doctors delete own patients" ON public.patients FOR DELETE USING (auth.uid() = doctor_id);

-- Consultations table
CREATE TABLE public.consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chief_complaint TEXT DEFAULT '',
  soap_subjective TEXT DEFAULT '',
  soap_objective TEXT DEFAULT '',
  soap_assessment TEXT DEFAULT '',
  soap_plan TEXT DEFAULT '',
  risk_assessment JSONB DEFAULT '{}'::jsonb,
  drug_recommendations JSONB DEFAULT '[]'::jsonb,
  drug_interactions JSONB DEFAULT '[]'::jsonb,
  pubmed_citations JSONB DEFAULT '[]'::jsonb,
  tests_ordered TEXT[] DEFAULT '{}',
  follow_up_date DATE,
  billing_amount NUMERIC(10,2) DEFAULT 0,
  billing_details JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'shared')),
  raw_transcript TEXT DEFAULT '',
  ai_summary TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

-- Security definer function to check patient ownership
CREATE OR REPLACE FUNCTION public.is_doctor_for_patient(p_patient_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.patients
    WHERE id = p_patient_id AND doctor_id = auth.uid()
  );
$$;

CREATE POLICY "Doctors see own consultations" ON public.consultations FOR SELECT USING (auth.uid() = doctor_id);
CREATE POLICY "Doctors create consultations" ON public.consultations FOR INSERT WITH CHECK (auth.uid() = doctor_id AND public.is_doctor_for_patient(patient_id));
CREATE POLICY "Doctors update own consultations" ON public.consultations FOR UPDATE USING (auth.uid() = doctor_id);
CREATE POLICY "Doctors delete own consultations" ON public.consultations FOR DELETE USING (auth.uid() = doctor_id);

-- Prescriptions table
CREATE TABLE public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID NOT NULL REFERENCES public.consultations(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  drug_name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT DEFAULT '',
  duration TEXT DEFAULT '',
  route TEXT DEFAULT 'oral',
  instructions TEXT DEFAULT '',
  interactions JSONB DEFAULT '[]'::jsonb,
  severity TEXT DEFAULT 'safe' CHECK (severity IN ('safe', 'caution', 'warning', 'danger')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctors see own prescriptions" ON public.prescriptions FOR SELECT USING (auth.uid() = doctor_id);
CREATE POLICY "Doctors create prescriptions" ON public.prescriptions FOR INSERT WITH CHECK (auth.uid() = doctor_id AND public.is_doctor_for_patient(patient_id));
CREATE POLICY "Doctors update own prescriptions" ON public.prescriptions FOR UPDATE USING (auth.uid() = doctor_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_consultations_updated_at BEFORE UPDATE ON public.consultations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

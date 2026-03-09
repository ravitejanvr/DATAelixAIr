
-- LOW FIX 1: Remove duplicate patient SELECT policies
-- "Patients see own records" and "Patients read own record via user id" are duplicates
DROP POLICY IF EXISTS "Patients see own records" ON public.patients;

-- LOW FIX 2: Scope doctor_favorites by clinic - already has clinic_id column, just update policy
DROP POLICY IF EXISTS "Doctors manage own favorites" ON public.doctor_favorites;
CREATE POLICY "Doctors manage own favorites"
ON public.doctor_favorites FOR ALL TO authenticated
USING (auth.uid() = doctor_id AND (clinic_id IS NULL OR is_clinic_member(auth.uid(), clinic_id)))
WITH CHECK (auth.uid() = doctor_id AND (clinic_id IS NULL OR is_clinic_member(auth.uid(), clinic_id)));

-- LOW FIX 3: Rate limit pilot_requests (add created_ip and throttle via trigger)
CREATE OR REPLACE FUNCTION public.throttle_pilot_requests()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (SELECT count(*) FROM public.pilot_requests
      WHERE contact_email = NEW.contact_email
      AND created_at > now() - interval '1 hour') >= 3 THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait before submitting again.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_throttle_pilot_requests
  BEFORE INSERT ON public.pilot_requests
  FOR EACH ROW EXECUTE FUNCTION public.throttle_pilot_requests();

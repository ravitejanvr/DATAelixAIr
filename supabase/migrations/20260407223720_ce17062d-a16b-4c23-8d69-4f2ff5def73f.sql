
-- ============================================================
-- ISSUE 1 & 2: Replace TO public with TO authenticated
-- on clinical/operational/profile tables
-- ============================================================

-- clinic_settings
DROP POLICY IF EXISTS "Clinic staff view settings" ON public.clinic_settings;
CREATE POLICY "Clinic staff view settings" ON public.clinic_settings FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = clinic_settings.clinic_id));

DROP POLICY IF EXISTS "Clinic admins manage settings" ON public.clinic_settings;
CREATE POLICY "Clinic admins manage settings" ON public.clinic_settings FOR ALL TO authenticated
USING ((EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = clinic_settings.clinic_id)) AND has_role(auth.uid(), 'clinic_admin'::app_role))
WITH CHECK ((EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = clinic_settings.clinic_id)) AND has_role(auth.uid(), 'clinic_admin'::app_role));

DROP POLICY IF EXISTS "Platform admins manage all settings" ON public.clinic_settings;
CREATE POLICY "Platform admins manage all settings" ON public.clinic_settings FOR ALL TO authenticated
USING (has_role(auth.uid(), 'platform_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

-- clinical_alerts
DROP POLICY IF EXISTS "Clinic staff see clinic alerts" ON public.clinical_alerts;
CREATE POLICY "Clinic staff see clinic alerts" ON public.clinical_alerts FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = clinical_alerts.clinic_id));

DROP POLICY IF EXISTS "Doctors see own clinical alerts" ON public.clinical_alerts;
CREATE POLICY "Doctors see own clinical alerts" ON public.clinical_alerts FOR SELECT TO authenticated
USING (auth.uid() = doctor_id);

DROP POLICY IF EXISTS "Doctors acknowledge own alerts" ON public.clinical_alerts;
CREATE POLICY "Doctors acknowledge own alerts" ON public.clinical_alerts FOR UPDATE TO authenticated
USING (auth.uid() = doctor_id);

-- diagnostic_flags
DROP POLICY IF EXISTS "Doctors see own diagnostic flags" ON public.diagnostic_flags;
CREATE POLICY "Doctors see own diagnostic flags" ON public.diagnostic_flags FOR SELECT TO authenticated
USING (auth.uid() = doctor_id);

DROP POLICY IF EXISTS "Doctors acknowledge diagnostic flags" ON public.diagnostic_flags;
CREATE POLICY "Doctors acknowledge diagnostic flags" ON public.diagnostic_flags FOR UPDATE TO authenticated
USING (auth.uid() = doctor_id);

DROP POLICY IF EXISTS "Clinic staff see clinic diagnostic flags" ON public.diagnostic_flags;
CREATE POLICY "Clinic staff see clinic diagnostic flags" ON public.diagnostic_flags FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = diagnostic_flags.clinic_id));

-- medication_alerts
DROP POLICY IF EXISTS "Doctors see own medication alerts" ON public.medication_alerts;
CREATE POLICY "Doctors see own medication alerts" ON public.medication_alerts FOR SELECT TO authenticated
USING (auth.uid() = doctor_id);

DROP POLICY IF EXISTS "Clinic staff see clinic medication alerts" ON public.medication_alerts;
CREATE POLICY "Clinic staff see clinic medication alerts" ON public.medication_alerts FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = medication_alerts.clinic_id));

DROP POLICY IF EXISTS "Doctors acknowledge medication alerts" ON public.medication_alerts;
CREATE POLICY "Doctors acknowledge medication alerts" ON public.medication_alerts FOR UPDATE TO authenticated
USING (auth.uid() = doctor_id);

-- outcome_tracking
DROP POLICY IF EXISTS "Doctors see own outcomes" ON public.outcome_tracking;
CREATE POLICY "Doctors see own outcomes" ON public.outcome_tracking FOR SELECT TO authenticated
USING (auth.uid() = doctor_id);

DROP POLICY IF EXISTS "Doctors update own outcomes" ON public.outcome_tracking;
CREATE POLICY "Doctors update own outcomes" ON public.outcome_tracking FOR UPDATE TO authenticated
USING (auth.uid() = doctor_id);

DROP POLICY IF EXISTS "Clinic staff see clinic outcomes" ON public.outcome_tracking;
CREATE POLICY "Clinic staff see clinic outcomes" ON public.outcome_tracking FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = outcome_tracking.clinic_id));

-- population_signals
DROP POLICY IF EXISTS "Clinic staff see clinic signals" ON public.population_signals;
CREATE POLICY "Clinic staff see clinic signals" ON public.population_signals FOR SELECT TO authenticated
USING ((clinic_id IS NULL) OR (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = population_signals.clinic_id)));

DROP POLICY IF EXISTS "Platform admins see all signals" ON public.population_signals;
CREATE POLICY "Platform admins see all signals" ON public.population_signals FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'platform_admin'::app_role));

DROP POLICY IF EXISTS "Platform admins manage signals" ON public.population_signals;
CREATE POLICY "Platform admins manage signals" ON public.population_signals FOR ALL TO authenticated
USING (has_role(auth.uid(), 'platform_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

-- lab_catalog
DROP POLICY IF EXISTS "Clinic staff view lab catalog" ON public.lab_catalog;
CREATE POLICY "Clinic staff view lab catalog" ON public.lab_catalog FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = lab_catalog.clinic_id));

DROP POLICY IF EXISTS "Clinic admins manage lab catalog" ON public.lab_catalog;
CREATE POLICY "Clinic admins manage lab catalog" ON public.lab_catalog FOR ALL TO authenticated
USING ((EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = lab_catalog.clinic_id)) AND has_role(auth.uid(), 'clinic_admin'::app_role))
WITH CHECK ((EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = lab_catalog.clinic_id)) AND has_role(auth.uid(), 'clinic_admin'::app_role));

DROP POLICY IF EXISTS "Platform admins manage all lab catalogs" ON public.lab_catalog;
CREATE POLICY "Platform admins manage all lab catalogs" ON public.lab_catalog FOR ALL TO authenticated
USING (has_role(auth.uid(), 'platform_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

-- lab_partner_orders
DROP POLICY IF EXISTS "Clinic staff manage lab partner orders" ON public.lab_partner_orders;
CREATE POLICY "Clinic staff manage lab partner orders" ON public.lab_partner_orders FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = lab_partner_orders.clinic_id))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = lab_partner_orders.clinic_id));

-- pharmacy_orders
DROP POLICY IF EXISTS "Clinic staff manage pharmacy orders" ON public.pharmacy_orders;
CREATE POLICY "Clinic staff manage pharmacy orders" ON public.pharmacy_orders FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = pharmacy_orders.clinic_id))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = pharmacy_orders.clinic_id));

-- prescriptions (patient self-view)
DROP POLICY IF EXISTS "Patients see own prescriptions" ON public.prescriptions;
CREATE POLICY "Patients see own prescriptions" ON public.prescriptions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM patients WHERE patients.id = prescriptions.patient_id AND patients.patient_user_id = auth.uid()));

-- risk_patterns
DROP POLICY IF EXISTS "Anyone can read risk patterns" ON public.risk_patterns;
CREATE POLICY "Authenticated read active risk patterns" ON public.risk_patterns FOR SELECT TO authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "Platform admins manage risk patterns" ON public.risk_patterns;
CREATE POLICY "Platform admins manage risk patterns" ON public.risk_patterns FOR ALL TO authenticated
USING (has_role(auth.uid(), 'platform_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

-- profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Platform admins view all profiles" ON public.profiles;
CREATE POLICY "Platform admins view all profiles" ON public.profiles FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'platform_admin'::app_role));

DROP POLICY IF EXISTS "Platform admins update profiles" ON public.profiles;
CREATE POLICY "Platform admins update profiles" ON public.profiles FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'platform_admin'::app_role));


-- Add workflow_mode to clinic_workflow_config
ALTER TABLE public.clinic_workflow_config
ADD COLUMN IF NOT EXISTS workflow_mode text NOT NULL DEFAULT 'doctor_only';

-- Add preferred pharmacy and lab to clinic_settings
ALTER TABLE public.clinic_settings
ADD COLUMN IF NOT EXISTS preferred_pharmacy_name text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS preferred_pharmacy_phone text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS preferred_lab_name text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS preferred_lab_phone text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS notification_provider text DEFAULT 'msg91',
ADD COLUMN IF NOT EXISTS sms_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS notification_api_key text DEFAULT NULL;

-- Add doctor_signature_text to profiles (for text-based digital signatures)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS signature_text text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS designation text DEFAULT NULL;

-- Create notification_templates table
CREATE TABLE public.notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  trigger_event text NOT NULL,
  template_name text NOT NULL,
  message_template text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(clinic_id, trigger_event)
);

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic staff view notification templates"
  ON public.notification_templates FOR SELECT TO authenticated
  USING (clinic_id IS NULL OR EXISTS (
    SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = notification_templates.clinic_id
  ));

CREATE POLICY "Clinic admins manage notification templates"
  ON public.notification_templates FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'clinic_admin'::app_role) AND
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = notification_templates.clinic_id)
  )
  WITH CHECK (
    has_role(auth.uid(), 'clinic_admin'::app_role) AND
    EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = notification_templates.clinic_id)
  );

CREATE POLICY "Platform admins manage all notification templates"
  ON public.notification_templates FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

-- Create notification_logs table
CREATE TABLE public.notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  visit_id uuid REFERENCES public.patient_visits(id),
  clinic_id uuid REFERENCES public.clinics(id),
  message_type text NOT NULL,
  trigger_event text NOT NULL,
  message_content text,
  recipient_phone text,
  provider text DEFAULT 'msg91',
  delivery_status text DEFAULT 'pending',
  provider_response jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic staff view notification logs"
  ON public.notification_logs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.clinic_id = notification_logs.clinic_id
  ));

CREATE POLICY "Authenticated insert notification logs"
  ON public.notification_logs FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Platform admins view all notification logs"
  ON public.notification_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'platform_admin'::app_role));

-- Add consultation status for frontdesk workflow
-- consultations.status can now be: draft, awaiting_frontdesk, report_generated, complete

-- Seed default notification templates (global, clinic_id = NULL)
INSERT INTO public.notification_templates (clinic_id, trigger_event, template_name, message_template) VALUES
(NULL, 'visit_registered', 'Registration Confirmation', 'Hello {patient_name}, your visit at {clinic_name} is registered. Token: {token}. Track your visit: {visit_link}'),
(NULL, 'triage_complete', 'Triage Complete', 'Hi {patient_name}, your vitals have been recorded at {clinic_name}. You will be called by the doctor shortly.'),
(NULL, 'consultation_started', 'Consultation Started', 'Hi {patient_name}, your consultation with Dr. {doctor_name} has started at {clinic_name}.'),
(NULL, 'consultation_complete', 'Consultation Complete', 'Hi {patient_name}, your consultation is complete. Please proceed to the front desk for billing at {clinic_name}.'),
(NULL, 'report_ready', 'Report Ready', 'Hi {patient_name}, your consultation report and prescription are ready. Download here: {report_link}'),
(NULL, 'payment_pending', 'Payment Pending', 'Hi {patient_name}, your invoice amount is ₹{amount}. Please complete payment at {clinic_name}.'),
(NULL, 'payment_completed', 'Payment Completed', 'Payment of ₹{amount} received. Thank you for visiting {clinic_name}. Report: {report_link}'),
(NULL, 'lab_ordered', 'Lab Ordered', 'Hi {patient_name}, lab tests have been ordered for you. Our lab partner will contact you shortly.'),
(NULL, 'prescription_sent', 'Prescription Sent', 'Hi {patient_name}, your prescription has been sent to {pharmacy_name}. Please collect your medicines.')
ON CONFLICT DO NOTHING;

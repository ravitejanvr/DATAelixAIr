
-- Add verification and trust columns to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS trust_score integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_domain_type text DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS clinic_phone text;

-- Create risk_flags table
CREATE TABLE public.risk_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  flag_type text NOT NULL DEFAULT 'suspicious_activity',
  severity text NOT NULL DEFAULT 'warning',
  description text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.risk_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins manage risk flags" ON public.risk_flags
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'platform_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "Authenticated insert risk flags" ON public.risk_flags
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Performance indexes
CREATE INDEX idx_risk_flags_user_id ON public.risk_flags(user_id);
CREATE INDEX idx_risk_flags_unresolved ON public.risk_flags(resolved) WHERE NOT resolved;
CREATE INDEX idx_profiles_trust_score ON public.profiles(trust_score);
CREATE INDEX idx_profiles_verification ON public.profiles(verification_status);

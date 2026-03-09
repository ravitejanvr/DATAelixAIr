
-- Create report_tokens table for secure report delivery
CREATE TABLE public.report_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  consultation_id uuid NOT NULL REFERENCES public.consultations(id) ON DELETE CASCADE,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

-- Enable RLS
ALTER TABLE public.report_tokens ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert tokens
CREATE POLICY "Doctors create report tokens"
  ON public.report_tokens FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Allow anyone to read tokens (for token-based access validation)
CREATE POLICY "Anyone can validate tokens"
  ON public.report_tokens FOR SELECT TO anon, authenticated
  USING (true);

-- Index for fast token lookups
CREATE INDEX idx_report_tokens_token ON public.report_tokens(token);
CREATE INDEX idx_report_tokens_consultation ON public.report_tokens(consultation_id);

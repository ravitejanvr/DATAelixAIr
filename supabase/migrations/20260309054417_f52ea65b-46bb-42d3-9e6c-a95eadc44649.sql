
-- Fix remaining: report_tokens policies already exist, just need paid_at column
DROP POLICY IF EXISTS "Doctors create report tokens" ON public.report_tokens;
DROP POLICY IF EXISTS "Doctors view own report tokens" ON public.report_tokens;
DROP POLICY IF EXISTS "Anon can read tokens for validation" ON public.report_tokens;

CREATE POLICY "Doctors create report tokens" ON public.report_tokens FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Doctors view own report tokens" ON public.report_tokens FOR SELECT TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Anon can read tokens for validation" ON public.report_tokens FOR SELECT TO anon USING (true);

-- Add paid_at column to invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS paid_at timestamptz DEFAULT NULL;

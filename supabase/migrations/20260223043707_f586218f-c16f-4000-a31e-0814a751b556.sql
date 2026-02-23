
-- Add new roles to the app_role enum (each in its own transaction via IF NOT EXISTS)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'nurse';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'allied_health';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'pharmacist';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'lab';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'care_coordinator';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'front_desk';

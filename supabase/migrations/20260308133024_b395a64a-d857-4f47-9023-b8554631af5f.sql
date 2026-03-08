
-- Fix: patient_visits already in realtime publication, skip that line.
-- This is a no-op migration to mark the previous partial failure as resolved.
-- All RLS policies were already applied before the error line.
SELECT 1;


-- Fix: Restrict email-assets uploads to platform_admin only
DROP POLICY IF EXISTS "Authenticated users can upload email assets" ON storage.objects;

CREATE POLICY "Admin only upload email assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'email-assets'
  AND has_role(auth.uid(), 'platform_admin'::app_role)
);

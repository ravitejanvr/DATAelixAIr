CREATE POLICY "Platform admins view all roles"
  ON public.user_roles FOR SELECT
  USING (has_role(auth.uid(), 'platform_admin'::app_role));

-- Fix handle_new_user_role: HARDCODE default role, ignore client-provided role
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  -- SECURITY: Always assign 'patient' as default role.
  -- Privileged roles (doctor, platform_admin, etc.) are assigned
  -- ONLY via service_role through edge functions after verification.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'patient');
  RETURN NEW;
END;
$function$;

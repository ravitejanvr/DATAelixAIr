ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_reasoning_traces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Service role insert user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Platform admins view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Platform admins view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "Service role manage user_roles"
ON public.user_roles
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role insert clinical_reasoning_traces" ON public.clinical_reasoning_traces;

CREATE POLICY "Service role insert clinical_reasoning_traces"
ON public.clinical_reasoning_traces
FOR INSERT
TO service_role
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Authenticated users can update knowledge cache" ON public.knowledge_cache;
DROP POLICY IF EXISTS "Service role insert knowledge_cache" ON public.knowledge_cache;
DROP POLICY IF EXISTS "Service role write knowledge_cache" ON public.knowledge_cache;
DROP POLICY IF EXISTS "Service role update knowledge_cache" ON public.knowledge_cache;

CREATE POLICY "Service role manage knowledge_cache"
ON public.knowledge_cache
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Authenticated users can update reasoning cache" ON public.reasoning_cache;
DROP POLICY IF EXISTS "Service role insert reasoning_cache" ON public.reasoning_cache;
DROP POLICY IF EXISTS "Service role write reasoning_cache" ON public.reasoning_cache;
DROP POLICY IF EXISTS "Service role update reasoning_cache" ON public.reasoning_cache;

CREATE POLICY "Service role manage reasoning_cache"
ON public.reasoning_cache
FOR ALL
TO service_role
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Anyone can submit pilot request" ON public.pilot_requests;

CREATE POLICY "Authenticated users can submit pilot request"
ON public.pilot_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.role() = 'authenticated');

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
      AND roles = ARRAY['service_role']::name[]
      AND cmd IN ('ALL', 'INSERT', 'UPDATE', 'DELETE')
      AND (
        (qual IS NOT NULL AND regexp_replace(qual, '\s+', ' ', 'g') ~* '^\(?true\)?$')
        OR (with_check IS NOT NULL AND regexp_replace(with_check, '\s+', ' ', 'g') ~* '^\(?true\)?$')
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);

    IF pol.cmd = 'ALL' THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR ALL TO service_role USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
        pol.policyname, pol.schemaname, pol.tablename
      );
    ELSIF pol.cmd = 'INSERT' THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR INSERT TO service_role WITH CHECK (auth.role() = ''service_role'')',
        pol.policyname, pol.schemaname, pol.tablename
      );
    ELSIF pol.cmd = 'UPDATE' THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR UPDATE TO service_role USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
        pol.policyname, pol.schemaname, pol.tablename
      );
    ELSIF pol.cmd = 'DELETE' THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR DELETE TO service_role USING (auth.role() = ''service_role'')',
        pol.policyname, pol.schemaname, pol.tablename
      );
    END IF;
  END LOOP;
END
$$;
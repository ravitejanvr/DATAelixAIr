-- FIX: knowledge_cache and reasoning_cache — restrict INSERT to service_role only
-- These are AI pipeline caches that must not be writable by regular users

DROP POLICY IF EXISTS "Authenticated users can insert knowledge cache" ON public.knowledge_cache;
CREATE POLICY "Service role insert knowledge_cache"
  ON public.knowledge_cache FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can insert reasoning cache" ON public.reasoning_cache;
CREATE POLICY "Service role insert reasoning_cache"
  ON public.reasoning_cache FOR INSERT
  TO service_role
  WITH CHECK (true);
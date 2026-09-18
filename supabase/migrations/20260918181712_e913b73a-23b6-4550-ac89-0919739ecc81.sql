-- Guideline supersession precedence (ROADMAP.md P0 item 5).
--
-- guideline_registry had no way to link a newer version of a guideline to
-- the older one it replaces — is_active alone can't express "both rows are
-- individually valid records, but only the newer one should be served."
-- With no precedence signal, application code fell back to picking
-- whichever row Postgres happened to return first (arbitrary, not
-- recency-based) whenever an organization published a new guideline for a
-- condition without deactivating the old one.
--
-- superseded_by is nullable and self-referential: NULL means "current",
-- non-NULL points at the guideline that replaces this one. Left as an
-- explicit link (not just deleting/deactivating the old row) so the
-- superseded guideline's own history stays queryable for audit purposes.
ALTER TABLE public.guideline_registry
  ADD COLUMN superseded_by uuid REFERENCES public.guideline_registry(id);

CREATE INDEX idx_guideline_registry_superseded_by
  ON public.guideline_registry(superseded_by)
  WHERE superseded_by IS NOT NULL;

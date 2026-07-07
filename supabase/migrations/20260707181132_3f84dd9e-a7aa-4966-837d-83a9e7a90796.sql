
CREATE TABLE IF NOT EXISTS terminology.concept_search_rebuild_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid NOT NULL REFERENCES terminology.releases(id) ON DELETE CASCADE,
  chunk_index int NOT NULL,
  chunks_total int NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','failed')),
  rows_indexed bigint NOT NULL DEFAULT 0,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (release_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_csrp_release_status
  ON terminology.concept_search_rebuild_progress (release_id, status);

GRANT ALL ON terminology.concept_search_rebuild_progress TO service_role;

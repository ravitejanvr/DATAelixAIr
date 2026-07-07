# Terminology Pipeline (SNOMED CT + Future Code Systems)

Empirical, chunked, resumable loader for SNOMED CT into a generic
FHIR-shaped terminology store. Same schema will host RxNorm, ICD-10/11,
LOINC, UCUM, and ATC without further migrations.

## Platform decisions (from Phase 1 POC)

| Question | Measured answer | Consequence |
|---|---|---|
| Direct Postgres from edge? | Yes, port 5432 via `SUPABASE_DB_URL`, driver `postgres@3.4.4` | Loader uses direct pg, not PostgREST |
| `COPY FROM STDIN` in Deno edge? | **No** — postgres.js `.writable()` crashes the isolate (`unexpected message type 0x50`) | Loader uses batched multi-row `INSERT` |
| Batched INSERT throughput | ~10.5k rows/s @ batch=1000; **~35k rows/s @ batch=5000** | Loader default batch = 5000 |
| Per-invocation memory ceiling (~256 MB) | Hit at 500k rows × batch=5000 | Chunk size capped at 150k rows |
| Per-invocation wall-clock (150 s) | Hit at 500k rows × batch=2000 | Same |

**Result:** ~150k rows/chunk × ~35 chunks for full SNOMED International (active, English)
= ~2.5 min DB time, ~6 min end-to-end via pg_cron (~1 chunk / 30 s).

## Data model

Two layers, deliberately separated:

### Staging (SNOMED-specific, RF2-shaped)

- `terminology.snomed_concepts`
- `terminology.snomed_descriptions`
- `terminology.snomed_relationships`

Fed directly from RF2 by the loader. Retained as archive-of-record per release.
Never queried by application code.

### Generic FHIR-shaped model (query surface)

- `terminology.code_systems` — one row per system (SNOMED, RxNorm, ICD, …)
- `terminology.releases` — one row per import; `status` = pending|loading|active|archived|failed
- `terminology.concepts` — `(code_system_id, release_id, code)` unique
- `terminology.designations` — FSN, preferred, synonym, local
- `terminology.relationships` — is-a (extendable)
- `terminology.mappings` — cross-system equivalences (SNOMED↔ICD, SNOMED↔RxNorm)
- `terminology.local_synonyms` — curated Indic and colloquial terms; persisted across releases

### Search surface

`terminology.concept_search` — denormalized, indexed with `pg_trgm` and `text_pattern_ops`.
Rebuilt in full on each `promote-release`. All application search (autocomplete, fuzzy,
canonicalization) goes here via `public.terminology_search(q, system_short_name, limit_n)`.

## Public RPCs (only exposed surface)

- `public.terminology_search(q text, system_short_name text default 'snomed-ct', limit_n int default 20)`
- `public.get_terminology_counts()` — index health counts
- `public.get_terminology_dashboard()` — admin dashboard payload

Terminology schema tables are NOT exposed to PostgREST. All writes go through
edge functions using direct pg connection.

## Edge functions

| Function | Auth | Purpose |
|---|---|---|
| `terminology-create-release` | platform_admin | Register release, seed `import_jobs` from manifest |
| `terminology-load-chunk` | none (cron) | Claim + load one chunk (idempotent, resumable) |
| `terminology-promote-release` | platform_admin | Promote staging → generic, rebuild search, activate |

`terminology-load-chunk` is invoked every 30 s by `pg_cron`; no-op when queue is empty.

## Import workflow (twice a year, per SNOMED release)

1. Download RF2 release from SNOMED International.
2. Unzip locally.
3. Run preprocessor:
   ```
   node scripts/snomed-preprocess.mjs \
     ./SnomedCT_InternationalRF2_PRODUCTION_20250701T120000Z \
     ./out/snomed-20250701 \
     SnomedCT_INT_20250701
   ```
   Produces gzipped NDJSON chunks (~5 MB each) and `manifest.json`.
4. Upload `out/snomed-20250701/*.ndjson.gz` to the `ontology` bucket at
   `snomed/SnomedCT_INT_20250701/`.
5. In the app: `/platform-admin/terminology` → paste `manifest.json` → **Create release**.
6. Wait ~5–10 min while pg_cron drains the queue. Progress bar auto-updates.
7. Click **Promote** on the release. Concepts/designations/relationships copy
   into the generic model; `concept_search` is rebuilt; `active_release_id`
   flips. Prior release is `archived` (rows retained, not queried).

Rollback: SQL update `code_systems.active_release_id` back to a prior release
and re-run promote's search-rebuild step (or simply re-promote the prior release).

## Adding a new code system (e.g., RxNorm)

1. Insert one row into `terminology.code_systems` (short_name = `rxnorm`).
2. Write a preprocessor that emits NDJSON chunks with the same
   `{concept_id, code, display, ...}` shape into a corresponding staging table
   (or directly into `terminology.concepts`).
3. Reuse `terminology-load-chunk` and `terminology-promote-release` with
   RxNorm-specific promote SQL (small variant of the SNOMED promote logic).
4. Search Just Works — `terminology_search(q, 'rxnorm')`.

## Platform limitations encountered / accepted

| Limit | Impact | Mitigation |
|---|---|---|
| `COPY FROM STDIN` unusable in Deno edge | 3× slower load than optimal | Chunked INSERT is fast enough; ~6 min per release, twice a year |
| Edge function 256 MB / 150 s | Cannot load full SNOMED in one call | Chunked queue + pg_cron |
| PostgREST does not expose `terminology` schema | No direct table reads from client | `public.terminology_search()` RPC (single query surface) |
| `SUPABASE_DB_URL` rotation | Loader would break silently | Documented — do not rotate without redeploying loader |

## Security

- SNOMED tables have no anon/authenticated grants; writes only via direct pg (superuser via `SUPABASE_DB_URL`).
- Admin edge functions verify `has_role(auth.uid(), 'platform_admin')` before any write.
- Search RPC is `SECURITY DEFINER`, exposes read-only reference data — no PII.
- Legacy `exec_terminology_sql(text)` RPC removed (arbitrary-INSERT surface).

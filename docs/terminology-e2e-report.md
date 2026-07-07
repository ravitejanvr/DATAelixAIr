# Terminology Pipeline — End-to-End Validation

This document describes the final validation phase completed before the first
production SNOMED CT release. It covers the synthetic dataset, the end-to-end
test harness, the automated post-import verification, the integration test
suite, and the stable service API surface.

## 1. Synthetic micro-release

The fixture mirrors real SNOMED CT RF2 shape but contains only 10 active
concepts (plus 1 inactive) with FSNs, synonyms, and an `is-a` hierarchy:

```
Clinical finding
├─ Disease
│  ├─ Infectious disease
│  │  ├─ Pneumonia
│  │  │  ├─ Community-acquired pneumonia
│  │  │  └─ Viral pneumonia
│  │  └─ Gastroenteritis
│  └─ Diabetes mellitus
└─ Pain
   └─ Headache
```

Two ways to produce it:

- **Local**: `node scripts/snomed-synth-fixture.mjs ./tmp/snomed-synth`
  emits tab-delimited RF2 files that the production preprocessor accepts
  unmodified.
- **In-cluster**: the `terminology-e2e-test` edge function builds the same
  dataset in memory, so no filesystem or manual upload is required.

Version 2 of the fixture adds *Bacterial pneumonia* and *Aspiration pneumonia*
so the harness can exercise a real re-import.

## 2. End-to-end harness

Edge function: `terminology-e2e-test` (platform_admin only).

For each of two release versions it executes the **complete pipeline**:

1. Preprocess in-memory rows to production NDJSON shape
2. Gzip and upload chunks to the `ontology` bucket at
   `snomed-test/<run-id>/…`
3. Register a release row + seed `terminology.import_jobs`
4. Drain the queue via the same claim → download → decompress → batched
   INSERT loop used by `terminology-load-chunk`
5. Promote (concepts / designations / relationships / search rebuild /
   activate) using SQL identical to `terminology-promote-release`
6. Run the automated verification suite (§3)
7. Run the integration assertions (§4)
8. Rollback active pointer to v1
9. Re-promote v2
10. Delete all synthetic rows and storage objects

The whole run completes in a few seconds and leaves the database in exactly
the state it started in. The `snomed-test` code system is isolated from
`snomed-ct`, so production data is never touched.

## 3. Automated post-import verification

Two entry points:

- **In-harness inline SQL** (used by `terminology-e2e-test` because it runs
  as service_role and does not carry a user JWT).
- **`public.terminology_verify_release(uuid)`** for admin-triggered checks
  from the UI. Requires `platform_admin`.

Both compute the same report:

| Check | Formula | Fails on |
|---|---|---|
| Concept count | `count(concepts where release_id = X)` | mismatch vs `releases.row_counts` |
| Designation count | join concepts → designations, filter active | staging drift |
| Relationship count | `count(relationships where release_id = X)` | promote gap |
| **Orphan relationships** | source or target concept missing from release | broken join key |
| **Duplicate codes** | `sum(count(*)-1) group by code having >1` | > 0 → schema breach |
| **Concepts without designations** | not exists any active designation | > 0 → data loss |
| **Concepts without preferred term** | not exists FSN or preferred | display fallback risk |
| **Search index shortfall** | `expected - concept_search rows` | > 0 → stale index |
| **Broken hierarchy targets** | is-a target concept missing | > 0 → dangling parent |
| Hierarchy roots | concepts with no is-a parent | reported (not a failure) |

`ok = orphan=0 AND duplicates=0 AND broken_hierarchy=0 AND concepts_without_designations=0 AND search_rows ≥ expected`.

## 4. Integration test coverage

Deno test file: `supabase/functions/terminology-service/index.test.ts`.
Runs against the deployed `terminology-service` HTTP surface after the
E2E harness has created the `snomed-test` release.

| Test | Asserts |
|---|---|
| `search:pneumonia` | Exact FSN match returns concept 233604007 |
| `autocomplete:pneu` | Prefix `pneu` returns ≥1 hit |
| `fuzzy:pnuemonia` | Trigram match tolerates typo |
| `synonym:cephalgia` | Synonym maps back to headache 25064002 |
| `canonicalize:lung_infection` | Free-text maps to canonical pneumonia code |
| `lookup:designations` | Concept returns ≥2 active designations |
| `ancestors:cap_reaches_root` | Community-acquired pneumonia traverses to Clinical finding |
| `descendants:disease_includes_pneumonia` | Recursive is-a expansion returns children |
| `validate:known_vs_unknown` | Existing active code = valid; bogus code = invalid |

## 5. Service API — the only public surface

All AI and UI components MUST talk to terminology through these entry points.
Terminology schema tables are not exposed via PostgREST.

### HTTP (edge function `terminology-service`)

```
POST /functions/v1/terminology-service
{ "op": "search"|"lookup"|"ancestors"|"descendants"|"canonicalize"|"translate"|"validate", ... }
```

### RPC (direct, `supabase.rpc(...)`)

| RPC | Purpose |
|---|---|
| `terminology_search(q, system_short_name, limit_n)` | Trigram fuzzy + prefix search |
| `terminology_lookup(p_code, p_system)` | Concept + all active designations |
| `terminology_ancestors(p_code, p_system, p_max_depth)` | Recursive is-a parents |
| `terminology_descendants(p_code, p_system, p_max_depth, p_limit)` | Recursive is-a children |
| `terminology_canonicalize(p_q, p_system, p_min_score)` | Free text → canonical code |
| `terminology_translate(p_source_code, p_source_system, p_target_system)` | Cross-system mapping (SNOMED ↔ ICD, etc.) |
| `terminology_validate(p_code, p_system)` | Existence + active check |
| `terminology_verify_release(p_release_id)` | Post-import verification (admin) |
| `terminology_rollback_release(p_release_id)` | Flip active pointer (admin) |
| `get_terminology_counts()` | Index health snapshot |
| `get_terminology_dashboard()` | Admin UI payload |

Contract guarantees:

- Read RPCs are `SECURITY DEFINER` over read-only reference data. No PII.
- All read RPCs return `null` / empty when the requested code system has no
  active release. Callers must treat that as "terminology unavailable" and
  degrade gracefully — they must not fall back to raw string matching.
- Admin RPCs enforce `has_role(auth.uid(),'platform_admin')`.

## 6. Operator runbook

1. Preprocess a real SNOMED release (`scripts/snomed-preprocess.mjs`).
2. Upload chunks to `ontology` bucket.
3. In the Terminology Administration page, create release → wait for chunks to
   drain (pg_cron, ~30 s/chunk) → **Promote**.
4. Click **Verify** on the newly-active release. `ok` must be `true` and all
   `issues.*` must be zero (except `hierarchy_roots`, which is informational).
5. If verify fails, click **Rollback** on the previous release. The active
   pointer flips and the search index is rebuilt against the prior release.

For synthetic validation without a real RF2 file, click **Run E2E test** in
the admin panel. Expected result: `ok: true`, all assertions pass, no rows
left behind in `terminology.*`.

## 7. Platform-specific decisions retained

- `COPY FROM STDIN` remains unusable in the Deno edge isolate. Batched
  multi-row `INSERT` at 5,000 rows/batch is the loader default.
- Direct PostgreSQL via `SUPABASE_DB_URL` on port 5432 is stable for chunk
  loading and promote SQL.
- Terminology schema tables have zero PostgREST grants. All access goes
  through `public.*` RPCs.
- Read RPCs are anon-executable by design (reference data has no PII).
  Linter warnings on those functions are acknowledged and intentional.

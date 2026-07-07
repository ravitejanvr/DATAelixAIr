# Terminology Platform — v1.1 Roadmap (Deferred)

**Status:** Deferred. v1.0 is frozen after the first successful production SNOMED CT import.
Do **not** implement any of this until the platform has run stably in production for a meaningful period and the value case is re-confirmed.

## Goal

Replace the local preprocessing step (`scripts/snomed-preprocess.mjs` run on an operator's laptop) with a fully in-platform workflow: an operator uploads the official RF2 ZIP through the Terminology Administration page and the platform preprocesses it server-side, resumably.

## Why deferred

v1.0 preprocessing works end-to-end via the local script. The proposed server-side pipeline is a **convenience** upgrade, not a correctness or safety upgrade. Building it now would:

- Reopen the frozen terminology subsystem.
- Delay the Clinical Reasoning Engine work.
- Add operational surface area (a new state table, three edge functions, a pg_cron job, resumable upload UI) that has to be maintained forever.

Revisit only if operators are running SNOMED releases frequently enough that the manual step becomes a real cost, and the SNOMED International license permits storing the raw RF2 ZIP in Supabase Storage.

## Platform constraints that drive the design

| Limit | Value | Consequence |
|---|---|---|
| Edge function wall time | 150 s | Cannot inflate + parse the full Relationships snapshot (~3 M rows) plus safety margin in a single call — must be per-entry, with a restart-from-zero fallback. |
| Edge function memory | 256 MB | Cannot hold uncompressed Relationships (~250 MB) in RAM — must stream. |
| Function request body | ~100 MB practical | The RF2 ZIP (~200 MB) cannot be POSTed through `functions.invoke`. Upload must go **direct to Storage** (TUS resumable). |
| Storage TUS upload | Up to 5 GB, resumable | ✅ Fine for the ZIP. |
| Storage HTTP Range GET | Supported on signed URLs | ✅ Enables reading the ZIP central directory + slicing individual entries. |
| Deno `DecompressionStream('deflate-raw')` | Available | ✅ Streams a single ZIP entry without materialising it. |
| Mid-DEFLATE resume | ❌ inflator state not serializable | Resumability is **per ZIP entry**, not per byte. If an entry can't finish in 150 s, restart from byte 0 and skip N already-produced rows. |

## Proposed architecture

**Stage 0 — Upload (browser → Storage, direct).** Terminology Admin gets a drag-and-drop panel that uses `supabase.storage.from('ontology').uploadToSignedUrl(...)` with TUS to `ontology/snomed-raw/<release-id>/release.zip`. No function is in the upload path, so the request-body cap does not apply.

**Stage 1 — `terminology-preprocess-init` (fast, < 5 s).** Fetches the last 64 KB of the ZIP via `Range:`, parses EOCD + central directory, identifies the three Snapshot entries (Concept, Description-en, Relationship), and records `{entry_name, local_header_offset, compressed_size, uncompressed_size, compression_method}` into a new `terminology.preprocess_jobs` table. Creates the release row in `pending_preprocess` status.

**Stage 2 — `terminology-preprocess-entry` (pg_cron every 30 s, one entry per invocation).** Picks the next `pending` entry, marks it `running`, opens a `Range:` GET for `[local_header_offset, local_header_offset + compressed_size)`, pipes response → `DecompressionStream('deflate-raw')` → `TextDecoderStream` → line splitter → RF2 active-row filter → JSON encoder → `CompressionStream('gzip')` → direct Storage PUT to `ontology/snomed/<release-id>/<table>_NNNN.ndjson.gz`, rotating every 150 000 rows. Persists produced chunk metadata into `preprocess_jobs.produced_chunks`. Never buffers more than one chunk in memory (bounded ~30 MB).

**Fallback for oversize entries.** If an entry doesn't finish within ~130 s (safety margin), the function persists a `resume_after_line` watermark. Next invocation re-opens the Range GET from byte 0, re-inflates, skips `resume_after_line` rows, and continues. Phase 1 POC measured ~90 k parsed rows/s in Deno, so Relationships (~3 M rows) fits in ~35 s and this fallback is unlikely to trigger in practice.

**Stage 3 — `terminology-preprocess-finalize`.** When all three entries are `done`, assembles `manifest.json` from `produced_chunks`, writes it to Storage, calls the existing `terminology-create-release` — reusing the validated v1.0 load → verify → promote pipeline unchanged. Optionally deletes the raw ZIP.

**UI changes** — Terminology Admin gains: (a) drag-and-drop RF2 upload with TUS progress, (b) a Preprocessing panel with per-entry status (pending / running / done / failed), rows produced, chunks written, (c) automatic hand-off into the existing Releases → chunks → Promote flow.

## Preconditions before building

1. Legal review confirms the SNOMED International affiliate license permits storing the raw RF2 ZIP in Supabase Storage (even transiently).
2. v1.0 has run in production for a defined stability window with at least one successful release rotation using the local preprocessing script.
3. A concrete operator pain-point justifies the ~4 h of build + permanent maintenance cost.

## Explicitly out of scope

- Automatic download of RF2 releases from the SNOMED International MLDS portal (requires authenticated licensed access; not permitted for server-to-server automation).
- Any change to the v1.0 load / verify / promote / rollback path — that remains frozen.

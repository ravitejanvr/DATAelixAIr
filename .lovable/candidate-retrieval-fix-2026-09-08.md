# Candidate retrieval + ranking fix (ddx-engine)

## Defects found (repository/database evidence)
1. **Silent candidate truncation.** Stage 2 fetched `symptom_likelihoods` in a single
   PostgREST request, capped at 1000 rows. Multi-symptom presentations exceeded the cap,
   so part of the candidate graph never entered scoring.
2. **Calibrated priors unused.** Scoring used a hardcoded `CATEGORY_PRIORS` map, so every
   diagnosis in a category shared one prior. `disease_priors` (566 rows, 392/423
   edge-bearing diagnoses covered) was never read.
3. **Bulk-defaulted prevalence.** ~45 rows sat at 0.03 and ~93 at 0.02 regardless of
   rarity: anthrax, plague, cholera, brucellosis, herpes simplex encephalitis, tetanus,
   necrotizing fasciitis, several cancers were as "common" as gastritis.

## Changes
- Paged likelihood fetch (deterministic ordering, up to 20 pages).
- Per-diagnosis prior from `disease_priors`, with age / sex / region modifiers;
  category prior (scaled 0.2 onto the prevalence band) as deterministic fallback.
- Migration recalibrating ~70 rare conditions onto primary-care bands
  (0.05+ / 0.02 / 0.005 / 0.001 / 0.0002); tuberculosis moved to 0.002 base with an
  india/south_asia region modifier of 4.0 instead of a globally inflated prior.
- **Prior compression** `prior^0.35`. Raw prevalence spans ~750x and swamped the
  evidence term; uncompressed priors regressed the suite badly (see below).

## Benchmark v10 (120 cases, live engine)
| Run | top-1 | top-3 | top-5 | recall | acceptability | safety sens. | latency |
|---|---|---|---|---|---|---|---|
| baseline `…843296589` | 35 | 57 | 63 | 71 | 61 | 92 | 5.8s |
| priors, no compression `…846222179` | 23 | 44 | 57 | 67 | 53 | 92 | 5.9s |
| **compression 0.35 `…846864271` (shipped)** | **42** | **58** | **65** | **73** | **66** | **92** | 5.9s |
| compression 0.50 `…847285560` | 40 | 53 | 65 | 71 | 65 | 92 | 6.5s |

Safety sensitivity unchanged (92%); alert precision unchanged (81%).

## Still open
- Latency ~5.9s against the <3s target (stage budgets, not retrieval).
- 14 gold labels remain thin or absent in the KB (taxonomy doc, buckets B + C).
- Abbreviation matching still substring-based (`SLE` → measles/OSA); needs an alias table.

# A7 — KG ↔ Terminology Binding Report

Release: `SnomedCT_INT_20260701` (Terminology Platform v1.0, frozen)

## Backfill
- KG cluster diagnosis names: **87**
- Auto-resolved via `terminology_canonicalize` (min_score 0.5): **77**
- Manually curated after review (abbreviations / phrasing gaps): **10**
  - SVT → 6456007, COPD Exacerbation → 195951007, Paracetamol Hepatotoxicity → 295124009,
    Ruptured AAA → 14336007, Bowel Obstruction → 81060008, Drug Reaction → 62014003,
    Congenital Cataract → 79410001, Measles → 14189004, Aortic Dissection → 308546005,
    Diabetic Foot Infection → 280137006
- Rejected auto-match example: "SVT" → *Sievert (qualifier value)* (score 0.28, below threshold).

## Shadow parity (all 21 clusters activated)
| Metric | Value |
|---|---|
| Binding coverage | 100% (87/87) |
| Distinct canonical IDs | 87 (no collisions) |
| Candidate divergences | 0 |
| Parity | PASS |
| `safe_to_enable` | true |

## Status
`enable_kg_terminology_binding` remains **false**. No production reasoning path
reads canonical IDs yet; bindings and the verifier are diagnostic-only. Flipping
the flag is now unblocked from a data-integrity standpoint and can be scheduled
as its own change with benchmark re-run.

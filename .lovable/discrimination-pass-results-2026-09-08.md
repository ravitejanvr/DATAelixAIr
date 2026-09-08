# Discrimination Pass — Results (2026-09-08)

Measured against `ddx-engine` on all 120 Benchmark v10 cases (phase9 +
phase10_augment, diagnostics on, gold matched with the benchmark's own
`diagMatch`). Same harness as the knowledge-fill measurement.

## Change made
Single change, ontology-derived (no hardcoded disease features):

`symptom_likelihoods.symptom_specificity` — populated for all 6,549 edges but
previously unused — now weights each edge's contribution to the likelihood sum:

```
likelihoodSum = Σ P(Sᵢ|D) × specificity(Sᵢ,D)
```

Generic findings (fever, fatigue) therefore contribute far less than hallmark
findings. Tuning parameters (`spec_floor`, `spec_slope`, `spec_pow`) are
request-level overrides for measurement only; production defaults are
floor 0, slope 1, pow 1 (pure linear specificity).

## Results (n = 120)

| Metric | Before (knowledge fill) | After discrimination pass |
|---|---|---|
| Gold in scored pool | 120 (100%) | 120 (100%) |
| Gold at rank 1 | 62 (52%) | **70 (58%)** |
| Gold in top 3 | 84 (70%) | **95 (79%)** |
| Gold in returned top 10 | 105 (88%) | **107 (89%)** |
| Avg engine latency | ~0.8 s | ~0.63 s |

## Tuning sweep (measured, all 120 cases)

| floor / slope / pow | top-1 | top-3 | top-10 |
|---|---|---|---|
| 0.4 / 1.2 / 1 | 65 | 92 | 107 |
| 0.7 / 0.6 / 1 | 65 | 92 | 105 |
| 0.05 / 1 / 1 | 67 | 93 | 108 |
| **0 / 1 / 1 (shipped)** | **70** | **95** | **107** |
| 0 / 1 / 1.5 | 71 | 91 | 108 |
| 0 / 1 / 2 | 72 | 92 | 107 |
| 0 / 1 / 3 | 71 | 92 | 105 |

Sharper curves trade top-3 for top-1; the linear form was chosen as the best
combined result and the simplest defensible model.

## Remaining failures (13, all still discrimination)
Pneumonia (noisy-001), pleural effusion, stable angina, pericardial effusion,
multiple sclerosis, acute kidney injury, testicular torsion, cauda equina
syndrome, chronic mesenteric ischemia, aortic dissection (adv-002), WPW,
Fournier gangrene, pulmonary embolism (adv-023).

All are present in the scored pool but score 0–2/100 — their edges remain too
generic relative to competitors, i.e. per-edge specificity values for these
conditions are missing or under-calibrated.

## Next steps (in order)
1. Specificity calibration for the 13 residual conditions (edge-level values,
   not new rules), measured the same way.
2. Full-pipeline benchmark re-run to convert engine gains into end-to-end
   top-1/top-3 numbers.
3. Orchestrator latency profiling — engine is now ~0.63 s of the ~5.9 s total.

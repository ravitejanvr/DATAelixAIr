# Knowledge Fill + Deterministic Ranking — Results (2026-09-08)

Measured directly against `ddx-engine` on all 120 Benchmark v10 cases
(phase9 + phase10_augment, diagnostics on, gold matched with the benchmark's
own `diagMatch`).

## Changes made
1. **Deterministic ranking** — `rankCompare` in `ddx-engine`: probability →
   posterior → must-not-miss → diagnosis_id. Rounded integer probabilities were
   creating large tie groups ordered by retrieval order.
2. **Knowledge fill** — 6 new diagnoses (seizure, vasovagal syncope, lumbar
   spinal stenosis, upper extremity DVT, panic attack, non-convulsive status
   epilepticus), 21 new vocabulary terms, 89 new symptom→diagnosis links across
   16 conditions that had zero or near-zero edges.
3. **Reactivated 3 conditions** that had edges but `is_active = false`
   (normal pressure hydrocephalus, prostatitis, epidural hematoma).

## Results (n = 120)

| Metric | Before | After ranking fix | After knowledge fill |
|---|---|---|---|
| Gold in scored pool | 104 (87%) | 104 | **120 (100%)** |
| Gold in returned top-10 | 91 (76%) | 90 | **105 (88%)** |
| Gold at rank 1 | 47 (39%) | 49 | **62 (52%)** |
| Avg engine latency | ~0.6 s | ~0.6 s | ~0.8 s |

The ranking fix alone was near-neutral (+2 rank-1). The knowledge fill produced
the gain: candidate recall is now complete, and 13 additional cases became
rank-1.

## Remaining failures (all ranking/discrimination, none are recall gaps)
Pneumonia, pleural effusion, stable angina, pericardial effusion, multiple
sclerosis, acute kidney injury, testicular torsion, cauda equina syndrome,
chronic mesenteric ischemia, melanoma, aortic dissection, myocardial infarction,
WPW, Fournier gangrene, pulmonary embolism.

Most score 0–2/100 despite being present, i.e. their existing edges are too weak
or too generic relative to competitors — a weighting/discrimination problem, not
a retrieval problem.

## Next steps (in order)
1. Discrimination pass on the 15 near-miss conditions (edge weights /
   specificity, look-alike suppression), measured the same way.
2. Full-pipeline benchmark re-run to convert engine gains into end-to-end
   top-1/top-3 numbers.
3. Orchestrator latency profiling — engine is 0.8 s of the ~5.9 s total.

# Candidate Loss Instrumentation — 2026-09-08

Read-only measurement. No reasoning, scoring, or knowledge changes were made.

## What was added
`ddx-engine` accepts an optional `diagnostics: true` flag. When set, the response
additionally returns:
- `candidate_pool_size`
- `candidate_pool` — every scored candidate with rank + probability (pre-truncation)
- `scored_pool_before_selection` — raw retrieved candidate map size

Default responses are unchanged (flag defaults to `false`).

## Method
All 120 Benchmark v10 cases were submitted directly to `ddx-engine`
(`phase9 + phase10_augment`, diagnostics on), gold diagnosis matched with the
benchmark's own `diagMatch` synonym matcher.

## Results (n = 120)

| Outcome | Count |
|---|---|
| Gold present in scored pool | 104 (87%) |
| Gold in returned top-10 | 91 (76%) |
| Gold at rank 1 | 47 (39%) |
| **Never scored (knowledge gap)** | **16 (13%)** |
| **Scored but truncated before top-10 (ranking gap)** | **13 (11%)** |
| Average scored pool size | 143 candidates |
| Average engine latency | ~0.6 s |

### Truncated (scored, then dropped) — ranking defect
noisy-001 Pneumonia (rank 58/257, p=0) · noisy-020 Stable Angina (21/23, p=2) ·
noisy-023 Pericardial Effusion (44/63, p=0) · noisy-029 Multiple Sclerosis (98/238, p=0) ·
noisy-043 Testicular Torsion (29/147, p=1) · ambig-012 Chronic Mesenteric Ischemia (51/212, p=0) ·
ambig-023 Melanoma (13/15, p=4) · adv-002 Aortic Dissection (37/58, p=1) ·
adv-004 WPW Syndrome (11/110, p=2) · adv-006 Complete Heart Block (13/260, p=2) ·
adv-014 Fournier Gangrene (58/169, p=0) · adv-018 Carbon Monoxide Poisoning (11/327, p=2) ·
adv-023 Pulmonary Embolism (24/105, p=1)

Several sit at rank 11–13 — just outside the hard top-10 cut with non-zero probability.

### Never scored — knowledge gap
noisy-027 Seizure · noisy-030 Normal Pressure Hydrocephalus · noisy-045 Prostatitis ·
ambig-004 Panic Attack · ambig-015 Vocal Cord Dysfunction · ambig-017 Fever of Unknown Origin ·
ambig-021 Lumbar Spinal Stenosis · ambig-027 Vasovagal Syncope · ambig-036 Functional Neurological Disorder ·
ambig-037 Somatic Symptom Disorder · adv-008 Epidural Hematoma · adv-009 Non-Convulsive Status Epilepticus ·
adv-024 Upper Extremity DVT · adv-027 Strangulated Inguinal Hernia · adv-028 Non-Accidental Injury ·
adv-030 Retinoblastoma (engine returned no pool)

These are absent from the symptom→diagnosis graph or have no edges from the
presented findings; no ranking change can recover them.

## Secondary finding — latency
Engine-only latency averaged ~0.6 s while full-pipeline benchmark latency is ~5.9 s.
The 3-second budget problem lives in the orchestrator stages, not in DDX retrieval.

## Evidence-based next steps (in order)
1. Ranking: 13 recoverable cases already scored — several at rank 11–13.
2. Knowledge: 16 cases need graph edges for named conditions before any accuracy target is reachable.
3. Latency: profile orchestrator stages, not DDX.

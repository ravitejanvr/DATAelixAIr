# DATAelixAIr — Roadmap to Pilot-Ready
Drafted 2026-09-18, from the current forensic audit, benchmark remeasurement, and tonight's CI work.

> **Note:** this is a trimmed, portfolio-facing copy of the project roadmap. The detailed
> incident/decision records behind each item (exact root causes, security findings, and the
> publication-planning notes) are kept in the private development history rather than reproduced
> here.

---

## Definition of "pilot-ready"

Pulled from your own original build plan (Slice 3) and everything confirmed since. Pilot-ready
means all of the following are true, not just the product demo working:

1. A real Supabase project you own, with CI that tests before it deploys.
2. The system's deterministic guarantees (must-not-miss escalation, guideline currency, drug
   interaction bounds) are verified correct — not just present in the architecture diagram.
3. The Pre-Visit Brief — the actual product wedge — exists and has been used by real doctors on
   real (or realistically real) cases, with their feedback captured.
4. Every accuracy or safety claim you'd tell a pilot clinic is backed by evaluation with external
   ground truth, not AI-generated cases graded against themselves.
5. A clinical safety case, a DPDP data-protection assessment, clinician-override logging, and an
   incident process exist as real documents, not TODOs.
6. 2–3 clinics have agreed to pilot it.

Nothing below ships to a pilot clinic until all six are true.

---

## Roadmap — five phases

```
Phase 0: Foundation & Hardening        (own infra, CI closes the loop, cheap safety fixes)
Phase 1: Reasoning Engine Resolution   (decide V1 vs V3, stop chasing differential-accuracy)
Phase 2: Pre-Visit Brief MVP           (the actual product — LLM+retrieval for breadth)
Phase 3: Real Evaluation               (external ground truth, the doctor test)
Phase 4: Pilot Governance              (safety case, DPDP, override logging, incident process)
```

Research (the governance/verification paper, the terminology-platform paper, PhD program search)
runs in parallel throughout — it isn't a phase, it's a lane that draws evidence from every phase
as it happens.

**Current top priority, 2026-09-24: publish on arXiv.** The immediate goal is a decent, honest,
defensible paper — weight for a PhD application in AI health, not a comprehensive research program.
Engineering work (items 25–26) is paused, not abandoned — see "Publication priority" below for the
topic decision and outline.

---

## Product backlog, prioritized

**P0 — blocking, nothing else is trustworthy until these land**

| # | Item | Epic | Status |
|---|---|---|---|
| 1 | Migrate Supabase from Lovable Cloud to your own account (schema from git migrations, data + auth + storage migrated with row-count/ID verification) | Infra | **Deferred 2026-09-18** — started (new project not yet created; blocked on this agent sandbox's network policy, which cannot reach `api.supabase.com` or make raw-Postgres connections at all — not a credentials problem, an environment one). Explicitly deprioritized rather than abandoned: revisit when there's time for a session with real local/CI network access to drive it, per the local-Claude-Code-on-Mac path already scoped. |
| 2 | Add `SUPABASE_ACCESS_TOKEN` secret; confirm `deploy` job in CI actually deploys | Infra | **On hold** — this token is for a self-owned project; moot until item 1 happens. |
| 3 | Create dedicated CI test account, wire parity-check auth, get `parity-check.yml` green | Infra | **Done 2026-09-18** — closed #1. Took 3 real bug fixes along the way (`onboard-user`'s dead role-assignment guard, a hardcoded `gender: "Male"` constraint violation, a timer leak that made every completed engine call log a false timeout), plus two more found and fixed from the resulting clean signal (#15 UUID-constraint violation, #16 service-role credential detection) — both confirmed live post-deploy. `parity-check.yml` is now a required check on `main`. |
| 4 | Reconnect Lovable's Supabase connector to the new project (prevent a second silent split-brain) | Infra | **On hold** — meaningless until item 1 happens. |
| 5 | Fix guideline supersession bug (add precedence field, stop serving superseded guidance, stop fabricating `year` for null `publication_date`) | Deterministic Safety | **Mechanism done 2026-09-18** — #19, #21. Added `superseded_by` (`guideline_registry`, migration confirmed applied live) and a shared `keepCurrentGuidelinesOnly()` guard used by `guideline-compliance` and `retrieve-guidelines` across both `guideline_registry` and `clinical_guidelines`; removed the hardcoded `year: 2024` fallback. Checking live data surfaced something bigger than the original bug, tracked separately as **#22**: `clinical_guidelines` has 9 duplicate-content pairs, all artifacts of two bulk-ingestion passes 45 minutes apart on the same day (not real chronological editions) — recency is not a safe tiebreaker for these, confirmed actively wrong for at least one pair (the "newer"-labeled IDSA UTI row drops real FDA fluoroquinolone boxed-warning content the "older" one has). Deliberately NOT auto-resolved by this fix. #22 needs a person to review each pair's clinical content and decide/merge the canonical row — not further code. |
| 29 | Git does not reflect what's live: recover 12 commits Lovable's editor made that branch protection silently blocked from reaching `main` (3 security migrations, 2 regression tests, a schema-drift table) | Infra / Governance | **In progress 2026-10-02** — full root-cause record kept in private history. |

**P1 — do next, determines what everything after is built on**

| # | Item | Epic | Status |
|---|---|---|---|
| 6 | Run the controlled V1-vs-V3 comparison on the real O1 path, same 120 cases, retrieval-vs-ranking split by organ system | Reasoning Engine | **Done 2026-09-20** — full root-cause record kept in private history. |
| 7 | Decide: keep V3, revert to V1, or scope differential ranking down entirely — record the decision and why | Reasoning Engine | **Done 2026-09-20 — kept V3.** Full record kept in private history. |
| 8 | Kill the V2 shadow engine (pure waste regardless of the V1/V3 outcome) | Reasoning Engine | **Done 2026-09-20** — removed `engine_registry.ts`'s automatic fire-and-forget shadow run (`shadow_engine` config, the shadow branch in `runInference()`, `logShadowComparison()`) and the dead `SystemModeIndicator.tsx` display of it. Also removed genuinely-unused legacy V2-audit code found alongside it (`shouldUseV2`, `logV2Audit`, `getAuditBuffer` in `rollout_controller.ts` — defined, exported, never called anywhere). V2 itself (`ENGINE_REGISTRY.v2`, the "Latent-State" adapter and its edge function) is left in place and still explicitly selectable — only the automatic parallel invocation on every request is gone. |
| 9 | Consolidate the three fragmented safety-detection mechanisms into one auditable path | Deterministic Safety | **Done 2026-10-02 (draft PR, pending clinical sign-off on tiers/thresholds).** The three rule sets (`clinical-safety` emergency patterns + vitals bands; V4 `services/safety/analyzeSafety`; O1 `context_engine` `risk_flag_engine` + `context_aware_safety`) plus a fourth copy in `build-patient-context` are now adapters over one pure evaluator, `supabase/functions/_shared/must_not_miss.ts` (versioned rule set, evidence per trigger). Wired into item 23's loop: the finalize ledger entry records the rule-set version and which escalation rules fired. Fixed along the way: the cockpit finalize gate read pre-validation `safetyResults` (stale closure), the cockpit's safety check omitted `clinical_context` (so every validated finalize demanded an override for "missing" age/sex/chief complaint), and `clinical-safety`'s sepsis rule compared a °C value against °F thresholds (temperature criterion always met). Guarded by `must_not_miss_single_path.test.ts` (behavioral + structural). Not consolidated: DDX's DB-driven `dangerous_diagnoses` injection (diagnosis-level, and the channel the benchmark's "safety sensitivity" actually scores) and `global-safety-engine` (zero callers). |
| 10 | Explicitly define and test must-not-miss escalation as its own deterministic surface, decoupled from full differential accuracy | Deterministic Safety | **Done 2026-10-02 (same PR as item 9).** `must_not_miss.test.ts` runs the evaluator alone (no DDX/network): must-escalate and must-not-escalate cases per rule, determinism/no-mutation, °F/°C, monotonicity (more evidence never removes an escalation), canonical-vocabulary sync, and ratchet floors on the 120 benchmark-v10 cases — 55/90 safety-expected escalated, 24/30 non-safety not escalated, 19/30 adversarial (previously: cockpit gate 44/90, 25/30, 13/30; all legacy paths combined 50/90, 24/30, 15/30). |
| 23 | Make the conscience/override loop real: wire `ai-decision-ledger` (already built, zero callers) + `SafetyOverrideDialog` (already built, never rendered) into the live path, so every AI decision a doctor acts on is ledgered and every override requires acknowledgment + a logged reason, on top of the `safety_block`/`safety_override` gate `finalize-consultation` already enforces. Pull item 20 (Governance, P4) forward into this — it's the same work, don't build it twice. | Deterministic Safety / Governance | **First slice done 2026-09-20** — `Clinical.tsx`'s finalize flow now renders `SafetyOverrideDialog` (instead of relying on the generic review checkbox) whenever `safetyResults` contains a critical/blocking-severity alert, and records an `ai-decision-ledger` entry on every finalize via the new `buildFinalizeLedgerEntry()` (`src/services/oversight_engine/finalize_ledger.ts`) — `overridden`/`safety_override` with the logged reason when critical alerts exist, `accepted`/`safety_review` otherwise. `buildFinalizeLedgerEntry` throws (blocking finalize) if critical alerts exist with no ≥10-char reason — this is what makes the loop unbypassable from calling code, not just discouraged by the dialog; regression-tested in `finalize_ledger.test.ts` (9 cases). **Scope not yet covered, tracked as fast-follow:** this ledgers the finalize-time safety decision only, not every individual AI suggestion (e.g. per-diagnosis-candidate accept/reject) — "every AI decision" from the direction record is not fully met yet. Also not yet done: this only covers the O1/`Clinical.tsx` cockpit path — `ClinicalInteraction.tsx` (V4) has no equivalent gate yet. **Correction, 2026-10-02:** the sentence above originally called this "the item-24 pipeline-unification gap" — imprecise once item 24 landed. Item 24 fixed the diagnosis-*ranking* divergence only (V4 was reading raw DDX output instead of fusedBayesian); it explicitly deferred this safety-gate gap back here, and a separate audit this date found it's larger than a missing gate: `pipeline/index.ts` (V4) doesn't just lack the override dialog, it independently recomputes its own confidence/completeness/safety/authority (via `services/confidence`, `services/completeness`, `services/safety`, `services/authority` — not `layers/safety`) and freezes a **second, separate SSAL object**, rather than reading O1's own `engine_audit`-equivalent trusted output the way the fix for item 28 made the rest of the app do. Cross-checked with Lovable against stored data before treating this as urgent: confirmed display-only (no call from the page, `conversation_engine`, `pipeline/`, or `session_context` reaches prescriptions, lab orders, reports, or consultations), and confirmed **zero real-patient exposure** — all 19 stored consultations (11 patients) predate the V4 conversational module by over a month (consultations: 2026-02-22 to 2026-03-09; V4 conversational code: 2026-04-14), so no real divergence between the two SSALs has ever been recorded, for or against. This item's remaining scope is therefore two things, not one: (a) wire the override/ledger gate into `ClinicalInteraction.tsx`, and (b) make V4's pipeline stop recomputing safety/confidence/completeness/authority independently and instead consume O1's own values — both still open, not yet started. |
| 24 | Unify the O1 (`Clinical.tsx` cockpit) and V4 (`ClinicalInteraction.tsx` conversational) paths into one canonical pipeline producing a single SSAL, closing the authority rank-divergence gap found in the layers/services inventory | Reasoning Engine | **Root cause found and fixed 2026-09-20** — full root-cause record kept in private history. Not a rebuild: one function's field selection was wrong. |
| 25 | Real-world data: wire patient history into reasoning, so it isn't limited to one visit's transcript | Pre-Visit Brief / Reasoning Engine | **v1 done 2026-10-02 (cockpit path)** — wired existing patients/consultations data into orchestrator.ts via a new Wave 0b, additive/never-overwrites. External FHIR ingestion (v2) and conversational-path wiring are designed and scoped; full record kept in private history. |
| 26 | Delete confirmed-dead code from the architecture inventory (5 zero-importer service dirs, 5 zero-importer `src/layers/*` modules + the dead `layers/index.ts` aggregator, `validate-clinical-system` — a second, fully dead 1578-line diagnostic pipeline, `save-prescription`, `order-lab-tests`, `patient-explanation`). Note: `generate-prescription` and `generate-lab-orders` were originally miscategorized as dead in the first census pass below and are **not** to be deleted — see the private history for the correction note. | Hygiene | **Done 2026-10-02** — re-verified every named item fresh against current HEAD before deleting anything (not trusted from the 2026-09-20 census alone, since that census's own `clinical_reasoning` entry had already been proven wrong — see item 28). Confirmed `clinical_reasoning` is still live (`evidenceEngine.ts`'s `applyBayesianEvidence`, imported in `orchestrator.ts`) and excluded it; the actual deletion was 4 service dirs (`knowledge_extraction`, `knowledge_graph`, `learning_system`, `episodic_memory`), 5 `src/layers/*` modules + the aggregator, and all 4 named edge functions, confirmed zero-importer both before and after. Two stale doc-comment references to `patient-explanation` (in `layers/ai-agents/api.ts`, `layers/multilingual/api.ts`) updated to drop the mention. `tsc -b --noEmit` and `vitest run` both clean, identical results to before (19 files, 70 passed, 4 skipped). |
| 28 | Execute the V3 promotion items 6–8 decided but never actually rolled out: `rollout_controller.ts`'s `rollout_percentage` was still 10 (stuck since V2's canary, untouched by every later "fix" in this area), so ~90% of real doctor accounts were still served V1 while `SystemModeIndicator` displayed "V3" regardless of which engine actually ran | Reasoning Engine | **Done 2026-10-02** — full root-cause record kept in private history. |

## Sprint plan (2-week sprints)

### Sprint 0 — Foundation
**Goal:** own your infrastructure, close the CI loop, fix the cheapest real safety bug.
- Items 1–5.
- **Sprint review question:** can a real code change go from Claude Code → tested → deployed →
  live, with no Lovable step anywhere in that path?

### Sprint 1 — Reasoning Engine Resolution
**Goal:** stop investing in differential-ranking accuracy until you know it's worth it; make the
deterministic safety layer trustworthy.
- Items 6–10.
- **Sprint review question:** is the decision on V1/V3 written down with evidence, and does the
  must-not-miss layer have its own test coverage independent of overall diagnostic accuracy?

### Sprint 1.5 — Architecture Reconsideration
**Goal:** stop scaffolding new layers and make the conscience loop the system actually already has
on paper into something that actually runs, across the whole product, before building anything new.
- Items 23–26 (conscience loop, pipeline unification, real-world data ingestion, dead-code cleanup).
- **Sprint review question:** does every AI decision a doctor acts on in the live app get ledgered,
  does every override require acknowledgment and a logged reason, and is there a regression test
  that fails if a decision reaches the database without going through that gate?

### Sprint 2–3 — Pre-Visit Brief MVP
**Goal:** the actual product exists, in the narrow form already spec'd, using the LLM+retrieval
architecture the recent conversation settled on rather than hand-coded breadth.
- Items 11–14.
- **Sprint review question:** can you walk a rehearsed real-shaped case from patient narrative to
  a doctor-readable brief in under a minute, with every fact traceable to its source?

### Sprint 4 — Real Evaluation
**Goal:** every number you'd say out loud to a pilot clinic is defensible.
- Items 15–17.
- **Sprint review question:** does at least one accuracy or usefulness claim now rest on ground
  truth you didn't generate yourself?

### Sprint 5 — Pilot Governance
**Goal:** the non-engineering half of pilot-readiness exists as real documents, and clinics are
lined up.
- Items 18–22.
- **Sprint review question:** if a clinic said yes tomorrow, is there anything you'd still have to
  build before starting, or only paperwork to finish?

---

## What's deliberately not in this backlog

- Expanding V3's hand-coded state coverage for more organ systems — the architecture decision this
  session reached was to stop competing with frontier models on differential-diagnosis breadth.
  Don't let this quietly creep back in during Sprint 1 just because it's the familiar work.
- Multilingual support beyond the first language, until the single-language Pre-Visit Brief has
  been through the doctor test.
- Anything from the "what's not built" list in the original review brief that isn't in P0–P4 above
  (wearable ingest, episodic learning loop, multi-clinic scheduling) — explicitly deferred past
  pilot-ready, not forgotten.

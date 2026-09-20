# DATAelixAIr — Roadmap to Pilot-Ready
Drafted 2026-09-18, from the current forensic audit, benchmark remeasurement, and tonight's CI work.

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

**P1 — do next, determines what everything after is built on**

| # | Item | Epic | Status |
|---|---|---|---|
| 6 | Run the controlled V1-vs-V3 comparison on the real O1 path, same 120 cases, retrieval-vs-ranking split by organ system | Reasoning Engine | **Done 2026-09-20** — see decision record below. |
| 7 | Decide: keep V3, revert to V1, or scope differential ranking down entirely — record the decision and why | Reasoning Engine | **Done 2026-09-20 — kept V3.** See decision record below. |
| 8 | Kill the V2 shadow engine (pure waste regardless of the V1/V3 outcome) | Reasoning Engine | **Done 2026-09-20** — removed `engine_registry.ts`'s automatic fire-and-forget shadow run (`shadow_engine` config, the shadow branch in `runInference()`, `logShadowComparison()`) and the dead `SystemModeIndicator.tsx` display of it. Also removed genuinely-unused legacy V2-audit code found alongside it (`shouldUseV2`, `logV2Audit`, `getAuditBuffer` in `rollout_controller.ts` — defined, exported, never called anywhere). V2 itself (`ENGINE_REGISTRY.v2`, the "Latent-State" adapter and its edge function) is left in place and still explicitly selectable — only the automatic parallel invocation on every request is gone. |
| 9 | Consolidate the three fragmented safety-detection mechanisms into one auditable path | Deterministic Safety | Superseded by item 23 below — the ledger/override loop *is* the auditable path; build it once, wire consolidation into it rather than doing this separately. |
| 10 | Explicitly define and test must-not-miss escalation as its own deterministic surface, decoupled from full differential accuracy | Deterministic Safety | Still open, still next after item 23 — the item 7 run is the evidence: overall ranking accuracy and must-not-miss detection moved independently, so this needs its own surface and its own tests. |
| 23 | Make the conscience/override loop real: wire `ai-decision-ledger` (already built, zero callers) + `SafetyOverrideDialog` (already built, never rendered) into the live path, so every AI decision a doctor acts on is ledgered and every override requires acknowledgment + a logged reason, on top of the `safety_block`/`safety_override` gate `finalize-consultation` already enforces. Pull item 20 (Governance, P4) forward into this — it's the same work, don't build it twice. | Deterministic Safety / Governance | **First slice done 2026-09-20** — `Clinical.tsx`'s finalize flow now renders `SafetyOverrideDialog` (instead of relying on the generic review checkbox) whenever `safetyResults` contains a critical/blocking-severity alert, and records an `ai-decision-ledger` entry on every finalize via the new `buildFinalizeLedgerEntry()` (`src/services/oversight_engine/finalize_ledger.ts`) — `overridden`/`safety_override` with the logged reason when critical alerts exist, `accepted`/`safety_review` otherwise. `buildFinalizeLedgerEntry` throws (blocking finalize) if critical alerts exist with no ≥10-char reason — this is what makes the loop unbypassable from calling code, not just discouraged by the dialog; regression-tested in `finalize_ledger.test.ts` (9 cases). **Scope not yet covered, tracked as fast-follow:** this ledgers the finalize-time safety decision only, not every individual AI suggestion (e.g. per-diagnosis-candidate accept/reject) — "every AI decision" from the direction record is not fully met yet. Also not yet done: this only covers the O1/`Clinical.tsx` cockpit path — `ClinicalInteraction.tsx` (V4) has no equivalent gate yet, which is exactly the item-24 pipeline-unification gap. |
| 24 | Unify the O1 (`Clinical.tsx` cockpit) and V4 (`ClinicalInteraction.tsx` conversational) paths into one canonical pipeline producing a single SSAL, closing the authority rank-divergence gap found in the layers/services inventory | Reasoning Engine | Not started — sequenced after item 23 so the conscience loop covers the whole product, not half of it. |
| 25 | Real-world data: read-only FHIR ingestion (meds, labs, problem list, prior encounters) feeding `context_engine`/`kg`, so reasoning isn't limited to one visit's transcript | Pre-Visit Brief / Reasoning Engine | Not started — new item, see direction record below. |
| 26 | Delete confirmed-dead code from the architecture inventory (5 zero-importer service dirs, 5 zero-importer `src/layers/*` modules + the dead `layers/index.ts` aggregator, `validate-clinical-system` — a second, fully dead 1578-line diagnostic pipeline, `save-prescription`, `order-lab-tests`, `patient-explanation`). Note: `generate-prescription` and `generate-lab-orders` were originally miscategorized as dead in the first census pass below and are **not** to be deleted — see the correction note in the decision record. | Hygiene | Not started — low-risk cleanup, can run in parallel with 23–25. |

### Item 6/7 decision record — V1 vs V3, 2026-09-20

**Method.** 120 cases (50 noisy, 40 ambiguous, 30 adversarial/must-not-miss), real O1 production
path (`runUnifiedClinicalPipeline`, not a benchmark-only pipeline), via the benchmark v10 dashboard's
new V1-vs-V3 tool (`engine_force.ts` + `BenchmarkV10Panel.tsx`, added 2026-09-19 specifically for
this). Each engine forced deterministically (not left to the default rollout bucket, which sends
~90% of traffic to V1) and verified case-by-case against `PipelineResult.engine_audit.engine_version`
— not trusted from a requested label, per the benchmark_v9/v10 dead-mode-parameter incident earlier
the same day. Both runs' full 120-case exports were pulled via the new export mechanism
(`export.ts`) and re-derived independently from raw data, not read off the dashboard: integrity
confirmed 120/120 cases each run, zero cross-contamination (V1 run pure `v1`, V3 run pure `v3`).
Run IDs: V1 = `v10_phase10_1789845935226`, V3 = `v10_phase10_1789883670632`.

**Aggregate (V1 → V3):** Top-1 26%→38% (**+12pp**), Top-3 55%→63% (+8pp), Top-5 69%→74% (+5pp),
candidate recall 80%→82% (+2pp), safety sensitivity 87%→91% (+4pp), safety specificity 37%→37%
(0pp, unchanged by either engine), avg latency 32.1s→32.6s (+436ms).

**Organ system (all 13 systems, recomputed from full data):** V3 improved or held in 12 of 13 —
respiratory +31pp, gastrointestinal +22pp, renal +17pp, infectious +16pp, musculoskeletal +11pp,
cardiovascular/neurological +5pp, psychiatric +50pp (n=2). One regression: endocrine -12pp (n=8,
small sample, candidate recall actually improved 88%→100% — a ranking miss, not a recall miss).

**Case level:** 16 regressions (all rank-degradation by 1-2 positions, or top-1 lost to a still-#2
answer — only 2 of the 3 initially suspected were genuine near-misses: GI bleed→anemia, Dengue→
influenza; the third, Graves'→hyperthyroidism, is a defensible relabeling within the same
diagnosis) vs 44 improvements (many 0%→100% within-case top-1 gains, plus 3 cases where safety
detection was restored). **Zero case-level safety-correct regressions anywhere in the 120 cases** —
V3 never turns a correctly-flagged danger into a missed one.

**The one real caveat:** the adversarial (must-not-miss) layer's top-5 accuracy regressed -7pp
(67%→60%) despite a +3pp top-1 gain there, safety specificity stayed flat at 37% in *both* engines,
and adversarial-layer latency was +3.2s slower under V3. V3's aggregate win does not clearly reach
the safety-critical layer the way it reaches the general-accuracy layers.

**Decision: keep V3 as the active engine.** The win is broad (12/13 organ systems), holds up under
full-data verification (not just the dashboard's aggregate), and V1 offers no offsetting advantage
anywhere — it is worse or equal on every metric that was measured. This does **not** reopen
expanding V3's hand-coded state coverage (still off-limits, see "What's deliberately not in this
backlog" below) — it only affirms the already-built engine as production default, which is a
different decision from building more of it.

**Why this isn't the end of the reasoning-engine question:** this run is itself the evidence for
items 9 and 10. Overall ranking accuracy and must-not-miss detection moved independently of each
other — V3 won broadly on the former and was flat-to-worse on the latter's harder edges (top-5,
specificity, latency). A single blended accuracy number will keep hiding that split. Decouple the
safety-critical surface (item 10) rather than chasing further ranking-layer tuning to fix a
problem ranking tuning didn't cause.

**Context for items 6–8 — what "V4" actually is (verified against Lovable/live source 2026-09-19):**
V4 is not hypothetical and not fully shelved. An April 2026 audit (`.lovable/v3-v4-deep-audit.md`)
found ~45-60% of the orchestrator's code was dead weight and proposed a full pipeline rewrite
(`architecture/V4_ARCHITECTURE.md`). Part of it shipped the same month and is live in production
today: `/clinical-interaction` calls `runClinicalPipelineV4` (`src/services/pipeline/index.ts`),
which owns the conversational/canonical/session-context front half, then hands off to O1
(`runUnifiedClinicalPipeline`) via a thin, non-reasoning bridge (`orchestrator_bridge.ts`) for
actual scoring. `cognitive/v4_cognitive.ts` (`analyzeCognitive`) is also still called but its
output doesn't influence ranking — live but inert, not removed. V4's own scoring engine (state
generation + ranking) was never built. In July 2026, further V4 architecture work was formally
frozen (`architecture/ARCHITECTURE_FREEZE_v1.md`, `.lovable/execution-backlog-v1.md` —
"Architecture Freeze v1.0 ... No new architecture") in favor of consolidating the existing
V1/V2/V3 system; that freeze is still in effect, still enforced by the single-entrypoint and
engine-import-allowlist contract tests (strengthened, not relaxed, on 2026-09-18), and only one
post-freeze backlog item (A7, KG↔terminology binding) has been picked up since. No decision to
resume the V4 rewrite exists anywhere in git or chat history. Bottom line: the V1-vs-V3 comparison
below is a clean, self-contained decision — V4's structural contracts (canonical layer, single
entrypoint, SSAL) already landed; only the scoring-engine slot is still open, and it's V1 or V3
filling it, not V4. If V3 loses, the correct follow-on is scoping differential ranking down
(item 7's third option) — not reviving the V4 rewrite.

### Items 9/20/23-26 — architecture inventory and direction record, 2026-09-20

**Why this exists.** After item 8 landed, the question turned from "fix the next bug" to "step back
and reconsider the whole architecture" — prompted by how much had been built (layers, engines,
agents, workflows, wrappers, guardrails) relative to how much of it is actually load-bearing. A full
census was run across four trees: pages (57 routes), `src/services/*` (50 directories), Supabase
edge functions (124), and `src/layers/*` (14 modules), using import-graph grep matching (path-segment
patterns, not naive substring match — the first attempt undercounted and was discarded after it
showed `pipeline` and `safety` with zero importers despite known real usage).

**Findings.**
- **Services:** the real O1/V4 pipeline core is well-connected (`bayesian_engine`, `ddx_engine`,
  `hypothesis_engine`, `guideline_engine`, `context_engine`, `kg`, `evidence_planning`,
  `meta_reasoning`, `uncertainty_engine`, `physiology_engine`, `oversight_engine`, `multi_agent`,
  `pcie`, `reasoning_engine`, plus V4's `safety`/`confidence`/`completeness`/`cognitive`/`authority`/
  `question_engine`/`session_context`/`scribe_adapter`/`conversation_engine`/`canonical`). Five
  directories have zero importers anywhere: `clinical_reasoning`, `episodic_memory`,
  `knowledge_extraction`, `knowledge_graph`, `learning_system`.
- **Edge functions:** first-pass census found 45 of 124 never referenced from `src/` or other
  functions — but that pass only matched quoted-string invocations
  (`supabase.functions.invoke("name")`) and **missed every function called via a raw
  `fetch(`${supabaseUrl}/functions/v1/name`)` template literal**, which several edge-function-to-
  edge-function calls use. Caught and corrected before anything got deleted: `generate-prescription`
  and `generate-lab-orders` are **not** dead — `finalize-consultation` calls both as an AI-generation
  fallback (lines 89, 159) when the doctor hasn't explicitly specified drugs/labs, and
  `generate-prescription` in turn calls `normalize-drug-name` the same way. `clinical-knowledge`,
  `elevenlabs-tts`, and `google-tts` are also live, called the same way (from
  `compare-ai-pipelines` and `ClinicalInteraction.tsx` respectively). Re-running the census with a
  pattern covering both invocation styles brings the real zero-caller count to **39**: 1 false
  positive of the method (`_shared`, shared code not invoked by function name), 29 legitimate
  one-off/scheduled scripts correctly never called from client code (`expand-kg-batch*`,
  `expand-likelihoods-*`, `seed-knowledge-graph`, `seed-physiology-graph`, `rxnorm-ingest-*`,
  `terminology-load-chunk` and siblings, `kg-bindings-backfill`, `weekly-research-ingestion`,
  `batch-calibration` — confirmed via its own header as a scheduled function, `auth-email-hook` —
  confirmed as a Lovable auth webhook invoked by Supabase Auth config, not client code), 5 with
  unclear purpose and no scheduling markers (`air-quality`, `load-reasoning-context`,
  `normalize-medication`, `normalize-transcript`, `index-article`), and 4 genuinely dead,
  clinically-named functions: `save-prescription` and `order-lab-tests` (superseded by
  `Prescriptions.tsx` writing directly to the `prescriptions` table and by `Clinical.tsx` embedding
  `lab_orders` directly into the `finalize-consultation` payload — the *generate-* AI-fallback
  versions are live, the *save/order* direct-entry versions are not), and `patient-explanation` (no
  replacement found, but explicitly named as a planned integration point in
  `src/layers/ai-agents/api.ts` and `multilingual/api.ts`'s doc comments — described, never built).
  Largest single item, unaffected by the correction: **`validate-clinical-system`, 1578 lines,
  completely uncalled under both census passes** — a second full diagnostic pipeline (its own
  world-model construction, syndrome-cluster detection, SOAP generation, Bayesian/DDx scoring) built
  and never wired to anything.
- **`src/layers/`:** a documented "10-Layer Clinical AI Architecture" (`ARCHITECTURE.md`, 306 lines).
  `src/layers/index.ts`, the aggregator that's supposed to be its front door, **has zero importers
  anywhere** — every real caller imports individual submodules directly
  (`@/layers/safety/api`, `@/layers/workflow/api`, etc.), never the aggregator. Of the 13 submodules,
  5 are entirely dead, reachable only through that same dead aggregator: `communication/api.ts`
  (238 lines), `ethics/api.ts` (268 lines), `infrastructure/api.ts` (228 lines),
  `integration/api.ts` (336 lines), `intelligence/api.ts` (202 lines) — 1,272 lines implementing 5
  of the architecture's 10 named layers, none of it running.
- **The recurring pattern:** across this session and the V4/safety-consolidation work before it, the
  same shape keeps appearing — code built to spec, sometimes at real length, that never gets called
  from anything that runs (four dead safety modules found earlier: `guardrail_engine`,
  `oversight_engine`/`ai-decision-ledger`, `SafetyOverrideDialog`, `global-safety-engine`'s
  `runSafetyEngine` wrapper; now the layers aggregator, 5 layer submodules, and
  `validate-clinical-system`). This is a different shape from the four masking incidents in
  CLAUDE.md (which hide a *running* system's failure) — it's scope that was designed and written but
  never connected, consistent with breadth-first scaffolding (sketching the next architectural layer
  before the current one is load-bearing).

**Direction decided.** The stated product goal is an AI doctor with genuine reasoning depth *and* a
real conscience — auditable decisions, logged overrides, explainable recommendations — not just
differential-diagnosis accuracy. Cross-checked against the current clinical-AI landscape (Glass
Health's integrated encounter-workflow model, Microsoft Copilot Health/MAI-DxO's orchestrator
approach, OpenEvidence's reactive Q&A model) and FDA's 2026 Clinical Decision Support guidance (the
non-device exemption turns on whether a clinician can *independently evaluate the basis* for a
recommendation — explainability is a design constraint, not a later add-on). Also found: zero FHIR/
HL7 ingestion anywhere in the codebase — the only mention is an honestly-framed "FHIR-ready" line on
the public `/vision` page, not a live capability — meaning every diagnosis today reasons over one
visit's transcript with no access to the patient's actual longitudinal record, a real and growing
gap against where the field is moving.

Decided ordering (items 23–26 above): **conscience loop first** (item 23 — cheapest high-leverage
piece, everything it needs already exists as dead code, and it plausibly supports the FDA
explainability requirement) → **pipeline unification** (item 24 — so the conscience loop and every
future improvement covers the whole product, not just the cockpit half) → **real-world data** (item
25, parallelizable with 24) → **dead-code cleanup** (item 26, parallelizable with all of the above) →
**learning loop** (item 27, P4 — deferred until item 23 is producing real decision/outcome data to
learn from).

**P2 — the actual product**

| # | Item | Epic |
|---|---|---|
| 11 | Build the narrow, one-language Pre-Visit Brief demo (intake → extraction with provenance tags → missing-info follow-up → brief → doctor feedback) | Pre-Visit Brief |
| 12 | Replace the hand-coded synonym map with LLM+retrieval-based extraction for breadth | Pre-Visit Brief |
| 13 | Wire canonicalization to the real SNOMED terminology platform at runtime (closes the long-standing disclosed gap) | Pre-Visit Brief |
| 14 | Build real document/PDF ingestion (current stub is non-functional) | Pre-Visit Brief |

**P3 — makes any claim about the product defensible**

| # | Item | Epic |
|---|---|---|
| 15 | Source externally-provenanced or clinician-reviewed ground truth cases | Evaluation |
| 16 | Establish a held-out split for all future tuning | Evaluation |
| 17 | Run the doctor test — 5–10 doctors, 50 real cases, behavioral-checklist feedback | Evaluation |

**P4 — required before a real clinic touches this**

| # | Item | Epic |
|---|---|---|
| 18 | Clinical safety case | Governance |
| 19 | DPDP Act data-protection impact assessment | Governance |
| 20 | Clinician override logging | Governance — **pulled forward to P1 item 23, 2026-09-20.** Not duplicated; when 23 lands, this is done too. |
| 21 | Incident process | Governance |
| 22 | Identify and agree 2–3 pilot clinics | Governance |
| 27 | Learning loop: wire `learning_system`/`episodic_memory` (both currently dead, zero importers) to learn from the AI-decision-ledger's accept/reject/override history once item 23 is producing real data | Learning | Deferred — sequenced last, needs item 23's data to exist before there's anything to learn from. |

**Parallel lane — not sprint-blocking, ongoing**

| Item |
|---|
| Terminology-platform paper — near-submission-ready now, ship it early as a clean win |
| Governance/verification paper — write incrementally; already has two dated, real audit instances (March O1/O2 split, tonight's CI auth-fallback masking) as evidence |
| PhD supervisor/program research — hasn't been started; may surface a deadline that reprioritizes everything above |

---

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

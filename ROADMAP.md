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

**Current top priority, 2026-09-24: publish on arXiv.** The immediate goal is a decent, honest,
defensible paper — weight for a PhD application in AI health, not a comprehensive research program.
Engineering work (items 25–26) is paused, not abandoned — see "Publication priority" below for the
topic decision and outline.

---

## Publication priority (active, 2026-09-25)

**Why this jumps the queue.** A PhD application needs evidence of real research capability now, not
after the product is pilot-ready — that timeline doesn't fit an application cycle.

**Revised 2026-09-24→25** after weighing options against a live Supabase backup (accessed by a
separate session/agent this one can't reach) and validating every material claim through Lovable
before committing to a plan — see the decision record below. The original three engineering-session
candidates (terminology pipeline, verification-masking taxonomy, decoupled safety evaluation) are
superseded by two better-evidenced candidates found in the backup's actual usage/benchmark history.

### LEAD PAPER — Unrecorded metric provenance during active engine tuning

**Revised 2026-09-25 after a deliberate adversarial/blind re-check** — the 2026-09-25 "confirmed
mechanism" write-up below this line (in prior revisions) overstated the finding. Two AI-generated
accounts (mine and Lovable's) had converged on a dramatic, tidy explanation — weak evidence on its
own, since both are more likely to agree on an interesting story than a boring one, and the prompts
that produced it were leading. Re-checked via a blind prompt that withheld the prior conclusion and
asked Lovable to reconstruct events independently, actively look for a benign explanation, and
attack the claim rather than confirm it. Recorded here in full because the correction *is* the
finding — this is exactly the discipline gap the paper itself is about, caught in the act of writing
the paper about it.

**What's actually confirmed, narrower than before:**

On 2026-09-08, the benchmark dashboard's fast path (`runBenchmarkPipeline`, "O2") scored a candidate
list produced directly by the diagnosis-scoring engine — the exact component that day's tuning was
changing (five same-day notes: missing candidates, unused priors, prior compression, specificity
weighting; most measurements that day ran the engine directly, ~0.6s/case, and said so). That is a
defensible choice *for engine-tuning work* — the fast path measured the thing being changed. It
stops being defensible only once those numbers get reported as end-to-end product accuracy, because
the fast path's list is not the same as the final, post-processed list a doctor actually sees.
Nothing in `benchmark_suite_runs`/`benchmark_suite_results` recorded which list, or which underlying
engine (V1/V3), any given stored row actually scored — only a cosmetic `pipeline_mode` phase label,
identical across Sep 8/18/20 regardless of what ran underneath. Real per-case engine tracking only
started 2026-09-19.

**What's ruled out, checked rather than assumed:**
- **Speed as a motive or as forensic evidence** — tested twice, failed both times. The fast path
  wasn't measurably faster in practice (5.1–6.5s/case on Sep 8 vs. 5.3s on a warm confirmed-production
  run on Sep 18), so "hard-coded for speed" isn't even the right motive to attribute; and a
  latency-based attempt to tell O1/O2 apart post hoc failed (confirmed-O1 runs ranged 5.2s–32.6s,
  fully overlapping the Sep 8 range).
- **Code drift between Sep 8 and the Sep 18 remeasurement** — essentially none; the only changes to
  shared/engine code between the last Sep 8 run (09:29) and the first Sep 18 remeasurement (09:11)
  were to the benchmark runner itself.
- **Case-set instability or non-determinism** — zero; repeat runs on the same pipeline match
  case-for-case.
- **Deliberate concealment** — no evidence found. The relevant default (`executionMode: "benchmark"`)
  was set with no comment in the commit that introduced it (`5f1e00fc`, 2026-03-25); nothing suggests
  anyone knowingly chose it for this specific day's work.

**What does NOT hold up, corrected 2026-09-25:** the original "56% (benchmark) vs. 28% (production)"
headline comparison is not a clean before/after on the same instrument, and should not be presented
as one. Nobody ran real production on Sep 8, before or after tuning — there is no valid pre-tuning
production baseline at all. The Sep 18 "28%" remeasurement itself is contaminated: `engine_force.ts`
(deterministic engine pinning) wasn't added until 2026-09-19, so those runs went through the
probabilistic rollout, not a forced engine, and worked out (from routing each case's `visit_id`
under the then-live 10% rollout) to ~84% V1 / 16% V3 — V1 being the weaker engine later replaced by
V3 as production default. Pinned-engine runs confirm the effect directly: V1 alone scored 26%
(31/120), V3 alone 37.5% (45/120) — so the defensible comparator is 56% vs. 37.5%, not 56% vs. 28%,
and even that comparator conflates three effects that can't be cleanly separated with only 120 cases
and no held-out set: (1) which list got scored (the largest factor), (2) engine-mix contamination in
the comparator (~10 points), (3) tuning directly on the only cases available. A true isolating
experiment (re-running a pre-Sep-8 snapshot of the engine and data through production) isn't
cleanly reconstructable now.

**Corrected thesis:** *"The reported metric was read from a tuned internal candidate list, not the
list shown to the doctor, and nothing recorded which."* This is an unrecorded-metric-provenance /
eval-artifact-identity finding during active engine tuning — narrower than the original
"benchmark-to-production divergence" framing, but more defensible, and arguably a cleaner
contribution: it's closer to the industry-recognized *eval/serving mismatch* failure mode than to
classical dev-set overfitting, and it still ties to this project's other documented masking
incidents through the same root cause (no recorded provenance of what was actually measured), not
through the abandoned "hidden pipeline swap" framing.

**Related work to read and position against before writing** (literature check, 2026-09-24 — none
appear to cover this exact case, but all close enough to require explicit differentiation): Dwork et
al., *reusable holdout / adaptive data analysis*; *training-serving skew* / eval-serving mismatch
(the right applied term for the corrected thesis); *The Benchmark Lottery*; *The widening evaluation
gap in medical LLM research, 2023–2026* (arXiv 2609.11770); *GAPS* (clinically-grounded AI-clinician
benchmark).

**Scope discipline:** development-practice / evaluation-methodology paper. No claim about this
system's actual diagnostic accuracy or clinical safety — state that explicitly. The 120 cases are
internally-authored synthetic cases — irrelevant to this paper's claim but state it plainly anyway.
Do not resurrect the 56-vs-28 framing in the writing; use 56-vs-37.5 with the three-factor breakdown
if a "vs. production" number is needed at all, and lead with the provenance claim instead of a
before/after number wherever possible.

**Methodology note worth keeping in the paper itself:** the correction process above — two AI
systems converging on a dramatic explanation under leading prompts, then a deliberate blind
re-check narrowing it to something more defensible — is itself relevant supporting material for a
paper about unverified metrics, not just process trivia to omit.

**Not yet decided:** whether to release the run logs / flip-analysis / analysis script as an
artifact. Given the paper's subject is evaluation discipline, doing so is on-theme, not just
good practice — leaning yes.

### SECOND PAPER (shorter, scoped) — Multilingual symptom normalization for Indian primary care

**What it is.** Compares a lexicon, SNOMED trigram search, and an LLM on mapping Hindi/Telugu/
Urdu/code-mixed symptom phrases to SNOMED concepts. Live-validated seed data:
`symptom_language_map` (114 phrases: 92 English, 22 Hindi), `regional_lexicon` (105 entries: 44
Telugu, 38 English, 15 Hindi, 8 Urdu) — thin, a starting seed only. The real contribution is a new
double-annotated evaluation set.

**Scope, set deliberately small given a solo applicant and a PhD-application timeline:** ~500
double-annotated phrases is the realistic ceiling (Lovable's independent estimate: 40–80+
annotator-hours per language; my own estimate matched before asking), not 1,000. Start with Hindi +
Telugu (better seed coverage); Urdu and code-mixed registers are future work in the paper, not a
submission blocker.

**Novelty caveat, unresolved:** literature check (2026-09-24) found no direct prior work on this
exact question (SNOMED, not ICD-10; three-method comparison; Indian code-mixed languages
specifically), but found close adjacent work that must be read and cited before claiming novelty:
*IndiHealthBench*, *"Evaluating Ambient Clinical Scribes in India"* (arXiv, Sept 2026), *"Using LLMs
for Multilingual Clinical Entity Linking to ICD-10"* (arXiv 2509.04868). Do this reading before
committing further effort, not after a draft exists.

### DROPPED — Indian brand-to-generic drug normalization resource

Not a licensing problem (all three drug-ingestion functions pull from NLM's public RxNorm service,
no evidence of scraping a commercial source) — a **premise** problem. RxNorm is US-focused; the
actual India-specific brand table is only 305 rows. Live-validated: drug master 14,666 rows /
`rxnorm_id` filled on all of them, brand map 1,822 rows / `rxnorm_cui` filled on 1,750 — the "codes
mostly missing" concern that motivated dropping this a first time was itself wrong, but the resource
still isn't what an "Indian brand normalization" paper needs it to be. Not revisited unless the
India-specific brand coverage grows substantially.

### Still open, unrelated to the paper decision but flagged repeatedly and not yet actioned

Three RLS/access-control gaps from an automated security check, left open at an earlier explicit
choice to defer. Reassessed 2026-09-25 under the same adversarial/blind check used above (asked to
attack its own earlier "spoofable" framing, not just repeat it):
- Shared report + patient visit-status links: token-gated, closer to a private link than "anyone can
  fake it" — the original framing overstated it. Real residual risk depends on token entropy and
  expiry, which hasn't been checked yet. Worth a short hardening pass, not an active-leak fix.
- `physiological_states` readable by any signed-in user: 400 rows of reference definitions (state
  name, description, body system), no patient data — looks like a false alarm.
**Decision needed, not yet given:** confirm token entropy/expiry before treating the link issue as
low-risk, then go/no-go on the short hardening pass; dismiss the third pending that confirmation.

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
| 24 | Unify the O1 (`Clinical.tsx` cockpit) and V4 (`ClinicalInteraction.tsx` conversational) paths into one canonical pipeline producing a single SSAL, closing the authority rank-divergence gap found in the layers/services inventory | Reasoning Engine | **Root cause found and fixed 2026-09-20** — see decision record below. Not a rebuild: one function's field selection was wrong. |
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

### Item 24 decision record — pipeline unification root cause, 2026-09-20

**Context for this record.** Coming into this, the working theory (from the layers/services
inventory) was that the cockpit/conversational divergence was an architectural-fragmentation
problem — two independently-evolved ranking systems (O1's `clinical_priority_resolution.ts` vs
V4's `authority/resolveAuthority()`) that would need reconciling. Given this product has already
been through multiple prior architecture-rebuild and pipeline-finalization iterations that didn't
stick, that theory was investigated fully — read `authority/index.ts`, `pipeline/index.ts`,
`orchestrator_bridge.ts`, `clinical_priority_resolution.ts`, and `ssal_name_resolution.ts` in full —
before writing any code, specifically to avoid proposing another rebuild.

**What was actually found: a one-function bridge bug, not an architecture problem.**
`orchestrator_bridge.ts`'s `o1ResultToV4Reasoning()` — the mapping function that exists
specifically so V4 (`ClinicalInteraction.tsx`) reasons through O1 (`runUnifiedClinicalPipeline`)
instead of running a second pipeline ("No reasoning happens here — mapping only," per its own
header) — built `v3Diagnoses` (which feeds `resolveAuthority()`'s final ranking) from
`result.ddx.differential_diagnoses`: the raw, pre-fusion DDX candidate list. It should have used
`result.bayesian.diagnoses` (fusedBayesian) — O1's own actual final ranking, which
`orchestrator.ts` itself treats as canonical (its own SOAP generation comment: *"SSAL: Use
fusedBayesian (post-override) for SOAP diagnosis ranking"*) and which `Clinical.tsx` (cockpit)
already consumes correctly. fusedBayesian carries `clinical_priority_resolution.ts`'s must-not-miss
rank promotion, evidence-updated posteriors, and resolved `diagnosis_name`/`rank`
(`enrichBayesianWithNames`) — none of which the raw DDX list has. Reading the wrong field meant V4
silently re-derived a different ranking from an earlier, unprocessed stage of O1's own pipeline,
then ran its own separate (and simpler, text-match-based) safety promotion on top of that already-
wrong base. That's the entire root cause — not two architectures needing reconciliation, one
function reading the wrong property on a type it already had access to.

**Fix.** Changed `o1ResultToV4Reasoning()` to source `v3Diagnoses` from `result.bayesian.diagnoses`
(with a fallback to the DDX list only when `bayesian` is unavailable — mirroring O1's own
fusedBayesian-unavailable fallback pattern, not a second independent path). `ddxCandidates` (which
feeds V4's cognitive/completeness layers and genuinely needs the DDX shape —
`supporting_features`/`contradicting_features`/`category`, absent from `BayesianDiagnosis`) is
unchanged. Confirmed the fix actually reaches the UI: `ClinicalInteraction.tsx` renders
`result.ssal.diagnoses` directly (line 469), which is now built from the corrected `v3Diagnoses`.
Regression test (`orchestrator_bridge.test.ts`, 4 cases) constructs a case where DDX's raw order and
fusedBayesian's priority-resolved order disagree (a must-not-miss diagnosis promoted to rank 1) and
asserts the bridge reflects fusedBayesian's order, not DDX's — this is what would have caught the
original bug. Full suite green (18 files, 69 passed, 2 skipped pending live auth), `tsc -b --noEmit`
clean.

**What this does and doesn't close.** This makes both UIs reason from the same final ranking data —
the primary source of divergence. It does **not** touch `resolveAuthority()`'s own additional
safety-promotion step (V4-only, driven by V4's separate `analyzeSafety()` layer) — that's a smaller,
separate question of whether V4's safety layer is redundant with the `clinical-safety` edge function
`Clinical.tsx` calls directly, which is item 9's fragmented-safety-detection territory (deferred into
item 23, not reopened here). Not a rebuild, no new architecture, no files beyond the bridge and its
test touched — consistent with the Architecture Freeze v1.0 still in effect.

**Live verification, 2026-09-20.** Added `v4_bridge_live_parity.test.ts` (opt-in, same CI test user
and live-edge-function requirement as `benchmark_parity.test.ts`) and wired it into
`parity-check.yml` as a second step. Ran twice via `workflow_dispatch`: the first attempt was
cancelled prematurely — misread normal per-case pacing (`hybrid_reasoning` retries once after an
8s timeout, so each live case takes ~25-30s) as a hang after repeatedly checking the run-level
`updated_at` timestamp, which doesn't update during job execution; the job-level step log showed it
had actually been progressing correctly the whole time. Re-ran and let it finish: **both new
assertions passed against real, live pipeline output** — `o1ResultToV4Reasoning(realO1Result)
.v3Diagnoses matches realO1Result.bayesian.diagnoses order` (81.8s, 3 live cases) and
`runClinicalPipelineV4 runs end-to-end on real cases and produces a non-empty SSAL` (88.4s, 3 live
cases) — plus the pre-existing O1/O2 parity check, unaffected by this change, also passed. This is
real evidence the fix holds in production conditions, not just against the synthetic fixture in
`orchestrator_bridge.test.ts`.

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

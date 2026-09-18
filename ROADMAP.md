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

| # | Item | Epic |
|---|---|---|
| 6 | Run the controlled V1-vs-V3 comparison on the real O1 path, same 120 cases, retrieval-vs-ranking split by organ system | Reasoning Engine |
| 7 | Decide: keep V3, revert to V1, or scope differential ranking down entirely — record the decision and why | Reasoning Engine |
| 8 | Kill the V2 shadow engine (pure waste regardless of the V1/V3 outcome) | Reasoning Engine |
| 9 | Consolidate the three fragmented safety-detection mechanisms into one auditable path | Deterministic Safety |
| 10 | Explicitly define and test must-not-miss escalation as its own deterministic surface, decoupled from full differential accuracy | Deterministic Safety |

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
| 20 | Clinician override logging | Governance |
| 21 | Incident process | Governance |
| 22 | Identify and agree 2–3 pilot clinics | Governance |

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

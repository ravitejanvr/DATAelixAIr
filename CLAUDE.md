# DATAelixAIr — Project Memory

## Roadmap and current priorities
See `ROADMAP.md` for the full phased roadmap, sprint plan, and prioritized backlog. Check which
sprint is active before starting new work — don't infer priorities from what seems technically
interesting.

## Standing rules (apply to every session, not just the current task)

- **Every bug fix needs a regression test that would fail if the same class of mistake happened
  again.** A test that only checks the current symptom is not sufficient — see the
  `single_entrypoint.test.ts` history for why (it checked file naming for 5 months while a
  materially different pipeline ran undetected).
- **Any change to `orchestrator.ts`, `benchmark_mode.ts`, `runner.ts`, or anything in
  `supabase/functions/` should note in its PR description whether it could affect what
  `parity-check.yml` covers**, even if that check isn't required yet.
- **Do not expand V3's hand-coded diagnostic state coverage.** This was deliberately deprioritized
  — see `ROADMAP.md`, "What's deliberately not in this backlog." Breadth work belongs in LLM +
  retrieval extraction (Pre-Visit Brief), not in more hand-coded states.
- **Engine imports are allow-listed.** No module outside the existing allow-list may import
  `ddx_engine/client`, `bayesian_engine`, `engine_registry`, or `hypothesis_testing/client`
  directly. This exists specifically to prevent a third parallel pipeline from being written.
- **Never claim a check passed without having actually run it in an environment that can reach
  what it needs to reach.** If a network restriction, missing auth, or sandbox limitation means
  something couldn't really be verified, say that plainly rather than reporting a clean result.
- **Flag when something looks novel/publication-relevant.** Two dated incidents already exist
  where a component silently masked its own failure (the March 2026 O1/O2 benchmark split; the CI
  auth-fallback masking found 2026-09-18) — these are evidence for an active research direction.
  If a new instance of this pattern turns up, say so explicitly rather than just fixing it quietly.
- **Lovable's GitHub sync pushes directly to `main` with no PR.** Once branch protection is on,
  treat Lovable as read-only going forward — don't rely on it to make further code changes.

## Build and test
- `npm ci` (not `npm install` — the lockfile must stay exact)
- `npm run dev` for local UI preview
- `npx vitest run` for the full test suite
- `npx tsc --noEmit` for typecheck
- `RUN_PARITY_CHECK=1 npx vitest run src/tests/contract/benchmark_parity.test.ts` for the live O1/O2
  parity check — requires an authenticated Supabase session, not just the anon key; will fail
  cleanly with 401s otherwise, which is not a code problem.

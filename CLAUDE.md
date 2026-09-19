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
- **Flag when something looks novel/publication-relevant.** Four dated incidents now exist where a
  component silently masked its own failure (the March 2026 O1/O2 benchmark split; the CI
  auth-fallback masking found 2026-09-18; the benchmark_v9/benchmark_v10 dead `mode` parameter
  found 2026-09-19 — both runners' phase8/9/10 comparison accepted a mode argument, labeled results
  with it, and never forwarded it into the actual pipeline call after a 2026-03-25 refactor,
  producing plausible-looking "Phase 9 vs Phase 10" verdicts that compared identical configs for
  ~6 months; the bare `tsc --noEmit` no-op found the same day, immediately below) — these are
  evidence for an active research direction. If a new instance of this pattern turns up, say so
  explicitly rather than just fixing it quietly.
- **A config-driven comparison must assert actual divergence, not just distinct labels.** The
  benchmark_v9/v10 incident above passed every existing test (single-entrypoint, import-allowlist)
  because those check naming/import hygiene, not behavior — a refactor that keeps a parameter's
  name and its use as a display label, while quietly dropping what it was supposed to change, is
  invisible to that kind of test. Any comparison tool built to differentiate two configurations
  (engine versions, pipeline modes, feature-flag states) needs a test that captures the actual
  request payload/engine identifier under each configuration and fails if they're identical —
  not a test on what the code labels the run.
- **Lovable's GitHub sync pushes directly to `main` with no PR.** Once branch protection is on,
  treat Lovable as read-only going forward — don't rely on it to make further code changes.

## Build and test
- `npm ci` (not `npm install` — the lockfile must stay exact)
- `npm run dev` for local UI preview
- `npx vitest run` for the full test suite
- `npx tsc -b --noEmit` for typecheck — **not** bare `npx tsc --noEmit`. The root `tsconfig.json`
  has `"files": []` with project references (to `tsconfig.app.json`/`tsconfig.node.json`); run
  without `-b` or a `-p` pointing at one of those, `tsc --noEmit` silently checks zero files and
  exits 0 no matter what's broken. Found 2026-09-19 while it silently passed a real `src/` error
  (unrelated to that session's change) and an import of a just-deleted export — a fourth instance
  of the masking pattern below, this one baked into the project's own documented typecheck command.
- `RUN_PARITY_CHECK=1 npx vitest run src/tests/contract/benchmark_parity.test.ts` for the live O1/O2
  parity check — requires an authenticated Supabase session, not just the anon key; will fail
  cleanly with 401s otherwise, which is not a code problem.

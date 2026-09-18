#!/usr/bin/env node
/**
 * Provisions the dedicated test user for parity-check.yml's live O1/O2 test
 * — the account benchmark_parity.test.ts signs in as, so its edge-function
 * calls carry a real user JWT instead of just the anon key.
 *
 * SUPERSEDES an earlier Admin-API version of this script. Lovable Cloud does
 * not expose SUPABASE_SERVICE_ROLE_KEY at all (confirmed 2026-09-18 via
 * Lovable's own assistant: it's injected inside backend functions but never
 * surfaced to the project owner, dashboard, or API), which also rules out
 * the Management API / dashboard path for this project. So this uses the
 * one path that's actually available: a plain public signUp() with the anon
 * key (same as scripts/probe-signup-confirmation.mjs confirmed empirically:
 * this project requires email confirmation before a session is issued).
 *
 * That means TEST_EMAIL below MUST be a real, receivable inbox — not a
 * synthetic address — because after this script runs, a human has to open
 * the confirmation email and click the link once. After that one-time
 * step, the account is confirmed permanently and this script never needs
 * to run again for it (safe to re-run regardless: signUp() on an existing,
 * already-registered email is a no-op with a clear log line, not an error).
 *
 * Role/approval: a plain signup defaults to role="patient",
 * account_status="pending" (see supabase/functions/ensure-profile-role,
 * which intentionally blocks client-side role escalation). This script
 * does not attempt to change either — there is no available service-role
 * path to set user_roles.role while on Lovable Cloud. If the live parity
 * test turns out to need "approved" specifically, that's a one-time manual
 * step via the app's own admin UI (approve-user, run by an existing
 * platform_admin), not something this script can or should do.
 */

import { createClient } from "@supabase/supabase-js";

// Same project as .env's VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY.
// The anon key is a public, client-side key — safe to hardcode, not a secret.
const SUPABASE_URL = "https://mhqdqilzkqvbgtygtlab.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ocWRxaWx6a3F2Ymd0eWd0bGFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NTQ0ODcsImV4cCI6MjA4NzAzMDQ4N30.CflnCegdu0OthKuDNi7YOvvjQRAb6MGKI92Lo9U1eWc";

const TEST_EMAIL = "raviteja.ciparitytest@gmail.com";
const TEST_PASSWORD = process.env.PARITY_TEST_PASSWORD;

if (!TEST_PASSWORD) {
  console.error("Missing required env: PARITY_TEST_PASSWORD");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function main() {
  console.log(`signUp: ${TEST_EMAIL}`);
  const { data, error } = await supabase.auth.signUp({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    options: { data: { full_name: "CI Parity Test" } },
  });

  if (error) {
    throw error;
  }

  if (data.user?.identities?.length === 0) {
    console.log("Account already exists and is already confirmed — nothing to do.");
    return;
  }

  if (data.session) {
    console.log(`Account created and session issued immediately (id: ${data.user?.id}). No confirmation needed.`);
    return;
  }

  console.log(`Account created (id: ${data.user?.id}). Confirmation email sent to ${TEST_EMAIL}.`);
  console.log("ACTION NEEDED: open that inbox and click the confirmation link once — after that this account is usable indefinitely.");
}

main().catch((e) => {
  console.error("Provisioning failed:", e);
  process.exit(1);
});

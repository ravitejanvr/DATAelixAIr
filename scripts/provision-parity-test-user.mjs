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
 * Role: a plain signup gets NO row in user_roles at all — meta-orchestrator
 * (and presumably the other clinical edge functions) reject that with a 403
 * "Insufficient role" (confirmed empirically 2026-09-18, first live
 * parity-check.yml run: authenticated fine, 403'd on the actual pipeline
 * call). The one self-serve path to a real role is the same one every real
 * user goes through — supabase/functions/onboard-user, called with the
 * account's own session — which assigns role="doctor" server-side unless
 * the request's `email` field matches a hardcoded platform-admin allowlist.
 * This script always passes TEST_EMAIL for that field, so it can only ever
 * provision a plain "doctor" role, never platform_admin.
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

async function ensureRole(session) {
  const authed = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });

  const CLINICAL_ROLES = ["doctor", "nurse", "allied_health", "clinic_admin", "platform_admin"];

  const { data: existingRoles, error: roleQueryError } = await authed
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id);

  if (roleQueryError) {
    throw new Error(`Could not check existing role: ${roleQueryError.message}`);
  }

  const roles = existingRoles?.map((r) => r.role) ?? [];
  // Every signup gets a 'patient' row from the on_auth_user_created trigger
  // regardless of onboarding status — that alone doesn't mean this account
  // can call the clinical edge functions parity-check.yml needs. Only stop
  // here if it already holds one of the roles those functions actually
  // check for (see supabase/functions/meta-orchestrator/index.ts:492).
  if (roles.some((r) => CLINICAL_ROLES.includes(r))) {
    console.log(`Account already has a clinical role: ${roles.join(", ")} — nothing to do.`);
    return;
  }

  console.log(`Current role(s): ${roles.join(", ") || "(none)"} — calling onboard-user to add role=doctor.`);
  const { data, error } = await authed.functions.invoke("onboard-user", {
    body: { email: TEST_EMAIL, phone: "" },
  });

  if (error) {
    throw new Error(`onboard-user failed: ${error.message}`);
  }
  if (data?.error) {
    throw new Error(`onboard-user failed: ${data.error}`);
  }

  console.log(`onboard-user succeeded: role=${data?.role}, is_platform_admin=${data?.is_platform_admin}`);
}

async function main() {
  console.log(`signIn: ${TEST_EMAIL}`);
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (!signInError && signInData?.session) {
    console.log("Account already confirmed and sign-in works.");
    await ensureRole(signInData.session);
    return;
  }

  console.log(`signIn failed (${signInError?.message ?? "no session"}) — trying signUp instead.`);
  const { data, error } = await supabase.auth.signUp({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    options: { data: { full_name: "CI Parity Test" } },
  });

  if (error) {
    throw error;
  }

  if (data.user?.identities?.length === 0) {
    throw new Error(
      "Account exists and is already confirmed, but signInWithPassword still failed above — check TEST_PASSWORD matches PARITY_TEST_PASSWORD secret.",
    );
  }

  if (data.session) {
    console.log(`Account created and session issued immediately (id: ${data.user?.id}). No confirmation needed.`);
    await ensureRole(data.session);
    return;
  }

  console.log(`Account created (id: ${data.user?.id}). Confirmation email sent to ${TEST_EMAIL}.`);
  console.log("ACTION NEEDED: open that inbox and click the confirmation link once, then re-run this workflow to provision the role.");
}

main().catch((e) => {
  console.error("Provisioning failed:", e);
  process.exit(1);
});

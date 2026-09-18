#!/usr/bin/env node
/**
 * One-off diagnostic: does a plain public signUp() against this Supabase
 * project issue a session immediately, or does it require email confirmation
 * first? Determines whether the CI parity test account can be provisioned
 * with just the anon key (no service_role key, which Lovable Cloud does not
 * expose — see 2026-09-18 investigation) or whether some other path is needed.
 *
 * Uses a throwaway probe email each run — this account is never used again,
 * only its signUp() response is inspected.
 */

import { createClient } from "@supabase/supabase-js";

// Same values as .env (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY) —
// the anon key is a public, client-side key, safe to hardcode; not a secret.
const SUPABASE_URL = "https://mhqdqilzkqvbgtygtlab.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ocWRxaWx6a3F2Ymd0eWd0bGFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NTQ0ODcsImV4cCI6MjA4NzAzMDQ4N30.CflnCegdu0OthKuDNi7YOvvjQRAb6MGKI92Lo9U1eWc";

const supabase = createClient(SUPABASE_URL, ANON_KEY);

const probeEmail = `ci-parity-probe-${Date.now()}@dataelixair.internal`;
const probePassword = "Probe-Test-Password-123!";

console.log(`signUp probe: ${probeEmail}`);
const { data, error } = await supabase.auth.signUp({
  email: probeEmail,
  password: probePassword,
});

if (error) {
  console.log(`signUp error: ${error.message} (status ${error.status ?? "n/a"})`);
} else {
  console.log(`signUp succeeded. user id: ${data.user?.id}`);
  console.log(`session issued immediately: ${!!data.session}`);
  console.log(`identities length: ${data.user?.identities?.length}`);
}

if (data?.session) {
  console.log("\nCONCLUSION: email confirmation is OFF (or not required for session issuance) — a plain signUp() is enough to get a usable session.");
} else if (!error) {
  console.log("\nCONCLUSION: signUp succeeded but no session was issued — email confirmation is very likely required before sign-in will work.");
} else {
  console.log("\nCONCLUSION: signUp itself failed — see error above.");
}

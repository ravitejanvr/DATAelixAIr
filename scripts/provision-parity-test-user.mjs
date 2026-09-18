#!/usr/bin/env node
/**
 * Provisions (idempotently) a dedicated test user for parity-check.yml's live
 * O1/O2 test — the account benchmark_parity.test.ts signs in as, so its
 * edge-function calls carry a real user JWT instead of just the anon key.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (admin-only; never used outside this
 * script) and PARITY_TEST_PASSWORD as env vars. Uses the Admin API to create
 * the user pre-confirmed (email_confirm: true), sidestepping whatever email-
 * confirmation setting this project has, then elevates it directly — the
 * app's own client-side signup path intentionally cannot do this (see
 * supabase/functions/ensure-profile-role, which defaults every non-allowlisted
 * signup to role: "patient" and blocks client-side role escalation).
 *
 * Safe to re-run: existing user/role/profile rows are left as-is or updated
 * in place, never duplicated.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_PASSWORD = process.env.PARITY_TEST_PASSWORD;
const TEST_EMAIL = "ci-parity-test@dataelixair.internal";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !TEST_PASSWORD) {
  console.error(
    "Missing required env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PARITY_TEST_PASSWORD",
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findExistingUser(email) {
  // Admin listUsers doesn't filter by email server-side in all supabase-js
  // versions, so page through until found or exhausted.
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function main() {
  let user = await findExistingUser(TEST_EMAIL);

  if (user) {
    console.log(`User already exists: ${user.id}`);
    const { error: pwError } = await admin.auth.admin.updateUserById(user.id, {
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (pwError) throw pwError;
    console.log("Password reset to current PARITY_TEST_PASSWORD, email re-confirmed.");
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "CI Parity Test" },
    });
    if (error) throw error;
    user = data.user;
    console.log(`Created user: ${user.id}`);
  }

  // profiles row: the on_auth_user_created trigger already inserted a bare
  // row on user creation; upsert to set the fields that matter here.
  const { error: profileError } = await admin
    .from("profiles")
    .upsert(
      { user_id: user.id, full_name: "CI Parity Test", email: TEST_EMAIL, account_status: "approved" },
      { onConflict: "user_id" },
    );
  if (profileError) throw profileError;
  console.log("profiles.account_status = approved");

  const { data: existingRole } = await admin
    .from("user_roles")
    .select("id, role")
    .eq("user_id", user.id)
    .limit(1);

  if (!existingRole?.length) {
    const { error: roleError } = await admin.from("user_roles").insert({ user_id: user.id, role: "doctor" });
    if (roleError) throw roleError;
    console.log("user_roles.role = doctor (inserted)");
  } else if (existingRole[0].role !== "doctor") {
    const { error: roleError } = await admin
      .from("user_roles")
      .update({ role: "doctor" })
      .eq("user_id", user.id);
    if (roleError) throw roleError;
    console.log(`user_roles.role = doctor (updated from ${existingRole[0].role})`);
  } else {
    console.log("user_roles.role already doctor");
  }

  console.log(`\nDone. Test user: ${TEST_EMAIL} (${user.id}), role=doctor, status=approved.`);
}

main().catch((e) => {
  console.error("Provisioning failed:", e);
  process.exit(1);
});

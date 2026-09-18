/**
 * Regression test for #16: meta-orchestrator authenticates its call to
 * ddx-engine by sending SUPABASE_SERVICE_ROLE_KEY as the bearer token.
 * ddx-engine (and generate-physiological-context, and all three
 * calculate-diagnostic-probabilities variants) used to recognize a
 * service-role caller ONLY by decoding the token as a JWT and checking
 * payload.role === "service_role" — if the deployed service-role key isn't
 * JWT-shaped, decoding throws, is swallowed, and the caller is treated as
 * an ordinary (invalid) user token and rejected with 401. The calling
 * function then silently falls back to a degraded path (e.g.
 * meta-orchestrator falling back from ddx-engine to LLM-only DDX).
 *
 * All five edge functions now share this isServiceRoleToken() guard, which
 * checks direct equality against the deployed key first — reliable
 * regardless of key format — before falling back to the JWT-decode
 * heuristic. This test isn't a live edge-function test (no Deno/network
 * available here) — it exercises the exact guard all five import.
 */
import { describe, it, expect } from "vitest";
import { isServiceRoleToken } from "../../../supabase/functions/_shared/auth.ts";

describe("isServiceRoleToken guard shared by ddx-engine and friends", () => {
  it("recognizes the service-role key by direct equality even when it isn't JWT-shaped", () => {
    const nonJwtKey = "sb_secret_abcdefghijklmnopqrstuvwxyz0123456789";
    expect(isServiceRoleToken(nonJwtKey, nonJwtKey)).toBe(true);
  });

  it("still recognizes a legacy JWT-shaped service-role key via payload.role", () => {
    const payload = { role: "service_role", iss: "supabase" };
    const jwt = `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify(payload))}.signature`;
    // Deliberately different from the configured key, to isolate the JWT-decode fallback path.
    expect(isServiceRoleToken(jwt, "some-other-configured-service-role-key")).toBe(true);
  });

  it("rejects a real user JWT that isn't the service-role key", () => {
    const payload = { role: "authenticated", sub: "user-123" };
    const jwt = `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify(payload))}.signature`;
    expect(isServiceRoleToken(jwt, "the-configured-service-role-key")).toBe(false);
  });

  it("rejects garbage tokens without throwing", () => {
    expect(isServiceRoleToken("not-a-jwt-at-all", "the-configured-service-role-key")).toBe(false);
    expect(isServiceRoleToken("", "the-configured-service-role-key")).toBe(false);
  });
});

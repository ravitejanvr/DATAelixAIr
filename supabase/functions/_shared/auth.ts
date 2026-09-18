/**
 * True when `token` is this project's own service-role key — the trusted
 * signal used for inter-function calls (e.g. meta-orchestrator calling
 * ddx-engine, or the calculate-diagnostic-probabilities family). Checked
 * first by direct equality against the deployed SUPABASE_SERVICE_ROLE_KEY,
 * which works regardless of whether that key happens to be a legacy
 * JWT-shaped key or a newer non-JWT format.
 *
 * Falls back to decoding the token as a JWT and checking payload.role —
 * this used to be the ONLY check, and silently stopped recognizing the
 * service role whenever the deployed key wasn't JWT-shaped: decoding threw,
 * was swallowed, isServiceRole stayed false, the caller fell through to
 * auth.getUser(token), which rejects a service-role secret as an invalid
 * user session, and the calling function silently fell back to a degraded
 * path (e.g. meta-orchestrator falling back from ddx-engine to LLM DDX).
 * Kept as a fallback only for any caller that might still send a
 * differently-issued service JWT rather than the raw key itself.
 */
export function isServiceRoleToken(token: string, serviceRoleKey: string): boolean {
  if (token === serviceRoleKey) return true;
  try {
    const payloadB64 = token.split(".")[1];
    if (payloadB64) {
      const payload = JSON.parse(atob(payloadB64));
      return payload.role === "service_role";
    }
  } catch {
    // not a valid JWT
  }
  return false;
}

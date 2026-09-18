const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True only for real RFC-4122-shaped UUID strings — deliberately rejects
 * synthetic placeholder IDs like "fallback-0-myocardial-infarction" or
 * "hint-context_signal-pneumothorax" that DDX fallback paths can attach to
 * a candidate diagnosis when it never resolved to a real diagnoses.id.
 */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

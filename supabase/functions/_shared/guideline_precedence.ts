export interface PrecedenceCandidate {
  organization?: string | null;
  source_organization?: string | null;
  condition?: string | null;
  superseded_by?: string | null;
  publication_date?: string | null;
}

/**
 * Collapses guideline rows down to at most one per (organization,
 * condition) pair — the most current, non-superseded version — before any
 * tier/priority sorting happens. Without this, two active rows for the
 * same organization's guidance on the same condition (e.g. an old and a
 * new published version, neither explicitly deactivated) would both reach
 * the caller, and whichever one Postgres happened to return first — not
 * necessarily the current one — would win any "take the first match"
 * selection downstream.
 *
 * Excludes rows explicitly marked superseded_by another row first, then,
 * among what's left, prefers the latest publication_date as a tiebreaker
 * for versions that haven't been explicitly linked via superseded_by yet.
 */
export function keepCurrentGuidelinesOnly<T extends PrecedenceCandidate>(guidelines: T[]): T[] {
  const notSuperseded = guidelines.filter((g) => !g.superseded_by);
  const byGroup = new Map<string, T>();

  for (const g of notSuperseded) {
    const org = (g.organization ?? g.source_organization ?? "").toLowerCase().trim();
    const condition = (g.condition ?? "").toLowerCase().trim();
    const key = `${org}|${condition}`;

    const existing = byGroup.get(key);
    if (!existing) {
      byGroup.set(key, g);
      continue;
    }

    const existingTime = existing.publication_date ? new Date(existing.publication_date).getTime() : -Infinity;
    const candidateTime = g.publication_date ? new Date(g.publication_date).getTime() : -Infinity;
    if (candidateTime > existingTime) {
      byGroup.set(key, g);
    }
  }

  return Array.from(byGroup.values());
}

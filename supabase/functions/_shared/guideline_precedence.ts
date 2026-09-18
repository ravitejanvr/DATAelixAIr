export interface PrecedenceCandidate {
  organization?: string | null;
  source_organization?: string | null;
  condition?: string | null;
  superseded_by?: string | null;
  /** guideline_registry's real publication date, when present. */
  publication_date?: string | null;
  /** clinical_guidelines has no publication_date — falls back to its
   *  (always-populated) year column for recency comparison instead. */
  year?: number | null;
}

/**
 * Collapses guideline rows down to at most one per (organization,
 * condition) pair — the most current, non-superseded version — before any
 * tier/priority sorting happens. Without this, two active rows for the
 * same organization's guidance on the same condition (e.g. an old and a
 * new published version, neither explicitly deactivated) would both reach
 * the caller, and whichever one Postgres happened to return first — not
 * necessarily the current one — would win any "take the first match"
 * selection downstream. Confirmed live in clinical_guidelines: ATA 2014 vs
 * ATA 2023 (hypothyroidism), IDSA 2018 vs IDSA 2023 (UTI), WHO 2023 vs WHO
 * 2024 (malaria) all coexisted as separate active rows.
 *
 * Excludes rows explicitly marked superseded_by another row first, then,
 * among what's left, prefers the most recent by publication_date (or, when
 * that's absent, by year) as a tiebreaker for versions that haven't been
 * explicitly linked via superseded_by yet. When neither publication_date
 * nor year can order two same-key rows (e.g. genuine same-year content
 * duplicates), the first one encountered is kept — that's a data problem
 * (duplicate ingestion, not a real supersession) this function can't and
 * shouldn't silently resolve; it needs a deliberate pick-one decision.
 */
export function keepCurrentGuidelinesOnly<T extends PrecedenceCandidate>(guidelines: T[]): T[] {
  const notSuperseded = guidelines.filter((g) => !g.superseded_by);
  const byGroup = new Map<string, T>();

  const recency = (g: PrecedenceCandidate): number => {
    if (g.publication_date) return new Date(g.publication_date).getTime();
    if (g.year) return g.year;
    return -Infinity;
  };

  for (const g of notSuperseded) {
    const org = (g.organization ?? g.source_organization ?? "").toLowerCase().trim();
    const condition = (g.condition ?? "").toLowerCase().trim();
    const key = `${org}|${condition}`;

    const existing = byGroup.get(key);
    if (!existing) {
      byGroup.set(key, g);
      continue;
    }

    if (recency(g) > recency(existing)) {
      byGroup.set(key, g);
    }
  }

  return Array.from(byGroup.values());
}

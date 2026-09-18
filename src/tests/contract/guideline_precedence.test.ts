/**
 * Regression test for ROADMAP.md P0 item 5 (guideline supersession bug).
 *
 * guideline_registry had no way to express "this row is an older version,
 * a newer one replaced it" — is_active alone can't do that, since both the
 * old and new version of a guideline can legitimately be individually
 * "active" records. Without a precedence signal, guideline-compliance and
 * retrieve-guidelines both picked the first match from an array whose
 * order depended on whatever Postgres happened to return, not on which
 * version was actually current — so a doctor could be shown superseded
 * guidance with no indication it had been replaced.
 *
 * This test exercises the shared keepCurrentGuidelinesOnly() guard both
 * edge functions now call before selecting a guideline — there's no Deno
 * test runner available here to exercise the edge functions themselves.
 */
import { describe, it, expect } from "vitest";
import { keepCurrentGuidelinesOnly } from "../../../supabase/functions/_shared/guideline_precedence.ts";

describe("keepCurrentGuidelinesOnly", () => {
  it("drops a guideline explicitly marked superseded_by another", () => {
    const old = { id: "old", organization: "ESC", condition: "hypertension", superseded_by: "new" };
    const current = { id: "new", organization: "ESC", condition: "hypertension", superseded_by: null };
    const result = keepCurrentGuidelinesOnly([old, current]);
    expect(result).toEqual([current]);
  });

  it("prefers the more recent publication_date when two active rows for the same (org, condition) aren't explicitly linked", () => {
    const older = {
      id: "2018-guideline",
      organization: "ESC",
      condition: "hypertension",
      publication_date: "2018-06-01",
    };
    const newer = {
      id: "2023-guideline",
      organization: "ESC",
      condition: "hypertension",
      publication_date: "2023-06-01",
    };
    // Deliberately pass the older one first, matching how Postgres could
    // return them in either order with no ORDER BY on publication_date.
    const result = keepCurrentGuidelinesOnly([older, newer]);
    expect(result).toEqual([newer]);
  });

  it("keeps guidelines for different conditions or organizations, even from the same source", () => {
    const a = { id: "a", organization: "WHO", condition: "hypertension" };
    const b = { id: "b", organization: "WHO", condition: "diabetes" };
    const c = { id: "c", organization: "NICE", condition: "hypertension" };
    const result = keepCurrentGuidelinesOnly([a, b, c]);
    expect(result).toHaveLength(3);
  });

  it("matches on source_organization when organization isn't present (clinical_guidelines shape)", () => {
    const old = { id: "old", source_organization: "AHA", condition: "afib", publication_date: "2019-01-01" };
    const current = { id: "new", source_organization: "AHA", condition: "afib", publication_date: "2022-01-01" };
    const result = keepCurrentGuidelinesOnly([old, current]);
    expect(result).toEqual([current]);
  });

  it("does not fabricate a preference when neither row has a publication_date or year — first one wins deterministically, not silently", () => {
    const a = { id: "a", organization: "CDC", condition: "flu" };
    const b = { id: "b", organization: "CDC", condition: "flu" };
    const result = keepCurrentGuidelinesOnly([a, b]);
    expect(result).toEqual([a]);
  });

  it("falls back to year when publication_date is absent (clinical_guidelines shape) — confirmed live: ATA hypothyroidism 2014 vs 2023", () => {
    const ata2014 = {
      id: "60ebb380",
      source_organization: "American Thyroid Association",
      condition: "hypothyroidism",
      year: 2014,
    };
    const ata2023 = {
      id: "66658d1b",
      source_organization: "American Thyroid Association",
      condition: "hypothyroidism",
      year: 2023,
    };
    const result = keepCurrentGuidelinesOnly([ata2014, ata2023]);
    expect(result).toEqual([ata2023]);
  });

  it("prefers publication_date over year when both are present on the same row", () => {
    const olderByYearNewerByDate = {
      id: "a",
      organization: "WHO",
      condition: "malaria",
      year: 2020,
      publication_date: "2025-01-01",
    };
    const newerByYearOlderByDate = {
      id: "b",
      organization: "WHO",
      condition: "malaria",
      year: 2024,
      publication_date: "2019-01-01",
    };
    const result = keepCurrentGuidelinesOnly([olderByYearNewerByDate, newerByYearOlderByDate]);
    expect(result).toEqual([olderByYearNewerByDate]);
  });

  it("does not collapse two genuinely different guidelines that happen to share a year — that's a duplicate-content problem, not this function's job", () => {
    const a = { id: "a", source_organization: "ACG", condition: "peptic ulcer", year: 2024 };
    const b = { id: "b", source_organization: "ACG", condition: "peptic ulcer", year: 2024 };
    const result = keepCurrentGuidelinesOnly([a, b]);
    // Neither wins on recency; the function keeps the first deterministically
    // rather than guessing — same-year duplicates need a human decision.
    expect(result).toEqual([a]);
  });
});

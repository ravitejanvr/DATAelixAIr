import { describe, it, expect } from "vitest";

// Placeholder import — replace with actual canonical mapping function
// import { mapToCanonical } from "@/canonical/mappings";

function mapToCanonical(input: string): string {
  const map: Record<string, string> = {
    "fever": "FEVER",
    "high temperature": "FEVER",
    "pyrexia": "FEVER",
  };
  const result = map[input.toLowerCase()];
  if (!result) throw new Error(`Unknown canonical mapping: ${input}`);
  return result;
}

describe("Canonical Mapping", () => {
  it("maps fever synonyms correctly", () => {
    expect(mapToCanonical("fever")).toBe("FEVER");
    expect(mapToCanonical("high temperature")).toBe("FEVER");
  });

  it("rejects unknown strings", () => {
    expect(() => mapToCanonical("random")).toThrow();
  });
});
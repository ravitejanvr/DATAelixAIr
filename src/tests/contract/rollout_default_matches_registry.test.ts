/**
 * Contract Test — Default rollout actually serves the registry's declared engine
 *
 * WHY THIS EXISTS
 * ----------------
 * rollout_controller.ts's DEFAULT_ROLLOUT.rollout_percentage sat at 10 (left over
 * from V2's staged canary) through several passes that updated engine_registry.ts's
 * `active_engine` and the comments around the rollout file, but never the one number
 * that gates real traffic. ~90% of non-admin doctors were bucketed onto V1 while
 * engine_registry said V3 and the UI badge said V3 (ROADMAP item 28).
 *
 * The class of mistake: the *declared* default engine and the engine real users are
 * *actually routed to* drift apart. So this test does not check the percentage
 * constant — it runs selectEngine() for many ordinary (non-admin, non-internal,
 * non-forced) identities under the shipped default config and asserts every one of
 * them lands on getEngineConfig().active_engine.
 *
 * If a staged rollout is ever deliberately reintroduced, this test should be updated
 * in the same change, stating the intended split — not silently relaxed.
 */

import { describe, it, expect } from "vitest";
import { getEngineConfig } from "@/services/engine_registry";
import { getRolloutConfig, selectEngine } from "@/services/rollout_controller";

describe("Contract: default rollout routes ordinary users to the registry's active engine", () => {
  it("every bucketed non-admin identity gets active_engine under the shipped default config", () => {
    const declared = getEngineConfig().active_engine;
    expect(getRolloutConfig().enabled).toBe(true);

    const identities = Array.from({ length: 500 }, (_, i) => `doctor-${i}-${(i * 7919) % 104729}`);
    const buckets = new Set<number>();
    const offenders: string[] = [];

    for (const userId of identities) {
      const decision = selectEngine({ userId });
      buckets.add(decision.bucket);
      if (decision.engine_selected !== declared) {
        offenders.push(`${userId} (bucket ${decision.bucket}) -> ${decision.engine_selected}`);
      }
    }

    // Guard the guard: the sample must actually span the bucket space, or a
    // partial rollout could slip through on an unlucky sample.
    expect(buckets.size).toBeGreaterThan(90);
    expect(offenders, `Declared active engine is ${declared}, but ordinary users were routed elsewhere:\n${offenders.slice(0, 10).join("\n")}`).toEqual([]);
  });

  it("session-only (signed-out) callers also get active_engine", () => {
    const declared = getEngineConfig().active_engine;
    for (let i = 0; i < 200; i++) {
      expect(selectEngine({ sessionId: `session-${i}` }).engine_selected).toBe(declared);
    }
  });
});

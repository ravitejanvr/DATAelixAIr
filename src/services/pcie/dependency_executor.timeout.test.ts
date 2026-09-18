/**
 * Same timer-leak class of bug as orchestrator.ts / benchmark_mode.ts's
 * withTimeout (found 2026-09-18): withModuleTimeout's setTimeout was never
 * cleared once factory() won the race, leaving a dangling timer that later
 * rejects — an unhandled rejection risk, not just log noise, since nothing
 * awaits that timeout promise once the race has already settled.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withModuleTimeout } from "./dependency_executor";

describe("dependency_executor withModuleTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("clears its timer once the factory resolves, leaving nothing to reject later", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);

    try {
      const result = await withModuleTimeout(() => Promise.resolve("done"), 5000, "some_module");
      expect(result).toBe("done");

      // The leaked timer's rejection would surface here if uncleared.
      await vi.advanceTimersByTimeAsync(5000);
      await Promise.resolve();

      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it("still rejects on a genuine timeout", async () => {
    const neverResolves = () => new Promise<string>(() => {});

    const resultPromise = withModuleTimeout(neverResolves, 5000, "slow_module");
    const assertion = expect(resultPromise).rejects.toThrow("slow_module timed out after 5000ms");
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
  });
});

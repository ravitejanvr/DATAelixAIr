/**
 * Same timer-leak regression as orchestrator.timeout.test.ts — benchmark_mode.ts
 * had its own copy of the identical bug in its own withTimeout.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withTimeout } from "./benchmark_mode";

describe("benchmark_mode withTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not log a timeout warning after the promise already resolved", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const resultPromise = withTimeout(Promise.resolve("done"), 3000, "hypothesis_testing");
    await vi.advanceTimersByTimeAsync(0);
    const result = await resultPromise;

    await vi.advanceTimersByTimeAsync(3000);

    expect(result).toBe("done");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("still resolves null and logs a warning on a genuine timeout", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const neverResolves = new Promise<string>(() => {});

    const resultPromise = withTimeout(neverResolves, 3000, "ddx_engine");
    await vi.advanceTimersByTimeAsync(3000);
    const result = await resultPromise;

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("ddx_engine timed out after 3000ms"));
  });
});

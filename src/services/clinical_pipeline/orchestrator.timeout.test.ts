/**
 * Regression test for a timer leak found 2026-09-18: `withTimeout`'s
 * setTimeout was never cleared once the wrapped promise won the race, so
 * every completed call still logged a misleading "timed out after Xms"
 * warning several seconds later — indistinguishable from a real timeout in
 * the logs. This made a live parity-check.yml run look like every engine
 * was falling back when most had actually completed fine.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withTimeout } from "./orchestrator";

describe("orchestrator withTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not log a timeout warning after the promise already resolved", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const resultPromise = withTimeout(Promise.resolve("done"), 5000, "some_engine");
    await vi.advanceTimersByTimeAsync(0);
    const result = await resultPromise;

    // The leaked timer would fire here if it were never cleared.
    await vi.advanceTimersByTimeAsync(5000);

    expect(result).toBe("done");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("still resolves null and logs a warning on a genuine timeout", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const neverResolves = new Promise<string>(() => {});

    const resultPromise = withTimeout(neverResolves, 5000, "slow_engine");
    await vi.advanceTimersByTimeAsync(5000);
    const result = await resultPromise;

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("slow_engine timed out after 5000ms"));
  });
});

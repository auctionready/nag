import { describe, it, expect } from "vitest";
import { makeSingleflight } from "../singleflight";

/** Creates a promise you can resolve from the outside — useful for tests. */
const deferred = <T>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

describe("makeSingleflight", () => {
  it("coalesces concurrent calls: same promise returned while in-flight", async () => {
    const d = deferred<number>();
    let calls = 0;
    const wrapped = makeSingleflight(() => {
      calls++;
      return d.promise;
    });

    const p1 = wrapped();
    const p2 = wrapped();
    const p3 = wrapped();
    expect(calls).toBe(1);

    d.resolve(1);
    await Promise.all([p1, p2, p3]);
    // Triggers that arrive mid-flight cause exactly one follow-up run.
    // The follow-up has no deferred to block on, so we wait a tick.
    await new Promise((r) => setTimeout(r, 10));
    expect(calls).toBe(2);
  });

  it("a single call produces a single run", async () => {
    let calls = 0;
    const wrapped = makeSingleflight(async () => {
      calls++;
    });
    await wrapped();
    expect(calls).toBe(1);
  });

  it("sequential calls (no overlap) each produce their own run", async () => {
    let calls = 0;
    const wrapped = makeSingleflight(async () => {
      calls++;
    });
    await wrapped();
    await wrapped();
    await wrapped();
    expect(calls).toBe(3);
  });

  it("multiple triggers during in-flight produce exactly one follow-up run (not N)", async () => {
    const d1 = deferred<void>();
    const d2 = deferred<void>();
    let calls = 0;
    const deferreds = [d1, d2];
    const wrapped = makeSingleflight(() => {
      const d = deferreds[calls];
      calls++;
      return d?.promise ?? Promise.resolve();
    });

    const first = wrapped();
    // 5 triggers arrive during the first run.
    wrapped();
    wrapped();
    wrapped();
    wrapped();
    wrapped();
    expect(calls).toBe(1);

    d1.resolve();
    await first;
    await new Promise((r) => setTimeout(r, 0));
    // Follow-up fired exactly once.
    expect(calls).toBe(2);

    d2.resolve();
    await new Promise((r) => setTimeout(r, 0));
    // And no more runs were queued.
    expect(calls).toBe(2);
  });

  it("releases the in-flight slot after a rejection", async () => {
    let calls = 0;
    const wrapped = makeSingleflight(async () => {
      calls++;
      throw new Error("boom");
    });
    await expect(wrapped()).rejects.toThrow("boom");
    await expect(wrapped()).rejects.toThrow("boom");
    expect(calls).toBe(2);
  });
});

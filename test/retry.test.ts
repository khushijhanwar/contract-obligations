import { describe, it, expect } from "vitest";
import { withRetry } from "../src/extraction/retry.js";

const err = (status: number) => Object.assign(new Error("fail"), { status });

describe("withRetry", () => {
  it("retries a 429 and then succeeds, waiting longer each time", async () => {
    let calls = 0;
    const waits: number[] = [];
    const r = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw err(429);
        return "ok";
      },
      { baseMs: 100, sleep: async (ms) => void waits.push(ms) },
    );
    expect(r).toBe("ok");
    expect(calls).toBe(3);
    expect(waits).toEqual([100, 200]);
  });
  it("does not retry a 400", async () => {
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls++;
        throw err(400);
      }, { sleep: async () => {} }),
    ).rejects.toThrow();
    expect(calls).toBe(1);
  });
  it("gives up after the last try", async () => {
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls++;
        throw err(503);
      }, { tries: 2, sleep: async () => {} }),
    ).rejects.toThrow();
    expect(calls).toBe(2);
  });
});

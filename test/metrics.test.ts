import { describe, it, expect } from "vitest";
import { iou, bestIou, prf } from "../src/eval/metrics.js";

describe("metrics", () => {
  it("iou is 1 for identical spans and 0 for disjoint spans", () => {
    expect(iou({ start: 0, end: 10 }, { start: 0, end: 10 })).toBe(1);
    expect(iou({ start: 0, end: 10 }, { start: 20, end: 30 })).toBe(0);
  });
  it("iou of half-overlapping spans", () => {
    expect(iou({ start: 0, end: 10 }, { start: 5, end: 15 })).toBeCloseTo(5 / 15);
  });
  it("bestIou picks the closest expert span", () => {
    expect(bestIou({ start: 0, end: 10 }, [{ start: 50, end: 60 }, { start: 0, end: 10 }])).toBe(1);
    expect(bestIou({ start: 0, end: 10 }, [])).toBe(0);
  });
  it("prf computes precision, recall and F1", () => {
    const r = prf({ tp: 8, fp: 2, fn: 2 });
    expect(r.precision).toBeCloseTo(0.8);
    expect(r.recall).toBeCloseTo(0.8);
    expect(r.f1).toBeCloseTo(0.8);
  });
  it("prf handles zero counts", () => {
    expect(prf({ tp: 0, fp: 0, fn: 0 }).f1).toBe(0);
  });
});

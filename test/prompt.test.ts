import { describe, it, expect } from "vitest";
import { buildPrompt } from "../src/extraction/prompt.js";

describe("buildPrompt", () => {
  it("v2 and v3 differ only in the notice period line", () => {
    const a = buildPrompt("x", "v2").split("\n");
    const b = buildPrompt("x", "v3").split("\n");
    expect(a.length).toBe(b.length);
    const diff = a.filter((line, i) => line !== b[i]);
    expect(diff).toHaveLength(1);
    expect(diff[0]).toContain("notice_period");
  });
  it("throws on an unknown version", () => {
    expect(() => buildPrompt("x", "v99")).toThrow();
  });
});

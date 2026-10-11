import { describe, it, expect } from "vitest";
import { ruleBasedFields } from "../src/extraction/fallback.js";

const get = (text: string, name: string) => ruleBasedFields(text).find((f) => f.fieldName === name);

describe("ruleBasedFields", () => {
  it("finds an agreement date", () => {
    expect(get("This Agreement is made on May 1, 2020.", "Agreement Date")?.value).toBe("May 1, 2020");
  });
  it("finds an effective date from a definition", () => {
    const t = 'as of January 1, 2020 (the "Effective Date"), the parties agree';
    expect(get(t, "Effective Date")?.value).toBe("January 1, 2020");
  });
  it("finds an effective date from 'effective as of'", () => {
    expect(get("This Agreement is effective as of June 3, 2021.", "Effective Date")?.value).toBe("June 3, 2021");
  });
  it("finds governing law with irregular spacing", () => {
    const t = "This Agreement shall be construed  in accordance  with the laws of the District of Columbia.";
    expect(get(t, "Governing Law")?.value).toBe("District of Columbia");
  });
  it("returns exact offsets", () => {
    const t = "Intro. It shall be governed by the laws of the State of Delaware. End.";
    const f = get(t, "Governing Law")!;
    expect(f.value).toBe("State of Delaware");
    expect(t.slice(f.startOffset, f.endOffset)).toBe(f.clause);
  });
  it("returns nothing when no pattern matches", () => {
    expect(ruleBasedFields("Nothing useful here.")).toEqual([]);
  });
});

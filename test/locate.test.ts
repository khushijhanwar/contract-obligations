import { describe, it, expect } from "vitest";
import { locateClause } from "../src/extraction/locate.js";

const contract = "This Agreement is made on May 1, 2020.\n\nIt shall be governed by the laws of\n  the State of Delaware.";

describe("locateClause", () => {
  it("finds an exact clause", () => {
    const r = locateClause(contract, "May 1, 2020");
    expect(r).not.toBeNull();
    expect(contract.slice(r!.start, r!.end)).toBe("May 1, 2020");
  });

  it("matches when whitespace differs", () => {
    const r = locateClause(contract, "governed by the laws of the State of Delaware");
    expect(r).not.toBeNull();
    expect(contract.slice(r!.start, r!.end)).toBe(r!.text);
    expect(r!.text).toContain("Delaware");
  });

  it("returns null when the clause is not in the contract", () => {
    expect(locateClause(contract, "State of Texas")).toBeNull();
  });

  it("returns null for an empty clause", () => {
    expect(locateClause(contract, "   ")).toBeNull();
  });
});

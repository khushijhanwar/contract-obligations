import { describe, it, expect } from "vitest";
import { extractFields, type LlmClient } from "../src/extraction/extract.js";
import { FIELDS } from "../src/extraction/fields.js";

const contract = "This Agreement is made on May 1, 2020. It is governed by the laws of the State of Delaware.";

const empty = () =>
  Object.fromEntries(FIELDS.map((f) => [f.key, { found: false, value: "", clause: "" }]));

const fake = (output: unknown): LlmClient => ({
  async generate() {
    return {
      text: typeof output === "string" ? output : JSON.stringify(output),
      inputTokens: 100,
      outputTokens: 20,
    };
  },
});

describe("extractFields", () => {
  it("returns verified fields with real offsets", async () => {
    const out = { ...empty(), governing_law: { found: true, value: "Delaware", clause: "the State of Delaware" } };
    const r = await extractFields(contract, fake(out));
    expect(r.status).toBe("ok");
    expect(r.fields).toHaveLength(1);
    const f = r.fields[0];
    expect(f.fieldName).toBe("Governing Law");
    expect(contract.slice(f.startOffset, f.endOffset)).toBe(f.clause);
    expect(r.inputTokens).toBe(100);
  });

  it("flags a clause that is not in the contract", async () => {
    const out = { ...empty(), governing_law: { found: true, value: "Texas", clause: "the State of Texas" } };
    const r = await extractFields(contract, fake(out));
    expect(r.fields).toHaveLength(0);
    expect(r.unverified).toHaveLength(1);
  });

  it("skips fields the model did not find", async () => {
    const r = await extractFields(contract, fake(empty()));
    expect(r.status).toBe("ok");
    expect(r.fields).toHaveLength(0);
    expect(r.unverified).toHaveLength(0);
  });

  it("rejects invalid JSON", async () => {
    const r = await extractFields(contract, fake("not json"));
    expect(r.status).toBe("invalid_output");
  });

  it("rejects JSON with the wrong shape", async () => {
    const r = await extractFields(contract, fake({ governing_law: "Delaware" }));
    expect(r.status).toBe("invalid_output");
  });
});

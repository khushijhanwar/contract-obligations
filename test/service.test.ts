import { describe, it, expect } from "vitest";
import { processDocument } from "../src/extraction/service.js";
import type { LlmClient } from "../src/extraction/extract.js";
import { FIELDS } from "../src/extraction/fields.js";

const contract = "This Agreement is made on May 1, 2020. It is governed by the laws of the State of Delaware.";
const empty = () => Object.fromEntries(FIELDS.map((f) => [f.key, { found: false, value: "", clause: "" }]));
const llmReturning = (text: string): LlmClient => ({
  async generate() {
    return { text, inputTokens: 10, outputTokens: 5 };
  },
});

function fakePrisma(done = false) {
  const calls: any = { runs: [], createMany: [], docStatus: [] };
  const p: any = {
    document: {
      findUniqueOrThrow: async () => ({ id: "d1", rawText: contract }),
      update: (args: any) => {
        calls.docStatus.push(args.data.status);
        return args;
      },
    },
    llmRun: {
      findFirst: async () => (done ? { id: "r1" } : null),
      create: (args: any) => {
        calls.runs.push(args.data);
        return args;
      },
    },
    extraction: {
      deleteMany: (args: any) => args,
      createMany: (args: any) => {
        calls.createMany.push(args.data);
        return args;
      },
    },
    $transaction: async (ops: any[]) => ops,
  };
  return { p, calls };
}

describe("processDocument", () => {
  it("skips a document that already has a successful run", async () => {
    const { p, calls } = fakePrisma(true);
    const r = await processDocument(p, "d1", llmReturning("{}"), "m", "v3");
    expect(r.skipped).toBe(true);
    expect(calls.runs).toHaveLength(0);
  });

  it("on invalid JSON, logs a failed run and saves rule-based fields", async () => {
    const { p, calls } = fakePrisma();
    const r = await processDocument(p, "d1", llmReturning("not json"), "m", "v3");
    expect(r.status).toBe("invalid_output");
    expect(calls.runs[0].success).toBe(false);
    const saved = calls.createMany[0];
    expect(saved.every((s: any) => s.model === "regex-fallback")).toBe(true);
    expect(saved.map((s: any) => s.fieldName)).toContain("Governing Law");
    expect(calls.docStatus.at(-1)).toBe("failed");
  });

  it("logs a failed run and rethrows when the LLM call fails", async () => {
    const { p, calls } = fakePrisma();
    const boom: LlmClient = {
      async generate() {
        throw new Error("boom");
      },
    };
    await expect(processDocument(p, "d1", boom, "m", "v3")).rejects.toThrow("boom");
    expect(calls.runs[0].success).toBe(false);
    expect(calls.docStatus.at(-1)).toBe("failed");
  });

  it("uses rule-based results only for fields the model did not find", async () => {
    const { p, calls } = fakePrisma();
    const out = { ...empty(), governing_law: { found: true, value: "Delaware", clause: "the State of Delaware" } };
    await processDocument(p, "d1", llmReturning(JSON.stringify(out)), "m", "v3");
    const byField = Object.fromEntries(calls.createMany[0].map((s: any) => [s.fieldName, s.model]));
    expect(byField["Governing Law"]).toBe("m");
    expect(byField["Agreement Date"]).toBe("regex-fallback");
    expect(calls.docStatus.at(-1)).toBe("extracted");
  });
});

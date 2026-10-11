import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { createUploadRouter } from "../src/upload.js";
import type { LlmClient } from "../src/extraction/extract.js";
import { FIELDS } from "../src/extraction/fields.js";

const text = "This Agreement is made on May 1, 2020. It is governed by the laws of the State of Delaware.";
const emptyJson = JSON.stringify(
  Object.fromEntries(FIELDS.map((f) => [f.key, { found: false, value: "", clause: "" }])),
);

function setup(opts: { done?: boolean; fail?: boolean } = {}) {
  let llmCalls = 0;
  const llm: LlmClient = {
    async generate() {
      llmCalls++;
      if (opts.fail) throw Object.assign(new Error("boom"), { status: 400 });
      return { text: emptyJson, inputTokens: 10, outputTokens: 5 };
    },
  };
  let upserted: any;
  const p: any = {
    document: {
      upsert: async (args: any) => {
        upserted = args;
        return { id: "d1", filename: args.create.filename };
      },
      findUniqueOrThrow: async () => ({ id: "d1", rawText: text }),
      update: (a: any) => a,
    },
    llmRun: { findFirst: async () => (opts.done ? { id: "r1" } : null), create: (a: any) => a },
    extraction: { deleteMany: (a: any) => a, createMany: (a: any) => a },
    $transaction: async (ops: any[]) => ops,
  };
  const app = express();
  app.use("/api", createUploadRouter(p, llm, "m"));
  return { app, calls: () => llmCalls, upserted: () => upserted };
}

describe("POST /api/documents", () => {
  it("rejects text that is too short", async () => {
    const { app } = setup();
    const r = await request(app).post("/api/documents").send({ filename: "a.txt", text: "tiny" });
    expect(r.status).toBe(400);
  });
  it("rejects a missing filename", async () => {
    const { app } = setup();
    expect((await request(app).post("/api/documents").send({ text })).status).toBe(400);
  });
  it("processes a new contract", async () => {
    const { app, calls, upserted } = setup();
    const r = await request(app).post("/api/documents").send({ filename: "a.txt", text });
    expect(r.status).toBe(201);
    expect(r.body.alreadyProcessed).toBe(false);
    expect(calls()).toBe(1);
    expect(upserted().where.contentHash).toHaveLength(64);
  });
  it("makes no LLM call for a contract that was already processed", async () => {
    const { app, calls } = setup({ done: true });
    const r = await request(app).post("/api/documents").send({ filename: "a.txt", text });
    expect(r.status).toBe(200);
    expect(r.body.alreadyProcessed).toBe(true);
    expect(calls()).toBe(0);
  });
  it("returns 502 with the document id when extraction fails", async () => {
    const { app } = setup({ fail: true });
    const r = await request(app).post("/api/documents").send({ filename: "a.txt", text });
    expect(r.status).toBe(502);
    expect(r.body.id).toBe("d1");
  });
});

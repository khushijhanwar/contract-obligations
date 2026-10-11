import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { createUploadRouter } from "../src/upload.js";
import type { LlmClient } from "../src/extraction/extract.js";
import { FIELDS } from "../src/extraction/fields.js";

const ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const MISSING = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const emptyJson = JSON.stringify(
  Object.fromEntries(FIELDS.map((f) => [f.key, { found: false, value: "", clause: "" }])),
);

function setup(fail = false) {
  let llmCalls = 0;
  const llm: LlmClient = {
    async generate() {
      llmCalls++;
      if (fail) throw Object.assign(new Error("boom"), { status: 400 });
      return { text: emptyJson, inputTokens: 1, outputTokens: 1 };
    },
  };
  const p: any = {
    document: {
      findUnique: async ({ where }: any) => (where.id === ID ? { id: ID } : null),
      findUniqueOrThrow: async () => ({ id: ID, rawText: "Some contract text." }),
      update: (a: any) => a,
    },
    llmRun: { findFirst: async () => null, create: (a: any) => a },
    extraction: { deleteMany: (a: any) => a, createMany: (a: any) => a },
    $transaction: async (ops: any[]) => ops,
  };
  const app = express();
  app.use("/api", createUploadRouter(p, llm, "m"));
  return { app, calls: () => llmCalls };
}

describe("POST /api/documents/:id/retry", () => {
  it("rejects a bad id", async () => {
    expect((await request(setup().app).post("/api/documents/nope/retry")).status).toBe(400);
  });
  it("returns 404 for an unknown document", async () => {
    expect((await request(setup().app).post(`/api/documents/${MISSING}/retry`)).status).toBe(404);
  });
  it("runs extraction again", async () => {
    const { app, calls } = setup();
    const r = await request(app).post(`/api/documents/${ID}/retry`);
    expect(r.status).toBe(200);
    expect(calls()).toBe(1);
  });
  it("returns 502 if it fails again", async () => {
    const r = await request(setup(true).app).post(`/api/documents/${ID}/retry`);
    expect(r.status).toBe(502);
  });
});

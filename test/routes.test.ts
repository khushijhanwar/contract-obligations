import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { createRouter } from "../src/routes.js";

const DOC = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const EX = "9b2f1c64-6a1e-4c77-8d2e-5f1a7b3c9d10";
const MISSING = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

let ops: any[] = [];

const fake: any = {
  document: {
    findMany: async () => [{ id: DOC, filename: "a.txt", split: "dev", status: "extracted" }],
    findUnique: async ({ where }: any) =>
      where.id === DOC ? { id: DOC, filename: "a.txt", rawText: "hello", extractions: [] } : null,
  },
  extraction: {
    findUnique: async ({ where }: any) =>
      where.id === EX ? { id: EX, value: "Delaware", status: "pending" } : null,
    update: (args: any) => ({ op: "update", args }),
  },
  review: { create: (args: any) => ({ op: "create", args }) },
  $transaction: async (list: any[]) => {
    ops = list;
    return list;
  },
};

const app = express();
app.use("/api", createRouter(fake));

beforeEach(() => {
  ops = [];
});

describe("documents", () => {
  it("lists documents", async () => {
    const r = await request(app).get("/api/documents");
    expect(r.status).toBe(200);
    expect(r.body).toHaveLength(1);
  });
  it("rejects a bad id", async () => {
    expect((await request(app).get("/api/documents/not-a-uuid")).status).toBe(400);
  });
  it("returns 404 for an unknown document", async () => {
    expect((await request(app).get(`/api/documents/${MISSING}`)).status).toBe(404);
  });
  it("returns a document", async () => {
    const r = await request(app).get(`/api/documents/${DOC}`);
    expect(r.status).toBe(200);
    expect(r.body.rawText).toBe("hello");
  });
});

describe("review", () => {
  it("requires a reviewer", async () => {
    const r = await request(app).post(`/api/extractions/${EX}/review`).send({ action: "approved" });
    expect(r.status).toBe(400);
    expect(ops).toHaveLength(0);
  });
  it("requires a new value for a correction", async () => {
    const r = await request(app)
      .post(`/api/extractions/${EX}/review`)
      .send({ action: "corrected", reviewer: "Khushi" });
    expect(r.status).toBe(400);
  });
  it("returns 404 for an unknown extraction", async () => {
    const r = await request(app)
      .post(`/api/extractions/${MISSING}/review`)
      .send({ action: "approved", reviewer: "Khushi" });
    expect(r.status).toBe(404);
  });
  it("saves an approval", async () => {
    const r = await request(app)
      .post(`/api/extractions/${EX}/review`)
      .send({ action: "approved", reviewer: "Khushi" });
    expect(r.status).toBe(201);
    expect(ops[1].args.data).toEqual({ status: "approved", value: "Delaware" });
  });
  it("saves a correction with old value, new value and reviewer", async () => {
    const r = await request(app)
      .post(`/api/extractions/${EX}/review`)
      .send({ action: "corrected", reviewer: "Khushi", newValue: "Texas" });
    expect(r.status).toBe(201);
    expect(ops[0].args.data).toMatchObject({
      action: "corrected",
      oldValue: "Delaware",
      newValue: "Texas",
      reviewer: "Khushi",
    });
    expect(ops[1].args.data).toEqual({ status: "corrected", value: "Texas" });
  });
});

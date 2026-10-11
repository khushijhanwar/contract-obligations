import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { createObligationsRouter } from "../src/obligations.js";

let lastArgs: any;
const fake: any = {
  extraction: {
    findMany: async (args: any) => {
      lastArgs = args;
      return [{ id: "1" }];
    },
  },
};

const app = express();
app.use("/api", createObligationsRouter(fake));

beforeEach(() => {
  lastArgs = undefined;
});

describe("GET /api/obligations", () => {
  it("only returns fields a person has reviewed", async () => {
    const r = await request(app).get("/api/obligations");
    expect(r.status).toBe(200);
    expect(lastArgs.where.status).toEqual({ in: ["approved", "corrected"] });
  });
  it("filters by field and text", async () => {
    await request(app).get("/api/obligations?field=Governing%20Law&q=Delaware");
    expect(lastArgs.where.fieldName).toBe("Governing Law");
    expect(lastArgs.where.value.contains).toBe("Delaware");
  });
  it("rejects an empty search", async () => {
    expect((await request(app).get("/api/obligations?q=")).status).toBe(400);
  });
});

import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { createDemoRouter } from "../src/demo.js";

const app = express();
app.use("/api", createDemoRouter());

describe("demo mode", () => {
  it("blocks uploads", async () => {
    const r = await request(app).post("/api/documents").send({ filename: "a.txt", text: "x" });
    expect(r.status).toBe(403);
  });
  it("blocks retries", async () => {
    const r = await request(app).post("/api/documents/3f2504e0-4f89-41d3-9a0c-0305e82c3301/retry");
    expect(r.status).toBe(403);
  });
});

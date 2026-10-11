import express, { Router } from "express";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { PrismaClient } from "./generated/prisma/client.js";
import type { LlmClient } from "./extraction/extract.js";
import { processDocument } from "./extraction/service.js";

const Body = z.object({
  filename: z.string().trim().min(1).max(200),
  text: z.string().min(50).max(1_000_000),
});

export function createUploadRouter(prisma: PrismaClient, llm: LlmClient, model: string): Router {
  const router = Router();

  // Contracts can be large, so this route allows a bigger body than the default 100 KB.
  router.post("/documents", express.json({ limit: "2mb" }), async (req, res) => {
    const body = Body.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "invalid_body", issues: body.error.issues });
    const { filename, text } = body.data;
    const contentHash = createHash("sha256").update(text).digest("hex");

    let docId = "";
    try {
      // Same text, same row. Two uploads of one file never create two documents.
      const doc = await prisma.document.upsert({
        where: { contentHash },
        create: { filename, contentHash, rawText: text, status: "uploaded" },
        update: {},
      });
      docId = doc.id;
      const result = await processDocument(prisma, doc.id, llm, model);
      res.status(result.skipped ? 200 : 201).json({ id: doc.id, filename: doc.filename, alreadyProcessed: result.skipped, ...result });
    } catch (e) {
      console.error(e);
      res.status(502).json({ error: "extraction_failed", id: docId || undefined });
    }
  });

  return router;
}

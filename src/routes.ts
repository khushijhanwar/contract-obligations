import express, { Router, type Request, type Response, type RequestHandler } from "express";
import { z } from "zod";
import type { PrismaClient } from "./generated/prisma/client.js";
import { PROMPT_VERSION } from "./extraction/prompt.js";

const IdParam = z.string().uuid();

const ReviewBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approved"), reviewer: z.string().trim().min(1) }),
  z.object({
    action: z.literal("corrected"),
    reviewer: z.string().trim().min(1),
    newValue: z.string().trim().min(1),
  }),
]);

type Handler = (req: Request, res: Response) => Promise<unknown>;
const wrap = (fn: Handler): RequestHandler => (req, res, next) => {
  fn(req, res).catch(next);
};

export function createRouter(prisma: PrismaClient): Router {
  const router = Router();
  router.use(express.json());

  router.get("/documents", wrap(async (_req, res) => {
    const docs = await prisma.document.findMany({
      orderBy: { filename: "asc" },
      select: { id: true, filename: true, split: true, status: true },
    });
    res.json(docs);
  }));

  router.get("/documents/:id", wrap(async (req, res) => {
    const id = IdParam.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: "invalid_id" });
    const doc = await prisma.document.findUnique({
      where: { id: id.data },
      include: {
        // Only the current prompt version, so older experiment runs do not show up.
        extractions: { where: { promptVersion: PROMPT_VERSION }, orderBy: { startOffset: "asc" } },
      },
    });
    if (!doc) return res.status(404).json({ error: "not_found" });
    res.json(doc);
  }));

  router.post("/extractions/:id/review", wrap(async (req, res) => {
    const id = IdParam.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: "invalid_id" });
    const body = ReviewBody.safeParse(req.body);
    if (!body.success) return res.status(400).json({ error: "invalid_body", issues: body.error.issues });

    const ex = await prisma.extraction.findUnique({ where: { id: id.data } });
    if (!ex) return res.status(404).json({ error: "not_found" });

    const b = body.data;
    const newValue = b.action === "corrected" ? b.newValue : ex.value;
    // One transaction: the audit row and the status change succeed or fail together.
    const [review, extraction] = await prisma.$transaction([
      prisma.review.create({
        data: { extractionId: ex.id, action: b.action, oldValue: ex.value, newValue, reviewer: b.reviewer },
      }),
      prisma.extraction.update({ where: { id: ex.id }, data: { status: b.action, value: newValue } }),
    ]);
    res.status(201).json({ review, extraction });
  }));

  router.use((err: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "server_error" });
  });

  return router;
}

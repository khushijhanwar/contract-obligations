import { Router } from "express";
import { z } from "zod";
import type { PrismaClient } from "./generated/prisma/client.js";
import { PROMPT_VERSION } from "./extraction/prompt.js";

const Query = z.object({
  field: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).optional(),
});

export function createObligationsRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get("/obligations", async (req, res) => {
    const query = Query.safeParse(req.query);
    if (!query.success) return res.status(400).json({ error: "invalid_query" });
    try {
      const { field, q } = query.data;
      const rows = await prisma.extraction.findMany({
        where: {
          promptVersion: PROMPT_VERSION,
          // Nothing counts until a person has approved or corrected it.
          status: { in: ["approved", "corrected"] },
          ...(field && { fieldName: field }),
          ...(q && { value: { contains: q, mode: "insensitive" } }),
        },
        orderBy: [{ fieldName: "asc" }, { document: { filename: "asc" } }],
        select: {
          id: true,
          fieldName: true,
          value: true,
          sourceClause: true,
          startOffset: true,
          endOffset: true,
          status: true,
          document: { select: { id: true, filename: true } },
        },
      });
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "server_error" });
    }
  });

  return router;
}

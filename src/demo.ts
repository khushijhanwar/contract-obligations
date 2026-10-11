import { Router } from "express";

// On the public demo, uploads and retries are off: they send text to a free-tier LLM.
export function createDemoRouter(): Router {
  const router = Router();
  router.post(["/documents", "/documents/:id/retry"], (_req, res) => {
    res.status(403).json({ error: "disabled_in_demo" });
  });
  return router;
}

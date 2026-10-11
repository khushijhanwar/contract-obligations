import express from "express";
import path from "node:path";
import { existsSync } from "node:fs";
import { app } from "./app.js";
import { prisma } from "./db.js";
import { createRouter } from "./routes.js";
import { createObligationsRouter } from "./obligations.js";
import { createUploadRouter } from "./upload.js";
import { createDemoRouter } from "./demo.js";
import { createGeminiClient } from "./extraction/gemini.js";

if (process.env.DEMO_MODE === "true") {
  app.use("/api", createDemoRouter());
} else {
  const model = process.env.GEMINI_MODEL;
  if (!model) throw new Error("GEMINI_MODEL is not set");
  app.use("/api", createUploadRouter(prisma, createGeminiClient(model), model));
}
app.use("/api", createRouter(prisma));
app.use("/api", createObligationsRouter(prisma));

// When the web screen has been built, serve it from this same server.
const webDist = path.resolve(process.cwd(), "web/dist");
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(webDist, "index.html")));
}

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

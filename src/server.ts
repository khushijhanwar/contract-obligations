import { app } from "./app.js";
import { prisma } from "./db.js";
import { createRouter } from "./routes.js";
import { createObligationsRouter } from "./obligations.js";
import { createUploadRouter } from "./upload.js";
import { createGeminiClient } from "./extraction/gemini.js";

const model = process.env.GEMINI_MODEL;
if (!model) throw new Error("GEMINI_MODEL is not set");

// The upload router goes first: it parses large bodies itself.
app.use("/api", createUploadRouter(prisma, createGeminiClient(model), model));
app.use("/api", createRouter(prisma));
app.use("/api", createObligationsRouter(prisma));

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

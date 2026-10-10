import "dotenv/config";
import { prisma } from "../src/db.js";
import { createGeminiClient } from "../src/extraction/gemini.js";
import { processDocument } from "../src/extraction/service.js";

const model = process.env.GEMINI_MODEL;
if (!model) throw new Error("GEMINI_MODEL is not set");

const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const llm = createGeminiClient(model);
// Only the dev split. The held-out set is for the final test.
const docs = await prisma.document.findMany({
  where: { split: "dev" },
  orderBy: { filename: "asc" },
  take: limit,
});

let done = 0, skipped = 0, failed = 0;
for (const d of docs) {
  let attempt = 0;
  while (true) {
    try {
      const r = await processDocument(prisma, d.id, llm, model);
      if (r.skipped) {
        skipped++;
        console.log("skip", d.filename);
      } else {
        done++;
        console.log("ok  ", d.filename, `saved=${r.saved} unverified=${r.unverified} status=${r.status}`);
      }
      break;
    } catch (e: any) {
      attempt++;
      const status = e?.status ?? e?.code;
      if (attempt < 3 && (status === 429 || status === 503)) {
        console.log(`  ${status}, waiting 30s (try ${attempt}/3)`);
        await sleep(30_000);
        continue;
      }
      failed++;
      console.log("FAIL", d.filename, status, String(e?.message ?? e).slice(0, 150));
      break;
    }
  }
  await sleep(1000);
}

const s = await prisma.llmRun.aggregate({
  where: { model, success: true },
  _count: true,
  _sum: { inputTokens: true, outputTokens: true, cost: true },
  _avg: { latencyMs: true },
});
console.log({ done, skipped, failed });
console.log("successful runs:", s._count, "| input:", s._sum.inputTokens, "| output:", s._sum.outputTokens,
  "| cost USD:", String(s._sum.cost), "| avg ms:", Math.round(s._avg.latencyMs ?? 0));
await prisma.$disconnect();

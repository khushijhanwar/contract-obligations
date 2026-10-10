import "dotenv/config";
import { prisma } from "../src/db.js";
import { createGeminiClient } from "../src/extraction/gemini.js";
import { processDocument } from "../src/extraction/service.js";

const model = process.env.GEMINI_MODEL;
if (!model) throw new Error("GEMINI_MODEL is not set");

const id = process.argv[2];
const doc = id
  ? await prisma.document.findUniqueOrThrow({ where: { id } })
  : await prisma.document.findFirstOrThrow({ where: { split: "dev" }, orderBy: { filename: "asc" } });

console.log("document:", doc.filename, "| chars:", doc.rawText.length, "| id:", doc.id);
console.log(await processDocument(prisma, doc.id, createGeminiClient(model), model));

const rows = await prisma.extraction.findMany({ where: { documentId: doc.id }, orderBy: { fieldName: "asc" } });
for (const r of rows) {
  console.log(`  ${r.fieldName}: "${r.value}" [${r.startOffset}-${r.endOffset}]`);
}
await prisma.$disconnect();

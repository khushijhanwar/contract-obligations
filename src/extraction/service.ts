import type { PrismaClient } from "../generated/prisma/client.js";
import { extractFields, type LlmClient } from "./extract.js";
import { PROMPT_VERSION } from "./prompt.js";
import { costUsd } from "./pricing.js";

export async function processDocument(
  prisma: PrismaClient,
  documentId: string,
  llm: LlmClient,
  model: string,
  version: string = PROMPT_VERSION,
): Promise<{ skipped: boolean; status?: string; saved?: number; unverified?: number }> {
  const doc = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });

  // Idempotency: a successful run for this document, model and prompt means no new LLM call.
  const done = await prisma.llmRun.findFirst({
    where: { documentId, model, promptVersion: version, success: true },
  });
  if (done) return { skipped: true };

  await prisma.document.update({ where: { id: documentId }, data: { status: "processing" } });

  const started = Date.now();
  let outcome;
  try {
    outcome = await extractFields(doc.rawText, llm, version);
  } catch (e) {
    await prisma.llmRun.create({
      data: {
        documentId,
        model,
        promptVersion: version,
        latencyMs: Date.now() - started,
        success: false,
        error: String(e).slice(0, 500),
      },
    });
    await prisma.document.update({ where: { id: documentId }, data: { status: "failed" } });
    throw e;
  }

  const ok = outcome.status === "ok";
  await prisma.$transaction([
    prisma.llmRun.create({
      data: {
        documentId,
        model,
        promptVersion: version,
        inputTokens: outcome.inputTokens,
        outputTokens: outcome.outputTokens,
        cost: costUsd(model, outcome.inputTokens, outcome.outputTokens),
        latencyMs: Date.now() - started,
        success: ok,
        error: ok ? null : outcome.status,
      },
    }),
    prisma.extraction.createMany({
      data: outcome.fields.map((f) => ({
        documentId,
        fieldName: f.fieldName,
        value: f.value,
        sourceClause: f.clause,
        startOffset: f.startOffset,
        endOffset: f.endOffset,
        model,
        promptVersion: version,
      })),
      skipDuplicates: true,
    }),
    prisma.document.update({
      where: { id: documentId },
      data: { status: ok ? "extracted" : "failed" },
    }),
  ]);

  return { skipped: false, status: outcome.status, saved: outcome.fields.length, unverified: outcome.unverified.length };
}

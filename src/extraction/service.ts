import type { PrismaClient } from "../generated/prisma/client.js";
import { extractFields, type LlmClient, type ExtractedField } from "./extract.js";
import { PROMPT_VERSION } from "./prompt.js";
import { costUsd } from "./pricing.js";

export const FALLBACK_MODEL = "regex-fallback";

export async function processDocument(
  prisma: PrismaClient,
  documentId: string,
  llm: LlmClient,
  model: string,
  version: string = PROMPT_VERSION,
): Promise<{ skipped: boolean; status?: string; saved?: number; fallback?: number; unverified?: number }> {
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
  const row = (f: ExtractedField, m: string) => ({
    documentId,
    fieldName: f.fieldName,
    value: f.value,
    sourceClause: f.clause,
    startOffset: f.startOffset,
    endOffset: f.endOffset,
    model: m,
    promptVersion: version,
  });

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
    // Drop rule-based rows nobody has reviewed, so a later model run can replace them.
    prisma.extraction.deleteMany({
      where: { documentId, promptVersion: version, model: FALLBACK_MODEL, status: "pending" },
    }),
    prisma.extraction.createMany({
      data: [
        ...outcome.fields.map((f) => row(f, model)),
        ...outcome.fallback.map((f) => row(f, FALLBACK_MODEL)),
      ],
      skipDuplicates: true,
    }),
    prisma.document.update({
      where: { id: documentId },
      data: { status: ok ? "extracted" : "failed" },
    }),
  ]);

  return {
    skipped: false,
    status: outcome.status,
    saved: outcome.fields.length,
    fallback: outcome.fallback.length,
    unverified: outcome.unverified.length,
  };
}
